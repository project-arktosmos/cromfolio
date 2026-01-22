/**
 * MusicBrainz Service
 * Provides functions for searching music artists and releases via the MusicBrainz API
 *
 * MusicBrainz API is free and doesn't require authentication,
 * but requires a descriptive User-Agent header
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 */

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_ARCHIVE_URL = 'https://coverartarchive.org';
const USER_AGENT = 'Synaxis/1.0.0 (https://github.com/synaxis)';

// Rate limiting: MusicBrainz requires max 1 request per second
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;

	if (timeSinceLastRequest < 1100) {
		await new Promise((resolve) => setTimeout(resolve, 1100 - timeSinceLastRequest));
	}

	lastRequestTime = Date.now();

	return fetch(url, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json'
		}
	});
}

export interface MBTag {
	name: string;
	count: number;
}

export interface MBArtist {
	id: string;
	name: string;
	'sort-name': string;
	disambiguation?: string;
	type?: string;
	country?: string;
	area?: {
		id: string;
		name: string;
		'sort-name': string;
	};
	'life-span'?: {
		begin?: string;
		end?: string;
		ended?: boolean;
	};
	tags?: MBTag[];
}

export interface MBReleaseGroup {
	id: string;
	title: string;
	'primary-type'?: string;
	'first-release-date'?: string;
}

export interface MBRelease {
	id: string;
	title: string;
	status?: string;
	date?: string;
	country?: string;
	'release-group'?: MBReleaseGroup;
	'artist-credit'?: {
		artist: MBArtist;
		name?: string;
		joinphrase?: string;
	}[];
	'label-info'?: {
		'catalog-number'?: string;
		label?: {
			id: string;
			name: string;
		};
	}[];
	'track-count'?: number;
	media?: {
		format?: string;
		'track-count'?: number;
	}[];
	tags?: MBTag[];
}

export interface MBArtistSearchResult {
	created: string;
	count: number;
	offset: number;
	artists: MBArtist[];
}

export interface MBReleaseSearchResult {
	created: string;
	count: number;
	offset: number;
	releases: MBRelease[];
}

export interface CoverArtImage {
	id: string;
	image: string;
	thumbnails: {
		250?: string;
		500?: string;
		1200?: string;
		small?: string;
		large?: string;
	};
	front: boolean;
	back: boolean;
	types: string[];
}

export interface CoverArtResponse {
	images: CoverArtImage[];
	release: string;
}

/**
 * Search for artists on MusicBrainz
 */
