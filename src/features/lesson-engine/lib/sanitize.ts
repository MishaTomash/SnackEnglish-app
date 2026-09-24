import { STEP_TYPES } from "../../../entities/story/types";
import type { StepPayload } from "../../../entities/story/types";

// Кроки зберігаються в Mongo як Mixed, тож типи TS нічого не гарантують у рантаймі.
// Ці хелпери приводять дані до очікуваної форми, щоб битий контент не валив урок.

export const asText = (value: unknown): string =>
    typeof value === "string" ? value : "";

/**
 * Варіанти відповіді зі збереженням позицій: індекс правильної відповіді
 * має лишитися валідним, тому нічого не викидаємо, лише приводимо до рядка.
 */
export const toOptionTexts = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.map((item) => (typeof item === "string" ? item : String(item ?? "")))
        : [];

/** Масив об'єктів з обов'язковим рядковим полем; биті елементи відкидаються */
export const objectsWithText = <T extends object>(value: unknown, field: keyof T): T[] =>
    Array.isArray(value)
        ? value.filter(
            (item): item is T =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as Record<PropertyKey, unknown>)[field] === "string",
        )
        : [];

/** Правильна відповідь як індекс або як текст варіанта; -1, якщо не знайдено */
export function resolveCorrectIndex(options: readonly string[], correct: unknown): number {
    if (
        typeof correct === "number" &&
        Number.isInteger(correct) &&
        correct >= 0 &&
        correct < options.length
    ) {
        return correct;
    }
    if (typeof correct === "string") {
        const target = correct.trim().toLowerCase();
        return options.findIndex((option) => option.trim().toLowerCase() === target);
    }
    return -1;
}

/** Слова речення для build: масив або рядок, розбитий по пробілах */
export const toWords = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .filter((word): word is string => typeof word === "string")
            .map((word) => word.trim())
            .filter(Boolean);
    }
    return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
};

/** Гілка з choice: лише об'єкти з відомим type */
export const sanitizeSteps = (value: unknown): StepPayload[] =>
    Array.isArray(value)
        ? value.filter(
            (step): step is StepPayload =>
                typeof step === "object" &&
                step !== null &&
                (STEP_TYPES as readonly string[]).includes(
                    String((step as { type?: unknown }).type),
                ),
        )
        : [];