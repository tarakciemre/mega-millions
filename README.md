# Mega Millions Ticket Scanner

A two-stage ticket scanner that uses LLM-based OCR to extract Mega Millions lottery plays from ticket images, then checks them against winning numbers fetched from Apify and cached in Firestore.

## Architecture

```
[Ticket Image] → scanTicket (OpenRouter LLM) → extracted plays + draw date
                                                        ↓
                                          [User reviews & edits in dashboard]
                                                        ↓
[Confirmed data] → checkWinnings → Apify (winning numbers) → Firestore cache → prize calculation
```

### Firebase Functions

**`scanTicket`** — LLM-based ticket extraction
- Input: `{ imageBase64: string }`
- Calls OpenRouter with `@preset/megamillion-identifier` model
- Extracts plays (numbers + mega ball), megaplier, draw date, ticket purchase date
- Auto-infers draw date from ticket purchase date if not explicitly found (next Tuesday or Friday)
- Returns: `{ plays, megaplier, drawDate, ticketDate, rawResponse }`

**`checkWinnings`** — Winning number lookup + prize calculation
- Input: `{ plays: { numbers: number[], megaBall: number }[], megaplier: boolean, drawDate: string }`
- Looks up winning numbers: Firestore cache → Apify fallback
- Auto-corrects non-draw dates to next Tuesday/Friday
- Returns `"not_yet_drawn"` for future draw dates
- Calculates prize tier per play with megaplier multiplication
- Returns: `{ status, drawDate, winningNumbers, winningMegaBall, megaplierValue, matches }`

### Prize Tiers

| Match | Base Prize | With Megaplier (2x-5x) |
|-------|-----------|----------------------|
| 5 + MB | Jackpot | Jackpot (no multiply) |
| 5 | $1,000,000 | $2M - $5M |
| 4 + MB | $10,000 | $20K - $50K |
| 4 | $500 | $1K - $2.5K |
| 3 + MB | $200 | $400 - $1K |
| 3 | $10 | $20 - $50 |
| 2 + MB | $10 | $20 - $50 |
| 1 + MB | $4 | $8 - $20 |
| MB only | $2 | $4 - $10 |

### Draw Date Logic

Mega Millions draws happen on **Tuesdays and Fridays** at 11 PM ET.

1. LLM tries to extract both `drawDate` (the actual draw) and `ticketDate` (purchase/print date)
2. If `drawDate` is found and falls on a Tue/Fri → use it
3. If `drawDate` is found but not a Tue/Fri → correct to next Tue/Fri
4. If only `ticketDate` found on a Tue/Fri → assume same-day draw
5. If only `ticketDate` found on another day → next Tue/Fri
6. User can always manually edit the date before checking

## Project Structure

```
mega-millions/
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts              # scanTicket + checkWinnings functions
│   │   ├── llm.ts                # OpenRouter LLM extraction
│   │   ├── apify.ts              # Apify API client
│   │   ├── winningNumbers.ts     # Firestore cache + draw date logic
│   │   └── prizeCalculator.ts    # Prize tier matching
│   ├── example_tickets/          # Sample ticket images for testing
│   ├── .env                      # OPENROUTER_API_KEY, APIFY_TOKEN
│   ├── package.json
│   └── tsconfig.json
├── dashboard/                    # SvelteKit dashboard
│   ├── src/
│   │   ├── lib/
│   │   │   ├── types.ts          # Shared TypeScript interfaces
│   │   │   └── server/paths.ts   # Emulator URLs & file paths
│   │   └── routes/
│   │       ├── +page.svelte      # Main dashboard UI
│   │       ├── +page.server.ts   # SSR data loading
│   │       └── api/
│   │           ├── scan/         # POST → scanTicket emulator
│   │           ├── check-winnings/ # POST → checkWinnings emulator
│   │           └── tickets/      # GET ticket list + images
│   └── package.json
├── firebase.json                 # Functions + Firestore + emulator config
├── firestore.rules               # Firestore security rules
└── firestore.indexes.json
```

