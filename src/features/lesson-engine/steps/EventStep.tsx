import { useEffect } from "react";
import type { EventEffect } from "../../../entities/story/types";
import { hapticImpact } from "../../../shared/lib/haptics";
import { RichText } from "../../../shared/ui/RichText";
import { useCompleteOnce } from "../lib/useCompleteOnce";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";
import styles from "./lessonEffects.module.css";

const KNOWN_EFFECTS: readonly EventEffect[] = ["flash", "shake", "rain"];

const toEffect = (value: unknown): EventEffect | null =>
    KNOWN_EFFECTS.includes(value as EventEffect) ? (value as EventEffect) : null;

/**
 * Сюжетна вставка з ефектом:
 *  flash — білий спалах на весь екран;
 *  shake — струс контенту (+ вібрація в Telegram);
 *  rain  — фоновий дощ на CSS, поки крок відкритий.
 * Невідомий ефект з контенту ігнорується — крок показується без нього.
 */
export const EventStep: StepComponent<"event"> = ({ step, onNext }) => {
    const complete = useCompleteOnce(onNext);
    const effect = toEffect(step.effect);

    useEffect(() => {
        if (effect === "shake") hapticImpact("heavy");
        if (effect === "flash") hapticImpact("rigid");
    }, [effect]);

    return (
        <div className={`relative flex flex-1 flex-col ${effect === "shake" ? styles.shake : ""}`}>
            {effect === "rain" && <div className={styles.rain} aria-hidden="true" />}
            {effect === "flash" && <div className={styles.flash} aria-hidden="true" />}

            <div
                className={`relative z-10 flex flex-1 flex-col items-center justify-center gap-6 text-center ${styles.fadeIn}`}
            >
                {step.icon && (
                    <span className={`text-7xl leading-none ${styles.pop}`} aria-hidden="true">
                        {step.icon}
                    </span>
                )}
                <p className="max-w-md text-xl font-semibold leading-relaxed text-[var(--text-main)]">
                    <RichText text={step.text ?? ""} />
                </p>
            </div>

            <div className="relative z-10 mt-auto">
                <StepCta onClick={complete} />
            </div>
        </div>
    );
};