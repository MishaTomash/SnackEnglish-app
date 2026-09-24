import { createContext } from "react";

/**
 * DOM-вузол футера LessonEngine, куди StepCta рендерить кнопку через портал.
 * Так кнопка завжди в одному місці екрана (sticky-футер з safe-area),
 * а логіку "що робить кнопка зараз" лишає крок.
 *
 * У LessonEngine:
 *   const [slot, setSlot] = useState<HTMLElement | null>(null);
 *   <StepCtaSlotContext.Provider value={slot}> …крок… </StepCtaSlotContext.Provider>
 *   <div ref={setSlot} className="sticky bottom-0 …" />
 */
export const StepCtaSlotContext = createContext<HTMLElement | null>(null);