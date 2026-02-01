<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchTv, type TvSearchResult } from '$services/fetch.service';
	import type { SourceTabConfig } from './sources.types';

	// Source type props from parent
	type SourceType = 'movies' | 'tv' | 'videogames' | 'anime' | 'sports' | 'animals' | 'awards';
	let {
		sourceType,
		onSourceTypeChange
	}: {
		sourceType: SourceType;
		onSourceTypeChange: (type: SourceType) => void;
	} = $props();

	const config: SourceTabConfig<TvSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search TV series...',
		showYearFilter: true,
		searchFunction: searchTv,

		// Result accessors
		getId: (result) => result.imdbId,
		getTitle: (result) => result.title,
		getYear: (result) => result.year,
		getPoster: (result) => result.poster,
		getUniqueKey: (result) => result.imdbId,

		// Image fetching configuration
		contentType: 'tv',
		externalIdType: 'imdb',
		imageSources: ['tmdb', 'tvmaze', 'credits'],
		imageSourceTabs: [
			{ key: 'tmdb', label: 'TMDB' },
			{ key: 'tvmaze', label: 'TVMaze' },
			{ key: 'characters', label: 'Cast' }
		],
		showCharacters: true,
		progressSources: ['tmdb', 'tvmaze', 'credits'],

		// Source creation configuration
		sourceType: 'tv',
		sourceBadgeText: 'TV Series',
		sourceBadgeClass: 'badge-secondary',
		providerType: 'tv',
		buildSource: (result: TvSearchResult, coverImage: string | undefined) => ({
			sourceType: 'tv',
			title: result.title,
			description: `TV Series (${result.year})`,
			coverImage,
			imdbId: result.imdbId
		}),
		getExternalLinks: (result) => [
			{
				label: 'IMDb',
				url: `https://www.imdb.com/title/${result.imdbId}`
			}
		]
	};
</script>

<SourceTab {config} {sourceType} {onSourceTypeChange} />
