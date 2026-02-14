import { z } from "zod";

// White balls: 1–70, Mega Ball: 1–25
const WHITE_BALL_MIN = 1;
const WHITE_BALL_MAX = 70;
const MEGA_BALL_MIN = 1;
const MEGA_BALL_MAX = 25;
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

const playSchema = z
  .object({
    numbers: z
      .array(whiteBall)
      .length(NUMBERS_PER_PLAY, `Each play must have exactly ${NUMBERS_PER_PLAY} numbers`),
    megaBall: megaBall,
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
  megaplier: z.boolean(),
  drawDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "drawDate must be in YYYY-MM-DD format"),
});

export type CheckWinningsInput = z.infer<typeof checkWinningsSchema>;
