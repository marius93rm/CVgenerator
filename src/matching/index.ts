export type MatchResult = {
  score: number;
  reasons: string[];
  evidenceIds: string[];
};

export function createEmptyMatchResult(): MatchResult {
  return {
    score: 0,
    reasons: [],
    evidenceIds: [],
  };
}
