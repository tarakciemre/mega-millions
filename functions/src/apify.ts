import * as functions from "firebase-functions";

const APIFY_ACTOR_ID = "harvest~mega-millions-lottery-past-winning-numbers";
const APIFY_BASE_URL = "https://api.apify.com/v2";

// Safety limit: a single-day query should return at most 1-2 results
const MAX_RESULTS = 5;

export interface ApifyDrawResult {
  drawDate: string;
  winningNumbers: string;
  megaBall: string;
  megaplier: string;
}

export async function fetchWinningNumbers(
  drawDate: string
): Promise<ApifyDrawResult[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN not set in functions/.env");
  }

  // Validate date format before calling Apify
  if (!/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
    throw new Error(`Invalid date format "${drawDate}", expected YYYY-MM-DD`);
  }

  const url = `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${token}`;

  const input = {
    startDate: drawDate,
    endDate: drawDate,
  };

  functions.logger.info("[Apify] Fetching winning numbers", { drawDate, input });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    functions.logger.error("[Apify] Network error", { error: err });
    throw new Error(`Apify network error: ${err}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    functions.logger.error("[Apify] API error", {
      status: response.status,
      body: errorText,
    });
    throw new Error(`Apify API error (${response.status}): ${errorText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    functions.logger.error("[Apify] Bad JSON response", { error: err });
    throw new Error("Apify returned invalid JSON");
  }

  if (!Array.isArray(data)) {
    functions.logger.error("[Apify] Unexpected response format", { data });
    throw new Error("Apify returned unexpected format");
  }

  // Safety check: if we get way too many results, the date filter didn't work
  if (data.length > MAX_RESULTS) {
    functions.logger.error("[Apify] Too many results — date filter may have failed", {
      drawDate,
      resultCount: data.length,
    });
    throw new Error(
      `Apify returned ${data.length} results for a single-day query (${drawDate}). Aborting to prevent excessive usage.`
    );
  }

  return data as ApifyDrawResult[];
}
