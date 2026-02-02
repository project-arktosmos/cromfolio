/**
 * Collection Stats Service
 *
 * Computes and caches collection statistics including ownership, rarity breakdown,
 * and completion scores. Shared between albums and booster-pack pages.
 */

import type { CollectionDetailedStats, CollectionStatsCache } from '$types/game-state.type';
import type { Rarity } from '$types/rarity.type';
import type { Sticker } from '$types/sticker.type';
import type { UserSticker } from '$types/user-sticker.type';
import type { Collection } from '$types/collection.type';
import type { ID } from '$types/core.type';

// ============================================================================
// Stats Computation
// ============================================================================

/**
 * Compute detailed statistics for a single collection
 *
 * @param collection - The collection to compute stats for
 * @param collectionStickers - Stickers that belong to this collection
 * @param userStickers - User's owned stickers
 * @param rarities - All rarities sorted by sortOrder
 */
export function computeCollectionStats(
	collection: Collection,
	collectionStickers: Sticker[],
	userStickers: UserSticker[],
	rarities: Rarity[]
): CollectionDetailedStats {
	const total = collectionStickers.length;

	// Get sticker IDs in this collection
	const collectionStickerIds = new Set(collectionStickers.map((s) => String(s.id)));

	// Filter user stickers to only those in this collection
	const ownedInCollection = userStickers.filter((us) =>
		collectionStickerIds.has(String(us.stickerId))
	);

	// Get unique owned sticker IDs
	const uniqueOwnedIds = new Set(ownedInCollection.map((us) => String(us.stickerId)));
	const owned = uniqueOwnedIds.size;

	// Compute rarity breakdown (count by rarity)
	const rarityBreakdown = new Map<string, number>();
	for (const rarity of rarities) {
		rarityBreakdown.set(String(rarity.id), 0);
	}
	for (const us of ownedInCollection) {
		const rarityId = String(us.rarityId);
		const current = rarityBreakdown.get(rarityId) || 0;
		rarityBreakdown.set(rarityId, current + 1);
	}

	// Compute weighted completion score
	// Higher rarity = more points
	const rarityWeights = new Map<string, number>();
	for (const rarity of rarities) {
		// Weight is based on sort order: higher sortOrder = rarer = more points
		rarityWeights.set(String(rarity.id), rarity.sortOrder + 1);
	}

	let completionScore = 0;
	let maxCompletionScore = 0;

	// Max score = all stickers at max rarity
	const maxRarityWeight = Math.max(...rarities.map((r) => r.sortOrder + 1), 1);
	maxCompletionScore = total * maxRarityWeight;

	// Actual score = sum of (best rarity weight for each unique sticker)
	// Get best rarity per sticker
	const bestRarityPerSticker = getBestRarityPerSticker(ownedInCollection, rarities);
	for (const rarityId of bestRarityPerSticker.values()) {
		const weight = rarityWeights.get(rarityId) || 1;
		completionScore += weight;
	}

	const completionPercent =
		maxCompletionScore > 0 ? Math.round((completionScore / maxCompletionScore) * 100) : 0;

	return {
		total,
		owned,
		rarityBreakdown,
		completionScore,
		maxCompletionScore,
		completionPercent
	};
}

/**
 * Compute stats for multiple collections
 */
export function computeMultipleCollectionStats(
	collections: Collection[],
	collectionStickersMap: Map<string, Sticker[]>,
	userStickers: UserSticker[],
	rarities: Rarity[]
): Map<string, CollectionDetailedStats> {
	const result = new Map<string, CollectionDetailedStats>();

	for (const collection of collections) {
		const collectionStickers = collectionStickersMap.get(String(collection.id)) || [];
		const stats = computeCollectionStats(collection, collectionStickers, userStickers, rarities);
		result.set(String(collection.id), stats);
	}

	return result;
}

// ============================================================================
// Rarity Helpers
// ============================================================================

/**
 * Get the best (highest) rarity for each sticker the user owns
 *
 * @param userStickers - User's owned stickers
 * @param rarities - All rarities sorted by sortOrder
 * @returns Map of stickerId -> best rarityId
 */
export function getBestRarityPerSticker(
	userStickers: UserSticker[],
	rarities: Rarity[]
): Map<string, string> {
	// Create rarity lookup by ID
	const rarityMap = new Map<string, Rarity>();
	for (const r of rarities) {
		rarityMap.set(String(r.id), r);
	}

	const bestRarity = new Map<string, string>();

	for (const us of userStickers) {
		const stickerId = String(us.stickerId);
		const rarityId = String(us.rarityId);
		const currentBest = bestRarity.get(stickerId);

		if (!currentBest) {
			bestRarity.set(stickerId, rarityId);
		} else {
			// Compare sort orders
			const currentRarity = rarityMap.get(currentBest);
			const newRarity = rarityMap.get(rarityId);

			if (newRarity && currentRarity && newRarity.sortOrder > currentRarity.sortOrder) {
				bestRarity.set(stickerId, rarityId);
			}
		}
	}

	return bestRarity;
}

/**
 * Get the default (lowest) rarity
 */
export function getDefaultRarity(rarities: Rarity[]): Rarity | undefined {
	if (rarities.length === 0) return undefined;
	return [...rarities].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/**
 * Get the next rarity up from a given rarity
 */
export function getNextRarity(currentRarity: Rarity, rarities: Rarity[]): Rarity | null {
	const sorted = [...rarities].sort((a, b) => a.sortOrder - b.sortOrder);
	const currentIndex = sorted.findIndex((r) => String(r.id) === String(currentRarity.id));

	if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
		return null;
	}

	return sorted[currentIndex + 1];
}

// ============================================================================
// Copy Count Helpers
// ============================================================================

/**
 * Get the number of copies of a sticker the user owns
 */
export function getCopyCount(stickerId: ID, userStickers: UserSticker[]): number {
	return userStickers.filter((us) => String(us.stickerId) === String(stickerId)).length;
}

/**
 * Get the number of copies at a specific rarity
 */
export function getCopyCountByRarity(
	stickerId: ID,
	rarityId: ID,
	userStickers: UserSticker[]
): number {
	return userStickers.filter(
		(us) => String(us.stickerId) === String(stickerId) && String(us.rarityId) === String(rarityId)
	).length;
}

/**
 * Get available copies (owned minus placed)
 */
export function getAvailableCopies(
	stickerId: ID,
	userStickers: UserSticker[],
	placedStickerIds: Set<string>
): number {
	const owned = getCopyCount(stickerId, userStickers);
	const placed = placedStickerIds.has(String(stickerId)) ? 1 : 0;
	return Math.max(0, owned - placed);
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Create an empty stats cache
 */
export function createEmptyStatsCache(): CollectionStatsCache {
	return {
		stats: new Map(),
		ownedStickerIds: new Set(),
		stickerRarityMap: new Map(),
		copyCountCache: new Map(),
		lastUpdated: 0
	};
}

/**
 * Check if cache is stale (older than threshold)
 */
export function isCacheStale(cache: CollectionStatsCache, maxAgeMs: number = 60000): boolean {
	return Date.now() - cache.lastUpdated > maxAgeMs;
}
