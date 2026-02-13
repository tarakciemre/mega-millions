import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';
import {
	EXAMPLE_TICKETS_DIR,
	LLM_CACHE_PATH,
	IMAGE_EXTENSIONS
} from '$lib/server/paths';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJsonCache(filePath: string): Record<string, any> {
	try {
		if (fs.existsSync(filePath)) {
			return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		}
	} catch {
		// Cache file might not exist yet
	}
	return {};
}

export const load: PageServerLoad = async () => {
	// Read image files
	let files: string[] = [];
	try {
		const allFiles = fs.readdirSync(EXAMPLE_TICKETS_DIR);
		files = allFiles
			.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
			.sort();
	} catch {
		return { tickets: [], error: 'Cannot read tickets directory' };
	}

	// Read LLM cache (structured results from OpenRouter)
	const llmCache = readJsonCache(LLM_CACHE_PATH);

	// Build ticket data
	const tickets = files.map((filename) => {
		const cachedData = llmCache[filename] ?? null;

		return {
			filename,
			imageUrl: `/api/tickets/image?f=${encodeURIComponent(filename)}`,
			data: cachedData,
			hasCachedData: cachedData !== null
		};
	});

	return { tickets };
};
