/**
 * TV Show types for the wikia discovery feature
 */

import type { ID } from '$types/core.type';

export interface TVShow {
	id: ID;
	title: string;
	originalTitle?: string;
	year?: number;
	image?: string;
	genres?: string[];
	description?: string;
	addedAt?: string;
}

export interface TVShowCollection {
	shows: TVShow[];
}
