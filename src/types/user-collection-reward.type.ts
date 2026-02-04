import type { ID } from '$types/core.type';

/**
 * User collection reward tracking - tracks when rewards were last claimed per collection
 * Stored in the _user_collection_rewards SQLite table
 */
export interface UserCollectionReward {
	id: ID;
	collectionId: ID;
	lastClaimedAt: string;
}

/**
 * Summary of an eligible reward collection
 * Includes information about when rewards can be claimed
 */
export interface EligibleRewardCollection {
	/** The collection ID */
	collectionId: ID;

	/** The collection title */
	collectionTitle: string;

	/** The collection cover image */
	collectionCoverImage?: string;

	/** Number of unique stickers owned in this collection */
	stickersOwned: number;

	/** Total stickers in the collection */
	totalStickers: number;

	/** When rewards were last claimed (empty if never) */
	lastClaimedAt?: string;

	/** Minutes since last claim (undefined if never claimed) */
	minutesSinceClaim?: number;

	/** Whether the user can claim a reward now (10+ min passed or never claimed) */
	canClaim: boolean;

	/** Number of rewards that can be claimed (accumulated over time) */
	claimableCount: number;

	/** Minutes until next reward becomes available (0-9) */
	minutesUntilNext: number;
}
