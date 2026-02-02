/**
 * Sticker Mixing Service
 *
 * Manages sticker mixing/upgrading logic. Mix multiple copies of the same
 * sticker to upgrade to a higher rarity.
 */

import type { OwnedStickerGroup, MixResult } from '$types/game-state.type';
import type { Rarity } from '$types/rarity.type';
import type { Sticker } from '$types/sticker.type';
import type { UserSticker } from '$types/user-sticker.type';
import type { ID } from '$types/core.type';

// ============================================================================
// Constants
// ============================================================================

/** Number of stickers required to mix into one higher rarity */
export const STICKERS_REQUIRED_TO_MIX = 2;

// ============================================================================
// Grouping Logic
// ============================================================================

/**
 * Group user stickers by (stickerId, rarityId) combination
 *
 * @param userStickers - User's owned stickers
 * @param stickerDetails - Map of sticker ID to sticker details
 * @param rarities - Array of all rarities
 * @returns Array of owned sticker groups
 */
export function groupStickersByRarity(
	userStickers: UserSticker[],
	stickerDetails: Map<string, Sticker>,
	rarities: Rarity[]
): OwnedStickerGroup[] {
	// Create rarity lookup
	const rarityMap = new Map<string, Rarity>();
	for (const r of rarities) {
		rarityMap.set(String(r.id), r);
	}

	// Group by (stickerId, rarityId)
	const groups = new Map<string, OwnedStickerGroup>();

	for (const us of userStickers) {
		const key = `${us.stickerId}-${us.rarityId}`;
		const existing = groups.get(key);

		if (existing) {
			existing.count++;
		} else {
			const sticker = stickerDetails.get(String(us.stickerId));
			const rarity = rarityMap.get(String(us.rarityId));

			if (sticker) {
				groups.set(key, {
					stickerId: String(us.stickerId),
					rarityId: String(us.rarityId),
					count: 1,
					sticker: {
						id: String(sticker.id),
						name: sticker.name,
						image: sticker.image,
						sourceId: String(sticker.sourceId)
					},
					rarity: rarity
						? {
								id: String(rarity.id),
								name: rarity.name,
								sortOrder: rarity.sortOrder,
								color: rarity.colorFrom
							}
						: null,
					sourceId: String(sticker.sourceId)
				});
			}
		}
	}

	return Array.from(groups.values());
}

/**
 * Sort groups by sticker name, then by rarity
 */
export function sortGroups(groups: OwnedStickerGroup[]): OwnedStickerGroup[] {
	return [...groups].sort((a, b) => {
		// First by sticker name
		const nameCompare = a.sticker.name.localeCompare(b.sticker.name);
		if (nameCompare !== 0) return nameCompare;

		// Then by rarity sort order (lower = more common = first)
		const rarityA = a.rarity?.sortOrder ?? 0;
		const rarityB = b.rarity?.sortOrder ?? 0;
		return rarityA - rarityB;
	});
}

// ============================================================================
// Mix Eligibility
// ============================================================================

/**
 * Check if a sticker group can be mixed (upgraded)
 *
 * @param group - The sticker group to check
 * @param sortedRarities - Rarities sorted by sortOrder ascending
 */
export function canMix(group: OwnedStickerGroup, sortedRarities: Rarity[]): boolean {
	// Need at least STICKERS_REQUIRED_TO_MIX copies
	if (group.count < STICKERS_REQUIRED_TO_MIX) {
		return false;
	}

	// Need a next rarity to upgrade to
	const nextRarity = getNextRarity(group.rarity, sortedRarities);
	return nextRarity !== null;
}

/**
 * Get the next rarity in the ladder
 *
 * @param currentRarity - Current rarity (or null for no rarity)
 * @param sortedRarities - Rarities sorted by sortOrder ascending
 */
