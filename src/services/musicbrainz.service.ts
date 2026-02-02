/**
 * MusicBrainz Service
 * Wraps Tauri commands for MusicBrainz API access
 */

import { invoke } from '@tauri-apps/api/core';
import type {
	MusicBrainzArtistResult,
	MusicBrainzReleaseResult,
	MusicBrainzRecordingResult,
	GrammyEntityType
} from '$types/grammy.type';

/**
 * Search for artists on MusicBrainz
 */
export async function searchMusicBrainzArtists(
	query: string,
	limit: number = 10
): Promise<MusicBrainzArtistResult[]> {
	return invoke<MusicBrainzArtistResult[]>('search_musicbrainz_artists', { query, limit });
}

/**
 * Search for releases (albums) on MusicBrainz
 */
export async function searchMusicBrainzReleases(
	query: string,
	limit: number = 10
): Promise<MusicBrainzReleaseResult[]> {
	return invoke<MusicBrainzReleaseResult[]>('search_musicbrainz_releases', { query, limit });
}

/**
 * Search for recordings (songs) on MusicBrainz
 */
export async function searchMusicBrainzRecordings(
	query: string,
	limit: number = 10
): Promise<MusicBrainzRecordingResult[]> {
	return invoke<MusicBrainzRecordingResult[]>('search_musicbrainz_recordings', { query, limit });
}

/**
 * Get cover art for a release
 * @param releaseMbid - The release MBID
 * @param releaseGroupMbid - Optional release group MBID for fallback
 * @returns Cover art URL or null if not found
 */
export async function getMusicBrainzCoverArt(
	releaseMbid: string,
	releaseGroupMbid?: string
): Promise<string | null> {
	return invoke<string | null>('get_musicbrainz_cover_art', {
		releaseMbid,
		releaseGroupMbid
	});
}

/**
 * Search MusicBrainz based on entity type
 * Returns results normalized to a common format
 */
export async function searchMusicBrainz(
	query: string,
	entityType: GrammyEntityType,
	limit: number = 10
): Promise<
	MusicBrainzArtistResult[] | MusicBrainzReleaseResult[] | MusicBrainzRecordingResult[]
> {
	switch (entityType) {
		case 'artist':
			return searchMusicBrainzArtists(query, limit);
		case 'album':
			return searchMusicBrainzReleases(query, limit);
		case 'recording':
			return searchMusicBrainzRecordings(query, limit);
		default:
			return searchMusicBrainzReleases(query, limit);
	}
}

/**
 * Helper to get display name from any MusicBrainz result
 */
export function getMusicBrainzResultName(
	result: MusicBrainzArtistResult | MusicBrainzReleaseResult | MusicBrainzRecordingResult
): string {
	if ('name' in result) {
		return result.name; // Artist
	}
	return result.title; // Release or Recording
}

/**
 * Helper to get MBID from any MusicBrainz result
 */
export function getMusicBrainzResultMbid(
	result: MusicBrainzArtistResult | MusicBrainzReleaseResult | MusicBrainzRecordingResult
): string {
	return result.mbid;
}

/**
 * Helper to check if result is an artist
 */
export function isMusicBrainzArtist(
	result: MusicBrainzArtistResult | MusicBrainzReleaseResult | MusicBrainzRecordingResult
): result is MusicBrainzArtistResult {
	return 'name' in result && 'artistType' in result;
}

/**
 * Helper to check if result is a release
 * Note: Can't rely on 'releaseGroupMbid' being present since Rust uses skip_serializing_if
 */
export function isMusicBrainzRelease(
	result: MusicBrainzArtistResult | MusicBrainzReleaseResult | MusicBrainzRecordingResult
): result is MusicBrainzReleaseResult {
	// Releases have 'title' but NOT 'name' (artists have 'name') and NOT 'lengthMs' (recordings have that)
	return 'title' in result && !('name' in result) && !('lengthMs' in result);
}

/**
 * Helper to check if result is a recording
 */
export function isMusicBrainzRecording(
	result: MusicBrainzArtistResult | MusicBrainzReleaseResult | MusicBrainzRecordingResult
): result is MusicBrainzRecordingResult {
	return 'title' in result && 'lengthMs' in result;
}
