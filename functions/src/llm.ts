import * as functions from "firebase-functions";
import { getNextDrawDate } from "./winningNumbers";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const EXTRACTION_PROMPT = `This is a Mega Millions lottery ticket. Extract the following as JSON:

{
  "plays": [
    {
      "numbers": [5 white ball numbers as integers, or null if unreadable],
      "megaBall": mega ball number as integer, or null if unreadable
    }
  ],
  "megaplier": true/false/null,
  "drawDate": "YYYY-MM-DD" or null,
  "ticketDate": "YYYY-MM-DD" or null
}

Rules:
- Each play has exactly 5 white ball numbers (1-70) and 1 mega ball (1-25)
- The mega ball is usually the last number, sometimes labeled "MB"
- megaplier is a TICKET-LEVEL option (not per play). Look for "MEGAPLIER YES/NO" or similar printed once on the ticket. It applies to all plays.
- drawDate: The date of the lottery drawing this ticket is for. Look for "DRAW", "DRAWING", or a date near the draw info. This is a Tuesday or Friday.
- ticketDate: The date/time the ticket was printed/purchased. Look for timestamps, "PRINTED ON", or terminal print dates. This is often NOT a Tuesday or Friday.
- These are two DIFFERENT dates. The draw date is when the lottery happens. The ticket date is when the ticket was bought/printed.
- CRITICAL: If a number, mega ball, date, or any value is cut off, obscured, blurry, or not visible in the image, use null. Do NOT guess or hallucinate values. Only extract what you can clearly read.
- If only some numbers in a play are visible, include the visible ones and use null for the rest
- Return ONLY valid JSON, no other text`;

export interface LlmPlay {
  numbers: (number | null)[];
  megaBall: number | null;
}

export interface LlmResult {
  plays: LlmPlay[];
  megaplier: boolean;
  drawDate: string | null;
  ticketDate: string | null;
  rawResponse: string;
}

// Mega Millions draw days: Tuesday (2) and Friday (5)
const DRAW_DAYS = [2, 5];

function isDrawDay(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00Z");
  return DRAW_DAYS.includes(date.getUTCDay());
}

/**
 * Given what the LLM extracted, figure out the best draw date.
 * Priority: explicit drawDate > inferred from ticketDate > null
 */
function resolveDrawDate(
  drawDate: string | null,
  ticketDate: string | null
): { drawDate: string | null; inferred: boolean } {
  // If LLM found an explicit draw date and it's a valid draw day, use it
  if (drawDate && isDrawDay(drawDate)) {
    return { drawDate, inferred: false };
  }

  // If LLM found a draw date but it's not a draw day, correct it
  if (drawDate) {
    return { drawDate: getNextDrawDate(drawDate), inferred: true };
  }

  // No draw date — try to infer from ticket purchase date
  if (ticketDate) {
    // If ticket was purchased on a draw day, assume it's for that day's draw
    // (most tickets are bought before the 10:45 PM ET cutoff)
    if (isDrawDay(ticketDate)) {
      return { drawDate: ticketDate, inferred: true };
    }
    // Otherwise, next draw day after purchase
    return { drawDate: getNextDrawDate(ticketDate), inferred: true };
  }

  return { drawDate: null, inferred: false };
}

export async function llmExtract(imageBase64: string): Promise<LlmResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const mimeType = detectMimeType(imageBase64);
  const dataUri = `data:${mimeType};base64,${imageBase64}`;

  const body = {
    model: "@preset/megamillion-identifier",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUri },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.0,
  };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter failed (${response.status}): ${errorText}`);
  }

  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawResponse = result.choices?.[0]?.message?.content ?? "";
  functions.logger.info("[LLM] Raw response", { rawResponse });

  const parsed = parseJsonResponse(rawResponse);

  const resolved = resolveDrawDate(
    parsed.drawDate ?? null,
    parsed.ticketDate ?? null
  );

  if (resolved.inferred) {
    functions.logger.info("[LLM] Inferred draw date", {
      llmDrawDate: parsed.drawDate,
      llmTicketDate: parsed.ticketDate,
      resolvedDrawDate: resolved.drawDate,
    });
  }

  return {
    plays: parsed.plays ?? [],
    megaplier: parsed.megaplier ?? false,
    drawDate: resolved.drawDate,
    ticketDate: parsed.ticketDate ?? null,
    rawResponse,
  };
}

interface ParsedLlmResponse {
  plays?: LlmPlay[];
  megaplier?: boolean | null;
  drawDate?: string | null;
  ticketDate?: string | null;
}

function parseJsonResponse(text: string): ParsedLlmResponse {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Give up
      }
    }
    return {};
  }
}

function detectMimeType(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}
