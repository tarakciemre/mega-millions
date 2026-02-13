import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import type { RequestHandler } from './$types';
import { EXAMPLE_TICKETS_DIR, LLM_CACHE_PATH, IMAGE_EXTENSIONS } from '$lib/server/paths';

export const GET: RequestHandler = async () => {
	// Read image files from the example_tickets directory
	let files: string[] = [];
	try {
		const allFiles = fs.readdirSync(EXAMPLE_TICKETS_DIR);
		files = allFiles
			.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
			.sort();
	} catch (err) {
		return json({ error: `Cannot read tickets directory: ${err}` }, { status: 500 });
	}

	// Read LLM cache
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let llmCache: Record<string, any> = {};
	try {
		if (fs.existsSync(LLM_CACHE_PATH)) {
			llmCache = JSON.parse(fs.readFileSync(LLM_CACHE_PATH, 'utf-8'));
		}
	} catch {
		// Cache file might not exist yet
	}

	// Build ticket data for each file
	const tickets = files.map((filename) => {
		const data = llmCache[filename] ?? null;
		return {
			filename,
			imageUrl: `/api/tickets/image?f=${encodeURIComponent(filename)}`,
			data,
			hasCachedData: data !== null
		};
	});

	return json({ tickets });
};
