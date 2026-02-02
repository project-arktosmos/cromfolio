<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { acquireSticker, getOwnedStickerIds, getStickerCopyCount, getAllUserStickers } from '$services/user-stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';
	import StickerItem from '$components/core/StickerItem.svelte';

	const BOOSTER_PACK_SIZE = 5;

	let collections: Collection[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let ownedStickerIds = $state<Set<string>>(new Set());

	// Cached stickers per collection
	let collectionStickers = $state<Map<string, Sticker[]>>(new Map());

	// Collection stats
	interface CollectionStats {
		total: number;
		owned: number;
		rarityBreakdown: Map<string, number>;
	}
	let collectionStats = $state<Map<string, CollectionStats>>(new Map());

	// Sticker rarity map (stickerId -> best rarityId)
	let stickerRarityMap = $state<Map<string, string>>(new Map());
	let copyCountCache = $state<Map<string, number>>(new Map());

	// Booster pack state
	let showBoosterPack = $state(false);
	let boosterStickers = $state<Sticker[]>([]);
	let boosterCollection = $state<Collection | null>(null);
	let isOpeningPack = $state(false);

	onMount(async () => {
		[collections, rarities] = await Promise.all([
			getAllCollections(),
			getRarityCollection()
		]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		await loadCollectionStats();
		await refreshOwnedSet();
		isLoading = false;
	});

	async function loadCollectionStats() {
		const stats = new Map<string, CollectionStats>();
		const stickersMap = new Map<string, Sticker[]>();
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);
		const userStickers = await getAllUserStickers();

		// Build best rarity per sticker
		const bestRarityPerSticker = new Map<string, string>();
		for (const us of userStickers) {
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

		for (const collection of collections) {
			const collectionStickersData = await getStickersForCollection(collection.id);
			const collectionStickerIds = new Set(collectionStickersData.map((s) => String(s.id)));

			const ownedInCollection = collectionStickersData.filter((s) => ownedSet.has(String(s.id)));

			// Build rarity breakdown
			const rarityBreakdown = new Map<string, number>();
			for (const us of userStickers) {
				if (!collectionStickerIds.has(String(us.stickerId))) continue;
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (rarityId) {
					rarityBreakdown.set(rarityId, (rarityBreakdown.get(rarityId) ?? 0) + 1);
				}
			}

			stats.set(String(collection.id), {
				total: collectionStickersData.length,
				owned: ownedInCollection.length,
				rarityBreakdown
			});
			stickersMap.set(String(collection.id), collectionStickersData);
		}
		collectionStats = stats;
		collectionStickers = stickersMap;
	}

	async function refreshOwnedSet() {
		const ids = await getOwnedStickerIds();
		ownedStickerIds = new Set(ids);

		const userStickers = await getAllUserStickers();
		const rarityMap = new Map<string, string>();

		for (const us of userStickers) {
			const stickerId = String(us.stickerId);
			const rarityId = us.rarityId ? String(us.rarityId) : '';

			if (!rarityId) continue;

			const existingRarityId = rarityMap.get(stickerId);
			if (!existingRarityId) {
				rarityMap.set(stickerId, rarityId);
			} else {
				const existingRarity = raritiesMap.get(existingRarityId);
				const newRarity = raritiesMap.get(rarityId);
				if (newRarity && existingRarity && newRarity.sortOrder > existingRarity.sortOrder) {
					rarityMap.set(stickerId, rarityId);
				}
			}
		}

		stickerRarityMap = rarityMap;
	}

	async function refreshCopyCount(stickerId: string) {
		const count = await getStickerCopyCount(stickerId);
		copyCountCache = new Map(copyCountCache).set(stickerId, count);
	}

	function getCollectionStickersData(collectionId: string | number): Sticker[] {
		return collectionStickers.get(String(collectionId)) ?? [];
	}

	function hasStickersInCollection(collectionId: string | number): boolean {
		return getCollectionStickersData(collectionId).length > 0;
	}

	function getStats(collectionId: string | number): CollectionStats {
		return collectionStats.get(String(collectionId)) ?? {
			total: 0,
			owned: 0,
			rarityBreakdown: new Map()
		};
	}

	function getStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}

	async function updateCollectionStats() {
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);
		const userStickers = await getAllUserStickers();
		const stats = new Map(collectionStats);

		for (const collection of collections) {
			const sts = collectionStickers.get(String(collection.id)) ?? [];
			const collectionStickerIds = new Set(sts.map((s) => String(s.id)));
			const ownedInCollection = sts.filter((s) => ownedSet.has(String(s.id)));

			const rarityBreakdown = new Map<string, number>();
			for (const us of userStickers) {
				if (!collectionStickerIds.has(String(us.stickerId))) continue;
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (rarityId) {
					rarityBreakdown.set(rarityId, (rarityBreakdown.get(rarityId) ?? 0) + 1);
				}
			}

			stats.set(String(collection.id), {
				total: sts.length,
				owned: ownedInCollection.length,
				rarityBreakdown
			});
		}
		collectionStats = stats;
	}

	async function openBoosterPack(collection: Collection) {
		const allStickers = getCollectionStickersData(collection.id);
		if (allStickers.length === 0) return;

		isOpeningPack = true;
		boosterCollection = collection;

		// Weighted selection by rarity
		const MAX_SORT_ORDER = 4;
		const weightedStickers = allStickers.map((sticker) => {
			const rarity = getStickerRarity(sticker);
			const sortOrder = rarity?.sortOrder ?? 0;
			const weight = getRarityWeight(sortOrder, MAX_SORT_ORDER);
			return { item: sticker, weight };
		});
		boosterStickers = weightedRandomSelect(weightedStickers, BOOSTER_PACK_SIZE);

		showBoosterPack = true;

		// Find the common rarity (sortOrder === 0) as fallback
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Acquire all stickers
		for (const sticker of boosterStickers) {
			await acquireSticker(sticker.id, sticker.sourceId, commonRarity?.id);
			await refreshCopyCount(String(sticker.id));
		}
		await refreshOwnedSet();
		await updateCollectionStats();

		isOpeningPack = false;
	}

	function closeBoosterPack() {
		showBoosterPack = false;
		boosterStickers = [];
		boosterCollection = null;
	}
