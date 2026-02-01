/**
 * Image Cache Service
 * Interacts with the Tauri image cache backend
 */

import { invoke } from '@tauri-apps/api/core';

export interface CacheCheckResult {
	total: number;
	cached: number;
	missing: number;
	missingUrls: string[];
}

/**
 * Check if a single image URL is cached locally
 * Returns the local path if cached, null otherwise
 */
export async function getCachedImage(url: string): Promise<string | null> {
	try {
		return await invoke<string | null>('get_cached_image', { url });
	} catch (e) {
		console.error('[image-cache.service] getCachedImage:', e);
		return null;
	}
}

/**
 * Check cache status for multiple image URLs
 */
export async function checkCacheStatus(urls: string[]): Promise<CacheCheckResult> {
	const result: CacheCheckResult = {
		total: urls.length,
		cached: 0,
		missing: 0,
		missingUrls: []
	};

	// Check each URL in parallel (batched to avoid overwhelming)
	const batchSize = 50;
	for (let i = 0; i < urls.length; i += batchSize) {
		const batch = urls.slice(i, i + batchSize);
		const checks = await Promise.all(batch.map((url) => getCachedImage(url)));

		checks.forEach((cachedPath, index) => {
			if (cachedPath) {
				result.cached++;
			} else {
				result.missing++;
				result.missingUrls.push(batch[index]);
			}
		});
	}

	return result;
}

export interface BatchCacheProgress {
	total: number;
	completed: number;
	cached: number;
	skipped: number;
	errors: string[];
}

/**
 * Cache multiple images at once
 */
export async function cacheImagesBatch(urls: string[]): Promise<BatchCacheProgress> {
	try {
		return await invoke<BatchCacheProgress>('cache_images_batch', { urls });
	} catch (e) {
		console.error('[image-cache.service] cacheImagesBatch:', e);
		return {
			total: urls.length,
			completed: 0,
			cached: 0,
			skipped: 0,
			errors: [String(e)]
		};
	}
}

// ============================================================================
// BACKGROUND DOWNLOAD
// ============================================================================

export type BackgroundDownloadStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface BackgroundDownloadProgress {
	status: BackgroundDownloadStatus;
	collection_id: string | null;
	collection_title: string | null;
	total: number;
	completed: number;
	cached: number;
	skipped: number;
	failed: number;
	current_url: string | null;
	errors: string[];
	started_at: number | null;
	finished_at: number | null;
}

/**
 * Start a background download for a collection's missing images
 */
export async function startBackgroundDownload(
	urls: string[],
	collectionId: string,
	collectionTitle: string
): Promise<boolean> {
	try {
		return await invoke<boolean>('start_background_download', {
			urls,
			collectionId,
			collectionTitle
		});
	} catch (e) {
		console.error('[image-cache.service] startBackgroundDownload:', e);
		throw e;
	}
}

/**
 * Get the current background download progress
 */
export async function getBackgroundDownloadProgress(): Promise<BackgroundDownloadProgress> {
	try {
		return await invoke<BackgroundDownloadProgress>('get_background_download_progress');
	} catch (e) {
		console.error('[image-cache.service] getBackgroundDownloadProgress:', e);
		return {
			status: 'idle',
			collection_id: null,
			collection_title: null,
			total: 0,
			completed: 0,
			cached: 0,
			skipped: 0,
			failed: 0,
			current_url: null,
			errors: [],
			started_at: null,
			finished_at: null
		};
	}
}

/**
 * Cancel the current background download
 */
export async function cancelBackgroundDownload(): Promise<boolean> {
	try {
		return await invoke<boolean>('cancel_background_download');
	} catch (e) {
		console.error('[image-cache.service] cancelBackgroundDownload:', e);
		return false;
	}
}

/**
 * Reset the background download state to idle
 */
export async function resetBackgroundDownload(): Promise<boolean> {
	try {
		return await invoke<boolean>('reset_background_download');
	} catch (e) {
		console.error('[image-cache.service] resetBackgroundDownload:', e);
		return false;
	}
}
