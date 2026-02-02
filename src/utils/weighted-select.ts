/**
 * Weighted random selection utility
 * Used for rarity-based sticker spawning in booster packs
 */

export interface WeightedItem<T> {
	item: T;
	weight: number;
}

/**
 * Selects items using weighted random selection
 * Higher weights = higher chance of selection
 * Items can be selected multiple times (with replacement)
 *
 * @param items - Array of items with weights
 * @param count - Number of items to select
 * @returns Selected items (can include duplicates)
 */
export function weightedRandomSelect<T>(items: WeightedItem<T>[], count: number): T[] {
	if (items.length === 0) return [];

	const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
	if (totalWeight === 0) return [];

	const result: T[] = [];

	for (let i = 0; i < count; i++) {
		let random = Math.random() * totalWeight;

		for (const { item, weight } of items) {
			random -= weight;
			if (random <= 0) {
				result.push(item);
				break;
			}
		}

		// Fallback in case of floating point edge case
		if (result.length <= i) {
			result.push(items[items.length - 1].item);
		}
	}

	return result;
}

/**
 * Calculate rarity weight based on sort order
 * Each tier is 10x harder to get than the previous
 *
 * @param sortOrder - Rarity sort order (0 = common, higher = rarer)
 * @param maxSortOrder - Maximum sort order in the system (default: 4 for legendary)
 * @returns Weight for weighted selection
 */
export function getRarityWeight(sortOrder: number, maxSortOrder: number = 4): number {
	return Math.pow(10, maxSortOrder - sortOrder);
}
