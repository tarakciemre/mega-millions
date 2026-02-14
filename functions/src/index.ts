import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { llmExtract } from "./llm";
import { getWinningNumbersForDate, getDrawDatesInRange } from "./winningNumbers";
import { checkMatch, MatchResult } from "./prizeCalculator";
import { checkWinningsSchema } from "./validation";
import { fetchJackpotPage } from "./apify";

admin.initializeApp();

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

      const plays = llmResult.plays.map((p) => ({
        numbers: p.numbers.map((n) =>
          Number.isInteger(n) && n! >= 1 && n! <= 70 ? n : null
        ),
        megaBall:
          Number.isInteger(p.megaBall) && p.megaBall! >= 1 && p.megaBall! <= 25
            ? p.megaBall
            : null,
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

function validateCheckWinningsInput(data: unknown) {
  const result = checkWinningsSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    throw new functions.https.HttpsError("invalid-argument", messages);
  }
  return result.data;
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

// ─── backfillWinningNumbers (daily scheduled) ──────────────────────────────

export const backfillWinningNumbers = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 120,
  })
  .pubsub.schedule("every day 06:00")
  .timeZone("America/New_York")
  .onRun(async () => {
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
    const drawDates = getDrawDatesInRange(toDateStr(twoWeeksAgo), toDateStr(today));

    if (drawDates.length === 0) {
      functions.logger.info("[backfill] No draw dates in range");
      return;
    }

    // Batch-check which dates already exist in Firestore
    const db = admin.firestore();
    const refs = drawDates.map((d) => db.collection("winning_numbers").doc(d));
    const snapshots = await db.getAll(...refs);

    const existing = new Set<string>();
    for (const snap of snapshots) {
      if (snap.exists) existing.add(snap.id);
    }

    const missing = drawDates.filter((d) => !existing.has(d));

    if (missing.length === 0) {
      functions.logger.info("[backfill] All draw dates already cached", {
        drawDates,
      });
      return;
    }

    functions.logger.info("[backfill] Fetching missing dates", {
      missing,
      alreadyCached: drawDates.length - missing.length,
    });

    for (const date of missing) {
      try {
        await getWinningNumbersForDate(date);
        functions.logger.info("[backfill] Fetched", { date });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        functions.logger.error("[backfill] Failed to fetch", {
          date,
          error: message,
        });
      }
    }
  });

// ─── fetchJackpot (hourly scheduled) ───────────────────────────────────────

export const fetchJackpot = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 300,
  })
  .pubsub.schedule("every 4 hours")
  .timeZone("America/New_York")
  .onRun(async () => {
    try {
      const info = await fetchJackpotPage();

      const db = admin.firestore();
      await db.collection("jackpot").doc("current").set({
        jackpotAmount: info.jackpotAmount,
        cashOption: info.cashOption,
        nextDrawing: info.nextDrawing,
        updatedAt: new Date().toISOString(),
      });

      functions.logger.info("[fetchJackpot] Updated jackpot info", info);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      functions.logger.error("[fetchJackpot] Failed", { error: message });
    }
  });
