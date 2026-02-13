import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import type { RequestHandler } from './$types';
import {
	EXAMPLE_TICKETS_DIR,
	LLM_CACHE_PATH,
	SCAN_EMULATOR_URL,
	IMAGE_EXTENSIONS
} from '$lib/server/paths';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readCache(): Record<string, any> {
	try {
		if (fs.existsSync(LLM_CACHE_PATH)) {
			return JSON.parse(fs.readFileSync(LLM_CACHE_PATH, 'utf-8'));
		}
	} catch {
		// ignore
	}
	return {};
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { filename, force } = body as {
		filename?: string;
		force?: boolean;
	};

	if (!filename) {
		return json({ error: 'Missing filename' }, { status: 400 });
	}

	// Security: prevent path traversal
	const safeName = path.basename(filename);
	const ext = path.extname(safeName).toLowerCase();
	if (!IMAGE_EXTENSIONS.has(ext)) {
		return json({ error: 'Invalid file type' }, { status: 400 });
	}

	const filePath = path.join(EXAMPLE_TICKETS_DIR, safeName);
	if (!fs.existsSync(filePath)) {
		return json({ error: 'File not found' }, { status: 404 });
	}

	// Check cache first (unless force re-scan)
	const cache = readCache();
	if (!force && cache[safeName]) {
		return json({ data: cache[safeName], cached: true });
	}

	// Read image and convert to base64
	const imageBuffer = fs.readFileSync(filePath);
	const imageBase64 = imageBuffer.toString('base64');

	// Call the Firebase emulator
	try {
		const response = await fetch(SCAN_EMULATOR_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: { imageBase64 } })
		});

		if (!response.ok) {
			const errorText = await response.text();
			return json(
				{ error: `Emulator returned ${response.status}: ${errorText}` },
				{ status: 502 }
			);
		}

		const result = await response.json();
		const scanResult = result.result;

		// Cache the structured result
		if (scanResult) {
			cache[safeName] = scanResult;
			fs.writeFileSync(LLM_CACHE_PATH, JSON.stringify(cache, null, 2));
		}

		return json({ data: scanResult, cached: false });
	} catch (err) {
		return json(
			{
				error: `Failed to reach emulator: ${err instanceof Error ? err.message : err}`
			},
			{ status: 502 }
		);
	}
};
