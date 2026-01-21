/**
 * Result of a single image cache operation from Tauri
 */
export interface TauriCacheImageResult {
	success: boolean;
	local_path: string | null;
	error: string | null;
}

/**
 * Progress of batch caching operation from Tauri
 */
export interface TauriBatchCacheProgress {
	total: number;
	completed: number;
	cached: number;
	skipped: number;
	errors: string[];
}

/**
 * Statistics for a single source (domain)
 */
export interface TauriSourceStats {
	count: number;
	size_bytes: number;
}

/**
 * Overall cache statistics from Tauri
 */
export interface TauriCacheStats {
	total_images: number;
	total_size_bytes: number;
	by_source: Record<string, TauriSourceStats>;
}
