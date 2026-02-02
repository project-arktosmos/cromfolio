/**
 * Album View Service
 *
 * Manages album viewing state including page navigation, spread calculations,
 * and flip animations. Pure functions for spread/page math.
 */

import type { AlbumViewState, FlipAnimationConfig } from '$types/game-state.type';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_FLIP_CONFIG: FlipAnimationConfig = {
	duration: 600, // milliseconds
	easing: 'ease-in-out'
};

// ============================================================================
// Spread/Page Calculations
// ============================================================================

/**
 * Calculate total number of spreads (2-page views) in an album
 *
 * @param regularPages - Number of regular sticker pages
 * @param winnerPages - Number of winner/special pages
 * @returns Total number of spreads including cover
 */
export function getTotalSpreads(regularPages: number, winnerPages: number = 0): number {
	// Spread 0 is the cover
	// Each spread shows 2 pages
	const contentPages = regularPages + winnerPages;
	return Math.ceil(contentPages / 2) + 1; // +1 for cover spread
}

/**
 * Check if current spread is the cover spread
 */
export function isCoverSpread(currentSpread: number): boolean {
	return currentSpread === 0;
}

/**
 * Check if current spread is a winner/special spread
 *
 * @param currentSpread - Current spread index
 * @param regularSpreadsCount - Number of regular content spreads
 */
export function isWinnerSpread(currentSpread: number, regularSpreadsCount: number): boolean {
	return currentSpread > regularSpreadsCount;
}

/**
 * Get the left page index for a spread (0-based)
 * Returns -1 for cover spread (no left page)
 */
export function getLeftPageIndex(currentSpread: number): number {
	if (currentSpread === 0) return -1; // Cover has no left page
	return (currentSpread - 1) * 2;
}

/**
 * Get the right page index for a spread (0-based)
 * Returns -1 for cover spread (no right page)
 */
export function getRightPageIndex(currentSpread: number): number {
	if (currentSpread === 0) return -1; // Cover has no right page
	return (currentSpread - 1) * 2 + 1;
}

/**
 * Get the spread index that contains a given page
 */
export function getSpreadForPage(pageIndex: number): number {
	if (pageIndex < 0) return 0; // Invalid page -> cover
	return Math.floor(pageIndex / 2) + 1;
}

/**
 * Check if a spread has a right page (for last spread which might be single page)
 */
export function hasRightPage(currentSpread: number, totalPages: number): boolean {
	if (currentSpread === 0) return false;
	const rightIndex = getRightPageIndex(currentSpread);
	return rightIndex < totalPages;
}

// ============================================================================
// Navigation
// ============================================================================

/**
 * Check if can navigate forward
 */
export function canFlipForward(currentSpread: number, maxSpreads: number): boolean {
	return currentSpread < maxSpreads - 1;
}

/**
 * Check if can navigate backward
 */
export function canFlipBackward(currentSpread: number): boolean {
	return currentSpread > 0;
}

/**
 * Get next spread index (clamped to valid range)
 */
export function getNextSpread(currentSpread: number, maxSpreads: number): number {
	return Math.min(currentSpread + 1, maxSpreads - 1);
}

/**
 * Get previous spread index (clamped to valid range)
 */
export function getPreviousSpread(currentSpread: number): number {
	return Math.max(currentSpread - 1, 0);
}

// ============================================================================
// Flip Animation Controller
// ============================================================================

export interface FlipController {
	flipForward: (currentSpread: number, maxSpreads: number) => boolean;
	flipBackward: (currentSpread: number) => boolean;
	isFlipping: () => boolean;
	cancel: () => void;
}

/**
 * Create a flip animation controller
 *
 * @param config - Animation configuration
 * @param onFlipStart - Called when flip starts with direction and target spread
 * @param onFlipComplete - Called when flip completes with new spread index
 */
export function createFlipController(
	config: FlipAnimationConfig = DEFAULT_FLIP_CONFIG,
	onFlipStart: (direction: 'forward' | 'backward', targetSpread: number) => void,
	onFlipComplete: (newSpread: number) => void
): FlipController {
	let flipping = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const flipForward = (currentSpread: number, maxSpreads: number): boolean => {
		if (flipping || !canFlipForward(currentSpread, maxSpreads)) {
			return false;
		}

		const targetSpread = getNextSpread(currentSpread, maxSpreads);
		flipping = true;
		onFlipStart('forward', targetSpread);

		timeoutId = setTimeout(() => {
			flipping = false;
			timeoutId = null;
			onFlipComplete(targetSpread);
		}, config.duration);

		return true;
	};

	const flipBackward = (currentSpread: number): boolean => {
		if (flipping || !canFlipBackward(currentSpread)) {
			return false;
		}

		const targetSpread = getPreviousSpread(currentSpread);
		flipping = true;
		onFlipStart('backward', targetSpread);

		timeoutId = setTimeout(() => {
			flipping = false;
			timeoutId = null;
			onFlipComplete(targetSpread);
		}, config.duration);

		return true;
	};

	const isFlipping = () => flipping;

	const cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		flipping = false;
	};

	return { flipForward, flipBackward, isFlipping, cancel };
}

// ============================================================================
// State Factory
// ============================================================================

/**
 * Create initial album view state
 */
export function createInitialAlbumViewState(collectionId?: string): AlbumViewState {
	return {
		selectedCollectionId: collectionId ?? null,
		currentSpread: 0,
		isFlipping: false,
		flipDirection: null,
		targetSpread: null
	};
}
