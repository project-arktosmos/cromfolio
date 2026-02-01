<script lang="ts">
	import SourceTab from './SourceTab.svelte';
	import { searchAnimals, type AnimalSearchResult } from '$services/fetch.service';
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

	const config: SourceTabConfig<AnimalSearchResult> = {
		// Search configuration
		searchPlaceholder: 'Search animal genera (e.g., Panthera, Canis)...',
		showYearFilter: false,
		searchFunction: (query) => searchAnimals(query),

		// Result accessors
		getId: (result) => result.wikidataId,
		getTitle: (result) => result.genusName,
		getYear: (result) => result.taxonomicFamily || '',
		getPoster: (result) => result.thumbUrl || result.imageUrl,
		getUniqueKey: (result) => result.wikidataId,

		// Image fetching configuration
		contentType: 'animal',
		externalIdType: 'wikidata',
		imageSources: ['wikidata', 'inaturalist'],
		imageSourceTabs: [
			{ key: 'wikidata', label: 'Wikimedia' },
			{ key: 'inaturalist', label: 'iNaturalist' }
		],
		showCharacters: false,
		progressSources: ['wikidata', 'inaturalist'],

		// Source creation configuration
		sourceType: 'animal',
		sourceBadgeText: 'Animal Genus',
		sourceBadgeClass: 'badge-warning',
		providerType: 'animal',
		buildSource: (result: AnimalSearchResult, coverImage: string | undefined) => ({
			sourceType: 'animal',
			title: result.genusName,
			description: result.description || `Genus ${result.genusName}${result.taxonomicFamily ? ` (${result.taxonomicFamily})` : ''}`,
			coverImage,
			wikidataId: result.wikidataId,
			scientificName: result.genusName,
			taxonomicClass: result.taxonomicFamily
		}),
		getExternalLinks: (result) => [
			{
				label: 'Wikidata',
				url: `https://www.wikidata.org/wiki/${result.wikidataId}`
			}
		],
		getExtraDetails: (result) => {
			const details = [];
			if (result.taxonomicFamily) {
				details.push({ label: 'Family', value: result.taxonomicFamily });
			}
			if (result.commonName) {
				details.push({ label: 'Common Name', value: result.commonName });
			}
			if (result.description) {
				details.push({ label: 'Description', value: result.description.substring(0, 100) + (result.description.length > 100 ? '...' : '') });
			}
			return details;
		}
	};
</script>

<SourceTab {config} {sourceType} {onSourceTypeChange} />
