<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchSportsTeams, type SportsTeamSearchResult } from '$services/fetch.service';
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

	const config: SourceTabConfig<SportsTeamSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search sports teams...',
		showYearFilter: false,
		searchFunction: (query) => searchSportsTeams(query),

		// Result accessors
		getId: (result) => result.id,
		getTitle: (result) => result.name,
		getYear: (result) => result.formedYear || '',
		getPoster: (result) => result.badgeUrl,
		getUniqueKey: (result) => result.id,

		// Image fetching configuration
		contentType: 'sports',
		externalIdType: 'sportsdb_team',
		imageSources: ['team'],
		imageSourceTabs: [{ key: 'team', label: 'Team Images' }],
		showCharacters: false,
		progressSources: ['team'],

		// Source creation configuration
		sourceType: 'sports_team',
		sourceBadgeText: 'Sports Team',
		sourceBadgeClass: 'badge-success',
		providerType: 'sports_team',
		buildSource: (result: SportsTeamSearchResult, coverImage: string | undefined) => ({
			sourceType: 'sports_team',
			title: result.name,
			description: `${result.sport} team - ${result.league}${result.country ? ` (${result.country})` : ''}`,
			coverImage,
			sportsDbTeamId: result.id,
			sportsDbLeagueId: result.leagueId,
			sport: result.sport,
			league: result.league,
			country: result.country
		}),
		getExternalLinks: (result) => [
			{
				label: 'TheSportsDB',
				url: `https://www.thesportsdb.com/team/${result.id}`
			}
		],
		getExtraDetails: (result) => {
			const details = [];
			details.push({ label: 'Sport', value: result.sport });
			details.push({ label: 'League', value: result.league });
			if (result.country) {
				details.push({ label: 'Country', value: result.country });
			}
			if (result.stadium) {
				details.push({ label: 'Stadium', value: result.stadium });
			}
			if (result.formedYear) {
				details.push({ label: 'Founded', value: result.formedYear });
			}
			return details;
		}
	};
</script>

<SourceTab {config} {sourceType} {onSourceTypeChange} />
