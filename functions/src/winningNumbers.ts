import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { fetchWinningNumbers } from "./apify";

export interface WinningNumbersDoc {
  numbers: number[];
  megaBall: number;
  megaplier: number;
  drawDate: string;
  fetchedAt: string;
}

// Mega Millions draws happen on Tuesday (2) and Friday (5)
const DRAW_DAYS = [2, 5]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

/**
 * Given any date, find the next Mega Millions draw date (Tue or Fri)
 * on or after the given date.
 */
export function getNextDrawDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid timezone issues
  const dow = date.getUTCDay();

  if (DRAW_DAYS.includes(dow)) {
    return dateStr; // already a draw day
  }

  // Find days until next Tue or Fri
  let minDays = 7;
  for (const drawDay of DRAW_DAYS) {
    const diff = (drawDay - dow + 7) % 7;
    if (diff > 0 && diff < minDays) minDays = diff;
  }

  date.setUTCDate(date.getUTCDate() + minDays);
  return date.toISOString().slice(0, 10);
}

function isDrawDay(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00Z");
  return DRAW_DAYS.includes(date.getUTCDay());
}

function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T12:00:00Z");
  return target > today;
}

export interface LookupResult {
  status: "found" | "not_yet_drawn";
  drawDate: string;
  originalDate: string;
  corrected: boolean;
  doc: WinningNumbersDoc | null;
}

export async function getWinningNumbersForDate(
  inputDate: string
): Promise<LookupResult> {
  const drawDate = isDrawDay(inputDate) ? inputDate : getNextDrawDate(inputDate);
  const corrected = drawDate !== inputDate;

  if (corrected) {
    functions.logger.info("[WinningNumbers] Corrected to next draw date", {
      inputDate,
      drawDate,
    });
  }

  // If the draw hasn't happened yet, no point calling Apify
  if (isFutureDate(drawDate)) {
    functions.logger.info("[WinningNumbers] Draw date is in the future", { drawDate });
    return {
      status: "not_yet_drawn",
      drawDate,
      originalDate: inputDate,
      corrected,
      doc: null,
    };
  }

  const db = admin.firestore();
  const docRef = db.collection("winning_numbers").doc(drawDate);

  // Check Firestore cache
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    functions.logger.info("[WinningNumbers] Cache hit", { drawDate });
    return {
      status: "found",
      drawDate,
      originalDate: inputDate,
      corrected,
      doc: docSnap.data() as WinningNumbersDoc,
    };
  }

  // Cache miss — fetch from Apify
  functions.logger.info("[WinningNumbers] Cache miss, fetching from Apify", {
    drawDate,
  });

  const results = await fetchWinningNumbers(drawDate);

  if (results.length === 0) {
    throw new Error(
      `No draw found for ${drawDate}. Mega Millions draws are only on Tuesdays and Fridays.`
    );
  }

  const result = results[0];

  const numbers = result.winningNumbers
    .split(/[-\s,]+/)
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n));

  const megaBall = parseInt(result.megaBall, 10);
  const megaplier = parseInt(result.megaplier, 10) || 1;

  if (numbers.length !== 5 || isNaN(megaBall)) {
    throw new Error(
      `Failed to parse Apify result for ${drawDate}: got ${JSON.stringify(result)}`
    );
  }

  const winningDoc: WinningNumbersDoc = {
    numbers,
    megaBall,
    megaplier,
    drawDate,
    fetchedAt: new Date().toISOString(),
  };

  // Write to Firestore cache
  await docRef.set(winningDoc);
  functions.logger.info("[WinningNumbers] Cached in Firestore", { drawDate });

  return {
    status: "found",
    drawDate,
    originalDate: inputDate,
    corrected,
    doc: winningDoc,
  };
}
