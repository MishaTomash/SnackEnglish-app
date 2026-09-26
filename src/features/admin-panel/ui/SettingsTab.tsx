// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/SettingsTab.tsx
import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import { Save } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import type { AppSettings } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import { useAppConfigStore } from "../../../store/appConfigStore";
import { AdminButton, ErrorState, LoadingState, Notice, Section, StatCard, fieldClass } from "./primitives";

/** Перемикач (так/ні) з підписом і поясненням */
const Toggle: FC<{ checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }> = ({
    checked,
    onChange,
    label,
    hint,
}) => (
    <label className="flex cursor-pointer items-start justify-between gap-3">
        <span className="min-w-0">
            <span className="block text-sm font-bold text-[var(--text-main)]">{label}</span>
            {hint && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{hint}</span>}
        </span>
        <span className="relative mt-0.5 inline-flex shrink-0">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full bg-[var(--bg-app)] transition-colors peer-checked:bg-[var(--accent-success)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent-cta)]" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </span>
    </label>
);

const NumberField: FC<{
    label: string;
    hint: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}> = ({ label, hint, value, min, max, onChange }) => (
    <label className="block">
        <span className="text-sm font-bold text-[var(--text-main)]">{label}</span>
        <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Math.floor(Number(e.target.value)))}
            className={`${fieldClass} mt-1`}
        />
        <span className="mt-1 block text-xs text-[var(--text-muted)]">{hint}</span>
    </label>
);

const Field: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-sm font-bold text-[var(--text-main)]">{label}</span>
        <div className="mt-1">{children}</div>
        {hint && <span className="mt-1 block text-xs text-[var(--text-muted)]">{hint}</span>}
    </label>
);

