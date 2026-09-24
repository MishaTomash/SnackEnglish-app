import { useState } from "react";

/**
 * Fisher–Yates: рівномірне перемішування без мутації вхідного масиву.
 * random можна підмінити в тестах; за замовчуванням Math.random.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Те саме, але якщо правильна відповідь випала на ту саму позицію,
 * що й у попередньому питанні (avoidIndex), міняємо її місцем з
 * випадковим сусідом. Для масивів < 2 елементів — просто shuffle.
 */
export function shuffleAvoidingIndex<T>(
  items: readonly T[],
  correctItem: T,
  avoidIndex: number | null,
  random: () => number = Math.random,
): T[] {
  const result = shuffle(items, random);
  if (items.length < 2 || avoidIndex === null) return result;

  const index = result.indexOf(correctItem);
  if (index === -1 || index !== avoidIndex) return result;

  // Вибираємо випадковий ІНШИЙ індекс і міняємось місцями
  const candidates = result.map((_, i) => i).filter((i) => i !== index);
  const target = candidates[Math.floor(random() * candidates.length)];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

interface ShuffledState<T> {
  itemId: string;
  shuffled: T[];
  correctIndex: number;
}

function shuffleFor<T>(
  options: readonly T[],
  correctItem: T,
  itemId: string,
  avoidIndex: number | null,
): ShuffledState<T> {
  const shuffled = shuffleAvoidingIndex(options, correctItem, avoidIndex);
  return { itemId, shuffled, correctIndex: shuffled.indexOf(correctItem) };
}

/**
 * Хук: перемішує options один раз на itemId, і якщо це не перший
 * item у цій сесії — гарантує, що correctAnswer не стоїть на тій
 * самій позиції, що й попереднього разу.
 *
 * Перемішування відбувається під час рендеру при зміні itemId (патерн
 * "оновити стан при зміні пропсів"), а не в useEffect: інакше варіанти
 * перемішувались двічі — до і після першого показу — і кнопки "стрибали".
 */
export function useShuffledOptions<T>(
  options: readonly T[],
  correctItem: T,
  itemId: string,
): T[] {
  const [state, setState] = useState<ShuffledState<T>>(() =>
    shuffleFor(options, correctItem, itemId, null),
  );

  if (state.itemId !== itemId) {
    const next = shuffleFor(options, correctItem, itemId, state.correctIndex);
    setState(next);
    return next.shuffled;
  }

  return state.shuffled;
}