</script>

<div class="flex flex-col h-full">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Booster Packs</h1>
		<p class="text-base-content/70 mt-1">
			Open booster packs to collect stickers from your collections
		</p>
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
		<!-- Opened Booster Pack Display -->
		{#if showBoosterPack}
			<div class="card bg-base-200 mb-6">
				<div class="card-body">
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="font-bold text-xl">Booster Pack Opened!</h3>
							{#if boosterCollection}
								<p class="text-base-content/70">{boosterCollection.title}</p>
							{/if}
						</div>
						<button
							class="btn btn-sm btn-ghost"
							onclick={closeBoosterPack}
							aria-label="Close booster pack"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="grid grid-cols-5 gap-3 mb-4">
						{#each boosterStickers as sticker, index (sticker.id + '-' + index)}
							{@const rarity = getStickerRarity(sticker)}
							{@const displaySticker = { ...sticker, sourceName: boosterCollection?.title }}
							<div class="aspect-[3/4] rounded-lg ring-2 ring-primary">
								<div class="h-full flex flex-col p-2">
									<StickerItem
										sticker={displaySticker}
										bgColor={rarity?.colorFrom ?? '#6B7280'}
										borderColor={rarity?.colorTo}
										classes="w-full flex-1"
									/>
									<p class="text-xs text-center truncate mt-1" title={sticker.name}>{sticker.name}</p>
								</div>
							</div>
						{/each}
					</div>

					<div class="flex justify-end">
						<button class="btn btn-primary btn-sm" onclick={closeBoosterPack}>
							Done
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Collections Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each collections as collection (collection.id)}
				{@const stats = getStats(collection.id)}
				{@const isComplete = stats.total > 0 && stats.owned === stats.total}
				<div
					class={classNames(
						'card bg-base-200 shadow-md hover:shadow-lg transition-shadow',
						{ 'ring-2 ring-success': isComplete }
					)}
				>
					<figure class="px-4 pt-4">
						{#if collection.coverImage}
							<img
								src={collection.coverImage}
								alt={collection.title}
								class="rounded-lg w-full h-32 object-cover"
							/>
						{:else}
							<div class="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center text-base-content/30">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
							</div>
						{/if}
					</figure>
					<div class="card-body">
						<div class="flex items-center gap-2">
							<h2 class="card-title text-base truncate">{collection.title}</h2>
							{#if isComplete}
								<span class="badge badge-success badge-sm">Complete</span>
							{/if}
						</div>

						<!-- Rarity breakdown -->
						{#if stats.rarityBreakdown.size > 0}
							<div class="flex flex-wrap gap-1">
								{#each rarities.toSorted((a, b) => b.sortOrder - a.sortOrder) as rarity (rarity.id)}
									{@const count = stats.rarityBreakdown.get(String(rarity.id)) ?? 0}
									{#if count > 0}
										<span
											class="text-xs px-1.5 py-0.5 rounded font-medium"
											style="background: linear-gradient(135deg, {rarity.colorFrom}, {rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
											title="{rarity.name}: {count}"
										>
											{count}
										</span>
									{/if}
								{/each}
							</div>
						{:else if stats.owned === 0}
							<div class="text-sm text-base-content/40">No stickers yet</div>
						{/if}

						<!-- Progress bar -->
						{#if stats.total > 0}
							{@const percent = Math.round((stats.owned / stats.total) * 100)}
							<div class="flex items-center gap-2">
								<progress
									class={classNames('progress flex-1 h-2', {
										'progress-success': percent === 100,
										'progress-warning': percent >= 50 && percent < 100,
										'progress-primary': percent < 50
									})}
									value={stats.owned}
									max={stats.total}
								></progress>
								<span class="text-xs font-mono text-base-content/60 w-12 text-right">{stats.owned}/{stats.total}</span>
							</div>
						{/if}

						<div class="card-actions justify-end mt-2">
							<button
								class="btn btn-primary btn-sm"
								onclick={() => openBoosterPack(collection)}
								disabled={!hasStickersInCollection(collection.id) || isOpeningPack}
							>
								{#if isOpeningPack && boosterCollection?.id === collection.id}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									Open Pack
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
