import type { ID } from '$types/core.type';

/**
 * User-owned booster pack - tracks booster packs earned from games
 * Stored in the _user_booster_packs SQLite table
 */
export interface UserBoosterPack {
	id: ID;
	collectionId: ID;
	earnedFrom: string;
	earnedAt: string;
	openedAt?: string;
}

/**
 * Summary of unopened booster packs by collection
 */
export interface BoosterPackSummary {
	collectionId: ID;
	count: number;
}
