<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllUserStickers, mixStickers } from '$services/user-stickers.service';
	import {
		getAllPlacedStickerIds,
		getAllStickerPlacementCounts
	} from '$services/user-sticker-placements.service';
	import { getSticker } from '$services/stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import type { Sticker } from '$types/sticker.type';
	import type { UserSticker } from '$types/user-sticker.type';
	import type { Rarity } from '$types/rarity.type';

	// Child components
	import InventoryStats from './components/InventoryStats.svelte';
	import StickerGroupCard from './components/StickerGroupCard.svelte';
	import EmptyInventory from './components/EmptyInventory.svelte';

	// Represents a unique (stickerId, rarityId) combination owned by the user
	interface OwnedStickerGroup {
		stickerId: string;
		rarityId: string;
		count: number;
		sticker: Sticker;
		rarity: Rarity | null;
		sourceId: string;
	}

	// State
	let userStickers = $state<UserSticker[]>([]);
	let stickerDetails = $state<Map<string, Sticker>>(new Map());
	let placedStickerIds = $state<Set<string>>(new Set());
	let placementCounts = $state<Map<string, number>>(new Map());
	let rarities = $state<Rarity[]>([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let sortedRarities = $state<Rarity[]>([]);
	let isLoading = $state(true);
	let isMixing = $state<string | null>(null);

	// Computed: stickers grouped by (stickerId, rarityId)
	let ownedGroups = $derived.by(() => {
		const groupMap = new Map<string, OwnedStickerGroup>();

		for (const us of userStickers) {
			const stickerId = String(us.stickerId);
			const rarityId = us.rarityId ? String(us.rarityId) : '';
			const key = `${stickerId}-${rarityId}`;

			const existing = groupMap.get(key);
			if (existing) {
				existing.count++;
			} else {
				const sticker = stickerDetails.get(stickerId);
				if (sticker) {
					groupMap.set(key, {
						stickerId,
						rarityId,
						count: 1,
						sticker,
						rarity: rarityId ? (raritiesMap.get(rarityId) ?? null) : null,
						sourceId: String(us.sourceId)
					});
				}
			}
		}

		return Array.from(groupMap.values()).sort((a, b) => {
			const nameCompare = a.sticker.name.localeCompare(b.sticker.name);
			if (nameCompare !== 0) return nameCompare;
			const aSort = a.rarity?.sortOrder ?? -1;
			const bSort = b.rarity?.sortOrder ?? -1;
			return aSort - bSort;
		});
	});

	// Stats
	let totalUniqueStickers = $derived(new Set(ownedGroups.map((g) => g.stickerId)).size);
	let totalCopies = $derived(ownedGroups.reduce((sum, g) => sum + g.count, 0));
	let placedCount = $derived(ownedGroups.filter((g) => placedStickerIds.has(g.stickerId)).length);
	let mixableCount = $derived(ownedGroups.filter((g) => canMix(g)).length);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;

		const [userStickersData, placedIdsData, raritiesData, placementCountsData] = await Promise.all([
			getAllUserStickers(),
			getAllPlacedStickerIds(),
			getRarityCollection(),
			getAllStickerPlacementCounts()
		]);

		userStickers = userStickersData;
		placedStickerIds = new Set(placedIdsData);
		placementCounts = placementCountsData;
		rarities = raritiesData;
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		sortedRarities = [...rarities].sort((a, b) => a.sortOrder - b.sortOrder);

		// Get unique sticker IDs and fetch details
		const uniqueStickerIds = [...new Set(userStickersData.map((us) => String(us.stickerId)))];
		const detailsMap = new Map<string, Sticker>();
		for (const stickerId of uniqueStickerIds) {
			const details = await getSticker(stickerId);
			if (details) {
				detailsMap.set(stickerId, details);
			}
		}
		stickerDetails = detailsMap;
		isLoading = false;
	}

	function isPlaced(stickerId: string): boolean {
		return placedStickerIds.has(stickerId);
	}

	function getPlacementCount(stickerId: string): number {
		return placementCounts.get(stickerId) ?? 0;
	}

	function getTotalCopies(stickerId: string): number {
		return userStickers.filter((us) => String(us.stickerId) === stickerId).length;
	}

	function getNextRarity(currentRarity: Rarity | null): Rarity | null {
		if (!currentRarity) return sortedRarities[0] ?? null;
		const currentIndex = sortedRarities.findIndex((r) => r.id === currentRarity.id);
		if (currentIndex === -1 || currentIndex >= sortedRarities.length - 1) {
			return null;
		}
		return sortedRarities[currentIndex + 1];
	}

	function canMix(group: OwnedStickerGroup): boolean {
		if (group.count < 2) return false;
		const nextRarity = getNextRarity(group.rarity);
		return nextRarity !== null;
	}

	async function handleMix(event: CustomEvent<OwnedStickerGroup>) {
		const group = event.detail;
		const nextRarity = getNextRarity(group.rarity);
		if (!nextRarity) return;

		const key = `${group.stickerId}-${group.rarityId}`;
		isMixing = key;

		try {
			const newSticker = await mixStickers(
				group.stickerId,
				group.rarityId,
				String(nextRarity.id),
				group.sourceId
			);

			let removed = 0;
			userStickers = userStickers.filter((us) => {
				if (removed >= 2) return true;
				const matches =
					String(us.stickerId) === group.stickerId &&
					(group.rarityId === ''
						? !us.rarityId || us.rarityId === ''
						: String(us.rarityId) === group.rarityId);
				if (matches) {
					removed++;
					return false;
				}
				return true;
			});

			userStickers = [...userStickers, newSticker];
		} catch (error) {
			console.error('Failed to mix stickers:', error);
		} finally {
			isMixing = null;
		}
	}

	async function handleMixAll() {
		const mixableGroups = ownedGroups.filter((g) => canMix(g));
		if (mixableGroups.length === 0) return;

		isMixing = 'all';

		try {
			const newStickers: UserSticker[] = [];
			const removals: Array<{ stickerId: string; rarityId: string }> = [];

			for (const group of mixableGroups) {
				const nextRarity = getNextRarity(group.rarity);
				if (nextRarity) {
					const newSticker = await mixStickers(
						group.stickerId,
						group.rarityId,
						String(nextRarity.id),
						group.sourceId
					);
					newStickers.push(newSticker);
					removals.push({ stickerId: group.stickerId, rarityId: group.rarityId });
				}
			}

			const removalCounts = new Map<string, number>();
			for (const r of removals) {
				const key = `${r.stickerId}-${r.rarityId}`;
				removalCounts.set(key, 0);
			}

			userStickers = userStickers.filter((us) => {
				const stickerId = String(us.stickerId);
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				const key = `${stickerId}-${rarityId}`;

				if (removalCounts.has(key)) {
					const count = removalCounts.get(key)!;
					if (count < 2) {
						removalCounts.set(key, count + 1);
						return false;
					}
				}
				return true;
			});

			userStickers = [...userStickers, ...newStickers];
		} catch (error) {
			console.error('Failed to mix all stickers:', error);
		} finally {
			isMixing = null;
		}
	}
</script>

<div class="flex h-full flex-col gap-6">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">My Stickers</h1>
			<p class="text-base-content/70 mt-1">Your sticker collection inventory</p>
		</div>
		{#if mixableCount > 0}
			<button class="btn btn-secondary gap-2" onclick={handleMixAll} disabled={isMixing !== null}>
				{#if isMixing === 'all'}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				{/if}
				Mix All ({mixableCount})
			</button>
		{/if}
	</div>

	<!-- Stats -->
	<InventoryStats {totalUniqueStickers} {totalCopies} {placedCount} {mixableCount} />

	<!-- Content -->
	{#if isLoading}
		<div class="flex justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if ownedGroups.length === 0}
		<EmptyInventory />
	{:else}
		<!-- Sticker Grid -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each ownedGroups as group (`${group.stickerId}-${group.rarityId}`)}
					{@const groupKey = `${group.stickerId}-${group.rarityId}`}
					<StickerGroupCard
						{group}
						isPlaced={isPlaced(group.stickerId)}
						canMix={canMix(group)}
						nextRarity={getNextRarity(group.rarity)}
						isMixing={isMixing === groupKey}
						placementCount={getPlacementCount(group.stickerId)}
						totalCopies={getTotalCopies(group.stickerId)}
						on:mix={handleMix}
					/>
				{/each}
			</div>
		</div>
	{/if}
</div>
