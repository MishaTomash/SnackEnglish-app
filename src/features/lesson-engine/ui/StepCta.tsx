import { useContext, useLayoutEffect, useRef } from "react";
import type { FC } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../shared/ui/Button";
import { StepCtaSlotContext } from "./stepCtaSlot";

/**
 * Скільки мс після появи кнопки або зміни її напису кліки ігноруються.
 * Без цього подвійний тап "проскакує" крізь зміну стану: перший тап — "Перевірити",
 * другий уже влучає в "Спробувати ще" (юзер не бачить фідбек) або в "Далі"
 * наступного кроку (крок пропускається).
 */
const LABEL_CHANGE_GUARD_MS = 350;

export interface StepCtaProps {
    label?: string;
    disabled?: boolean;
    onClick: () => void;
}

/**
 * Головна кнопка кроку. Якщо LessonEngine надав слот — рендериться в його футер,
 * інакше (крок сам по собі, тести) — внизу кроку.
 */
export const StepCta: FC<StepCtaProps> = ({
    label = "Далі",
    disabled = false,
    onClick,
}) => {
    const slot = useContext(StepCtaSlotContext);
    const changedAtRef = useRef(0);

    // layout-ефект: оновлюється синхронно після коміту, до наступного кліку
    useLayoutEffect(() => {
        changedAtRef.current = Date.now();
    }, [label]);

    const handleClick = () => {
        if (Date.now() - changedAtRef.current < LABEL_CHANGE_GUARD_MS) return;
        onClick();
    };

    const button = (
        <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={disabled}
            onClick={handleClick}
        >
            {label}
        </Button>
    );

    return slot ? (
        createPortal(button, slot)
    ) : (
        <div className="mt-auto pt-6">{button}</div>
    );
};