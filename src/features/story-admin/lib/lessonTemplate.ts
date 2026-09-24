/**
 * Шаблон уроку з усіма 10 типами кроків — стартова точка для нового контенту.
 * Кожен крок мінімальний, але валідний: можна одразу "Переглянути".
 */
const TEMPLATE = {
    label: "Назва уроку",
    icon: "☕",
    npc: "snacky",
    npcName: "Снекі",
    isBoss: false,
    cliffhanger: { text: "Що буде далі? Інтрига для наступного уроку." },
    steps: [
        { type: "scene", icon: "🏙️", text: "Опис сцени. Англійські слова — так: <en>coffee shop</en>." },
        {
            type: "dialogue",
            lines: [
                { speaker: "snacky", en: "Hello! I'm Snacky.", uk: "Привіт! Я Снекі.", emotion: "happy" },
                { speaker: "user", en: "Hi, Snacky!", uk: "Привіт, Снекі!" },
            ],
        },
        {
            type: "cards",
            title: "Нові слова",
            cards: [
                { en: "coffee", uk: "кава", emoji: "☕" },
                { en: "tea", uk: "чай", emoji: "🍵" },
            ],
        },
        {
            type: "quiz",
            npcPrompt: "What would you like?",
            question: "Як ввічливо попросити чай?",
            options: ["Tea!", "A tea, please.", "Give tea."],
            correct: "A tea, please.",
            explanation: "<en>please</en> — «будь ласка».",
        },
        {
            type: "listen",
            audio: "A coffee with milk, please.",
            question: "Що замовили?",
            options: ["Чай з цукром", "Каву з молоком", "Воду"],
            correct: "Каву з молоком",
        },
        {
            type: "reply",
            prompt: "How are you?",
            promptUk: "Як справи?",
            emotion: "happy",
            options: [
                { en: "Fine.", uk: "Нормально.", quality: "ok", reaction: "Можна тепліше — додай «thank you»." },
                { en: "I'm fine, thank you!", uk: "Добре, дякую!", quality: "good", reaction: "Ідеально!" },
                { en: "I am coffee.", uk: "Я кава.", quality: "bad", emotion: "surprised", reaction: "Ти — кава? 😄" },
            ],
        },
        {
            type: "choice",
            prompt: "Що робимо далі?",
            options: [
                {
                    text: "Stay here",
                    uk: "Лишитися",
                    icon: "☕",
                    outcome: [{ type: "scene", text: "Гілка сюжету: кроки вставляються одразу після вибору." }],
                },
                { text: "Go outside", uk: "Вийти", icon: "🚪" },
            ],
        },
        { type: "build", prompt: "Можна мені чай, будь ласка?", answer: "Can I have a tea, please?", distractors: ["is", "coffee"] },
        { type: "event", effect: "shake", icon: "💥", text: "Бах! Щось сталося. Ефекти: flash, shake, rain." },
        { type: "voice", phrase: "Nice to meet you!", uk: "Приємно познайомитися!" },
    ],
};

export const LESSON_TEMPLATE_JSON = JSON.stringify(TEMPLATE, null, 2);