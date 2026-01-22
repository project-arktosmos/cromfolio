import type { RequestHandler } from './$types';

/**
 * General image proxy endpoint
 * Fetches images server-side to avoid CORS issues with Three.js textures
 */
export const GET: RequestHandler = async ({ url }) => {
	const imageUrl = url.searchParams.get('url');

	if (!imageUrl) {
		return new Response('url parameter is required', { status: 400 });
	}

	// Validate it's actually a URL
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(imageUrl);
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	// Only allow http/https protocols
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
		return new Response('Only HTTP/HTTPS URLs are allowed', { status: 400 });
	}

	try {
		const response = await fetch(imageUrl, {
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
				'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('[api/image-proxy] Error:', error);
		return new Response('Failed to fetch image', { status: 500 });
	}
};
