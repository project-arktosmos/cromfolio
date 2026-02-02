import { describe, it, expect } from 'vitest';
import {
	selectBoosterStickers,
	selectRandomRarity,
	processBoosterPackOpening,
	createUserStickersFromPack,
	canOpenBoosterPack,
	getBoosterPackPreview,
	DEFAULT_BOOSTER_CONFIG
} from '$services/booster-pack.service';
import type { Sticker } from '$types/sticker.type';
import type { Rarity } from '$types/rarity.type';

describe('booster-pack.service', () => {
	// Mock data
	const mockStickers: Sticker[] = [
		{ id: '1', name: 'Sticker 1', image: 'img1.png', sourceId: 'source1' },
		{ id: '2', name: 'Sticker 2', image: 'img2.png', sourceId: 'source1' },
		{ id: '3', name: 'Sticker 3', image: 'img3.png', sourceId: 'source1' },
		{ id: '4', name: 'Sticker 4', image: 'img4.png', sourceId: 'source1' },
		{ id: '5', name: 'Sticker 5', image: 'img5.png', sourceId: 'source1' },
		{ id: '6', name: 'Sticker 6', image: 'img6.png', sourceId: 'source1' },
		{ id: '7', name: 'Sticker 7', image: 'img7.png', sourceId: 'source1' },
		{ id: '8', name: 'Sticker 8', image: 'img8.png', sourceId: 'source1' },
		{ id: '9', name: 'Sticker 9', image: 'img9.png', sourceId: 'source1' },
		{ id: '10', name: 'Sticker 10', image: 'img10.png', sourceId: 'source1' }
	];

	const mockRarities: Rarity[] = [
		{ id: '1', name: 'Common', sortOrder: 0, colorFrom: '#gray', colorTo: '#gray' },
		{ id: '2', name: 'Uncommon', sortOrder: 1, colorFrom: '#green', colorTo: '#green' },
		{ id: '3', name: 'Rare', sortOrder: 2, colorFrom: '#blue', colorTo: '#blue' },
		{ id: '4', name: 'Epic', sortOrder: 3, colorFrom: '#purple', colorTo: '#purple' },
		{ id: '5', name: 'Legendary', sortOrder: 4, colorFrom: '#gold', colorTo: '#gold' }
	];

	describe('selectBoosterStickers', () => {
		it('should return the configured pack size of stickers', () => {
			const result = selectBoosterStickers(mockStickers);
			expect(result.length).toBe(DEFAULT_BOOSTER_CONFIG.packSize);
		});

		it('should return unique stickers', () => {
			const result = selectBoosterStickers(mockStickers);
			const ids = result.map((s) => s.id);
			expect(new Set(ids).size).toBe(result.length);
		});

		it('should return all available stickers if fewer than pack size', () => {
			const fewStickers = mockStickers.slice(0, 3);
			const result = selectBoosterStickers(fewStickers);
			expect(result.length).toBe(3);
		});

		it('should return empty array for empty input', () => {
			const result = selectBoosterStickers([]);
			expect(result).toEqual([]);
		});

		it('should respect custom pack size', () => {
			const config = { ...DEFAULT_BOOSTER_CONFIG, packSize: 3 };
			const result = selectBoosterStickers(mockStickers, config);
			expect(result.length).toBe(3);
		});
	});

	describe('selectRandomRarity', () => {
		it('should return a rarity within max sort order', () => {
			const result = selectRandomRarity(mockRarities);
			expect(result).not.toBeNull();
			if (result) {
				expect(result.sortOrder).toBeLessThanOrEqual(DEFAULT_BOOSTER_CONFIG.maxRaritySortOrder);
			}
		});

		it('should return null for empty rarities array', () => {
			const result = selectRandomRarity([]);
			expect(result).toBeNull();
		});

		it('should only select rarities within configured max sort order', () => {
			const config = { ...DEFAULT_BOOSTER_CONFIG, maxRaritySortOrder: 1 };
			// Run multiple times to increase confidence
			for (let i = 0; i < 20; i++) {
				const result = selectRandomRarity(mockRarities, config);
				if (result) {
					expect(result.sortOrder).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe('processBoosterPackOpening', () => {
		it('should create result with correct sticker IDs', () => {
			const stickers = mockStickers.slice(0, 5);
			const result = processBoosterPackOpening(stickers, 'collection1', new Set());

			expect(result.stickerIds).toEqual(['1', '2', '3', '4', '5']);
			expect(result.collectionId).toBe('collection1');
		});

		it('should correctly count new vs duplicate stickers', () => {
			const stickers = mockStickers.slice(0, 5);
			const ownedSet = new Set(['1', '3']); // 2 already owned
			const result = processBoosterPackOpening(stickers, 'collection1', ownedSet);

			expect(result.newCount).toBe(3);
			expect(result.duplicateCount).toBe(2);
			expect(result.hasNewStickers).toBe(true);
		});

		it('should set hasNewStickers to false when all are duplicates', () => {
			const stickers = mockStickers.slice(0, 3);
			const ownedSet = new Set(['1', '2', '3']);
			const result = processBoosterPackOpening(stickers, 'collection1', ownedSet);

			expect(result.hasNewStickers).toBe(false);
			expect(result.newCount).toBe(0);
			expect(result.duplicateCount).toBe(3);
		});
	});

	describe('createUserStickersFromPack', () => {
		it('should create user stickers from pack result', () => {
			const result = {
				stickerIds: ['1', '2', '3'],
				collectionId: 'collection1',
				hasNewStickers: true,
				newCount: 3,
				duplicateCount: 0
			};

			const userStickers = createUserStickersFromPack(result, mockRarities, 'source1');

			expect(userStickers.length).toBe(3);
			expect(userStickers[0].stickerId).toBe('1');
			expect(userStickers[0].sourceId).toBe('source1');
			// Rarity should be assigned
			expect(userStickers[0].rarityId).toBeDefined();
		});

		it('should assign rarities within config max sort order', () => {
			const result = {
				stickerIds: ['1', '2', '3', '4', '5'],
				collectionId: 'collection1',
				hasNewStickers: true,
				newCount: 5,
				duplicateCount: 0
			};

			const config = { ...DEFAULT_BOOSTER_CONFIG, maxRaritySortOrder: 1 };
			const userStickers = createUserStickersFromPack(result, mockRarities, 'source1', config);

			// Check all assigned rarities are within max sort order
			for (const us of userStickers) {
				const rarity = mockRarities.find((r) => r.id === us.rarityId);
				if (rarity) {
					expect(rarity.sortOrder).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe('canOpenBoosterPack', () => {
		it('should return true when collection has enough stickers', () => {
			expect(canOpenBoosterPack(mockStickers)).toBe(true);
		});

		it('should return false when collection has too few stickers', () => {
			expect(canOpenBoosterPack(mockStickers.slice(0, 2))).toBe(false);
		});

		it('should use custom minimum', () => {
			expect(canOpenBoosterPack(mockStickers.slice(0, 3), 3)).toBe(true);
			expect(canOpenBoosterPack(mockStickers.slice(0, 2), 3)).toBe(false);
		});

		it('should return false for empty collection', () => {
			expect(canOpenBoosterPack([])).toBe(false);
		});
	});

	describe('getBoosterPackPreview', () => {
		it('should return preview with rarity distribution', () => {
			const preview = getBoosterPackPreview(mockRarities);

			expect(preview.length).toBeGreaterThan(0);
			// Should only include rarities within max sort order
			for (const item of preview) {
				const rarity = mockRarities.find((r) => String(r.id) === item.rarityId);
				expect(rarity).toBeDefined();
				if (rarity) {
					expect(rarity.sortOrder).toBeLessThanOrEqual(DEFAULT_BOOSTER_CONFIG.maxRaritySortOrder);
				}
			}
		});

		it('should filter rarities by max sort order', () => {
			const config = { ...DEFAULT_BOOSTER_CONFIG, maxRaritySortOrder: 1 };
			const preview = getBoosterPackPreview(mockRarities, config);

			for (const item of preview) {
				const rarity = mockRarities.find((r) => String(r.id) === item.rarityId);
				expect(rarity).toBeDefined();
				if (rarity) {
					expect(rarity.sortOrder).toBeLessThanOrEqual(1);
				}
			}
		});

		it('should return probabilities that relate to rarity weights', () => {
			const preview = getBoosterPackPreview(mockRarities);

			// Probabilities should be numbers
			for (const item of preview) {
				expect(typeof item.probability).toBe('number');
				expect(item.probability).toBeGreaterThanOrEqual(0);
				expect(item.probability).toBeLessThanOrEqual(100);
			}
		});

		it('should return empty array for empty rarities', () => {
			const preview = getBoosterPackPreview([]);
			expect(preview).toEqual([]);
		});
	});

	describe('DEFAULT_BOOSTER_CONFIG', () => {
		it('should have packSize defined', () => {
			expect(DEFAULT_BOOSTER_CONFIG.packSize).toBe(5);
		});

		it('should have maxRaritySortOrder defined', () => {
			expect(DEFAULT_BOOSTER_CONFIG.maxRaritySortOrder).toBe(2);
		});
	});
});
