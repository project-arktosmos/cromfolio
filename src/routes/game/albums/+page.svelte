<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { getAllCollections, getStickersForCollection, getCollection } from '$services/collections.service';
	import { getCollectionType } from '$services/collection-types.service';
	import {
	acquireSticker,
	getOwnedStickerIds,
	getStickerCopyCount,
	getAllUserStickers
} from '$services/user-stickers.service';
	import { getRarityCollection } from '$services/rarities.service';
	import { sourceExists } from '$services/sources.service';
	import { getStickerType } from '$services/sticker-types.service';
	import { getTagsBySticker, getTagsForStickers } from '$services/tags.service';
	import { getAllStampPacks, getStampsByPack, getStamp, getStampsDataDir } from '$services/stamp-packs.service';
	import { getPlacedStampsByCollection, placeStamp, removePlacedStamp } from '$services/user-placed-stamps.service';
	import {
		getPlacedStickerIdsForCollection,
		placeSticker,
		unstickSticker,
		getAllStickerPlacementCounts
	} from '$services/user-sticker-placements.service';
	import type { Collection } from '$types/collection.type';
	import type { CollectionType } from '$types/collection-type.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Source } from '$types/source.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type { Tag } from '$types/tag.type';
	import type { GridPackedPage, GroupedFragments } from '$types/album-layout.type';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';
	import type { UserPlacedStamp } from '$types/user-placed-stamp.type';
	import { DEFAULT_GRID_PACKING_CONFIG, getGridPageAspectRatio } from '$types/album-layout.type';
	import { packStickersIntoGrid, separateWinnerStickers, groupFragmentStickers } from '$utils/album-packing';
	import { weightedRandomSelect, getRarityWeight } from '$utils/weighted-select';
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
	import {
		getPlacedIconsByCollection,
		placeIcon,
		removePlacedIcon
	} from '$services/user-placed-icons.service';
	import type { UserPlacedIcon } from '$types/user-placed-icon.type';

	// Layout configuration
	const PAGE_ASPECT = getGridPageAspectRatio();

	// Pokemon grid config: 3 columns x 4 rows = 12 stickers per page
	const POKEMON_COLS = 3;
	const POKEMON_ROWS = 4;
	const POKEMON_PER_PAGE = POKEMON_COLS * POKEMON_ROWS;

	let collections: Collection[] = $state([]);
	let stickers: Sticker[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let isLoadingStickers = $state(false);
	let selectedCollection = $state<Collection | null>(null);
	let ownedStickerIds = $state<Set<string>>(new Set());
	let placedStickerIds = $state<Set<string>>(new Set());
	let globalPlacementCounts = $state<Map<string, number>>(new Map());
	// Detailed stats per collection with rarity breakdown
interface CollectionDetailedStats {
	total: number;
	owned: number;
	// Maps rarityId -> count of unique stickers owned at that rarity
	rarityBreakdown: Map<string, number>;
	// Score-based completion (each rarity contributes sortOrder + 1 points)
	completionScore: number;
	maxCompletionScore: number;
}
let collectionStickerCounts = $state<Map<string, CollectionDetailedStats>>(new Map());
	let copyCountCache = $state<Map<string, number>>(new Map());
	let stickerTagsMap = $state<Map<string, Tag[]>>(new Map());
	let stickerRarityMap = $state<Map<string, string>>(new Map()); // stickerId -> rarityId
	let currentSpread = $state(0);
	let selectedCollectionType = $state<CollectionType | null>(null);

	// Page flip animation state
	let isFlipping = $state(false);
	let flipDirection = $state<'forward' | 'backward' | null>(null);
	let targetSpread = $state<number | null>(null);
	const FLIP_DURATION = 600;

	// Check if current collection is pokemon type
	let isPokemonCollection = $derived(selectedCollectionType?.name?.toLowerCase() === 'pokemon');

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

	// Cached stickers per collection (for booster packs)
	let collectionStickers = $state<Map<string, Sticker[]>>(new Map());

	// Booster pack inline state
	const BOOSTER_PACK_SIZE = 5;
	let showBoosterPack = $state(false);
	let boosterStickers = $state<Sticker[]>([]);
	let boosterCollection = $state<Collection | null>(null);
	let isOpeningPack = $state(false);

	// Hover preview state
	let hoveredSticker = $state<Sticker | null>(null);
	let mousePosition = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let previewSource = $state<Source | null>(null);
	let previewStickerType = $state<StickerTypeEntity | null>(null);
	let previewTags = $state<Tag[]>([]);

	// Stamp placement state
	let stampPacks = $state<StampPack[]>([]);
	let stampsDataDir = $state<string>('');
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

	// Scale constraints
	const MIN_SCALE = 0.25;
	const MAX_SCALE = 3.0;
	const SCALE_STEP = 0.1;

	onMount(async () => {
		[collections, rarities, stampPacks, stampsDataDir] = await Promise.all([
			getAllCollections(),
			getRarityCollection(),
			getAllStampPacks(),
			getStampsDataDir()
		]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		await loadCollectionStats();
		await refreshOwnedSet();
		await refreshGlobalPlacementCounts();
		isLoading = false;
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

	async function loadCollectionStats() {
		const counts = new Map<string, CollectionDetailedStats>();
		const stickersMap = new Map<string, Sticker[]>();
		const ownedIds = await getOwnedStickerIds();
		const ownedSet = new Set(ownedIds);
		const userStickers = await getAllUserStickers();

		// Find max rarity sortOrder for score calculation
		const maxSortOrder = rarities.length > 0 ? Math.max(...rarities.map((r) => r.sortOrder)) : 0;

		// Build a map of stickerId -> best rarityId (highest sortOrder)
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

			// Count owned stickers in this collection
			const ownedInCollection = collectionStickersData.filter((s) => ownedSet.has(String(s.id)));

			// Build rarity breakdown: count TOTAL copies per rarity (not unique)
			const rarityBreakdown = new Map<string, number>();
			for (const us of userStickers) {
				if (!collectionStickerIds.has(String(us.stickerId))) continue;
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (rarityId) {
					rarityBreakdown.set(rarityId, (rarityBreakdown.get(rarityId) ?? 0) + 1);
				}
			}

			// Completion score based on best rarity per unique sticker
			let completionScore = 0;
			for (const sticker of ownedInCollection) {
				const rarityId = bestRarityPerSticker.get(String(sticker.id));
				if (rarityId) {
					const rarity = raritiesMap.get(rarityId);
					// Points = sortOrder + 1 (so common=1, legendary=maxSortOrder+1)
					completionScore += (rarity?.sortOrder ?? 0) + 1;
				} else {
					// No rarity assigned - count as lowest tier
					completionScore += 1;
				}
			}

			// Max score = all stickers at max rarity
			const maxCompletionScore = collectionStickersData.length * (maxSortOrder + 1);

			counts.set(String(collection.id), {
				total: collectionStickersData.length,
				owned: ownedInCollection.length,
				rarityBreakdown,
				completionScore,
				maxCompletionScore
			});
			stickersMap.set(String(collection.id), collectionStickersData);
		}
		collectionStickerCounts = counts;
		collectionStickers = stickersMap;
	}

	async function refreshOwnedSet() {
		const ids = await getOwnedStickerIds();
		ownedStickerIds = new Set(ids);

		// Build a map of stickerId -> best rarityId (highest sortOrder = rarest)
		const userStickers = await getAllUserStickers();
		const rarityMap = new Map<string, string>();

		for (const us of userStickers) {
			const stickerId = String(us.stickerId);
			const rarityId = us.rarityId ? String(us.rarityId) : '';

			if (!rarityId) continue;

			const existingRarityId = rarityMap.get(stickerId);
			if (!existingRarityId) {
				// First copy with a rarity
				rarityMap.set(stickerId, rarityId);
			} else {
				// Compare rarities - higher sortOrder = rarer = better
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

	async function refreshGlobalPlacementCounts() {
		globalPlacementCounts = await getAllStickerPlacementCounts();
	}

	// Get available copies = total owned - globally placed
	function getAvailableCopies(stickerId: string | number): number {
		const owned = getCachedCopyCount(stickerId);
		const placed = globalPlacementCounts.get(String(stickerId)) ?? 0;
		return owned - placed;
	}

	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			selectedCollection = null;
			selectedCollectionType = null;
			stickers = [];
			stickerTagsMap = new Map();
			placedStickerIds = new Set();
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

			// Load placed stamps for this collection
			await loadPlacedStampsForCollection(String(collection.id));

			// Load placed icons for this collection
			loadPlacedIconsForCollection(String(collection.id));

			// Load placed sticker IDs for this collection
			const placedIds = await getPlacedStickerIdsForCollection(collection.id);
			placedStickerIds = new Set(placedIds);

			isLoadingStickers = false;

			// Open to first page instead of cover if there are stickers
			if (stickers.length > 0) {
				currentSpread = 1;
			}
		}
	}

	function getCollectionStats(collectionId: string | number): CollectionDetailedStats {
		return collectionStickerCounts.get(String(collectionId)) ?? {
			total: 0,
			owned: 0,
			rarityBreakdown: new Map(),
			completionScore: 0,
			maxCompletionScore: 0
		};
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
		// Rarity is assigned when acquired and stored in user_stickers relationship
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
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

	// For pokemon: simple pagination of stickers (12 per page)
	let pokemonPages = $derived.by(() => {
		if (!isPokemonCollection || regularStickers.length === 0) return [];
		const pages: Sticker[][] = [];
		for (let i = 0; i < regularStickers.length; i += POKEMON_PER_PAGE) {
			pages.push(regularStickers.slice(i, i + POKEMON_PER_PAGE));
		}
		return pages;
	});

	// Pack regular stickers into grid-based pages (2 columns)
	let packedPages = $derived.by(() => {
		if (regularStickers.length === 0) return [];
		return packStickersIntoGrid(regularStickers, config);
	});

	// Group winner fragment stickers for 2x2 display (displayed at the end)
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

	function getTotalSpreads(): number {
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

	// Winner getters for specific spread (for flip animation)
	function getLeftWinnerForSpread(spread: number): GroupedFragments | null {
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		if (spread < winnerSpreadStart) return null;
		const winnerSpreadIndex = spread - winnerSpreadStart;
		const leftWinnerIdx = winnerSpreadIndex * 2;
		return groupedWinners[leftWinnerIdx] ?? null;
	}

	function getRightWinnerForSpread(spread: number): GroupedFragments | null {
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		if (spread < winnerSpreadStart) return null;
		const winnerSpreadIndex = spread - winnerSpreadStart;
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

	function getLeftPage(): GridPackedPage | null {
		// spread 1 = pages 0,1; spread 2 = pages 2,3; etc.
		const leftPageIdx = (currentSpread - 1) * 2;
		return packedPages[leftPageIdx] ?? null;
	}

	function getRightPage(): GridPackedPage | null {
		const rightPageIdx = (currentSpread - 1) * 2 + 1;
		return packedPages[rightPageIdx] ?? null;
	}

	// Pokemon page helpers - return flat sticker arrays
	function getLeftPokemonPage(): Sticker[] | null {
		const leftPageIdx = (currentSpread - 1) * 2;
		return pokemonPages[leftPageIdx] ?? null;
	}

	function getRightPokemonPage(): Sticker[] | null {
		const rightPageIdx = (currentSpread - 1) * 2 + 1;
		return pokemonPages[rightPageIdx] ?? null;
	}

	function hasRightPage(): boolean {
		return getRightPage() !== null;
	}

	// Page getters for specific spread (for flip animation back-face rendering)
	function getLeftPageForSpread(spread: number): GridPackedPage | null {
		if (spread === 0) return null;
		const leftPageIdx = (spread - 1) * 2;
		return packedPages[leftPageIdx] ?? null;
	}

	function getRightPageForSpread(spread: number): GridPackedPage | null {
		if (spread === 0) return null;
		const rightPageIdx = (spread - 1) * 2 + 1;
		return packedPages[rightPageIdx] ?? null;
	}

	function getLeftPokemonPageForSpread(spread: number): Sticker[] | null {
		if (spread === 0) return null;
		const leftPageIdx = (spread - 1) * 2;
		return pokemonPages[leftPageIdx] ?? null;
	}

	function getRightPokemonPageForSpread(spread: number): Sticker[] | null {
		if (spread === 0) return null;
		const rightPageIdx = (spread - 1) * 2 + 1;
		return pokemonPages[rightPageIdx] ?? null;
	}

	function goToSpread(spread: number) {
		const totalSpreads = getTotalSpreads();
		if (spread >= 0 && spread < totalSpreads && !isFlipping) {
			currentSpread = spread;
		}
	}

	function nextSpread() {
		const totalSpreads = getTotalSpreads();
		if (isFlipping || currentSpread >= totalSpreads - 1) return;

		targetSpread = currentSpread + 1;
		isFlipping = true;
		flipDirection = 'forward';

		setTimeout(() => {
			currentSpread = targetSpread!;
			isFlipping = false;
			flipDirection = null;
			targetSpread = null;
		}, FLIP_DURATION);
	}

	function prevSpread() {
		if (isFlipping || currentSpread <= 0) return;

		targetSpread = currentSpread - 1;
		isFlipping = true;
		flipDirection = 'backward';

		setTimeout(() => {
			currentSpread = targetSpread!;
			isFlipping = false;
			flipDirection = null;
			targetSpread = null;
		}, FLIP_DURATION);
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

	// Handle sticker click - place/unstick sticker in album
	async function handleStickerClick(sticker: Sticker) {
		if (!selectedCollection) return;

		const stickerId = String(sticker.id);
		const owned = getCachedCopyCount(stickerId) > 0;
		const placed = placedStickerIds.has(stickerId);
		const availableCopies = getAvailableCopies(stickerId);

		if (!owned) {
			// Can't place a sticker you don't own
			return;
		}

		if (placed) {
			// Unstick the sticker
			await unstickSticker(sticker.id, selectedCollection.id);
			placedStickerIds = new Set([...placedStickerIds].filter((id) => id !== stickerId));
			// Update global placement count (decrease by 1)
			const currentCount = globalPlacementCounts.get(stickerId) ?? 0;
			globalPlacementCounts = new Map(globalPlacementCounts).set(stickerId, Math.max(0, currentCount - 1));
		} else {
			// Can only place if we have available copies
			if (availableCopies <= 0) {
				// All copies are placed in other collections
				return;
			}
			// Place the sticker
			await placeSticker(sticker.id, selectedCollection.id);
			placedStickerIds = new Set([...placedStickerIds, stickerId]);
			// Update global placement count (increase by 1)
			const currentCount = globalPlacementCounts.get(stickerId) ?? 0;
			globalPlacementCounts = new Map(globalPlacementCounts).set(stickerId, currentCount + 1);
		}
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
		const userStickers = await getAllUserStickers();
		const counts = new Map(collectionStickerCounts);

		// Find max rarity sortOrder for score calculation
		const maxSortOrder = rarities.length > 0 ? Math.max(...rarities.map((r) => r.sortOrder)) : 0;

		// Build a map of stickerId -> best rarityId (highest sortOrder)
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
			const sts = collectionStickers.get(String(collection.id)) ?? [];
			const collectionStickerIds = new Set(sts.map((s) => String(s.id)));
			const ownedInCollection = sts.filter((s) => ownedSet.has(String(s.id)));

			// Build rarity breakdown: count TOTAL copies per rarity (not unique)
			const rarityBreakdown = new Map<string, number>();
			for (const us of userStickers) {
				if (!collectionStickerIds.has(String(us.stickerId))) continue;
				const rarityId = us.rarityId ? String(us.rarityId) : '';
				if (rarityId) {
					rarityBreakdown.set(rarityId, (rarityBreakdown.get(rarityId) ?? 0) + 1);
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

			const maxCompletionScore = sts.length * (maxSortOrder + 1);

			counts.set(String(collection.id), {
				total: sts.length,
				owned: ownedInCollection.length,
				rarityBreakdown,
				completionScore,
				maxCompletionScore
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

		// Weighted selection by rarity (each tier is 10x harder to get)
		// common (sort 0) = 10000, uncommon (1) = 1000, rare (2) = 100, epic (3) = 10, legendary (4) = 1
		const MAX_SORT_ORDER = 4;
		const weightedStickers = allStickers.map((sticker) => {
			const rarity = getStickerRarity(sticker);
			const sortOrder = rarity?.sortOrder ?? 0; // default to common if no rarity
			const weight = getRarityWeight(sortOrder, MAX_SORT_ORDER);
			return { item: sticker, weight };
		});
		boosterStickers = weightedRandomSelect(weightedStickers, BOOSTER_PACK_SIZE);

		showBoosterPack = true;

		// Find the common rarity (sortOrder === 0) to use as fallback
		const commonRarity = rarities.find((r) => r.sortOrder === 0);

		// Acquire all stickers (with common rarity since stickers don't have inherent rarity)
		for (const sticker of boosterStickers) {
			await acquireSticker(sticker.id, sticker.sourceId, commonRarity?.id);
			await refreshCopyCount(String(sticker.id));
		}
		await refreshOwnedSet();
		await refreshGlobalPlacementCounts();
		await updateCollectionStats();

		isOpeningPack = false;
	}

	function closeBoosterPack() {
		showBoosterPack = false;
		boosterStickers = [];
		boosterCollection = null;
	}

	// Stamp placement functions
	async function handlePackHover(pack: StampPack, event: MouseEvent) {
		hoveredPack = pack;
		hoverPanelPosition = { x: event.clientX };
		hoveredPackStamps = await getStampsByPack(pack.id);
		// Cache stamp images for quick lookup when rendering placed stamps
		for (const stamp of hoveredPackStamps) {
			stampImageCache.set(stamp.id, stamp);
		}
	}

	function handlePackLeave() {
		// Delay to allow moving to panel
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
		placementScale = 1.0; // Reset scale for new stamp
		hoveredPack = null;
		hoveredPackStamps = [];
		isOverHoverPanel = false;

		// Start global mouse tracking and wheel handling
		window.addEventListener('mousemove', handleGlobalMouseMove);
		window.addEventListener('keydown', handleCancelPlacement);
		window.addEventListener('wheel', handlePlacementWheel, { passive: false });
	}

	function handleGlobalMouseMove(event: MouseEvent) {
		globalMousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleCancelPlacement(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			exitPlacementMode();
		}
	}

	function handlePlacementWheel(event: WheelEvent) {
		event.preventDefault();
		// Scroll up = bigger, scroll down = smaller
		const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
		placementScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, placementScale + delta));
	}

	function exitPlacementMode() {
		selectedStamp = null;
		isPlacementMode = false;
		placementScale = 1.0;
		window.removeEventListener('mousemove', handleGlobalMouseMove);
		window.removeEventListener('keydown', handleCancelPlacement);
		window.removeEventListener('wheel', handlePlacementWheel);
	}

	async function handlePageClick(event: MouseEvent, pageElement: HTMLElement, pageIndex: number) {
		if (!isPlacementMode || !selectedStamp || !selectedCollection) return;

		// Calculate position as percentage of page dimensions
		const rect = pageElement.getBoundingClientRect();
		const positionX = ((event.clientX - rect.left) / rect.width) * 100;
		const positionY = ((event.clientY - rect.top) / rect.height) * 100;

		// Place the stamp with current scale
		const placedStamp = await placeStamp(
			selectedStamp.id,
			selectedCollection.id,
			pageIndex,
			positionX,
			positionY,
			placementScale
		);

		// Update local state
		const collectionId = String(selectedCollection.id);
		const existing = placedStampsForCollection.get(collectionId) ?? [];
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, [...existing, placedStamp]);

		// Cache the stamp image
		stampImageCache.set(selectedStamp.id, selectedStamp);

		// Exit placement mode
		exitPlacementMode();
	}

	async function handlePlacedStampRemove(placedStamp: UserPlacedStamp) {
		await removePlacedStamp(placedStamp.id);

		// Update local state
		const collectionId = String(placedStamp.collectionId);
		const existing = placedStampsForCollection.get(collectionId) ?? [];
		const updated = existing.filter((ps) => ps.id !== placedStamp.id);
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, updated);
	}

	function getPlacedStampsForPage(pageIndex: number): UserPlacedStamp[] {
		if (!selectedCollection) return [];
		const collectionId = String(selectedCollection.id);
		const allPlaced = placedStampsForCollection.get(collectionId) ?? [];
		return allPlaced.filter((ps) => ps.pageIndex === pageIndex);
	}

	async function loadPlacedStampsForCollection(collectionId: string) {
		const placedStamps = await getPlacedStampsByCollection(collectionId);
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, placedStamps);

		// Pre-load stamp images
		for (const placed of placedStamps) {
			if (!stampImageCache.has(String(placed.stampId))) {
				const stamp = await getStamp(placed.stampId);
				if (stamp) stampImageCache.set(stamp.id, stamp);
			}
		}
	}

	// Icon placement functions
	function handleIconRowClick(event: MouseEvent) {
		showIconPanel = !showIconPanel;
		iconPanelPosition = { x: event.clientX };
	}

	function handleIconPanelEnter() {
		isOverIconPanel = true;
	}

	function handleIconPanelLeave() {
		isOverIconPanel = false;
		// Delay closing to allow user to move cursor
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

		// Start global mouse tracking and wheel handling
		window.addEventListener('mousemove', handleIconGlobalMouseMove);
		window.addEventListener('keydown', handleCancelIconPlacement);
		window.addEventListener('wheel', handleIconPlacementWheel, { passive: false });
	}

	function handleIconGlobalMouseMove(event: MouseEvent) {
		globalMousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleCancelIconPlacement(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			exitIconPlacementMode();
		}
	}

	function handleIconPlacementWheel(event: WheelEvent) {
		event.preventDefault();
		const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
		iconPlacementScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, iconPlacementScale + delta));
	}

	function exitIconPlacementMode() {
		selectedIconPath = null;
		isIconPlacementMode = false;
		iconPlacementScale = 1.0;
		window.removeEventListener('mousemove', handleIconGlobalMouseMove);
		window.removeEventListener('keydown', handleCancelIconPlacement);
		window.removeEventListener('wheel', handleIconPlacementWheel);
	}

	function handleIconPageClick(event: MouseEvent, pageElement: HTMLElement, pageIndex: number) {
		if (!isIconPlacementMode || !selectedIconPath || !selectedCollection) return;

		// Calculate position as percentage of page dimensions
		const rect = pageElement.getBoundingClientRect();
		const positionX = ((event.clientX - rect.left) / rect.width) * 100;
		const positionY = ((event.clientY - rect.top) / rect.height) * 100;

		// Place the icon
		const placedIcon = placeIcon(
			selectedIconPath,
			selectedCollection.id,
			pageIndex,
			positionX,
			positionY,
			iconPlacementScale,
			0,
			selectedIconColor
		);

		// Update local state
		const collectionId = String(selectedCollection.id);
		const existing = placedIconsForCollection.get(collectionId) ?? [];
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, [...existing, placedIcon]);

		// Exit placement mode
		exitIconPlacementMode();
	}

	function handlePlacedIconRemove(placedIcon: UserPlacedIcon) {
		removePlacedIcon(placedIcon.id);

		// Update local state
		const collectionId = String(placedIcon.collectionId);
		const existing = placedIconsForCollection.get(collectionId) ?? [];
		const updated = existing.filter((pi) => pi.id !== placedIcon.id);
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, updated);
	}

	function getPlacedIconsForPage(pageIndex: number): UserPlacedIcon[] {
		if (!selectedCollection) return [];
		const collectionId = String(selectedCollection.id);
		const allPlaced = placedIconsForCollection.get(collectionId) ?? [];
		return allPlaced.filter((pi) => pi.pageIndex === pageIndex);
	}

	function loadPlacedIconsForCollection(collectionId: string) {
		const placedIcons = getPlacedIconsByCollection(collectionId);
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, placedIcons);
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
		<!-- Inline Booster Pack Section -->
		{#if showBoosterPack}
			<div class="card bg-base-200 mb-6">
				<div class="card-body">
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="font-bold text-xl">Booster Pack</h3>
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

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
			<!-- Collections Column -->
			<div class="lg:col-span-1 flex flex-col min-h-0">
				<div class="card bg-base-200 flex-1 flex flex-col min-h-0">
					<div class="card-body flex flex-col min-h-0">
						<h2 class="card-title shrink-0">Collections</h2>
						<div class="space-y-2 flex-1 overflow-y-auto min-h-0">
							{#each collections as collection (collection.id)}
								{@const stats = getCollectionStats(collection.id)}
								{@const isComplete = stats.maxCompletionScore > 0 && stats.completionScore === stats.maxCompletionScore}
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
											<!-- Rarity breakdown display -->
											{#if stats.rarityBreakdown.size > 0}
												<div class="flex flex-wrap gap-1 mt-1">
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
												<div class="text-sm text-base-content/40 mt-1">No stickers yet</div>
											{/if}
											<!-- Completion progress bar (score-based) -->
											{#if stats.maxCompletionScore > 0}
												{@const completionPercent = Math.round((stats.completionScore / stats.maxCompletionScore) * 100)}
												<div class="flex items-center gap-2 mt-1">
													<progress
														class={classNames('progress flex-1 h-2', {
															'progress-success': completionPercent === 100,
															'progress-warning': completionPercent >= 50 && completionPercent < 100,
															'progress-primary': completionPercent < 50
														})}
														value={stats.completionScore}
														max={stats.maxCompletionScore}
													></progress>
													<span class="text-xs font-mono text-base-content/60 w-10 text-right">{completionPercent}%</span>
												</div>
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
						{#if isCoverSpread()}
								<!-- Cover Page (single) -->
								{@const coverPlacedStamps = getPlacedStampsForPage(-1)}
								{@const coverPlacedIcons = getPlacedIconsForPage(-1)}
								<div class="flex justify-center">
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-lg overflow-hidden w-1/2 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, -1);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, -1);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
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
							<!-- During forward flip, show target right page; during backward flip, show target left page -->
							{@const leftWinner = (isFlipping && flipDirection === 'backward' && targetSpread !== null)
								? getLeftWinnerForSpread(targetSpread)
								: getLeftWinner()}
							{@const rightWinner = (isFlipping && flipDirection === 'forward' && targetSpread !== null)
								? getRightWinnerForSpread(targetSpread)
								: getRightWinner()}
							{@const winnerSpreadIndex = currentSpread - (1 + getRegularSpreadsCount())}
							{@const winnerLeftPageIndex = getTotalRegularPages() + (winnerSpreadIndex * 2)}
							{@const winnerRightPageIndex = getTotalRegularPages() + (winnerSpreadIndex * 2) + 1}

							<div class="book-perspective relative">
								<div class="flex w-full gap-1">
								<!-- Left Winner Page -->
								{#if leftWinner}
									{@const topLeft = leftWinner.fragments.get(1)}
									{@const topRight = leftWinner.fragments.get(2)}
									{@const bottomLeft = leftWinner.fragments.get(3)}
									{@const bottomRight = leftWinner.fragments.get(4)}
									{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
									{@const winnerName = firstSticker?.name?.replace(/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/, '') ?? 'Winner'}
									{@const leftPlacedStamps = getPlacedStampsForPage(winnerLeftPageIndex)}
									{@const leftPlacedIcons = getPlacedIconsForPage(winnerLeftPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, winnerLeftPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, winnerLeftPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={leftPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={leftPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
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
													{@const placed = placedStickerIds.has(String(topLeft.id))}
													{@const availableCopies = getAvailableCopies(topLeft.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(topLeft)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(topLeft)}
														onmouseenter={() => handleStickerMouseEnter(topLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if topRight}
													{@const copyCount = getCachedCopyCount(topRight.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(topRight.id))}
													{@const availableCopies = getAvailableCopies(topRight.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(topRight)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(topRight)}
														onmouseenter={() => handleStickerMouseEnter(topRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomLeft}
													{@const copyCount = getCachedCopyCount(bottomLeft.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(bottomLeft.id))}
													{@const availableCopies = getAvailableCopies(bottomLeft.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(bottomLeft)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(bottomLeft)}
														onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomRight}
													{@const copyCount = getCachedCopyCount(bottomRight.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(bottomRight.id))}
													{@const availableCopies = getAvailableCopies(bottomRight.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(bottomRight)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(bottomRight)}
														onmouseenter={() => handleStickerMouseEnter(bottomRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
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
									{@const rightPlacedStamps = getPlacedStampsForPage(winnerRightPageIndex)}
									{@const rightPlacedIcons = getPlacedIconsForPage(winnerRightPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, winnerRightPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, winnerRightPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={rightPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={rightPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
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
													{@const placed = placedStickerIds.has(String(topLeft.id))}
													{@const availableCopies = getAvailableCopies(topLeft.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(topLeft)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(topLeft)}
														onmouseenter={() => handleStickerMouseEnter(topLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={topLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if topRight}
													{@const copyCount = getCachedCopyCount(topRight.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(topRight.id))}
													{@const availableCopies = getAvailableCopies(topRight.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(topRight)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(topRight)}
														onmouseenter={() => handleStickerMouseEnter(topRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={topRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomLeft}
													{@const copyCount = getCachedCopyCount(bottomLeft.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(bottomLeft.id))}
													{@const availableCopies = getAvailableCopies(bottomLeft.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(bottomLeft)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(bottomLeft)}
														onmouseenter={() => handleStickerMouseEnter(bottomLeft)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={bottomLeft} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
													</div>
												{:else}
													<div class="bg-gray-200 rounded"></div>
												{/if}
												{#if bottomRight}
													{@const copyCount = getCachedCopyCount(bottomRight.id)}
													{@const owned = copyCount > 0}
													{@const placed = placedStickerIds.has(String(bottomRight.id))}
													{@const availableCopies = getAvailableCopies(bottomRight.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													{@const rarity = getStickerRarity(bottomRight)}
													<div
														class={classNames('cursor-pointer relative', { 'grayscale opacity-50': !owned })}
														onclick={() => handleStickerClick(bottomRight)}
														onmouseenter={() => handleStickerMouseEnter(bottomRight)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if canPlace}
															<div class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20">
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames({ 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
															<StickerItem sticker={bottomRight} bgColor={rarity?.colorFrom ?? '#6B7280'} borderColor={rarity?.colorTo} classes="w-full h-full" />
														</div>
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

								<!-- Flip Animation Overlay for Winners -->
								{#if isFlipping && targetSpread !== null}
									<div class="absolute inset-0 flex w-full gap-1 pointer-events-none">
										{#if flipDirection === 'forward'}
											<!-- Forward: right page flips to left -->
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
											<div
												class="page-container flex-1 flip-forward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: simple winner page representation -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden w-full h-full absolute inset-0 flex items-center justify-center">
													<span class="badge badge-warning">Winner</span>
												</div>
												<!-- Back face: paper texture -->
												<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-l-lg w-full h-full"></div>
											</div>
										{:else if flipDirection === 'backward'}
											<!-- Backward: left page flips to right -->
											<div
												class="page-container flex-1 flip-backward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: simple winner page representation -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden w-full h-full absolute inset-0 flex items-center justify-center">
													<span class="badge badge-warning">Winner</span>
												</div>
												<!-- Back face: paper texture -->
												<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-r-lg w-full h-full"></div>
											</div>
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
										{/if}
									</div>
								{/if}
							</div>
						{:else if isPokemonCollection}
							<!-- Pokemon Book View (3x4 grid enforced) -->
							<!-- During forward flip, show target right page; during backward flip, show target left page -->
							{@const leftPokemonStickers = (isFlipping && flipDirection === 'backward' && targetSpread !== null)
								? getLeftPokemonPageForSpread(targetSpread)
								: getLeftPokemonPage()}
							{@const rightPokemonStickers = (isFlipping && flipDirection === 'forward' && targetSpread !== null)
								? getRightPokemonPageForSpread(targetSpread)
								: getRightPokemonPage()}
							{@const leftPageIndex = (currentSpread - 1) * 2}
							{@const rightPageIndex = (currentSpread - 1) * 2 + 1}

							<div class="book-perspective relative">
								<div class="flex w-full gap-1">
								<!-- Left Page -->
								{#if leftPokemonStickers}
									{@const leftPlacedStamps = getPlacedStampsForPage(leftPageIndex)}
									{@const leftPlacedIcons = getPlacedIconsForPage(leftPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={leftPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={leftPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
										<div
											class="h-full grid"
											style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
										>
											{#each leftPokemonStickers as sticker (sticker.id)}
												{@const copyCount = getCachedCopyCount(sticker.id)}
												{@const owned = copyCount > 0}
												{@const placed = placedStickerIds.has(String(sticker.id))}
												{@const availableCopies = getAvailableCopies(sticker.id)}
												{@const canPlace = owned && !placed && availableCopies > 0}
												{@const placedElsewhere = owned && !placed && availableCopies <= 0}
												{@const rarity = getStickerRarity(sticker)}
												<div
													class={classNames(
														'cursor-pointer overflow-hidden flex flex-col relative',
														{ 'grayscale opacity-50': !owned }
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
															class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20 cursor-pointer hover:bg-base-300/90 hover:border-primary/60 transition-colors"
															onclick={(e) => { e.stopPropagation(); handleStickerClick(sticker); }}
														>
															<span class="text-primary/60 text-[10px] font-medium">Stick</span>
														</button>
													{:else if placedElsewhere}
														<div
															class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20"
														>
															<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
														</div>
													{/if}
													<div class={classNames('w-full h-full', { 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
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
								{/if}

								<!-- Right Page -->
								{#if rightPokemonStickers}
									{@const rightPlacedStamps = getPlacedStampsForPage(rightPageIndex)}
									{@const rightPlacedIcons = getPlacedIconsForPage(rightPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={rightPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={rightPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
										<div
											class="h-full grid"
											style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
										>
											{#each rightPokemonStickers as sticker (sticker.id)}
												{@const copyCount = getCachedCopyCount(sticker.id)}
												{@const owned = copyCount > 0}
												{@const placed = placedStickerIds.has(String(sticker.id))}
												{@const availableCopies = getAvailableCopies(sticker.id)}
												{@const canPlace = owned && !placed && availableCopies > 0}
												{@const placedElsewhere = owned && !placed && availableCopies <= 0}
												{@const rarity = getStickerRarity(sticker)}
												<div
													class={classNames(
														'cursor-pointer overflow-hidden flex flex-col relative',
														{ 'grayscale opacity-50': !owned }
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
															class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20 cursor-pointer hover:bg-base-300/90 hover:border-primary/60 transition-colors"
															onclick={(e) => { e.stopPropagation(); handleStickerClick(sticker); }}
														>
															<span class="text-primary/60 text-[10px] font-medium">Stick</span>
														</button>
													{:else if placedElsewhere}
														<div
															class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20"
														>
															<span class="text-warning text-[8px] font-medium text-center px-1">In other album</span>
														</div>
													{/if}
													<div class={classNames('w-full h-full', { 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
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
								{:else}
									<!-- Empty right page placeholder -->
									<div
										class="bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 opacity-30"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div class="h-full p-4 flex items-center justify-center">
											<span class="text-gray-300">End of album</span>
										</div>
									</div>
								{/if}
								</div>

								<!-- Flip Animation Overlay for Pokemon -->
								{#if isFlipping && targetSpread !== null}
									{@const currentRightStickers = getRightPokemonPage()}
									{@const currentLeftStickers = getLeftPokemonPage()}
									{@const targetLeftStickers = getLeftPokemonPageForSpread(targetSpread)}
									{@const targetRightStickers = getRightPokemonPageForSpread(targetSpread)}
									<div class="absolute inset-0 flex w-full gap-1 pointer-events-none">
										{#if flipDirection === 'forward' && currentRightStickers}
											<!-- Forward: right page flips to left -->
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
											<div
												class="page-container flex-1 flip-forward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: current right page -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden w-full h-full absolute inset-0">
													<div
														class="h-full grid"
														style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
													>
														{#each currentRightStickers as sticker (sticker.id)}
															{@const rarity = getStickerRarity(sticker)}
															{@const owned = getCachedCopyCount(sticker.id) > 0}
															<div class={classNames('overflow-hidden', { 'grayscale opacity-50': !owned })}>
																<StickerItem
																	{sticker}
																	bgColor={rarity?.colorFrom ?? '#6B7280'}
																	borderColor={rarity?.colorTo}
																	classes="w-full h-full object-contain"
																/>
															</div>
														{/each}
													</div>
												</div>
												<!-- Back face: target left page -->
												{#if targetLeftStickers}
													<div class="page-back bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden w-full h-full">
														<div
															class="h-full grid"
															style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
														>
															{#each targetLeftStickers as sticker (sticker.id)}
																{@const rarity = getStickerRarity(sticker)}
																{@const owned = getCachedCopyCount(sticker.id) > 0}
																<div class={classNames('overflow-hidden', { 'grayscale opacity-50': !owned })}>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full h-full object-contain"
																	/>
																</div>
															{/each}
														</div>
													</div>
												{:else}
													<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-l-lg w-full h-full"></div>
												{/if}
											</div>
										{:else if flipDirection === 'backward' && currentLeftStickers}
											<!-- Backward: left page flips to right -->
											<div
												class="page-container flex-1 flip-backward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: current left page -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden w-full h-full absolute inset-0">
													<div
														class="h-full grid"
														style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
													>
														{#each currentLeftStickers as sticker (sticker.id)}
															{@const rarity = getStickerRarity(sticker)}
															{@const owned = getCachedCopyCount(sticker.id) > 0}
															<div class={classNames('overflow-hidden', { 'grayscale opacity-50': !owned })}>
																<StickerItem
																	{sticker}
																	bgColor={rarity?.colorFrom ?? '#6B7280'}
																	borderColor={rarity?.colorTo}
																	classes="w-full h-full object-contain"
																/>
															</div>
														{/each}
													</div>
												</div>
												<!-- Back face: target right page -->
												{#if targetRightStickers}
													<div class="page-back bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden w-full h-full">
														<div
															class="h-full grid"
															style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
														>
															{#each targetRightStickers as sticker (sticker.id)}
																{@const rarity = getStickerRarity(sticker)}
																{@const owned = getCachedCopyCount(sticker.id) > 0}
																<div class={classNames('overflow-hidden', { 'grayscale opacity-50': !owned })}>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full h-full object-contain"
																	/>
																</div>
															{/each}
														</div>
													</div>
												{:else}
													<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-r-lg w-full h-full"></div>
												{/if}
											</div>
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
										{/if}
									</div>
								{/if}
							</div>
						{:else}
							<!-- Regular Book View (two pages side by side) -->
							<!-- During forward flip, show target right page; during backward flip, show target left page -->
							{@const leftPage = (isFlipping && flipDirection === 'backward' && targetSpread !== null)
								? getLeftPageForSpread(targetSpread)
								: getLeftPage()}
							{@const rightPage = (isFlipping && flipDirection === 'forward' && targetSpread !== null)
								? getRightPageForSpread(targetSpread)
								: getRightPage()}
							{@const leftPageIndex = (currentSpread - 1) * 2}
							{@const rightPageIndex = (currentSpread - 1) * 2 + 1}

							<div class="book-perspective relative">
								<div class="flex w-full gap-1">
								<!-- Left Page -->
								{#if leftPage}
									{@const leftPlacedStamps = getPlacedStampsForPage(leftPageIndex)}
									{@const leftPlacedIcons = getPlacedIconsForPage(leftPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={leftPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={leftPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
										<div
											class="h-full grid"
											style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
										>
											{#each leftPage.rows as row}
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
															'p-1 cursor-pointer overflow-hidden flex flex-col relative',
															{ 'grayscale opacity-50': !owned }
														)}
														onclick={() => handleStickerClick(sticker)}
														onmouseenter={() => handleStickerMouseEnter(sticker)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if !placed}
															<p class="absolute top-1 left-0 right-0 text-[10px] text-gray-600 text-center truncate px-1 z-10 bg-white/80">{sticker.name}</p>
														{/if}
														{#if canPlace}
															<button
																class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20 cursor-pointer hover:bg-base-300/90 hover:border-primary/60 transition-colors"
																onclick={(e) => { e.stopPropagation(); handleStickerClick(sticker); }}
															>
																<span class="text-primary/60 text-xs font-medium">Click to stick</span>
															</button>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[9px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames('w-full flex-1', { 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
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
								{/if}

								<!-- Right Page -->
								{#if rightPage}
									{@const rightPlacedStamps = getPlacedStampsForPage(rightPageIndex)}
									{@const rightPlacedIcons = getPlacedIconsForPage(rightPageIndex)}
									<div
										class={classNames(
											'bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden flex-1 relative',
											{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
										)}
										style="aspect-ratio: {PAGE_ASPECT};"
										onclick={(e) => {
											if (isPlacementMode) handlePageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
											if (isIconPlacementMode) handleIconPageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
										}}
										role={(isPlacementMode || isIconPlacementMode) ? 'button' : 'img'}
										tabindex={(isPlacementMode || isIconPlacementMode) ? 0 : -1}
									>
										<PlacedStampOverlay
											placedStamps={rightPlacedStamps}
											stampImages={stampImageCache}
											{stampsDataDir}
											editable={!isPlacementMode && !isIconPlacementMode}
											onstampremove={(ps) => handlePlacedStampRemove(ps)}
										/>
										<PlacedIconOverlay
											placedIcons={rightPlacedIcons}
											editable={!isPlacementMode && !isIconPlacementMode}
											oniconremove={(pi) => handlePlacedIconRemove(pi)}
										/>
										<div
											class="h-full grid"
											style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
										>
											{#each rightPage.rows as row}
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
															'p-1 cursor-pointer overflow-hidden flex flex-col relative',
															{ 'grayscale opacity-50': !owned }
														)}
														onclick={() => handleStickerClick(sticker)}
														onmouseenter={() => handleStickerMouseEnter(sticker)}
														onmousemove={handleStickerMouseMove}
														onmouseleave={handleStickerMouseLeave}
														role="button"
														tabindex="0"
													>
														{#if !placed}
															<p class="absolute top-1 left-0 right-0 text-[10px] text-gray-600 text-center truncate px-1 z-10 bg-white/80">{sticker.name}</p>
														{/if}
														{#if canPlace}
															<button
																class="absolute inset-0 bg-base-300/80 rounded border-2 border-dashed border-primary/40 flex items-center justify-center z-20 cursor-pointer hover:bg-base-300/90 hover:border-primary/60 transition-colors"
																onclick={(e) => { e.stopPropagation(); handleStickerClick(sticker); }}
															>
																<span class="text-primary/60 text-xs font-medium">Click to stick</span>
															</button>
														{:else if placedElsewhere}
															<div class="absolute inset-0 bg-warning/20 rounded border-2 border-dashed border-warning/40 flex items-center justify-center z-20">
																<span class="text-warning text-[9px] font-medium text-center px-1">In other album</span>
															</div>
														{/if}
														<div class={classNames('w-full flex-1', { 'opacity-70 hover:opacity-100 transition-opacity': canPlace })}>
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

								<!-- Flip Animation Overlay for Regular -->
								{#if isFlipping && targetSpread !== null}
									{@const currentLeftPage = getLeftPage()}
									{@const currentRightPage = getRightPage()}
									{@const targetLeftPage = getLeftPageForSpread(targetSpread)}
									{@const targetRightPage = getRightPageForSpread(targetSpread)}
									<div class="absolute inset-0 flex w-full gap-1 pointer-events-none">
										{#if flipDirection === 'forward' && currentRightPage}
											<!-- Forward: right page flips to left -->
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
											<div
												class="page-container flex-1 flip-forward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: current right page -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden w-full h-full absolute inset-0">
													<div
														class="h-full grid"
														style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
													>
														{#each currentRightPage.rows as row}
															{#each row.stickers as { sticker } (sticker.id)}
																{@const rarity = getStickerRarity(sticker)}
																{@const owned = getCachedCopyCount(sticker.id) > 0}
																<div class={classNames('p-1 overflow-hidden', { 'grayscale opacity-50': !owned })}>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full"
																	/>
																</div>
															{/each}
														{/each}
													</div>
												</div>
												<!-- Back face: target left page -->
												{#if targetLeftPage}
													<div class="page-back bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden w-full h-full">
														<div
															class="h-full grid"
															style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
														>
															{#each targetLeftPage.rows as row}
																{#each row.stickers as { sticker } (sticker.id)}
																	{@const rarity = getStickerRarity(sticker)}
																	{@const owned = getCachedCopyCount(sticker.id) > 0}
																	<div class={classNames('p-1 overflow-hidden', { 'grayscale opacity-50': !owned })}>
																		<StickerItem
																			{sticker}
																			bgColor={rarity?.colorFrom ?? '#6B7280'}
																			borderColor={rarity?.colorTo}
																			classes="w-full"
																		/>
																	</div>
																{/each}
															{/each}
														</div>
													</div>
												{:else}
													<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-l-lg w-full h-full"></div>
												{/if}
											</div>
										{:else if flipDirection === 'backward' && currentLeftPage}
											<!-- Backward: left page flips to right -->
											<div
												class="page-container flex-1 flip-backward"
												style="aspect-ratio: {PAGE_ASPECT};"
											>
												<!-- Front face: current left page -->
												<div class="page-face bg-white text-gray-900 shadow-xl rounded-l-lg overflow-hidden w-full h-full absolute inset-0">
													<div
														class="h-full grid"
														style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
													>
														{#each currentLeftPage.rows as row}
															{#each row.stickers as { sticker } (sticker.id)}
																{@const rarity = getStickerRarity(sticker)}
																{@const owned = getCachedCopyCount(sticker.id) > 0}
																<div class={classNames('p-1 overflow-hidden', { 'grayscale opacity-50': !owned })}>
																	<StickerItem
																		{sticker}
																		bgColor={rarity?.colorFrom ?? '#6B7280'}
																		borderColor={rarity?.colorTo}
																		classes="w-full"
																	/>
																</div>
															{/each}
														{/each}
													</div>
												</div>
												<!-- Back face: target right page -->
												{#if targetRightPage}
													<div class="page-back bg-white text-gray-900 shadow-xl rounded-r-lg overflow-hidden w-full h-full">
														<div
															class="h-full grid"
															style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
														>
															{#each targetRightPage.rows as row}
																{#each row.stickers as { sticker } (sticker.id)}
																	{@const rarity = getStickerRarity(sticker)}
																	{@const owned = getCachedCopyCount(sticker.id) > 0}
																	<div class={classNames('p-1 overflow-hidden', { 'grayscale opacity-50': !owned })}>
																		<StickerItem
																			{sticker}
																			bgColor={rarity?.colorFrom ?? '#6B7280'}
																			borderColor={rarity?.colorTo}
																			classes="w-full"
																		/>
																	</div>
																{/each}
															{/each}
														</div>
													</div>
												{:else}
													<div class="page-back bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl rounded-r-lg w-full h-full"></div>
												{/if}
											</div>
											<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
										{/if}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Pagination Controls -->
						{#if totalSpreads > 1}
							<div class="mt-6">
								<div class="flex justify-center items-center gap-2">
									<button
										class="btn btn-sm btn-outline"
										onclick={prevSpread}
										disabled={currentSpread === 0 || isFlipping}
									>
										Previous
									</button>
									<span class="text-sm text-base-content/60">
										Spread {currentSpread + 1} of {totalSpreads}
									</span>
									<button
										class="btn btn-sm btn-outline"
										onclick={nextSpread}
										disabled={currentSpread === totalSpreads - 1 || isFlipping}
									>
										Next
									</button>
								</div>
							</div>
						{/if}

						<!-- Place Icons and Stamps Row -->
						<div class="mt-4 border-t border-base-300 pt-4">
							<div class="flex items-start gap-4">
								<!-- Icons -->
								<div>
									<h3 class="text-sm font-semibold mb-2 text-base-content/70">Icons</h3>
									<IconRow onclick={handleIconRowClick} />
								</div>

								<!-- Stamps -->
								{#if stampPacks.length > 0}
									<div class="flex-1">
										<h3 class="text-sm font-semibold mb-2 text-base-content/70">Stamps</h3>
										<StampPackRow
											{stampPacks}
											{stampsDataDir}
											onpackhover={handlePackHover}
											onpackleave={handlePackLeave}
										/>
									</div>
								{/if}
							</div>
						</div>
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

<!-- Cursor Stamp (follows cursor during placement) -->
{#if isPlacementMode && selectedStamp}
	<CursorStamp stamp={selectedStamp} {stampsDataDir} mousePosition={globalMousePosition} scale={placementScale} />
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

<!-- Cursor Icon (follows cursor during placement) -->
{#if isIconPlacementMode && selectedIconPath}
	<CursorIcon iconPath={selectedIconPath} color={selectedIconColor} mousePosition={globalMousePosition} scale={iconPlacementScale} />
{/if}

<style>
	.book-perspective {
		perspective: 2000px;
	}
	.page-container {
		position: relative;
		transform-style: preserve-3d;
	}
	.page-face {
		backface-visibility: hidden;
	}
	.page-back {
		backface-visibility: hidden;
		transform: rotateY(180deg);
		position: absolute;
		inset: 0;
	}

	/* Forward flip: right page flips to left */
	/* transform-origin at left edge, offset by half the gap (gap-1 = 0.25rem, half = 0.125rem) */
	.flip-forward {
		animation: flipForward 600ms ease-in-out forwards;
		transform-origin: -0.125rem center;
	}

	/* Backward flip: left page flips to right */
	/* transform-origin at right edge, offset by half the gap */
	.flip-backward {
		animation: flipBackward 600ms ease-in-out forwards;
		transform-origin: calc(100% + 0.125rem) center;
	}

	@keyframes flipForward {
		0% { transform: rotateY(0deg); z-index: 10; }
		100% { transform: rotateY(-180deg); z-index: 10; }
	}

	@keyframes flipBackward {
		0% { transform: rotateY(0deg); z-index: 10; }
		100% { transform: rotateY(180deg); z-index: 10; }
	}
</style>
