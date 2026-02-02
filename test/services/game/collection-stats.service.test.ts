import { describe, it, expect } from 'vitest';
import {
	computeCollectionStats,
	computeMultipleCollectionStats,
	getBestRarityPerSticker,
	getDefaultRarity,
	getNextRarity,
	getCopyCount,
	getCopyCountByRarity,
	getAvailableCopies,
	createEmptyStatsCache,
	isCacheStale
} from '$services/collection-stats.service';
import type { UserSticker } from '$types/user-sticker.type';
import type { Sticker } from '$types/sticker.type';
import type { Rarity } from '$types/rarity.type';
import type { Collection } from '$types/collection.type';

describe('collection-stats.service', () => {
	// Mock data
	const mockRarities: Rarity[] = [
		{ id: '1', name: 'Common', sortOrder: 0, colorFrom: '#gray', colorTo: '#darkgray' },
		{ id: '2', name: 'Uncommon', sortOrder: 1, colorFrom: '#green', colorTo: '#darkgreen' },
		{ id: '3', name: 'Rare', sortOrder: 2, colorFrom: '#blue', colorTo: '#darkblue' }
	];

	const mockCollection: Collection = {
		id: 'col1',
		name: 'Test Collection',
		sourceId: 'src1'
	};

	const mockStickers: Sticker[] = [
		{ id: 's1', name: 'Sticker 1', image: 'img1.png', sourceId: 'src1' },
		{ id: 's2', name: 'Sticker 2', image: 'img2.png', sourceId: 'src1' },
		{ id: 's3', name: 'Sticker 3', image: 'img3.png', sourceId: 'src1' },
		{ id: 's4', name: 'Sticker 4', image: 'img4.png', sourceId: 'src1' },
		{ id: 's5', name: 'Sticker 5', image: 'img5.png', sourceId: 'src1' }
	];

	const mockUserStickers: UserSticker[] = [
		// s1: Common (r1) x2, Uncommon (r2) x1
		{ id: '1', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-01' },
		{ id: '2', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-02' },
		{ id: '3', stickerId: 's1', sourceId: 'src1', rarityId: '2', acquiredAt: '2024-01-03' },
		// s2: Rare (r3) x1
		{ id: '4', stickerId: 's2', sourceId: 'src1', rarityId: '3', acquiredAt: '2024-01-01' },
		// s3: Common (r1) x1
		{ id: '5', stickerId: 's3', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-01' }
	];

	describe('computeCollectionStats', () => {
		it('should compute stats for a collection', () => {
			const stats = computeCollectionStats(mockCollection, mockStickers, mockUserStickers, mockRarities);

			expect(stats.total).toBe(5);
			expect(stats.owned).toBe(3); // s1, s2, s3
			expect(stats.rarityBreakdown).toBeInstanceOf(Map);
			expect(stats.completionScore).toBeGreaterThan(0);
			expect(stats.maxCompletionScore).toBeGreaterThan(0);
			expect(stats.completionPercent).toBeGreaterThanOrEqual(0);
			expect(stats.completionPercent).toBeLessThanOrEqual(100);
		});

		it('should compute rarity breakdown correctly', () => {
			const stats = computeCollectionStats(mockCollection, mockStickers, mockUserStickers, mockRarities);

			// Rarity breakdown counts user stickers by rarity
			// Common (r1): s1 x2 + s3 x1 = 3
			// Uncommon (r2): s1 x1 = 1
			// Rare (r3): s2 x1 = 1
			expect(stats.rarityBreakdown.get('1')).toBe(3);
			expect(stats.rarityBreakdown.get('2')).toBe(1);
			expect(stats.rarityBreakdown.get('3')).toBe(1);
		});

		it('should handle empty collection stickers', () => {
			const stats = computeCollectionStats(mockCollection, [], mockUserStickers, mockRarities);

			expect(stats.total).toBe(0);
			expect(stats.owned).toBe(0);
			expect(stats.completionPercent).toBe(0);
		});

		it('should handle no owned stickers', () => {
			const stats = computeCollectionStats(mockCollection, mockStickers, [], mockRarities);

			expect(stats.total).toBe(5);
			expect(stats.owned).toBe(0);
			expect(stats.completionPercent).toBe(0);
		});
	});

	describe('computeMultipleCollectionStats', () => {
		it('should compute stats for multiple collections', () => {
			const collections = [mockCollection];
			const collectionStickersMap = new Map<string, Sticker[]>([['col1', mockStickers]]);

			const statsMap = computeMultipleCollectionStats(
				collections,
				collectionStickersMap,
				mockUserStickers,
				mockRarities
			);

			expect(statsMap.size).toBe(1);
			expect(statsMap.get('col1')).toBeDefined();
			expect(statsMap.get('col1')?.total).toBe(5);
		});

		it('should handle empty collections array', () => {
			const statsMap = computeMultipleCollectionStats([], new Map(), mockUserStickers, mockRarities);
			expect(statsMap.size).toBe(0);
		});
	});

	describe('getBestRarityPerSticker', () => {
		it('should return best rarity for each owned sticker', () => {
			const bestRarities = getBestRarityPerSticker(mockUserStickers, mockRarities);

			// s1 has Common and Uncommon, best is Uncommon (sortOrder 1)
			expect(bestRarities.get('s1')).toBe('2');
			// s2 has only Rare
			expect(bestRarities.get('s2')).toBe('3');
			// s3 has only Common
			expect(bestRarities.get('s3')).toBe('1');
		});

		it('should handle empty user stickers', () => {
			const bestRarities = getBestRarityPerSticker([], mockRarities);
			expect(bestRarities.size).toBe(0);
		});

		it('should prefer higher rarity (higher sortOrder)', () => {
			const stickers: UserSticker[] = [
				{ id: '1', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-01' },
				{ id: '2', stickerId: 's1', sourceId: 'src1', rarityId: '3', acquiredAt: '2024-01-02' },
				{ id: '3', stickerId: 's1', sourceId: 'src1', rarityId: '2', acquiredAt: '2024-01-03' }
			];

			const bestRarities = getBestRarityPerSticker(stickers, mockRarities);
			expect(bestRarities.get('s1')).toBe('3'); // Rare is highest
		});
	});

	describe('getDefaultRarity', () => {
		it('should return lowest sortOrder rarity', () => {
			const defaultRarity = getDefaultRarity(mockRarities);
			expect(defaultRarity?.name).toBe('Common');
			expect(defaultRarity?.sortOrder).toBe(0);
		});

		it('should return undefined for empty rarities', () => {
			const defaultRarity = getDefaultRarity([]);
			expect(defaultRarity).toBeUndefined();
		});

		it('should handle unsorted rarities', () => {
			const unordered = [mockRarities[2], mockRarities[0], mockRarities[1]];
			const defaultRarity = getDefaultRarity(unordered);
			expect(defaultRarity?.name).toBe('Common');
		});
	});

	describe('getNextRarity', () => {
		it('should return next rarity in sort order', () => {
			const common = mockRarities[0];
			const nextRarity = getNextRarity(common, mockRarities);
			expect(nextRarity?.name).toBe('Uncommon');
		});

		it('should return null when at max rarity', () => {
			const rare = mockRarities[2];
			const nextRarity = getNextRarity(rare, mockRarities);
			expect(nextRarity).toBeNull();
		});

		it('should return null for empty rarities', () => {
			const common = mockRarities[0];
			const nextRarity = getNextRarity(common, []);
			expect(nextRarity).toBeNull();
		});
	});

	describe('getCopyCount', () => {
		it('should count copies of a sticker', () => {
			// s1 has 3 copies
			expect(getCopyCount('s1', mockUserStickers)).toBe(3);
			// s2 has 1 copy
			expect(getCopyCount('s2', mockUserStickers)).toBe(1);
			// s4 not owned
			expect(getCopyCount('s4', mockUserStickers)).toBe(0);
		});
	});

	describe('getCopyCountByRarity', () => {
		it('should count copies at specific rarity', () => {
			// s1 has 2 Common copies
			expect(getCopyCountByRarity('s1', '1', mockUserStickers)).toBe(2);
			// s1 has 1 Uncommon copy
			expect(getCopyCountByRarity('s1', '2', mockUserStickers)).toBe(1);
			// s1 has 0 Rare copies
			expect(getCopyCountByRarity('s1', '3', mockUserStickers)).toBe(0);
		});
	});

	describe('getAvailableCopies', () => {
		it('should return owned minus placed', () => {
			const placedIds = new Set<string>();
			expect(getAvailableCopies('s1', mockUserStickers, placedIds)).toBe(3);
		});

		it('should subtract placed sticker', () => {
			const placedIds = new Set<string>(['s1']);
			expect(getAvailableCopies('s1', mockUserStickers, placedIds)).toBe(2);
		});

		it('should return 0 for unowned sticker', () => {
			const placedIds = new Set<string>();
			expect(getAvailableCopies('s999', mockUserStickers, placedIds)).toBe(0);
		});
	});

	describe('createEmptyStatsCache', () => {
		it('should create empty cache', () => {
			const cache = createEmptyStatsCache();

			expect(cache.stats).toBeInstanceOf(Map);
			expect(cache.stats.size).toBe(0);
			expect(cache.ownedStickerIds).toBeInstanceOf(Set);
			expect(cache.ownedStickerIds.size).toBe(0);
			expect(cache.stickerRarityMap).toBeInstanceOf(Map);
			expect(cache.copyCountCache).toBeInstanceOf(Map);
			expect(cache.lastUpdated).toBe(0);
		});
	});

	describe('isCacheStale', () => {
		it('should return true for old cache', () => {
			const cache = createEmptyStatsCache();
			cache.lastUpdated = Date.now() - 120000; // 2 minutes ago

			expect(isCacheStale(cache, 60000)).toBe(true);
		});

		it('should return false for fresh cache', () => {
			const cache = createEmptyStatsCache();
			cache.lastUpdated = Date.now() - 30000; // 30 seconds ago

			expect(isCacheStale(cache, 60000)).toBe(false);
		});

		it('should use default max age', () => {
			const cache = createEmptyStatsCache();
			cache.lastUpdated = Date.now() - 30000;

			expect(isCacheStale(cache)).toBe(false); // default is 60000ms
		});
	});
});
