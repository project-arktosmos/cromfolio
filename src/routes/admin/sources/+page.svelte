<script lang="ts">
	import MoviesTab from './MoviesTab.svelte';
	import TVTab from './TVTab.svelte';
	import VideogamesTab from './VideogamesTab.svelte';
	import AnimeTab from './AnimeTab.svelte';
	import SportsTab from './SportsTab.svelte';
	import AnimalsTab from './AnimalsTab.svelte';
	import AwardsTab from './AwardsTab.svelte';
	import GrammyTab from './GrammyTab.svelte';
	import GameConsolesTab from './GameConsolesTab.svelte';

	// Source type options for the select dropdown
	const sourceTypeOptions = [
		{ value: 'movies', label: 'Movies' },
		{ value: 'tv', label: 'TV Series' },
		{ value: 'videogames', label: 'Videogames' },
		{ value: 'anime', label: 'Anime' },
		{ value: 'sports', label: 'Sports' },
		{ value: 'animals', label: 'Animals' },
		{ value: 'awards', label: 'Award Lists' },
		{ value: 'grammy', label: 'Grammy Awards' },
		{ value: 'game-consoles', label: 'Game Consoles' }
	] as const;

	type SourceType = (typeof sourceTypeOptions)[number]['value'];

	// Top-level source type state
	let sourceType = $state<SourceType>('movies');

	function handleSourceTypeChange(newType: SourceType) {
		sourceType = newType;
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">External Sources</h1>

	{#if sourceType === 'movies'}
		<MoviesTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'tv'}
		<TVTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'videogames'}
		<VideogamesTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'anime'}
		<AnimeTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'sports'}
		<SportsTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'animals'}
		<AnimalsTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'awards'}
		<AwardsTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'grammy'}
		<GrammyTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{:else if sourceType === 'game-consoles'}
		<GameConsolesTab {sourceType} onSourceTypeChange={handleSourceTypeChange} />
	{/if}
</div>
