import { checkMatch } from "../prizeCalculator";

// Fixed winning numbers for all tests
const WIN = [10, 20, 30, 40, 50]; // winning white balls
const WIN_MB = 15; // winning mega ball

describe("checkMatch — prize tiers", () => {
  // ─── Tier 1: 5 + MB = Jackpot ──────────────────────────────────────────
  describe("Jackpot (5 + MB)", () => {
    it("returns Jackpot when all 5 numbers and mega ball match", () => {
      const result = checkMatch([10, 20, 30, 40, 50], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Jackpot");
      expect(result.prize).toBe("JACKPOT");
      expect(result.prizeAmount).toBe(0);
      expect(result.matchedNumbers).toEqual([10, 20, 30, 40, 50]);
      expect(result.megaBallMatch).toBe(true);
    });

    it("Jackpot is NOT multiplied by megaplier", () => {
      const result = checkMatch([10, 20, 30, 40, 50], 15, WIN, WIN_MB, true, 5);
      expect(result.tier).toBe("Jackpot");
      expect(result.prize).toBe("JACKPOT");
      expect(result.prizeAmount).toBe(0);
    });

    it("matches regardless of number order", () => {
      const result = checkMatch([50, 40, 30, 20, 10], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Jackpot");
    });
  });

  // ─── Tier 2: 5 numbers, no MB = $1,000,000 ─────────────────────────────
  describe("Match 5 (no MB) — $1,000,000", () => {
    it("returns $1,000,000 base prize", () => {
      const result = checkMatch([10, 20, 30, 40, 50], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 5");
      expect(result.prizeAmount).toBe(1_000_000);
      expect(result.prize).toBe("$1,000,000");
      expect(result.megaBallMatch).toBe(false);
    });

    it.each([
      [2, 2_000_000],
      [3, 3_000_000],
      [4, 4_000_000],
      [5, 5_000_000],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 30, 40, 50], 1, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 3: 4 + MB = $10,000 ──────────────────────────────────────────
  describe("Match 4+MB — $10,000", () => {
    it("returns $10,000 base prize", () => {
      const result = checkMatch([10, 20, 30, 40, 99], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 4+MB");
      expect(result.prizeAmount).toBe(10_000);
      expect(result.matchedNumbers.length).toBe(4);
      expect(result.megaBallMatch).toBe(true);
    });

    it.each([
      [2, 20_000],
      [3, 30_000],
      [4, 40_000],
      [5, 50_000],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 30, 40, 99], 15, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 4: 4, no MB = $500 ───────────────────────────────────────────
  describe("Match 4 (no MB) — $500", () => {
    it("returns $500 base prize", () => {
      const result = checkMatch([10, 20, 30, 40, 99], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 4");
      expect(result.prizeAmount).toBe(500);
      expect(result.matchedNumbers.length).toBe(4);
      expect(result.megaBallMatch).toBe(false);
    });

    it.each([
      [2, 1_000],
      [3, 1_500],
      [4, 2_000],
      [5, 2_500],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 30, 40, 99], 1, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 5: 3 + MB = $200 ─────────────────────────────────────────────
  describe("Match 3+MB — $200", () => {
    it("returns $200 base prize", () => {
      const result = checkMatch([10, 20, 30, 88, 99], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 3+MB");
      expect(result.prizeAmount).toBe(200);
      expect(result.matchedNumbers.length).toBe(3);
      expect(result.megaBallMatch).toBe(true);
    });

    it.each([
      [2, 400],
      [3, 600],
      [4, 800],
      [5, 1_000],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 30, 88, 99], 15, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 6: 3, no MB = $10 ────────────────────────────────────────────
  describe("Match 3 (no MB) — $10", () => {
    it("returns $10 base prize", () => {
      const result = checkMatch([10, 20, 30, 88, 99], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 3");
      expect(result.prizeAmount).toBe(10);
    });

    it.each([
      [2, 20],
      [3, 30],
      [4, 40],
      [5, 50],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 30, 88, 99], 1, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 7: 2 + MB = $10 ──────────────────────────────────────────────
  describe("Match 2+MB — $10", () => {
    it("returns $10 base prize", () => {
      const result = checkMatch([10, 20, 77, 88, 99], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 2+MB");
      expect(result.prizeAmount).toBe(10);
      expect(result.matchedNumbers.length).toBe(2);
      expect(result.megaBallMatch).toBe(true);
    });

    it.each([
      [2, 20],
      [3, 30],
      [4, 40],
      [5, 50],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 20, 77, 88, 99], 15, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 8: 1 + MB = $4 ───────────────────────────────────────────────
  describe("Match 1+MB — $4", () => {
    it("returns $4 base prize", () => {
      const result = checkMatch([10, 66, 77, 88, 99], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("Match 1+MB");
      expect(result.prizeAmount).toBe(4);
      expect(result.matchedNumbers.length).toBe(1);
      expect(result.megaBallMatch).toBe(true);
    });

    it.each([
      [2, 8],
      [3, 12],
      [4, 16],
      [5, 20],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([10, 66, 77, 88, 99], 15, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── Tier 9: 0 + MB = $2 ───────────────────────────────────────────────
  describe("MB Only — $2", () => {
    it("returns $2 base prize", () => {
      const result = checkMatch([1, 2, 3, 4, 5], 15, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("MB Only");
      expect(result.prizeAmount).toBe(2);
      expect(result.matchedNumbers.length).toBe(0);
      expect(result.megaBallMatch).toBe(true);
    });

    it.each([
      [2, 4],
      [3, 6],
      [4, 8],
      [5, 10],
    ])("with %dx megaplier → $%d", (multiplier, expected) => {
      const result = checkMatch([1, 2, 3, 4, 5], 15, WIN, WIN_MB, true, multiplier);
      expect(result.prizeAmount).toBe(expected);
    });
  });

  // ─── No Prize ───────────────────────────────────────────────────────────
  describe("No Prize", () => {
    it("returns No Prize when 0 white matches and no MB", () => {
      const result = checkMatch([1, 2, 3, 4, 5], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("No Prize");
      expect(result.prize).toBe("No Prize");
      expect(result.prizeAmount).toBe(0);
      expect(result.matchedNumbers.length).toBe(0);
      expect(result.megaBallMatch).toBe(false);
    });

    it("returns No Prize for 1 white match, no MB", () => {
      const result = checkMatch([10, 2, 3, 4, 5], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("No Prize");
      expect(result.prizeAmount).toBe(0);
    });

    it("returns No Prize for 2 white matches, no MB", () => {
      const result = checkMatch([10, 20, 3, 4, 5], 1, WIN, WIN_MB, false, 1);
      expect(result.tier).toBe("No Prize");
      expect(result.prizeAmount).toBe(0);
    });

    it("megaplier does not affect No Prize", () => {
      const result = checkMatch([1, 2, 3, 4, 5], 1, WIN, WIN_MB, true, 5);
      expect(result.tier).toBe("No Prize");
      expect(result.prizeAmount).toBe(0);
    });
  });

  // ─── Prize formatting ──────────────────────────────────────────────────
  describe("prize string formatting", () => {
    it("formats large prizes with commas", () => {
      const result = checkMatch([10, 20, 30, 40, 50], 1, WIN, WIN_MB, true, 3);
      expect(result.prize).toBe("$3,000,000");
    });

    it("formats small prizes without commas", () => {
      const result = checkMatch([10, 20, 30, 88, 99], 1, WIN, WIN_MB, false, 1);
      expect(result.prize).toBe("$10");
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("playIndex defaults to 0", () => {
      const result = checkMatch([1, 2, 3, 4, 5], 1, WIN, WIN_MB, false, 1);
      expect(result.playIndex).toBe(0);
    });

    it("returns the original play numbers and mega ball", () => {
      const nums = [10, 22, 33, 44, 55];
      const mb = 7;
      const result = checkMatch(nums, mb, WIN, WIN_MB, false, 1);
      expect(result.numbers).toEqual(nums);
      expect(result.megaBall).toBe(mb);
    });

    it("matchedNumbers contains only the winning numbers that match", () => {
      const result = checkMatch([10, 20, 55, 66, 77], 1, WIN, WIN_MB, false, 1);
      expect(result.matchedNumbers).toEqual(expect.arrayContaining([10, 20]));
      expect(result.matchedNumbers.length).toBe(2);
    });
  });
});
