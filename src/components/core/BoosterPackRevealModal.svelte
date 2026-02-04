<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import { getCollection, getStickersForCollection } from '$services/collections.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { openUserBoosterPacksBatch } from '$services/user-booster-packs.service';
	import { acquireSticker } from '$services/user-stickers.service';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Collection } from '$types/collection.type';
	import StickerItem from '$components/core/StickerItem.svelte';
	import BoosterPackCard from '$components/game/BoosterPackCard.svelte';

	const dispatch = createEventDispatcher<{
		done: { stickers: Sticker[] };
	}>();

	const BOOSTER_PACK_SIZE = 5;

	// Subscribe to modal state
	let modalState = $state($boosterPackModalService);
	$effect(() => {
		const unsubscribe = boosterPackModalService.subscribe((state) => {
			modalState = state;
			if (state.isOpen && state.collectionId && state.packCount > 0) {
				initializePacks();
			}
		});
		return unsubscribe;
	});

	// State
	let isInitializing = $state(false);
	let collection = $state<Collection | null>(null);
	let collectionStickers = $state<Sticker[]>([]);
	let rarities = $state<Rarity[]>([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());

	// Pack states: track which packs are opened and their stickers
	interface PackState {
		id: number;
		isOpened: boolean;
		isOpening: boolean;
		stickers: Sticker[]; // Pre-generated stickers for this pack
		revealedCount: number; // How many stickers have been revealed (0-5)
	}
	let packStates = $state<PackState[]>([]);
	let allBoosterStickers = $state<Sticker[]>([]);
	let boosterStickerRarityMap = $state<Map<string, string>>(new Map());

	// Currently viewing pack (null = pack selection, number = viewing specific pack's results)
	let viewingPackId = $state<number | null>(null);

	// Dragging state for pack movement
	let draggingPackId = $state<number | null>(null);
	let activeDragPackIds = $state<Set<number>>(new Set()); // Packs being dragged together in this session
	let packXOffsets = $state<Map<number, number>>(new Map());
	let gridRef = $state<HTMLElement | null>(null);

	async function handlePackMouseDown(packId: number, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();

		const packIndex = packStates.findIndex((p) => p.id === packId);
		if (packIndex === -1 || packStates[packIndex].isOpened) return;

		// Pre-generate stickers for this pack and all packs above it if not already done
		for (let i = 0; i <= packId; i++) {
			const idx = packStates.findIndex((p) => p.id === i);
			if (idx !== -1 && packStates[idx].stickers.length === 0 && !packStates[idx].isOpened) {
				await generatePackStickers(i);
			}
		}

		draggingPackId = packId;

		// Track all unopened packs that will be dragged together
		const draggedPacks = new Set<number>();
		for (let i = 0; i <= packId; i++) {
			const pack = packStates.find((p) => p.id === i);
			if (pack && !pack.isOpened) {
				draggedPacks.add(i);
			}
		}
		activeDragPackIds = draggedPacks;
	}

	function handleMouseUp() {
		if (draggingPackId !== null) {
			draggingPackId = null;
			activeDragPackIds = new Set();
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (draggingPackId === null || !gridRef) return;
		const gridRect = gridRef.getBoundingClientRect();
		const packWidth = 120;
		const relativeX = event.clientX - gridRect.left;

		// Calculate the offset (centered on cursor)
		let offset = relativeX - packWidth / 2;

		// Clamp offset to keep pack within the grid (columns 1-7)
		const minOffset = 0;
		const maxOffset = gridRect.width - packWidth;
		offset = Math.max(minOffset, Math.min(maxOffset, offset));

		const newOffsets = new Map(packXOffsets);
		// Update offset for all packs that are part of this drag session
		for (const packId of activeDragPackIds) {
			newOffsets.set(packId, offset);
		}
		packXOffsets = newOffsets;

		// Calculate how many cells the pack has uncovered based on position
		const cellWidth = gridRect.width / 7;
		// Pack starts at column 0, reveals happen when pack moves past cell boundaries
		// Cell 1 is revealed when pack's right edge passes cell 1's left edge
		const packRightEdge = offset + packWidth;
		const revealedCells = Math.min(5, Math.max(0, Math.floor((packRightEdge - cellWidth) / cellWidth)));

		// Update reveal count for dragged pack and all unopened packs above it
		for (let i = 0; i <= draggingPackId; i++) {
			const packIndex = packStates.findIndex((p) => p.id === i);
			if (packIndex === -1 || packStates[packIndex].isOpened) continue;

			if (revealedCells > packStates[packIndex].revealedCount) {
				packStates[packIndex].revealedCount = revealedCells;

				// Check if all 5 stickers are revealed
				if (revealedCells === 5) {
					finalizePackOpening(i);
				}
			}
		}
	}

	async function generatePackStickers(packId: number) {
		const packIndex = packStates.findIndex((p) => p.id === packId);
		if (packIndex === -1 || collectionStickers.length === 0) return;

		// Weighted selection for this pack's stickers
		const MAX_SORT_ORDER = 4;
		const weightedStickers = collectionStickers.map((sticker) => {
			const rarity = getStickerRarity(sticker);
			const sortOrder = rarity?.sortOrder ?? 0;
			const weight = getRarityWeight(sortOrder, MAX_SORT_ORDER);
			return { item: sticker, weight };
		});

		const packStickers = weightedRandomSelect(weightedStickers, BOOSTER_PACK_SIZE);

		// Find the common rarity (sortOrder === 0) to use as fallback
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Track rarity for display
		const newRarityMap = new Map(boosterStickerRarityMap);
		for (const sticker of packStickers) {
			if (commonRarity) {
				newRarityMap.set(String(sticker.id), String(commonRarity.id));
			}
		}
		boosterStickerRarityMap = newRarityMap;

		// Store the stickers in pack state
		packStates[packIndex].stickers = packStickers;
	}

	async function finalizePackOpening(packId: number) {
		const packIndex = packStates.findIndex((p) => p.id === packId);
		if (packIndex === -1 || packStates[packIndex].isOpened) return;

		const packStickers = packStates[packIndex].stickers;

		// Mark one booster pack as opened in the database
		await openUserBoosterPacksBatch(modalState.collectionId!, 1);

		// Find the common rarity for acquiring
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Acquire all stickers from this pack
		for (const sticker of packStickers) {
			await acquireSticker(sticker.id, sticker.sourceId, modalState.collectionId!, commonRarity?.id);
		}

		// Mark pack as opened
		packStates[packIndex].isOpened = true;

		// Add to all stickers
		allBoosterStickers = [...allBoosterStickers, ...packStickers];
	}

	function getPackTransform(packId: number): string {
		const offset = packXOffsets.get(packId);
		if (offset !== undefined) {
			return `translateX(${offset}px)`;
		}
		return '';
	}

	function getPackOpacity(packId: number): number {
		if (!gridRef) return 1;
		const offset = packXOffsets.get(packId);
		if (offset === undefined) return 1;

		const gridRect = gridRef.getBoundingClientRect();
		const cellWidth = gridRect.width / 7;
		const packWidth = 120;

		// Column 7 starts at cellWidth * 6
		const col7Start = cellWidth * 6;
		const packLeftEdge = offset;

		// Fade as pack enters column 7
		if (packLeftEdge >= col7Start) {
			// Calculate how far into column 7 (0 to 1)
			const progress = (packLeftEdge - col7Start) / (cellWidth - packWidth + cellWidth);
			return Math.max(0, 1 - progress);
		}
		return 1;
	}

	function getRevealedSticker(packId: number, cellIndex: number): Sticker | null {
		const pack = packStates.find((p) => p.id === packId);
		if (!pack || cellIndex >= pack.revealedCount || cellIndex >= pack.stickers.length) {
			return null;
		}
		return pack.stickers[cellIndex];
	}

	// Derive if all packs are opened
	$effect(() => {
		// This effect just keeps reactivity working
	});

	function getAllPacksOpened(): boolean {
		return packStates.length > 0 && packStates.every((p) => p.isOpened);
	}

	async function initializePacks() {
		if (!modalState.collectionId || modalState.packCount <= 0) return;

		isInitializing = true;
		allBoosterStickers = [];
		boosterStickerRarityMap = new Map();
		viewingPackId = null;

		// Load collection data for display
		collection = await getCollection(modalState.collectionId);

		// Load rarities
		rarities = await getRarityCollection();
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));

		// Load collection stickers
		collectionStickers = await getStickersForCollection(modalState.collectionId);

		// Initialize pack states (all unopened)
		packStates = Array.from({ length: modalState.packCount }, (_, i) => ({
			id: i,
			isOpened: false,
			isOpening: false,
			stickers: [],
			revealedCount: 0
		}));

		// Reset drag state
		packXOffsets = new Map();

		isInitializing = false;
	}

	function getStickerRarity(_sticker: Sticker): Rarity | null {
		// Stickers don't have inherent rarity, so return null
		// The rarity is assigned when acquired via booster pack
		return null;
	}

	function getBoosterStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = boosterStickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}

	function handleBackToPacks() {
		viewingPackId = null;
	}

	function handleDone() {
		dispatch('done', { stickers: allBoosterStickers });
		boosterPackModalService.close();
	}

	function handleClose() {
		boosterPackModalService.close();
	}
