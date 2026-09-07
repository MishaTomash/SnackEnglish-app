export type DuelStatus = "available" | "coming_soon";

export interface DuelConfig {
  id: string;
  title: string;
  description: string;
  status: DuelStatus;
}

export interface OpponentState {
  nickname: string;
  avatar: string | null;
  level: string | null;
  score: number;
  lastAction?: any;
  connected: boolean;
}

export interface DuelGameProps {
  roomId: string;
  myScore: number;
  opponentState: OpponentState;
  roundData: any;
  roundResult?: any;
  onSubmitAction: (actionData: any) => void;
}
