import type { Unit } from "../entities/unit/types";

export const mockUnits: Unit[] = [
  {
    id: "u1",
    title: "Basic Greetings",
    level: "A1",
    topic: "Greetings",
    order: 1,
    wordIds: ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8"],
    grammarTopic: 'Verb "To Be"',
    grammarExplanation:
      'Дієслово "to be" (бути) змінюється залежно від займенника: I am, You are, He/She/It is, We/They are.',
    videoUrl: "https://www.youtube.com/watch?v=R0R0yE4K-0c",
    readingText:
      "Hi, my name is Anna. I am from Ukraine. I am a student. Nice to meet you!",
    readingTranslation:
      "Привіт, моє ім'я Анна. Я з України. Я студентка. Приємно познайомитись!",
    steps: [
      { id: "s1", type: "vocabulary", status: "available" },
      { id: "s2", type: "grammar", status: "locked" },
      { id: "s3", type: "reading", status: "locked" },
    ],
  },
  {
    id: "u2",
    title: "My Daily Routine",
    level: "A1",
    topic: "Daily routine",
    order: 2,
    wordIds: ["w9", "w10", "w11", "w12", "w13", "w14", "w15", "w16"],
    grammarTopic: "Present Simple",
    grammarExplanation:
      "Present Simple використовується для регулярних дій. Для He/She/It до дієслова додається закінчення -s або -es (He works, She goes).",
    videoUrl: "https://www.youtube.com/watch?v=M99_p6O0lP0",
    readingText:
      "I wake up at 7 AM every day. I take a shower and brush my teeth. Then I drink coffee and go to work.",
    readingTranslation:
      "Я прокидаюся о 7 ранку кожного дня. Я приймаю душ і чищу зуби. Потім я п'ю каву і йду на роботу.",
    steps: [
      { id: "s4", type: "warmup", status: "locked" },
      { id: "s5", type: "vocabulary", status: "locked" },
      { id: "s6", type: "test", status: "locked" },
    ],
  },
  {
    id: "u3",
    title: "Traveling",
    level: "A2",
    topic: "Travel",
    order: 3,
    wordIds: ["w17", "w18", "w19", "w20", "w21", "w22", "w23", "w24"],
    grammarTopic: "Prepositions of Place (in, on, at)",
    grammarExplanation:
      'Використовуйте "at" для конкретних локацій (at the airport), "in" для міст/країн (in London), "on" для поверхонь або транспорту (on a bus).',
    videoUrl: "https://www.youtube.com/watch?v=pM9p9QO0-x4",
    readingText:
      "I am at the airport now. My flight to Paris is at 5 PM. I have my passport and one small luggage.",
    readingTranslation:
      "Я зараз в аеропорту. Мій рейс до Парижа о 5 вечора. У мене є мій паспорт та один маленький багаж.",
    steps: [
      { id: "s7", type: "video", status: "locked" },
      { id: "s8", type: "speaking", status: "locked" },
      { id: "s9", type: "test", status: "locked" },
    ],
  },
];
