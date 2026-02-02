import { invoke, convertFileSrc } from '@tauri-apps/api/core';

// Cache types (inline since cache.type.ts was removed)
interface TauriCacheImageResult {
	success: boolean;
	local_path?: string;
	error?: string;
}

interface TauriBatchCacheProgress {
	total: number;
	completed: number;
	cached: number;
	skipped: number;
	errors: string[];
}

interface TauriCacheStats {
	total_images: number;
	total_size_bytes: number;
	by_source: Record<string, { images: number; size_bytes: number }>;
}

/**
 * Convert a filesystem path to an asset URL using Tauri's convertFileSrc.
 * This properly handles the URL encoding for the asset protocol.
 */
function toAssetUrl(filePath: string): string {
	return convertFileSrc(filePath);
}

/**
 * Image service for Tauri-based image caching.
 *
 * This service provides methods to:
 * - Get cached image URLs (or cache on-demand)
 * - Prefetch multiple images
 * - Get cache statistics
 * - Clear the cache
 *
 * Images are organized in the cache by domain name:
 * - {cache_dir}/images/{domain}/{hash}{ext}
 */
export const imageService = {
	/**
	 * Get the URL for an image, caching it if necessary.
	 * Returns an asset:// URL for cached images.
	 *
	 * @param originalUrl - The original external image URL
	 * @returns The local asset:// URL for the cached image
	 */
	async getImageUrl(originalUrl: string): Promise<string> {
		// Skip non-http URLs (already local or data URLs)
		if (!originalUrl.startsWith('http')) {
			return originalUrl;
		}

		try {
			// First check if already cached
			const cachedPath = await invoke<string | null>('get_cached_image', { url: originalUrl });
			if (cachedPath) {
				return toAssetUrl(cachedPath);
			}

			// Cache the image
			const result = await invoke<TauriCacheImageResult>('cache_image', { url: originalUrl });
			if (result.success && result.local_path) {
				return toAssetUrl(result.local_path);
			}

			// Fallback to original URL if caching fails
			console.warn('Failed to cache image:', result.error);
			return originalUrl;
		} catch (error) {
			console.error('Error caching image:', error);
			return originalUrl;
		}
	},

	/**
	 * Check if an image is cached without fetching it.
	 *
	 * @param originalUrl - The original external image URL
	 * @returns The local asset URL if cached, null otherwise
	 */
	async getCachedImage(originalUrl: string): Promise<string | null> {
		if (!originalUrl.startsWith('http')) {
			return originalUrl;
		}

		try {
			const cachedPath = await invoke<string | null>('get_cached_image', { url: originalUrl });
			return cachedPath ? toAssetUrl(cachedPath) : null;
		} catch (error) {
			console.error('Error checking cache:', error);
			return null;
		}
	},

	/**
	 * Get the expected cache path for a URL (without fetching).
	 * Useful for pre-calculating paths.
	 *
	 * @param originalUrl - The original external image URL
	 * @returns The expected asset:// URL
	 */
	async getCachePath(originalUrl: string): Promise<string> {
		try {
			const filePath = await invoke<string>('get_cache_path', { url: originalUrl });
			return toAssetUrl(filePath);
		} catch (error) {
			console.error('Error getting cache path:', error);
			return originalUrl;
		}
	},

	/**
	 * Prefetch and cache multiple images.
	 *
	 * @param urls - Array of original image URLs to cache
	 * @returns Progress information including cached/skipped/error counts
	 */
	async prefetchImages(urls: string[]): Promise<TauriBatchCacheProgress> {
		// Filter to only http URLs
		const httpUrls = urls.filter((url) => url.startsWith('http'));

		if (httpUrls.length === 0) {
			return {
				total: 0,
				completed: 0,
				cached: 0,
				skipped: 0,
				errors: []
			};
		}

		try {
			return await invoke<TauriBatchCacheProgress>('cache_images_batch', { urls: httpUrls });
		} catch (error) {
			console.error('Error prefetching images:', error);
			return {
				total: httpUrls.length,
				completed: 0,
				cached: 0,
				skipped: 0,
				errors: [String(error)]
			};
		}
	},

	/**
	 * Get cache statistics.
	 *
	 * @returns Cache stats including total images, size, and breakdown by source (domain)
	 */
	async getCacheStats(): Promise<TauriCacheStats> {
		try {
			return await invoke<TauriCacheStats>('get_cache_stats');
		} catch (error) {
			console.error('Error getting cache stats:', error);
			return {
				total_images: 0,
				total_size_bytes: 0,
				by_source: {}
			};
		}
	},

	/**
	 * Clear the image cache.
	 *
	 * @param source - Optional domain to clear (e.g., 'example.com'). If not provided, clears all.
	 * @returns Number of images deleted
	 */
	async clearCache(source?: string): Promise<number> {
		try {
			return await invoke<number>('clear_image_cache', { source: source ?? null });
		} catch (error) {
			console.error('Error clearing cache:', error);
			return 0;
		}
	},

	/**
	 * Format bytes to human-readable string.
	 */
	formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}
};