export function getNextRarity(
	currentRarity: { id: string; sortOrder: number } | null,
	sortedRarities: Rarity[]
): Rarity | null {
	if (sortedRarities.length === 0) {
		return null;
	}

	// If no current rarity, start at the first rarity
	if (!currentRarity) {
		return sortedRarities[0] || null;
	}

	// Find current rarity index
	const currentIndex = sortedRarities.findIndex((r) => String(r.id) === currentRarity.id);

	// If not found or at max rarity, can't upgrade
	if (currentIndex === -1 || currentIndex >= sortedRarities.length - 1) {
		return null;
	}

	return sortedRarities[currentIndex + 1];
}

/**
 * Get all mixable groups from a list of groups
 */
export function getMixableGroups(
	groups: OwnedStickerGroup[],
	sortedRarities: Rarity[]
): OwnedStickerGroup[] {
	return groups.filter((group) => canMix(group, sortedRarities));
}

/**
 * Get number of possible mixes for a group
 */
export function getPossibleMixCount(group: OwnedStickerGroup): number {
	return Math.floor(group.count / STICKERS_REQUIRED_TO_MIX);
}

// ============================================================================
// Mix Execution
// ============================================================================

/**
 * Calculate the result of mixing stickers
 * This doesn't perform the mix, just calculates what would happen
 *
 * @param group - The sticker group to mix
 * @param sortedRarities - Rarities sorted by sortOrder ascending
 */
export function calculateMixResult(
	group: OwnedStickerGroup,
	sortedRarities: Rarity[]
): MixResult | null {
	if (!canMix(group, sortedRarities)) {
		return null;
	}

	const nextRarity = getNextRarity(group.rarity, sortedRarities);
	if (!nextRarity) {
		return null;
	}

	return {
		newStickerId: group.stickerId,
		newRarityId: String(nextRarity.id),
		consumed: STICKERS_REQUIRED_TO_MIX,
		success: true
	};
}

/**
 * Get info about what mixing a group would produce
 */
export function getMixPreview(
	group: OwnedStickerGroup,
	sortedRarities: Rarity[]
): { nextRarity: Rarity; consumed: number } | null {
	const nextRarity = getNextRarity(group.rarity, sortedRarities);
	if (!nextRarity || group.count < STICKERS_REQUIRED_TO_MIX) {
		return null;
	}

	return {
		nextRarity,
		consumed: STICKERS_REQUIRED_TO_MIX
	};
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Calculate results for mixing all eligible groups
 */
export function calculateBulkMixResults(
	groups: OwnedStickerGroup[],
	sortedRarities: Rarity[]
): MixResult[] {
	const results: MixResult[] = [];

	for (const group of groups) {
		const possibleMixes = getPossibleMixCount(group);

		for (let i = 0; i < possibleMixes; i++) {
			const result = calculateMixResult(group, sortedRarities);
			if (result) {
				results.push(result);
			}
		}
	}

	return results;
}

/**
 * Get summary of what bulk mixing would produce
 */
export function getBulkMixSummary(
	groups: OwnedStickerGroup[],
	sortedRarities: Rarity[]
): { totalMixes: number; stickersConsumed: number; upgrades: Map<string, number> } {
	const mixableGroups = getMixableGroups(groups, sortedRarities);

	let totalMixes = 0;
	let stickersConsumed = 0;
	const upgrades = new Map<string, number>();

	for (const group of mixableGroups) {
		const possibleMixes = getPossibleMixCount(group);
		const nextRarity = getNextRarity(group.rarity, sortedRarities);

		if (nextRarity && possibleMixes > 0) {
			totalMixes += possibleMixes;
			stickersConsumed += possibleMixes * STICKERS_REQUIRED_TO_MIX;

			const rarityKey = String(nextRarity.id);
			upgrades.set(rarityKey, (upgrades.get(rarityKey) || 0) + possibleMixes);
		}
	}

	return { totalMixes, stickersConsumed, upgrades };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sort rarities by sortOrder (ascending - common to rare)
 */
export function sortRarities(rarities: Rarity[]): Rarity[] {
	return [...rarities].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get rarity by ID from sorted array
 */
export function getRarityById(rarityId: ID, sortedRarities: Rarity[]): Rarity | null {
	return sortedRarities.find((r) => String(r.id) === String(rarityId)) || null;
}
