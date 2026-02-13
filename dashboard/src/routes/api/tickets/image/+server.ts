import fs from 'fs';
import path from 'path';
import type { RequestHandler } from './$types';
import { EXAMPLE_TICKETS_DIR, IMAGE_EXTENSIONS } from '$lib/server/paths';

const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.gif': 'image/gif'
};

export const GET: RequestHandler = async ({ url }) => {
	const filename = url.searchParams.get('f');

	if (!filename) {
		return new Response('Missing filename parameter', { status: 400 });
	}

	// Security: prevent path traversal
	const safeName = path.basename(filename);
	const ext = path.extname(safeName).toLowerCase();

	if (!IMAGE_EXTENSIONS.has(ext)) {
		return new Response('Invalid file type', { status: 400 });
	}

	const filePath = path.join(EXAMPLE_TICKETS_DIR, safeName);

	if (!fs.existsSync(filePath)) {
		return new Response('File not found', { status: 404 });
	}

	const data = fs.readFileSync(filePath);
	const contentType = MIME_TYPES[ext] || 'application/octet-stream';

	return new Response(data, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
