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
