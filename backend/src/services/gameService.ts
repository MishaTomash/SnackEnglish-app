import { Game } from "../models/Game.js";

const initialGames = [
  {
    gameId: "word-match",
    title: "Слово-Пара",
    description: "З'єднай англійське слово з перекладом на час.",
    isFree: true,
    status: "available",
  },
  {
    gameId: "grammar-quiz",
    title: "Граматичний Бліц",
    description: "Швидкі питання на знання правил.",
    isFree: true,
    status: "coming_soon",
  },
  {
    gameId: "hangman",
    title: "Врятуй Печиво",
    description: "Вгадуй слово по літерах. Кожна помилка — мінус крихта!",
    isFree: false,
    priceStars: 50,
    status: "available",
  },
  {
    gameId: "story-mode",
    title: "Сюжетна Пригода",
    description: "Пройди історію, відповідаючи англійською.",
    isFree: false,
    priceStars: 100,
    status: "coming_soon",
  },
];

export const seedGames = async (): Promise<void> => {
  try {
    for (const gameData of initialGames) {
      await Game.findOneAndUpdate(
        { gameId: gameData.gameId },
        { $set: gameData },
        { upsert: true, returnDocument: "after" },
      );
    }
    console.log("[GameService] Тестові ігри успішно додані в БД.");
  } catch (error) {
    console.error("[GameService] Помилка сідінгу ігор:", error);
  }
};
