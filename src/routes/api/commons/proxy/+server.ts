import type { RequestHandler } from './$types';

/**
 * Proxy endpoint for Wikimedia Commons images
 * Fetches images server-side to avoid CORS/CSP issues in Tauri
 */
export const GET: RequestHandler = async ({ url }) => {
	const filename = url.searchParams.get('filename');
	const width = url.searchParams.get('width') || '300';

	if (!filename) {
		return new Response('filename parameter is required', { status: 400 });
	}

	// Build the Commons Special:FilePath URL
	const encodedFilename = encodeURIComponent(filename.replace(/ /g, '_'));
	const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}?width=${width}`;

	try {
		const response = await fetch(commonsUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)'
			},
			redirect: 'follow'
		});

		if (!response.ok) {
			return new Response(`Failed to fetch image: ${response.status}`, { status: response.status });
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		const buffer = await response.arrayBuffer();

		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
			}
		});
	} catch (error) {
		console.error('[api/commons/proxy] Error:', error);
		return new Response('Failed to fetch image', { status: 500 });
	}
};
