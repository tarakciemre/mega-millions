import { z } from "zod";

// White balls: 1–70, Mega Ball: 1–24
const WHITE_BALL_MIN = 1;
const WHITE_BALL_MAX = 70;
const MEGA_BALL_MIN = 1;
const MEGA_BALL_MAX = 24;
const NUMBERS_PER_PLAY = 5;

const whiteBall = z
  .number()
  .int("White ball must be an integer")
  .min(WHITE_BALL_MIN, `White ball must be at least ${WHITE_BALL_MIN}`)
  .max(WHITE_BALL_MAX, `White ball must be at most ${WHITE_BALL_MAX}`);

const megaBall = z
  .number()
  .int("Mega Ball must be an integer")
  .min(MEGA_BALL_MIN, `Mega Ball must be at least ${MEGA_BALL_MIN}`)
  .max(MEGA_BALL_MAX, `Mega Ball must be at most ${MEGA_BALL_MAX}`);

const megaplierValue = z
  .number()
  .int("Megaplier must be an integer")
  .refine((v) => [2, 3, 4, 5, 10].includes(v), {
    message: "Megaplier must be 2, 3, 4, 5, or 10",
  });

const playSchema = z
  .object({
    numbers: z
      .array(whiteBall)
      .length(NUMBERS_PER_PLAY, `Each play must have exactly ${NUMBERS_PER_PLAY} numbers`),
    megaBall: megaBall,
    megaplier: megaplierValue.nullable().optional(),
  })
  .refine(
    (play) => new Set(play.numbers).size === play.numbers.length,
    { message: "Duplicate white ball numbers are not allowed", path: ["numbers"] }
  );

export const checkWinningsSchema = z.object({
  plays: z
    .array(playSchema)
    .min(1, "At least one play is required")
    .max(20, "Maximum 20 plays per ticket"),
  drawDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "drawDate must be in YYYY-MM-DD format"),
});

export type CheckWinningsInput = z.infer<typeof checkWinningsSchema>;
