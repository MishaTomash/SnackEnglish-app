// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/BroadcastTab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { Heart, ImagePlus, Send, Square, TestTube2, Trash2 } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import type { AudienceType, BroadcastForm, BroadcastProgress } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    EmptyState,
    Notice,
    Pill,
    Section,
    Segmented,
    fieldClass,
    formatDateTime,
    formatNumber,
} from "./primitives";

const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;
const STATUS_POLL_MS = 2000;

const AUDIENCES: { value: AudienceType; label: string; hint: string }[] = [
    { value: "all", label: "Усім", hint: "Усі юзери, крім заблокованих" },
    { value: "active7", label: "Активним", hint: "Заходили за останні 7 днів" },
    { value: "inactive7", label: "Неактивним", hint: "Не заходили 7+ днів — щоб повернути" },
    { value: "no_onboarding", label: "Новачкам", hint: "Не пройшли онбординг" },
    { value: "level", label: "За рівнем", hint: "Лише юзери обраного рівня" },
];

const AUDIENCE_LABELS: Record<string, string> = {
    all: "усім",
    active7: "активним",
    inactive7: "неактивним",
    no_onboarding: "новачкам",
};

const describeAudience = (audience: string | null): string => {
    if (!audience) return "—";
    if (audience.startsWith("level:")) return `рівень ${audience.slice(6)}`;
    return AUDIENCE_LABELS[audience] ?? audience;
};

const LOG_STATUS: Record<string, { label: string; tone: "success" | "error" | "warning" }> = {
    completed: { label: "завершено", tone: "success" },
    cancelled: { label: "зупинено", tone: "warning" },
    failed: { label: "помилка", tone: "error" },
};

/**
 * Попередній перегляд HTML як у Telegram: усе екранується, потім повертаються лише
 * безпечні теги форматування. Посилання показуються підкресленим текстом.
 */