export const SettingsTab: FC = () => {
    const { data, error, isLoading, reload } = useAdminQuery(() => adminApi.settings(), []);
    const [form, setForm] = useState<AppSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
    const reloadAppConfig = useAppConfigStore((s) => s.load);

    useEffect(() => {
        if (data) setForm(data.settings);
    }, [data]);

    if (isLoading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} onRetry={reload} />;
    if (!data || !form) return null;

    const update = (patch: Partial<AppSettings>) => {
        setForm((prev) => (prev ? { ...prev, ...patch } : prev));
        setNotice(null);
    };

    const isDirty = JSON.stringify(form) !== JSON.stringify(data.settings);
    const numbersValid = [form.dailyLessonLimit, form.dailyGoalLessons, form.dailyGoalBonus, form.referralBonus].every(
        Number.isFinite,
    );

    const save = async () => {
        setSaving(true);
        setNotice(null);
        try {
            await adminApi.updateSettings(form);
            setNotice({ kind: "success", text: "Збережено. Юзери побачать зміни протягом хвилини." });
            reload();
            void reloadAppConfig(true); // щоб і в тебе в застосунку одразу оновилось
        } catch (saveError) {
            setNotice({ kind: "error", text: getErrorMessage(saveError) });
        } finally {
            setSaving(false);
        }
    };

    const { stats } = data;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="«Підтримати» за 7 днів" value={stats.supportClicks7} hint={`за 30 днів: ${stats.supportClicks30}`} accent="cta" />
                <StatCard label="Денна ціль (7 днів)" value={stats.goalsReached7} hint="разів виконано" accent="success" />
                <StatCard label="Уперлись у ліміт" value={stats.limitHits7} hint="за 7 днів" />
                <StatCard label="Оплата" value={form.paymentsEnabled ? "увімкнена" : "вимкнена"} />
            </div>

            <Section title="Уроки">
                <div className="space-y-4">
                    <NumberField
                        label="Нових уроків на день"
                        hint="Скільки НОВИХ уроків можна пройти за день. Повтор пройдених і ігри — без обмежень. 0 — без ліміту."
                        value={form.dailyLessonLimit}
                        min={0}
                        max={100}
                        onChange={(value) => update({ dailyLessonLimit: value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField
                            label="Денна ціль"
                            hint="Уроків на день для бонусу. 0 — без цілі."
                            value={form.dailyGoalLessons}
                            min={0}
                            max={100}
                            onChange={(value) => update({ dailyGoalLessons: value })}
                        />
                        <NumberField
                            label="Бонус за ціль"
                            hint="Кубків (тижневих і загальних)."
                            value={form.dailyGoalBonus}
                            min={0}
                            max={1000}
                            onChange={(value) => update({ dailyGoalBonus: value })}
                        />
                    </div>
                    {stats.limitHits7 > 0 && (
                        <p className="rounded-xl bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-muted)]">
                            За тиждень юзери {stats.limitHits7} разів хотіли пройти ще урок понад ліміт. Якщо їх багато, а активність
                            падає — спробуй збільшити ліміт.
                        </p>
                    )}
                </div>
            </Section>

            <Section title="Запроси друга">
                <NumberField
                    label="Бонус за друга"
                    hint="Кубків кожному (і тому, хто запросив, і другу), коли друг пройде перший урок. Не більше 10 бонусів на тиждень одному. 0 — без бонусу."
                    value={form.referralBonus}
                    min={0}
                    max={1000}
                    onChange={(value) => update({ referralBonus: value })}
                />
            </Section>

            <Section title="Бот">
                <Field
                    label="Картинка до привітання новачка"
                    hint="Посилання на картинку (https://…), напр. Снекі з табличкою «Welcome!». Порожньо — привітання лише текстом. Перевір: натисни /start з нового акаунта."
                >
                    <input
                        value={form.botWelcomeImage}
                        onChange={(e) => update({ botWelcomeImage: e.target.value.trim() })}
                        placeholder="https://…/snekie-welcome.png"
                        inputMode="url"
                        className={fieldClass}
                    />
                </Field>
                {form.botWelcomeImage.startsWith("https://") && (
                    <img src={form.botWelcomeImage} alt="" className="mt-3 max-h-40 rounded-xl object-contain" />
                )}
            </Section>

            <Section title="Підтримка (банка)">
                <div className="space-y-4">
                    <Toggle
                        checked={form.supportEnabled}
                        onChange={(value) => update({ supportEnabled: value })}
                        label="Показувати «Підтримати»"
                        hint="Після уроку (не частіше за раз на 3 дні), у вкладці «Розіграш» і в налаштуваннях."
                    />
                    <Field label="Посилання на банку" hint="Наприклад, https://send.monobank.ua/jar/...">
                        <input
                            value={form.supportUrl}
                            onChange={(e) => update({ supportUrl: e.target.value })}
                            placeholder="https://send.monobank.ua/jar/..."
                            inputMode="url"
                            className={fieldClass}
                        />
                    </Field>
                    <Field label="Заголовок">
                        <input
                            value={form.supportTitle}
                            onChange={(e) => update({ supportTitle: e.target.value })}
                            maxLength={80}
                            className={fieldClass}
                        />
                    </Field>
                    <Field label="Текст (після уроку й у налаштуваннях)">
                        <textarea
                            value={form.supportText}
                            onChange={(e) => update({ supportText: e.target.value })}
                            maxLength={500}
                            rows={3}
                            className={`${fieldClass} resize-y`}
                        />
                    </Field>
                    <Field label="Текст у вкладці «Розіграш»">
                        <textarea
                            value={form.supportGiveawayText}
                            onChange={(e) => update({ supportGiveawayText: e.target.value })}
                            maxLength={300}
                            rows={2}
                            className={`${fieldClass} resize-y`}
                        />
                    </Field>
                </div>
            </Section>

            <Section title="Оплата ігор">
                <Toggle
                    checked={form.paymentsEnabled}
                    onChange={(value) => update({ paymentsEnabled: value })}
                    label="Приймати оплату за ігри"
                    hint="Вимкнено — усі ігри безкоштовні для всіх. Увімкни, коли підключиш оплату через ФОП: куплені раніше ігри лишаться в юзерів."
                />
            </Section>

            <div className="sticky bottom-3 space-y-2">
                {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
                <AdminButton className="w-full shadow-xl" disabled={!isDirty || !numbersValid} loading={saving} onClick={() => void save()}>
                    <Save className="h-4 w-4" aria-hidden="true" /> {isDirty ? "Зберегти зміни" : "Змін немає"}
                </AdminButton>
            </div>
        </div>
    );
};