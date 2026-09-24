/**
 * Slug для URL та ідентичності розділів/уроків: латиниця, цифри, дефіси.
 * Українська транслітерується (офіційна таблиця КМУ 2010, спрощено).
 */

const TRANSLIT: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
    з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
    ы: "y", э: "e", ё: "io", ъ: "",
};

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 60;

export function slugify(text: string, fallback: string): string {
    const slug = Array.from(text.toLowerCase())
        .map((char) => TRANSLIT[char] ?? char)
        .join("")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // café -> cafe
        .replace(/['’ʼ`]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, SLUG_MAX_LENGTH)
        .replace(/-+$/g, "");
    return slug || fallback;
}

/** base, base-2, base-3… — перший вільний варіант */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) {
        const candidate = `${base.slice(0, SLUG_MAX_LENGTH - String(i).length - 1)}-${i}`;
        if (!taken.has(candidate)) return candidate;
    }
}