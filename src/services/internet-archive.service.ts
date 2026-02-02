/**
 * Internet Archive API Service
 * Browse and fetch public domain music from archive.org
 */

// Types for Internet Archive API responses
export interface IASearchResult {
	identifier: string;
	title: string;
	creator?: string;
	date?: string;
	year?: number;
	description?: string;
	collection?: string[];
	mediatype: string;
	downloads?: number;
	item_count?: number;
}

export interface IAMetadata {
	identifier: string;
	title: string;
	creator?: string;
	date?: string;
	description?: string;
	subject?: string[];
	collection?: string[];
	licenseurl?: string;
	runtime?: string;
}

export interface IAFile {
	name: string;
	source: string;
	format: string;
	size?: string;
	length?: string;
	title?: string;
	track?: string;
	artist?: string;
	album?: string;
}

export interface IAItemDetails {
	metadata: IAMetadata;
	files: IAFile[];
}

export interface IASearchResponse {
	response: {
		numFound: number;
		start: number;
		docs: IASearchResult[];
	};
}

// Predefined collections for public domain music
export const IA_MUSIC_COLLECTIONS = [
	{ id: 'audio', label: 'All Audio', description: 'All audio content' },
	{
		id: 'opensource_audio',
		label: 'Open Source Audio',
		description: 'Community-contributed audio'
	},
	{ id: '78rpm', label: '78 RPM Records', description: 'Historical 78 RPM recordings' },
	{ id: 'etree', label: 'Live Music Archive', description: 'Live concert recordings' },
	{ id: 'netlabels', label: 'Netlabels', description: 'Free music from netlabels' },
	{
		id: 'audio_music',
		label: 'Music',
		description: 'General music collection'
	},
	{
		id: 'audio_podcast',
		label: 'Podcasts',
		description: 'Podcast recordings'
	},
	{
		id: 'librivoxaudio',
		label: 'LibriVox',
		description: 'Public domain audiobooks'
	}
] as const;

const IA_BASE_URL = 'https://archive.org';

/**
 * Search Internet Archive for audio items
 */
export async function searchInternetArchive(
	query: string,
	options: {
		collection?: string;
		rows?: number;
		page?: number;
		sortBy?: 'downloads' | 'date' | 'title' | 'publicdate';
		sortOrder?: 'asc' | 'desc';
	} = {}
): Promise<{ results: IASearchResult[]; total: number }> {
	const { collection, rows = 50, page = 1, sortBy = 'downloads', sortOrder = 'desc' } = options;

	// Build search query
	let searchQuery = `mediatype:audio`;

	if (query.trim()) {
		searchQuery += ` AND (${query.trim()})`;
	}

	if (collection && collection !== 'audio') {
		searchQuery += ` AND collection:${collection}`;
	}

	// Fields to fetch
	const fields = [
		'identifier',
		'title',
		'creator',
		'date',
		'year',
		'description',
		'collection',
		'mediatype',
		'downloads',
		'item_count'
	].join(',');

	const params = new URLSearchParams({
		q: searchQuery,
		fl: fields,
		rows: rows.toString(),
		page: page.toString(),
		sort: `${sortBy} ${sortOrder}`,
		output: 'json'
	});

	const url = `${IA_BASE_URL}/advancedsearch.php?${params}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Internet Archive search failed: ${response.statusText}`);
	}

	const data: IASearchResponse = await response.json();

	return {
		results: data.response.docs,
		total: data.response.numFound
	};
}

/**
 * Get detailed metadata and file list for an item
 */
export async function getItemDetails(identifier: string): Promise<IAItemDetails> {
	const url = `${IA_BASE_URL}/metadata/${identifier}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch item details: ${response.statusText}`);
	}

	const data = await response.json();

	return {
		metadata: data.metadata,
		files: data.files || []
	};
}

/**
 * Get direct URL for a file in an item
 */
export function getFileUrl(identifier: string, filename: string): string {
	return `${IA_BASE_URL}/download/${identifier}/${encodeURIComponent(filename)}`;
}

/**
 * Get thumbnail URL for an item
 */
export function getThumbnailUrl(identifier: string): string {
	return `${IA_BASE_URL}/services/img/${identifier}`;
}

/**
 * Get item page URL
 */
export function getItemPageUrl(identifier: string): string {
	return `${IA_BASE_URL}/details/${identifier}`;
}

/**
 * Filter audio files from item files
 */
export function getAudioFiles(files: IAFile[]): IAFile[] {
	const audioFormats = [
		'VBR MP3',
		'MP3',
		'Ogg Vorbis',
		'FLAC',
		'128Kbps MP3',
		'64Kbps MP3',
		'Flac',
		'Ogg'
	];

	return files.filter((file) => audioFormats.some((format) => file.format?.includes(format)));
}

/**
 * Get the best quality audio file for playback
 * Prefers MP3 for browser compatibility
 */
export function getBestAudioFile(files: IAFile[]): IAFile | null {
	const audioFiles = getAudioFiles(files);

	// Priority order for playback
	const formatPriority = ['VBR MP3', 'MP3', '128Kbps MP3', 'Ogg Vorbis', 'Ogg', '64Kbps MP3'];

	for (const format of formatPriority) {
		const file = audioFiles.find((f) => f.format?.includes(format));
		if (file) return file;
	}

	return audioFiles[0] || null;
}

/**
 * Format duration string from seconds or time string
 */
export function formatDuration(length: string | undefined): string {
	if (!length) return '--:--';

	// If already in MM:SS or HH:MM:SS format
	if (length.includes(':')) return length;

	// Convert seconds to MM:SS
	const seconds = parseFloat(length);
	if (isNaN(seconds)) return '--:--';

	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size
 */
export function formatFileSize(size: string | undefined): string {
	if (!size) return '';

	const bytes = parseInt(size, 10);
	if (isNaN(bytes)) return size;

	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	return `${value.toFixed(1)} ${units[unitIndex]}`;
}
