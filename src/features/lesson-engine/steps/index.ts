import type { StepRegistry } from "../types";
import { BuildStep } from "./BuildStep";
import { CardsStep } from "./CardsStep";
import { ChoiceStep } from "./ChoiceStep";
import { DialogueStep } from "./DialogueStep";
import { EventStep } from "./EventStep";
import { ListenStep } from "./ListenStep";
import { QuizStep } from "./QuizStep";
import { ReplyStep } from "./ReplyStep";
import { SceneStep } from "./SceneStep";
import { VoiceStep } from "./VoiceStep";

export {
    BuildStep,
    CardsStep,
    ChoiceStep,
    DialogueStep,
    EventStep,
    ListenStep,
    QuizStep,
    ReplyStep,
    SceneStep,
    VoiceStep,
};

/** Пасивні кроки (без перевірки відповіді) */
export const passiveStepRegistry: StepRegistry = {
    scene: SceneStep,
    dialogue: DialogueStep,
    cards: CardsStep,
    event: EventStep,
};

/** Інтерактивні кроки (з перевіркою, життями, фідбеком) */
export const interactiveStepRegistry: StepRegistry = {
    choice: ChoiceStep,
    reply: ReplyStep,
    listen: ListenStep,
    quiz: QuizStep,
    build: BuildStep,
    voice: VoiceStep,
};

/** Повний реєстр — LessonEngine вибирає компонент за step.type */
export const stepRegistry: StepRegistry = {
    ...passiveStepRegistry,
    ...interactiveStepRegistry,
};