<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import {
		acquireSticker,
		getOwnedStickerIds,
		getStickerCopyCount,
		getAllUserStickers
	} from '$services/user-stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';

	// Child components
	import OpenedPackDisplay from './components/OpenedPackDisplay.svelte';
	import CollectionPackCard from './components/CollectionPackCard.svelte';

	const BOOSTER_PACK_SIZE = 5;

	let collections: Collection[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);

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
		[collections, rarities] = await Promise.all([getAllCollections(), getRarityCollection()]);
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
		return (
			collectionStats.get(String(collectionId)) ?? {
				total: 0,
				owned: 0,
				rarityBreakdown: new Map()
			}
		);
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

	async function handleOpenPack(event: CustomEvent<Collection>) {
		const collection = event.detail;
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

<div class="flex h-full flex-col">
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
			<OpenedPackDisplay
				collection={boosterCollection}
				stickers={boosterStickers}
				{raritiesMap}
				{stickerRarityMap}
				on:close={closeBoosterPack}
			/>
		{/if}

		<!-- Collections Grid -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each collections as collection (collection.id)}
				<CollectionPackCard
					{collection}
					stats={getStats(collection.id)}
					{rarities}
					hasStickers={hasStickersInCollection(collection.id)}
					isOpening={isOpeningPack && boosterCollection?.id === collection.id}
					on:openPack={handleOpenPack}
				/>
			{/each}
		</div>
	{/if}
</div>
