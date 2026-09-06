export type GameStatus = "available" | "coming_soon";

export interface GameConfig {
  id: string;
  title: string;
  description: string;
  isFree: boolean;
  priceStars?: number;
  status: GameStatus;
}

export interface GameResult {
  score: number;
  wordsLearned: string[];
  /** Кількість спроб/ходів — опційно, заповнюють ігри типу "пари", "вікторина" тощо. */
  moves?: number;
  /** Час проходження партії в мілісекундах. */
  timeMs?: number;
  /** Влучність у відсотках (0-100), якщо гра може її порахувати. */
  accuracy?: number;
}

export interface GameProps {
  onFinish: (result: GameResult) => void;
}
