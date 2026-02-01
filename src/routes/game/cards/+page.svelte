<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getRarityCollection } from '$services/rarities.service';
	import {
		acquireSticker,
		releaseSticker,
		getStickerCopyCount,
		getOwnedStickerIds
	} from '$services/user-stickers.service';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import StickerItem from '$components/core/StickerItem.svelte';

	const BOOSTER_PACK_SIZE = 5;

	let collections: Collection[] = $state([]);
	let stickers: Sticker[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let isLoadingStickers = $state(false);
	let selectedCollection = $state<Collection | null>(null);
	let ownedStickerIds = $state<Set<string>>(new Set());
	let collectionStickerCounts = $state<Map<string, { total: number; owned: number }>>(new Map());
	let collectionStickers = $state<Map<string, Sticker[]>>(new Map());
	let stickerCopyCountCache = $state<Map<string, number>>(new Map());

	// Booster pack modal state
	let showBoosterModal = $state(false);
	let boosterStickers = $state<Sticker[]>([]);
	let boosterCollection = $state<Collection | null>(null);
	let revealedStickers = $state<Set<number>>(new Set());
	let isOpeningPack = $state(false);

	onMount(async () => {
		[collections, rarities] = await Promise.all([getAllCollections(), getRarityCollection()]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		await loadCollectionStats();
		await refreshOwnedSet();
		isLoading = false;
	});

	async function loadCollectionStats() {
		const counts = new Map<string, { total: number; owned: number }>();
		const stickersMap = new Map<string, Sticker[]>();
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);

		for (const collection of collections) {
			const collectionStickersData = await getStickersForCollection(collection.id);
			const ownedCount = collectionStickersData.filter((s) =>
				ownedSet.has(String(s.id))
			).length;
			counts.set(String(collection.id), { total: collectionStickersData.length, owned: ownedCount });
			stickersMap.set(String(collection.id), collectionStickersData);
		}
		collectionStickerCounts = counts;
		collectionStickers = stickersMap;
	}

	async function updateCollectionStats() {
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);
		const counts = new Map(collectionStickerCounts);

		for (const collection of collections) {
			const sts = collectionStickers.get(String(collection.id)) ?? [];
			const ownedCount = sts.filter((s) => ownedSet.has(String(s.id))).length;
			counts.set(String(collection.id), {
				total: sts.length,
				owned: ownedCount
			});
		}
		collectionStickerCounts = counts;
	}

	async function refreshOwnedSet() {
		const ids = await getOwnedStickerIds();
		ownedStickerIds = new Set(ids);
	}

	async function refreshCopyCount(stickerId: string) {
		const count = await getStickerCopyCount(stickerId);
		stickerCopyCountCache = new Map(stickerCopyCountCache).set(stickerId, count);
	}

	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			selectedCollection = null;
			stickers = [];
		} else {
			selectedCollection = collection;
			isLoadingStickers = true;
			stickers = await getStickersForCollection(collection.id);
			for (const s of stickers) {
				await refreshCopyCount(String(s.id));
			}
			isLoadingStickers = false;
		}
	}

	async function toggleStickerOwnership(sticker: Sticker) {
		const stickerId = String(sticker.id);
		if (ownedStickerIds.has(stickerId)) {
			await releaseSticker(sticker.id);
		} else {
			await acquireSticker(sticker.id, sticker.sourceId);
		}
		await refreshOwnedSet();
		await refreshCopyCount(stickerId);
		await updateCollectionStats();
	}

	function getCollectionStats(collectionId: string | number): { total: number; owned: number } {
		return collectionStickerCounts.get(String(collectionId)) ?? { total: 0, owned: 0 };
	}

	function getTotalOwned(): number {
		return ownedStickerIds.size;
	}

	function getTotalStickers(): number {
		let total = 0;
		for (const stats of collectionStickerCounts.values()) {
			total += stats.total;
		}
		return total;
	}

	function getCollectionStickers(collectionId: string | number): Sticker[] {
		return collectionStickers.get(String(collectionId)) ?? [];
	}

	function hasStickersInCollection(collectionId: string | number): boolean {
		return getCollectionStickers(collectionId).length > 0;
	}

	function getStickerRarity(sticker: Sticker): Rarity | null {
		if (!sticker.rarityId) return null;
		return raritiesMap.get(String(sticker.rarityId)) ?? null;
	}

	function getCachedCopyCount(stickerId: string | number): number {
		return stickerCopyCountCache.get(String(stickerId)) ?? 0;
	}

	async function openBoosterPack(collection: Collection, event: MouseEvent) {
		event.stopPropagation();

		const allStickers = getCollectionStickers(collection.id);
		if (allStickers.length === 0) return;

		isOpeningPack = true;
		boosterCollection = collection;
		revealedStickers = new Set();

		// Shuffle and pick up to BOOSTER_PACK_SIZE random stickers (duplicates allowed)
		const shuffled = [...allStickers].sort(() => Math.random() - 0.5);
		boosterStickers = shuffled.slice(0, BOOSTER_PACK_SIZE);

		showBoosterModal = true;
		isOpeningPack = false;
	}

	async function revealSticker(index: number) {
		if (revealedStickers.has(index)) return;

		const sticker = boosterStickers[index];
		await acquireSticker(sticker.id, sticker.sourceId);
		revealedStickers = new Set([...revealedStickers, index]);
		await refreshOwnedSet();
		await refreshCopyCount(String(sticker.id));
		await updateCollectionStats();
	}

	async function revealAllStickers() {
		for (let i = 0; i < boosterStickers.length; i++) {
			if (!revealedStickers.has(i)) {
				const sticker = boosterStickers[i];
				await acquireSticker(sticker.id, sticker.sourceId);
				await refreshCopyCount(String(sticker.id));
			}
		}
		revealedStickers = new Set(boosterStickers.map((_, i) => i));
		await refreshOwnedSet();
		await updateCollectionStats();
	}

	function closeBoosterModal() {
		showBoosterModal = false;
		boosterStickers = [];
		boosterCollection = null;
		revealedStickers = new Set();
	}

	function allStickersRevealed(): boolean {
		return revealedStickers.size === boosterStickers.length;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Cards</h1>
			<p class="text-base-content/70 mt-1">
				Collect stickers from your favorite collections
			</p>
		</div>
		<div class="stats bg-base-200">
			<div class="stat">
				<div class="stat-title">Stickers Owned</div>
				<div class="stat-value text-primary">{getTotalOwned()}</div>
				<div class="stat-desc">of {getTotalStickers()} total stickers</div>
			</div>
		</div>
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
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Collections Column -->
			<div class="lg:col-span-1">
				<div class="card bg-base-200">
					<div class="card-body">
						<h2 class="card-title">Collections</h2>
						<div class="space-y-2 max-h-[600px] overflow-y-auto">
							{#each collections as collection (collection.id)}
								{@const stats = getCollectionStats(collection.id)}
								{@const isComplete = stats.total > 0 && stats.owned === stats.total}
								<div
									class={classNames(
										'p-3 rounded-lg cursor-pointer transition-all',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedCollection?.id === collection.id,
											'bg-base-100': selectedCollection?.id !== collection.id,
											'ring-2 ring-success': isComplete && selectedCollection?.id !== collection.id
										}
									)}
									onclick={() => selectCollection(collection)}
									onkeydown={(e) => e.key === 'Enter' && selectCollection(collection)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-3">
										{#if collection.coverImage}
											<img
												src={collection.coverImage}
												alt={collection.title}
												class="w-12 h-16 object-cover rounded"
											/>
										{:else}
											<div class="w-12 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<span class="font-medium truncate">{collection.title}</span>
												{#if isComplete}
													<span class="badge badge-success badge-sm">Complete</span>
												{/if}
											</div>
											<div class="text-sm text-base-content/60">
												{stats.owned} / {stats.total} stickers
											</div>
											{#if stats.total > 0}
												<progress
													class={classNames('progress w-full h-1 mt-1', {
														'progress-success': isComplete,
														'progress-primary': !isComplete
													})}
													value={stats.owned}
													max={stats.total}
												></progress>
											{/if}
											{#if stats.total > 0}
												<button
													class="btn btn-primary btn-xs mt-2 w-full"
													onclick={(e) => openBoosterPack(collection, e)}
													disabled={!hasStickersInCollection(collection.id)}
												>
													Open Booster Pack
												</button>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Stickers Column -->
			<div class="lg:col-span-2">
				<div class="card bg-base-200 min-h-[400px]">
					<div class="card-body">
						{#if !selectedCollection}
							<div class="flex flex-col items-center justify-center h-64 text-base-content/60">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<p>Select a collection to view its stickers</p>
							</div>
						{:else}
							{@const stats = getCollectionStats(selectedCollection.id)}
							<div class="flex items-center justify-between mb-4">
								<h2 class="card-title">{selectedCollection.title}</h2>
								<div class="flex items-center gap-3">
									<span class="badge badge-lg">
										{stats.owned} / {stats.total} owned
									</span>
									<button
										class="btn btn-primary btn-sm"
										onclick={(e) => selectedCollection && openBoosterPack(selectedCollection, e)}
										disabled={stats.total === 0}
									>
										Draw 5 Random
									</button>
								</div>
							</div>

							{#if isLoadingStickers}
								<div class="flex justify-center p-8">
									<span class="loading loading-spinner loading-md"></span>
								</div>
							{:else if stickers.length === 0}
								<div class="text-center text-base-content/60 p-8">
									<p>No stickers in this collection yet.</p>
									<p class="text-sm mt-1">Add stickers in the admin panel.</p>
								</div>
							{:else}
								{@const ownedStickers = stickers.filter((s) => getCachedCopyCount(s.id) > 0)}
								{#if ownedStickers.length === 0}
									<div class="text-center text-base-content/60 p-8">
										<p>You don't own any stickers from this collection yet.</p>
										<p class="text-sm mt-1">Open a booster pack to get some!</p>
									</div>
								{:else}
									<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
										{#each ownedStickers as sticker (sticker.id)}
											{@const copyCount = getCachedCopyCount(sticker.id)}
											{@const rarity = getStickerRarity(sticker)}
											<div
												class="relative cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ring-2 ring-primary"
												onclick={() => toggleStickerOwnership(sticker)}
												onkeydown={(e) => e.key === 'Enter' && toggleStickerOwnership(sticker)}
												role="button"
												tabindex="0"
											>
												{#if copyCount > 0}
													<div class="absolute top-2 right-2 badge badge-primary badge-sm z-10">
														x{copyCount}
													</div>
												{/if}
												<StickerItem
													{sticker}
													bgColor={rarity?.colorFrom}
													borderColor={rarity?.colorTo}
												/>
												<div class="p-2 bg-base-200">
													<h3 class="text-xs font-medium text-center leading-tight truncate">{sticker.name}</h3>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Booster Pack Modal -->
{#if showBoosterModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-3xl">
			<h3 class="font-bold text-xl mb-2">Booster Pack</h3>
			{#if boosterCollection}
				<p class="text-base-content/70 mb-4">{boosterCollection.title}</p>
			{/if}

			<div class="grid grid-cols-5 gap-3 mb-6">
				{#each boosterStickers as sticker, index (sticker.id)}
					{@const isRevealed = revealedStickers.has(index)}
					<div
						class={classNames(
							'aspect-[3/4] rounded-lg cursor-pointer transition-all duration-300',
							{
								'bg-gradient-to-br from-primary to-secondary': !isRevealed,
								'hover:scale-105 hover:shadow-lg': !isRevealed,
								'ring-2 ring-primary': isRevealed
							}
						)}
						onclick={() => revealSticker(index)}
						onkeydown={(e) => e.key === 'Enter' && revealSticker(index)}
						role="button"
						tabindex="0"
					>
						{#if isRevealed}
							<div class="h-full flex flex-col">
								<img
									src={sticker.image}
									alt={sticker.name}
									class="w-full flex-1 object-cover rounded-t-lg"
									onerror={(e) => {
										(e.target as HTMLImageElement).src =
											'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
									}}
								/>
								<div class="p-2 bg-base-100 rounded-b-lg">
									<p class="text-xs font-medium truncate text-center" title={sticker.name}>{sticker.name}</p>
								</div>
							</div>
						{:else}
							<div class="h-full flex items-center justify-center">
								<span class="text-4xl">?</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<div class="modal-action">
				{#if !allStickersRevealed()}
					<button class="btn btn-secondary" onclick={revealAllStickers}>
						Reveal All
					</button>
				{/if}
				<button
					class={classNames('btn', {
						'btn-primary': allStickersRevealed(),
						'btn-ghost': !allStickersRevealed()
					})}
					onclick={closeBoosterModal}
				>
					{allStickersRevealed() ? 'Done' : 'Close'}
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={closeBoosterModal}></div>
	</div>
{/if}
