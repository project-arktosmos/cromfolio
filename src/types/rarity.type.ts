/**
 * Rarity types for card rarity levels with gradient colors
 */

import type { ID } from '$types/core.type';

export interface Rarity {
	id: ID;
	name: string;
	/** First color of the gradient (hex format, e.g., "#FF5733") */
	colorFrom: string;
	/** Second color of the gradient (hex format, e.g., "#33FF57") */
	colorTo: string;
	/** Sort order for display (lower = more common) */
	sortOrder: number;
	createdAt?: string;
	updatedAt?: string;
}
