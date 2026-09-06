import { Game } from "../models/Game.js";

// АКТУАЛЬНИЙ СПИСОК (має точно збігатися з registry.ts на фронтенді)
const currentGames = [
  {
    gameId: "word-match",
    title: "Слово-Пара",
    description: "З'єднай англійське слово з правильним перекладом на час.",
    isFree: true,
    status: "available",
  },
  {
    gameId: "hangman",
    title: "Врятуй Печиво",
    description: "Вгадуй слово по літерах. Кожна помилка — мінус крихта!",
    isFree: false,
    priceStars: 50,
    status: "coming_soon",
  },
  {
    gameId: "quick-pick",
    title: "Швидкий вибір",
    description:
      "Обери правильний переклад на швидкість. Доступно одразу, без прогресу!",
    isFree: true,
    status: "available",
  },
];

export const seedGames = async (): Promise<void> => {
  try {
    const validGameIds = currentGames.map((g) => g.gameId);

    // 1. ОЧИЩЕННЯ: Видаляємо старі ігри (story-mode, grammar-quiz), яких більше немає в реєстрі
    await Game.deleteMany({ gameId: { $nin: validGameIds } });

    // 2. ДОДАВАННЯ: Записуємо актуальні ігри
    for (const gameData of currentGames) {
      await Game.findOneAndUpdate(
        { gameId: gameData.gameId },
        { $set: gameData },
        { upsert: true, returnDocument: "after" },
      );
    }

    console.log(
      "[GameService] База ігор успішно очищена та синхронізована з фронтендом.",
    );
  } catch (error) {
    console.error("[GameService] Помилка сідінгу ігор:", error);
  }
};
