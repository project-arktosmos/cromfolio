<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import { getStickersForCollection } from '$services/collections.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { openUserBoosterPacksBatch } from '$services/user-booster-packs.service';
	import { acquireSticker } from '$services/user-stickers.service';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import StickerItem from '$components/core/StickerItem.svelte';

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
				openPacks();
			}
		});
		return unsubscribe;
	});

	// State
	let isLoading = $state(false);
	let boosterStickers = $state<Sticker[]>([]);
	let boosterStickerRarityMap = $state<Map<string, string>>(new Map());
	let rarities = $state<Rarity[]>([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());

	async function openPacks() {
		if (!modalState.collectionId || modalState.packCount <= 0) return;

		isLoading = true;
		boosterStickers = [];
		boosterStickerRarityMap = new Map();

		// Load rarities
		rarities = await getRarityCollection();
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));

		// Load collection stickers
		const collectionStickers = await getStickersForCollection(modalState.collectionId);

		if (collectionStickers.length === 0) {
			isLoading = false;
			return;
		}

		// Mark the booster packs as opened in the database
		await openUserBoosterPacksBatch(modalState.collectionId, modalState.packCount);

		// Calculate total stickers to give (5 per pack)
		const totalStickers = modalState.packCount * BOOSTER_PACK_SIZE;

		// Weighted selection by rarity
		const MAX_SORT_ORDER = 4;
		const weightedStickers = collectionStickers.map((sticker) => {
			const rarity = getStickerRarity(sticker);
			const sortOrder = rarity?.sortOrder ?? 0;
			const weight = getRarityWeight(sortOrder, MAX_SORT_ORDER);
			return { item: sticker, weight };
		});

		boosterStickers = weightedRandomSelect(weightedStickers, totalStickers);

		// Find the common rarity (sortOrder === 0) to use as fallback
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Track rarity for display
		const newRarityMap = new Map<string, string>();
		for (const sticker of boosterStickers) {
			if (commonRarity) {
				newRarityMap.set(String(sticker.id), String(commonRarity.id));
			}
		}
		boosterStickerRarityMap = newRarityMap;

		// Acquire all stickers
		for (const sticker of boosterStickers) {
			await acquireSticker(sticker.id, sticker.sourceId, commonRarity?.id);
		}

		isLoading = false;
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

	function handleDone() {
		dispatch('done', { stickers: boosterStickers });
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
		role="dialog"
		aria-modal="true"
		aria-labelledby="booster-modal-title"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-base-100 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="bg-base-200 flex items-center justify-between border-b p-4">
				<div>
					<h3 id="booster-modal-title" class="text-xl font-bold">Booster Pack Rewards!</h3>
					<p class="text-base-content/70 text-sm">
						Opening {modalState.packCount} pack{modalState.packCount !== 1 ? 's' : ''}
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
				{#if isLoading}
					<div class="flex flex-col items-center justify-center gap-4 p-8">
						<span class="loading loading-spinner loading-lg"></span>
						<p class="text-base-content/70">Opening your packs...</p>
					</div>
				{:else if boosterStickers.length > 0}
					<div class="flex flex-col items-center gap-6">
						<div class="text-center">
							<div class="mb-2 text-4xl">🎁</div>
							<p class="text-base-content/70">
								You got {boosterStickers.length} sticker{boosterStickers.length !== 1 ? 's' : ''}!
							</p>
						</div>
						<div class="grid grid-cols-3 gap-4 md:grid-cols-5">
							{#each boosterStickers as sticker, index (index)}
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
						<button class="btn btn-primary" onclick={handleDone}>
							Awesome!
						</button>
					</div>
				{:else}
					<div class="flex flex-col items-center gap-4 py-8">
						<div class="text-base-content/60 text-center">
							<p>No stickers available in this pack.</p>
						</div>
						<button class="btn btn-outline" onclick={handleDone}>
							Back
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