export async function searchArtists(
	query: string,
	limit = 20
): Promise<MBArtistSearchResult | { error: string }> {
	try {
		const url = `${MUSICBRAINZ_BASE_URL}/artist/?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`;
		const response = await rateLimitedFetch(url);

		if (!response.ok) {
			console.error('[musicbrainz.service] Artist search failed:', response.status);
			return { error: `MusicBrainz API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] searchArtists error:', error);
		return { error: 'Failed to search MusicBrainz artists' };
	}
}

/**
 * Search for releases (albums) on MusicBrainz
 */
export async function searchReleases(
	query: string,
	limit = 20
): Promise<MBReleaseSearchResult | { error: string }> {
	try {
		const url = `${MUSICBRAINZ_BASE_URL}/release/?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`;
		const response = await rateLimitedFetch(url);

		if (!response.ok) {
			console.error('[musicbrainz.service] Release search failed:', response.status);
			return { error: `MusicBrainz API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] searchReleases error:', error);
		return { error: 'Failed to search MusicBrainz releases' };
	}
}

/**
 * Get cover art for a release from Cover Art Archive
 */
export async function getReleaseCoverArt(
	releaseId: string
): Promise<CoverArtResponse | { error: string }> {
	try {
		const url = `${COVER_ART_ARCHIVE_URL}/release/${releaseId}`;
		const response = await rateLimitedFetch(url);

		if (response.status === 404) {
			return { error: 'No cover art found for this release' };
		}

		if (!response.ok) {
			console.error('[musicbrainz.service] Cover art fetch failed:', response.status);
			return { error: `Cover Art Archive error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] getReleaseCoverArt error:', error);
		return { error: 'Failed to fetch cover art' };
	}
}

/**
 * Get artist details with tags
 */
export async function getArtist(artistId: string): Promise<MBArtist | { error: string }> {
	try {
		const url = `${MUSICBRAINZ_BASE_URL}/artist/${artistId}?inc=tags&fmt=json`;
		const response = await rateLimitedFetch(url);

		if (!response.ok) {
			console.error('[musicbrainz.service] Artist fetch failed:', response.status);
			return { error: `MusicBrainz API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] getArtist error:', error);
		return { error: 'Failed to fetch artist details' };
	}
}

export interface MBReleaseGroupsResult {
	'release-group-count': number;
	'release-group-offset': number;
	'release-groups': MBReleaseGroup[];
}

/**
 * Get all release groups (albums, EPs, singles, etc.) for an artist
 * Uses release-groups which are more useful than individual releases
 * (release-groups represent the album concept, releases are specific editions)
 */
export async function getArtistReleaseGroups(
	artistId: string,
	limit = 100,
	offset = 0
): Promise<MBReleaseGroupsResult | { error: string }> {
	try {
		const url = `${MUSICBRAINZ_BASE_URL}/release-group?artist=${artistId}&limit=${limit}&offset=${offset}&fmt=json`;
		const response = await rateLimitedFetch(url);

		if (!response.ok) {
			console.error('[musicbrainz.service] Artist release-groups fetch failed:', response.status);
			return { error: `MusicBrainz API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] getArtistReleaseGroups error:', error);
		return { error: 'Failed to fetch artist releases' };
	}
}

/**
 * Get cover art for a release group from Cover Art Archive
 */
export async function getReleaseGroupCoverArt(
	releaseGroupId: string
): Promise<CoverArtResponse | { error: string }> {
	try {
		const url = `${COVER_ART_ARCHIVE_URL}/release-group/${releaseGroupId}`;
		const response = await rateLimitedFetch(url);

		if (response.status === 404) {
			return { error: 'No cover art found for this release group' };
		}

		if (!response.ok) {
			console.error('[musicbrainz.service] Release group cover art fetch failed:', response.status);
			return { error: `Cover Art Archive error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[musicbrainz.service] getReleaseGroupCoverArt error:', error);
		return { error: 'Failed to fetch cover art' };
	}
}

/**
 * Transform MusicBrainz release group to our format
 */
export function transformReleaseGroup(releaseGroup: MBReleaseGroup): {
	id: string;
	title: string;
	type?: string;
	releaseYear?: number;
} {
	const releaseYear = releaseGroup['first-release-date']
		? parseInt(releaseGroup['first-release-date'].split('-')[0], 10)
		: undefined;

	return {
		id: releaseGroup.id,
		title: releaseGroup.title,
		type: releaseGroup['primary-type'],
		releaseYear: releaseYear && !isNaN(releaseYear) ? releaseYear : undefined
	};
}

/**
 * Transform MusicBrainz artist to our format
 */
export function transformArtist(artist: MBArtist): {
	id: string;
	name: string;
	disambiguation?: string;
	type?: string;
	country?: string;
	area?: string;
	beginYear?: number;
	endYear?: number;
	tags?: string[];
} {
	const beginYear = artist['life-span']?.begin
		? parseInt(artist['life-span'].begin.split('-')[0], 10)
		: undefined;
	const endYear = artist['life-span']?.end
		? parseInt(artist['life-span'].end.split('-')[0], 10)
		: undefined;

	return {
		id: artist.id,
		name: artist.name,
		disambiguation: artist.disambiguation,
		type: artist.type,
		country: artist.country,
		area: artist.area?.name,
		beginYear: beginYear && !isNaN(beginYear) ? beginYear : undefined,
		endYear: endYear && !isNaN(endYear) ? endYear : undefined,
		tags: artist.tags?.slice(0, 10).map((t) => t.name)
	};
}

/**
 * Transform MusicBrainz release to our format
 */
export function transformRelease(release: MBRelease): {
	id: string;
	title: string;
	artistId?: string;
	artistName: string;
	releaseDate?: string;
	releaseYear?: number;
	type?: string;
	format?: string;
	trackCount?: number;
	country?: string;
	label?: string;
	tags?: string[];
	imageUrl?: string;
} {
	const artistCredit = release['artist-credit']?.[0];
	const releaseYear = release.date ? parseInt(release.date.split('-')[0], 10) : undefined;
	const trackCount = release.media?.reduce((sum, m) => sum + (m['track-count'] || 0), 0);

	return {
		id: release.id,
		title: release.title,
		artistId: artistCredit?.artist?.id,
		artistName: artistCredit?.name || artistCredit?.artist?.name || 'Unknown Artist',
		releaseDate: release.date,
		releaseYear: releaseYear && !isNaN(releaseYear) ? releaseYear : undefined,
		type: release['release-group']?.['primary-type'],
		format: release.media?.[0]?.format,
		trackCount,
		country: release.country,
		label: release['label-info']?.[0]?.label?.name,
		tags: release.tags?.slice(0, 10).map((t) => t.name)
	};
}
