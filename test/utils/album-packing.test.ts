import { describe, it, expect } from 'vitest';
import {
	getStickerDimensions,
	getColumnWidth,
	getColumnHeight,
	calculateScaledHeight,
	packStickersIntoPages,
	separateWinnerStickers,
	createFullPageStickers,
	groupFragmentStickers,
	getGridColumnWidth,
	getGridPageHeight,
	calculateGridScaledHeight,
	packStickersIntoGrid
} from '$utils/album-packing';
import type { Sticker } from '$types/sticker.type';
import type { Tag } from '$types/tag.type';
import type { PackingConfig, GridPackingConfig } from '$types/album-layout.type';

describe('album-packing', () => {
	const defaultConfig: PackingConfig = {
		pageWidth: 210,
		pageHeight: 297,
		pagePadding: 16,
		columnGap: 8,
		stickerGap: 8,
		headerHeight: 0,
		minStickersPerColumn: 2,
		maxStickersPerColumn: 5
	};

	const gridConfig: GridPackingConfig = {
		pageWidth: 210,
		pageHeight: 297,
		pagePadding: 16,
		columnGap: 8,
		rowGap: 8,
		headerHeight: 0,
		columns: 2
	};

	describe('getStickerDimensions', () => {
		it('should return sticker dimensions when provided', () => {
			const sticker: Sticker = {
				id: '1',
				name: 'Test',
				image: 'test.jpg',
				sourceId: 'src1',
				width: 400,
				height: 600
			};

			const dims = getStickerDimensions(sticker);

			expect(dims.width).toBe(400);
			expect(dims.height).toBe(600);
		});

		it('should return default 2:3 dimensions when not provided', () => {
			const sticker: Sticker = {
				id: '1',
				name: 'Test',
				image: 'test.jpg',
				sourceId: 'src1'
			};

			const dims = getStickerDimensions(sticker);

			expect(dims.width).toBe(200);
			expect(dims.height).toBe(300);
		});
	});

	describe('getColumnWidth', () => {
		it('should calculate column width from config', () => {
			// usableWidth = 210 - 2*16 = 178
			// columnWidth = (178 - 8) / 2 = 85
			const width = getColumnWidth(defaultConfig);
			expect(width).toBe(85);
		});
	});

	describe('getColumnHeight', () => {
		it('should calculate column height from config', () => {
			// 297 - 2*16 - 0 = 265
			const height = getColumnHeight(defaultConfig);
			expect(height).toBe(265);
		});

		it('should account for header height', () => {
			const configWithHeader = { ...defaultConfig, headerHeight: 30 };
			// 297 - 32 - 30 = 235
			const height = getColumnHeight(configWithHeader);
			expect(height).toBe(235);
		});
	});

	describe('calculateScaledHeight', () => {
		it('should calculate scaled height based on column width', () => {
			const sticker: Sticker = {
				id: '1',
				name: 'Test',
				image: 'test.jpg',
				sourceId: 'src1',
				width: 200,
				height: 300
			};

			// columnWidth = 100, scaleFactor = 100/200 = 0.5
			// scaledHeight = 300 * 0.5 = 150
			const scaledHeight = calculateScaledHeight(sticker, 100);
			expect(scaledHeight).toBe(150);
		});
	});

	describe('packStickersIntoPages', () => {
		it('should return empty array for empty stickers', () => {
			const pages = packStickersIntoPages([], defaultConfig);
			expect(pages).toEqual([]);
		});

		it('should pack single sticker into one page', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Test', image: 'test.jpg', sourceId: 'src1' }
			];

			const pages = packStickersIntoPages(stickers, defaultConfig);

			expect(pages).toHaveLength(1);
			expect(pages[0].pageIndex).toBe(0);
			expect(pages[0].leftColumn.stickers).toHaveLength(1);
			expect(pages[0].rightColumn.stickers).toHaveLength(0);
		});

		it('should pack stickers into left column first', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Test1', image: 'test1.jpg', sourceId: 'src1', width: 100, height: 50 },
				{ id: '2', name: 'Test2', image: 'test2.jpg', sourceId: 'src1', width: 100, height: 50 }
			];

			const pages = packStickersIntoPages(stickers, defaultConfig);

			expect(pages).toHaveLength(1);
			// Both should fit in left column with small heights
			expect(pages[0].leftColumn.stickers.length).toBeGreaterThanOrEqual(1);
		});

		it('should move to right column when left is full', () => {
			// Create tall stickers that will fill one column
			const stickers: Sticker[] = Array.from({ length: 6 }, (_, i) => ({
				id: String(i + 1),
				name: `Test${i + 1}`,
				image: `test${i + 1}.jpg`,
				sourceId: 'src1',
				width: 85,
				height: 100
			}));

			const pages = packStickersIntoPages(stickers, defaultConfig);

			expect(pages[0].rightColumn.stickers.length).toBeGreaterThan(0);
		});

		it('should create new page when both columns are full', () => {
			// Create enough stickers to overflow a page
			const stickers: Sticker[] = Array.from({ length: 20 }, (_, i) => ({
				id: String(i + 1),
				name: `Test${i + 1}`,
				image: `test${i + 1}.jpg`,
				sourceId: 'src1',
				width: 85,
				height: 100
			}));

			const pages = packStickersIntoPages(stickers, defaultConfig);

			expect(pages.length).toBeGreaterThan(1);
		});

		it('should cap sticker height to ensure minimum per column', () => {
			// Create very tall sticker
			const stickers: Sticker[] = [
				{ id: '1', name: 'Tall', image: 'tall.jpg', sourceId: 'src1', width: 85, height: 1000 }
			];

			const pages = packStickersIntoPages(stickers, defaultConfig);

			// Should have capped height so at least minStickersPerColumn can fit
			expect(pages[0].leftColumn.stickers[0].scaledHeight).toBeLessThanOrEqual(
				getColumnHeight(defaultConfig) / defaultConfig.minStickersPerColumn
			);
		});
	});

	describe('separateWinnerStickers', () => {
		it('should separate winners from regular stickers', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Regular1', image: 'r1.jpg', sourceId: 'src1' },
				{ id: '2', name: 'Winner', image: 'w.jpg', sourceId: 'src1' },
				{ id: '3', name: 'Regular2', image: 'r2.jpg', sourceId: 'src1' }
			];

			const stickerTagsMap = new Map<string, Tag[]>([
				['1', []],
				['2', [{ id: '1', key: 'award_status', value: 'winner', stickerId: '2' }]],
				['3', []]
			]);

			const { regular, winners } = separateWinnerStickers(stickers, stickerTagsMap);

			expect(regular).toHaveLength(2);
			expect(winners).toHaveLength(1);
			expect(winners[0].id).toBe('2');
		});

		it('should return all as regular when no winners', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Regular1', image: 'r1.jpg', sourceId: 'src1' },
				{ id: '2', name: 'Regular2', image: 'r2.jpg', sourceId: 'src1' }
			];

			const stickerTagsMap = new Map<string, Tag[]>();

			const { regular, winners } = separateWinnerStickers(stickers, stickerTagsMap);

			expect(regular).toHaveLength(2);
			expect(winners).toHaveLength(0);
		});

		it('should ignore tags with different key', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Nominee', image: 'n.jpg', sourceId: 'src1' }
			];

			const stickerTagsMap = new Map<string, Tag[]>([
				['1', [{ id: '1', key: 'award_status', value: 'nominee', stickerId: '1' }]]
			]);

			const { regular, winners } = separateWinnerStickers(stickers, stickerTagsMap);

			expect(regular).toHaveLength(1);
			expect(winners).toHaveLength(0);
		});
	});

	describe('createFullPageStickers', () => {
		it('should create full page entries for winners', () => {
			const winners: Sticker[] = [
				{ id: '1', name: 'Winner1', image: 'w1.jpg', sourceId: 'src1' },
				{ id: '2', name: 'Winner2', image: 'w2.jpg', sourceId: 'src1' }
			];

			const fullPageStickers = createFullPageStickers(winners, 5);

			expect(fullPageStickers).toHaveLength(2);
			expect(fullPageStickers[0].pageIndex).toBe(5);
			expect(fullPageStickers[0].sticker.id).toBe('1');
			expect(fullPageStickers[1].pageIndex).toBe(6);
			expect(fullPageStickers[1].sticker.id).toBe('2');
		});

		it('should return empty array for no winners', () => {
			const fullPageStickers = createFullPageStickers([], 0);
			expect(fullPageStickers).toEqual([]);
		});
	});

	describe('groupFragmentStickers', () => {
		it('should group fragment stickers by fragmentOf ID', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Frag1', image: 'f1.jpg', sourceId: 'src1', fragmentOf: 'big1', fragmentPosition: 1 },
				{ id: '2', name: 'Frag2', image: 'f2.jpg', sourceId: 'src1', fragmentOf: 'big1', fragmentPosition: 2 },
				{ id: '3', name: 'Frag3', image: 'f3.jpg', sourceId: 'src1', fragmentOf: 'big1', fragmentPosition: 3 },
				{ id: '4', name: 'Frag4', image: 'f4.jpg', sourceId: 'src1', fragmentOf: 'big1', fragmentPosition: 4 },
				{ id: '5', name: 'Regular', image: 'r.jpg', sourceId: 'src1' }
			];

			const { grouped, nonFragments } = groupFragmentStickers(stickers, 0);

			expect(grouped).toHaveLength(1);
			expect(grouped[0].fragmentId).toBe('big1');
			expect(grouped[0].fragments.size).toBe(4);
			expect(grouped[0].pageIndex).toBe(0);
			expect(nonFragments).toHaveLength(1);
			expect(nonFragments[0].id).toBe('5');
		});

		it('should handle multiple fragment groups', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Frag1', image: 'f1.jpg', sourceId: 'src1', fragmentOf: 'big1', fragmentPosition: 1 },
				{ id: '2', name: 'Frag2', image: 'f2.jpg', sourceId: 'src1', fragmentOf: 'big2', fragmentPosition: 1 }
			];

			const { grouped, nonFragments } = groupFragmentStickers(stickers, 5);

			expect(grouped).toHaveLength(2);
			expect(grouped[0].pageIndex).toBe(5);
			expect(grouped[1].pageIndex).toBe(6);
			expect(nonFragments).toHaveLength(0);
		});

		it('should return all as nonFragments when no fragments', () => {
			const stickers: Sticker[] = [
				{ id: '1', name: 'Regular1', image: 'r1.jpg', sourceId: 'src1' },
				{ id: '2', name: 'Regular2', image: 'r2.jpg', sourceId: 'src1' }
			];

			const { grouped, nonFragments } = groupFragmentStickers(stickers, 0);

			expect(grouped).toHaveLength(0);
			expect(nonFragments).toHaveLength(2);
		});
	});

	describe('grid packing', () => {
		describe('getGridColumnWidth', () => {
			it('should calculate grid column width', () => {
				// usableWidth = 210 - 32 = 178
				// totalGaps = (2-1) * 8 = 8
				// columnWidth = (178 - 8) / 2 = 85
				const width = getGridColumnWidth(gridConfig);
				expect(width).toBe(85);
			});

			it('should handle different column counts', () => {
				const config3col = { ...gridConfig, columns: 3 };
				// usableWidth = 178, totalGaps = 2*8 = 16
				// columnWidth = (178 - 16) / 3 = 54
				const width = getGridColumnWidth(config3col);
				expect(width).toBe(54);
			});
		});

		describe('getGridPageHeight', () => {
			it('should calculate grid page height', () => {
				// 297 - 32 - 0 = 265
				const height = getGridPageHeight(gridConfig);
				expect(height).toBe(265);
			});
		});

		describe('calculateGridScaledHeight', () => {
			it('should calculate grid scaled height', () => {
				const sticker: Sticker = {
					id: '1',
					name: 'Test',
					image: 'test.jpg',
					sourceId: 'src1',
					width: 200,
					height: 300
				};

				// columnWidth = 100, scaleFactor = 100/200 = 0.5
				// scaledHeight = 300 * 0.5 = 150
				const height = calculateGridScaledHeight(sticker, 100);
				expect(height).toBe(150);
			});
		});

		describe('packStickersIntoGrid', () => {
			it('should return empty array for empty stickers', () => {
				const pages = packStickersIntoGrid([], gridConfig);
				expect(pages).toEqual([]);
			});

			it('should pack stickers into rows', () => {
				const stickers: Sticker[] = [
					{ id: '1', name: 'Test1', image: 't1.jpg', sourceId: 'src1' },
					{ id: '2', name: 'Test2', image: 't2.jpg', sourceId: 'src1' },
					{ id: '3', name: 'Test3', image: 't3.jpg', sourceId: 'src1' }
				];

				const pages = packStickersIntoGrid(stickers, gridConfig);

				expect(pages).toHaveLength(1);
				// 3 stickers with 2 columns = 2 rows
				expect(pages[0].rows).toHaveLength(2);
				expect(pages[0].rows[0].stickers).toHaveLength(2);
				expect(pages[0].rows[1].stickers).toHaveLength(1);
			});

			it('should use max height of row for row height', () => {
				const stickers: Sticker[] = [
					{ id: '1', name: 'Short', image: 't1.jpg', sourceId: 'src1', width: 100, height: 100 },
					{ id: '2', name: 'Tall', image: 't2.jpg', sourceId: 'src1', width: 100, height: 200 }
				];

				const pages = packStickersIntoGrid(stickers, gridConfig);

				// Row height should be max of the two scaled heights
				const row = pages[0].rows[0];
				const maxHeight = Math.max(...row.stickers.map((s) => s.scaledHeight));
				expect(row.rowHeight).toBe(maxHeight);
			});

			it('should create new page when height exceeds limit', () => {
				// Create many tall stickers
				const stickers: Sticker[] = Array.from({ length: 20 }, (_, i) => ({
					id: String(i + 1),
					name: `Test${i + 1}`,
					image: `t${i + 1}.jpg`,
					sourceId: 'src1',
					width: 100,
					height: 150
				}));

				const pages = packStickersIntoGrid(stickers, gridConfig);

				expect(pages.length).toBeGreaterThan(1);
			});

			it('should respect maxRowsPerPage', () => {
				const configWithMaxRows: GridPackingConfig = {
					...gridConfig,
					maxRowsPerPage: 2
				};

				const stickers: Sticker[] = Array.from({ length: 10 }, (_, i) => ({
					id: String(i + 1),
					name: `Test${i + 1}`,
					image: `t${i + 1}.jpg`,
					sourceId: 'src1',
					width: 100,
					height: 50
				}));

				const pages = packStickersIntoGrid(stickers, configWithMaxRows);

				// 10 stickers, 2 per row = 5 rows
				// 2 rows per page = 3 pages (2+2+1)
				expect(pages).toHaveLength(3);
				expect(pages[0].rows).toHaveLength(2);
				expect(pages[1].rows).toHaveLength(2);
				expect(pages[2].rows).toHaveLength(1);
			});
		});
	});
});
