/**
 * Booster Pack Service
 *
 * Handles booster pack opening logic including random selection
 * and sticker acquisition.
 *
 * Note: In this system, stickers don't have inherent rarities.
 * Rarity is assigned when a user acquires a sticker.
 */

import type { BoosterPackConfig, BoosterPackResult } from '$types/game-state.type';
import type { Rarity } from '$types/rarity.type';
import type { Sticker } from '$types/sticker.type';
import type { UserSticker } from '$types/user-sticker.type';
import type { ID } from '$types/core.type';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_BOOSTER_CONFIG: BoosterPackConfig = {
	packSize: 5,
	maxRaritySortOrder: 2 // Limits rarity when assigning to acquired stickers
};

// ============================================================================
// Random Selection
// ============================================================================

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Weighted random selection
 * Items with higher weights are more likely to be selected
 */
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
	if (items.length === 0) {
		throw new Error('Cannot select from empty array');
	}
	if (items.length !== weights.length) {
		throw new Error('Items and weights arrays must have same length');
	}

	const totalWeight = weights.reduce((sum, w) => sum + w, 0);
	let random = Math.random() * totalWeight;

	for (let i = 0; i < items.length; i++) {
		random -= weights[i];
		if (random <= 0) {
			return items[i];
		}
	}

	return items[items.length - 1];
}

// ============================================================================
// Booster Pack Selection
// ============================================================================

/**
 * Select stickers for a booster pack using random selection
 *
 * @param allStickers - All stickers available in the collection
 * @param config - Booster pack configuration
 * @returns Array of selected stickers
 */
export function selectBoosterStickers(
	allStickers: Sticker[],
	config: BoosterPackConfig = DEFAULT_BOOSTER_CONFIG
): Sticker[] {
	if (allStickers.length === 0) {
		return [];
	}

	// Simply shuffle and take the first N stickers
	// Stickers don't have inherent rarities in this system
	return shuffleArray(allStickers).slice(0, config.packSize);
}

/**
 * Select a random rarity for an acquired sticker based on weights
 * Lower sortOrder (more common) = higher weight
 *
 * @param rarities - Available rarities
 * @param config - Configuration with max rarity limit
 * @returns Selected rarity
 */
export function selectRandomRarity(
	rarities: Rarity[],
	config: BoosterPackConfig = DEFAULT_BOOSTER_CONFIG
): Rarity | null {
	if (rarities.length === 0) {
		return null;
	}

	// Filter by max rarity sort order
	const eligibleRarities = rarities.filter((r) => r.sortOrder <= config.maxRaritySortOrder);

	if (eligibleRarities.length === 0) {
		return rarities[0]; // Return most common if no eligible
	}

	// Calculate weights: lower sortOrder = higher weight
	const weights = eligibleRarities.map((r) => {
		// Check for custom weights
		if (config.rarityWeights) {
			const customWeight = config.rarityWeights[String(r.id)];
			if (customWeight !== undefined) {
				return customWeight;
			}
		}
		// Default: inverse relationship to sortOrder
		return Math.max(1, 10 - r.sortOrder * 2);
	});

	return weightedRandomSelect(eligibleRarities, weights);
}

// ============================================================================
// Pack Opening
// ============================================================================

/**
 * Process opening a booster pack
 *
 * @param selectedStickers - Stickers selected for this pack
 * @param collectionId - Collection the pack is from
 * @param existingOwnedIds - Set of sticker IDs the user already owns
 * @returns Booster pack result with stats
 */
export function processBoosterPackOpening(
	selectedStickers: Sticker[],
	collectionId: ID,
	existingOwnedIds: Set<string>
): BoosterPackResult {
	let newCount = 0;
	let duplicateCount = 0;

	const stickerIds = selectedStickers.map((s) => {
		const id = String(s.id);
		if (existingOwnedIds.has(id)) {
			duplicateCount++;
		} else {
			newCount++;
		}
		return id;
	});

	return {
		stickerIds,
		collectionId,
		hasNewStickers: newCount > 0,
		newCount,
		duplicateCount
	};
}

/**
 * Create user stickers from booster pack result with random rarities
 *
 * @param result - Booster pack result
 * @param rarities - Available rarities for random selection
 * @param sourceId - Source ID for the stickers
 * @param config - Booster pack configuration
 */
export function createUserStickersFromPack(
	result: BoosterPackResult,
	rarities: Rarity[],
	sourceId: ID,
	config: BoosterPackConfig = DEFAULT_BOOSTER_CONFIG
): Omit<UserSticker, 'id' | 'acquiredAt'>[] {
	return result.stickerIds.map((stickerId) => {
		const rarity = selectRandomRarity(rarities, config);
		return {
			stickerId,
			rarityId: rarity ? rarity.id : undefined,
			sourceId
		};
	});
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if user can open a booster pack for a collection
 */
export function canOpenBoosterPack(
	collectionStickers: Sticker[],
	minStickers: number = 5
): boolean {
	return collectionStickers.length >= minStickers;
}

/**
 * Get booster pack preview with rarity distribution
 */
export function getBoosterPackPreview(
	rarities: Rarity[],
	config: BoosterPackConfig = DEFAULT_BOOSTER_CONFIG
): { rarityId: string; rarityName: string; probability: number }[] {
	const eligibleRarities = rarities.filter((r) => r.sortOrder <= config.maxRaritySortOrder);

	if (eligibleRarities.length === 0) {
		return [];
	}

	// Calculate weights
	const weights = eligibleRarities.map((r) => {
		if (config.rarityWeights) {
			const customWeight = config.rarityWeights[String(r.id)];
			if (customWeight !== undefined) {
				return customWeight;
			}
		}
		return Math.max(1, 10 - r.sortOrder * 2);
	});

	const totalWeight = weights.reduce((sum, w) => sum + w, 0);

	return eligibleRarities
		.map((r, i) => ({
			rarityId: String(r.id),
			rarityName: r.name,
			probability: Math.round((weights[i] / totalWeight) * 100)
		}))
		.sort((a, b) => b.probability - a.probability);
}
