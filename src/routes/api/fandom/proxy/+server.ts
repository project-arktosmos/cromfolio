import type { RequestHandler } from './$types';

/**
 * Proxy endpoint for Fandom images
 * Fandom blocks requests with localhost Referer header, so we proxy images server-side
 */
export const GET: RequestHandler = async ({ url }) => {
	const imageUrl = url.searchParams.get('url');

	if (!imageUrl) {
		return new Response('URL parameter is required', { status: 400 });
	}

	// Only allow proxying from Fandom/Wikia domains
	try {
		const parsedUrl = new URL(imageUrl);
		if (
			!parsedUrl.hostname.endsWith('.nocookie.net') &&
			!parsedUrl.hostname.endsWith('.fandom.com') &&
			!parsedUrl.hostname.endsWith('.wikia.com')
		) {
			return new Response('Only Fandom/Wikia URLs are allowed', { status: 403 });
		}
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	try {
		const response = await fetch(imageUrl, {
			headers: {
				// Don't send any referrer
				'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)'
			}
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
		console.error('[api/fandom/proxy] Error:', error);
		return new Response('Failed to fetch image', { status: 500 });
	}
};
