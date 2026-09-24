import { RichText } from "../../../shared/ui/RichText";
import { useCompleteOnce } from "../lib/useCompleteOnce";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";
import styles from "./lessonEffects.module.css";

/** Сюжетна сцена: емодзі + текст, далі — CTA */
export const SceneStep: StepComponent<"scene"> = ({ step, onNext }) => {
    const complete = useCompleteOnce(onNext);

    return (
        <div className="flex flex-1 flex-col">
            <div
                className={`flex flex-1 flex-col items-center justify-center gap-6 text-center ${styles.fadeIn}`}
            >
                {step.icon && (
                    <span className={`text-7xl leading-none ${styles.pop}`} aria-hidden="true">
                        {step.icon}
                    </span>
                )}
                <p className="max-w-md text-xl leading-relaxed text-[var(--text-main)]">
                    <RichText text={step.text ?? ""} />
                </p>
            </div>

            <StepCta onClick={complete} />
        </div>
    );
};