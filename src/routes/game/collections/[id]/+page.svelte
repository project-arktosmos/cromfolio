<script lang="ts">
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { getCollection, getStickersForCollection } from '$services/collections.service';
	import { getCollectionType } from '$services/collection-types.service';
	import {
		getStickerCopyCount,
		getAllUserStickers,
		mixStickers
	} from '$services/user-stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { sourceExists } from '$services/sources.service';
	import { getStickerType } from '$services/sticker-types.service';
	import { getTagsBySticker, getTagsForStickers } from '$services/tags.service';
	import {
		getAllStampPacks,
		getStampsByPack,
		getStamp,
		getStampsDataDir
	} from '$services/stamp-packs.service';
	import {
		getPlacedStampsByCollection,
		placeStamp,
		removePlacedStamp
	} from '$services/user-placed-stamps.service';
	import {
		getPlacedStickerIdsForCollection,
		placeSticker,
		unstickSticker,
		getAllStickerPlacementCounts
	} from '$services/user-sticker-placements.service';
	import {
		getPlacedIconsByCollection,
		placeIcon,
		removePlacedIcon
	} from '$services/user-placed-icons.service';
	import { triviaModalService } from '$services/trivia-modal.service';
	import {
		countUnopenedUserBoosterPacksByCollection,
		awardUserBoosterPacksBatch
	} from '$services/user-booster-packs.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import { stampsModalService } from '$services/stamps-modal.service';
	import type { Collection } from '$types/collection.type';
	import type { CollectionType } from '$types/collection-type.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Source } from '$types/source.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type { Tag } from '$types/tag.type';
	import type { GridPackedPage, GroupedFragments } from '$types/album-layout.type';
	import type { UserSticker } from '$types/user-sticker.type';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';
	import type { UserPlacedStamp } from '$types/user-placed-stamp.type';
	import type { UserPlacedIcon } from '$types/user-placed-icon.type';
	import { DEFAULT_GRID_PACKING_CONFIG, getGridPageAspectRatio } from '$types/album-layout.type';
	import {
		packStickersIntoGrid,
		separateWinnerStickers,
		groupFragmentStickers
	} from '$utils/album-packing';
	import StickerItem from '$components/core/StickerItem.svelte';
	import StickerPreview from '$components/core/StickerPreview.svelte';
	import StampPackRow from '$components/game/StampPackRow.svelte';
	import StampHoverPanel from '$components/game/StampHoverPanel.svelte';
	import CursorStamp from '$components/game/CursorStamp.svelte';
	import PlacedStampOverlay from '$components/game/PlacedStampOverlay.svelte';
	import IconRow from '$components/game/IconRow.svelte';
	import IconPanel from '$components/game/IconPanel.svelte';
	import CursorIcon from '$components/game/CursorIcon.svelte';
	import PlacedIconOverlay from '$components/game/PlacedIconOverlay.svelte';

	// Layout configuration
	const PAGE_ASPECT = getGridPageAspectRatio();

	// Pokemon grid config: 3 columns x 4 rows = 12 stickers per page
	const POKEMON_COLS = 3;
	const POKEMON_ROWS = 4;
	const POKEMON_PER_PAGE = POKEMON_COLS * POKEMON_ROWS;

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
		const match = title.match(/gen(?:eration)?\s*(\d+|[ivx]+)/i);
		if (!match) return null;

		const genStr = match[1].toLowerCase();
		const romanMap: Record<string, number> = {
			i: 1,
			ii: 2,
			iii: 3,
			iv: 4,
			v: 5,
			vi: 6,
			vii: 7,
			viii: 8,
			ix: 9
		};
		if (romanMap[genStr]) return romanMap[genStr];

		const num = parseInt(genStr, 10);
		return isNaN(num) ? null : num;
	}

	interface CollectionGenInfo {
		generationLabel: string;
		regionLabel: string;
	}

	function getRegionForCollection(col: Collection): CollectionGenInfo | null {
		if (/all\s*pok[eé]mon/i.test(col.title)) {
			return {
				generationLabel: 'Pokémon: Generations 1 - 9',
				regionLabel: 'All Regions'
			};
		}

		const gen = getGenerationFromTitle(col.title);
		if (!gen || !GENERATION_REGIONS[gen]) return null;
		return {
			generationLabel: `Pokémon: Generation ${gen}`,
			regionLabel: GENERATION_REGIONS[gen]
		};
	}

	let collection: Collection | null = $state(null);
	let collectionType: CollectionType | null = $state(null);
	let stickers: Sticker[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let notFound = $state(false);
	let ownedStickerIds = $state<Set<string>>(new Set());
	let placedStickerIds = $state<Set<string>>(new Set());
	let globalPlacementCounts = $state<Map<string, number>>(new Map());
	let copyCountCache = $state<Map<string, number>>(new Map());
	let stickerTagsMap = $state<Map<string, Tag[]>>(new Map());
	let stickerRarityMap = $state<Map<string, string>>(new Map());
	let stickerRarityCopyCount = $state<Map<string, number>>(new Map()); // key: "stickerId::rarityId"
	let userStickersData = $state<UserSticker[]>([]); // Store actual user stickers for mixing
	let unopenedBoosterPacks = $state(0);
	let currentPage = $state(0); // 0 = cover, 1+ = content pages
	let isRefreshing = $state(false); // Loading state for data refresh after modal close
	let showStickersModal = $state(false); // Mobile modal for My Stickers

	// Check if current collection is pokemon type
	let isPokemonCollection = $derived.by(() => {
		if (collectionType === null) return false;
		return collectionType.name?.toLowerCase() === 'pokemon';
	});

	// Reactive config based on collection type
	let config = $derived.by(() => {
		if (isPokemonCollection) {
			return {
				...DEFAULT_GRID_PACKING_CONFIG,
				columns: POKEMON_COLS,
				maxRowsPerPage: POKEMON_ROWS
			};
		}
		return DEFAULT_GRID_PACKING_CONFIG;
	});

	// Rarity counts for collection stats
	let rarityCounts = $derived.by(() => {
		const counts = new Map<string, { total: number; owned: number; rarity: Rarity }>();

		for (const sticker of stickers) {
			const rarityId = stickerRarityMap.get(String(sticker.id));
			if (!rarityId) continue;

			const rarity = raritiesMap.get(rarityId);
			if (!rarity) continue;

			const existing = counts.get(rarityId) || { total: 0, owned: 0, rarity };
			existing.total++;
			if (ownedStickerIds.has(String(sticker.id))) {
				existing.owned++;
			}
			counts.set(rarityId, existing);
		}

		// Sort by rarity sortOrder
		return Array.from(counts.values()).sort((a, b) => a.rarity.sortOrder - b.rarity.sortOrder);
	});

	// Hover preview state
	let hoveredSticker = $state<Sticker | null>(null);
	let mousePosition = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let previewSource = $state<Source | null>(null);
	let previewStickerType = $state<StickerTypeEntity | null>(null);
	let previewTags = $state<Tag[]>([]);

	// Stamp placement state
	let stampPacks = $state<StampPack[]>([]);
	let stampsDataDir = $state<string>('');
	let stampPackCovers = $state<Map<string, string>>(new Map());
	let hoveredPack = $state<StampPack | null>(null);
	let hoveredPackStamps = $state<Stamp[]>([]);
	let selectedStamp = $state<Stamp | null>(null);
	let isPlacementMode = $state(false);
	let placementScale = $state(1.0);
	let placedStampsForCollection = $state<Map<string, UserPlacedStamp[]>>(new Map());
	let stampImageCache = $state<Map<string, Stamp>>(new Map());
	let globalMousePosition = $state({ x: 0, y: 0 });
	let isOverHoverPanel = $state(false);
	let hoverPanelPosition = $state({ x: 0 });

	// Icon placement state
	let showIconPanel = $state(false);
	let iconPanelPosition = $state({ x: 0 });
	let selectedIconPath = $state<string | null>(null);
	let selectedIconColor = $state<string>('#000000');
	let isIconPlacementMode = $state(false);
	let iconPlacementScale = $state(1.0);
	let placedIconsForCollection = $state<Map<string, UserPlacedIcon[]>>(new Map());
	let isOverIconPanel = $state(false);

	// Mixing state
	let isMixing = $state<string | null>(null);

	// Scale constraints
	const MIN_SCALE = 0.25;
	const MAX_SCALE = 3.0;
	const SCALE_STEP = 0.1;

	onMount(async () => {
		const collectionId = $page.params.id;
		if (!collectionId) {
			notFound = true;
			isLoading = false;
			return;
		}

		// Load rarities and stamp packs in parallel
		[rarities, stampPacks, stampsDataDir] = await Promise.all([
			getRarityCollection(),
			getAllStampPacks(),
			getStampsDataDir()
		]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));

		// Load stamp pack cover images
		await loadStampPackCovers();

		// Load the collection
		collection = await getCollection(collectionId);

		if (!collection) {
			notFound = true;
			isLoading = false;
			return;
		}

		// Load collection type if available
		if (collection.collectionTypeId) {
			collectionType = await getCollectionType(collection.collectionTypeId);
		}

		// Load stickers
		stickers = await getStickersForCollection(collection.id);

		// Fetch tags for all stickers
		const stickerIds = stickers.map((s) => s.id);
		stickerTagsMap = await getTagsForStickers(stickerIds);

		// Refresh copy counts
		for (const sticker of stickers) {
			await refreshCopyCount(String(sticker.id));
		}

		// Load owned stickers
		await refreshOwnedSet();
		await refreshGlobalPlacementCounts();

		// Load placed stamps for this collection
		await loadPlacedStampsForCollection(String(collection.id));

		// Load placed icons for this collection
		await loadPlacedIconsForCollection(String(collection.id));

		// Load placed sticker IDs for this collection
		const placedIds = await getPlacedStickerIdsForCollection(collection.id);
		placedStickerIds = new Set(placedIds);

		// Load unopened booster pack count
		unopenedBoosterPacks = await countUnopenedUserBoosterPacksByCollection(collection.id);

		isLoading = false;

		// Open to first page if there are stickers
		if (stickers.length > 0) {
			currentPage = 1;
		}
	});

	onDestroy(() => {
		if (isPlacementMode) {
			window.removeEventListener('mousemove', handleGlobalMouseMove);
			window.removeEventListener('keydown', handleCancelPlacement);
			window.removeEventListener('wheel', handlePlacementWheel);
		}
		if (isIconPlacementMode) {
			window.removeEventListener('mousemove', handleIconGlobalMouseMove);
			window.removeEventListener('keydown', handleCancelIconPlacement);
			window.removeEventListener('wheel', handleIconPlacementWheel);
		}
	});

	// Watch trivia modal state and refresh data when it closes
	let triviaModalWasOpen = $state(false);
	$effect(() => {
		const unsubscribe = triviaModalService.subscribe((state) => {
			if (triviaModalWasOpen && !state.isOpen) {
				// Modal just closed - refresh owned stickers and copy counts
				refreshAfterTrivia();
			}
			triviaModalWasOpen = state.isOpen;
		});
		return unsubscribe;
	});

	// Watch stamps modal for updates and refresh stamp packs
	$effect(() => {
		const unsubscribe = stampsModalService.subscribe((state) => {
			if (state.stampsUpdated) {
				// Stamps were updated - refresh stamp packs
				refreshStampPacks();
				stampsModalService.clearStampsUpdated();
			}
		});
		return unsubscribe;
	});

	async function refreshAllPageData() {
		if (!collection) return;

		isRefreshing = true;

		try {
			// Refresh owned stickers set (includes stickerRarityMap, stickerRarityCopyCount, userStickersData)
			await refreshOwnedSet();

			// Refresh copy counts for all stickers
			for (const sticker of stickers) {
				await refreshCopyCount(String(sticker.id));
			}

			// Refresh global placement counts
			await refreshGlobalPlacementCounts();

			// Refresh placed sticker IDs for this collection
			const placedIds = await getPlacedStickerIdsForCollection(collection.id);
			placedStickerIds = new Set(placedIds);

			// Refresh unopened booster pack count
			unopenedBoosterPacks = await countUnopenedUserBoosterPacksByCollection(collection.id);
		} finally {
			isRefreshing = false;
		}
	}

	// Alias for backwards compatibility
	async function refreshAfterTrivia() {
		await refreshAllPageData();
	}

	async function refreshStampPacks() {
		const [packs, dir] = await Promise.all([getAllStampPacks(), getStampsDataDir()]);
		stampPacks = packs;
		stampsDataDir = dir;
		// Pre-load cover images for packs without tray images
		await loadStampPackCovers();
	}

	async function loadStampPackCovers() {
		const covers = new Map<string, string>();
		for (const pack of stampPacks) {
			// If pack has a tray image, use it
			if (pack.trayImage) {
				covers.set(pack.id, convertFileSrc(`${stampsDataDir}/${pack.trayImage}`));
			} else {
				// Otherwise, get the first stamp and use its image
				try {
					const stamps = await getStampsByPack(pack.id);
					if (stamps.length > 0) {
						covers.set(pack.id, convertFileSrc(`${stampsDataDir}/${stamps[0].imagePath}`));
					}
				} catch (e) {
					console.error('Failed to get cover for pack:', pack.id, e);
				}
			}
		}
		stampPackCovers = covers;
	}

	async function devAwardBoosterPacks() {
		if (!collection) return;
		await awardUserBoosterPacksBatch(10, collection.id, 'dev-tool');
		unopenedBoosterPacks = await countUnopenedUserBoosterPacksByCollection(collection.id);
	}

	async function refreshOwnedSet() {
		if (!collection) return;

		const collectionId = String(collection.id);
		const allUserStickers = await getAllUserStickers();

		// Filter to only stickers earned FROM this collection (by collectionId)
		const userStickers = allUserStickers.filter(
			(us) => String(us.collectionId) === collectionId
		);

		userStickersData = userStickers; // Store for mixing (only this collection's stickers)

		// Build owned sticker IDs set from filtered stickers
		ownedStickerIds = new Set(userStickers.map((us) => String(us.stickerId)));

		const rarityMap = new Map<string, string>();
		const rarityCopyCount = new Map<string, number>();

		for (const us of userStickers) {
			const stickerId = String(us.stickerId);
			const rarityId = us.rarityId ? String(us.rarityId) : '';

			// Track copy count per (stickerId, rarityId) - use :: delimiter to avoid issues with UUIDs
			const copyKey = `${stickerId}::${rarityId}`;
			rarityCopyCount.set(copyKey, (rarityCopyCount.get(copyKey) ?? 0) + 1);

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
		stickerRarityCopyCount = rarityCopyCount;
	}

	async function refreshCopyCount(stickerId: string) {
		const count = await getStickerCopyCount(stickerId);
		copyCountCache = new Map(copyCountCache).set(stickerId, count);
	}

	async function refreshGlobalPlacementCounts() {
		globalPlacementCounts = await getAllStickerPlacementCounts();
	}

	function getAvailableCopies(stickerId: string | number): number {
		const owned = getCachedCopyCount(stickerId);
		const placed = globalPlacementCounts.get(String(stickerId)) ?? 0;
		return owned - placed;
	}

	function getStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}

	function getCachedCopyCount(stickerId: string | number): number {
		return copyCountCache.get(String(stickerId)) ?? 0;
	}

	// Mixing helpers
	function getSortedRarities(): Rarity[] {
		return [...rarities].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	function getNextRarity(currentRarity: Rarity | null): Rarity | null {
		const sorted = getSortedRarities();
		if (!currentRarity) return sorted[0] ?? null;
		const currentIndex = sorted.findIndex((r) => String(r.id) === String(currentRarity.id));
		if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
			return null;
		}
		return sorted[currentIndex + 1];
	}

	// Find the best rarity to mix for a sticker (one with 2+ copies that can upgrade)
	function getMixableRarity(sticker: Sticker): Rarity | null {
		const sorted = getSortedRarities();
		const stickerId = String(sticker.id);
		// Check each rarity from lowest to highest
		for (const rarity of sorted) {
			const rarityId = String(rarity.id);
			const copyKey = `${stickerId}::${rarityId}`;
			const copyCount = stickerRarityCopyCount.get(copyKey) ?? 0;
			if (copyCount >= 2) {
				// Check if there's a next rarity to upgrade to
				const nextRarity = getNextRarity(rarity);
				if (nextRarity) {
					return rarity;
				}
			}
		}
		return null;
	}

	function canMixSticker(sticker: Sticker): boolean {
		return getMixableRarity(sticker) !== null;
	}

	// Interface for grouped stickers (like stickers page)
	interface OwnedStickerGroup {
		stickerId: string;
		rarityId: string;
		count: number;
		sticker: Sticker;
		rarity: Rarity | null;
	}

	// Group owned stickers by (stickerId, rarityId) for stickers in this collection
	let ownedGroups = $derived.by(() => {
		const stickerMap = new Map(stickers.map((s) => [String(s.id), s]));
		// Create index map for album order sorting
		const albumIndexMap = new Map(stickers.map((s, idx) => [String(s.id), idx]));
		const groups: OwnedStickerGroup[] = [];

		// Iterate through the copy count map
		for (const [key, count] of stickerRarityCopyCount.entries()) {
			const [stickerId, rarityId] = key.split('::');
			const sticker = stickerMap.get(stickerId);
			if (!sticker) continue; // Skip stickers not in this collection

			const rarity = rarityId ? (raritiesMap.get(rarityId) ?? null) : null;
			groups.push({
				stickerId,
				rarityId: rarityId || '',
				count,
				sticker,
				rarity
			});
		}

		// Sort by album order (sticker's position in collection), then by rarity sortOrder
		return groups.sort((a, b) => {
			const aIndex = albumIndexMap.get(a.stickerId) ?? Infinity;
			const bIndex = albumIndexMap.get(b.stickerId) ?? Infinity;
			if (aIndex !== bIndex) return aIndex - bIndex;
			const aSort = a.rarity?.sortOrder ?? -1;
			const bSort = b.rarity?.sortOrder ?? -1;
			return aSort - bSort;
		});
	});

	// Check if a group can be mixed
	function canMixGroup(group: OwnedStickerGroup): boolean {
		if (group.count < 2) return false;
		const nextRarity = group.rarity ? getNextRarity(group.rarity) : getSortedRarities()[0] ?? null;
		return nextRarity !== null;
	}

	// Get next rarity for a group
	function getGroupNextRarity(group: OwnedStickerGroup): Rarity | null {
		if (!group.rarity) return getSortedRarities()[0] ?? null;
		return getNextRarity(group.rarity);
	}

	// Get mixable stickers count for this collection
	let mixableStickers = $derived.by(() => {
		return stickers.filter((s) => canMixSticker(s));
	});

	// Get mixable groups count
	let mixableGroups = $derived.by(() => {
		return ownedGroups.filter((g) => canMixGroup(g));
	});

	// Find the sourceId from user's sticker data for mixing
	function getUserStickerSourceId(stickerId: string | number, rarityId: string | number): string {
		const us = userStickersData.find(
			(u) =>
				String(u.stickerId) === String(stickerId) &&
				String(u.rarityId ?? '') === String(rarityId)
		);
		return us ? String(us.sourceId ?? '') : '';
	}

	async function handleMixSticker(sticker: Sticker) {
		const mixableRarity = getMixableRarity(sticker);
		if (!mixableRarity) return;
		const nextRarity = getNextRarity(mixableRarity);
		if (!nextRarity) return;

		const key = String(sticker.id);
		isMixing = key;

		try {
			const sourceId = getUserStickerSourceId(sticker.id, mixableRarity.id);
			await mixStickers(sticker.id, mixableRarity.id, nextRarity.id, sourceId);
			// Refresh data after mixing
			await refreshOwnedSet();
			await refreshCopyCount(key);
		} catch (error) {
			console.error('Failed to mix sticker:', error);
		} finally {
			isMixing = null;
		}
	}

	async function handleMixGroup(group: OwnedStickerGroup) {
		const nextRarity = getGroupNextRarity(group);
		if (!nextRarity) return;

		const key = `${group.stickerId}::${group.rarityId}`;
		isMixing = key;

		try {
			const sourceId = getUserStickerSourceId(group.stickerId, group.rarityId);
			await mixStickers(group.stickerId, group.rarityId, nextRarity.id, sourceId);
			// Refresh data after mixing
			await refreshOwnedSet();
			await refreshCopyCount(group.stickerId);
		} catch (error) {
			console.error('Failed to mix group:', error);
		} finally {
			isMixing = null;
		}
	}

	async function handleMixAll() {
		const toMix = mixableGroups;
		if (toMix.length === 0) return;

		isMixing = 'all';

		try {
			for (const group of toMix) {
				const nextRarity = getGroupNextRarity(group);
				if (nextRarity) {
					const sourceId = getUserStickerSourceId(group.stickerId, group.rarityId);
					await mixStickers(group.stickerId, group.rarityId, nextRarity.id, sourceId);
				}
			}
			// Refresh all data after mixing
			await refreshOwnedSet();
			for (const sticker of stickers) {
				await refreshCopyCount(String(sticker.id));
			}
		} catch (error) {
			console.error('Failed to mix all stickers:', error);
		} finally {
			isMixing = null;
		}
	}

	// Separate regular stickers from winners
	let { regularStickers, winnerStickers } = $derived.by(() => {
		if (stickers.length === 0)
			return { regularStickers: [] as Sticker[], winnerStickers: [] as Sticker[] };
		const { regular, winners } = separateWinnerStickers(stickers, stickerTagsMap);
		return { regularStickers: regular, winnerStickers: winners };
	});

	// For pokemon: simple pagination
	let pokemonPages = $derived.by(() => {
		if (!isPokemonCollection || regularStickers.length === 0) return [];
		const pages: Sticker[][] = [];
		for (let i = 0; i < regularStickers.length; i += POKEMON_PER_PAGE) {
			pages.push(regularStickers.slice(i, i + POKEMON_PER_PAGE));
		}
		return pages;
	});

	// Pack regular stickers into grid-based pages
	let packedPages = $derived.by(() => {
		if (regularStickers.length === 0) return [];
		return packStickersIntoGrid(regularStickers, config);
	});

	// Group winner fragment stickers
	let groupedWinners = $derived.by(() => {
		if (winnerStickers.length === 0) return [] as GroupedFragments[];
		const startingIndex = packedPages.length;
		const { grouped } = groupFragmentStickers(winnerStickers, startingIndex);
		return grouped;
	});

	function getTotalRegularPages(): number {
		if (isPokemonCollection) return pokemonPages.length;
		return packedPages.length;
	}

	function getTotalWinnerPages(): number {
		return groupedWinners.length;
	}

	// Total pages: 1 cover + all regular pages + all winner pages
	function getTotalPages(): number {
		return 1 + getTotalRegularPages() + getTotalWinnerPages();
	}

	function isCoverPage(): boolean {
		return currentPage === 0;
	}

	function isWinnerPage(): boolean {
		const winnerPageStart = 1 + getTotalRegularPages();
		return currentPage >= winnerPageStart;
	}

	function isRegularPage(): boolean {
		return !isCoverPage() && !isWinnerPage();
	}

	// Get the actual page index for regular pages (0-indexed)
	function getRegularPageIndex(): number {
		return currentPage - 1;
	}

	// Get the winner index for winner pages (0-indexed)
	function getWinnerPageIndex(): number {
		const winnerPageStart = 1 + getTotalRegularPages();
		return currentPage - winnerPageStart;
	}

	// Get current pokemon page stickers
	function getCurrentPokemonPage(): Sticker[] | null {
		const pageIdx = getRegularPageIndex();
		return pokemonPages[pageIdx] ?? null;
	}

	// Get current packed page
	function getCurrentPackedPage(): GridPackedPage | null {
		const pageIdx = getRegularPageIndex();
		return packedPages[pageIdx] ?? null;
	}

	// Get current winner
	function getCurrentWinner(): GroupedFragments | null {
		if (!isWinnerPage()) return null;
		const winnerIdx = getWinnerPageIndex();
		return groupedWinners[winnerIdx] ?? null;
	}

	// Get page index for stamps/icons (considering cover is -1)
	function getCurrentPageIndexForOverlays(): number {
		if (isCoverPage()) return -1;
		if (isWinnerPage()) {
			return getTotalRegularPages() + getWinnerPageIndex();
		}
		return getRegularPageIndex();
	}

	function nextPage() {
		const totalPages = getTotalPages();
		if (currentPage >= totalPages - 1) return;
		currentPage += 1;
	}

	function prevPage() {
		if (currentPage <= 0) return;
		currentPage -= 1;
	}

	function goToPage(pageNum: number) {
		const totalPages = getTotalPages();
		if (pageNum >= 0 && pageNum < totalPages) {
			currentPage = pageNum;
		}
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

	async function handleStickerClick(sticker: Sticker) {
		if (!collection) return;

		const stickerId = String(sticker.id);
		const owned = getCachedCopyCount(stickerId) > 0;
		const placed = placedStickerIds.has(stickerId);
		const availableCopies = getAvailableCopies(stickerId);

		if (!owned) return;

		if (placed) {
			await unstickSticker(sticker.id, collection.id);
			placedStickerIds = new Set([...placedStickerIds].filter((id) => id !== stickerId));
			const currentCount = globalPlacementCounts.get(stickerId) ?? 0;
			globalPlacementCounts = new Map(globalPlacementCounts).set(
				stickerId,
				Math.max(0, currentCount - 1)
			);
		} else {
			if (availableCopies <= 0) return;
			await placeSticker(sticker.id, collection.id);
			placedStickerIds = new Set([...placedStickerIds, stickerId]);
			const currentCount = globalPlacementCounts.get(stickerId) ?? 0;
			globalPlacementCounts = new Map(globalPlacementCounts).set(stickerId, currentCount + 1);
		}
	}

	// Stamp functions
	async function handlePackHover(pack: StampPack, event: MouseEvent) {
		hoveredPack = pack;
		hoverPanelPosition = { x: event.clientX };
		hoveredPackStamps = await getStampsByPack(pack.id);
		for (const stamp of hoveredPackStamps) {
			stampImageCache.set(stamp.id, stamp);
		}
	}

	function handlePackLeave() {
		setTimeout(() => {
			if (!isOverHoverPanel) {
				hoveredPack = null;
				hoveredPackStamps = [];
			}
		}, 150);
	}

	function handlePanelEnter() {
		isOverHoverPanel = true;
	}

	function handlePanelLeave() {
		isOverHoverPanel = false;
		hoveredPack = null;
		hoveredPackStamps = [];
	}

	function handleStampSelect(stamp: Stamp) {
		selectedStamp = stamp;
		isPlacementMode = true;
		placementScale = 1.0;
		hoveredPack = null;
		hoveredPackStamps = [];
		isOverHoverPanel = false;

		window.addEventListener('mousemove', handleGlobalMouseMove);
		window.addEventListener('keydown', handleCancelPlacement);
		window.addEventListener('wheel', handlePlacementWheel, { passive: false });
	}

	function handleGlobalMouseMove(event: MouseEvent) {
		globalMousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleCancelPlacement(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			cancelPlacement();
		}
	}

	function handlePlacementWheel(event: WheelEvent) {
		if (!isPlacementMode) return;
		event.preventDefault();

		if (event.deltaY < 0) {
			placementScale = Math.min(MAX_SCALE, placementScale + SCALE_STEP);
		} else {
			placementScale = Math.max(MIN_SCALE, placementScale - SCALE_STEP);
		}
	}

	function cancelPlacement() {
		isPlacementMode = false;
		selectedStamp = null;
		placementScale = 1.0;
		window.removeEventListener('mousemove', handleGlobalMouseMove);
		window.removeEventListener('keydown', handleCancelPlacement);
		window.removeEventListener('wheel', handlePlacementWheel);
	}

	async function handlePageClick(event: MouseEvent, pageElement: HTMLElement, pageIndex: number) {
		if (!isPlacementMode || !selectedStamp || !collection) return;

		const rect = pageElement.getBoundingClientRect();
		const positionX = ((event.clientX - rect.left) / rect.width) * 100;
		const positionY = ((event.clientY - rect.top) / rect.height) * 100;

		const placedStamp = await placeStamp(
			selectedStamp.id,
			collection.id,
			pageIndex,
			positionX,
			positionY,
			placementScale
		);

		const key = `${collection.id}-${pageIndex}`;
		const existingStamps = placedStampsForCollection.get(key) ?? [];
		placedStampsForCollection = new Map(
			placedStampsForCollection.set(key, [...existingStamps, placedStamp])
		);

		stampImageCache.set(selectedStamp.id, selectedStamp);
		cancelPlacement();
	}

	async function handlePlacedStampRemove(placedStamp: UserPlacedStamp) {
		if (!collection) return;
		await removePlacedStamp(placedStamp.id);
		const key = `${collection.id}-${placedStamp.pageIndex}`;
		const existingStamps = placedStampsForCollection.get(key) ?? [];
		placedStampsForCollection = new Map(
			placedStampsForCollection.set(
				key,
				existingStamps.filter((s) => s.id !== placedStamp.id)
			)
		);
	}

	async function loadPlacedStampsForCollection(collectionId: string) {
		const allPlaced = await getPlacedStampsByCollection(collectionId);
		const byPage = new Map<string, UserPlacedStamp[]>();
		for (const ps of allPlaced) {
			const key = `${collectionId}-${ps.pageIndex}`;
			const existing = byPage.get(key) ?? [];
			byPage.set(key, [...existing, ps]);
			if (!stampImageCache.has(String(ps.stampId))) {
				const stamp = await getStamp(ps.stampId);
				if (stamp) stampImageCache.set(String(ps.stampId), stamp);
			}
		}
		placedStampsForCollection = byPage;
	}

	function getPlacedStampsForPage(pageIndex: number): UserPlacedStamp[] {
		if (!collection) return [];
		const key = `${collection.id}-${pageIndex}`;
		return placedStampsForCollection.get(key) ?? [];
	}

	// Icon functions
	function handleIconRowClick(event: MouseEvent) {
		showIconPanel = true;
		iconPanelPosition = { x: event.clientX };
	}

	function handleIconPanelEnter() {
		isOverIconPanel = true;
	}

	function handleIconPanelLeave() {
		isOverIconPanel = false;
		setTimeout(() => {
			if (!isOverIconPanel) {
				showIconPanel = false;
			}
		}, 150);
	}

	function handleIconPanelClose() {
		showIconPanel = false;
		isOverIconPanel = false;
	}

	function handleIconSelect(iconPath: string, color: string) {
		selectedIconPath = iconPath;
		selectedIconColor = color;
		isIconPlacementMode = true;
		iconPlacementScale = 1.0;
		showIconPanel = false;
		isOverIconPanel = false;

		window.addEventListener('mousemove', handleIconGlobalMouseMove);
		window.addEventListener('keydown', handleCancelIconPlacement);
		window.addEventListener('wheel', handleIconPlacementWheel, { passive: false });
	}

	function handleIconGlobalMouseMove(event: MouseEvent) {
		globalMousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleCancelIconPlacement(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			cancelIconPlacement();
		}
	}

	function handleIconPlacementWheel(event: WheelEvent) {
		if (!isIconPlacementMode) return;
		event.preventDefault();

		if (event.deltaY < 0) {
			iconPlacementScale = Math.min(MAX_SCALE, iconPlacementScale + SCALE_STEP);
		} else {
			iconPlacementScale = Math.max(MIN_SCALE, iconPlacementScale - SCALE_STEP);
		}
	}

	function cancelIconPlacement() {
		isIconPlacementMode = false;
		selectedIconPath = null;
		iconPlacementScale = 1.0;
		window.removeEventListener('mousemove', handleIconGlobalMouseMove);
		window.removeEventListener('keydown', handleCancelIconPlacement);
		window.removeEventListener('wheel', handleIconPlacementWheel);
	}

	async function handleIconPageClick(
		event: MouseEvent,
		pageElement: HTMLElement,
		pageIndex: number
	) {
		if (!isIconPlacementMode || !selectedIconPath || !collection) return;

		const rect = pageElement.getBoundingClientRect();
		const positionX = ((event.clientX - rect.left) / rect.width) * 100;
		const positionY = ((event.clientY - rect.top) / rect.height) * 100;

		const placedIcon = await placeIcon(
			selectedIconPath,
			collection.id,
			pageIndex,
			positionX,
			positionY,
			iconPlacementScale,
			0, // rotation
			selectedIconColor
		);

		const key = `${collection.id}-${pageIndex}`;
		const existingIcons = placedIconsForCollection.get(key) ?? [];
		placedIconsForCollection = new Map(
			placedIconsForCollection.set(key, [...existingIcons, placedIcon])
		);

		cancelIconPlacement();
	}

	async function handlePlacedIconRemove(placedIcon: UserPlacedIcon) {
		if (!collection) return;
		await removePlacedIcon(placedIcon.id);
		const key = `${collection.id}-${placedIcon.pageIndex}`;
		const existingIcons = placedIconsForCollection.get(key) ?? [];
		placedIconsForCollection = new Map(
			placedIconsForCollection.set(
				key,
				existingIcons.filter((i) => i.id !== placedIcon.id)
			)
		);
	}

	async function loadPlacedIconsForCollection(collectionId: string) {
		const allPlaced = await getPlacedIconsByCollection(collectionId);
		const byPage = new Map<string, UserPlacedIcon[]>();
		for (const pi of allPlaced) {
			const key = `${collectionId}-${pi.pageIndex}`;
			const existing = byPage.get(key) ?? [];
			byPage.set(key, [...existing, pi]);
		}
		placedIconsForCollection = byPage;
	}

	function getPlacedIconsForPage(pageIndex: number): UserPlacedIcon[] {
		if (!collection) return [];
		const key = `${collection.id}-${pageIndex}`;
		return placedIconsForCollection.get(key) ?? [];
	}
</script>

<div class="w-full h-full p-4 overflow-hidden">
	{#if isLoading}
		<div class="flex h-64 items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if notFound}
		<div class="flex h-64 flex-col items-center justify-center gap-4">
			<div class="alert alert-error max-w-md">
				<span>Collection not found</span>
			</div>
			<button class="btn btn-primary" onclick={() => goto('/game/collections')}>
				Back to Collections
			</button>
		</div>
	{:else if collection}
		{@const totalRegularPages = getTotalRegularPages()}
		{@const totalWinnerPages = getTotalWinnerPages()}
		{@const totalPages = getTotalPages()}

		<div class="flex flex-col gap-4 h-full overflow-hidden">
			<!-- Main content grid: Album + My Stickers -->
			<div class="flex flex-col gap-4 flex-1 min-h-0 md:grid md:grid-cols-3">
				<!-- Album View (col 1) -->
				<div class="order-1 w-full md:col-span-1 flex-shrink-0 md:h-full min-h-0 rounded-lg overflow-hidden">
					{#if stickers.length === 0}
						<div class="flex h-full items-center justify-center">
							<div class="alert alert-info max-w-md">
								<span>No stickers in this collection yet.</span>
							</div>
						</div>
					{:else}
						{@const coverPlacedStamps = getPlacedStampsForPage(-1)}
						{@const coverPlacedIcons = getPlacedIconsForPage(-1)}
						{@const genInfo = getRegionForCollection(collection)}
						<!-- Carousel Container -->
						<div class="flex flex-col h-full">
						<!-- Icons and Stamps Row -->
						<div class="flex items-center gap-4 p-2">
							<div>
								<IconRow onclick={handleIconRowClick} />
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									{#if stampPacks.length > 0}
										<StampPackRow
											{stampPacks}
											coverUrls={stampPackCovers}
											onpackhover={handlePackHover}
											onpackleave={handlePackLeave}
										/>
									{/if}
									<button
										class="btn btn-ghost btn-sm"
										onclick={() => stampsModalService.open()}
										title="Manage Stamp Collections"
									>
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
												d="M12 6v6m0 0v6m0-6h6m-6 0H6"
											/>
										</svg>
									</button>
								</div>
							</div>
						</div>
						<!-- Sliding Carousel -->
						<div class="flex-1 flex items-center justify-center overflow-hidden">
						<div class="w-full md:w-auto md:h-full md:max-w-full overflow-hidden" style="aspect-ratio: {PAGE_ASPECT};">
							<div
								class="flex h-full transition-transform duration-300 ease-in-out"
								style="transform: translateX(-{currentPage * 100}%);"
							>
								<!-- Cover Page Slide -->
								<div class="h-full w-full flex-shrink-0 flex justify-center">
								<div
									class={classNames(
										'relative max-h-full overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT}; height: 100%;"
									onclick={(e) => {
										if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, -1);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, -1);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
								>
									<PlacedStampOverlay
										placedStamps={coverPlacedStamps}
										stampImages={stampImageCache}
										{stampsDataDir}
										editable={!isPlacementMode && !isIconPlacementMode}
										onstampremove={(ps) => handlePlacedStampRemove(ps)}
									/>
									<PlacedIconOverlay
										placedIcons={coverPlacedIcons}
										editable={!isPlacementMode && !isIconPlacementMode}
										oniconremove={(pi) => handlePlacedIconRemove(pi)}
									/>
									<!-- Region/Generation overlay -->
									{#if genInfo}
										<div
											class="absolute left-0 right-0 top-0 z-10 bg-black/70 px-2 py-3 text-center text-white"
										>
											<div class="text-3xl font-bold">{genInfo.regionLabel}</div>
										</div>
										<div
											class="absolute bottom-0 left-0 right-0 z-10 bg-black/70 px-2 py-2 text-center text-white"
										>
											<div class="text-lg font-bold">{genInfo.generationLabel}</div>
										</div>
									{/if}
									<div class="flex h-full flex-col">
										{#if collection.coverImage}
											<img
												src={collection.coverImage}
												alt={collection.title}
												class="h-full w-full object-cover"
											/>
										{:else}
											<div
												class="from-primary to-secondary flex h-full flex-col items-center justify-center bg-gradient-to-br p-8"
											>
												<div class="mb-6 text-6xl text-white/30">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-24 w-24"
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
												<h2 class="text-center text-3xl font-bold text-white drop-shadow-lg">
													{collection.title}
												</h2>
												{#if collection.description}
													<p class="mt-4 max-w-xs text-center text-white/80">
														{collection.description}
													</p>
												{/if}
												<div class="mt-8 text-sm text-white/60">
													{stickers.length} stickers · {totalRegularPages + totalWinnerPages} pages
													{#if totalWinnerPages > 0}
														<span class="ml-1"
															>(incl. {totalWinnerPages} winner{totalWinnerPages > 1 ? 's' : ''})</span
														>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>

							<!-- Regular Pages (Pokemon or Standard) -->
							{#if isPokemonCollection}
								{#each pokemonPages as pokemonStickers, pageIdx}
									{@const actualPageIndex = pageIdx}
									{@const pagePlacedStamps = getPlacedStampsForPage(actualPageIndex)}
									{@const pagePlacedIcons = getPlacedIconsForPage(actualPageIndex)}
									<div
										id="slide-{pageIdx + 1}"
										class="h-full w-full flex-shrink-0 flex justify-center"
									>
										<div
											class={classNames(
												'relative max-h-full overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl',
												{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
											)}
											style="aspect-ratio: {PAGE_ASPECT}; height: 100%;"
											onclick={(e) => {
												if (isPlacementMode)
													handlePageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
												if (isIconPlacementMode)
													handleIconPageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
											}}
											role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
											tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
										>
											<PlacedStampOverlay
												placedStamps={pagePlacedStamps}
												stampImages={stampImageCache}
												{stampsDataDir}
												editable={!isPlacementMode && !isIconPlacementMode}
												onstampremove={(ps) => handlePlacedStampRemove(ps)}
											/>
											<PlacedIconOverlay
												placedIcons={pagePlacedIcons}
												editable={!isPlacementMode && !isIconPlacementMode}
												oniconremove={(pi) => handlePlacedIconRemove(pi)}
											/>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
											>
												{#each pokemonStickers as sticker (sticker.id)}
													{@const copyCount = getCachedCopyCount(sticker.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(sticker.id))}
													{@const availableCopies = getAvailableCopies(sticker.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(sticker)}
													<div
														class={classNames(
															'relative flex cursor-pointer flex-col overflow-hidden',
															{ 'opacity-50 grayscale': !owned }
														)}
														onclick={() => handleStickerClick(sticker)}
														onmouseenter={() => handleStickerMouseEnter(sticker)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<button
																class="bg-base-300/80 border-primary/40 hover:bg-base-300/90 hover:border-primary/60 absolute inset-0 z-20 flex cursor-pointer items-center justify-center rounded border-2 border-dashed transition-colors"
																onclick={(e) => {
																	e.stopPropagation();
																	handleStickerClick(sticker);
																}}
															>
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</button>
														{:else if placedElsewhere}
															<div
																class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
															>
																<span class="text-warning px-1 text-center text-[8px] font-medium"
																	>In other album</span
																>
															</div>
														{/if}
														<div
															class={classNames('h-full w-full', {
																'opacity-70 transition-opacity hover:opacity-100': canPlace
															})}
														>
															<StickerItem
																{sticker}
																bgColor={rarity?.colorFrom ?? '#6B7280'}
																borderColor={rarity?.colorTo}
																classes="w-full h-full object-contain"
															/>
														</div>
													</div>
												{/each}
											</div>
										</div>
									</div>
								{/each}
							{:else}
								{#each packedPages as packedPage, pageIdx}
									{@const actualPageIndex = pageIdx}
									{@const pagePlacedStamps = getPlacedStampsForPage(actualPageIndex)}
									{@const pagePlacedIcons = getPlacedIconsForPage(actualPageIndex)}
									<div
										id="slide-{pageIdx + 1}"
										class="h-full w-full flex-shrink-0 flex justify-center"
									>
										<div
											class={classNames(
												'relative max-h-full overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl',
												{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
											)}
											style="aspect-ratio: {PAGE_ASPECT}; height: 100%;"
											onclick={(e) => {
												if (isPlacementMode)
													handlePageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
												if (isIconPlacementMode)
													handleIconPageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
											}}
											role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
											tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
										>
											<PlacedStampOverlay
												placedStamps={pagePlacedStamps}
												stampImages={stampImageCache}
												{stampsDataDir}
												editable={!isPlacementMode && !isIconPlacementMode}
												onstampremove={(ps) => handlePlacedStampRemove(ps)}
											/>
											<PlacedIconOverlay
												placedIcons={pagePlacedIcons}
												editable={!isPlacementMode && !isIconPlacementMode}
												oniconremove={(pi) => handlePlacedIconRemove(pi)}
											/>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
											>
												{#each packedPage.rows as row}
													{#each row.stickers as { sticker } (sticker.id)}
														{@const copyCount = getCachedCopyCount(sticker.id)}
														{@const owned = copyCount > 0}
														{@const placed = placedStickerIds.has(String(sticker.id))}
														{@const availableCopies = getAvailableCopies(sticker.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														{@const rarity = getStickerRarity(sticker)}
														<div
															class={classNames(
																'relative flex cursor-pointer flex-col overflow-hidden p-1',
																{ 'opacity-50 grayscale': !owned }
															)}
															onclick={() => handleStickerClick(sticker)}
															onmouseenter={() => handleStickerMouseEnter(sticker)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															{#if !placed}
																<p
																	class="absolute left-0 right-0 top-1 z-10 truncate bg-white/80 px-1 text-center text-[10px] text-gray-600"
																>
																	{sticker.name}
																</p>
															{/if}
															{#if canPlace}
																<button
																	class="bg-base-300/80 border-primary/40 hover:bg-base-300/90 hover:border-primary/60 absolute inset-0 z-20 flex cursor-pointer items-center justify-center rounded border-2 border-dashed transition-colors"
																	onclick={(e) => {
																		e.stopPropagation();
																		handleStickerClick(sticker);
																	}}
																>
																	<span class="text-primary/60 text-xs font-medium"
																		>Click to stick</span
																	>
																</button>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span
																		class="text-warning px-1 text-center text-[9px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div
																class={classNames('w-full flex-1', {
																	'opacity-70 transition-opacity hover:opacity-100': canPlace
																})}
															>
																<StickerItem
																	{sticker}
																	bgColor={rarity?.colorFrom ?? '#6B7280'}
																	borderColor={rarity?.colorTo}
																	classes="w-full"
																/>
															</div>
														</div>
													{/each}
												{/each}
											</div>
										</div>
									</div>
								{/each}
							{/if}

							<!-- Winner Pages -->
							{#each groupedWinners as winner, winnerIdx}
								{@const actualPageIndex = totalRegularPages + winnerIdx}
								{@const slideIndex = 1 + totalRegularPages + winnerIdx}
								{@const winnerPlacedStamps = getPlacedStampsForPage(actualPageIndex)}
								{@const winnerPlacedIcons = getPlacedIconsForPage(actualPageIndex)}
								{@const topLeft = winner.fragments.get(1)}
								{@const topRight = winner.fragments.get(2)}
								{@const bottomLeft = winner.fragments.get(3)}
								{@const bottomRight = winner.fragments.get(4)}
								{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
								{@const winnerName =
									firstSticker?.name?.replace(
										/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/,
										''
									) ?? 'Winner'}
								<div
									id="slide-{slideIndex}"
									class="h-full w-full flex-shrink-0 flex justify-center"
								>
									<div
										class={classNames(
											'relative max-h-full overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT}; height: 100%;"
										onclick={(e) => {
											if (isPlacementMode)
												handlePageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
											if (isIconPlacementMode)
												handleIconPageClick(e, e.currentTarget as HTMLElement, actualPageIndex);
										}}
										role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
										tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={winnerPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={winnerPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
										<div class="relative flex h-full flex-col p-4">
											<div class="absolute right-2 top-2 z-10">
												<span class="badge badge-warning badge-sm gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-3 w-3"
														fill="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
														/>
													</svg>
												</span>
											</div>
											<h3 class="mb-2 truncate text-center text-sm font-bold text-gray-800">
												{winnerName}
											</h3>
											<div class="grid flex-1 grid-cols-2 grid-rows-2 gap-px">
												{#each [topLeft, topRight, bottomLeft, bottomRight] as fragment}
													{#if fragment}
														{@const copyCount = getCachedCopyCount(fragment.id)}
														{@const owned = copyCount > 0}
														{@const placed = placedStickerIds.has(String(fragment.id))}
														{@const availableCopies = getAvailableCopies(fragment.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														{@const rarity = getStickerRarity(fragment)}
														<div
															class={classNames('relative cursor-pointer', {
																'opacity-50 grayscale': !owned
															})}
															onclick={() => handleStickerClick(fragment)}
															onmouseenter={() => handleStickerMouseEnter(fragment)}
															onmousemove={handleStickerMouseMove}
															onmouseleave={handleStickerMouseLeave}
															role="button"
															tabindex="0"
														>
															{#if canPlace}
																<div
																	class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-primary/60 text-[10px] font-medium"
																		>Stick</span
																	>
																</div>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span
																		class="text-warning px-1 text-center text-[8px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div
																class={classNames({
																	'opacity-70 transition-opacity hover:opacity-100': canPlace
																})}
															>
																<StickerItem
																	sticker={fragment}
																	bgColor={rarity?.colorFrom ?? '#6B7280'}
																	borderColor={rarity?.colorTo}
																	classes="w-full h-full"
																/>
															</div>
														</div>
													{:else}
														<div class="rounded bg-gray-200"></div>
													{/if}
												{/each}
											</div>
										</div>
									</div>
								</div>
							{/each}
							</div>
						</div>
						</div>
						<!-- Pagination Controls -->
						{#if totalPages > 1}
							<div class="flex items-center justify-center gap-2 py-2">
								<button
									class="btn btn-outline btn-sm"
									onclick={prevPage}
									disabled={currentPage <= 0}
								>
									Previous
								</button>
								<span class="text-base-content/60 text-sm">
									Page {currentPage + 1} of {totalPages}
								</span>
								<button
									class="btn btn-outline btn-sm"
									onclick={nextPage}
									disabled={currentPage >= totalPages - 1}
								>
									Next
								</button>
							</div>
						{/if}
						<!-- Actions Row -->
						<div class="grid grid-cols-2 gap-2 p-2">
							<button
								class="btn btn-primary btn-sm w-full"
								onclick={() => triviaModalService.open(collection!)}
								disabled={isRefreshing}
							>
								{#if isRefreshing}
									<span class="loading loading-spinner loading-xs"></span>
									Updating...
								{:else}
									Play Trivia
								{/if}
							</button>
							<button
								class="btn btn-secondary btn-sm w-full"
								onclick={() =>
									boosterPackModalService.open(
										collection!.id,
										unopenedBoosterPacks,
										'collection-page',
										refreshAfterTrivia
									)}
								disabled={unopenedBoosterPacks === 0 || isRefreshing}
							>
								{#if isRefreshing}
									<span class="loading loading-spinner loading-xs"></span>
									Updating...
								{:else}
									Open Packs ({unopenedBoosterPacks})
								{/if}
							</button>
						</div>
						</div>
					{/if}
				</div>

				<!-- My Stickers Button (mobile only) -->
				<div class="order-2 w-full md:hidden p-2">
					<button
						class="btn btn-primary w-full gap-2"
						onclick={() => showStickersModal = true}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
						My Stickers ({ownedGroups.length})
					</button>
				</div>

				<!-- My Stickers Panel (cols 2-3, desktop only) -->
				<div class="hidden md:block order-3 w-full md:col-span-2 bg-base-200 rounded-lg p-4 overflow-y-auto flex-1 md:h-full min-h-0 relative">
					<!-- Loading overlay for sticker grid -->
					{#if isRefreshing}
						<div class="bg-base-100/80 absolute inset-0 z-10 flex items-center justify-center rounded-lg">
							<div class="flex flex-col items-center gap-2">
								<span class="loading loading-spinner loading-lg"></span>
								<span class="text-base-content/70 text-sm">Updating stickers...</span>
							</div>
						</div>
					{/if}
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-base-content/70 text-sm font-semibold">
							{#if isRefreshing}
								My Stickers (loading...)
							{:else if ownedGroups.length > 0}
								My Stickers ({ownedGroups.length} groups, {ownedGroups.reduce((sum, g) => sum + g.count, 0)} total)
							{:else}
								My Stickers (0 owned)
							{/if}
						</h3>
						{#if mixableGroups.length > 0}
							<button
								class="btn btn-secondary btn-sm gap-2"
								onclick={handleMixAll}
								disabled={isMixing !== null || isRefreshing}
							>
								{#if isMixing === 'all'}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
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
								Mix All ({mixableGroups.length})
							</button>
						{/if}
					</div>
					{#if ownedGroups.length === 0}
						<div class="flex items-center justify-center py-8">
							<div class="text-base-content/50 text-sm">
								Play trivia or open booster packs to collect stickers!
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
							{#each ownedGroups as group (`${group.stickerId}::${group.rarityId}`)}
							{@const groupKey = `${group.stickerId}::${group.rarityId}`}
							{@const placed = placedStickerIds.has(group.stickerId)}
							{@const canMix = canMixGroup(group)}
							{@const nextRarity = getGroupNextRarity(group)}
							<div
								class={classNames(
									'card bg-base-200 relative overflow-hidden shadow-sm transition-shadow hover:shadow-md',
									{ 'ring-success ring-2': placed },
									{ 'ring-primary/50 ring-1': !placed }
								)}
								onmouseenter={() => handleStickerMouseEnter(group.sticker)}
								onmousemove={handleStickerMouseMove}
								onmouseleave={handleStickerMouseLeave}
							>
								<div class="aspect-[3/4] p-2">
									<StickerItem
										sticker={group.sticker}
										bgColor={group.rarity?.colorFrom ?? '#6B7280'}
										borderColor={group.rarity?.colorTo}
										classes="w-full h-full"
									/>
								</div>
								<div class="p-2 pt-0">
									<p class="truncate text-center text-[10px] font-medium" title={group.sticker.name}>
										{group.sticker.name}
									</p>
									{#if group.rarity}
										<div
											class="badge badge-xs mt-1 w-full justify-center"
											style="background: linear-gradient(135deg, {group.rarity.colorFrom}, {group.rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
										>
											{group.rarity.name}
										</div>
									{/if}
									{#if canMix && nextRarity}
										<button
											class="btn btn-secondary btn-xs mt-1 w-full gap-1"
											onclick={(e) => {
												e.stopPropagation();
												handleMixGroup(group);
											}}
											disabled={isMixing !== null || isRefreshing}
											title="Mix 2 {group.rarity?.name ?? 'copies'} to get {nextRarity.name}"
										>
											{#if isMixing === groupKey}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-3 w-3"
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
											Mix
										</button>
									{/if}
								</div>
								<!-- Copy Count Badge -->
								{#if group.count > 1}
									<div class="badge badge-primary badge-xs absolute right-1 top-1 font-bold">
										x{group.count}
									</div>
								{/if}
								<!-- Placed Indicator -->
								{#if placed}
									<div class="badge badge-success badge-xs absolute left-1 top-1 gap-0.5">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-2.5 w-2.5"
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
									</div>
								{/if}
							</div>
						{/each}
						</div>
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
		class="pointer-events-none fixed z-50"
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

<!-- Stamp Hover Panel -->
{#if hoveredPack && hoveredPackStamps.length > 0}
	<StampHoverPanel
		pack={hoveredPack}
		stamps={hoveredPackStamps}
		{stampsDataDir}
		position={hoverPanelPosition}
		onstampselect={handleStampSelect}
		onpanelenter={handlePanelEnter}
		onpanelleave={handlePanelLeave}
	/>
{/if}

<!-- Cursor Stamp -->
{#if isPlacementMode && selectedStamp}
	<CursorStamp
		stamp={selectedStamp}
		{stampsDataDir}
		mousePosition={globalMousePosition}
		scale={placementScale}
	/>
{/if}

<!-- Icon Panel -->
{#if showIconPanel}
	<IconPanel
		position={iconPanelPosition}
		oniconselect={handleIconSelect}
		onpanelenter={handleIconPanelEnter}
		onpanelleave={handleIconPanelLeave}
		onclose={handleIconPanelClose}
	/>
{/if}

<!-- Cursor Icon -->
{#if isIconPlacementMode && selectedIconPath}
	<CursorIcon
		iconPath={selectedIconPath}
		color={selectedIconColor}
		mousePosition={globalMousePosition}
		scale={iconPlacementScale}
	/>
{/if}

<!-- My Stickers Modal (mobile only) - Full screen slide up -->
<div
	class={classNames(
		'fixed inset-0 z-50 md:hidden bg-base-100 flex flex-col transition-transform duration-300 ease-out',
		showStickersModal ? 'translate-y-0' : 'translate-y-full'
	)}
	style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);"
>
	<!-- Header -->
	<div class="flex items-center justify-between p-4 border-b border-base-300 flex-shrink-0">
		<h3 class="text-lg font-bold">
			{#if isRefreshing}
				My Stickers (loading...)
			{:else if ownedGroups.length > 0}
				My Stickers ({ownedGroups.length} groups, {ownedGroups.reduce((sum, g) => sum + g.count, 0)} total)
			{:else}
				My Stickers (0 owned)
			{/if}
		</h3>
		<button
			class="btn btn-sm btn-circle btn-ghost"
			onclick={() => showStickersModal = false}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
	</div>

	<!-- Mix All Button -->
	{#if mixableGroups.length > 0}
		<div class="p-4 border-b border-base-300 flex-shrink-0">
			<button
				class="btn btn-secondary btn-sm w-full gap-2"
				onclick={handleMixAll}
				disabled={isMixing !== null || isRefreshing}
			>
				{#if isMixing === 'all'}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				{/if}
				Mix All ({mixableGroups.length})
			</button>
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if ownedGroups.length === 0}
			<div class="flex items-center justify-center h-full">
				<div class="text-base-content/50 text-sm">
					Play trivia or open booster packs to collect stickers!
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-2">
				{#each ownedGroups as group (`${group.stickerId}::${group.rarityId}`)}
					{@const groupKey = `${group.stickerId}::${group.rarityId}`}
					{@const placed = placedStickerIds.has(group.stickerId)}
					{@const canMix = canMixGroup(group)}
					{@const nextRarity = getGroupNextRarity(group)}
					<div
						class={classNames(
							'card bg-base-200 relative overflow-hidden shadow-sm',
							{ 'ring-success ring-2': placed },
							{ 'ring-primary/50 ring-1': !placed }
						)}
					>
						<div class="aspect-[3/4] p-1">
							<StickerItem
								sticker={group.sticker}
								bgColor={group.rarity?.colorFrom ?? '#6B7280'}
								borderColor={group.rarity?.colorTo}
								classes="w-full h-full"
							/>
						</div>
						<div class="p-1 pt-0">
							<p class="truncate text-center text-[9px] font-medium" title={group.sticker.name}>
								{group.sticker.name}
							</p>
							{#if group.rarity}
								<div
									class="badge badge-xs mt-0.5 w-full justify-center"
									style="background: linear-gradient(135deg, {group.rarity.colorFrom}, {group.rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
								>
									{group.rarity.name}
								</div>
							{/if}
							{#if canMix && nextRarity}
								<button
									class="btn btn-secondary btn-xs mt-0.5 w-full gap-1"
									onclick={(e) => {
										e.stopPropagation();
										handleMixGroup(group);
									}}
									disabled={isMixing !== null || isRefreshing}
								>
									{#if isMixing === groupKey}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Mix
									{/if}
								</button>
							{/if}
						</div>
						{#if group.count > 1}
							<div class="badge badge-primary badge-xs absolute right-1 top-1 font-bold">
								x{group.count}
							</div>
						{/if}
						{#if placed}
							<div class="badge badge-success badge-xs absolute left-1 top-1 gap-0.5">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
