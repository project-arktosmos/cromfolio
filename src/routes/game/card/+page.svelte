<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import { getCardsByAlbum } from '$services/cards.service';
	import { getRarityCollection } from '$services/rarities.service';
	import {
		playerCardsService,
		ownsCard,
		acquireCard,
		releaseCard,
		getUniqueOwnedCardCountByAlbum,
		getCardCopyCount
	} from '$services/player-cards.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';
	import type { Rarity } from '$types/rarity.type';
	import SingleCard from '$components/core/SingleCard.svelte';

	const BOOSTER_PACK_SIZE = 5;

	let albums: Album[] = $state([]);
	let cards: Card[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let raritiesMap = $state<Map<string, Rarity>>(new Map());
	let isLoading = $state(true);
	let isLoadingCards = $state(false);
	let selectedAlbum = $state<Album | null>(null);
	let ownedCardIds = $state<Set<string | number>>(new Set());
	let albumCardCounts = $state<Map<string, { total: number; owned: number }>>(new Map());
	let albumCards = $state<Map<string, Card[]>>(new Map());

	// Booster pack modal state
	let showBoosterModal = $state(false);
	let boosterCards = $state<Card[]>([]);
	let boosterAlbum = $state<Album | null>(null);
	let revealedCards = $state<Set<number>>(new Set());
	let isOpeningPack = $state(false);

	onMount(async () => {
		[albums, rarities] = await Promise.all([getAlbumCollection(), getRarityCollection()]);
		// Build a map for quick rarity lookup by ID
		raritiesMap = new Map(rarities.map((r) => [String(r.id), r]));
		await loadAlbumStats();
		updateOwnedSet();
		isLoading = false;

		// Subscribe to player cards changes
		const unsubscribe = playerCardsService.store.subscribe(() => {
			updateOwnedSet();
			updateAlbumStats();
		});

		return () => unsubscribe();
	});

	async function loadAlbumStats() {
		const counts = new Map<string, { total: number; owned: number }>();
		const cardsMap = new Map<string, Card[]>();
		for (const album of albums) {
			const albumCardsData = await getCardsByAlbum(album.id);
			const ownedCount = getUniqueOwnedCardCountByAlbum(album.id);
			counts.set(String(album.id), { total: albumCardsData.length, owned: ownedCount });
			cardsMap.set(String(album.id), albumCardsData);
		}
		albumCardCounts = counts;
		albumCards = cardsMap;
	}

	function updateAlbumStats() {
		const counts = new Map(albumCardCounts);
		for (const album of albums) {
			const existing = counts.get(String(album.id));
			if (existing) {
				counts.set(String(album.id), {
					total: existing.total,
					owned: getUniqueOwnedCardCountByAlbum(album.id)
				});
			}
		}
		albumCardCounts = counts;
	}

	function updateOwnedSet() {
		ownedCardIds = new Set(playerCardsService.all().map((o) => o.cardId));
	}

	async function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id) {
			selectedAlbum = null;
			cards = [];
		} else {
			selectedAlbum = album;
			isLoadingCards = true;
			cards = await getCardsByAlbum(album.id);
			isLoadingCards = false;
		}
	}

	function toggleCardOwnership(card: Card) {
		if (ownsCard(card.id)) {
			releaseCard(card.id);
		} else {
			acquireCard(card.id, card.albumId);
		}
	}

	function isOwned(cardId: string | number): boolean {
		return ownedCardIds.has(cardId);
	}

	function getAlbumStats(albumId: string | number): { total: number; owned: number } {
		return albumCardCounts.get(String(albumId)) ?? { total: 0, owned: 0 };
	}

	function getTotalOwned(): number {
		return ownedCardIds.size;
	}

	function getTotalCards(): number {
		let total = 0;
		for (const stats of albumCardCounts.values()) {
			total += stats.total;
		}
		return total;
	}

	function getAlbumCards(albumId: string | number): Card[] {
		return albumCards.get(String(albumId)) ?? [];
	}

	function hasCardsInAlbum(albumId: string | number): boolean {
		return getAlbumCards(albumId).length > 0;
	}

	function getCardRarity(card: Card): Rarity | null {
		if (!card.rarityId) return null;
		return raritiesMap.get(String(card.rarityId)) ?? null;
	}

	async function openBoosterPack(album: Album, event: MouseEvent) {
		event.stopPropagation();

		const allCards = getAlbumCards(album.id);
		if (allCards.length === 0) return;

		isOpeningPack = true;
		boosterAlbum = album;
		revealedCards = new Set();

		// Shuffle and pick up to BOOSTER_PACK_SIZE random cards (duplicates allowed)
		const shuffled = [...allCards].sort(() => Math.random() - 0.5);
		boosterCards = shuffled.slice(0, BOOSTER_PACK_SIZE);

		showBoosterModal = true;
		isOpeningPack = false;
	}

	function revealCard(index: number) {
		if (revealedCards.has(index)) return;

		const card = boosterCards[index];
		acquireCard(card.id, card.albumId);
		revealedCards = new Set([...revealedCards, index]);
	}

	function revealAllCards() {
		for (let i = 0; i < boosterCards.length; i++) {
			if (!revealedCards.has(i)) {
				const card = boosterCards[i];
				acquireCard(card.id, card.albumId);
			}
		}
		revealedCards = new Set(boosterCards.map((_, i) => i));
	}

	function closeBoosterModal() {
		showBoosterModal = false;
		boosterCards = [];
		boosterAlbum = null;
		revealedCards = new Set();
	}

	function allCardsRevealed(): boolean {
		return revealedCards.size === boosterCards.length;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Card Collection</h1>
			<p class="text-base-content/70 mt-1">
				Collect cards from your favorite albums
			</p>
		</div>
		<div class="stats bg-base-200">
			<div class="stat">
				<div class="stat-title">Cards Owned</div>
				<div class="stat-value text-primary">{getTotalOwned()}</div>
				<div class="stat-desc">of {getTotalCards()} total cards</div>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if albums.length === 0}
		<div class="alert alert-info">
			<span>No albums available. Create albums in the admin panel first.</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Albums Column -->
			<div class="lg:col-span-1">
				<div class="card bg-base-200">
					<div class="card-body">
						<h2 class="card-title">Albums</h2>
						<div class="space-y-2 max-h-[600px] overflow-y-auto">
							{#each albums as album (album.id)}
								{@const stats = getAlbumStats(album.id)}
								{@const isComplete = stats.total > 0 && stats.owned === stats.total}
								<div
									class={classNames(
										'p-3 rounded-lg cursor-pointer transition-all',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedAlbum?.id === album.id,
											'bg-base-100': selectedAlbum?.id !== album.id,
											'ring-2 ring-success': isComplete && selectedAlbum?.id !== album.id
										}
									)}
									onclick={() => selectAlbum(album)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(album)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-3">
										{#if album.coverImage}
											<img
												src={album.coverImage}
												alt={album.title}
												class="w-12 h-16 object-cover rounded"
											/>
										{:else}
											<div class="w-12 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<span class="font-medium truncate">{album.title}</span>
												{#if isComplete}
													<span class="badge badge-success badge-sm">Complete</span>
												{/if}
											</div>
											<div class="text-sm text-base-content/60">
												{stats.owned} / {stats.total} cards
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
													onclick={(e) => openBoosterPack(album, e)}
													disabled={!hasCardsInAlbum(album.id)}
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

			<!-- Cards Column -->
			<div class="lg:col-span-2">
				<div class="card bg-base-200 min-h-[400px]">
					<div class="card-body">
						{#if !selectedAlbum}
							<div class="flex flex-col items-center justify-center h-64 text-base-content/60">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<p>Select an album to view its cards</p>
							</div>
						{:else}
							{@const stats = getAlbumStats(selectedAlbum.id)}
							<div class="flex items-center justify-between mb-4">
								<h2 class="card-title">{selectedAlbum.title}</h2>
								<span class="badge badge-lg">
									{stats.owned} / {stats.total} owned
								</span>
							</div>

							{#if isLoadingCards}
								<div class="flex justify-center p-8">
									<span class="loading loading-spinner loading-md"></span>
								</div>
							{:else if cards.length === 0}
								<div class="text-center text-base-content/60 p-8">
									<p>No cards in this album yet.</p>
									<p class="text-sm mt-1">Add cards in the admin panel.</p>
								</div>
							{:else}
								<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
									{#each cards as card (card.id)}
										{@const copyCount = getCardCopyCount(card.id)}
										{@const owned = copyCount > 0}
										{@const rarity = getCardRarity(card)}
										<SingleCard
											{card}
											{rarity}
											{owned}
											{copyCount}
											onclick={() => toggleCardOwnership(card)}
											onkeydown={(e) => e.key === 'Enter' && toggleCardOwnership(card)}
										/>
									{/each}
								</div>
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
			{#if boosterAlbum}
				<p class="text-base-content/70 mb-4">{boosterAlbum.title}</p>
			{/if}

			<div class="grid grid-cols-5 gap-3 mb-6">
				{#each boosterCards as card, index (card.id)}
					{@const isRevealed = revealedCards.has(index)}
					<div
						class={classNames(
							'aspect-[3/4] rounded-lg cursor-pointer transition-all duration-300',
							{
								'bg-gradient-to-br from-primary to-secondary': !isRevealed,
								'hover:scale-105 hover:shadow-lg': !isRevealed,
								'ring-2 ring-primary': isRevealed
							}
						)}
						onclick={() => revealCard(index)}
						onkeydown={(e) => e.key === 'Enter' && revealCard(index)}
						role="button"
						tabindex="0"
					>
						{#if isRevealed}
							<div class="h-full flex flex-col">
								<img
									src={card.image}
									alt={card.name}
									class="w-full flex-1 object-cover rounded-t-lg"
									onerror={(e) => {
										(e.target as HTMLImageElement).src =
											'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
									}}
								/>
								<div class="p-2 bg-base-100 rounded-b-lg">
									<p class="text-xs font-medium truncate text-center" title={card.name}>{card.name}</p>
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
				{#if !allCardsRevealed()}
					<button class="btn btn-secondary" onclick={revealAllCards}>
						Reveal All
					</button>
				{/if}
				<button
					class={classNames('btn', {
						'btn-primary': allCardsRevealed(),
						'btn-ghost': !allCardsRevealed()
					})}
					onclick={closeBoosterModal}
				>
					{allCardsRevealed() ? 'Done' : 'Close'}
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={closeBoosterModal}></div>
	</div>
{/if}
