export interface DuelGameState {
  scores: Record<string, number>;
  currentRound: number;
  isOver: boolean;
  customData: any;
}

export interface DuelGameAdapter {
  generateRound(levelOfBothPlayers: (string | null)[]): Promise<any> | any;

  submitAnswer(
    playerId: string,
    answer: any,
    serverTimestamp: number,
    currentState: DuelGameState,
  ): {
    isCorrect: boolean;
    scoreDelta: number;
    roundFinished: boolean;
    newState: DuelGameState;
  };

  isMatchOver(state: DuelGameState): boolean;
}
