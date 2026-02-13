export interface MatchResult {
  playIndex: number;
  numbers: number[];
  megaBall: number;
  matchedNumbers: number[];
  megaBallMatch: boolean;
  tier: string;
  prize: string;
  prizeAmount: number;
}

// Prize tiers: [whiteMatches, megaBallMatch] → [tier, baseAmount]
const PRIZE_TABLE: [number, boolean, string, number][] = [
  [5, true, "Jackpot", 0],
  [5, false, "Match 5", 1_000_000],
  [4, true, "Match 4+MB", 10_000],
  [4, false, "Match 4", 500],
  [3, true, "Match 3+MB", 200],
  [3, false, "Match 3", 10],
  [2, true, "Match 2+MB", 10],
  [1, true, "Match 1+MB", 4],
  [0, true, "MB Only", 2],
];

export function checkMatch(
  playNumbers: number[],
  playMegaBall: number,
  winningNumbers: number[],
  winningMegaBall: number,
  hasMegaplier: boolean,
  megaplierValue: number
): MatchResult {
  const matchedNumbers = playNumbers.filter((n) =>
    winningNumbers.includes(n)
  );
  const megaBallMatch = playMegaBall === winningMegaBall;
  const whiteMatches = matchedNumbers.length;

  let tier = "No Prize";
  let prizeAmount = 0;

  for (const [whites, mb, t, base] of PRIZE_TABLE) {
    if (whiteMatches === whites && megaBallMatch === mb) {
      tier = t;
      prizeAmount = base;
      break;
    }
  }

  // Megaplier multiplies non-jackpot prizes
  if (hasMegaplier && prizeAmount > 0 && tier !== "Jackpot") {
    prizeAmount *= megaplierValue;
  }

  let prize: string;
  if (tier === "Jackpot") {
    prize = "JACKPOT";
  } else if (prizeAmount > 0) {
    prize = `$${prizeAmount.toLocaleString("en-US")}`;
  } else {
    prize = "No Prize";
  }

  return {
    playIndex: 0,
    numbers: playNumbers,
    megaBall: playMegaBall,
    matchedNumbers,
    megaBallMatch,
    tier,
    prize,
    prizeAmount,
  };
}
