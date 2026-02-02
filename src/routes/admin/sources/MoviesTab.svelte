<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchMovies, type MovieSearchResult } from '$services/fetch.service';
	import type { SourceTabConfig, SourceType } from './sources.types';

	let {
		sourceType,
		onSourceTypeChange
	}: {
		sourceType: SourceType;
		onSourceTypeChange: (type: SourceType) => void;
	} = $props();

	const config: SourceTabConfig<MovieSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search movies...',
		showYearFilter: true,
		searchFunction: searchMovies,

		// Result accessors
		getId: (result) => result.imdbId,
		getTitle: (result) => result.title,
		getYear: (result) => result.year,
		getPoster: (result) => result.poster,
		getUniqueKey: (result) => result.imdbId,

		// Image fetching configuration
		contentType: 'movie',
		externalIdType: 'imdb',
		imageSources: ['tmdb'],
		imageSourceTabs: [{ key: 'tmdb', label: 'TMDB' }],
		showCharacters: false,
		progressSources: ['tmdb'],

		// Source creation configuration
		sourceType: 'movie',
		sourceBadgeText: 'Movie',
		sourceBadgeClass: 'badge-primary',
		providerType: 'movie',
		buildSource: (result: MovieSearchResult, coverImage: string | undefined) => ({
			sourceType: 'movie',
			title: result.title,
			description: `Movie (${result.year})`,
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
