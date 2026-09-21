import { Game } from "../models/Game.js";

// АКТУАЛЬНИЙ СПИСОК (має збігатися з registry.ts на фронтенді)
const currentGames: any[] = [
  {
    gameId: "word-drop",
    title: "Метеоритний Дощ",
    description:
      "Рятуй планету від слів-метеоритів! Встигни обрати правильний переклад, поки вони не впали.",
    isFree: true,
    status: "available",
  },
  {
    gameId: "memory-match",
    title: "Матриця Пам'яті",
    description:
      "Шукай пари між англійськими словами та їх перекладами. Тренуй візуальну пам'ять!",
    isFree: true,
    status: "available",
  },
  {
    gameId: "word-builder",
    title: "Будівельник Слів",
    description:
      "Склади англійське слово з перемішаних літер, орієнтуючись на переклад!",
    isFree: true,
    status: "available",
  },
  {
    gameId: "tug-of-war",
    title: "Перетягування Канату",
    description:
      "Напиши переклад швидше за друга. Кожна правильна літера тягне канат до тебе, а помилка — заморожує клавіатуру!",
    isFree: true,
    status: "available",
  },
  {
    gameId: "hot-potato",
    title: "Гаряча Картопля",
    description:
      "Бомба ось-ось вибухне! Відповідай правильно, щоб перекинути її супернику. Помилишся — втратиш час!",
    isFree: true,
    status: "available",
  },
];

export const seedGames = async (): Promise<void> => {
  try {
    const validGameIds = currentGames.map((g) => g.gameId);

    // 1. ОЧИЩЕННЯ: Видаляємо старі ігри
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
