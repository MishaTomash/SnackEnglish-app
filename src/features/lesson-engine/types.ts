import type { FC } from "react";
import type {
    StepOf,
    StepPayload,
    StepType,
} from "../../entities/story/types";

/**
 * Єдиний інтерфейс усіх степ-компонентів.
 * Колбеки 1:1 відповідають діям lessonRuntimeStore:
 * onNext -> nextStep, onLoseLife -> loseLife, onInsertSteps -> insertSteps.
 *
 * ВАЖЛИВО для LessonEngine: рендерити крок з key={stepIndex}, щоб кожен
 * крок монтувався заново (інакше два dialogue поспіль ділили б один стан).
 */
export interface StepComponentProps<S extends StepPayload = StepPayload> {
    step: S;
    /** Крок завершено — engine переходить до наступного. Степи викликають його один раз */
    onNext: () => void;
    /** Помилка юзера — для кроків з перевіркою відповіді */
    onLoseLife?: () => void;
    /** Вставити гілку одразу після поточного кроку — для choice */
    onInsertSteps?: (steps: StepPayload[]) => void;
}

/** Компонент для конкретного типу кроку: StepComponent<"cards"> отримує CardsStep */
export type StepComponent<T extends StepType> = FC<StepComponentProps<StepOf<T>>>;

/** Мапа "тип кроку -> компонент"; LessonEngine вибирає компонент за step.type */
export type StepRegistry = { [T in StepType]?: StepComponent<T> };