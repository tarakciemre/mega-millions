import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { llmExtract } from "./llm";
import { getWinningNumbersForDate } from "./winningNumbers";
import { checkMatch, MatchResult } from "./prizeCalculator";

admin.initializeApp();

// ─── Types ──────────────────────────────────────────────────────────────────

interface Play {
  numbers: number[];
  megaBall: number;
}

// ─── Input validation ───────────────────────────────────────────────────────

function validateImageInput(data: unknown): string {
  if (!data || typeof data !== "object" || !("imageBase64" in data)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Request must include imageBase64"
    );
  }
  const { imageBase64 } = data as { imageBase64: string };
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "imageBase64 must be a non-empty string"
    );
  }
  return imageBase64;
}

// ─── scanTicket ─────────────────────────────────────────────────────────────

export const scanTicket = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 60,
  })
  .https.onCall(async (data: unknown) => {
    const imageBase64 = validateImageInput(data);

    try {
      const llmResult = await llmExtract(imageBase64);

      const plays: Play[] = llmResult.plays.map((p) => ({
        numbers: p.numbers,
        megaBall: p.megaBall,
      }));

      if (plays.length === 0) {
        functions.logger.warn("[scanTicket] No plays extracted", {
          rawResponse: llmResult.rawResponse,
        });
      }

      return {
        plays,
        megaplier: llmResult.megaplier,
        drawDate: llmResult.drawDate,
        ticketDate: llmResult.ticketDate,
        rawResponse: llmResult.rawResponse,
      };
    } catch (error) {
      functions.logger.error("[scanTicket] Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to scan ticket: ${error}`
      );
    }
  });

// ─── checkWinnings ──────────────────────────────────────────────────────────

interface CheckWinningsInput {
  plays: { numbers: number[]; megaBall: number }[];
  megaplier: boolean;
  drawDate: string;
}

function validateCheckWinningsInput(data: unknown): CheckWinningsInput {
  if (!data || typeof data !== "object") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Request must include plays, megaplier, and drawDate"
    );
  }

  const { plays, megaplier, drawDate } = data as CheckWinningsInput;

  if (!Array.isArray(plays) || plays.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "plays must be a non-empty array"
    );
  }

  if (typeof drawDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(drawDate)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "drawDate must be a YYYY-MM-DD string"
    );
  }

  return { plays, megaplier: !!megaplier, drawDate: drawDate.slice(0, 10) };
}

export const checkWinnings = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 30,
  })
  .https.onCall(async (data: unknown) => {
    const input = validateCheckWinningsInput(data);

    let lookup;
    try {
      lookup = await getWinningNumbersForDate(input.drawDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      functions.logger.error("[checkWinnings] Failed to get winning numbers", {
        drawDate: input.drawDate,
        error: message,
      });
      throw new functions.https.HttpsError("internal", message);
    }

    // Draw hasn't happened yet
    if (lookup.status === "not_yet_drawn") {
      return {
        status: "not_yet_drawn",
        drawDate: lookup.drawDate,
        originalDate: lookup.originalDate,
        corrected: lookup.corrected,
        message: `Draw on ${lookup.drawDate} hasn't happened yet.`,
      };
    }

    const doc = lookup.doc!;

    const matches: MatchResult[] = input.plays.map((play, i) => {
      const result = checkMatch(
        play.numbers,
        play.megaBall,
        doc.numbers,
        doc.megaBall,
        input.megaplier,
        doc.megaplier
      );
      return { ...result, playIndex: i };
    });

    return {
      status: "found",
      drawDate: lookup.drawDate,
      originalDate: lookup.originalDate,
      corrected: lookup.corrected,
      winningNumbers: doc.numbers,
      winningMegaBall: doc.megaBall,
      megaplierValue: doc.megaplier,
      matches,
    };
  });
