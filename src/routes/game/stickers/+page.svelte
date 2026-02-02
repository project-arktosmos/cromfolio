<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import {
		getAllUserStickers,
		getMixableStickers,
		mixStickers,
		type MixableStickerInfo
	} from '$services/user-stickers.service';
	import { getAllPlacedStickerIds } from '$services/user-sticker-placements.service';
	import { getSticker } from '$services/stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Sticker } from '$types/sticker.type';
	import type { UserSticker } from '$types/user-sticker.type';
	import type { Rarity } from '$types/rarity.type';

	// Represents a unique (stickerId, rarityId) combination owned by the user
	interface OwnedStickerGroup {
		stickerId: string;
		rarityId: string;
		count: number;
		sticker: Sticker;
		rarity: Rarity | null;
		sourceId: string; // Keep track of source for mixing
	}

	// State
	let userStickers = $state<UserSticker[]>([]);
	let stickerDetails = $state<Map<string, Sticker>>(new Map());
	let placedStickerIds = $state<Set<string>>(new Set());
	let rarities = $state<Rarity[]>([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let sortedRarities = $state<Rarity[]>([]); // Sorted by sortOrder ascending
	let mixableMap = $state<Map<string, MixableStickerInfo>>(new Map()); // key: stickerId-rarityId
	let isLoading = $state(true);
	let isMixing = $state<string | null>(null); // Track which group is being mixed

	// Computed: stickers grouped by (stickerId, rarityId)
	// Note: empty string rarityId means "no rarity" (can be upgraded to lowest rarity)
	let ownedGroups = $derived.by(() => {
		const groupMap = new Map<string, OwnedStickerGroup>();

		for (const us of userStickers) {
			const stickerId = String(us.stickerId);
			const rarityId = us.rarityId ? String(us.rarityId) : ''; // Use empty string, not 'none'
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
						rarity: rarityId ? raritiesMap.get(rarityId) ?? null : null,
						sourceId: String(us.sourceId)
					});
				}
			}
		}

		// Sort by sticker name, then by rarity sortOrder (no rarity = -1 to sort first)
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
	let placedCount = $derived(
		ownedGroups.filter((g) => placedStickerIds.has(g.stickerId)).length
	);
	let mixableCount = $derived(
		ownedGroups.filter((g) => canMix(g)).length
	);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;

		// Load data in parallel
		const [userStickersData, placedIdsData, raritiesData, mixableData] = await Promise.all([
			getAllUserStickers(),
			getAllPlacedStickerIds(),
			getRarityCollection(),
			getMixableStickers()
		]);

		userStickers = userStickersData;
		placedStickerIds = new Set(placedIdsData);
		rarities = raritiesData;
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		sortedRarities = [...rarities].sort((a, b) => a.sortOrder - b.sortOrder);

		// Build mixable map
		const mMap = new Map<string, MixableStickerInfo>();
		for (const info of mixableData) {
			const key = `${info.stickerId}-${info.rarityId}`;
			mMap.set(key, info);
		}
		mixableMap = mMap;

		// Get unique sticker IDs
		const uniqueStickerIds = [...new Set(userStickersData.map((us) => String(us.stickerId)))];

		// Fetch sticker details
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

	function getNextRarity(currentRarity: Rarity | null): Rarity | null {
		if (!currentRarity) return sortedRarities[0] ?? null;

		const currentIndex = sortedRarities.findIndex((r) => r.id === currentRarity.id);
		if (currentIndex === -1 || currentIndex >= sortedRarities.length - 1) {
			return null; // Already at highest rarity
		}
		return sortedRarities[currentIndex + 1];
	}

	function canMix(group: OwnedStickerGroup): boolean {
		if (group.count < 2) return false;
		// Stickers without rarity (empty string) CAN be mixed to the lowest rarity
		const nextRarity = getNextRarity(group.rarity);
		return nextRarity !== null;
	}

	async function handleMix(group: OwnedStickerGroup) {
		const nextRarity = getNextRarity(group.rarity);
		if (!nextRarity) return;

		const key = `${group.stickerId}-${group.rarityId}`;
		isMixing = key;

		try {
			// Pass empty string for stickers without rarity (backend handles this)
			const newSticker = await mixStickers(group.stickerId, group.rarityId, String(nextRarity.id), group.sourceId);

			// Update userStickers locally instead of reloading
			// Remove 2 stickers with the source rarity
			let removed = 0;
			userStickers = userStickers.filter((us) => {
				if (removed >= 2) return true;
				const matches = String(us.stickerId) === group.stickerId &&
					(group.rarityId === ''
						? (!us.rarityId || us.rarityId === '')
						: String(us.rarityId) === group.rarityId);
				if (matches) {
					removed++;
					return false;
				}
				return true;
			});

			// Add the new upgraded sticker
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

			// Mix each eligible group once (2 -> 1 higher rarity)
			for (const group of mixableGroups) {
				const nextRarity = getNextRarity(group.rarity);
				if (nextRarity) {
					const newSticker = await mixStickers(group.stickerId, group.rarityId, String(nextRarity.id), group.sourceId);
					newStickers.push(newSticker);
					removals.push({ stickerId: group.stickerId, rarityId: group.rarityId });
				}
			}

			// Update userStickers locally
			// Track how many we've removed for each group
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
						return false; // Remove this one
					}
				}
				return true;
			});

			// Add the new upgraded stickers
			userStickers = [...userStickers, ...newStickers];
		} catch (error) {
			console.error('Failed to mix all stickers:', error);
		} finally {
			isMixing = null;
		}
	}
