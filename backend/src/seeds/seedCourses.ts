import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { Word } from "../models/Word.js";
import { Unit } from "../models/Unit.js";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

interface RawUnitSeed {
  title: string;
  description: string;
  level: "A1" | "A2";
  order: number;
  words: Array<{
    text: string;
    transcription: string;
    translation: string;
    exampleSentence: string;
    exampleTranslation: string;
  }>;
  grammar: {
    title: string;
    explanation: string;
    examples: Array<{ en: string; ua: string }>;
  };
  videoUrl: string;
  reading: {
    title: string;
    text: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
    }>;
  };
  dialogue: {
    title: string;
    scenario: string;
    lines: Array<{
      speaker: string;
      text: string;
      translation: string;
    }>;
  };
  quiz: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

const coursesData: RawUnitSeed[] = [
  // ================= UNIT 1 (A1) =================
  {
    title: "First Meet & Small Talk",
    description:
      "Опануй фрази першого знайомства, дієслово to be та легку невимушену розмову.",
    level: "A1",
    order: 1,
    words: [
      {
        text: "hello",
        transcription: "/həˈloʊ/",
        translation: "привіт",
        exampleSentence: "Hello, nice to meet you!",
        exampleTranslation: "Привіт, приємно познайомитися!",
      },
      {
        text: "name",
        transcription: "/neɪm/",
        translation: "ім'я",
        exampleSentence: "My name is Alex.",
        exampleTranslation: "Мене звати Алекс.",
      },
      {
        text: "meet",
        transcription: "/miːt/",
        translation: "знайомитися / зустрічати",
        exampleSentence: "Nice to meet you, Anna.",
        exampleTranslation: "Приємно познайомитися, Анна.",
      },
      {
        text: "friend",
        transcription: "/frend/",
        translation: "друг",
        exampleSentence: "This is my good friend John.",
        exampleTranslation: "Це мій добрий друг Джон.",
      },
      {
        text: "please",
        transcription: "/pliːz/",
        translation: "будь ласка",
        exampleSentence: "Please call me later today.",
        exampleTranslation: "Будь ласка, зателефонуй мені сьогодні пізніше.",
      },
      {
        text: "thanks",
        transcription: "/θæŋks/",
        translation: "дякую",
        exampleSentence: "Thanks for your great advice.",
        exampleTranslation: "Дякую за твою чудову пораду.",
      },
      {
        text: "welcome",
        transcription: "/ˈwelkəm/",
        translation: "ласкаво просимо",
        exampleSentence: "You are always welcome here.",
        exampleTranslation: "Тобі тут завжди раді.",
      },
      {
        text: "speak",
        transcription: "/spiːk/",
        translation: "розмовляти",
        exampleSentence: "I speak a little English.",
        exampleTranslation: "Я трохи розмовляю англійською.",
      },
    ],
    grammar: {
      title: "Дієслово To Be у Present Simple",
      explanation:
        "Дієслово 'to be' (бути, є) змінюється за особами: am (для I), is (для he, she, it) та are (для you, we, they). В англійській мові воно обов'язкове навіть тоді, коли в українській ми пропускаємо слово 'є'.",
      examples: [
        { en: "I am a web developer.", ua: "Я веб-розробник." },
        { en: "She is from Ukraine.", ua: "Вона з України." },
        { en: "They are very friendly.", ua: "Вони дуже привітні." },
      ],
    },
    videoUrl: "https://www.youtube.com/watch?v=dtp6bXBcbvE",
    reading: {
      title: "Alex's First Day in London",
      text: "Alex is 20 years old and lives in Ukraine. Today he is in London for an English course. In the morning, he visits a local cafe and meets Emma. Emma is from Canada. They introduce themselves and realize they are both learning new languages. They are happy to practice English together.",
      questions: [
        {
          question: "Where is Alex currently staying?",
          options: ["In Berlin", "In London", "In New York", "In Rome"],
          correctAnswer: 1,
        },
        {
          question: "Where is Emma from?",
          options: ["Canada", "Ukraine", "Poland", "Australia"],
          correctAnswer: 0,
        },
      ],
    },
    dialogue: {
      title: "Meeting at a Campus Cafe",
      scenario:
        "Знайомство з новим одногрупником за столиком у студентському кафе.",
      lines: [
        {
          speaker: "Emma",
          text: "Hello! Excuse me, is this seat free?",
          translation: "Привіт! Перепрошую, це місце вільне?",
        },
        {
          speaker: "Alex",
          text: "Hi! Yes, it is. I'm Alex, nice to meet you.",
          translation: "Привіт! Так, вільне. Я Алекс, приємно познайомитися.",
        },
        {
          speaker: "Emma",
          text: "Nice to meet you too! Are you a student here?",
          translation: "Мені також приємно! Ти тут студент?",
        },
        {
          speaker: "Alex",
          text: "Yes, I am. I just arrived yesterday from Ukraine.",
          translation: "Так. Я щойно вчора приїхав з України.",
        },
      ],
    },
    quiz: [
      {
        question: "He ___ from Ukraine.",
        options: ["am", "is", "are", "be"],
        correctAnswer: 1,
        explanation: "Для займенника 'he' використовується форма 'is'.",
      },
      {
        question: "___ you ready for the lesson?",
        options: ["Are", "Is", "Am", "Do"],
        correctAnswer: 0,
        explanation: "З займенником 'you' використовується дієслово 'Are'.",
      },
      {
        question: "Nice to ___ you!",
        options: ["see", "meet", "speak", "call"],
        correctAnswer: 1,
        explanation: "Стандартна ідіома знайомства — 'Nice to meet you'.",
      },
      {
        question: "I ___ very happy to be here.",
        options: ["is", "am", "are", "have"],
        correctAnswer: 1,
        explanation: "Для першої особи однини 'I' форма дієслова — 'am'.",
      },
      {
        question: "What is your ___?",
        options: ["name", "friend", "speak", "welcome"],
        correctAnswer: 0,
        explanation: "Питання про ім'я звучить як 'What is your name?'.",
      },
    ],
  },

  // ================= UNIT 2 (A1) =================
  {
    title: "Daily Routine & Coffee Break",
    description:
      "Навчися розповідати про свій розклад дня, звички та щоденні ритуали через Present Simple.",
    level: "A1",
    order: 2,
    words: [
      {
        text: "wake up",
        transcription: "/weɪk ʌp/",
        translation: "прокидатися",
        exampleSentence: "I wake up at seven o'clock every day.",
        exampleTranslation: "Я прокидаюся о сьомій годині щодня.",
      },
      {
        text: "breakfast",
        transcription: "/ˈbrekfəst/",
        translation: "сніданок",
        exampleSentence: "A healthy breakfast gives good energy.",
        exampleTranslation: "Корисний сніданок дає хорошу енергію.",
      },
      {
        text: "coffee",
        transcription: "/ˈkɒfi/",
        translation: "кава",
        exampleSentence: "I always drink hot coffee in the morning.",
        exampleTranslation: "Я завжди п'ю гарячу каву вранці.",
      },
      {
        text: "work",
        transcription: "/wɜːk/",
        translation: "працювати / робота",
        exampleSentence: "He works on web projects remotely.",
        exampleTranslation: "Він працює над веб-проєктами віддалено.",
      },
      {
        text: "lunch",
        transcription: "/lʌntʃ/",
        translation: "обід",
        exampleSentence: "Let's have lunch together at one PM.",
        exampleTranslation: "Давай пообідаємо разом о першій годині дня.",
      },
      {
        text: "walk",
        transcription: "/wɔːk/",
        translation: "гуляти / прогулянка",
        exampleSentence: "We walk in the park after dinner.",
        exampleTranslation: "Ми гуляємо в парку після вечері.",
      },
      {
        text: "sleep",
        transcription: "/sliːp/",
        translation: "спати",
        exampleSentence: "I sleep at least eight hours.",
        exampleTranslation: "Я сплю щонайменше вісім годин.",
      },
      {
        text: "always",
        transcription: "/ˈɔːlweɪz/",
        translation: "завжди",
        exampleSentence: "She always reads a book before bed.",
        exampleTranslation: "Вона завжди читає книгу перед сном.",
      },
    ],
    grammar: {
      title: "Present Simple: Звичайні регулярні дії",
      explanation:
        "Present Simple описує звички, повторювані події та розклад. Для 3-ї особи однини (he, she, it) до дієслова додаємо закінчення -s або -es.",
      examples: [
        { en: "I drink coffee every morning.", ua: "Я п'ю каву щоранку." },
        { en: "He starts work at nine.", ua: "Він починає роботу о дев'ятій." },
        {
          en: "They do not work on weekends.",
          ua: "Вони не працюють у вихідні.",
        },
      ],
    },
    videoUrl: "https://www.youtube.com/watch?v=L9AWrJnhsRI",
    reading: {
      title: "David's Productive Morning",
      text: "David is a software engineer. He wakes up at 7:00 AM, makes fresh oatmeal, and drinks a large cup of black coffee. At 8:30 AM, he opens his laptop and reviews his task list. He always writes clean code before his daily stand-up meeting with the team.",
      questions: [
        {
          question: "What time does David wake up?",
          options: ["At 6:00 AM", "At 7:00 AM", "At 8:30 AM", "At 9:00 AM"],
          correctAnswer: 1,
        },
        {
          question: "What does he drink in the morning?",
          options: ["Green tea", "Orange juice", "Black coffee", "Milk"],
          correctAnswer: 2,
        },
      ],
    },
    dialogue: {
      title: "Office Coffee Break",
      scenario: "Коротка розмова з колегою на кухні під час кава-брейку.",
      lines: [
        {
          speaker: "Olena",
          text: "Hey! Do you want some coffee or tea?",
          translation: "Привіт! Хочеш трохи кави чи чаю?",
        },
        {
          speaker: "Mark",
          text: "Coffee with milk, please. I need a quick break.",
          translation:
            "Каву з молоком, будь ласка. Мені потрібна швидка перерва.",
        },
        {
          speaker: "Olena",
          text: "What time do you usually finish work today?",
          translation: "О котрій ти зазвичай закінчуєш роботу сьогодні?",
        },
        {
          speaker: "Mark",
          text: "Around six PM, then I go to the gym.",
          translation: "Близько шостої вечора, потім я йду в зал.",
        },
      ],
    },
    quiz: [
      {
        question: "She ___ black coffee every morning.",
        options: ["drink", "drinks", "drinking", "drank"],
        correctAnswer: 1,
        explanation: "З 'she' дієслово отримує закінчення -s: 'drinks'.",
      },
      {
        question: "We ___ work at 6:00 PM.",
        options: ["finishes", "finish", "finishing", "finished"],
        correctAnswer: 1,
        explanation:
          "Для займенника 'we' беремо базову форму дієслова: 'finish'.",
      },
      {
        question: "He doesn't ___ up early on Sundays.",
        options: ["wakes", "wake", "waking", "woke"],
        correctAnswer: 1,
        explanation:
          "Після допоміжного дієслова 'doesn't' використовується інфінітив без -s: 'wake'.",
      },
      {
        question: "I always have ___ at 8:00 AM.",
        options: ["breakfast", "sleep", "walk", "coffee break"],
        correctAnswer: 0,
        explanation: "'Have breakfast' — снідати.",
      },
      {
        question: "___ they live in the city center?",
        options: ["Does", "Do", "Are", "Is"],
        correctAnswer: 1,
        explanation:
          "Для питального речення у Present Simple з 'they' потрібне допоміжне 'Do'.",
      },
    ],
  },

  // ================= UNIT 3 (A2) =================
  {
    title: "Navigating the Airport & Travel",
    description:
      "Усе необхідне для впевненого проходження паспортного контролю, посадки на рейс та орієнтування в аеропорту.",
    level: "A2",
    order: 3,
    words: [
      {
        text: "flight",
        transcription: "/flaɪt/",
        translation: "рейс / переліт",
        exampleSentence: "Our flight departs in twenty minutes.",
        exampleTranslation: "Наш рейс відлітає через двадцять хвилин.",
      },
      {
        text: "passport",
        transcription: "/ˈpɑːspɔːt/",
        translation: "паспорт",
        exampleSentence: "Keep your passport in a safe pocket.",
        exampleTranslation: "Тримайте свій паспорт у надійній кишені.",
      },
      {
        text: "luggage",
        transcription: "/ˈlʌɡɪdʒ/",
        translation: "багаж",
        exampleSentence: "You can drop off your luggage here.",
        exampleTranslation: "Ви можете здати свій багаж тут.",
      },
      {
        text: "gate",
        transcription: "/ɡeɪt/",
        translation: "вихід на посадку (гейт)",
        exampleSentence: "Boarding begins at gate B14.",
        exampleTranslation: "Посадка розпочинається біля гейту B14.",
      },
      {
        text: "boarding pass",
        transcription: "/ˈbɔːdɪŋ pɑːs/",
        translation: "посадковий талон",
        exampleSentence: "Please show your mobile boarding pass.",
        exampleTranslation:
          "Будь ласка, покажіть ваш електронний посадковий талон.",
      },
      {
        text: "delay",
        transcription: "/dɪˈleɪ/",
        translation: "затримка / затримувати",
        exampleSentence: "The evening flight has a short delay.",
        exampleTranslation: "Вечірній рейс має невелику затримку.",
      },
      {
        text: "customs",
        transcription: "/ˈkʌstəmz/",
        translation: "митниця / митний контроль",
        exampleSentence: "Go through customs after baggage claim.",
        exampleTranslation: "Пройдіть митницю після отримання багажу.",
      },
      {
        text: "arrive",
        transcription: "/əˈraɪv/",
        translation: "прибувати",
        exampleSentence: "We arrive in Warsaw at midnight.",
        exampleTranslation: "Ми прибуваємо до Варшави опівночі.",
      },
      {
        text: "departure",
        transcription: "/dɪˈpɑːtʃə/",
        translation: "відправлення",
        exampleSentence: "Check the departure screen for gate updates.",
        exampleTranslation:
          "Перевірте табло відправлення щодо оновлення номерів гейтів.",
      },
    ],
    grammar: {
      title: "Прийменники місця та руху: At, In, On, To",
      explanation:
        "'At' вказує на конкретну точку чи пункт призначення (at the airport, at the gate); 'in' — усередині простору або міста (in the terminal, in London); 'on' — на поверхні або у великому транспорті (on the plane); 'to' — напрямок руху (go to gate 4).",
      examples: [
        { en: "We are waiting at Gate 12.", ua: "Ми чекаємо біля гейту 12." },
        {
          en: "My ticket is in my backpack.",
          ua: "Мій квиток у моєму рюкзаку.",
        },
        {
          en: "All passengers are on the plane.",
          ua: "Усі пасажири вже в літаку.",
        },
      ],
    },
    videoUrl: "https://www.youtube.com/watch?v=wXW_e6z4Hjg",
    reading: {
      title: "At Warsaw Chopin Airport",
      text: "Maria is traveling to Berlin for a weekend trip. When she arrives at the airport, she goes straight to the check-in desk to drop off her heavy suitcase. The airport officer checks her passport and issues a boarding pass. Her flight departs from Gate B22 at 3:15 PM.",
      questions: [
        {
          question: "Where is Maria traveling to?",
          options: ["London", "Berlin", "Paris", "Kyiv"],
          correctAnswer: 1,
        },
        {
          question: "Which gate does her flight depart from?",
          options: ["Gate A10", "Gate B22", "Gate C14", "Gate D01"],
          correctAnswer: 1,
        },
      ],
    },
    dialogue: {
      title: "Border & Passport Control",
      scenario:
        "Проходження паспортного контролю після прильоту в іншу країну.",
      lines: [
        {
          speaker: "Officer",
          text: "Good afternoon. May I see your passport and return ticket?",
          translation:
            "Доброго дня. Можу я побачити ваш паспорт та зворотний квиток?",
        },
        {
          speaker: "Traveler",
          text: "Here they are, officer.",
          translation: "Ось вони, офіцере.",
        },
        {
          speaker: "Officer",
          text: "What is the purpose of your visit to the country?",
          translation: "Яка мета вашого візиту до країни?",
        },
        {
          speaker: "Traveler",
          text: "I am attending a tech conference and visiting friends for five days.",
          translation:
            "Я відвідую тех-конференцію та гостюю у друзів протягом 5 днів.",
        },
      ],
    },
    quiz: [
      {
        question: "We are waiting for boarding ___ Gate 4.",
        options: ["at", "in", "on", "to"],
        correctAnswer: 0,
        explanation: "З конкретною точкою (Gate) вживається прийменник 'at'.",
      },
      {
        question: "Her suitcase is heavy; it is her only ___.",
        options: ["ticket", "luggage", "customs", "gate"],
        correctAnswer: 1,
        explanation: "Валіза є багажем ('luggage').",
      },
      {
        question: "The flight cannot depart on time due to a 30-minute ___.",
        options: ["passport", "delay", "check-in", "screen"],
        correctAnswer: 1,
        explanation: "Затримка рейсу позначається словом 'delay'.",
      },
      {
        question:
          "You must present your ___ pass before boarding the aircraft.",
        options: ["boarding", "flight", "terminal", "ticket"],
        correctAnswer: 0,
        explanation: "Посадковий талон — 'boarding pass'.",
      },
      {
        question: "They arrived ___ Berlin early in the morning.",
        options: ["at", "in", "on", "to"],
        correctAnswer: 1,
        explanation: "З назвами великих міст та країн вживається 'arrive in'.",
      },
    ],
  },

  // ================= UNIT 4 (A2) =================
  {
    title: "Tech & Work Environment",
    description:
      "Прокачай робочу англійську: завдання, дедлайни, баги та модальні конструкції have to / need to.",
    level: "A2",
    order: 4,
    words: [
      {
        text: "task",
        transcription: "/tɑːsk/",
        translation: "завдання / задача",
        exampleSentence: "I need to complete this critical task today.",
        exampleTranslation:
          "Мені потрібно завершити це критичне завдання сьогодні.",
      },
      {
        text: "deadline",
        transcription: "/ˈdedlaɪn/",
        translation: "дедлайн / кінцевий термін",
        exampleSentence: "The deadline for the product release is tomorrow.",
        exampleTranslation: "Дедлайн релізу продукту — завтра.",
      },
      {
        text: "bug",
        transcription: "/bʌɡ/",
        translation: "помилка в коді (баг)",
        exampleSentence:
          "We found an unexpected bug in the authorization service.",
        exampleTranslation:
          "Ми знайшли неочікуваний баг у сервісі авторизації.",
      },
      {
        text: "call",
        transcription: "/kɔːl/",
        translation: "дзвінок / зідзвон",
        exampleSentence: "Let's hop on a quick call to align.",
        exampleTranslation: "Давай швидко зідзвонимося, щоб узгодити деталі.",
      },
      {
        text: "deploy",
        transcription: "/dɪˈplɔɪ/",
        translation: "розгортати / деплоїти",
        exampleSentence: "We deploy the new feature to production tonight.",
        exampleTranslation:
          "Ми деплоїмо нову фічу на продакшн сьогодні ввечері.",
      },
      {
        text: "solve",
        transcription: "/sɒlv/",
        translation: "вирішувати (проблему)",
        exampleSentence: "Our engineering team can solve this issue quickly.",
        exampleTranslation:
          "Наша команда інженерів може швидко вирішити цю проблему.",
      },
      {
        text: "urgent",
        transcription: "/ˈɜːdʒənt/",
        translation: "терміновий",
        exampleSentence: "This customer report is extremely urgent.",
        exampleTranslation: "Цей звіт від клієнта вкрай терміновий.",
      },
      {
        text: "meeting",
        transcription: "/ˈmiːtɪŋ/",
        translation: "зустріч / мітинг",
        exampleSentence: "The weekly planning meeting starts at ten AM.",
        exampleTranslation:
          "Щотижневий мітинг планування починається о десятій ранку.",
      },
      {
        text: "review",
        transcription: "/rɪˈvjuː/",
        translation: "переглядати / код-рев'ю",
        exampleSentence: "Could you please review my pull request?",
        exampleTranslation: "Чи міг би ти переглянути мій пулл-реквест?",
      },
    ],
    grammar: {
      title: "Конструкції обов'язку: Have to та Need to",
      explanation:
        "'Have to' виражає зовнішню необхідність або обов'язок за правилами/дедлайнами ('мушу, зобов'язаний'). 'Need to' підкреслює практичну потребу у виконанні дії ('потрібно, необхідно').",
      examples: [
        {
          en: "I have to fix this bug before deployment.",
          ua: "Я мушу виправити цей баг перед деплоєм.",
        },
        {
          en: "We need to test the database performance.",
          ua: "Нам потрібно протестувати продуктивність бази даних.",
        },
        {
          en: "He doesn't have to work overtime today.",
          ua: "Йому не обов'язково працювати понаднормово сьогодні.",
        },
      ],
    },
    videoUrl: "https://www.youtube.com/watch?v=5U_E2jM9M28",
    reading: {
      title: "Sprint Planning in an IT Team",
      text: "Every Monday, Max and his dev team join a sprint planning meeting. They estimate new tasks and set realistic deadlines. Yesterday, the QA team discovered two urgent bugs in the payment integration. Max had to work closely with the backend team to resolve the issues and deploy the hotfix safely.",
      questions: [
        {
          question: "What does the development team do every Monday?",
          options: [
            "Deploys code",
            "Holds sprint planning",
            "Takes a vacation",
            "Celebrates releases",
          ],
          correctAnswer: 1,
        },
        {
          question: "Where were the urgent bugs discovered?",
          options: [
            "In marketing text",
            "In payment integration",
            "In database design",
            "In mobile icons",
          ],
          correctAnswer: 1,
        },
      ],
    },
    dialogue: {
      title: "Syncing on a Blocker Bug",
      scenario: "Обговорення блокуючого багу перед релізом з тімлідом.",
      lines: [
        {
          speaker: "Lead",
          text: "Do we have any blockers before today's scheduled release?",
          translation:
            "У нас є якісь блокери перед сьогоднішнім релізом за розкладом?",
        },
        {
          speaker: "Developer",
          text: "Yes, I discovered a token expiration bug. I need to fix it now.",
          translation:
            "Так, я виявив баг із терміном дії токена. Мені потрібно виправити його зараз.",
        },
        {
          speaker: "Lead",
          text: "How much time do you need to test the patch?",
          translation:
            "Скільки часу тобі потрібно, щоб протестувати виправлення?",
        },
        {
          speaker: "Developer",
          text: "Around twenty minutes, then we can deploy safely to production.",
          translation:
            "Близько двадцяти хвилин, після чого ми зможемо безпечно задеплоїти на прод.",
        },
      ],
    },
    quiz: [
      {
        question: "We ___ fix this issue before the deadline ends.",
        options: ["have to", "having", "has", "are have to"],
        correctAnswer: 0,
        explanation: "З 'we' використовується базова модальна форма 'have to'.",
      },
      {
        question: "The QA specialist found a critical ___ in the payment flow.",
        options: ["task", "bug", "call", "screen"],
        correctAnswer: 1,
        explanation: "Помилка в програмі — 'bug'.",
      },
      {
        question: "He ___ to review our pull request today.",
        options: ["need", "needs", "is need", "needing"],
        correctAnswer: 1,
        explanation: "Для займенника 'he' форма дієслова — 'needs to'.",
      },
      {
        question: "This client issue requires quick action, it is very ___.",
        options: ["relaxed", "urgent", "slow", "old"],
        correctAnswer: 1,
        explanation: "'Urgent' — терміновий, невідкладний.",
      },
      {
        question: "Can we jump on a brief ___ to discuss the architecture?",
        options: ["bug", "call", "deploy", "task"],
        correctAnswer: 1,
        explanation: "'Jump on a call' — зізвонитися для обговорення.",
      },
    ],
  },
];

