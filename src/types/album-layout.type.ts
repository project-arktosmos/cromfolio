import type { Sticker } from '$types/sticker.type';

/**
 * Configuration for dynamic sticker packing
 * Uses A4 aspect ratio with configurable padding and gaps
 */
export interface PackingConfig {
	/** Reference page width in units (A4 = 210) */
	pageWidth: number;
	/** Reference page height in units (A4 = 297) */
	pageHeight: number;
	/** Padding around page content */
	pagePadding: number;
	/** Horizontal gap between columns */
	columnGap: number;
	/** Vertical gap between stickers */
	stickerGap: number;
	/** Height reserved for page number header */
	headerHeight: number;
	/** Minimum stickers per column (default 2) - stickers will be capped in height to ensure this fits */
	minStickersPerColumn: number;
	/** Maximum stickers per column (default 4) - column is considered full after this count */
	maxStickersPerColumn: number;
}

/** A sticker with its calculated scaled dimensions */
export interface ScaledSticker {
	sticker: Sticker;
	/** Scaled height in config units (for packing algorithm) */
	scaledHeight: number;
	/** Original width in pixels */
	width: number;
	/** Original height in pixels */
	height: number;
}

/** A column containing packed stickers */
export interface PackedColumn {
	stickers: ScaledSticker[];
	/** Total height used by stickers + gaps (in config units) */
	totalHeight: number;
}

/** A single album page with two columns */
export interface PackedPage {
	pageIndex: number;
	leftColumn: PackedColumn;
	rightColumn: PackedColumn;
}

/** A full-page sticker (displayed one per page, e.g., award winners) */
export interface FullPageSticker {
	sticker: Sticker;
	pageIndex: number;
}

/** A grouped set of fragment stickers (4 fragments that form one complete image) */
export interface GroupedFragments {
	/** The shared fragmentOf ID that links these fragments */
	fragmentId: string;
	/** The 4 fragment stickers, keyed by position (1-4) */
	fragments: Map<1 | 2 | 3 | 4, Sticker>;
	/** Page index in the album */
	pageIndex: number;
}

/** Default packing configuration */
export const DEFAULT_PACKING_CONFIG: PackingConfig = {
	pageWidth: 210,
	pageHeight: 297,
	pagePadding: 16,
	columnGap: 8,
	stickerGap: 8,
	headerHeight: 0,
	minStickersPerColumn: 2,
	maxStickersPerColumn: 4
};

/** Get page aspect ratio as CSS string */
export function getPageAspectRatio(): string {
	return `${DEFAULT_PACKING_CONFIG.pageWidth} / ${DEFAULT_PACKING_CONFIG.pageHeight}`;
}

// =============================================================================
// Grid-Based Layout (2-Column) - New System
// =============================================================================

/**
 * Configuration for N-column grid packing
 * Uses A4 aspect ratio with configurable padding and gaps
 */
export interface GridPackingConfig {
	/** Reference page width in units (A4 = 210) */
	pageWidth: number;
	/** Reference page height in units (A4 = 297) */
	pageHeight: number;
	/** Padding around page content */
	pagePadding: number;
	/** Number of columns in the grid */
	columns: number;
	/** Horizontal gap between columns */
	columnGap: number;
	/** Vertical gap between rows */
	rowGap: number;
	/** Height reserved for page number header */
	headerHeight: number;
}

/**
 * A sticker with its calculated scaled dimensions for grid layout
 */
export interface GridScaledSticker {
	sticker: Sticker;
	/** Scaled height in config units when fitted to column width */
	scaledHeight: number;
	/** Original width in pixels */
	width: number;
	/** Original height in pixels */
	height: number;
}

/**
 * A row of stickers (1-N stickers per row, based on config.columns)
 */
export interface PackedRow {
	stickers: GridScaledSticker[];
	/** Height of the row (tallest sticker's scaled height) */
	rowHeight: number;
}

/**
 * A single album page with rows of stickers (N-column grid layout)
 */
export interface GridPackedPage {
	pageIndex: number;
	rows: PackedRow[];
	/** Total height used by all rows + gaps */
	totalHeight: number;
}

/** Default 2-column packing configuration */
export const DEFAULT_GRID_PACKING_CONFIG: GridPackingConfig = {
	pageWidth: 210,
	pageHeight: 297,
	pagePadding: 16,
	columns: 2,
	columnGap: 8,
	rowGap: 8,
	headerHeight: 0
};

/** Get page aspect ratio for grid layout as CSS string */
export function getGridPageAspectRatio(): string {
	return `${DEFAULT_GRID_PACKING_CONFIG.pageWidth} / ${DEFAULT_GRID_PACKING_CONFIG.pageHeight}`;
}
