import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { weightedRandomSelect, getRarityWeight, type WeightedItem } from '$utils/weighted-select';

describe('weighted-select', () => {
	describe('weightedRandomSelect', () => {
		beforeEach(() => {
			vi.spyOn(Math, 'random');
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should return empty array for empty input', () => {
			const result = weightedRandomSelect([], 5);
			expect(result).toEqual([]);
		});

		it('should return empty array when total weight is 0', () => {
			const items: WeightedItem<string>[] = [
				{ item: 'a', weight: 0 },
				{ item: 'b', weight: 0 }
			];
			const result = weightedRandomSelect(items, 3);
			expect(result).toEqual([]);
		});

		it('should select requested number of items', () => {
			const items: WeightedItem<string>[] = [
				{ item: 'a', weight: 1 },
				{ item: 'b', weight: 1 },
				{ item: 'c', weight: 1 }
			];

			// Mock random to return consistent value
			vi.mocked(Math.random).mockReturnValue(0.5);

			const result = weightedRandomSelect(items, 5);
			expect(result).toHaveLength(5);
		});

		it('should favor higher weighted items', () => {
			const items: WeightedItem<string>[] = [
				{ item: 'common', weight: 1000 },
				{ item: 'rare', weight: 1 }
			];

			// With low random value, should select common
			vi.mocked(Math.random).mockReturnValue(0.1);
			const result = weightedRandomSelect(items, 1);
			expect(result[0]).toBe('common');
		});

		it('should allow rare items when random is high', () => {
			const items: WeightedItem<string>[] = [
				{ item: 'common', weight: 100 },
				{ item: 'rare', weight: 1 }
			];

			// With very high random value (close to 1), should select rare
			// Total weight = 101, rare is at 100-101, so need random > 100/101 = 0.99
			vi.mocked(Math.random).mockReturnValue(0.999);
			const result = weightedRandomSelect(items, 1);
			expect(result[0]).toBe('rare');
		});

		it('should handle single item', () => {
			const items: WeightedItem<number>[] = [{ item: 42, weight: 10 }];

			vi.mocked(Math.random).mockReturnValue(0.5);
			const result = weightedRandomSelect(items, 3);

			expect(result).toEqual([42, 42, 42]);
		});

		it('should handle selection with replacement (duplicates allowed)', () => {
			const items: WeightedItem<string>[] = [{ item: 'only', weight: 1 }];

			vi.mocked(Math.random).mockReturnValue(0.5);
			const result = weightedRandomSelect(items, 3);

			expect(result).toHaveLength(3);
			expect(result.every((r) => r === 'only')).toBe(true);
		});

		it('should handle floating point edge case with fallback', () => {
			const items: WeightedItem<string>[] = [
				{ item: 'a', weight: 0.1 },
				{ item: 'b', weight: 0.1 },
				{ item: 'fallback', weight: 0.1 }
			];

			// Mock random to return value that might cause floating point issues
			vi.mocked(Math.random).mockReturnValue(0.9999999999);
			const result = weightedRandomSelect(items, 1);

			// Should fallback to last item if floating point issue occurs
			expect(result).toHaveLength(1);
			expect(items.map((i) => i.item)).toContain(result[0]);
		});

		it('should work with complex objects', () => {
			interface ComplexItem {
				id: number;
				name: string;
			}

			const items: WeightedItem<ComplexItem>[] = [
				{ item: { id: 1, name: 'First' }, weight: 1 },
				{ item: { id: 2, name: 'Second' }, weight: 1 }
			];

			vi.mocked(Math.random).mockReturnValue(0.1);
			const result = weightedRandomSelect(items, 1);

			expect(result[0]).toHaveProperty('id');
			expect(result[0]).toHaveProperty('name');
		});
	});

	describe('getRarityWeight', () => {
		it('should return 10000 for sortOrder 0 (common)', () => {
			const weight = getRarityWeight(0, 4);
			expect(weight).toBe(10000); // 10^(4-0) = 10^4 = 10000
		});

		it('should return 1000 for sortOrder 1 (uncommon)', () => {
			const weight = getRarityWeight(1, 4);
			expect(weight).toBe(1000); // 10^(4-1) = 10^3 = 1000
		});

		it('should return 100 for sortOrder 2 (rare)', () => {
			const weight = getRarityWeight(2, 4);
			expect(weight).toBe(100); // 10^(4-2) = 10^2 = 100
		});

		it('should return 10 for sortOrder 3 (epic)', () => {
			const weight = getRarityWeight(3, 4);
			expect(weight).toBe(10); // 10^(4-3) = 10^1 = 10
		});

		it('should return 1 for sortOrder 4 (legendary)', () => {
			const weight = getRarityWeight(4, 4);
			expect(weight).toBe(1); // 10^(4-4) = 10^0 = 1
		});

		it('should use default maxSortOrder of 4', () => {
			const weight = getRarityWeight(2);
			expect(weight).toBe(100); // 10^(4-2) = 10^2 = 100
		});

		it('should work with custom maxSortOrder', () => {
			// With 3 rarity tiers (0, 1, 2)
			expect(getRarityWeight(0, 2)).toBe(100); // 10^2
			expect(getRarityWeight(1, 2)).toBe(10); // 10^1
			expect(getRarityWeight(2, 2)).toBe(1); // 10^0
		});

		it('should handle sortOrder higher than maxSortOrder', () => {
			// Results in negative exponent -> fraction
			const weight = getRarityWeight(5, 4);
			expect(weight).toBe(0.1); // 10^(4-5) = 10^(-1) = 0.1
		});

		it('should create logarithmic distribution', () => {
			// Each tier should be 10x rarer than the previous
			const weights = [0, 1, 2, 3, 4].map((order) => getRarityWeight(order, 4));

			expect(weights[0] / weights[1]).toBe(10);
			expect(weights[1] / weights[2]).toBe(10);
			expect(weights[2] / weights[3]).toBe(10);
			expect(weights[3] / weights[4]).toBe(10);
		});
	});

	describe('integration: weighted selection with rarity weights', () => {
		it('should create proper rarity distribution', () => {
			interface RarityItem {
				name: string;
				sortOrder: number;
			}

			const rarities: RarityItem[] = [
				{ name: 'common', sortOrder: 0 },
				{ name: 'uncommon', sortOrder: 1 },
				{ name: 'rare', sortOrder: 2 },
				{ name: 'epic', sortOrder: 3 },
				{ name: 'legendary', sortOrder: 4 }
			];

			const weightedItems: WeightedItem<RarityItem>[] = rarities.map((r) => ({
				item: r,
				weight: getRarityWeight(r.sortOrder, 4)
			}));

			// Verify weights are set correctly
			expect(weightedItems[0].weight).toBe(10000); // common
			expect(weightedItems[4].weight).toBe(1); // legendary

			// Total weight = 10000 + 1000 + 100 + 10 + 1 = 11111
			const totalWeight = weightedItems.reduce((sum, w) => sum + w.weight, 0);
			expect(totalWeight).toBe(11111);
		});
	});
});
