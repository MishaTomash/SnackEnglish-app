export interface StarterWord {
  id: string;
  en: string;
  ua: string;
}

/**
 * Вбудований стартовий словник гри "Швидкий вибір" — однаковий для всіх
 * користувачів, не залежить від content/lessons/ чи прогресу.
 *
 * Раніше був у starterWords.json, але імпорт JSON-модуля вимагає
 * "resolveJsonModule": true в tsconfig, якого немає в проєкті. Щоб не
 * залежати від змін конфігурації, дані винесені в .ts-константу —
 * функціонально те саме "зашите значення", просто без вимог до tsconfig.
 */
export const STARTER_WORDS: StarterWord[] = [
  { id: "cat", en: "cat", ua: "кіт" },
  { id: "dog", en: "dog", ua: "собака" },
  { id: "house", en: "house", ua: "будинок" },
  { id: "water", en: "water", ua: "вода" },
  { id: "book", en: "book", ua: "книга" },
  { id: "sun", en: "sun", ua: "сонце" },
  { id: "moon", en: "moon", ua: "місяць" },
  { id: "tree", en: "tree", ua: "дерево" },
  { id: "car", en: "car", ua: "машина" },
  { id: "food", en: "food", ua: "їжа" },
  { id: "friend", en: "friend", ua: "друг" },
  { id: "family", en: "family", ua: "сім'я" },
  { id: "love", en: "love", ua: "любов" },
  { id: "time", en: "time", ua: "час" },
  { id: "day", en: "day", ua: "день" },
  { id: "night", en: "night", ua: "ніч" },
  { id: "city", en: "city", ua: "місто" },
  { id: "street", en: "street", ua: "вулиця" },
  { id: "phone", en: "phone", ua: "телефон" },
  { id: "computer", en: "computer", ua: "комп'ютер" },
  { id: "school", en: "school", ua: "школа" },
  { id: "teacher", en: "teacher", ua: "вчитель" },
  { id: "student", en: "student", ua: "студент" },
  { id: "work", en: "work", ua: "робота" },
  { id: "money", en: "money", ua: "гроші" },
  { id: "name", en: "name", ua: "ім'я" },
  { id: "world", en: "world", ua: "світ" },
  { id: "life", en: "life", ua: "життя" },
  { id: "hand", en: "hand", ua: "рука" },
  { id: "eye", en: "eye", ua: "око" },
  { id: "head", en: "head", ua: "голова" },
  { id: "heart", en: "heart", ua: "серце" },
  { id: "door", en: "door", ua: "двері" },
  { id: "window", en: "window", ua: "вікно" },
  { id: "table", en: "table", ua: "стіл" },
  { id: "chair", en: "chair", ua: "стілець" },
];