</script>

<div class="flex flex-col h-full gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between shrink-0">
		<div>
			<h1 class="text-3xl font-bold">My Stickers</h1>
			<p class="text-base-content/70 mt-1">Your sticker collection inventory</p>
		</div>
		{#if mixableCount > 0}
			<button
				class="btn btn-secondary gap-2"
				onclick={handleMixAll}
				disabled={isMixing !== null}
			>
				{#if isMixing === 'all'}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				{/if}
				Mix All ({mixableCount})
			</button>
		{/if}
	</div>

	<!-- Stats -->
	<div class="stats stats-vertical sm:stats-horizontal shadow bg-base-200 w-full shrink-0">
		<div class="stat">
			<div class="stat-title">Unique Stickers</div>
			<div class="stat-value text-primary">{totalUniqueStickers}</div>
			<div class="stat-desc">Different stickers owned</div>
		</div>
		<div class="stat">
			<div class="stat-title">Total Copies</div>
			<div class="stat-value text-secondary">{totalCopies}</div>
			<div class="stat-desc">Including duplicates</div>
		</div>
		<div class="stat">
			<div class="stat-title">Placed in Albums</div>
			<div class="stat-value text-success">{placedCount}</div>
			<div class="stat-desc">{totalUniqueStickers > 0 ? Math.round((placedCount / totalUniqueStickers) * 100) : 0}% stuck in albums</div>
		</div>
		<div class="stat">
			<div class="stat-title">Can Mix</div>
			<div class="stat-value text-accent">{mixableCount}</div>
			<div class="stat-desc">Upgrade duplicates</div>
		</div>
	</div>

	<!-- Content -->
	{#if isLoading}
		<div class="flex justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if ownedGroups.length === 0}
		<div class="card bg-base-200">
			<div class="card-body items-center text-center py-12">
				<div class="text-6xl mb-4">🎴</div>
				<h2 class="card-title">No Stickers Yet</h2>
				<p class="text-base-content/60 max-w-md">
					You haven't collected any stickers yet. Open booster packs in the Albums page to start your collection!
				</p>
				<a href="/game/albums" class="btn btn-primary mt-4">Go to Albums</a>
			</div>
		</div>
	{:else}
		<!-- Sticker Grid -->
		<div class="flex-1 overflow-y-auto min-h-0">
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{#each ownedGroups as group (`${group.stickerId}-${group.rarityId}`)}
				{@const placed = isPlaced(group.stickerId)}
				{@const mixable = canMix(group)}
				{@const nextRarity = getNextRarity(group.rarity)}
				{@const groupKey = `${group.stickerId}-${group.rarityId}`}
				<div class="relative">
					<!-- Sticker Card -->
					<div
						class={classNames(
							'card bg-base-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden',
							{ 'ring-2 ring-success': placed },
							{ 'ring-2 ring-accent': mixable && !placed }
						)}
					>
						<div class="aspect-[3/4] p-2">
							<StickerItem
								sticker={group.sticker}
								bgColor={group.rarity?.colorFrom ?? '#6B7280'}
								borderColor={group.rarity?.colorTo}
								classes="w-full h-full"
							/>
						</div>
						<div class="card-body p-3 pt-0 gap-2">
							<p class="text-xs text-center truncate font-medium" title={group.sticker.name}>
								{group.sticker.name}
							</p>
							{#if group.rarity}
								<div
									class="badge badge-sm w-full justify-center"
									style="background: linear-gradient(135deg, {group.rarity.colorFrom}, {group.rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
								>
									{group.rarity.name}
								</div>
							{:else}
								<div class="badge badge-sm badge-ghost w-full justify-center">
									No Rarity
								</div>
							{/if}
							{#if mixable && nextRarity}
								<button
									class="btn btn-xs btn-accent w-full gap-1"
									onclick={() => handleMix(group)}
									disabled={isMixing !== null}
								>
									{#if isMixing === groupKey}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
										</svg>
									{/if}
									Mix to {nextRarity.name}
								</button>
							{/if}
						</div>
					</div>

					<!-- Copy Count Badge -->
					{#if group.count > 1}
						<div class={classNames(
							'absolute top-1 right-1 badge badge-sm font-bold',
							mixable ? 'badge-accent' : 'badge-primary'
						)}>
							x{group.count}
						</div>
					{/if}

					<!-- Placed Indicator -->
					{#if placed}
						<div class="absolute top-1 left-1 badge badge-success badge-sm gap-1">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							Placed
						</div>
					{/if}
				</div>
			{/each}
			</div>
		</div>
	{/if}
</div>
