import type { Sticker } from '$types/sticker.type';
import type {
	PackingConfig,
	PackedPage,
	PackedColumn,
	ScaledSticker,
	FullPageSticker,
	GroupedFragments,
	GridPackingConfig,
	GridScaledSticker,
	PackedRow,
	GridPackedPage
} from '$types/album-layout.type';
import type { Tag } from '$types/tag.type';

/** Default dimensions for stickers without width/height (2:3 aspect ratio) */
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 300;

/**
 * Get sticker dimensions with fallback to default 2:3 aspect ratio
 */
export function getStickerDimensions(sticker: Sticker): { width: number; height: number } {
	return {
		width: sticker.width ?? DEFAULT_WIDTH,
		height: sticker.height ?? DEFAULT_HEIGHT
	};
}

/**
 * Calculate the usable column width from packing config
 */
export function getColumnWidth(config: PackingConfig): number {
	const usableWidth = config.pageWidth - 2 * config.pagePadding;
	return (usableWidth - config.columnGap) / 2;
}

/**
 * Calculate the usable column height from packing config
 */
export function getColumnHeight(config: PackingConfig): number {
	return config.pageHeight - 2 * config.pagePadding - config.headerHeight;
}

/**
 * Calculate the scaled height of a sticker when fit to column width
 * Returns the height in config units (relative to page dimensions)
 */
export function calculateScaledHeight(sticker: Sticker, columnWidth: number): number {
	const { width, height } = getStickerDimensions(sticker);
	const scaleFactor = columnWidth / width;
	return height * scaleFactor;
}

/**
 * Create an empty packed page
 */
function createEmptyPage(pageIndex: number): PackedPage {
	return {
		pageIndex,
		leftColumn: { stickers: [], totalHeight: 0 },
		rightColumn: { stickers: [], totalHeight: 0 }
	};
}

/**
 * Check if a sticker can fit in a column
 */
function canFitInColumn(
	column: PackedColumn,
	stickerHeight: number,
	maxHeight: number,
	gapHeight: number,
	maxStickersPerColumn: number
): boolean {
	// Check if column already has max stickers
	if (column.stickers.length >= maxStickersPerColumn) {
		return false;
	}
	const gapToAdd = column.stickers.length > 0 ? gapHeight : 0;
	return column.totalHeight + gapToAdd + stickerHeight <= maxHeight;
}

/**
 * Add a scaled sticker to a column
 */
function addToColumn(
	column: PackedColumn,
	scaledSticker: ScaledSticker,
	gapHeight: number
): void {
	if (column.stickers.length > 0) {
		column.totalHeight += gapHeight;
	}
	column.stickers.push(scaledSticker);
	column.totalHeight += scaledSticker.scaledHeight;
}

/**
 * Pack stickers into pages using a greedy bin-packing algorithm.
 *
 * Algorithm:
 * 1. For each sticker, calculate its scaled height when fit to column width
 * 2. Try to fit in left column first
 * 3. If left is full, try right column
 * 4. If both are full, start a new page
 */
export function packStickersIntoPages(
	stickers: Sticker[],
	config: PackingConfig
): PackedPage[] {
	if (stickers.length === 0) {
		return [];
	}

	const columnWidth = getColumnWidth(config);
	const maxColumnHeight = getColumnHeight(config);

	const pages: PackedPage[] = [];
	let pageIndex = 0;
	let currentPage = createEmptyPage(pageIndex);

	// Calculate max sticker height to ensure minimum stickers can fit per column
	// Account for gaps between stickers: minStickers stickers need (minStickers - 1) gaps
	const minStickers = config.minStickersPerColumn;
	const totalGapsHeight = (minStickers - 1) * config.stickerGap;
	const maxStickerHeight = (maxColumnHeight - totalGapsHeight) / minStickers;

	for (const sticker of stickers) {
		const { width, height } = getStickerDimensions(sticker);
		const uncappedScaledHeight = calculateScaledHeight(sticker, columnWidth);
		let scaledHeight = uncappedScaledHeight;
		let displayHeight = height;

		// Cap stickers at max height ratio to ensure multiple stickers per column
		if (scaledHeight > maxStickerHeight) {
			scaledHeight = maxStickerHeight;
			// Adjust display height proportionally so CSS aspect-ratio respects the cap
			displayHeight = height * (maxStickerHeight / uncappedScaledHeight);
		}

		const scaledSticker: ScaledSticker = {
			sticker,
			scaledHeight,
			width,
			height: displayHeight
		};

		// Try left column first
		if (canFitInColumn(currentPage.leftColumn, scaledHeight, maxColumnHeight, config.stickerGap, config.maxStickersPerColumn)) {
			addToColumn(currentPage.leftColumn, scaledSticker, config.stickerGap);
		}
		// Then try right column
		else if (canFitInColumn(currentPage.rightColumn, scaledHeight, maxColumnHeight, config.stickerGap, config.maxStickersPerColumn)) {
			addToColumn(currentPage.rightColumn, scaledSticker, config.stickerGap);
		}
		// Start new page
		else {
			pages.push(currentPage);
			pageIndex++;
			currentPage = createEmptyPage(pageIndex);
			addToColumn(currentPage.leftColumn, scaledSticker, config.stickerGap);
		}
	}

	// Add final page if not empty
	if (currentPage.leftColumn.stickers.length > 0 || currentPage.rightColumn.stickers.length > 0) {
		pages.push(currentPage);
	}

	return pages;
}

/**
 * Separate stickers into regular stickers and winner stickers (full-page display).
 * Winner stickers have a tag with key="award_status" and value="winner".
 */
