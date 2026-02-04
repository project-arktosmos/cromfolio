<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/game-menu.json';
	import { getUnopenedUserBoosterPacksSummary } from '$services/user-booster-packs.service';
	import { getCollection } from '$services/collections.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import type { BoosterPackSummary } from '$types/user-booster-pack.type';
	import type { Collection } from '$types/collection.type';

	let currentPath = $derived($page.url.pathname);

	function isActive(itemPath: string): boolean {
		return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
	}

	function getNavLinkClasses(itemPath: string): string {
		return classNames('btn btn-ghost btn-sm', {
			'btn-active': isActive(itemPath)
		});
	}

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
			<a href="/game" class="btn btn-ghost text-lg font-bold">Cromfolio</a>
		</div>
		<div class="navbar-end gap-2">
			{#each menuData.items as item (item.id)}
				<a href={item.path} class={getNavLinkClasses(item.path)}>
					{item.label}
				</a>
			{/each}
			{#if collectionsWithPacks.length > 0}
				<select
					class="select select-bordered select-sm"
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
		</div>
	</div>

	<main class="bg-base-100 flex flex-1 flex-col overflow-y-auto">
		{@render children?.()}
	</main>
</div>

<ToastContainer />
