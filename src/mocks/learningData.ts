import type { Category } from "../entities/learning/types";

export const LEARNING_CATEGORIES: Category[] = [
  {
    id: "vocabulary",
    title: "Слова",
    description: "Вивчай нові слова тематичними блоками",
    emoji: "📖",
    accent: "amber",
    units: [
      {
        id: "voc-greetings",
        title: "Привітання",
        description: "Hello, good morning, thank you…",
        emoji: "👋",
        steps: [
          {
            kind: "learn",
            cards: [
              {
                id: "g1",
                word: "Hello",
                translation: "Привіт",
                transcription: "[həˈləʊ]",
              },
              {
                id: "g2",
                word: "Good morning",
                translation: "Доброго ранку",
                transcription: "[ɡʊd ˈmɔːnɪŋ]",
              },
              {
                id: "g3",
                word: "Good evening",
                translation: "Доброго вечора",
                transcription: "[ɡʊd ˈiːvnɪŋ]",
              },
              {
                id: "g4",
                word: "Goodbye",
                translation: "До побачення",
                transcription: "[ˌɡʊdˈbaɪ]",
              },
              {
                id: "g5",
                word: "Nice to meet you",
                translation: "Приємно познайомитись",
                transcription: "[naɪs tə miːt juː]",
              },
              {
                id: "g6",
                word: "Thank you",
                translation: "Дякую",
                transcription: "[θæŋk juː]",
              },
            ],
          },
          {
            kind: "quiz",
            items: [
              {
                id: "gq1",
                question: "Як сказати «Привіт» англійською?",
                options: ["Hello", "Goodbye", "Thank you", "Please"],
                correctAnswer: "Hello",
              },
              {
                id: "gq2",
                question: "Що означає «Nice to meet you»?",
                options: [
                  "Приємно познайомитись",
                  "На добраніч",
                  "Як справи?",
                  "До побачення",
                ],
                correctAnswer: "Приємно познайомитись",
              },
              {
                id: "gq3",
                question: "Як привітатись зранку?",
                options: [
                  "Good morning",
                  "Good evening",
                  "Good night",
                  "Goodbye",
                ],
                correctAnswer: "Good morning",
              },
            ],
          },
        ],
      },
      {
        id: "voc-routine",
        title: "Рутина дня",
        description: "Wake up, breakfast, work…",
        emoji: "☀️",
        steps: [
          {
            kind: "learn",
            cards: [
              {
                id: "r1",
                word: "Wake up",
                translation: "Прокидатися",
                transcription: "[weɪk ʌp]",
              },
              {
                id: "r2",
                word: "Breakfast",
                translation: "Сніданок",
                transcription: "[ˈbrekfəst]",
              },
              {
                id: "r3",
                word: "Work",
                translation: "Працювати / Робота",
                transcription: "[wɜːk]",
              },
              {
                id: "r4",
                word: "Coffee",
                translation: "Кава",
                transcription: "[ˈkɒfi]",
              },
              {
                id: "r5",
                word: "Shower",
                translation: "Душ",
                transcription: "[ˈʃaʊə]",
              },
              {
                id: "r6",
                word: "Sleep",
                translation: "Спати",
                transcription: "[sliːp]",
              },
            ],
          },
          {
            kind: "quiz",
            items: [
              {
                id: "rq1",
                question: "«Breakfast» — це…",
                options: ["Сніданок", "Обід", "Вечеря", "Перекус"],
                correctAnswer: "Сніданок",
              },
              {
                id: "rq2",
                question: "Як сказати «Я прокидаюся о 7»?",
                options: [
                  "I wake up at 7",
                  "I sleep at 7",
                  "I work at 7",
                  "I eat at 7",
                ],
                correctAnswer: "I wake up at 7",
              },
              {
                id: "rq3",
                question: "«Shower» — це…",
                options: ["Душ", "Шафа", "Полиця", "Вікно"],
                correctAnswer: "Душ",
              },
            ],
          },
        ],
      },
      {
        id: "voc-travel",
        title: "Подорожі",
        description: "Airport, ticket, luggage…",
        emoji: "✈️",
        steps: [
          {
            kind: "learn",
            cards: [
              {
                id: "t1",
                word: "Ticket",
                translation: "Квиток",
                transcription: "[ˈtɪkɪt]",
              },
              {
                id: "t2",
                word: "Airport",
                translation: "Аеропорт",
                transcription: "[ˈeəpɔːt]",
              },
              {
                id: "t3",
                word: "Passport",
                translation: "Паспорт",
                transcription: "[ˈpɑːspɔːt]",
              },
              {
                id: "t4",
                word: "Luggage",
                translation: "Багаж",
                transcription: "[ˈlʌɡɪdʒ]",
              },
              {
                id: "t5",
                word: "Flight",
                translation: "Політ / Рейс",
                transcription: "[flaɪt]",
              },
            ],
          },
          {
            kind: "quiz",
            items: [
              {
                id: "tq1",
                question: "«Luggage» — це…",
                options: ["Багаж", "Квиток", "Паспорт", "Політ"],
                correctAnswer: "Багаж",
              },
              {
                id: "tq2",
                question: "Як сказати «Мій рейс затримується»?",
                options: [
                  "My flight is delayed",
                  "My ticket is lost",
                  "My luggage is heavy",
                  "My passport is here",
                ],
                correctAnswer: "My flight is delayed",
              },
              {
                id: "tq3",
                question: "«Airport» — це…",
                options: ["Аеропорт", "Вокзал", "Порт", "Готель"],
                correctAnswer: "Аеропорт",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "tests",
    title: "Тести",
    description: "Перевір себе на швидкість і точність",
    emoji: "✍️",
    accent: "emerald",
    units: [
      {
        id: "test-to-be",
        title: "To Be: am / is / are",
        description: "Базове дієслово «бути»",
        emoji: "🧩",
        steps: [
          {
            kind: "quiz",
            items: [
              {
                id: "be1",
                question: "I ___ a student.",
                options: ["am", "is", "are", "be"],
                correctAnswer: "am",
              },
              {
                id: "be2",
                question: "She ___ my friend.",
                options: ["is", "am", "are", "be"],
                correctAnswer: "is",
              },
              {
                id: "be3",
                question: "They ___ from Ukraine.",
                options: ["are", "is", "am", "be"],
                correctAnswer: "are",
              },
              {
                id: "be4",
                question: "___ you happy?",
                options: ["Are", "Is", "Am", "Be"],
                correctAnswer: "Are",
              },
            ],
          },
        ],
      },
      {
        id: "test-present-simple",
        title: "Present Simple",
        description: "Регулярні дії та -s у 3-й особі",
        emoji: "⏰",
        steps: [
          {
            kind: "quiz",
            items: [
              {
                id: "ps1",
                question: "He ___ coffee every morning.",
                options: ["drinks", "drink", "drinking", "drank"],
                correctAnswer: "drinks",
              },
              {
                id: "ps2",
                question: "They ___ to work by bus.",
                options: ["go", "goes", "going", "went"],
                correctAnswer: "go",
              },
              {
                id: "ps3",
                question: "She ___ like fish.",
                options: ["doesn't", "don't", "isn't", "aren't"],
                correctAnswer: "doesn't",
              },
              {
                id: "ps4",
                question: "___ you speak English?",
                options: ["Do", "Does", "Are", "Is"],
                correctAnswer: "Do",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "listening",
    title: "Аудіювання",
    description: "Сприймай англійську на слух",
    emoji: "🎧",
    accent: "sky",
    units: [
      {
        id: "lis-cafe",
        title: "У кав'ярні",
        description: "Замовлення напою англійською",
        emoji: "☕",
        steps: [
          {
            kind: "listening",
            items: [
              {
                id: "lc1",
                phrase: "Can I get a coffee, please?",
                options: [
                  "Можна мені каву, будь ласка?",
                  "Де тут кав'ярня?",
                  "Скільки коштує чай?",
                ],
                correctAnswer: "Можна мені каву, будь ласка?",
              },
              {
                id: "lc2",
                phrase: "Would you like milk with that?",
                options: [
                  "Бажаєте молоко до цього?",
                  "Ви любите чай?",
                  "Що ви будете пити?",
                ],
                correctAnswer: "Бажаєте молоко до цього?",
              },
              {
                id: "lc3",
                phrase: "That will be five dollars.",
                options: [
                  "Це буде п'ять доларів.",
                  "Ось ваша здача.",
                  "Оплатіть карткою.",
                ],
                correctAnswer: "Це буде п'ять доларів.",
              },
            ],
          },
        ],
      },
      {
        id: "lis-intro",
        title: "Знайомство",
        description: "Як люди представляються",
        emoji: "🤝",
        steps: [
          {
            kind: "listening",
            items: [
              {
                id: "li1",
                phrase: "My name is Anna. Nice to meet you!",
                options: [
                  "Мене звати Анна. Приємно познайомитись!",
                  "Я з України. Як справи?",
                  "До побачення, до завтра!",
                ],
                correctAnswer: "Мене звати Анна. Приємно познайомитись!",
              },
              {
                id: "li2",
                phrase: "Where are you from?",
                options: ["Звідки ти?", "Куди ти йдеш?", "Як тебе звати?"],
                correctAnswer: "Звідки ти?",
              },
              {
                id: "li3",
                phrase: "I am from Ukraine.",
                options: [
                  "Я з України.",
                  "Я живу в Києві.",
                  "Я вчу англійську.",
                ],
                correctAnswer: "Я з України.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "speaking",
    title: "Розмовна практика",
    description: "Говори вголос і тренуй вимову",
    emoji: "🎤",
    accent: "rose",
    units: [
      {
        id: "spk-intro",
        title: "Знайомство",
        description: "Представся англійською",
        emoji: "🙋",
        steps: [
          {
            kind: "speak",
            items: [
              {
                id: "si1",
                phrase: "My name is Alex.",
                translation: "Мене звати Алекс.",
              },
              {
                id: "si2",
                phrase: "I am from Ukraine.",
                translation: "Я з України.",
              },
              {
                id: "si3",
                phrase: "Nice to meet you.",
                translation: "Приємно познайомитись.",
              },
            ],
          },
        ],
      },
      {
        id: "spk-shop",
        title: "У магазині",
        description: "Запитання про ціну та розмір",
        emoji: "🛍️",
        steps: [
          {
            kind: "speak",
            items: [
              {
                id: "ss1",
                phrase: "How much is it?",
                translation: "Скільки це коштує?",
              },
              {
                id: "ss2",
                phrase: "Do you have this in a larger size?",
                translation: "У вас є це більшого розміру?",
              },
              {
                id: "ss3",
                phrase: "I will take it, thank you.",
                translation: "Я це візьму, дякую.",
              },
            ],
          },
        ],
      },
    ],
  },
];