## Setup

### Prerequisites

- Node.js 22+
- Firebase CLI (`npm i -g firebase-tools`)

### Environment Variables

Create `functions/.env`:

```
OPENROUTER_API_KEY=sk-or-v1-...
APIFY_TOKEN=apify_api_...
```

- **OpenRouter API key**: Get from [openrouter.ai](https://openrouter.ai)
- **Apify token**: Get from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations)

### Install Dependencies

```bash
cd functions && npm install
cd ../dashboard && npm install
```

### Running Locally

**Start Firebase emulators** (functions + firestore):

```bash
firebase emulators:start --only functions,firestore
```

This starts:
- Functions emulator at `http://127.0.0.1:5001`
- Firestore emulator at `http://127.0.0.1:8080`
- Emulator UI at `http://127.0.0.1:4000`

**Start the dashboard** (in a separate terminal):

```bash
cd dashboard && npm run dev
```

Dashboard runs at `http://localhost:5173`

### Build

```bash
cd functions && npm run build    # TypeScript → lib/
cd dashboard && npm run build    # SvelteKit production build
```

## Dashboard Usage

1. **Scan** — Click "Scan" on a ticket image (or "Scan All" for batch). The LLM extracts plays, megaplier, and dates.
2. **Review & Edit** — Check the extracted numbers, mega ball, draw date, and megaplier toggle. Edit anything the LLM got wrong.
3. **Confirm & Check** — Click "Confirm & Check" to look up winning numbers and see results. Matched balls are highlighted green, with prize badges per play.

## API (Callable Functions)

### scanTicket

```bash
curl -X POST http://127.0.0.1:5001/mega-millions-fb/us-central1/scanTicket \
  -H "Content-Type: application/json" \
  -d '{"data": {"imageBase64": "<base64-encoded-image>"}}'
```

Response:
```json
{
  "result": {
    "plays": [
      { "numbers": [10, 23, 45, 56, 67], "megaBall": 12 }
    ],
    "megaplier": true,
    "drawDate": "2025-01-31",
    "ticketDate": "2025-01-30",
    "rawResponse": "..."
  }
}
```

### checkWinnings

```bash
curl -X POST http://127.0.0.1:5001/mega-millions-fb/us-central1/checkWinnings \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "plays": [{"numbers": [10, 23, 45, 56, 67], "megaBall": 12}],
      "megaplier": true,
      "drawDate": "2025-01-31"
    }
  }'
```

Response (found):
```json
{
  "result": {
    "status": "found",
    "drawDate": "2025-01-31",
    "originalDate": "2025-01-31",
    "corrected": false,
    "winningNumbers": [10, 19, 31, 47, 56],
    "winningMegaBall": 6,
    "megaplierValue": 5,
    "matches": [
      {
        "playIndex": 0,
        "numbers": [10, 23, 45, 56, 67],
        "megaBall": 12,
        "matchedNumbers": [10, 56],
        "megaBallMatch": false,
        "tier": "No Prize",
        "prize": "No Prize",
        "prizeAmount": 0
      }
    ]
  }
}
```

Response (future draw):
```json
{
  "result": {
    "status": "not_yet_drawn",
    "drawDate": "2026-02-17",
    "originalDate": "2026-02-15",
    "corrected": true,
    "message": "Draw on 2026-02-17 hasn't happened yet."
  }
}
```

## Winning Numbers Source

Winning numbers are fetched from the [Mega Millions Lottery Past Winning Numbers](https://apify.com/harvest/mega-millions-lottery-past-winning-numbers) Apify actor and cached in Firestore under `winning_numbers/{YYYY-MM-DD}`.

Safety limits are in place:
- Date format validation before calling Apify
- Max 5 results per query (single-day queries should return 1)
- Future dates are rejected without calling Apify
