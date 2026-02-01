<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchGames, type GameSearchResult } from '$services/fetch.service';
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

	function getReleaseYear(game: GameSearchResult): string {
		if (game.firstReleaseDate) {
			return new Date(game.firstReleaseDate * 1000).getFullYear().toString();
		}
		return 'TBA';
	}

	const config: SourceTabConfig<GameSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search videogames...',
		showYearFilter: false,
		searchFunction: (query) => searchGames(query),

		// Result accessors
		getId: (result) => String(result.id),
		getTitle: (result) => result.name,
		getYear: (result) => getReleaseYear(result),
		getPoster: (result) => result.coverThumbUrl,
		getUniqueKey: (result) => `${result.source || 'igdb'}-${result.id}`,

		// Image fetching configuration
		contentType: 'game',
		externalIdType: 'igdb',
		imageSources: ['igdb', 'sgdb'],
		imageSourceTabs: [
			{ key: 'igdb', label: 'IGDB' },
			{ key: 'sgdb', label: 'SteamGridDB' }
		],
		showCharacters: false,
		progressSources: ['igdb', 'sgdb'],

		// Source creation configuration
		sourceType: 'videogame',
		sourceBadgeText: 'Game',
		sourceBadgeClass: 'badge-accent',
		providerType: 'game',
		buildSource: (result: GameSearchResult, coverImage: string | undefined) => {
			const genreNames = result.genres?.join(', ') || '';
			const releaseYear = getReleaseYear(result);
			return {
				sourceType: 'videogame',
				title: result.name,
				description: `Game${releaseYear !== 'TBA' ? ` (${releaseYear})` : ''}${genreNames ? ` - ${genreNames}` : ''}`,
				coverImage,
				igdbId: result.source === 'igdb' || !result.source ? result.id : undefined,
				sgdbId: result.source === 'sgdb' ? result.id : undefined,
				igdbSlug: result.slug
			};
		},
		getExternalLinks: (result) => {
			const links = [];
			if (result.source === 'igdb' || !result.source) {
				links.push({
					label: 'IGDB',
					url: `https://www.igdb.com/games/${result.slug}`
				});
			}
			return links;
		},
		getExtraDetails: (result) => {
			const details = [];
			if (result.rating) {
				details.push({ label: 'Rating', value: String(Math.round(result.rating)) });
			}
			if (result.platforms && result.platforms.length > 0) {
				const platformsStr =
					result.platforms.slice(0, 3).join(', ') +
					(result.platforms.length > 3 ? '...' : '');
				details.push({ label: 'Platforms', value: platformsStr });
			}
			if (result.genres && result.genres.length > 0) {
				details.push({ label: 'Genres', value: result.genres.slice(0, 3).join(', ') });
			}
			return details;
		}
	};
</script>

<SourceTab {config} {sourceType} {onSourceTypeChange} />
