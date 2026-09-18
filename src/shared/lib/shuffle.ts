import { useEffect, useRef, useState } from "react";

/** Класичний Fisher-Yates. Не мутує вхідний масив. */
export const shuffle = <T>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Те саме, але якщо правильна відповідь випала на ту саму позицію,
 * що й у попередньому питанні (avoidIndex), міняємо її місцем з
 * випадковим сусідом. Для масивів < 2 елементів — просто shuffle.
 */
export const shuffleAvoidingIndex = <T>(
  arr: readonly T[],
  correctItem: T,
  avoidIndex: number | null,
): T[] => {
  const result = shuffle(arr);
  if (arr.length < 2 || avoidIndex === null) return result;

  const idx = result.indexOf(correctItem);
  if (idx === -1 || idx !== avoidIndex) return result;

  // Вибираємо випадковий ІНШИЙ індекс і міняємось місцями
  const candidates = result.map((_, i) => i).filter((i) => i !== idx);
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  [result[idx], result[target]] = [result[target], result[idx]];
  return result;
};

/**
 * Хук: перемішує options один раз на itemId, і якщо це не перший
 * item у цій сесії — гарантує, що correctAnswer не стоїть на тій
 * самій позиції, що й попереднього разу.
 */
export const useShuffledOptions = <T>(
  options: readonly T[],
  correctItem: T,
  itemId: string,
): T[] => {
  const lastCorrectIndexRef = useRef<number | null>(null);
  const [shuffled, setShuffled] = useState<T[]>(() =>
    shuffleAvoidingIndex(options, correctItem, null),
  );

  useEffect(() => {
    const next = shuffleAvoidingIndex(
      options,
      correctItem,
      lastCorrectIndexRef.current,
    );
    lastCorrectIndexRef.current = next.indexOf(correctItem);
    setShuffled(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  return shuffled;
};
