export type JsonParseResult =
    | { ok: true; value: unknown }
    | { ok: false; message: string; line?: number; column?: number; hint?: string };

/** Позиція символу -> рядок і стовпець (з 1) */
export function positionToLineColumn(text: string, position: number): { line: number; column: number } {
    const before = text.slice(0, position);
    const line = before.split("\n").length;
    const column = position - before.lastIndexOf("\n");
    return { line, column };
}

/** Межі рядка (з 1) у тексті — щоб виділити його в textarea */
export function lineRange(text: string, line: number): { start: number; end: number } {
    const lines = text.split("\n");
    const index = Math.min(Math.max(line, 1), lines.length) - 1;
    const start = lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
    return { start, end: start + lines[index].length };
}

/**
 * JSON.parse з людським повідомленням: рядок, стовпець і підказка
 * для типових помилок (коли вставили JS-об'єкт замість JSON).
 */
export function parseJson(text: string): JsonParseResult {
    if (!text.trim()) return { ok: false, message: "Порожньо — вставте JSON уроку" };
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);

        let line: number | undefined;
        let column: number | undefined;
        const lineColumn = /line (\d+) column (\d+)/.exec(raw);
        const position = /position (\d+)/.exec(raw);
        if (lineColumn) {
            line = Number(lineColumn[1]);
            column = Number(lineColumn[2]);
        }

        // Позиція помилки. Для деяких помилок V8 її не дає (напр. кома перед ] у масиві) —
        // тоді шукаємо найімовірніше місце самі
        let offset: number | undefined =
            position !== null
                ? Number(position[1])
                : line !== undefined && column !== undefined
                    ? lineRange(text, line).start + column - 1
                    : undefined;
        if (offset === undefined && /Unexpected token '[}\]]'/.test(raw)) {
            const trailing = /,\s*[}\]]/.exec(text);
            if (trailing) offset = trailing.index + trailing[0].length - 1;
        }
        if (offset !== undefined && line === undefined) {
            ({ line, column } = positionToLineColumn(text, offset));
        }

        // Підказку визначаємо за символами навколо місця помилки: одне й те саме
        // повідомлення V8 буває і для поля без лапок, і для зайвої коми перед }
        const at = offset !== undefined ? text[offset] : undefined;
        const before = offset !== undefined ? text.slice(0, offset).trimEnd().slice(-1) : undefined;

        let hint: string | undefined;
        if (offset !== undefined && offset >= text.trimEnd().length) {
            hint = "Текст обривається — перевірте, що всі { } і [ ] закриті.";
        } else if ((at === "}" || at === "]") && before === ",") {
            hint = "Зайва кома перед } або ] — JSON її не дозволяє.";
        } else if (at !== undefined && /[“”«»‘’]/.test(at)) {
            hint = "Тут «типографські» лапки — у JSON потрібні звичайні подвійні \"…\".";
        } else if (/after (property value|array element)/i.test(raw)) {
            hint = "Схоже, бракує коми між полями або елементами.";
        } else if (/property name/i.test(raw)) {
            hint = 'Назви полів мають бути в подвійних лапках ("label"), а не без лапок чи в одинарних.';
        } else if (/Unexpected end of JSON/i.test(raw)) {
            hint = "Текст обривається — перевірте, що всі { } і [ ] закриті.";
        }

        return { ok: false, message: raw, line, column, hint };
    }
}