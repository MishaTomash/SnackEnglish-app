import { Fragment } from "react";
import type { FC } from "react";
import { parseRichText } from "../lib/richText";
import { isSynthesisSupported, speak } from "../lib/speech";

export interface RichTextProps {
    text: string;
    className?: string;
    /** Клік по <en>-слову. За замовчуванням — озвучити його */
    onWordClick?: (phrase: string) => void;
    /** Стиль <en>-слів; перевизначте на кольоровому фоні (напр. бульбашка юзера) */
    wordClassName?: string;
    /**
     * false — <en>-слова лише підсвічуються, без кнопок. Обов'язково всередині
     * іншої кнопки (варіанти відповіді): кнопка в кнопці — невалідний HTML,
     * і тап по слову "з'їдав" би вибір варіанта.
     */
    interactive?: boolean;
}

const DEFAULT_WORD_CLASS =
    "font-bold text-[var(--accent-cta)] decoration-[var(--accent-cta)]";

export const RichText: FC<RichTextProps> = ({
    text,
    className = "",
    onWordClick,
    wordClassName = DEFAULT_WORD_CLASS,
    interactive = true,
}) => {
    const handleWord = !interactive
        ? null
        : (onWordClick ??
            (isSynthesisSupported() ? (phrase: string) => void speak(phrase) : null));

    return (
        <span className={`whitespace-pre-line ${className}`}>
            {parseRichText(text).map((segment, i) => {
                if (segment.kind === "text") {
                    return <Fragment key={i}>{segment.value}</Fragment>;
                }
                // Без дії (немає ні обробника, ні озвучки) — просто підсвічене слово
                if (!handleWord) {
                    return (
                        <span key={i} className={wordClassName}>
                            {segment.value}
                        </span>
                    );
                }
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation(); // не тригерити клік по батьківській картці/бульбашці
                            handleWord(segment.value);
                        }}
                        className={`inline rounded underline decoration-dotted underline-offset-4 hover:decoration-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] ${wordClassName}`}
                    >
                        {segment.value}
                    </button>
                );
            })}
        </span>
    );
};