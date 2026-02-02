<script lang="ts">
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { getCollection, getStickersForCollection } from '$services/collections.service';
	import { getCollectionType } from '$services/collection-types.service';
	import {
		getOwnedStickerIds,
		getStickerCopyCount,
		getAllUserStickers
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
	import { countUnopenedUserBoosterPacksByCollection } from '$services/user-booster-packs.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
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
	import BoosterPackCard from '$components/game/BoosterPackCard.svelte';

	// Layout configuration
	const PAGE_ASPECT = getGridPageAspectRatio();

	// Pokemon grid config: 3 columns x 4 rows = 12 stickers per page
	const POKEMON_COLS = 3;
	const POKEMON_ROWS = 4;
	const POKEMON_PER_PAGE = POKEMON_COLS * POKEMON_ROWS;

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
	let unopenedBoosterPacks = $state(0);
	let currentSpread = $state(0);

	// Page flip animation state
	let isFlipping = $state(false);
	let flipDirection = $state<'forward' | 'backward' | null>(null);
	let targetSpread = $state<number | null>(null);
	const FLIP_DURATION = 600;

	// Check if current collection is pokemon type
	let isPokemonCollection = $derived(collectionType?.name?.toLowerCase() === 'pokemon');

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
		const collectionId = $page.params.id;

		// Load rarities and stamp packs in parallel
		[rarities, stampPacks, stampsDataDir] = await Promise.all([
			getRarityCollection(),
			getAllStampPacks(),
			getStampsDataDir()
		]);
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));

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
			currentSpread = 1;
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

	async function refreshAfterTrivia() {
		await refreshOwnedSet();
		// Refresh copy counts for all stickers
		for (const sticker of stickers) {
			await refreshCopyCount(String(sticker.id));
		}
		// Refresh unopened booster pack count
		if (collection) {
			unopenedBoosterPacks = await countUnopenedUserBoosterPacksByCollection(collection.id);
		}
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

	function getTotalSpreads(): number {
		const regularSpreads = Math.ceil(getTotalRegularPages() / 2);
		const winnerSpreads = Math.ceil(getTotalWinnerPages() / 2);
		return 1 + regularSpreads + winnerSpreads;
	}

	function getRegularSpreadsCount(): number {
		return Math.ceil(getTotalRegularPages() / 2);
	}

	function isCoverSpread(): boolean {
		return currentSpread === 0;
	}

	function isWinnerSpread(): boolean {
		const winnerSpreadStart = 1 + getRegularSpreadsCount();
		return currentSpread >= winnerSpreadStart;
	}

	function isRegularSpread(): boolean {
		return !isCoverSpread() && !isWinnerSpread();
	}

	// Current spread page getters
	function getLeftPage(): GridPackedPage | null {
		const leftPageIdx = (currentSpread - 1) * 2;
		return packedPages[leftPageIdx] ?? null;
	}

	function getRightPage(): GridPackedPage | null {
		const rightPageIdx = (currentSpread - 1) * 2 + 1;
		return packedPages[rightPageIdx] ?? null;
	}

	function getLeftPokemonPage(): Sticker[] | null {
		const leftPageIdx = (currentSpread - 1) * 2;
		return pokemonPages[leftPageIdx] ?? null;
	}

	function getRightPokemonPage(): Sticker[] | null {
		const rightPageIdx = (currentSpread - 1) * 2 + 1;
		return pokemonPages[rightPageIdx] ?? null;
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

	// Page getters for specific spread (for flip animation)
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
			exitPlacementMode();
		}
	}

	function handlePlacementWheel(event: WheelEvent) {
		event.preventDefault();
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

		const collectionId = String(collection.id);
		const existing = placedStampsForCollection.get(collectionId) ?? [];
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, [
			...existing,
			placedStamp
		]);

		stampImageCache.set(selectedStamp.id, selectedStamp);
		exitPlacementMode();
	}

	async function handlePlacedStampRemove(placedStamp: UserPlacedStamp) {
		await removePlacedStamp(placedStamp.id);

		const collectionId = String(placedStamp.collectionId);
		const existing = placedStampsForCollection.get(collectionId) ?? [];
		const updated = existing.filter((ps) => ps.id !== placedStamp.id);
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, updated);
	}

	function getPlacedStampsForPage(pageIndex: number): UserPlacedStamp[] {
		if (!collection) return [];
		const collectionId = String(collection.id);
		const allPlaced = placedStampsForCollection.get(collectionId) ?? [];
		return allPlaced.filter((ps) => ps.pageIndex === pageIndex);
	}

	async function loadPlacedStampsForCollection(collectionId: string) {
		const placedStamps = await getPlacedStampsByCollection(collectionId);
		placedStampsForCollection = new Map(placedStampsForCollection).set(collectionId, placedStamps);

		for (const placed of placedStamps) {
			if (!stampImageCache.has(String(placed.stampId))) {
				const stamp = await getStamp(placed.stampId);
				if (stamp) stampImageCache.set(stamp.id, stamp);
			}
		}
	}

	// Icon functions
	function handleIconRowClick(event: MouseEvent) {
		showIconPanel = !showIconPanel;
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
			0,
			selectedIconColor
		);

		const collectionId = String(collection.id);
		const existing = placedIconsForCollection.get(collectionId) ?? [];
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, [
			...existing,
			placedIcon
		]);

		exitIconPlacementMode();
	}

	async function handlePlacedIconRemove(placedIcon: UserPlacedIcon) {
		await removePlacedIcon(placedIcon.id);

		const collectionId = String(placedIcon.collectionId);
		const existing = placedIconsForCollection.get(collectionId) ?? [];
		const updated = existing.filter((pi) => pi.id !== placedIcon.id);
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, updated);
	}

	function getPlacedIconsForPage(pageIndex: number): UserPlacedIcon[] {
		if (!collection) return [];
		const collectionId = String(collection.id);
		const allPlaced = placedIconsForCollection.get(collectionId) ?? [];
		return allPlaced.filter((pi) => pi.pageIndex === pageIndex);
	}

	async function loadPlacedIconsForCollection(collectionId: string) {
		const placedIcons = await getPlacedIconsByCollection(collectionId);
		placedIconsForCollection = new Map(placedIconsForCollection).set(collectionId, placedIcons);
	}

	function goBack() {
		goto('/game/collections');
	}