</script>

{#if modalState.isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleClose}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		role="dialog"
		aria-modal="true"
		aria-labelledby="booster-modal-title"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-base-100 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="bg-base-200 flex items-center justify-between border-b p-4">
				<div>
					<h3 id="booster-modal-title" class="text-xl font-bold">
						{#if viewingPackId !== null}
							Pack #{viewingPackId + 1} Opened!
						{:else if getAllPacksOpened()}
							All Packs Opened!
						{:else}
							Booster Pack Rewards!
						{/if}
					</h3>
					<p class="text-base-content/70 text-sm">
						{#if viewingPackId !== null}
							{@const pack = packStates.find((p) => p.id === viewingPackId)}
							{pack?.stickers.length ?? 0} stickers revealed
						{:else}
							{packStates.filter((p) => p.isOpened).length} / {modalState.packCount} packs opened
						{/if}
					</p>
				</div>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={handleClose} aria-label="Close">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if isInitializing}
					<div class="flex flex-col items-center justify-center gap-4 p-8">
						<span class="loading loading-spinner loading-lg"></span>
						<p class="text-base-content/70">Preparing your packs...</p>
					</div>
				{:else if viewingPackId !== null}
					<!-- Viewing a specific pack's results -->
					{@const pack = packStates.find((p) => p.id === viewingPackId)}
					{#if pack}
						<div class="flex flex-col items-center gap-6">
							<div class="grid grid-cols-3 gap-4 md:grid-cols-5">
								{#each pack.stickers as sticker, index (index)}
									{@const rarity = getBoosterStickerRarity(sticker)}
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
							<div class="flex gap-3">
								{#if !getAllPacksOpened()}
									<button class="btn btn-primary" onclick={handleBackToPacks}>
										Open More Packs
									</button>
								{:else}
									<button class="btn btn-primary" onclick={handleDone}>
										Awesome!
									</button>
								{/if}
							</div>
						</div>
					{/if}
				{:else if collectionStickers.length === 0 && !isInitializing}
					<!-- No stickers available -->
					<div class="flex flex-col items-center gap-4 py-8">
						<div class="text-base-content/60 text-center">
							<p>No stickers available in this collection.</p>
						</div>
						<button class="btn btn-outline" onclick={handleDone}>
							Back
						</button>
					</div>
				{:else}
					<!-- Pack selection view -->
					<div class="flex flex-col items-center gap-6">
						{#if !getAllPacksOpened()}
							<p class="text-base-content/70 text-center">
								Drag the pack to the right to reveal your stickers!
							</p>
						{/if}
						<div class="grid grid-cols-7 gap-2" bind:this={gridRef}>
							{#each packStates as pack (pack.id)}
								<!-- Column 1: Booster pack -->
								{#if pack.isOpened}
									<!-- Opened pack - show as dimmed/checked -->
									<div
										class="relative z-10 border border-black"
										style="transform: {getPackTransform(pack.id)}"
									>
										<div class="opacity-40">
											{#if collection}
												<BoosterPackCard {collection} showTitle={false} maxWidth="120px" />
											{/if}
										</div>
										<div
											class="bg-success text-success-content absolute inset-0 flex items-center justify-center rounded-lg bg-opacity-80"
										>
											<div class="text-center">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="mx-auto h-12 w-12"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 13l4 4L19 7"
													/>
												</svg>
												<p class="mt-1 text-sm font-bold">Opened</p>
												<button
													class="btn btn-xs btn-ghost mt-2"
													onclick={() => (viewingPackId = pack.id)}
												>
													View
												</button>
											</div>
										</div>
									</div>
								{:else if pack.isOpening}
									<!-- Currently opening -->
									<div
										class="relative z-10 border border-black"
										style="transform: {getPackTransform(pack.id)}"
									>
										{#if collection}
											<BoosterPackCard {collection} showTitle={false} maxWidth="120px" />
										{/if}
										<div
											class="bg-base-300 absolute inset-0 flex items-center justify-center rounded-lg bg-opacity-70"
										>
											<span class="loading loading-spinner loading-lg"></span>
										</div>
									</div>
								{:else}
									<!-- Unopened pack - clickable -->
									<button
										class="z-10 cursor-pointer border border-black transition-opacity"
										style="transform: {getPackTransform(pack.id)}; opacity: {getPackOpacity(pack.id)}"
										onmousedown={(e) => handlePackMouseDown(pack.id, e)}
									>
										{#if collection}
											<BoosterPackCard {collection} showTitle={false} maxWidth="120px" />
										{/if}
									</button>
								{/if}
								<!-- Columns 2-6: Sticker reveal cells -->
								{#each Array(5) as _, i (i)}
									{@const revealedSticker = getRevealedSticker(pack.id, i)}
									<div class="flex aspect-[2/3] items-center justify-center border border-black">
										{#if revealedSticker}
											{@const rarity = getBoosterStickerRarity(revealedSticker)}
											<div class="text-center">
												<StickerItem
													sticker={revealedSticker}
													bgColor={rarity?.colorFrom ?? '#8b5cf6'}
													borderColor={rarity?.colorTo}
												/>
												<p class="mt-1 truncate text-xs">{revealedSticker.name}</p>
											</div>
										{/if}
									</div>
								{/each}
								<!-- Column 7: Fade-out zone -->
								<div class="aspect-[2/3] border border-black"></div>
							{/each}
						</div>
						{#if getAllPacksOpened()}
							<button class="btn btn-primary" onclick={handleDone}>
								Awesome!
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
