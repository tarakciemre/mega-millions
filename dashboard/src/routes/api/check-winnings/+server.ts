import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CHECK_WINNINGS_EMULATOR_URL } from '$lib/server/paths';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { plays, megaplier, drawDate } = body as {
		plays?: { numbers: number[]; megaBall: number }[];
		megaplier?: boolean;
		drawDate?: string;
	};

	if (!plays || !Array.isArray(plays) || plays.length === 0) {
		return json({ error: 'Missing or empty plays array' }, { status: 400 });
	}

	if (!drawDate || typeof drawDate !== 'string') {
		return json({ error: 'Missing drawDate' }, { status: 400 });
	}

	try {
		const response = await fetch(CHECK_WINNINGS_EMULATOR_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: { plays, megaplier: !!megaplier, drawDate } })
		});

		if (!response.ok) {
			const errorText = await response.text();
			return json(
				{ error: `Emulator returned ${response.status}: ${errorText}` },
				{ status: 502 }
			);
		}

		const result = await response.json();
		return json({ data: result.result });
	} catch (err) {
		return json(
			{
				error: `Failed to reach emulator: ${err instanceof Error ? err.message : err}`
			},
			{ status: 502 }
		);
	}
};
