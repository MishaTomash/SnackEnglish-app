// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/SystemTab.tsx
import { useState } from "react";
import type { FC } from "react";
import { CheckCircle2, Eraser, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi, getErrorMessage } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    ErrorState,
    LoadingState,
    Notice,
    Section,
    StatCard,
    formatDateTime,
    formatDuration,
} from "./primitives";

const SPEECH_LABELS: Record<string, string> = {
    server: "Сервер (Groq / OpenAI)",
    browser: "Браузер (лише Chrome/Edge)",
    off: "Вимкнено",
};

export const SystemTab: FC = () => {
    const { data, error, isLoading, reload } = useAdminQuery(() => adminApi.system(), []);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const clearCache = async () => {
        setBusy(true);
        setNotice(null);
        try {
            await adminApi.clearCache();
            setNotice({ kind: "success", text: "Кеш рейтингу, дашборду й контенту очищено" });
        } catch (clearError) {
            setNotice({ kind: "error", text: getErrorMessage(clearError) });
        } finally {
            setBusy(false);
        }
    };

    if (isLoading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} onRetry={reload} />;
    if (!data) return null;

    const problems = data.config.filter((c) => !c.ok);
    const criticalCount = problems.filter((c) => c.level === "error").length;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <AdminButton variant="secondary" onClick={reload} loading={isLoading}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Оновити
                </AdminButton>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard
                    label="База даних"
                    value={data.mongo}
                    accent={data.mongo === "підключено" ? "success" : "error"}
                />
                <StatCard label="Працює без перезапуску" value={formatDuration(data.uptimeSec)} />
                <StatCard label="Пам'ять" value={`${data.memoryMb.rss} МБ`} hint={`heap ${data.memoryMb.heapUsed} МБ`} />
                <StatCard
                    label="Розпізнавання голосу"
                    value={data.speechMode === "off" ? "вимкнено" : "працює"}
                    hint={SPEECH_LABELS[data.speechMode]}
                    accent={data.speechMode === "off" ? "error" : "success"}
                />
            </div>

            <Section title={problems.length === 0 ? "Налаштування ✅" : `Налаштування: ${problems.length} зауважень`}>
                {criticalCount > 0 && (
                    <p className="mb-3 rounded-xl bg-[var(--accent-error)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent-error)]">
                        Є критичні проблеми — частина застосунку може не працювати. Виправ у backend/.env і перезапусти сервер.
                    </p>
                )}
                <ul className="space-y-2">
                    {data.config.map((check) => (
                        <li key={check.key} className="flex items-start gap-2 text-sm">
                            {check.ok ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-success)]" aria-label="гаразд" />
                            ) : check.level === "error" ? (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-error)]" aria-label="помилка" />
                            ) : (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-cta)]" aria-label="увага" />
                            )}
                            <div className="min-w-0">
                                <p className="font-mono text-xs font-bold text-[var(--text-main)]">{check.key}</p>
                                <p className="break-words text-xs text-[var(--text-muted)]">{check.hint}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Сервер">
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-[var(--text-muted)]">Час сервера</dt>
                    <dd className="text-right text-[var(--text-main)]">{formatDateTime(data.serverTime)}</dd>
                    <dt className="text-[var(--text-muted)]">Часовий пояс</dt>
                    <dd className="text-right text-[var(--text-main)]">{data.timezone}</dd>
                    <dt className="text-[var(--text-muted)]">Кінець тижня змагання</dt>
                    <dd className="text-right text-[var(--text-main)]">{formatDateTime(data.nextGiveawayAt)}</dd>
                    <dt className="text-[var(--text-muted)]">Node.js</dt>
                    <dd className="text-right text-[var(--text-main)]">{data.nodeVersion}</dd>
                </dl>
            </Section>

            <Section title="Розклад нагадувань">
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Повідомлення юзерам — лише вдень (9:00–21:30 за Києвом), не більше одного нагадування на день.
                    Нічна задача нічого не надсилає.
                </p>
                <ul className="space-y-2">
                    {data.cron.map((job) => (
                        <li key={`${job.time}-${job.title}`} className="flex items-start gap-3 text-sm">
                            <span className="w-24 shrink-0 font-mono text-xs font-bold text-[var(--accent-cta)]">{job.time}</span>
                            <span className="min-w-0 text-[var(--text-main)]">
                                {job.title}
                                {!job.sendsMessages && <span className="ml-1 text-xs text-[var(--text-muted)]">(тихо)</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Інструменти">
                <div className="space-y-2">
                    <AdminButton variant="secondary" className="w-full" loading={busy} onClick={() => void clearCache()}>
                        <Eraser className="h-4 w-4" aria-hidden="true" /> Очистити кеш (рейтинг, статистика)
                    </AdminButton>
                    <Link
                        to="/learning/admin"
                        className="flex min-h-10 w-full items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-elevated)] px-4 py-2 text-sm font-bold text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]"
                    >
                        📚 Редактор уроків та розділів
                    </Link>
                    {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
                </div>
            </Section>
        </div>
    );
};