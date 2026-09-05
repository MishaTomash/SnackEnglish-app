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
}

export interface GameProps {
  onFinish: (result: GameResult) => void;
}