const renderTelegramPreview = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&lt;(\/?)(b|strong|i|em|u|s|code)&gt;/gi, "<$1$2>")
        .replace(/&lt;a\s+href=(?:&quot;|")[^&"]*(?:&quot;|")\s*&gt;/gi, '<u class="text-sky-400">')
        .replace(/&lt;\/a&gt;/gi, "</u>")
        .replace(/\n/g, "<br />");

const EMPTY_FORM: BroadcastForm = {
    text: "",
    photo: null,
    buttonText: "",
    buttonUrl: "",
    buttonOpenApp: true,
    buttonSupport: false,
    audienceType: "all",
    level: "A1",
};

type ButtonMode = "none" | "app" | "link" | "support";

const SUPPORT_BUTTON_TEXT = "💛 Підтримати";

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const BroadcastTab: FC = () => {
    const [form, setForm] = useState<BroadcastForm>(EMPTY_FORM);
    const [buttonMode, setButtonMode] = useState<ButtonMode>("app");
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [progress, setProgress] = useState<BroadcastProgress | null>(null);
    const [busy, setBusy] = useState<"test" | "start" | "cancel" | null>(null);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const history = useAdminQuery(() => adminApi.broadcastHistory(), []);
    // Заголовок, текст і посилання блоку «Підтримати» — ті самі, що в застосунку
    const settings = useAdminQuery(() => adminApi.settings(), []);
    const supportSettings = settings.data?.settings ?? null;
    const supportUrlMissing = Boolean(supportSettings && !supportSettings.supportUrl);

    const photoPreview = useMemo(() => (form.photo ? URL.createObjectURL(form.photo) : null), [form.photo]);
    useEffect(() => () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
    }, [photoPreview]);

    // Скільки людей отримає розсилку
    useEffect(() => {
        let alive = true;
        setAudienceCount(null);
        adminApi
            .broadcastEstimate(form.audienceType, form.level)
            .then((count) => alive && setAudienceCount(count))
            .catch(() => alive && setAudienceCount(null));
        return () => {
            alive = false;
        };
    }, [form.audienceType, form.level]);

    // Прогрес: опитуємо сервер, поки розсилка йде
    const reloadHistory = history.reload;
    useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let wasRunning = false;

        const poll = async () => {
            try {
                const status = await adminApi.broadcastStatus();
                if (!alive) return;
                setProgress(status);
                if (wasRunning && !status.running) reloadHistory(); // щойно завершилась — оновлюємо історію
                wasRunning = status.running;
                timer = setTimeout(() => void poll(), status.running ? STATUS_POLL_MS : STATUS_POLL_MS * 5);
            } catch {
                if (alive) timer = setTimeout(() => void poll(), STATUS_POLL_MS * 5);
            }
        };
        void poll();
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [reloadHistory]);

    const update = (patch: Partial<BroadcastForm>) => setForm((prev) => ({ ...prev, ...patch }));

    const changeButtonMode = (mode: ButtonMode) => {
        setButtonMode(mode);
        // Для «Підтримати» одразу ставимо звичний текст кнопки, якщо поле порожнє
        if (mode === "support" && !form.buttonText.trim()) update({ buttonText: SUPPORT_BUTTON_TEXT });
    };

    /** Підставляє в розсилку заголовок і текст блоку «Підтримати» з налаштувань */
    const fillSupportTemplate = () => {
        if (!supportSettings) return;
        const title = escapeHtml(supportSettings.supportTitle.trim());
        const body = escapeHtml(supportSettings.supportText.trim());
        update({
            text: [title ? `<b>${title}</b>` : "", body].filter(Boolean).join("\n\n"),
            buttonText: form.buttonText.trim() || SUPPORT_BUTTON_TEXT,
        });
        setButtonMode("support");
    };

    const effectiveForm: BroadcastForm = {
        ...form,
        buttonText: buttonMode === "none" ? "" : form.buttonText,
        buttonOpenApp: buttonMode === "app",
        buttonSupport: buttonMode === "support",
        buttonUrl: buttonMode === "link" ? form.buttonUrl : "",
    };

    const limit = form.photo ? MAX_CAPTION : MAX_TEXT;
    const tooLong = form.text.length > limit;
    const hasContent = Boolean(form.text.trim() || form.photo);
    const buttonInvalid =
        buttonMode !== "none" &&
        (!form.buttonText.trim() ||
            (buttonMode === "link" && !/^https:\/\/\S+$/i.test(form.buttonUrl.trim())) ||
            (buttonMode === "support" && supportUrlMissing));
    const canSend = hasContent && !tooLong && !buttonInvalid;
    const isRunning = Boolean(progress?.running);

    const handleTest = async () => {
        setBusy("test");
        setNotice(null);
        try {
            await adminApi.broadcastTest(effectiveForm);
            setNotice({ kind: "success", text: "Тест надіслано тобі в чат з ботом — перевір, як виглядає" });
        } catch (error) {
            setNotice({ kind: "error", text: getErrorMessage(error) });
        } finally {
            setBusy(null);
        }
    };

    const handleStart = async () => {
        const count = audienceCount !== null ? formatNumber(audienceCount) : "усім обраним";
        if (!window.confirm(`Надіслати розсилку ${count} юзерам? Скасувати вже надіслане не вийде.`)) return;
        setBusy("start");
        setNotice(null);
        try {
            const total = await adminApi.broadcastStart(effectiveForm);
            setNotice({ kind: "success", text: `Розсилку запущено: ${formatNumber(total)} юзерів` });
            setForm(EMPTY_FORM);
            setButtonMode("app");
            setProgress(await adminApi.broadcastStatus());
        } catch (error) {
            setNotice({ kind: "error", text: getErrorMessage(error) });
        } finally {
            setBusy(null);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm("Зупинити розсилку? Уже надіслані повідомлення лишаться.")) return;
        setBusy("cancel");
        try {
            await adminApi.broadcastCancel();
        } catch (error) {
            setNotice({ kind: "error", text: getErrorMessage(error) });
        } finally {
            setBusy(null);
        }
    };

    const done = progress ? progress.sent + progress.failed : 0;
    const percent = progress && progress.total > 0 ? Math.min(100, Math.round((done / progress.total) * 100)) : 0;

    return (
        <div className="space-y-4">
            {progress && progress.status !== "idle" && (
                <Section title={isRunning ? "Розсилка триває" : "Остання розсилка"}>
                    <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--bg-app)]">
                        <div
                            className="h-full rounded-full bg-[var(--accent-cta)] transition-[width] duration-500"
                            style={{ width: `${isRunning ? percent : 100}%` }}
                        />
                    </div>
                    <p className="text-sm text-[var(--text-main)]">
                        ✅ {formatNumber(progress.sent)} · ⚠️ {formatNumber(progress.failed)} з {formatNumber(progress.total)} (
                        {describeAudience(progress.audience)})
                    </p>
                    {progress.failed > 0 && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            Не доставлено — зазвичай ті, хто заблокував бота або видалив акаунт.
                        </p>
                    )}
                    {progress.error && <Notice kind="error">{progress.error}</Notice>}
                    {isRunning && (
                        <AdminButton variant="danger" className="mt-3 w-full" loading={busy === "cancel"} onClick={() => void handleCancel()}>
                            <Square className="h-4 w-4" aria-hidden="true" /> Зупинити
                        </AdminButton>
                    )}
                </Section>
            )}

            <Section title="Нова розсилка">
                <div className="space-y-3">
                    <AdminButton variant="secondary" className="w-full" disabled={!supportSettings} onClick={fillSupportTemplate}>
                        <Heart className="h-4 w-4" aria-hidden="true" /> Шаблон «Підтримати Снекі»
                    </AdminButton>
                    <div>
                        <textarea
                            value={form.text}
                            onChange={(e) => update({ text: e.target.value })}
                            rows={6}
                            placeholder={"Текст повідомлення.\nФорматування: <b>жирний</b>, <i>курсив</i>, <a href=\"https://...\">посилання</a>"}
                            className={`${fieldClass} resize-y`}
                            aria-label="Текст розсилки"
                        />
                        <p className={`mt-1 text-right text-[11px] ${tooLong ? "text-[var(--accent-error)]" : "text-[var(--text-muted)]"}`}>
                            {form.text.length} / {limit}
                            {form.photo ? " (підпис до фото)" : ""}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                if (file && file.size > 10 * 1024 * 1024) {
                                    setNotice({ kind: "error", text: "Фото до 10 МБ" });
                                } else {
                                    update({ photo: file });
                                }
                                e.target.value = "";
                            }}
                        />
                        <AdminButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
                            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {form.photo ? "Замінити фото" : "Додати фото"}
                        </AdminButton>
                        {form.photo && (
                            <AdminButton variant="secondary" onClick={() => update({ photo: null })}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" /> Прибрати
                            </AdminButton>
                        )}
                    </div>

                    <div>
                        <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Кнопка під повідомленням</p>
                        <Segmented<ButtonMode>
                            value={buttonMode}
                            onChange={changeButtonMode}
                            options={[
                                { value: "app", label: "Відкрити застосунок" },
                                { value: "support", label: "Підтримати" },
                                { value: "link", label: "Посилання" },
                                { value: "none", label: "Без кнопки" },
                            ]}
                        />
                        {buttonMode !== "none" && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <input
                                    value={form.buttonText}
                                    onChange={(e) => update({ buttonText: e.target.value })}
                                    maxLength={64}
                                    placeholder="Текст кнопки, напр. «Відкрити 🚀»"
                                    className={fieldClass}
                                    aria-label="Текст кнопки"
                                />
                                {buttonMode === "support" && (
                                    <p className={`self-center text-[11px] ${supportUrlMissing ? "text-[var(--accent-error)]" : "text-[var(--text-muted)]"}`}>
                                        {supportUrlMissing
                                            ? "Посилання на банку не задано — заповни його в Налаштуваннях → Підтримка"
                                            : "Веде на банку з Налаштувань → Підтримка, як кнопка в застосунку"}
                                    </p>
                                )}
                                {buttonMode === "link" && (
                                    <input
                                        value={form.buttonUrl}
                                        onChange={(e) => update({ buttonUrl: e.target.value })}
                                        placeholder="https://..."
                                        inputMode="url"
                                        className={fieldClass}
                                        aria-label="Посилання кнопки"
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Кому</p>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={form.audienceType}
                                onChange={(e) => update({ audienceType: e.target.value as AudienceType })}
                                className={`${fieldClass} w-auto`}
                                aria-label="Аудиторія"
                            >
                                {AUDIENCES.map((a) => (
                                    <option key={a.value} value={a.value}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                            {form.audienceType === "level" && (
                                <select
                                    value={form.level}
                                    onChange={(e) => update({ level: e.target.value })}
                                    className={`${fieldClass} w-auto`}
                                    aria-label="Рівень"
                                >
                                    {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                                        <option key={l} value={l}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {AUDIENCES.find((a) => a.value === form.audienceType)?.hint} ·{" "}
                            <b className="text-[var(--text-main)]">
                                {audienceCount === null ? "рахую…" : `${formatNumber(audienceCount)} юзерів`}
                            </b>
                        </p>
                    </div>

                    {hasContent && (
                        <div>
                            <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Попередній перегляд</p>
                            <div className="max-w-sm overflow-hidden rounded-2xl bg-[#2b5278]/40 text-sm text-[var(--text-main)]">
                                {photoPreview && <img src={photoPreview} alt="" className="max-h-64 w-full object-cover" />}
                                {form.text.trim() && (
                                    <div
                                        className="break-words p-3 leading-relaxed"
                                        // Безпечно: renderTelegramPreview екранує все, крім простих тегів форматування
                                        dangerouslySetInnerHTML={{ __html: renderTelegramPreview(form.text) }}
                                    />
                                )}
                                {buttonMode !== "none" && form.buttonText.trim() && (
                                    <div className="border-t border-white/10 p-2 text-center text-xs font-bold text-sky-300">
                                        {form.buttonText}
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Точно як у Telegram — через «Тест собі».
                            </p>
                        </div>
                    )}

                    {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

                    <div className="grid grid-cols-2 gap-2">
                        <AdminButton variant="secondary" disabled={!canSend} loading={busy === "test"} onClick={() => void handleTest()}>
                            <TestTube2 className="h-4 w-4" aria-hidden="true" /> Тест собі
                        </AdminButton>
                        <AdminButton
                            disabled={!canSend || isRunning || audienceCount === 0}
                            loading={busy === "start"}
                            onClick={() => void handleStart()}
                        >
                            <Send className="h-4 w-4" aria-hidden="true" /> Надіслати
                        </AdminButton>
                    </div>
                    {isRunning && <p className="text-[11px] text-[var(--text-muted)]">Нову розсилку можна почати, коли завершиться поточна.</p>}
                </div>
            </Section>

            <Section title="Історія розсилок">
                {history.isLoading && !history.data ? (
                    <EmptyState>Завантаження…</EmptyState>
                ) : !history.data || history.data.length === 0 ? (
                    <EmptyState>Розсилок ще не було</EmptyState>
                ) : (
                    <ul className="space-y-2">
                        {history.data.map((log) => (
                            <li key={log._id} className="rounded-2xl bg-[var(--bg-app)] p-3">
                                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                    <Pill tone={LOG_STATUS[log.status]?.tone ?? "warning"}>{LOG_STATUS[log.status]?.label ?? log.status}</Pill>
                                    <Pill>{describeAudience(log.audience)}</Pill>
                                    {log.kind === "photo" && <Pill>фото</Pill>}
                                    {log.kind === "copy" && <Pill>/copy</Pill>}
                                    <span className="text-[11px] text-[var(--text-muted)]">{formatDateTime(log.startedAt)}</span>
                                </div>
                                <p className="line-clamp-2 text-sm text-[var(--text-main)]">{log.textPreview || "(без тексту)"}</p>
                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    ✅ {formatNumber(log.sent)} · ⚠️ {formatNumber(log.failed)} з {formatNumber(log.total)}
                                    {log.error ? ` · ${log.error}` : ""}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
};