</script>

<div class="flex min-h-full flex-col overflow-y-auto">
	<!-- Header with back button -->
	<div class="mb-4 flex items-center gap-4">
		<button class="btn btn-ghost btn-sm" onclick={goBack}>
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
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			Back
		</button>
		{#if collection}
			<h1 class="text-2xl font-bold">{collection.title}</h1>
		{/if}
	</div>

	{#if isLoading}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if notFound}
		<div class="flex flex-1 flex-col items-center justify-center gap-4">
			<div class="alert alert-error max-w-md">
				<span>Collection not found</span>
			</div>
			<button class="btn btn-primary" onclick={goBack}>Go to Collections</button>
		</div>
	{:else if collection}
		{@const totalRegularPages = getTotalRegularPages()}
		{@const totalWinnerPages = getTotalWinnerPages()}
		{@const totalSpreads = getTotalSpreads()}

		<div class="flex flex-col gap-4">
			<!-- Main content grid: Album + Stats -->
			<div class="grid grid-cols-3 gap-4">
				<!-- Album View (cols 1-2) -->
				<div class="col-span-2 h-[70vh] rounded-lg p-4">
				{#if stickers.length === 0}
					<div class="flex h-full items-center justify-center">
						<div class="alert alert-info max-w-md">
							<span>No stickers in this collection yet.</span>
						</div>
					</div>
				{:else if isCoverSpread()}
					<!-- Cover Page -->
					{@const coverPlacedStamps = getPlacedStampsForPage(-1)}
					{@const coverPlacedIcons = getPlacedIconsForPage(-1)}
					<div class="flex h-full items-center justify-center">
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
				{:else if isWinnerSpread()}
					<!-- Winner Book View (two pages side by side) -->
					<!-- Keep showing current content during flip - the overlay handles the animation -->
					{@const leftWinner = getLeftWinner()}
					{@const rightWinner = getRightWinner()}
					{@const winnerSpreadIndex = currentSpread - (1 + getRegularSpreadsCount())}
					{@const winnerLeftPageIndex = getTotalRegularPages() + winnerSpreadIndex * 2}
					{@const winnerRightPageIndex = getTotalRegularPages() + winnerSpreadIndex * 2 + 1}

					<div class="book-perspective relative">
						<div class="flex w-full gap-1">
							<!-- Left Winner Page -->
							{#if leftWinner}
								{@const topLeft = leftWinner.fragments.get(1)}
								{@const topRight = leftWinner.fragments.get(2)}
								{@const bottomLeft = leftWinner.fragments.get(3)}
								{@const bottomRight = leftWinner.fragments.get(4)}
								{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
								{@const winnerName =
									firstSticker?.name?.replace(
										/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/,
										''
									) ?? 'Winner'}
								{@const leftPlacedStamps = getPlacedStampsForPage(winnerLeftPageIndex)}
								{@const leftPlacedIcons = getPlacedIconsForPage(winnerLeftPageIndex)}
								<div
									class={classNames(
										'relative flex-1 overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, winnerLeftPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, winnerLeftPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
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
							{/if}

							<!-- Right Winner Page -->
							{#if rightWinner}
								{@const topLeft = rightWinner.fragments.get(1)}
								{@const topRight = rightWinner.fragments.get(2)}
								{@const bottomLeft = rightWinner.fragments.get(3)}
								{@const bottomRight = rightWinner.fragments.get(4)}
								{@const firstSticker = topLeft || topRight || bottomLeft || bottomRight}
								{@const winnerName =
									firstSticker?.name?.replace(
										/ \(Top Left\)$| \(Top Right\)$| \(Bottom Left\)$| \(Bottom Right\)$/,
										''
									) ?? 'Winner'}
								{@const rightPlacedStamps = getPlacedStampsForPage(winnerRightPageIndex)}
								{@const rightPlacedIcons = getPlacedIconsForPage(winnerRightPageIndex)}
								<div
									class={classNames(
										'relative flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, winnerRightPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, winnerRightPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
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
							{:else}
								<!-- Empty right page placeholder -->
								<div
									class="flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 opacity-30 shadow-xl"
									style="aspect-ratio: {PAGE_ASPECT};"
								>
									<div class="flex h-full flex-col items-center justify-center p-4">
										<span class="text-gray-300">End of album</span>
									</div>
								</div>
							{/if}
						</div>

						<!-- Flip Animation Overlay for Winners -->
						{#if isFlipping && targetSpread !== null}
							<div class="pointer-events-none absolute inset-0 z-30 flex w-full gap-1">
								{#if flipDirection === 'forward'}
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
									<div
										class="page-container flip-forward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div
											class="page-face absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl"
										>
											<span class="badge badge-warning">Winner</span>
										</div>
										<div
											class="page-back h-full w-full rounded-l-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
										></div>
									</div>
								{:else if flipDirection === 'backward'}
									<div
										class="page-container flip-backward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<div
											class="page-face absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl"
										>
											<span class="badge badge-warning">Winner</span>
										</div>
										<div
											class="page-back h-full w-full rounded-r-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
										></div>
									</div>
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
								{/if}
							</div>
						{/if}
					</div>
				{:else if isPokemonCollection}
					<!-- Pokemon Book View (3x4 grid enforced) -->
					<!-- Keep showing current content during flip - the overlay handles the animation -->
					{@const leftPokemonStickers = getLeftPokemonPage()}
					{@const rightPokemonStickers = getRightPokemonPage()}
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
										'relative flex-1 overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
										class="grid h-full"
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
							{/if}

							<!-- Right Page -->
							{#if rightPokemonStickers}
								{@const rightPlacedStamps = getPlacedStampsForPage(rightPageIndex)}
								{@const rightPlacedIcons = getPlacedIconsForPage(rightPageIndex)}
								<div
									class={classNames(
										'relative flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
										class="grid h-full"
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
							{:else}
								<!-- Empty right page placeholder -->
								<div
									class="flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 opacity-30 shadow-xl"
									style="aspect-ratio: {PAGE_ASPECT};"
								>
									<div class="flex h-full items-center justify-center p-4">
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
							<div class="pointer-events-none absolute inset-0 z-30 flex w-full gap-1">
								{#if flipDirection === 'forward' && currentRightStickers}
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
									<div
										class="page-container flip-forward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<!-- Front face: current right page -->
										<div
											class="page-face absolute inset-0 h-full w-full overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl"
										>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
											>
												{#each currentRightStickers as sticker (sticker.id)}
													{@const rarity = getStickerRarity(sticker)}
													{@const owned = getCachedCopyCount(sticker.id) > 0}
													{@const placed = placedStickerIds.has(String(sticker.id))}
													{@const availableCopies = getAvailableCopies(sticker.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													<div
														class={classNames('relative overflow-hidden', {
															'opacity-50 grayscale': !owned
														})}
													>
														{#if canPlace}
															<div
																class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
															>
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div
																class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
															>
																<span class="text-warning px-1 text-center text-[8px] font-medium"
																	>In other album</span
																>
															</div>
														{/if}
														<div class={classNames('h-full w-full', { 'opacity-70': canPlace })}>
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
										<!-- Back face: target left page -->
										{#if targetLeftStickers}
											<div
												class="page-back h-full w-full overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl"
											>
												<div
													class="grid h-full"
													style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
												>
													{#each targetLeftStickers as sticker (sticker.id)}
														{@const rarity = getStickerRarity(sticker)}
														{@const owned = getCachedCopyCount(sticker.id) > 0}
														{@const placed = placedStickerIds.has(String(sticker.id))}
														{@const availableCopies = getAvailableCopies(sticker.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														<div
															class={classNames('relative overflow-hidden', {
																'opacity-50 grayscale': !owned
															})}
														>
															{#if canPlace}
																<div
																	class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-primary/60 text-[10px] font-medium">Stick</span>
																</div>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-warning px-1 text-center text-[8px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div class={classNames('h-full w-full', { 'opacity-70': canPlace })}>
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
											<div
												class="page-back h-full w-full rounded-l-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
											></div>
										{/if}
									</div>
								{:else if flipDirection === 'backward' && currentLeftStickers}
									<div
										class="page-container flip-backward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<!-- Front face: current left page -->
										<div
											class="page-face absolute inset-0 h-full w-full overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl"
										>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
											>
												{#each currentLeftStickers as sticker (sticker.id)}
													{@const rarity = getStickerRarity(sticker)}
													{@const owned = getCachedCopyCount(sticker.id) > 0}
													{@const placed = placedStickerIds.has(String(sticker.id))}
													{@const availableCopies = getAvailableCopies(sticker.id)}
													{@const canPlace = owned && !placed && availableCopies > 0}
													{@const placedElsewhere = owned && !placed && availableCopies <= 0}
													<div
														class={classNames('relative overflow-hidden', {
															'opacity-50 grayscale': !owned
														})}
													>
														{#if canPlace}
															<div
																class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
															>
																<span class="text-primary/60 text-[10px] font-medium">Stick</span>
															</div>
														{:else if placedElsewhere}
															<div
																class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
															>
																<span class="text-warning px-1 text-center text-[8px] font-medium"
																	>In other album</span
																>
															</div>
														{/if}
														<div class={classNames('h-full w-full', { 'opacity-70': canPlace })}>
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
										<!-- Back face: target right page -->
										{#if targetRightStickers}
											<div
												class="page-back h-full w-full overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl"
											>
												<div
													class="grid h-full"
													style="padding: {config.pagePadding}px; grid-template-columns: repeat({POKEMON_COLS}, 1fr); grid-template-rows: repeat({POKEMON_ROWS}, 1fr); gap: 4px;"
												>
													{#each targetRightStickers as sticker (sticker.id)}
														{@const rarity = getStickerRarity(sticker)}
														{@const owned = getCachedCopyCount(sticker.id) > 0}
														{@const placed = placedStickerIds.has(String(sticker.id))}
														{@const availableCopies = getAvailableCopies(sticker.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														<div
															class={classNames('relative overflow-hidden', {
																'opacity-50 grayscale': !owned
															})}
														>
															{#if canPlace}
																<div
																	class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-primary/60 text-[10px] font-medium">Stick</span>
																</div>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-warning px-1 text-center text-[8px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div class={classNames('h-full w-full', { 'opacity-70': canPlace })}>
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
											<div
												class="page-back h-full w-full rounded-r-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
											></div>
										{/if}
									</div>
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<!-- Regular Book View (two pages side by side) -->
					<!-- Keep showing current content during flip - the overlay handles the animation -->
					{@const leftPage = getLeftPage()}
					{@const rightPage = getRightPage()}
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
										'relative flex-1 overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, leftPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
										class="grid h-full"
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
															<span class="text-primary/60 text-xs font-medium">Click to stick</span
															>
														</button>
													{:else if placedElsewhere}
														<div
															class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
														>
															<span class="text-warning px-1 text-center text-[9px] font-medium"
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
							{/if}

							<!-- Right Page -->
							{#if rightPage}
								{@const rightPlacedStamps = getPlacedStampsForPage(rightPageIndex)}
								{@const rightPlacedIcons = getPlacedIconsForPage(rightPageIndex)}
								<div
									class={classNames(
										'relative flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl',
										{ 'cursor-crosshair': isPlacementMode || isIconPlacementMode }
									)}
									style="aspect-ratio: {PAGE_ASPECT};"
									onclick={(e) => {
										if (isPlacementMode)
											handlePageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
										if (isIconPlacementMode)
											handleIconPageClick(e, e.currentTarget as HTMLElement, rightPageIndex);
									}}
									role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
									tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
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
										class="grid h-full"
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
															<span class="text-primary/60 text-xs font-medium">Click to stick</span
															>
														</button>
													{:else if placedElsewhere}
														<div
															class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
														>
															<span class="text-warning px-1 text-center text-[9px] font-medium"
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
							{:else}
								<!-- Empty right page placeholder -->
								<div
									class="flex-1 overflow-hidden rounded-r-lg bg-white text-gray-900 opacity-30 shadow-xl"
									style="aspect-ratio: {PAGE_ASPECT};"
								>
									<div class="flex h-full flex-col p-4">
										<div class="mb-2 text-center">
											<p class="text-xs text-gray-500">--</p>
										</div>
										<div class="flex flex-1 items-center justify-center">
											{#if totalWinnerPages > 0}
												<span class="text-gray-300">Winners ahead</span>
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
							<div class="pointer-events-none absolute inset-0 z-30 flex w-full gap-1">
								{#if flipDirection === 'forward' && currentRightPage}
									<!-- Forward: right page flips to left -->
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
									<div
										class="page-container flip-forward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<!-- Front face: current right page -->
										<div
											class="page-face absolute inset-0 h-full w-full overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl"
										>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
											>
												{#each currentRightPage.rows as row}
													{#each row.stickers as { sticker } (sticker.id)}
														{@const rarity = getStickerRarity(sticker)}
														{@const owned = getCachedCopyCount(sticker.id) > 0}
														{@const placed = placedStickerIds.has(String(sticker.id))}
														{@const availableCopies = getAvailableCopies(sticker.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														<div
															class={classNames('relative overflow-hidden p-1', {
																'opacity-50 grayscale': !owned
															})}
														>
															{#if canPlace}
																<div
																	class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-primary/60 text-[10px] font-medium">Stick</span>
																</div>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-warning px-1 text-center text-[8px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div class={classNames('w-full', { 'opacity-70': canPlace })}>
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
										<!-- Back face: target left page -->
										{#if targetLeftPage}
											<div
												class="page-back h-full w-full overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl"
											>
												<div
													class="grid h-full"
													style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
												>
													{#each targetLeftPage.rows as row}
														{#each row.stickers as { sticker } (sticker.id)}
															{@const rarity = getStickerRarity(sticker)}
															{@const owned = getCachedCopyCount(sticker.id) > 0}
															{@const placed = placedStickerIds.has(String(sticker.id))}
															{@const availableCopies = getAvailableCopies(sticker.id)}
															{@const canPlace = owned && !placed && availableCopies > 0}
															{@const placedElsewhere = owned && !placed && availableCopies <= 0}
															<div
																class={classNames('relative overflow-hidden p-1', {
																	'opacity-50 grayscale': !owned
																})}
															>
																{#if canPlace}
																	<div
																		class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																	>
																		<span class="text-primary/60 text-[10px] font-medium">Stick</span
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
																<div class={classNames('w-full', { 'opacity-70': canPlace })}>
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
											<div
												class="page-back h-full w-full rounded-l-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
											></div>
										{/if}
									</div>
								{:else if flipDirection === 'backward' && currentLeftPage}
									<!-- Backward: left page flips to right -->
									<div
										class="page-container flip-backward flex-1"
										style="aspect-ratio: {PAGE_ASPECT};"
									>
										<!-- Front face: current left page -->
										<div
											class="page-face absolute inset-0 h-full w-full overflow-hidden rounded-l-lg bg-white text-gray-900 shadow-xl"
										>
											<div
												class="grid h-full"
												style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
											>
												{#each currentLeftPage.rows as row}
													{#each row.stickers as { sticker } (sticker.id)}
														{@const rarity = getStickerRarity(sticker)}
														{@const owned = getCachedCopyCount(sticker.id) > 0}
														{@const placed = placedStickerIds.has(String(sticker.id))}
														{@const availableCopies = getAvailableCopies(sticker.id)}
														{@const canPlace = owned && !placed && availableCopies > 0}
														{@const placedElsewhere = owned && !placed && availableCopies <= 0}
														<div
															class={classNames('relative overflow-hidden p-1', {
																'opacity-50 grayscale': !owned
															})}
														>
															{#if canPlace}
																<div
																	class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-primary/60 text-[10px] font-medium">Stick</span>
																</div>
															{:else if placedElsewhere}
																<div
																	class="bg-warning/20 border-warning/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																>
																	<span class="text-warning px-1 text-center text-[8px] font-medium"
																		>In other album</span
																	>
																</div>
															{/if}
															<div class={classNames('w-full', { 'opacity-70': canPlace })}>
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
										<!-- Back face: target right page -->
										{#if targetRightPage}
											<div
												class="page-back h-full w-full overflow-hidden rounded-r-lg bg-white text-gray-900 shadow-xl"
											>
												<div
													class="grid h-full"
													style="padding: {config.pagePadding}px; grid-template-columns: repeat({config.columns}, 1fr); gap: {config.rowGap}px {config.columnGap}px; align-content: start;"
												>
													{#each targetRightPage.rows as row}
														{#each row.stickers as { sticker } (sticker.id)}
															{@const rarity = getStickerRarity(sticker)}
															{@const owned = getCachedCopyCount(sticker.id) > 0}
															{@const placed = placedStickerIds.has(String(sticker.id))}
															{@const availableCopies = getAvailableCopies(sticker.id)}
															{@const canPlace = owned && !placed && availableCopies > 0}
															{@const placedElsewhere = owned && !placed && availableCopies <= 0}
															<div
																class={classNames('relative overflow-hidden p-1', {
																	'opacity-50 grayscale': !owned
																})}
															>
																{#if canPlace}
																	<div
																		class="bg-base-300/80 border-primary/40 absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed"
																	>
																		<span class="text-primary/60 text-[10px] font-medium">Stick</span
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
																<div class={classNames('w-full', { 'opacity-70': canPlace })}>
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
											<div
												class="page-back h-full w-full rounded-r-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl"
											></div>
										{/if}
									</div>
									<div class="flex-1" style="aspect-ratio: {PAGE_ASPECT};"></div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
				</div>

				<!-- Rarity Stats (col 3) -->
				<div class="rounded-lg bg-base-200 p-4">
					<h3 class="mb-4 text-lg font-semibold">Collection Stats</h3>
					{#if rarityCounts.length > 0}
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th>Rarity</th>
									<th class="text-right">Owned</th>
									<th class="text-right">Total</th>
									<th class="text-right">Progress</th>
								</tr>
							</thead>
							<tbody>
								{#each rarityCounts as { rarity, total, owned }}
									<tr>
										<td>
											<div class="flex items-center gap-2">
												<div
													class="h-4 w-4 rounded-full"
													style="background: linear-gradient(135deg, {rarity.colorFrom}, {rarity.colorTo});"
												></div>
												<span>{rarity.name}</span>
											</div>
										</td>
										<td class="text-right">{owned}</td>
										<td class="text-right">{total}</td>
										<td class="text-right">
											<div class="flex items-center justify-end gap-2">
												<progress
													class="progress progress-primary w-20"
													value={owned}
													max={total}
												></progress>
												<span class="text-sm text-base-content/70">
													{Math.round((owned / total) * 100)}%
												</span>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td>Total</td>
									<td class="text-right">{rarityCounts.reduce((sum, r) => sum + r.owned, 0)}</td>
									<td class="text-right">{rarityCounts.reduce((sum, r) => sum + r.total, 0)}</td>
									<td class="text-right">
										<span class="text-sm">
											{rarityCounts.reduce((sum, r) => sum + r.total, 0) > 0
												? Math.round(
														(rarityCounts.reduce((sum, r) => sum + r.owned, 0) /
															rarityCounts.reduce((sum, r) => sum + r.total, 0)) *
															100
													)
												: 0}%
										</span>
									</td>
								</tr>
							</tfoot>
						</table>
					{:else}
						<p class="text-base-content/60">No rarity data available.</p>
					{/if}

					<!-- Booster Pack Visual -->
					{#if collection.coverImage}
						<div class="mt-4 flex flex-col items-center gap-3">
							<div class="flex items-center gap-3">
								<BoosterPackCard {collection} showTitle={false} maxWidth="150px" />
								{#if unopenedBoosterPacks > 0}
									<span class="text-primary text-2xl font-bold">x{unopenedBoosterPacks}</span>
								{/if}
							</div>
							{#if unopenedBoosterPacks > 0}
								<button
									class="btn btn-secondary btn-sm"
									onclick={() => boosterPackModalService.open(collection.id, unopenedBoosterPacks, 'collection-page')}
								>
									Open Booster Packs
								</button>
							{/if}
						</div>
					{/if}

					<!-- Play Trivia Button -->
					<button
						class="btn btn-primary btn-sm mt-4 w-full"
						onclick={() => triviaModalService.open(collection)}
					>
						Play Trivia
					</button>
				</div>
			</div>

			<!-- Navigation and Tools -->
			{#if stickers.length > 0}
				<!-- Pagination Controls -->
				{#if totalSpreads > 1}
					<div class="mt-4 flex items-center justify-center gap-2">
						<button
							class="btn btn-outline btn-sm"
							onclick={prevSpread}
							disabled={currentSpread <= 1 || isFlipping}
						>
							Previous
						</button>
						<span class="text-base-content/60 text-sm">
							Spread {currentSpread + 1} of {totalSpreads}
						</span>
						<button
							class="btn btn-outline btn-sm"
							onclick={nextSpread}
							disabled={currentSpread === totalSpreads - 1 || isFlipping}
						>
							Next
						</button>
					</div>
				{/if}

				<!-- Icons and Stamps Row -->
				<div class="border-base-300 mt-4 border-t pt-4">
					<div class="flex items-start gap-4">
						<div>
							<h3 class="text-base-content/70 mb-2 text-sm font-semibold">Icons</h3>
							<IconRow onclick={handleIconRowClick} />
						</div>

						{#if stampPacks.length > 0}
							<div class="flex-1">
								<h3 class="text-base-content/70 mb-2 text-sm font-semibold">Stamps</h3>
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
		0% {
			transform: rotateY(0deg);
			z-index: 10;
		}
		100% {
			transform: rotateY(-180deg);
			z-index: 10;
		}
	}

	@keyframes flipBackward {
		0% {
			transform: rotateY(0deg);
			z-index: 10;
		}
		100% {
			transform: rotateY(180deg);
			z-index: 10;
		}
	}
</style>
