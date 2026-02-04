<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import GameSidebar from '$components/core/GameSidebar.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/game-menu.json';
	import { getUnopenedUserBoosterPacksSummary } from '$services/user-booster-packs.service';
	import { getCollection } from '$services/collections.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import type { BoosterPackSummary } from '$types/user-booster-pack.type';
	import type { Collection } from '$types/collection.type';

	let { children } = $props();

	interface CollectionWithPendingPacks {
		collection: Collection;
		pendingCount: number;
	}

	let collectionsWithPacks = $state<CollectionWithPendingPacks[]>([]);
	let selectedValue = $state('');
	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await loadPendingBoosterPacks();
		pollingInterval = setInterval(loadPendingBoosterPacks, 1000);
	});

	onDestroy(() => {
		if (pollingInterval) {
			clearInterval(pollingInterval);
		}
	});

	async function loadPendingBoosterPacks() {
		const summaries: BoosterPackSummary[] = await getUnopenedUserBoosterPacksSummary();

		const results: CollectionWithPendingPacks[] = [];
		for (const summary of summaries) {
			const collection = await getCollection(summary.collectionId);
			if (collection) {
				results.push({
					collection,
					pendingCount: summary.count
				});
			}
		}

		collectionsWithPacks = results;
	}

	function handleSelectChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const collectionId = select.value;

		const selected = collectionsWithPacks.find(
			(c) => String(c.collection.id) === collectionId
		);

		if (selected) {
			boosterPackModalService.open(
				selected.collection.id,
				selected.pendingCount,
				'navbar',
				() => {
					loadPendingBoosterPacks();
				}
			);
		}

		// Reset to placeholder
		selectedValue = '';
	}
</script>

<div class="flex h-screen flex-col">
	<div class="navbar bg-base-300">
		<div class="navbar-start">
			<span class="text-lg font-bold">cromfolio</span>
		</div>
		<div class="navbar-end">
			{#if collectionsWithPacks.length > 0}
				<select
					class="select select-bordered select-sm mr-4"
					bind:value={selectedValue}
					onchange={handleSelectChange}
				>
					<option value="" disabled>Pending Booster Packs</option>
					{#each collectionsWithPacks as { collection, pendingCount }}
						<option value={collection.id}>
							{collection.title} ({pendingCount})
						</option>
					{/each}
				</select>
			{/if}
			<div class="border-2 border-purple-500 rounded p-2">
				<button class="btn btn-sm" disabled>button</button>
			</div>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<GameSidebar items={menuData.items} />

		<main class="bg-base-100 flex flex-1 flex-col overflow-y-auto p-6">
			{@render children?.()}
		</main>
	</div>
</div>

<ToastContainer />
