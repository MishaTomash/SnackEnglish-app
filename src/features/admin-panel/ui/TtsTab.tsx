// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/TtsTab.tsx
import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { ChevronDown, ChevronUp, Mic2, Play, RefreshCw, Save, Square, Trash2, Wand2 } from "lucide-react";
import { resolveMediaUrl } from "../../../shared/lib/avatarUrl";
import { adminApi, getErrorMessage } from "../api";
import type { SpeechRole, TtsChapter, TtsJob, TtsOverview, TtsPhrase, TtsSettings } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    EmptyState,
    ErrorState,
    LoadingState,
    Notice,
    Pill,
    Section,
    StatCard,
    fieldClass,
    formatNumber,
} from "./primitives";

const MODEL_INFO: Record<string, { title: string; hint: string }> = {
    "gpt-4o-mini-tts": {
        title: "gpt-4o-mini-tts — рекомендовано",
        hint: "Найприродніша, розуміє інструкцію «як говорити». ≈ $16 за 1M символів.",
    },
    "tts-1": { title: "tts-1", hint: "Старіша, трохи більш «дикторська». ≈ $15 за 1M символів." },
    "tts-1-hd": { title: "tts-1-hd", hint: "Як tts-1, трохи чистіший звук. ≈ $30 за 1M символів." },
};

const VOICE_HINTS: Record<string, string> = {
    alloy: "нейтральний",
    ash: "чоловічий, спокійний",
    ballad: "чоловічий, м'який",
    coral: "жіночий, теплий",
    echo: "чоловічий, рівний",
    fable: "виразний, «казковий»",
    nova: "жіночий, бадьорий",
    onyx: "чоловічий, низький",
    sage: "жіночий, спокійний",
    shimmer: "жіночий, світлий",
    verse: "чоловічий, живий",
};

/** Орієнтовна ціна за 1M символів — як на сервері (ttsService) */
const PRICE_PER_MILLION_CHARS: Record<string, number> = { "gpt-4o-mini-tts": 16, "tts-1": 15, "tts-1-hd": 30 };

const ROLE_LABELS: Record<SpeechRole, string> = {
    narrator: "📖 Диктор",
    snacky: "🍪 Снекі",
    user: "🙋 Юзер",
    npc: "🧑 Персонаж",
};

/** Голоси персонажів: поле налаштувань, підпис, приклад фрази */
const ROLE_VOICE_FIELDS: readonly {
    field: "ttsVoiceSnacky" | "ttsVoiceUser" | "ttsVoiceNpc";
    label: string;
    hint: string;
    sample: string;
}[] = [
        { field: "ttsVoiceSnacky", label: "🍪 Снекі", hint: "маскот, веде історію", sample: "Hi! I'm Snekie, your cookie friend. Let's go!" },
        { field: "ttsVoiceUser", label: "🙋 Юзер", hint: "репліки й відповіді юзера", sample: "I'm fine, thank you! And you?" },
        { field: "ttsVoiceNpc", label: "🧑 Персонаж уроку", hint: "бариста, офіціант…", sample: "Good morning! What would you like to order?" },
    ];

const SAMPLE_TEXT = "Hello! I'm Snekie. Let's order a coffee together. Could I have a cappuccino, please?";

const formatUsd = (value: number): string => (value < 0.01 && value > 0 ? "< $0.01" : `$${value.toFixed(2)}`);

/** Одночасно грає лише один звук у вкладці */
const usePlayer = (playbackRate = 1) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingKey, setPlayingKey] = useState<string | null>(null);

    const play = (key: string, src: string) => {
        audioRef.current?.pause();
        const audio = new Audio(src);
        // Та сама швидкість, що в уроках — щоб чути, як буде в юзера
        audio.preservesPitch = true;
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        setPlayingKey(key);
        audio.onended = () => setPlayingKey((k) => (k === key ? null : k));
        audio.onerror = () => setPlayingKey((k) => (k === key ? null : k));
        audio.play().catch(() => setPlayingKey(null));
    };
    const stop = () => {
        audioRef.current?.pause();
        setPlayingKey(null);
    };
    useEffect(() => () => audioRef.current?.pause(), []);
    return { play, stop, playingKey };
};

type Player = ReturnType<typeof usePlayer>;

// ==================== ФРАЗИ УРОКУ ====================

