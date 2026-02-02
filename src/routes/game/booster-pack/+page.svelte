<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { acquireSticker } from '$services/user-stickers.service';
	import {
		getUnopenedUserBoosterPacksSummary,
		openUserBoosterPacksBatch
	} from '$services/user-booster-packs.service';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Collection } from '$types/collection.type';
	import type { BoosterPackSummary } from '$types/user-booster-pack.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';

	const BOOSTER_PACK_SIZE = 5;

	let collections: Collection[] = $state([]);
	let packSummary: BoosterPackSummary[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap: Map<string, Rarity> = $state(new Map());
	let isLoading = $state(true);

	// Modal state for opening packs
	let isOpening = $state(false);
	let openingCollection: Collection | null = $state(null);
	let revealedStickers: Sticker[] = $state([]);
	let stickerRarityMap: Map<string, string> = $state(new Map());

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		const [collectionsData, summaryData, raritiesData] = await Promise.all([
			getAllCollections(),
			getUnopenedUserBoosterPacksSummary(),
			getRarityCollection()
		]);
		collections = collectionsData;
		packSummary = summaryData;
		rarities = raritiesData;
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		isLoading = false;
	}

	// Get pack count for a collection
	function getPackCount(collectionId: string | number): number {
		const summary = packSummary.find((s) => String(s.collectionId) === String(collectionId));
		return summary?.count ?? 0;
	}

	// Filter collections that have packs OR have cover images (for display)
	const collectionsWithPacks = $derived(
		collections.filter((c) => c.coverImage && getPackCount(c.id) > 0)
	);

	const collectionsWithCovers = $derived(collections.filter((c) => c.coverImage));

	// Total unopened packs
	const totalUnopenedPacks = $derived(packSummary.reduce((sum, s) => sum + s.count, 0));

	async function handleOpenPack(collection: Collection) {
		const packCount = getPackCount(collection.id);
		if (packCount === 0) return;

		isOpening = true;
		openingCollection = collection;

		// Mark one pack as opened in the database
		await openUserBoosterPacksBatch(collection.id, 1);

		// Load stickers for this collection
		const collectionStickers = await getStickersForCollection(collection.id);

		// Weighted selection by rarity
		const MAX_SORT_ORDER = 4;
		const weightedStickers = collectionStickers.map((sticker) => {
			const sortOrder = 0; // Stickers don't have inherent rarity
			const weight = getRarityWeight(sortOrder, MAX_SORT_ORDER);
			return { item: sticker, weight };
		});

		revealedStickers = weightedRandomSelect(weightedStickers, BOOSTER_PACK_SIZE);

		// Find the common rarity (sortOrder === 0)
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Track rarity for display
		const newRarityMap = new Map<string, string>();
		for (const sticker of revealedStickers) {
			if (commonRarity) {
				newRarityMap.set(String(sticker.id), String(commonRarity.id));
			}
		}
		stickerRarityMap = newRarityMap;

		// Acquire all stickers
		for (const sticker of revealedStickers) {
			await acquireSticker(sticker.id, sticker.sourceId, commonRarity?.id);
		}
	}

	async function handleCloseReveal() {
		isOpening = false;
		openingCollection = null;
		revealedStickers = [];
		stickerRarityMap = new Map();
		// Reload the summary to update counts
		packSummary = await getUnopenedUserBoosterPacksSummary();
	}

	function getStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}
</script>

<div class="flex h-full flex-col">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Booster Packs</h1>
		<p class="text-base-content/70 mt-1">
			{#if totalUnopenedPacks > 0}
				You have <span class="text-primary font-semibold">{totalUnopenedPacks}</span> unopened pack{totalUnopenedPacks !== 1 ? 's' : ''}
			{:else}
				Play Pokemon Trivia to earn booster packs!
			{/if}
		</p>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if collectionsWithPacks.length > 0}
		<!-- Owned packs section -->
		<div class="mb-8">
			<h2 class="mb-4 text-xl font-semibold">Your Booster Packs</h2>
			<div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{#each collectionsWithPacks as collection (collection.id)}
					{@const packCount = getPackCount(collection.id)}
					<button
						class="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
						onclick={() => handleOpenPack(collection)}
					>
						<!-- Booster pack composite -->
						<div class="relative w-full max-w-[200px]">
							<!-- Collection cover positioned within the transparent window -->
							<div class="absolute top-[6%] right-[12%] bottom-[8%] left-[12%] z-0 overflow-hidden">
								<img
									src={collection.coverImage}
									alt={collection.title}
									class="h-full w-full object-cover"
								/>
							</div>
							<!-- Booster pack template on top (has transparent center) -->
							<img
								src="/booster-pack.png"
								alt="Booster pack frame"
								class="relative z-10 w-full"
							/>
							<!-- Region text on the booster pack -->
							{#if collection.region}
								<div class="absolute inset-x-0 bottom-[10%] z-20 flex flex-col items-center text-lg font-semibold text-white drop-shadow-lg [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
									<span>{collection.region}</span>
									<span>Collection</span>
								</div>
							{/if}
							<!-- Pack count badge -->
							<div class="badge badge-primary badge-lg absolute -top-2 -right-2 z-30">
								x{packCount}
							</div>
						</div>
						<!-- Collection title below -->
						<span class="text-center text-sm font-medium">{collection.title}</span>
						<span class="text-primary text-xs">Click to open</span>
					</button>
				{/each}
			</div>
		</div>
	{:else if collectionsWithCovers.length === 0}
		<div class="alert alert-info">
			<span>No collections with cover images available.</span>
		</div>
	{:else}
		<div class="rounded-lg bg-base-200 p-8 text-center">
			<div class="mb-4 text-6xl">📦</div>
			<h2 class="mb-2 text-xl font-semibold">No Booster Packs Yet</h2>
			<p class="text-base-content/70">
				Play Pokemon Trivia to earn booster packs! Get 3 correct answers to earn 1 pack.
			</p>
		</div>
	{/if}
</div>

<!-- Pack Opening Modal -->
{#if isOpening && openingCollection}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleCloseReveal}
		role="dialog"
		aria-modal="true"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-base-100 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="bg-base-200 flex items-center justify-between border-b p-4">
				<div>
					<h3 class="text-xl font-bold">Booster Pack Opened!</h3>
					<p class="text-base-content/70 text-sm">{openingCollection.title}</p>
				</div>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={handleCloseReveal} aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<div class="flex flex-col items-center gap-6">
					{#if revealedStickers.length > 0}
						<div class="text-center">
							<div class="mb-2 text-4xl">🎁</div>
							<p class="text-base-content/70">
								You got {revealedStickers.length} sticker{revealedStickers.length !== 1 ? 's' : ''}!
							</p>
						</div>
						<div class="grid grid-cols-3 gap-4 md:grid-cols-5">
							{#each revealedStickers as sticker, index (index)}
								{@const rarity = getStickerRarity(sticker)}
								<div class="text-center">
									<StickerItem
										{sticker}
										bgColor={rarity?.colorFrom ?? '#8b5cf6'}
										borderColor={rarity?.colorTo}
									/>
									<p class="mt-1 truncate text-xs">{sticker.name}</p>
								</div>
							{/each}
						</div>
						<button class="btn btn-primary" onclick={handleCloseReveal}>
							Awesome!
						</button>
					{:else}
						<div class="flex justify-center p-8">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