async function runSeed(): Promise<void> {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    // Видаляємо застарілі індекси зі старих схем
    try {
      await mongoose.connection.collection("words").dropIndex("wordId_1");
      console.log("Old 'wordId_1' index removed successfully.");
    } catch {
      // Індекс вже відсутній
    }

    try {
      await mongoose.connection.collection("units").dropIndex("unitId_1");
      console.log("Old 'unitId_1' index removed successfully.");
    } catch {
      // Індекс вже відсутній
    }

    let wordsCreated = 0;
    let wordsExisting = 0;
    let unitsCreated = 0;
    let unitsUpdated = 0;

    for (const unitData of coursesData) {
      const wordIds: mongoose.Types.ObjectId[] = [];

      for (const wordItem of unitData.words) {
        let existingWord = await Word.findOne({
          text: wordItem.text,
          level: unitData.level,
        });

        if (!existingWord) {
          existingWord = await Word.create({
            ...wordItem,
            level: unitData.level,
          });
          wordsCreated++;
        } else {
          wordsExisting++;
        }

        wordIds.push(existingWord._id as mongoose.Types.ObjectId);
      }

      const existingUnit = await Unit.findOne({ title: unitData.title });

      if (!existingUnit) {
        await Unit.create({
          title: unitData.title,
          description: unitData.description,
          level: unitData.level,
          order: unitData.order,
          wordIds,
          grammar: unitData.grammar,
          videoUrl: unitData.videoUrl,
          reading: unitData.reading,
          dialogue: unitData.dialogue,
          quiz: unitData.quiz,
        });
        unitsCreated++;
        console.log(`[CREATED UNIT] ${unitData.title} (${unitData.level})`);
      } else {
        await Unit.updateOne(
          { _id: existingUnit._id },
          {
            description: unitData.description,
            level: unitData.level,
            order: unitData.order,
            wordIds,
            grammar: unitData.grammar,
            videoUrl: unitData.videoUrl,
            reading: unitData.reading,
            dialogue: unitData.dialogue,
            quiz: unitData.quiz,
          },
        );
        unitsUpdated++;
        console.log(`[UPDATED UNIT] ${unitData.title} (${unitData.level})`);
      }
    }

    console.log("------------------------------------------");
    console.log("SEEDING SUMMARY:");
    console.log(
      `Words created: ${wordsCreated}, Words existing/reused: ${wordsExisting}`,
    );
    console.log(
      `Units created: ${unitsCreated}, Units updated: ${unitsUpdated}`,
    );
    console.log("Seeding completed successfully!");
  } catch (error: unknown) {
    console.error("Failed to execute seed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
}

void runSeed();
