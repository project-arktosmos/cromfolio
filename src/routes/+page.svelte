<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { getAllUserStickers } from '$services/user-stickers.service';
	import { triviaModalService } from '$services/trivia-modal.service';
	import type { Collection } from '$types/collection.type';
	import type { Rarity } from '$types/rarity.type';
	import { getGridPageAspectRatio } from '$types/album-layout.type';

	const PAGE_ASPECT = getGridPageAspectRatio();

	// Pokemon generation to region mapping
	const GENERATION_REGIONS: Record<number, string> = {
		1: 'Kanto',
		2: 'Johto',
		3: 'Hoenn',
		4: 'Sinnoh',
		5: 'Unova',
		6: 'Kalos',
		7: 'Alola',
		8: 'Galar',
		9: 'Paldea'
	};

	// Extract generation number from collection title
	function getGenerationFromTitle(title: string): number | null {
		// Match patterns like "Generation 1", "Gen 1", "Gen1", "generation I"
		const match = title.match(/gen(?:eration)?\s*(\d+|[ivx]+)/i);
		if (!match) return null;

		const genStr = match[1].toLowerCase();
		// Handle Roman numerals
		const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
		if (romanMap[genStr]) return romanMap[genStr];

		// Handle numeric
		const num = parseInt(genStr, 10);
		return isNaN(num) ? null : num;
	}

	interface CollectionGenInfo {
		generationLabel: string;
		regionLabel: string;
	}

	function getRegionForCollection(collection: Collection): CollectionGenInfo | null {
		// Check for "all pokemon" collection
		if (/all\s*pok[eé]mon/i.test(collection.title)) {
			return {
				generationLabel: 'Pokémon: Generations 1 - 9',
				regionLabel: 'All Regions'
			};
		}

		const gen = getGenerationFromTitle(collection.title);
		if (!gen || !GENERATION_REGIONS[gen]) return null;
		return {
			generationLabel: `Pokémon: Generation ${gen}`,
			regionLabel: GENERATION_REGIONS[gen]
		};
	}

	let collections: Collection[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);

	// Detailed stats per collection with rarity breakdown
	interface CollectionDetailedStats {
		total: number;
		owned: number;
		rarityBreakdown: Map<string, number>;
		completionScore: number;
		maxCompletionScore: number;
	}
	let collectionStickerCounts = $state<Map<string, CollectionDetailedStats>>(new Map());

	onMount(async () => {
		[collections, rarities] = await Promise.all([getAllCollections(), getRarityCollection()]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		await loadCollectionStats();
		isLoading = false;
	});

	async function loadCollectionStats() {
		const counts = new Map<string, CollectionDetailedStats>();
		const userStickers = await getAllUserStickers();

		const maxSortOrder = rarities.length > 0 ? Math.max(...rarities.map((r) => r.sortOrder)) : 0;

		for (const collection of collections) {
			const collectionId = String(collection.id);
			const collectionStickersData = await getStickersForCollection(collection.id);

			// Filter user stickers to only those earned FROM this collection (by collectionId)
			const userStickersForCollection = userStickers.filter(
				(us) => String(us.collectionId) === collectionId
			);

			// Get unique owned sticker IDs for this collection
			const ownedStickerIdsForCollection = new Set(
				userStickersForCollection.map((us) => String(us.stickerId))
			);

			const ownedInCollection = collectionStickersData.filter((s) =>
				ownedStickerIdsForCollection.has(String(s.id))
			);

			// Build rarity breakdown (only from this collection's user stickers)
			const rarityBreakdown = new Map<string, number>();
			for (const us of userStickersForCollection) {
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (rarityId) {
					rarityBreakdown.set(rarityId, (rarityBreakdown.get(rarityId) ?? 0) + 1);
				}
			}

			// Build best rarity per sticker for THIS collection only
			const bestRarityPerSticker = new Map<string, string>();
			for (const us of userStickersForCollection) {
				const stickerId = String(us.stickerId);
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (!rarityId) continue;

				const existingRarityId = bestRarityPerSticker.get(stickerId);
				if (!existingRarityId) {
					bestRarityPerSticker.set(stickerId, rarityId);
				} else {
					const existingRarity = raritiesMap.get(existingRarityId);
					const newRarity = raritiesMap.get(rarityId);
					if (newRarity && existingRarity && newRarity.sortOrder > existingRarity.sortOrder) {
						bestRarityPerSticker.set(stickerId, rarityId);
					}
				}
			}

			// Completion score based on best rarity per unique sticker
			let completionScore = 0;
			for (const sticker of ownedInCollection) {
				const rarityId = bestRarityPerSticker.get(String(sticker.id));
				if (rarityId) {
					const rarity = raritiesMap.get(rarityId);
					completionScore += (rarity?.sortOrder ?? 0) + 1;
				} else {
					completionScore += 1;
				}
			}

			const maxCompletionScore = collectionStickersData.length * (maxSortOrder + 1);

			counts.set(collectionId, {
				total: collectionStickersData.length,
				owned: ownedInCollection.length,
				rarityBreakdown,
				completionScore,
				maxCompletionScore
			});
		}
		collectionStickerCounts = counts;
	}

	function getCollectionStats(collectionId: string | number): CollectionDetailedStats {
		return (
			collectionStickerCounts.get(String(collectionId)) ?? {
				total: 0,
				owned: 0,
				rarityBreakdown: new Map(),
				completionScore: 0,
				maxCompletionScore: 0
			}
		);
	}

</script>

<div class="flex h-full flex-col">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Collections</h1>
		<p class="text-base-content/70 mt-1">Browse your collections</p>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if collections.length === 0}
		<div class="alert alert-info">
			<span>No collections available. Create collections in the admin panel first.</span>
		</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
				{#each collections as collection (collection.id)}
					{@const stats = getCollectionStats(collection.id)}
					{@const isComplete =
						stats.maxCompletionScore > 0 &&
						stats.completionScore === stats.maxCompletionScore}
					{@const genInfo = getRegionForCollection(collection)}
					<div
						class={classNames('card bg-base-200 transition-all hover:shadow-lg', {
							'ring-success ring-2': isComplete
						})}
					>
						<figure class="relative">
							{#if collection.coverImage}
								<img
									src={collection.coverImage}
									alt={collection.title}
									class="w-full object-cover"
									style="aspect-ratio: {PAGE_ASPECT};"
								/>
							{:else}
								<div
									class="bg-base-300 text-base-content/30 flex w-full items-center justify-center"
									style="aspect-ratio: {PAGE_ASPECT};"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-12 w-12"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
										/>
									</svg>
								</div>
							{/if}
							{#if genInfo}
								<div class="absolute left-0 right-0 top-0 bg-black/70 px-2 py-3 text-center text-white">
									<div class="text-3xl font-bold">{genInfo.regionLabel}</div>
								</div>
								<div class="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-2 text-center text-white">
									<div class="text-lg font-bold">{genInfo.generationLabel}</div>
								</div>
							{/if}
						</figure>
						<div class="card-body p-4">
							<div class="flex items-center gap-2">
								<span class="truncate font-medium">{collection.title}</span>
								{#if isComplete}
									<span class="badge badge-success badge-sm">Complete</span>
								{/if}
							</div>
							<!-- Rarity breakdown display -->
							{#if stats.rarityBreakdown.size > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each rarities.toSorted((a, b) => b.sortOrder - a.sortOrder) as rarity (rarity.id)}
										{@const count = stats.rarityBreakdown.get(String(rarity.id)) ?? 0}
										{#if count > 0}
											<span
												class="rounded px-1.5 py-0.5 text-xs font-medium"
												style="background: linear-gradient(135deg, {rarity.colorFrom}, {rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
												title="{rarity.name}: {count}"
											>
												{count}
											</span>
										{/if}
									{/each}
								</div>
							{:else if stats.owned === 0}
								<div class="text-base-content/40 mt-1 text-sm">No stickers yet</div>
							{/if}
							<!-- Completion progress bar (score-based) -->
							{#if stats.maxCompletionScore > 0}
								{@const completionPercent = Math.round(
									(stats.completionScore / stats.maxCompletionScore) * 100
								)}
								<div class="mt-1 flex items-center gap-2">
									<progress
										class={classNames('progress h-2 flex-1', {
											'progress-success': completionPercent === 100,
											'progress-warning':
												completionPercent >= 50 && completionPercent < 100,
											'progress-primary': completionPercent < 50
										})}
										value={stats.completionScore}
										max={stats.maxCompletionScore}
									></progress>
									<span class="text-base-content/60 w-10 text-right font-mono text-xs"
										>{completionPercent}%</span
									>
								</div>
							{/if}
							<!-- Action buttons -->
							<div class="mt-2 flex gap-2">
								<a
									href="/collections/{collection.id}"
									class="btn btn-secondary btn-sm flex-1"
								>
									Open Album
								</a>
								<button
									class="btn btn-primary btn-sm flex-1"
									onclick={() => triviaModalService.open(collection)}
								>
									Play Trivia
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
