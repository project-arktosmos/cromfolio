import { describe, it, expect } from 'vitest';
import {
	groupStickersByRarity,
	sortGroups,
	canMix,
	getNextRarity,
	getMixableGroups,
	getPossibleMixCount,
	calculateMixResult,
	getMixPreview,
	sortRarities,
	getRarityById,
	STICKERS_REQUIRED_TO_MIX
} from '$services/sticker-mixing.service';
import type { UserSticker } from '$types/user-sticker.type';
import type { Sticker } from '$types/sticker.type';
import type { Rarity } from '$types/rarity.type';

describe('sticker-mixing.service', () => {
	// Mock data
	const mockRarities: Rarity[] = [
		{ id: '1', name: 'Common', sortOrder: 0, colorFrom: '#gray', colorTo: '#darkgray' },
		{ id: '2', name: 'Uncommon', sortOrder: 1, colorFrom: '#green', colorTo: '#darkgreen' },
		{ id: '3', name: 'Rare', sortOrder: 2, colorFrom: '#blue', colorTo: '#darkblue' },
		{ id: '4', name: 'Epic', sortOrder: 3, colorFrom: '#purple', colorTo: '#darkpurple' }
	];

	const sortedRarities = [...mockRarities].sort((a, b) => a.sortOrder - b.sortOrder);

	const mockStickers: Map<string, Sticker> = new Map([
		['s1', { id: 's1', name: 'Pikachu', image: 'pika.png', sourceId: 'src1' }],
		['s2', { id: 's2', name: 'Charizard', image: 'char.png', sourceId: 'src1' }],
		['s3', { id: 's3', name: 'Bulbasaur', image: 'bulb.png', sourceId: 'src1' }]
	]);

	const mockUserStickers: UserSticker[] = [
		{ id: '1', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-01' },
		{ id: '2', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-02' },
		{ id: '3', stickerId: 's1', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-03' },
		{ id: '4', stickerId: 's2', sourceId: 'src1', rarityId: '2', acquiredAt: '2024-01-01' },
		{ id: '5', stickerId: 's3', sourceId: 'src1', rarityId: '1', acquiredAt: '2024-01-01' }
	];

	describe('groupStickersByRarity', () => {
		it('should group stickers by stickerId and rarityId', () => {
			const groups = groupStickersByRarity(mockUserStickers, mockStickers, mockRarities);

			expect(groups.length).toBe(3); // s1-r1 (3), s2-r2 (1), s3-r1 (1)

			const pikachuGroup = groups.find((g) => g.stickerId === 's1' && g.rarityId === '1');
			expect(pikachuGroup?.count).toBe(3);
		});

		it('should include sticker and rarity details', () => {
			const groups = groupStickersByRarity(mockUserStickers, mockStickers, mockRarities);

			const group = groups.find((g) => g.stickerId === 's1');
			expect(group?.sticker.name).toBe('Pikachu');
			expect(group?.rarity?.name).toBe('Common');
		});

		it('should handle missing sticker details gracefully', () => {
			const emptyStickers = new Map<string, Sticker>();
			const groups = groupStickersByRarity(mockUserStickers, emptyStickers, mockRarities);

			expect(groups.length).toBe(0); // No groups because sticker details not found
		});
	});

	describe('sortGroups', () => {
		it('should sort by sticker name then rarity', () => {
			const groups = groupStickersByRarity(mockUserStickers, mockStickers, mockRarities);
			const sorted = sortGroups(groups);

			// Bulbasaur < Charizard < Pikachu (alphabetically)
			expect(sorted[0].sticker.name).toBe('Bulbasaur');
			expect(sorted[1].sticker.name).toBe('Charizard');
			expect(sorted[2].sticker.name).toBe('Pikachu');
		});
	});

	describe('getNextRarity', () => {
		it('should return first rarity for null current', () => {
			const next = getNextRarity(null, sortedRarities);
			expect(next?.name).toBe('Common');
		});

		it('should return next rarity in ladder', () => {
			const current = { id: '1', sortOrder: 0 };
			const next = getNextRarity(current, sortedRarities);
			expect(next?.name).toBe('Uncommon');
		});

		it('should return null when at max rarity', () => {
			const current = { id: '4', sortOrder: 3 };
			const next = getNextRarity(current, sortedRarities);
			expect(next).toBeNull();
		});

		it('should return null for empty rarities', () => {
			const next = getNextRarity(null, []);
			expect(next).toBeNull();
		});
	});

	describe('canMix', () => {
		it('should return true when count >= 2 and next rarity exists', () => {
			const group = {
				stickerId: 's1',
				rarityId: '1',
				count: 2,
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[0],
				sourceId: 'src1'
			};

			expect(canMix(group, sortedRarities)).toBe(true);
		});

		it('should return false when count < 2', () => {
			const group = {
				stickerId: 's1',
				rarityId: '1',
				count: 1,
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[0],
				sourceId: 'src1'
			};

			expect(canMix(group, sortedRarities)).toBe(false);
		});

		it('should return false when at max rarity', () => {
			const group = {
				stickerId: 's1',
				rarityId: '4',
				count: 5,
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[3], // Epic - max rarity
				sourceId: 'src1'
			};

			expect(canMix(group, sortedRarities)).toBe(false);
		});
	});

	describe('getMixableGroups', () => {
		it('should filter to only mixable groups', () => {
			const groups = groupStickersByRarity(mockUserStickers, mockStickers, mockRarities);
			const mixable = getMixableGroups(groups, sortedRarities);

			// Only Pikachu with 3 copies at Common rarity can be mixed
			expect(mixable.length).toBe(1);
			expect(mixable[0].stickerId).toBe('s1');
		});
	});

	describe('getPossibleMixCount', () => {
		it('should calculate number of possible mixes', () => {
			const group = { count: 5 } as any;
			expect(getPossibleMixCount(group)).toBe(2); // 5 / 2 = 2

			const group2 = { count: 3 } as any;
			expect(getPossibleMixCount(group2)).toBe(1); // 3 / 2 = 1
		});
	});

	describe('calculateMixResult', () => {
		it('should return mix result with new rarity', () => {
			const group = {
				stickerId: 's1',
				rarityId: '1',
				count: 2,
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[0],
				sourceId: 'src1'
			};

			const result = calculateMixResult(group, sortedRarities);

			expect(result).not.toBeNull();
			expect(result?.newStickerId).toBe('s1');
			expect(result?.newRarityId).toBe('2'); // Uncommon
			expect(result?.consumed).toBe(STICKERS_REQUIRED_TO_MIX);
			expect(result?.success).toBe(true);
		});

		it('should return null when cannot mix', () => {
			const group = {
				stickerId: 's1',
				rarityId: '1',
				count: 1, // Not enough
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[0],
				sourceId: 'src1'
			};

			const result = calculateMixResult(group, sortedRarities);
			expect(result).toBeNull();
		});
	});

	describe('getMixPreview', () => {
		it('should return preview with next rarity info', () => {
			const group = {
				stickerId: 's1',
				rarityId: '1',
				count: 2,
				sticker: mockStickers.get('s1')!,
				rarity: mockRarities[0],
				sourceId: 'src1'
			};

			const preview = getMixPreview(group, sortedRarities);

			expect(preview).not.toBeNull();
			expect(preview?.nextRarity.name).toBe('Uncommon');
			expect(preview?.consumed).toBe(STICKERS_REQUIRED_TO_MIX);
		});
	});

	describe('sortRarities', () => {
		it('should sort rarities by sortOrder ascending', () => {
			const shuffled = [mockRarities[2], mockRarities[0], mockRarities[3], mockRarities[1]];
			const sorted = sortRarities(shuffled);

			expect(sorted[0].name).toBe('Common');
			expect(sorted[1].name).toBe('Uncommon');
			expect(sorted[2].name).toBe('Rare');
			expect(sorted[3].name).toBe('Epic');
		});
	});

	describe('getRarityById', () => {
		it('should find rarity by ID', () => {
			const rarity = getRarityById('2', sortedRarities);
			expect(rarity?.name).toBe('Uncommon');
		});

		it('should return null for unknown ID', () => {
			const rarity = getRarityById('999', sortedRarities);
			expect(rarity).toBeNull();
		});
	});
});
