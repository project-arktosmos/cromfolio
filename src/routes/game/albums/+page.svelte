<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAllCollections, getStickersForCollection, getCollection } from '$services/collections.service';
	import { getCollectionType } from '$services/collection-types.service';
	import {
	acquireSticker,
	getOwnedStickerIds,
	getStickerCopyCount
} from '$services/user-stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { sourceExists } from '$services/sources.service';
	import { getStickerType } from '$services/sticker-types.service';
	import { getTagsBySticker, getTagsForStickers } from '$services/tags.service';
	import type { Collection } from '$types/collection.type';
	import type { CollectionType } from '$types/collection-type.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Source } from '$types/source.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type { Tag } from '$types/tag.type';
	import type { PackedPage, GroupedFragments } from '$types/album-layout.type';
	import { DEFAULT_PACKING_CONFIG, getPageAspectRatio } from '$types/album-layout.type';
	import { packStickersIntoPages, separateWinnerStickers, groupFragmentStickers } from '$utils/album-packing';
	import StickerItem from '$components/core/StickerItem.svelte';
	import StickerPreview from '$components/core/StickerPreview.svelte';

	// Interface for awards album sections (one per category)
	interface AwardsSection {
		categoryName: string;
		regularStickers: Sticker[];
		winnerFragments: GroupedFragments | null;
		packedPages: PackedPage[];
	}

	// Layout configuration
	const config = DEFAULT_PACKING_CONFIG;
	const PAGE_ASPECT = getPageAspectRatio();

	let collections: Collection[] = $state([]);
	let stickers: Sticker[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let isLoadingStickers = $state(false);
	let selectedCollection = $state<Collection | null>(null);
	let ownedStickerIds = $state<Set<string>>(new Set());
	let collectionStickerCounts = $state<Map<string, { total: number; owned: number }>>(new Map());
	let copyCountCache = $state<Map<string, number>>(new Map());
	let stickerTagsMap = $state<Map<string, Tag[]>>(new Map());
	let currentSpread = $state(0);
	let selectedCollectionType = $state<CollectionType | null>(null);

	// Cached stickers per collection (for booster packs)
	let collectionStickers = $state<Map<string, Sticker[]>>(new Map());

	// Booster pack modal state
	const BOOSTER_PACK_SIZE = 5;
	let showBoosterModal = $state(false);
	let boosterStickers = $state<Sticker[]>([]);
	let boosterCollection = $state<Collection | null>(null);
	let revealedStickers = $state<Set<number>>(new Set());
	let isOpeningPack = $state(false);

	// Hover preview state
	let hoveredSticker = $state<Sticker | null>(null);
	let mousePosition = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let previewSource = $state<Source | null>(null);
	let previewStickerType = $state<StickerTypeEntity | null>(null);
	let previewTags = $state<Tag[]>([]);

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
		const counts = new Map<string, { total: number; owned: number }>();
		const stickersMap = new Map<string, Sticker[]>();
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);

		for (const collection of collections) {
			const collectionStickersData = await getStickersForCollection(collection.id);
			const ownedCount = collectionStickersData.filter((bp) =>
				ownedSet.has(String(bp.id))
			).length;
			counts.set(String(collection.id), { total: collectionStickersData.length, owned: ownedCount });
			stickersMap.set(String(collection.id), collectionStickersData);
		}
		collectionStickerCounts = counts;
		collectionStickers = stickersMap;
	}

	async function refreshOwnedSet() {
		const ids = await getOwnedStickerIds();
		ownedStickerIds = new Set(ids);
	}

	async function refreshCopyCount(stickerId: string) {
		const count = await getStickerCopyCount(stickerId);
		copyCountCache = new Map(copyCountCache).set(stickerId, count);
	}

	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			selectedCollection = null;
			selectedCollectionType = null;
			stickers = [];
			stickerTagsMap = new Map();
			currentSpread = 0;
		} else {
			selectedCollection = collection;
			selectedCollectionType = null;
			currentSpread = 0;
			isLoadingStickers = true;

			// Fetch collection type if the collection has a type
			if (collection.collectionTypeId) {
				selectedCollectionType = await getCollectionType(collection.collectionTypeId);
			}

			stickers = await getStickersForCollection(collection.id);

			// Fetch tags for all stickers to identify winners and categories
			const stickerIds = stickers.map((s) => s.id);
			stickerTagsMap = await getTagsForStickers(stickerIds);

			// Refresh copy counts
			for (const bp of stickers) {
				await refreshCopyCount(String(bp.id));
			}

			isLoadingStickers = false;
		}
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

	function getStickerRarity(sticker: Sticker): Rarity | null {
		if (!sticker.rarityId) return null;
		return raritiesMap.get(String(sticker.rarityId)) ?? null;
	}

	function getCachedCopyCount(stickerId: string | number): number {
		return copyCountCache.get(String(stickerId)) ?? 0;
	}

	// Dynamic packing - computed when stickers change
	// Separate regular stickers from winners
	let { regularStickers, winnerStickers } = $derived.by(() => {
		if (stickers.length === 0) return { regularStickers: [] as Sticker[], winnerStickers: [] as Sticker[] };
		const { regular, winners } = separateWinnerStickers(stickers, stickerTagsMap);
		return { regularStickers: regular, winnerStickers: winners };
	});

	// Pack regular stickers into column-based pages
	let packedPages = $derived.by(() => {
		if (regularStickers.length === 0) return [];
		return packStickersIntoPages(regularStickers, config);
	});

	// Group winner fragment stickers for 2x2 display (displayed at the end)
	let groupedWinners = $derived.by(() => {
		if (winnerStickers.length === 0) return [] as GroupedFragments[];
		const startingIndex = packedPages.length;
		const { grouped } = groupFragmentStickers(winnerStickers, startingIndex);
		return grouped;
	});

	// Check if this is an awards collection
	let isAwardsCollection = $derived(selectedCollectionType?.id === 'awards');

	// For awards collections, group stickers by award_category tag
	let awardsSections = $derived.by((): AwardsSection[] => {
		if (!isAwardsCollection || stickers.length === 0) return [];

		// Group stickers by award_category
		const categoryMap = new Map<string, Sticker[]>();

		for (const sticker of stickers) {
			const tags = stickerTagsMap.get(String(sticker.id)) ?? [];
			const categoryTag = tags.find((t) => t.key === 'award_category');
			const categoryName = categoryTag?.value ?? 'Uncategorized';

			if (!categoryMap.has(categoryName)) {
				categoryMap.set(categoryName, []);
			}
			categoryMap.get(categoryName)!.push(sticker);
		}

		// Convert to sections array, sorted alphabetically
		const sections: AwardsSection[] = [];
		const sortedCategories = Array.from(categoryMap.keys()).sort();

		for (const categoryName of sortedCategories) {
			const categoryStickers = categoryMap.get(categoryName)!;

			// Separate regular and winner stickers for this category
			const { regular, winners } = separateWinnerStickers(categoryStickers, stickerTagsMap);

			// Pack regular stickers into pages
			const sectionPages = packStickersIntoPages(regular, config);

			// Group winner fragments (should be just one winner per category typically)
			let winnerFragments: GroupedFragments | null = null;
			if (winners.length > 0) {
				const { grouped } = groupFragmentStickers(winners, 0);
				winnerFragments = grouped[0] ?? null;
			}

			sections.push({
				categoryName,
				regularStickers: regular,
				winnerFragments,
				packedPages: sectionPages
			});
		}

		return sections;
	});

	// Helper to format category name (capitalize words)
	function formatCategoryName(category: string): string {
		return category
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Page content types for awards layout
	type PageContent =
		| { type: 'sticker'; page: PackedPage; section: AwardsSection; sectionIndex: number; isFirstOfSection: boolean }
		| { type: 'winner'; section: AwardsSection; sectionIndex: number }
		| { type: 'empty' };

	// Build a flat list of all pages across all sections
	function getAwardsPageList(): PageContent[] {
		const pages: PageContent[] = [];

		for (let i = 0; i < awardsSections.length; i++) {
			const section = awardsSections[i];

			// Sticker pages - first one gets isFirstOfSection=true for title cell
			for (let j = 0; j < section.packedPages.length; j++) {
				pages.push({
					type: 'sticker',
					page: section.packedPages[j],
					section,
					sectionIndex: i,
					isFirstOfSection: j === 0
				});
			}

			// Winner page
			if (section.winnerFragments) {
				pages.push({ type: 'winner', section, sectionIndex: i });
			}
		}

		return pages;
	}

	// For awards layout: calculate total spreads
	function getAwardsTotalSpreads(): number {
		if (awardsSections.length === 0) return 1; // Just cover
		const pageList = getAwardsPageList();
		// Cover + pairs of pages
		return 1 + Math.ceil(pageList.length / 2);
	}

	// Determine what type of content is at the current spread for awards layout
	type AwardsSpreadType =
		| { type: 'cover' }
		| { type: 'pages'; left: PageContent; right: PageContent };

	function getAwardsSpreadInfo(): AwardsSpreadType {
		if (currentSpread === 0) {
			return { type: 'cover' };
		}

		const pageList = getAwardsPageList();
		const spreadIdx = currentSpread - 1; // 0-indexed spread after cover
		const leftPageIdx = spreadIdx * 2;
		const rightPageIdx = spreadIdx * 2 + 1;

		const left: PageContent = pageList[leftPageIdx] ?? { type: 'empty' };
		const right: PageContent = pageList[rightPageIdx] ?? { type: 'empty' };

		return { type: 'pages', left, right };
	}

	function getTotalRegularPages(): number {
		return packedPages.length;
	}

	function getTotalWinnerPages(): number {
		return groupedWinners.length;
	}

	function getTotalSpreads(): number {
		// For awards collections, use the awards layout
		if (isAwardsCollection) {
			return getAwardsTotalSpreads();
		}
		// Standard layout:
		// Spread 0 = cover
		// Regular pages: pairs of pages (2 per spread)
		// Winner pages: also pairs (2 per spread, like regular pages)
		const regularSpreads = Math.ceil(getTotalRegularPages() / 2);
		const winnerSpreads = Math.ceil(getTotalWinnerPages() / 2);
		return 1 + regularSpreads + winnerSpreads;
	}

	function getRegularSpreadsCount(): number {
		return Math.ceil(getTotalRegularPages() / 2);
	}

	function getWinnerSpreadsCount(): number {
		return Math.ceil(getTotalWinnerPages() / 2);
	}

	function isWinnerSpread(): boolean {
		// Winner spreads start after cover (1) + regular spreads
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		return currentSpread >= winnerSpreadStart;
	}

	function getLeftWinner(): GroupedFragments | null {
		if (!isWinnerSpread()) return null;
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		const winnerSpreadIndex = currentSpread - winnerSpreadStart;
		const leftWinnerIdx = winnerSpreadIndex * 2;
		return groupedWinners[leftWinnerIdx] ?? null;
	}

	function getRightWinner(): GroupedFragments | null {
		if (!isWinnerSpread()) return null;
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		const winnerSpreadIndex = currentSpread - winnerSpreadStart;
		const rightWinnerIdx = winnerSpreadIndex * 2 + 1;
		return groupedWinners[rightWinnerIdx] ?? null;
	}

	function isCoverSpread(): boolean {
		return currentSpread === 0;
	}

	function isRegularSpread(): boolean {
		// Regular spreads are after cover but before winner spreads
		return !isCoverSpread() && !isWinnerSpread();
	}

	function getLeftPage(): PackedPage | null {
		// spread 1 = pages 0,1; spread 2 = pages 2,3; etc.
		const leftPageIdx = (currentSpread - 1) * 2;
		return packedPages[leftPageIdx] ?? null;
	}

	function getRightPage(): PackedPage | null {
		const rightPageIdx = (currentSpread - 1) * 2 + 1;
		return packedPages[rightPageIdx] ?? null;
	}

	function hasRightPage(): boolean {
		return getRightPage() !== null;
	}

	function goToSpread(spread: number) {
		const totalSpreads = getTotalSpreads();
		if (spread >= 0 && spread < totalSpreads) {
			currentSpread = spread;
		}
	}

	function nextSpread() {
		goToSpread(currentSpread + 1);
	}

	function prevSpread() {
		goToSpread(currentSpread - 1);
	}

	async function handleStickerMouseEnter(sticker: Sticker) {
		hoveredSticker = sticker;
		const [source, stickerType, tags] = await Promise.all([
			sticker.sourceId ? sourceExists(sticker.sourceId) : Promise.resolve(null),
			sticker.stickerTypeId ? getStickerType(sticker.stickerTypeId) : Promise.resolve(null),
			getTagsBySticker(sticker.id)
		]);
		if (hoveredSticker?.id === sticker.id) {
			previewSource = source;
			previewStickerType = stickerType;
			previewTags = tags;
		}
	}

	function handleStickerMouseMove(event: MouseEvent) {
		mousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleStickerMouseLeave() {
		hoveredSticker = null;
		previewSource = null;
		previewStickerType = null;
		previewTags = [];
	}

	// Booster pack functions
	function getCollectionStickers(collectionId: string | number): Sticker[] {
		return collectionStickers.get(String(collectionId)) ?? [];
	}

	function hasStickersInCollection(collectionId: string | number): boolean {
		return getCollectionStickers(collectionId).length > 0;
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

<div class="flex flex-col h-full">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Albums</h1>
		<p class="text-base-content/70 mt-1">
			Browse your collection albums
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
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
			<!-- Collections Column -->
			<div class="lg:col-span-1 flex flex-col min-h-0">
				<div class="card bg-base-200 flex-1 flex flex-col min-h-0">
					<div class="card-body flex flex-col min-h-0">
						<h2 class="card-title shrink-0">Collections</h2>
						<div class="space-y-2 flex-1 overflow-y-auto min-h-0">
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

			<!-- Album Page Column -->
			<div class="lg:col-span-2">
				<div class="border-2 border-blue-500 rounded-lg p-4 overflow-hidden">
				{#if !selectedCollection}
					<div class="card bg-base-200 min-h-[400px]">
						<div class="card-body">
							<div class="flex flex-col items-center justify-center h-64 text-base-content/60">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<p>Select a collection to view its album</p>
							</div>
						</div>
					</div>
				{:else}
					{@const stats = getCollectionStats(selectedCollection.id)}
					{@const totalRegularPages = getTotalRegularPages()}
					{@const totalWinnerPages = getTotalWinnerPages()}
					{@const totalSpreads = getTotalSpreads()}
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-bold">{selectedCollection.title}</h2>
						<span class="badge badge-lg">
							{stats.owned} / {stats.total} owned
						</span>
					</div>

					{#if isLoadingStickers}
						<div class="flex flex-col items-center justify-center p-8">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if stickers.length === 0}
						<div class="alert alert-info">
							<span>No stickers in this collection yet.</span>
						</div>
					{:else}
						{#if isAwardsCollection}
							<!-- Awards Collection Layout -->
							{#if isCoverSpread()}
								<!-- Cover Page (single) -->
								<div class="flex justify-center">
									<div
										class="bg-white text-gray-900 shadow-xl rounded-lg overflow-hidden w-1/2"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full flex flex-col">
											{#if selectedCollection.coverImage}
												<img
													src={selectedCollection.coverImage}
													alt={selectedCollection.title}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div class="h-full flex flex-col items-center justify-center bg-gradient-to-br from-warning to-amber-600 p-8">
													<div class="text-6xl mb-6 text-white/30">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="currentColor" viewBox="0 0 24 24">
															<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
														</svg>
													</div>
													<h2 class="text-3xl font-bold text-white text-center drop-shadow-lg">{selectedCollection.title}</h2>
													{#if selectedCollection.description}
														<p class="text-white/80 text-center mt-4 max-w-xs">{selectedCollection.description}</p>
													{/if}
													<div class="mt-8 text-white/60 text-sm">
														{awardsSections.length} categories · {stickers.length} stickers
													</div>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{:else}
								{@const spreadInfo = getAwardsSpreadInfo()}
								{#if spreadInfo.type === 'pages'}
									<!-- Awards Spread with left and right pages -->
									<div class="flex w-full gap-1">
										<!-- Left Page -->
										{#if spreadInfo.left.type === 'sticker'}
											<div
												class="bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<div class="h-full flex flex-col" style="padding: {config.pagePadding}px;">
													<div class="flex-1 flex" style="gap: {config.columnGap}px;">
														<div class="flex-1 flex flex-col" style="gap: {config.stickerGap}px;">
															{#if spreadInfo.left.isFirstOfSection}
																<!-- Title Cell -->
																<div class="w-full p-2 flex flex-col max-h-[50%]">
																	<div class="flex-1 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex flex-col items-center justify-center p-2 border-2 border-amber-400">
																		<div class="text-2xl mb-1">🏆</div>
																		<h3 class="text-sm font-bold text-gray-800 text-center leading-tight">{formatCategoryName(spreadInfo.left.section.categoryName)}</h3>
																	</div>
																</div>
															{/if}
															{#each spreadInfo.left.page.leftColumn.stickers as { sticker } (sticker.id)}
																{@const copyCount = getCachedCopyCount(sticker.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(sticker)}
																<div
																	class={classNames(
																		'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																		{ 'grayscale opacity-50': !owned }
																	)}
																	onmouseenter={() => handleStickerMouseEnter(sticker)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full flex-1"
																	/>
																	<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
																</div>
															{/each}
														</div>
														<div class="flex-1 flex flex-col" style="gap: {config.stickerGap}px;">
															{#each spreadInfo.left.page.rightColumn.stickers as { sticker } (sticker.id)}
																{@const copyCount = getCachedCopyCount(sticker.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(sticker)}
																<div
																	class={classNames(
																		'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																		{ 'grayscale opacity-50': !owned }
																	)}
																	onmouseenter={() => handleStickerMouseEnter(sticker)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full flex-1"
																	/>
																	<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
																</div>
															{/each}
														</div>
													</div>
												</div>
											</div>
										{:else if spreadInfo.left.type === 'winner'}
											{@const winnerFrags = spreadInfo.left.section.winnerFragments}
											{#if winnerFrags}
												{@const topLeft = winnerFrags.fragments.get(1)}
												{@const topRight = winnerFrags.fragments.get(2)}
												{@const bottomLeft = winnerFrags.fragments.get(3)}
												{@const bottomRight = winnerFrags.fragments.get(4)}
												{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
												{@const winnerName = firstSticker?.name?.replace(/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/, '') ?? 'Winner'}
												<div
													class="bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1"
													style="aspect-ratio: {PAGE_ASPECT};"
												>
													<div class="h-full flex flex-col p-4 relative">
														<div class="absolute top-2 right-2 z-10">
															<span class="badge badge-warning badge-sm gap-1">
																<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
																	<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
																</svg>
															</span>
														</div>
														<h3 class="text-sm font-bold text-gray-800 text-center mb-2 truncate">{winnerName}</h3>
														<div class="flex-1 grid grid-cols-2 grid-rows-2 gap-px">
															{#if topLeft}
																{@const copyCount = getCachedCopyCount(topLeft.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(topLeft)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(topLeft)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if topRight}
																{@const copyCount = getCachedCopyCount(topRight.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(topRight)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(topRight)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if bottomLeft}
																{@const copyCount = getCachedCopyCount(bottomLeft.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(bottomLeft)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if bottomRight}
																{@const copyCount = getCachedCopyCount(bottomRight.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(bottomRight)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(bottomRight)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
														</div>
													</div>
												</div>
											{/if}
										{:else}
											<div
												class="bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1 opacity-30"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<div class="h-full flex items-center justify-center">
													<span class="text-gray-300">End of album</span>
												</div>
											</div>
										{/if}

										<!-- Right Page -->
										{#if spreadInfo.right.type === 'sticker'}
											<div
												class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<div class="h-full flex flex-col" style="padding: {config.pagePadding}px;">
													<div class="flex-1 flex" style="gap: {config.columnGap}px;">
														<div class="flex-1 flex flex-col" style="gap: {config.stickerGap}px;">
															{#if spreadInfo.right.isFirstOfSection}
																<!-- Title Cell -->
																<div class="w-full p-2 flex flex-col max-h-[50%]">
																	<div class="flex-1 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex flex-col items-center justify-center p-2 border-2 border-amber-400">
																		<div class="text-2xl mb-1">🏆</div>
																		<h3 class="text-sm font-bold text-gray-800 text-center leading-tight">{formatCategoryName(spreadInfo.right.section.categoryName)}</h3>
																	</div>
																</div>
															{/if}
															{#each spreadInfo.right.page.leftColumn.stickers as { sticker } (sticker.id)}
																{@const copyCount = getCachedCopyCount(sticker.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(sticker)}
																<div
																	class={classNames(
																		'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																		{ 'grayscale opacity-50': !owned }
																	)}
																	onmouseenter={() => handleStickerMouseEnter(sticker)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full flex-1"
																	/>
																	<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
																</div>
															{/each}
														</div>
														<div class="flex-1 flex flex-col" style="gap: {config.stickerGap}px;">
															{#each spreadInfo.right.page.rightColumn.stickers as { sticker } (sticker.id)}
																{@const copyCount = getCachedCopyCount(sticker.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(sticker)}
																<div
																	class={classNames(
																		'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																		{ 'grayscale opacity-50': !owned }
																	)}
																	onmouseenter={() => handleStickerMouseEnter(sticker)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full flex-1"
																	/>
																	<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
																</div>
															{/each}
														</div>
													</div>
												</div>
											</div>
										{:else if spreadInfo.right.type === 'winner'}
											{@const winnerFrags = spreadInfo.right.section.winnerFragments}
											{#if winnerFrags}
												{@const topLeft = winnerFrags.fragments.get(1)}
												{@const topRight = winnerFrags.fragments.get(2)}
												{@const bottomLeft = winnerFrags.fragments.get(3)}
												{@const bottomRight = winnerFrags.fragments.get(4)}
												{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
												{@const winnerName = firstSticker?.name?.replace(/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/, '') ?? 'Winner'}
												<div
													class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1"
													style="aspect-ratio: {PAGE_ASPECT};"
												>
													<div class="h-full flex flex-col p-4 relative">
														<div class="absolute top-2 right-2 z-10">
															<span class="badge badge-warning badge-sm gap-1">
																<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
																	<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
																</svg>
															</span>
														</div>
														<h3 class="text-sm font-bold text-gray-800 text-center mb-2 truncate">{winnerName}</h3>
														<div class="flex-1 grid grid-cols-2 grid-rows-2 gap-px">
															{#if topLeft}
																{@const copyCount = getCachedCopyCount(topLeft.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(topLeft)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(topLeft)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if topRight}
																{@const copyCount = getCachedCopyCount(topRight.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(topRight)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(topRight)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if bottomLeft}
																{@const copyCount = getCachedCopyCount(bottomLeft.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(bottomLeft)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
															{#if bottomRight}
																{@const copyCount = getCachedCopyCount(bottomRight.id)}
																{@const owned = copyCount > 0}
																{@const rarity = getStickerRarity(bottomRight)}
																<div
																	class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
																	onmouseenter={() => handleStickerMouseEnter(bottomRight)}
																	onmousemove={handleStickerMouseMove}
																	onmouseleave={handleStickerMouseLeave}
																	role="button"
																	tabindex="0"
																>
																	<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
																</div>
															{:else}
																<div class="bg-gray-200 rounded"></div>
															{/if}
														</div>
													</div>
												</div>
											{/if}
										{:else}
											<div
												class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 opacity-30"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<div class="h-full flex items-center justify-center">
													<span class="text-gray-300">End of album</span>
												</div>
											</div>
										{/if}
									</div>
								{/if}
							{/if}
						{:else}
							<!-- Standard Collection Layout -->
							{#if isCoverSpread()}
								<!-- Cover Page (single) -->
								<div class="flex justify-center">
									<div
										class="bg-white text-gray-900 shadow-xl rounded-lg overflow-hidden w-1/2"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full flex flex-col">
											{#if selectedCollection.coverImage}
												<img
													src={selectedCollection.coverImage}
													alt={selectedCollection.title}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div class="h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary to-secondary p-8">
													<div class="text-6xl mb-6 text-white/30">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
														</svg>
													</div>
													<h2 class="text-3xl font-bold text-white text-center drop-shadow-lg">{selectedCollection.title}</h2>
													{#if selectedCollection.description}
														<p class="text-white/80 text-center mt-4 max-w-xs">{selectedCollection.description}</p>
													{/if}
													<div class="mt-8 text-white/60 text-sm">
														{stickers.length} stickers · {totalRegularPages + totalWinnerPages} pages
														{#if totalWinnerPages > 0}
															<span class="ml-1">(incl. {totalWinnerPages} winner{totalWinnerPages > 1 ? 's' : ''})</span>
														{/if}
													</div>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{:else if isWinnerSpread()}
							<!-- Winner Book View (two pages side by side) -->
							{@const leftWinner = getLeftWinner()}
							{@const rightWinner = getRightWinner()}

							<div class="flex w-full gap-1">
								<!-- Left Winner Page -->
								{#if leftWinner}
									{@const topLeft = leftWinner.fragments.get(1)}
									{@const topRight = leftWinner.fragments.get(2)}
									{@const bottomLeft = leftWinner.fragments.get(3)}
									{@const bottomRight = leftWinner.fragments.get(4)}
									{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
									{@const winnerName = firstSticker?.name?.replace(/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/, '') ?? 'Winner'}
									<div
										class="bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full flex flex-col p-4 relative">
											<div class="absolute top-2 right-2 z-10">
												<span class="badge badge-warning badge-sm gap-1">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
														<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
													</svg>
												</span>
											</div>
											<h3 class="text-sm font-bold text-gray-800 text-center mb-2 truncate">{winnerName}</h3>
											<div class="flex-1 grid grid-cols-2 grid-rows-2 gap-px">
												{#if topLeft}
													{@const copyCount = getCachedCopyCount(topLeft.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(topLeft)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(topLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if topRight}
													{@const copyCount = getCachedCopyCount(topRight.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(topRight)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(topRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomLeft}
													{@const copyCount = getCachedCopyCount(bottomLeft.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(bottomLeft)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomRight}
													{@const copyCount = getCachedCopyCount(bottomRight.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(bottomRight)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(bottomRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
											</div>
										</div>
									</div>
								{/if}

								<!-- Right Winner Page -->
								{#if rightWinner}
									{@const topLeft = rightWinner.fragments.get(1)}
									{@const topRight = rightWinner.fragments.get(2)}
									{@const bottomLeft = rightWinner.fragments.get(3)}
									{@const bottomRight = rightWinner.fragments.get(4)}
									{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
									{@const winnerName = firstSticker?.name?.replace(/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/, '') ?? 'Winner'}
									<div
										class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full flex flex-col p-4 relative">
											<div class="absolute top-2 right-2 z-10">
												<span class="badge badge-warning badge-sm gap-1">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
														<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
													</svg>
												</span>
											</div>
											<h3 class="text-sm font-bold text-gray-800 text-center mb-2 truncate">{winnerName}</h3>
											<div class="flex-1 grid grid-cols-2 grid-rows-2 gap-px">
												{#if topLeft}
													{@const copyCount = getCachedCopyCount(topLeft.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(topLeft)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(topLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if topRight}
													{@const copyCount = getCachedCopyCount(topRight.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(topRight)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(topRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomLeft}
													{@const copyCount = getCachedCopyCount(bottomLeft.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(bottomLeft)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomRight}
													{@const copyCount = getCachedCopyCount(bottomRight.id)}
													{@const owned = copyCount > 0}
													{@const rarity = getStickerRarity(bottomRight)}
													<div
														class={classNames('cursor-pointer', { 'grayscale opacity-50': !owned })}
														onmouseenter={() => handleStickerMouseEnter(bottomRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
											</div>
										</div>
									</div>
								{:else}
									<!-- Empty right page placeholder -->
									<div
										class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 opacity-30"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full p-4 flex flex-col items-center justify-center">
											<span class="text-gray-300">End of album</span>
										</div>
									</div>
								{/if}
							</div>
						{:else}
							<!-- Book View (two pages side by side) -->
							{@const leftPage = getLeftPage()}
							{@const rightPage = getRightPage()}

							<div class="flex w-full gap-1">
								<!-- Left Page -->
								{#if leftPage}
																		<div
										class="bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1 "
										style="aspect-ratio: {PAGE_ASPECT};"
									>
																				<div class="h-full flex flex-col " style="padding: {config.pagePadding}px;">
											<div class="flex-1 flex " style="gap: {config.columnGap}px;">
																								<div class="flex-1 flex flex-col " style="gap: {config.stickerGap}px;">
													{#each leftPage.leftColumn.stickers as { sticker } (sticker.id)}
														{@const copyCount = getCachedCopyCount(sticker.id)}
														{@const owned = copyCount > 0}
														{@const rarity = getStickerRarity(sticker)}
														<div
															class={classNames(
																'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																{ 'grayscale opacity-50': !owned }
															)}
															onmouseenter={() => handleStickerMouseEnter(sticker)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															<StickerItem
																{sticker}
																bgColor={rarity?.colorFrom ?? '#6B7280'}
																borderColor={rarity?.colorTo}
																classes="w-full flex-1"
															/>
															<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
														</div>
													{/each}
												</div>
												<div class="flex-1 flex flex-col " style="gap: {config.stickerGap}px;">
													{#each leftPage.rightColumn.stickers as { sticker } (sticker.id)}
														{@const copyCount = getCachedCopyCount(sticker.id)}
														{@const owned = copyCount > 0}
														{@const rarity = getStickerRarity(sticker)}
														<div
															class={classNames(
																'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																{ 'grayscale opacity-50': !owned }
															)}
															onmouseenter={() => handleStickerMouseEnter(sticker)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															<StickerItem
																{sticker}
																bgColor={rarity?.colorFrom ?? '#6B7280'}
																borderColor={rarity?.colorTo}
																classes="w-full flex-1"
															/>
															<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
														</div>
													{/each}
												</div>
											</div>
										</div>
									</div>
								{/if}

								<!-- Right Page -->
								{#if rightPage}
																		<div
										class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 "
										style="aspect-ratio: {PAGE_ASPECT};"
									>
																				<div class="h-full flex flex-col " style="padding: {config.pagePadding}px;">
											<div class="flex-1 flex " style="gap: {config.columnGap}px;">
																								<div class="flex-1 flex flex-col " style="gap: {config.stickerGap}px;">
													{#each rightPage.leftColumn.stickers as { sticker } (sticker.id)}
														{@const copyCount = getCachedCopyCount(sticker.id)}
														{@const owned = copyCount > 0}
														{@const rarity = getStickerRarity(sticker)}
														<div
															class={classNames(
																'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																{ 'grayscale opacity-50': !owned }
															)}
															onmouseenter={() => handleStickerMouseEnter(sticker)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															<StickerItem
																{sticker}
																bgColor={rarity?.colorFrom ?? '#6B7280'}
																borderColor={rarity?.colorTo}
																classes="w-full flex-1"
															/>
															<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
														</div>
													{/each}
												</div>
												<div class="flex-1 flex flex-col " style="gap: {config.stickerGap}px;">
													{#each rightPage.rightColumn.stickers as { sticker } (sticker.id)}
														{@const copyCount = getCachedCopyCount(sticker.id)}
														{@const owned = copyCount > 0}
														{@const rarity = getStickerRarity(sticker)}
														<div
															class={classNames(
																'w-full p-2 cursor-pointer overflow-hidden max-h-[50%] flex flex-col',
																{ 'grayscale opacity-50': !owned }
															)}
															onmouseenter={() => handleStickerMouseEnter(sticker)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															<StickerItem
																{sticker}
																bgColor={rarity?.colorFrom ?? '#6B7280'}
																borderColor={rarity?.colorTo}
																classes="w-full flex-1"
															/>
															<p class="text-xs text-gray-600 text-center truncate px-1">{sticker.name}</p>
														</div>
													{/each}
												</div>
											</div>
										</div>
									</div>
								{:else}
									<!-- Empty right page placeholder -->
									<div
										class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 opacity-30"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full p-4 flex flex-col">
											<div class="text-center mb-2">
												<p class="text-xs text-gray-500">--</p>
											</div>
											<div class="flex-1 flex items-center justify-center">
												{#if totalWinnerPages > 0}
													<span class="text-gray-300">Winners ahead →</span>
												{:else}
													<span class="text-gray-300">End of album</span>
												{/if}
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
						{/if}

						<!-- Pagination Controls -->
						{#if totalSpreads > 1}
							<div class="mt-6">
								<div class="flex justify-center items-center gap-2">
									<button
										class="btn btn-sm btn-outline"
										onclick={prevSpread}
										disabled={currentSpread === 0}
									>
										Previous
									</button>
									<span class="text-sm text-base-content/60">
										Spread {currentSpread + 1} of {totalSpreads}
									</span>
									<button
										class="btn btn-sm btn-outline"
										onclick={nextSpread}
										disabled={currentSpread === totalSpreads - 1}
									>
										Next
									</button>
								</div>
							</div>
						{/if}
					{/if}
				{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Hover Preview -->
{#if hoveredSticker}
	{@const rarity = getStickerRarity(hoveredSticker)}
	<div
		class="fixed z-50 pointer-events-none"
		style="left: {mousePosition.x + 16}px; top: {mousePosition.y + 16}px; max-width: 400px;"
	>
		<StickerPreview
			sticker={hoveredSticker}
			{rarity}
			stickerType={previewStickerType}
			source={previewSource}
			tags={previewTags}
			classes="shadow-2xl"
		/>
	</div>
{/if}

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
