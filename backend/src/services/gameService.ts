import { Game } from "../models/Game.js";

// АКТУАЛЬНИЙ СПИСОК (порожній, оскільки старі ігри видалено)
// Додавайте конфіги нових ігор сюди для автоматичного сідінгу в БД
const currentGames: any[] = [];

export const seedGames = async (): Promise<void> => {
  try {
    const validGameIds = currentGames.map((g) => g.gameId);

    // 1. ОЧИЩЕННЯ: Видаляємо старі ігри, яких більше немає в реєстрі
    await Game.deleteMany({ gameId: { $nin: validGameIds } });

    // 2. ДОДАВАННЯ: Записуємо актуальні ігри (якщо вони з'являться)
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
