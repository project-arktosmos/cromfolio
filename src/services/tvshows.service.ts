/**
 * TV Shows Service
 * Manages a collection of TV shows for wikia discovery
 */

import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { TVShow } from '$types/tvshow.type';

export const tvShowsService = new ArrayServiceClass<TVShow>('tv-shows', []);

/**
 * Get the TV show collection
 */
export function getTVShowCollection() {
	return {
		shows: tvShowsService.all()
	};
}

/**
 * Add a TV show to the collection
 */
export function addTVShow(show: TVShow) {
	return tvShowsService.add(show);
}

/**
 * Remove a TV show from the collection
 */
export function removeTVShow(show: TVShow) {
	return tvShowsService.remove(show);
}

/**
 * Check if a TV show exists in the collection
 */
export function tvShowExists(id: string | number) {
	return tvShowsService.exists(id);
}
