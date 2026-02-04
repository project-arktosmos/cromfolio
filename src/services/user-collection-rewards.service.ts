/**
 * User Collection Rewards Service
 * Tracks time-based rewards for collections where user owns stickers
 * Persisted to SQLite via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import type { ID } from '$types/core.type';
import type {
	UserCollectionReward,
	EligibleRewardCollection
} from '$types/user-collection-reward.type';
import type { UserBoosterPack } from '$types/user-booster-pack.type';

/**
 * Get all collections where user has at least 1 sticker, with reward eligibility info
 */
export async function getEligibleRewardCollections(): Promise<EligibleRewardCollection[]> {
	return await invoke<EligibleRewardCollection[]>('get_eligible_reward_collections');
}

/**
 * Get all user collection rewards (tracking records)
 */
export async function getAllUserCollectionRewards(): Promise<UserCollectionReward[]> {
	return await invoke<UserCollectionReward[]>('get_all_user_collection_rewards');
}

/**
 * Get a user collection reward by collection ID
 */
export async function getUserCollectionReward(
	collectionId: ID
): Promise<UserCollectionReward | null> {
	return await invoke<UserCollectionReward | null>('get_user_collection_reward', {
		collectionId: String(collectionId)
	});
}

/**
 * Claim all accumulated rewards for a collection - awards booster packs and updates the claim timestamp
 * Returns all the earned booster packs
 */
export async function claimCollectionReward(collectionId: ID): Promise<UserBoosterPack[]> {
	return await invoke<UserBoosterPack[]>('claim_collection_reward', {
		collectionId: String(collectionId)
	});
}

/**
 * Delete a user collection reward by collection ID
 */
export async function deleteUserCollectionReward(collectionId: ID): Promise<boolean> {
	return await invoke<boolean>('delete_user_collection_reward', {
		collectionId: String(collectionId)
	});
}

/**
 * Delete all user collection rewards
 */
export async function deleteAllUserCollectionRewards(): Promise<number> {
	return await invoke<number>('delete_all_user_collection_rewards');
}

/**
 * Cooldown time in minutes for rewards
 */
export const REWARD_COOLDOWN_MINUTES = 10;

/**
 * Get the time remaining until a collection's reward can be claimed
 * Returns 0 if the reward is already available
 */
export function getTimeRemainingMinutes(collection: EligibleRewardCollection): number {
	if (collection.canClaim) return 0;
	if (collection.minutesSinceClaim === undefined) return 0;
	const remaining = REWARD_COOLDOWN_MINUTES - collection.minutesSinceClaim;
	return Math.max(0, remaining);
}

/**
 * Format time remaining as a human-readable string
 */
export function formatTimeRemaining(minutes: number): string {
	if (minutes <= 0) return 'Available now';
	if (minutes < 1) return 'Less than a minute';
	if (minutes === 1) return '1 minute';
	return `${Math.ceil(minutes)} minutes`;
}
