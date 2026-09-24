/**
 * Розмітка контенту: англійські слова/фрази всередині тексту позначаються
 * тегом <en>…</en> — "Ти заходиш у <en>coffee shop</en>".
 * Парсер повертає сегменти, а не HTML: рендер без dangerouslySetInnerHTML.
 */

export type RichTextSegment =
    | { kind: "text"; value: string }
    | { kind: "en"; value: string };

const EN_TAG = /<en>([\s\S]*?)<\/en>/gi;

export function parseRichText(text: string): RichTextSegment[] {
    const segments: RichTextSegment[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(EN_TAG)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            segments.push({ kind: "text", value: text.slice(lastIndex, index) });
        }
        const phrase = match[1].trim();
        if (phrase) segments.push({ kind: "en", value: phrase });
        lastIndex = index + match[0].length;
    }

    if (lastIndex < text.length) {
        segments.push({ kind: "text", value: text.slice(lastIndex) });
    }
    return segments;
}

/** Текст без розмітки — для озвучки, aria-label тощо */
export const stripRichText = (text: string): string =>
    text.replace(EN_TAG, "$1");