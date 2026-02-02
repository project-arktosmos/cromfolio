<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchAnime, type AnimeSearchResult } from '$services/fetch.service';
	import type { SourceTabConfig, SourceType } from './sources.types';

	let {
		sourceType,
		onSourceTypeChange
	}: {
		sourceType: SourceType;
		onSourceTypeChange: (type: SourceType) => void;
	} = $props();

	// Helper to get display title
	function getDisplayTitle(anime: AnimeSearchResult): string {
		return anime.titleEnglish || anime.titleRomaji;
	}

	// Helper to format anime format type
	function formatType(format: string | null | undefined): string {
		if (!format) return 'Anime';
		switch (format) {
			case 'TV':
				return 'TV Series';
			case 'TV_SHORT':
				return 'TV Short';
			case 'MOVIE':
				return 'Movie';
			case 'SPECIAL':
				return 'Special';
			case 'OVA':
				return 'OVA';
			case 'ONA':
				return 'ONA';
			case 'MUSIC':
				return 'Music';
			default:
				return format;
		}
	}

	const config: SourceTabConfig<AnimeSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search anime...',
		showYearFilter: false,
		searchFunction: (query) => searchAnime(query, 1, 15),

		// Result accessors
		getId: (result) => String(result.id),
		getTitle: (result) => getDisplayTitle(result),
		getYear: (result) => (result.startYear ? String(result.startYear) : 'TBA'),
		getPoster: (result) => result.coverImageLarge || result.coverImage,
		getUniqueKey: (result) => String(result.id),

		// Image fetching configuration
		contentType: 'anime',
		externalIdType: 'anilist',
		imageSources: ['anilist', 'jikan', 'anilist_characters', 'jikan_characters'],
		imageSourceTabs: [
			{ key: 'anilist', label: 'AniList' },
			{ key: 'jikan', label: 'Jikan' },
			{ key: 'characters', label: 'Characters' }
		],
		showCharacters: true,
		progressSources: ['anilist', 'jikan', 'anilist_characters', 'jikan_characters'],

		// Source creation configuration
		sourceType: 'anime',
		sourceBadgeText: 'Anime',
		sourceBadgeClass: 'badge-info',
		providerType: 'anime',
		buildSource: (result: AnimeSearchResult, coverImage: string | undefined) => {
			const year = result.startYear;
			const genres = result.genres?.slice(0, 3).join(', ') || '';
			return {
				sourceType: 'anime',
				title: getDisplayTitle(result),
				description: `Anime${year ? ` (${year})` : ''}${genres ? ` - ${genres}` : ''}`,
				coverImage,
				anilistId: result.id
			};
		},
		getExternalLinks: (result) => [
			{
				label: 'AniList',
				url: `https://anilist.co/anime/${result.id}`
			}
		],
		getExtraDetails: (result) => {
			const details = [];
			if (result.format) {
				details.push({ label: 'Format', value: formatType(result.format) });
			}
			if (result.episodes) {
				details.push({ label: 'Episodes', value: String(result.episodes) });
			}
			if (result.averageScore) {
				details.push({ label: 'Score', value: `${result.averageScore}%` });
			}
			if (result.status) {
				details.push({ label: 'Status', value: result.status });
			}
			if (result.genres && result.genres.length > 0) {
				details.push({ label: 'Genres', value: result.genres.slice(0, 3).join(', ') });
			}
			return details;
		}
	};
</script>

<SourceTab {config} {sourceType} {onSourceTypeChange} />