export function separateWinnerStickers(
	stickers: Sticker[],
	stickerTagsMap: Map<string, Tag[]>
): { regular: Sticker[]; winners: Sticker[] } {
	const regular: Sticker[] = [];
	const winners: Sticker[] = [];

	for (const sticker of stickers) {
		const tags = stickerTagsMap.get(String(sticker.id)) ?? [];
		const isWinner = tags.some((tag) => tag.key === 'award_status' && tag.value === 'winner');

		if (isWinner) {
			winners.push(sticker);
		} else {
			regular.push(sticker);
		}
	}

	return { regular, winners };
}

/**
 * Create full-page sticker entries for winner stickers.
 * These are displayed one per page at the end of the album.
 */
export function createFullPageStickers(
	winners: Sticker[],
	startingPageIndex: number
): FullPageSticker[] {
	return winners.map((sticker, index) => ({
		sticker,
		pageIndex: startingPageIndex + index
	}));
}

/**
 * Group fragment stickers by their fragmentOf ID.
 * Returns an array of GroupedFragments, where each group contains all 4 fragment pieces.
 * Non-fragment stickers are returned separately.
 */
export function groupFragmentStickers(
	stickers: Sticker[],
	startingPageIndex: number
): { grouped: GroupedFragments[]; nonFragments: Sticker[] } {
	const fragmentGroups = new Map<string, Map<1 | 2 | 3 | 4, Sticker>>();
	const nonFragments: Sticker[] = [];

	for (const sticker of stickers) {
		if (sticker.fragmentOf && sticker.fragmentPosition) {
			// This is a fragment sticker
			if (!fragmentGroups.has(sticker.fragmentOf)) {
				fragmentGroups.set(sticker.fragmentOf, new Map());
			}
			fragmentGroups.get(sticker.fragmentOf)!.set(sticker.fragmentPosition, sticker);
		} else {
			// Non-fragment sticker
			nonFragments.push(sticker);
		}
	}

	// Convert to GroupedFragments array
	const grouped: GroupedFragments[] = [];
	let pageIndex = startingPageIndex;

	for (const [fragmentId, fragments] of fragmentGroups) {
		grouped.push({
			fragmentId,
			fragments,
			pageIndex
		});
		pageIndex++;
	}

	return { grouped, nonFragments };
}

// =============================================================================
// Grid-Based Layout (N-Column) - New System
// =============================================================================

/**
 * Calculate the width of each sticker in the grid layout
 */
export function getGridColumnWidth(config: GridPackingConfig): number {
	const usableWidth = config.pageWidth - 2 * config.pagePadding;
	const totalGaps = (config.columns - 1) * config.columnGap;
	return (usableWidth - totalGaps) / config.columns;
	// For A4 with 2 columns: (210 - 32 - 8) / 2 = 170 / 2 = 85mm per sticker
}

/**
 * Calculate the usable page height for rows
 */
export function getGridPageHeight(config: GridPackingConfig): number {
	return config.pageHeight - 2 * config.pagePadding - config.headerHeight;
	// For A4: 297 - 32 - 0 = 265mm
}

/**
 * Calculate the scaled height of a sticker when fit to grid column width
 */
export function calculateGridScaledHeight(
	sticker: Sticker,
	columnWidth: number
): number {
	const { width, height } = getStickerDimensions(sticker);
	const scaleFactor = columnWidth / width;
	return height * scaleFactor;
}

/**
 * Pack stickers into pages using a row-based grid algorithm.
 *
 * Algorithm:
 * 1. Calculate sticker width based on N-column layout
 * 2. For each sticker, calculate scaled height
 * 3. Group stickers into rows of N (or fewer for the last row)
 * 4. For each row, height = max(sticker heights in row)
 * 5. Pack rows onto pages until page is full
 */
export function packStickersIntoGrid(
	stickers: Sticker[],
	config: GridPackingConfig
): GridPackedPage[] {
	if (stickers.length === 0) {
		return [];
	}

	const columnWidth = getGridColumnWidth(config);
	const maxPageHeight = getGridPageHeight(config);

	// Step 1: Calculate scaled dimensions for all stickers
	const scaledStickers: GridScaledSticker[] = stickers.map((sticker) => {
		const { width, height } = getStickerDimensions(sticker);
		const scaledHeight = calculateGridScaledHeight(sticker, columnWidth);
		return { sticker, scaledHeight, width, height };
	});

	// Step 2: Group into rows of N (config.columns)
	const rows: PackedRow[] = [];
	for (let i = 0; i < scaledStickers.length; i += config.columns) {
		const rowStickers = scaledStickers.slice(i, i + config.columns);
		const rowHeight = Math.max(...rowStickers.map((s) => s.scaledHeight));
		rows.push({ stickers: rowStickers, rowHeight });
	}

	// Step 3: Pack rows onto pages
	const pages: GridPackedPage[] = [];
	let pageIndex = 0;
	let currentPage: GridPackedPage = { pageIndex, rows: [], totalHeight: 0 };

	for (const row of rows) {
		const gapToAdd = currentPage.rows.length > 0 ? config.rowGap : 0;
		const heightNeeded = row.rowHeight + gapToAdd;

		if (currentPage.totalHeight + heightNeeded > maxPageHeight) {
			// Current page is full, start new page
			if (currentPage.rows.length > 0) {
				pages.push(currentPage);
			}
			pageIndex++;
			currentPage = { pageIndex, rows: [], totalHeight: 0 };
		}

		// Add row to current page
		if (currentPage.rows.length > 0) {
			currentPage.totalHeight += config.rowGap;
		}
		currentPage.rows.push(row);
		currentPage.totalHeight += row.rowHeight;
	}

	// Add final page
	if (currentPage.rows.length > 0) {
		pages.push(currentPage);
	}

	return pages;
}
