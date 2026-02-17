import { checkWinningsSchema } from "../validation";

const validInput = {
  plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10 }],
  drawDate: "2025-01-31",
};

describe("checkWinningsSchema — valid inputs", () => {
  it("accepts a valid single-play input", () => {
    const result = checkWinningsSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts multiple plays", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [
        { numbers: [1, 2, 3, 4, 5], megaBall: 10 },
        { numbers: [6, 7, 8, 9, 10], megaBall: 24 },
        { numbers: [11, 22, 33, 44, 55], megaBall: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts boundary white ball values (1 and 70)", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 70], megaBall: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts boundary mega ball values (1 and 24)", () => {
    const mb1 = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 1 }],
    });
    const mb24 = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 24 }],
    });
    expect(mb1.success).toBe(true);
    expect(mb24.success).toBe(true);
  });

  it("accepts per-play megaplier value", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10, megaplier: 3 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null megaplier per play", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10, megaplier: null }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts play without megaplier field", () => {
    const result = checkWinningsSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

describe("checkWinningsSchema — white ball validation", () => {
  it("rejects duplicate white ball numbers", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [5, 5, 3, 4, 6], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });

  it("rejects white ball below 1", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [0, 2, 3, 4, 5], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects white ball above 70", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 71], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer white ball", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1.5, 2, 3, 4, 5], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 5 numbers", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 numbers", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5, 6], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative white ball", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [-1, 2, 3, 4, 5], megaBall: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkWinningsSchema — mega ball validation", () => {
  it("rejects mega ball below 1", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects mega ball above 24", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 26 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer mega ball", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkWinningsSchema — plays array validation", () => {
  it("rejects empty plays array", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing plays", () => {
    const result = checkWinningsSchema.safeParse({
          drawDate: "2025-01-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 plays", () => {
    const plays = Array.from({ length: 21 }, (_, i) => ({
      numbers: [1, 2, 3, 4, (i % 66) + 5],
      megaBall: 10,
    }));
    const result = checkWinningsSchema.safeParse({ ...validInput, plays });
    expect(result.success).toBe(false);
  });
});

describe("checkWinningsSchema — drawDate validation", () => {
  it("rejects missing drawDate", () => {
    const result = checkWinningsSchema.safeParse({
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10 }],
        });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (MM/DD/YYYY)", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      drawDate: "01/31/2025",
    });
    expect(result.success).toBe(false);
  });

  it("rejects date with extra characters", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      drawDate: "2025-01-31T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string drawDate", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      drawDate: 20250131,
    });
    expect(result.success).toBe(false);
  });
});

describe("checkWinningsSchema — per-play megaplier validation", () => {
  it.each([2, 3, 4, 5, 10])("accepts valid megaplier %d", (val) => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10, megaplier: val }],
    });
    expect(result.success).toBe(true);
  });

  it.each([0, 1, 6, 7, 8, 9, 11])("rejects invalid megaplier %d", (val) => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10, megaplier: val }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer megaplier", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [1, 2, 3, 4, 5], megaBall: 10, megaplier: 2.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkWinningsSchema — multiple validation errors", () => {
  it("reports errors for multiple invalid plays", () => {
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [
        { numbers: [0, 2, 3, 4, 5], megaBall: 10 },     // ball 0 out of range
        { numbers: [1, 1, 3, 4, 5], megaBall: 10 },      // duplicate
        { numbers: [1, 2, 3, 4, 5], megaBall: 30 },      // MB out of range
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("same number appearing in mega ball and white balls is OK", () => {
    // The mega ball is drawn from a separate pool, so it CAN match a white ball number
    const result = checkWinningsSchema.safeParse({
      ...validInput,
      plays: [{ numbers: [10, 20, 30, 40, 50], megaBall: 10 }],
    });
    expect(result.success).toBe(true);
  });
});
