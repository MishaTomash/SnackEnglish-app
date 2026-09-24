import { useMemo } from "react";
import type { FC, ReactNode } from "react";
import { CookieMascot, toCookieState } from "../../shared/ui/CookieMascot";
import type { CookieState } from "../../shared/ui/CookieMascot";
import { pickReaction } from "./lib/snekieReactions";
import type { FeedbackKind } from "./lib/snekieReactions";
import styles from "./steps/lessonEffects.module.css";

export interface StepFeedbackProps {
    kind: FeedbackKind;
    /** Власна репліка Снекі; без неї — випадкова з пулу SNEKIE_REACTIONS */
    message?: string;
    /** Емоція Снекі; без неї — за kind */
    emotion?: string;
    /** Додатково під реплікою: пояснення, розпізнаний текст тощо */
    detail?: ReactNode;
    /** false — якщо крок уже показує великого маскота, що реагує сам */
    showMascot?: boolean;
}

interface KindConfig {
    title: string;
    mascot: CookieState;
    box: string;
    titleColor: string;
}

const KIND_CONFIG: Record<FeedbackKind, KindConfig> = {
    correct: {
        title: "Правильно!",
        mascot: "happy",
        box: "border-[var(--accent-success)] bg-[var(--accent-success)]/10",
        titleColor: "text-[var(--accent-success)]",
    },
    almost: {
        title: "Майже!",
        mascot: "thinking",
        box: "border-[var(--accent-cta)] bg-[var(--accent-cta)]/10",
        titleColor: "text-[var(--accent-cta)]",
    },
    wrong: {
        title: "Не зовсім",
        mascot: "sad",
        box: "border-[var(--accent-error)] bg-[var(--accent-error)]/10",
        titleColor: "text-[var(--accent-error)]",
    },
};

/** Банер результату з реакцією Снекі. Спільний для всіх інтерактивних кроків */
export const StepFeedback: FC<StepFeedbackProps> = ({
    kind,
    message,
    emotion,
    detail,
    showMascot = true,
}) => {
    const config = KIND_CONFIG[kind];
    // Нова випадкова репліка лише при зміні результату, а не на кожен ререндер
    const reaction = useMemo(() => message ?? pickReaction(kind), [kind, message]);

    return (
        <div
            role="status"
            className={`mt-4 flex items-center gap-3 rounded-3xl border-2 p-4 ${config.box} ${styles.bubbleIn}`}
        >
            {showMascot && (
                <CookieMascot
                    state={toCookieState(emotion, config.mascot)}
                    size={56}
                    className="shrink-0"
                />
            )}
            <div className="min-w-0">
                <p className={`text-lg font-extrabold ${config.titleColor}`}>{config.title}</p>
                <p className="text-[var(--text-main)]">{reaction}</p>
                {detail && <div className="mt-1 text-sm text-[var(--text-muted)]">{detail}</div>}
            </div>
        </div>
    );
};