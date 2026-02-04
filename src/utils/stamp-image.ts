import { convertFileSrc } from '@tauri-apps/api/core';
import type { Stamp } from '$types/stamp-pack.type';

/** Fallback SVG for stamps (64x64) */
export const STAMP_FALLBACK_IMAGE =
	'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="4"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="20">?</text></svg>';

/** Fallback SVG for stickers (100x100) */
export const STICKER_FALLBACK_IMAGE =
	'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';

/**
 * Get the image path for a stamp, converting to Tauri file source.
 * Returns fallback for missing paths or unsupported formats (TGS).
 */
export function getStampImagePath(
	stamp: Stamp | undefined,
	stampsDataDir: string,
	fallback: string = STAMP_FALLBACK_IMAGE
): string {
	if (!stamp?.imagePath) return fallback;
	// Skip animated TGS files for now (they need lottie)
	if (stamp.imagePath.endsWith('.tgs')) return fallback;
	const filePath = `${stampsDataDir}/${stamp.imagePath}`;
	return convertFileSrc(filePath);
}

/**
 * Check if a stamp is a video format (webm).
 */
export function isVideoStamp(stamp: Stamp | undefined): boolean {
	return stamp?.imagePath?.endsWith('.webm') ?? false;
}

/**
 * Handle image load error by setting fallback source.
 */
export function handleImageError(e: Event, fallback: string = STAMP_FALLBACK_IMAGE): void {
	(e.target as HTMLImageElement).src = fallback;
}