const NodePhrases: FC<{ nodeId: string; player: Player; onChanged: () => void }> = ({ nodeId, player, onChanged }) => {
    const [phrases, setPhrases] = useState<TtsPhrase[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const load = () => {
        adminApi
            .ttsNode(nodeId)
            .then(setPhrases)
            .catch((loadError: unknown) => setError(getErrorMessage(loadError)));
    };
    useEffect(load, [nodeId]);

    const regenerate = async (phrase: TtsPhrase) => {
        if (phrase.url && !window.confirm(`Перегенерувати «${phrase.text}»? Старий варіант буде замінено.`)) return;
        setBusyKey(phrase.key);
        setError(null);
        try {
            const url = await adminApi.ttsRegenerate(phrase.text, phrase.role, phrase.style);
            setPhrases((prev) => prev?.map((p) => (p.key === phrase.key ? { ...p, url } : p)) ?? null);
            // Новий файл має той самий шлях — додаємо мітку часу, щоб браузер не взяв старий з кешу
            player.play(phrase.key, `${resolveMediaUrl(url) ?? url}&t=${Date.now()}`);
            onChanged();
        } catch (regenError) {
            setError(getErrorMessage(regenError));
        } finally {
            setBusyKey(null);
        }
    };

    if (error && !phrases) return <p className="text-xs text-[var(--accent-error)]">{error}</p>;
    if (!phrases) return <p className="py-2 text-xs text-[var(--text-muted)]">Завантаження фраз…</p>;
    if (phrases.length === 0) return <p className="py-2 text-xs text-[var(--text-muted)]">Англійських фраз не знайдено</p>;

    return (
        <div className="mt-2 space-y-1">
            {error && <Notice kind="error">{error}</Notice>}
            {phrases.map((phrase) => {
                const src = phrase.url ? resolveMediaUrl(phrase.url) : null;
                const isPlaying = player.playingKey === phrase.key;
                return (
                    <div key={phrase.key} className="flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-2 py-1.5">
                        <button
                            type="button"
                            disabled={!src}
                            onClick={() => (isPlaying ? player.stop() : src && player.play(phrase.key, src))}
                            aria-label={isPlaying ? "Зупинити" : `Прослухати «${phrase.text}»`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-app)] text-[var(--accent-cta)] disabled:opacity-30"
                        >
                            {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-main)]" title={phrase.text}>
                            {phrase.text}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                            {ROLE_LABELS[phrase.role] ?? ""}
                            {phrase.style ? ` · ${phrase.style}` : ""}
                        </span>
                        {!phrase.url && <Pill tone="warning">немає</Pill>}
                        <button
                            type="button"
                            onClick={() => void regenerate(phrase)}
                            disabled={busyKey !== null}
                            aria-label={phrase.url ? "Перегенерувати" : "Озвучити"}
                            title={phrase.url ? "Перегенерувати" : "Озвучити"}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${busyKey === phrase.key ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

// ==================== РОЗДІЛ ====================

const ChapterRow: FC<{
    chapter: TtsChapter;
    player: Player;
    canGenerate: boolean;
    onGenerate: (scope: "chapter" | "node", id: string, label: string) => void;
    onChanged: () => void;
}> = ({ chapter, player, canGenerate, onGenerate, onChanged }) => {
    const [open, setOpen] = useState(false);
    const [openNode, setOpenNode] = useState<string | null>(null);
    const percent = chapter.total > 0 ? Math.round((chapter.ready / chapter.total) * 100) : 100;
    const missing = chapter.total - chapter.ready;

    return (
        <li className="rounded-2xl bg-[var(--bg-app)] p-3">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-[var(--text-main)]">{chapter.title}</span>
                            <Pill>{chapter.level}</Pill>
                            {missing === 0 && chapter.total > 0 && <Pill tone="success">готово</Pill>}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                            {chapter.ready} з {chapter.total} фраз{missing > 0 ? ` · бракує ${missing} (≈ ${formatUsd(chapter.missingCostUsd)})` : ""}
                        </p>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-card)]">
                    <div className="h-full rounded-full bg-[var(--accent-success)]" style={{ width: `${percent}%` }} />
                </div>
            </button>

            {open && (
                <div className="mt-3 space-y-2">
                    {missing > 0 && (
                        <AdminButton
                            variant="secondary"
                            className="w-full"
                            disabled={!canGenerate}
                            onClick={() => onGenerate("chapter", chapter.id, `розділ «${chapter.title}»`)}
                        >
                            <Wand2 className="h-4 w-4" aria-hidden="true" /> Озвучити розділ (≈ {formatUsd(chapter.missingCostUsd)})
                        </AdminButton>
                    )}
                    {chapter.nodes.length === 0 ? (
                        <EmptyState>Уроків немає</EmptyState>
                    ) : (
                        <ul className="space-y-1.5">
                            {chapter.nodes.map((node, index) => (
                                <li key={node.id} className="rounded-xl border border-[var(--border-color)] p-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOpenNode((v) => (v === node.id ? null : node.id))}
                                            className="min-w-0 flex-1 text-left"
                                            aria-expanded={openNode === node.id}
                                        >
                                            <span className="block truncate text-sm text-[var(--text-main)]">
                                                {index + 1}. {node.label}
                                            </span>
                                            <span className="text-[11px] text-[var(--text-muted)]">
                                                {node.ready} / {node.total} фраз
                                            </span>
                                        </button>
                                        {node.ready < node.total && (
                                            <AdminButton
                                                variant="secondary"
                                                disabled={!canGenerate}
                                                onClick={() => onGenerate("node", node.id, `урок «${node.label}»`)}
                                                className="px-3"
                                            >
                                                <Wand2 className="h-4 w-4" aria-hidden="true" />
                                                <span className="sr-only">Озвучити урок</span>
                                            </AdminButton>
                                        )}
                                    </div>
                                    {openNode === node.id && <NodePhrases nodeId={node.id} player={player} onChanged={onChanged} />}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </li>
    );
};

// ==================== ВКЛАДКА ====================

export const TtsTab: FC = () => {
    const { data, error, isLoading, reload } = useAdminQuery(() => adminApi.ttsOverview(), []);
    const [form, setForm] = useState<TtsSettings | null>(null);
    const [job, setJob] = useState<TtsJob | null>(null);
    const [sampleText, setSampleText] = useState(SAMPLE_TEXT);
    const [busy, setBusy] = useState<"save" | "preview" | "generate" | "cleanup" | "cancel" | null>(null);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
    const player = usePlayer(form?.ttsPlaybackRate ?? 1);

    useEffect(() => {
        if (data) {
            setForm(data.settings);
            setJob(data.job);
        }
    }, [data]);

    // Прогрес озвучки: опитуємо, поки триває; після завершення — оновлюємо цифри
    const running = Boolean(job?.running);
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => {
            adminApi
                .ttsJob()
                .then((next) => {
                    setJob(next);
                    if (!next.running) reload();
                })
                .catch(() => undefined);
        }, 2000);
        return () => clearInterval(timer);
    }, [running, reload]);

    if (isLoading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} onRetry={reload} />;
    if (!data || !form) return null;

    const overview: TtsOverview = data;
    const { totals } = overview;
    const update = (patch: Partial<TtsSettings>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    const isDirty = JSON.stringify(form) !== JSON.stringify(overview.settings);
    const voiceChanged =
        form.ttsModel !== overview.settings.ttsModel ||
        form.ttsVoice !== overview.settings.ttsVoice ||
        form.ttsVoiceSnacky !== overview.settings.ttsVoiceSnacky ||
        form.ttsVoiceUser !== overview.settings.ttsVoiceUser ||
        form.ttsVoiceNpc !== overview.settings.ttsVoiceNpc ||
        (form.ttsModel === "gpt-4o-mini-tts"
            ? form.ttsInstructions !== overview.settings.ttsInstructions
            : form.ttsSpeed !== overview.settings.ttsSpeed);
    const isMini = form.ttsModel === "gpt-4o-mini-tts";
    const readyPercent = totals.phrases > 0 ? Math.round((totals.ready / totals.phrases) * 100) : 0;
    const canGenerate = overview.configured && !running;

    const run = async (key: NonNullable<typeof busy>, action: () => Promise<string | void>) => {
        setBusy(key);
        setNotice(null);
        try {
            const message = await action();
            if (message) setNotice({ kind: "success", text: message });
        } catch (actionError) {
            setNotice({ kind: "error", text: getErrorMessage(actionError) });
        } finally {
            setBusy(null);
        }
    };

    const save = () =>
        run("save", async () => {
            await adminApi.updateSettings(form);
            reload();
            return voiceChanged
                ? "Збережено. Голос змінився — фрази треба озвучити заново (кнопка нижче)."
                : "Налаштування збережено";
        });

    const preview = (voice: string = form.ttsVoice, text: string = sampleText, key = "__sample__") =>
        run("preview", async () => {
            const blob = await adminApi.ttsPreview({
                text,
                model: form.ttsModel,
                voice,
                speed: form.ttsSpeed,
                instructions: form.ttsInstructions,
            });
            player.play(key, URL.createObjectURL(blob));
        });

    const generate = (scope: "all" | "chapter" | "node", id: string | undefined, label: string, cost: number) => {
        if (!window.confirm(`Озвучити ${label}? Орієнтовна вартість: ${formatUsd(cost)}.`)) return;
        void run("generate", async () => {
            const total = await adminApi.ttsGenerate(scope, id);
            setJob(await adminApi.ttsJob());
            return total === 0 ? "Усе вже озвучено" : `Озвучка запущена: ${total} фраз`;
        });
    };

    const jobPercent = job && job.total > 0 ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;

    return (
        <div className="space-y-4">
            {!overview.configured && (
                <Notice kind="error">
                    Немає ключа OpenAI. Додай у backend/.env рядок OPENAI_API_KEY=sk-... (той самий, що для розпізнавання голосу) і
                    перезапусти сервер.
                </Notice>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Озвучено фраз" value={`${readyPercent}%`} hint={`${formatNumber(totals.ready)} з ${formatNumber(totals.phrases)}`} accent={readyPercent === 100 ? "success" : "cta"} />
                <StatCard label="Бракує" value={formatNumber(totals.phrases - totals.ready)} hint={`≈ ${formatUsd(totals.missingCostUsd)}`} />
                <StatCard
                    label="Витрачено цього місяця"
                    value={formatUsd(totals.monthSpendUsd)}
                    hint={form.ttsMonthlyLimitUsd > 0 ? `ліміт $${form.ttsMonthlyLimitUsd}` : "без ліміту"}
                />
                <StatCard label="Файлів" value={formatNumber(totals.storedClips)} hint={`${totals.storedMb} МБ · усього ${formatUsd(totals.allTimeCostUsd)}`} />
            </div>

            {job && job.status !== "idle" && (
                <Section title={running ? "Озвучка триває…" : "Остання озвучка"}>
                    <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--bg-app)]">
                        <div className="h-full rounded-full bg-[var(--accent-cta)] transition-[width] duration-500" style={{ width: `${running ? jobPercent : 100}%` }} />
                    </div>
                    <p className="text-sm text-[var(--text-main)]">
                        {job.scope ? `${job.scope}: ` : ""}✅ {job.done} · ⚠️ {job.failed} з {job.total} · {formatUsd(job.spentUsd)}
                    </p>
                    {job.status === "limit_reached" && <Notice kind="error">Зупинено: досягнуто місячного ліміту витрат. Збільш ліміт нижче.</Notice>}
                    {job.error && job.status !== "limit_reached" && <p className="mt-1 text-xs text-[var(--text-muted)]">{job.error}</p>}
                    {running && (
                        <AdminButton variant="danger" className="mt-3 w-full" loading={busy === "cancel"} onClick={() => void run("cancel", async () => adminApi.ttsCancel())}>
                            <Square className="h-4 w-4" aria-hidden="true" /> Зупинити
                        </AdminButton>
                    )}
                </Section>
            )}

            <Section title="Голос">
                <div className="space-y-4">
                    <label className="flex items-start justify-between gap-3">
                        <span>
                            <span className="block text-sm font-bold text-[var(--text-main)]">Грати озвучку в уроках</span>
                            <span className="text-xs text-[var(--text-muted)]">
                                Вимкнено — уроки говорять голосом телефона, як раніше. Фрази без озвучки завжди говорить телефон.
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={form.ttsEnabled}
                            onChange={(e) => update({ ttsEnabled: e.target.checked })}
                            className="mt-1 h-5 w-5 accent-[var(--accent-success)]"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-bold text-[var(--text-main)]">Модель</span>
                        <select value={form.ttsModel} onChange={(e) => update({ ttsModel: e.target.value })} className={`${fieldClass} mt-1`}>
                            {overview.options.models.map((m) => (
                                <option key={m} value={m}>
                                    {MODEL_INFO[m]?.title ?? m}
                                </option>
                            ))}
                        </select>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">{MODEL_INFO[form.ttsModel]?.hint}</span>
                    </label>

                    <label className="block">
                        <span className="text-sm font-bold text-[var(--text-main)]">Основний голос (диктор: слова, картки, аудіювання)</span>
                        <select value={form.ttsVoice} onChange={(e) => update({ ttsVoice: e.target.value })} className={`${fieldClass} mt-1`}>
                            {overview.options.voices.map((v) => {
                                const unavailable = !isMini && overview.options.miniOnlyVoices.includes(v);
                                return (
                                    <option key={v} value={v} disabled={unavailable}>
                                        {v} — {VOICE_HINTS[v] ?? ""}
                                        {unavailable ? " (лише gpt-4o-mini-tts)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </label>

                    <div className="rounded-2xl border border-[var(--border-color)] p-3">
                        <p className="mb-2 text-sm font-bold text-[var(--text-main)]">Голоси персонажів</p>
                        <div className="space-y-2">
                            {ROLE_VOICE_FIELDS.map((role) => {
                                const value = form[role.field];
                                const effective = value || form.ttsVoice;
                                return (
                                    <div key={role.field} className="grid grid-cols-[1fr_auto] items-end gap-2">
                                        <label className="block min-w-0">
                                            <span className="text-xs font-bold text-[var(--text-muted)]">
                                                {role.label} <span className="font-normal">— {role.hint}</span>
                                            </span>
                                            <select
                                                value={value}
                                                onChange={(e) => update({ [role.field]: e.target.value } as Partial<TtsSettings>)}
                                                className={`${fieldClass} mt-1`}
                                            >
                                                <option value="">як основний ({form.ttsVoice})</option>
                                                {overview.options.voices.map((v) => {
                                                    const unavailable = !isMini && overview.options.miniOnlyVoices.includes(v);
                                                    return (
                                                        <option key={v} value={v} disabled={unavailable}>
                                                            {v} — {VOICE_HINTS[v] ?? ""}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </label>
                                        <AdminButton
                                            variant="secondary"
                                            className="px-3"
                                            disabled={!overview.configured || busy === "preview"}
                                            onClick={() => void preview(effective, role.sample, role.field)}
                                        >
                                            {player.playingKey === role.field ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                            <span className="sr-only">Прослухати голос {role.label}</span>
                                        </AdminButton>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <label className="block rounded-2xl bg-[var(--bg-app)] p-3">
                        <span className="text-sm font-bold text-[var(--text-main)]">
                            Швидкість у уроках: {(form.ttsPlaybackRate ?? 1).toFixed(2)}×
                        </span>
                        <input
                            type="range"
                            min={0.8}
                            max={1.5}
                            step={0.05}
                            value={form.ttsPlaybackRate ?? 1}
                            onChange={(e) => update({ ttsPlaybackRate: Number(e.target.value) })}
                            className="mt-2 w-full accent-[var(--accent-cta)]"
                        />
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                            Діє одразу, без переозвучки й безкоштовно. Тембр не змінюється. Кнопка «Повільно» в уроках завжди повільна. Кнопки ▶ тут
                            грають з цією ж швидкістю.
                        </span>
                    </label>

                    {isMini ? (
                        <label className="block">
                            <span className="text-sm font-bold text-[var(--text-main)]">Як говорити (інструкція англійською)</span>
                            <textarea
                                value={form.ttsInstructions}
                                onChange={(e) => update({ ttsInstructions: e.target.value })}
                                maxLength={600}
                                rows={3}
                                className={`${fieldClass} mt-1 resize-y`}
                            />
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">
                                Наприклад: темп, настрій, акцент. Для новачків — «повільніше й чітко».
                            </span>
                        </label>
                    ) : (
                        <label className="block">
                            <span className="text-sm font-bold text-[var(--text-main)]">Швидкість: {form.ttsSpeed.toFixed(2)}×</span>
                            <input
                                type="range"
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={form.ttsSpeed}
                                onChange={(e) => update({ ttsSpeed: Number(e.target.value) })}
                                className="mt-2 w-full accent-[var(--accent-cta)]"
                            />
                        </label>
                    )}

                    <div className="rounded-2xl bg-[var(--bg-app)] p-3">
                        <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Прослухати, як звучить (≈ 0.1 цента)</p>
                        <div className="flex gap-2">
                            <input value={sampleText} onChange={(e) => setSampleText(e.target.value)} maxLength={300} className={fieldClass} aria-label="Текст зразка" />
                            <AdminButton variant="secondary" loading={busy === "preview"} disabled={!overview.configured || !sampleText.trim()} onClick={() => void preview()}>
                                <Mic2 className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Прослухати зразок</span>
                            </AdminButton>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-sm font-bold text-[var(--text-main)]">Ліміт на місяць, $</span>
                            <input
                                type="number"
                                min={0}
                                max={500}
                                step={1}
                                value={form.ttsMonthlyLimitUsd}
                                onChange={(e) => update({ ttsMonthlyLimitUsd: Number(e.target.value) })}
                                className={`${fieldClass} mt-1`}
                            />
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">0 — без ліміту</span>
                        </label>
                        <label className="flex items-start gap-2 pt-6">
                            <input
                                type="checkbox"
                                checked={form.ttsAutoGenerate}
                                onChange={(e) => update({ ttsAutoGenerate: e.target.checked })}
                                className="mt-0.5 h-5 w-5 accent-[var(--accent-success)]"
                            />
                            <span className="text-xs text-[var(--text-muted)]">
                                <b className="block text-sm text-[var(--text-main)]">Автоозвучка</b>
                                Нові фрази озвучуються самі кожні 30 хв удень
                            </span>
                        </label>
                    </div>

                    {voiceChanged && totals.ready > 0 && (
                        <Notice kind="error">
                            Після зміни голосу всі фрази доведеться озвучити заново (≈{" "}
                            {formatUsd((totals.totalChars / 1_000_000) * (PRICE_PER_MILLION_CHARS[form.ttsModel] ?? 16))}). Старі файли
                            можна потім прибрати.
                        </Notice>
                    )}

                    <AdminButton className="w-full" disabled={!isDirty} loading={busy === "save"} onClick={() => void save()}>
                        <Save className="h-4 w-4" aria-hidden="true" /> {isDirty ? "Зберегти налаштування голосу" : "Змін немає"}
                    </AdminButton>
                </div>
            </Section>

            {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

            <Section
                title="Уроки"
                action={
                    <AdminButton variant="secondary" onClick={reload} loading={isLoading}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Оновити</span>
                    </AdminButton>
                }
            >
                {totals.phrases - totals.ready > 0 && (
                    <AdminButton
                        className="mb-3 w-full"
                        disabled={!canGenerate || isDirty}
                        loading={busy === "generate"}
                        onClick={() => generate("all", undefined, "усі фрази без озвучки", totals.missingCostUsd)}
                    >
                        <Wand2 className="h-4 w-4" aria-hidden="true" /> Озвучити все відсутнє (≈ {formatUsd(totals.missingCostUsd)})
                    </AdminButton>
                )}
                {isDirty && <p className="mb-3 text-xs text-[var(--text-muted)]">Спершу збережи налаштування голосу.</p>}
                {overview.chapters.length === 0 ? (
                    <EmptyState>Розділів ще немає</EmptyState>
                ) : (
                    <ul className="space-y-2">
                        {overview.chapters.map((chapter) => (
                            <ChapterRow
                                key={chapter.id}
                                chapter={chapter}
                                player={player}
                                canGenerate={canGenerate && !isDirty}
                                onGenerate={(scope, id, label) =>
                                    generate(scope, id, label, scope === "chapter" ? chapter.missingCostUsd : chapter.missingCostUsd / Math.max(1, chapter.nodes.length))
                                }
                                onChanged={reload}
                            />
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Обслуговування">
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Після зміни голосу старі файли лишаються на диску. Ця кнопка видаляє все, що не використовується поточним голосом.
                </p>
                <AdminButton
                    variant="secondary"
                    className="w-full"
                    loading={busy === "cleanup"}
                    disabled={running}
                    onClick={() => {
                        if (!window.confirm("Видалити файли, які не використовуються поточним голосом?")) return;
                        void run("cleanup", async () => {
                            const result = await adminApi.ttsCleanup();
                            reload();
                            return `Видалено файлів: ${result.removed} (${result.freedMb} МБ)`;
                        });
                    }}
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Прибрати старі файли
                </AdminButton>
            </Section>
        </div>
    );
};