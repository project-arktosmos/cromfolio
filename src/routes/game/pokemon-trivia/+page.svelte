<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getActivePokemonTriviaTemplatesV2 } from '$services/pokemon-trivia-templates.service';
	import { getTriviaStats } from '$services/pokemon-trivia-game.service';
	import { triviaModalService } from '$services/trivia-modal.service';
	import type { Collection } from '$types/collection.type';
	import type { PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';
	import type { TriviaStats } from '$types/game-state.type';

	// Child components
	import TriviaHeader from './components/TriviaHeader.svelte';
	import CollectionSelect from './components/CollectionSelect.svelte';

	// View state
	let isLoading = $state(true);

	// Data
	let collections: Collection[] = $state([]);
	let collectionStickerCounts = $state<Map<string, number>>(new Map());
	let templates: PokemonTriviaTemplateV2[] = $state([]);

	// Stats from service (loaded async)
	let stats = $state<TriviaStats>({
		id: 'pokemon-trivia-stats',
		totalGamesPlayed: 0,
		totalCorrect: 0,
		totalWrong: 0,
		bestStreak: 0,
		longestGame: 0
	});

	onMount(async () => {
		if (browser) {
			stats = await getTriviaStats();
		}

		collections = await getAllCollections();
		const counts = new Map<string, number>();
		for (const collection of collections) {
			const stickers = await getStickersForCollection(collection.id);
			counts.set(String(collection.id), stickers.length);
		}
		collectionStickerCounts = counts;
		templates = await getActivePokemonTriviaTemplatesV2();
		isLoading = false;
	});

	function handleCollectionSelect(event: CustomEvent<Collection>) {
		triviaModalService.open(event.detail);
	}
</script>

<div class="space-y-6">
	<TriviaHeader
		title="Pokemon Trivia"
		subtitle="Select a collection to start the trivia game"
		{stats}
	/>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<CollectionSelect
			{collections}
			{collectionStickerCounts}
			hasTemplates={templates.length > 0}
			on:select={handleCollectionSelect}
		/>
	{/if}
</div>
