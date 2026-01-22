<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import { getCardsByAlbum, getCardCollection } from '$services/cards.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';

	// Game configuration
	const GAME_DURATION = 30; // seconds
	const MAX_POINTS = 1000;
	const MIN_POINTS = 100;
	const MAX_BLUR = 20; // pixels

	// View state
	type ViewState = 'album-select' | 'playing' | 'result';
	let viewState = $state<ViewState>('album-select');

	// Album selection state
	let albums: Album[] = $state([]);
	let albumCardCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game state
	let selectedAlbum = $state<Album | null>(null);
	let gameCards = $state<Card[]>([]);
	let oddCardIndex = $state<number>(-1);
	let timeRemaining = $state(GAME_DURATION);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let selectedCardIndex = $state<number | null>(null);
	let gameResult = $state<'correct' | 'wrong' | null>(null);
	let earnedPoints = $state(0);
	let totalScore = $state(0);
	let gamesPlayed = $state(0);

	// All cards cache for picking random cards from other albums
	let allCards: Card[] = [];

	onMount(async () => {
		albums = await getAlbumCollection();
		allCards = await getCardCollection();

		// Count cards per album
		const counts = new Map<string, number>();
		for (const album of albums) {
			const cards = await getCardsByAlbum(album.id);
			counts.set(String(album.id), cards.length);
		}
		albumCardCounts = counts;
		isLoading = false;
	});

	onDestroy(() => {
		if (timerInterval) {
			clearInterval(timerInterval);
		}
	});

	function getCardCount(albumId: string | number): number {
		return albumCardCounts.get(String(albumId)) ?? 0;
	}

	function canPlayAlbum(albumId: string | number): boolean {
		// Need at least 2 cards in the album
		const count = getCardCount(albumId);
		// Also need at least 1 card from other albums
		const otherAlbumCards = allCards.filter((c) => String(c.albumId) !== String(albumId));
		return count >= 2 && otherAlbumCards.length >= 1;
	}

	async function startGame(album: Album) {
		selectedAlbum = album;
		viewState = 'playing';
		gameResult = null;
		selectedCardIndex = null;
		earnedPoints = 0;

		// Get cards for this album
		const albumCards = await getCardsByAlbum(album.id);

		// Get cards from other albums
		const otherAlbumCards = allCards.filter((c) => String(c.albumId) !== String(album.id));

		// Shuffle and pick 2 cards from this album
		const shuffledAlbumCards = [...albumCards].sort(() => Math.random() - 0.5);
		const twoFromAlbum = shuffledAlbumCards.slice(0, 2);

		// Pick 1 random card from other albums
		const shuffledOther = [...otherAlbumCards].sort(() => Math.random() - 0.5);
		const oneFromOther = shuffledOther[0];

		// Create the game cards array and shuffle positions
		const combined = [...twoFromAlbum, oneFromOther];
		const shuffledCombined = combined
			.map((card, originalIndex) => ({ card, originalIndex, sort: Math.random() }))
			.sort((a, b) => a.sort - b.sort);

		gameCards = shuffledCombined.map((item) => item.card);
		// Find where the "odd" card (originally at index 2) ended up
		oddCardIndex = shuffledCombined.findIndex((item) => item.originalIndex === 2);

		// Start timer
		timeRemaining = GAME_DURATION;
		timerInterval = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				endGame(null);
			}
		}, 1000);
	}

	function selectCard(index: number) {
		if (selectedCardIndex !== null || gameResult !== null) return;
		endGame(index);
	}

	function endGame(chosenIndex: number | null) {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		selectedCardIndex = chosenIndex;

		if (chosenIndex === null) {
			// Time ran out
			gameResult = 'wrong';
			earnedPoints = 0;
		} else if (chosenIndex === oddCardIndex) {
			gameResult = 'correct';
			// Calculate points based on time remaining
			// More time remaining = more points
			const timeRatio = timeRemaining / GAME_DURATION;
			earnedPoints = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeRatio);
			totalScore += earnedPoints;
		} else {
			gameResult = 'wrong';
			earnedPoints = 0;
		}

		gamesPlayed++;
		viewState = 'result';
	}

	function playAgain() {
		if (selectedAlbum) {
			startGame(selectedAlbum);
		}
	}

	function backToAlbums() {
		viewState = 'album-select';
		selectedAlbum = null;
		gameCards = [];
		gameResult = null;
		selectedCardIndex = null;
	}

	function getCurrentBlur(): number {
		// Full blur at start (30s), no blur at end (0s)
		const timeRatio = timeRemaining / GAME_DURATION;
		return MAX_BLUR * timeRatio;
	}

	function formatTime(seconds: number): string {
		return `${seconds}s`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Odd One Out</h1>
			<p class="text-base-content/70 mt-1">
				{#if viewState === 'album-select'}
					Pick an album to start the game
				{:else if viewState === 'playing'}
					Find the card that doesn't belong!
				{:else}
					{gameResult === 'correct' ? 'Well done!' : 'Better luck next time!'}
				{/if}
			</p>
		</div>
		<div class="stats bg-base-200">
			<div class="stat">
				<div class="stat-title">Total Score</div>
				<div class="stat-value text-primary">{totalScore}</div>
				<div class="stat-desc">{gamesPlayed} games played</div>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if viewState === 'album-select'}
		<!-- Album Selection View -->
		{#if albums.length === 0}
			<div class="alert alert-info">
				<span>No albums available. Create albums with cards in the admin panel first.</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each albums as album (album.id)}
					{@const cardCount = getCardCount(album.id)}
					{@const canPlay = canPlayAlbum(album.id)}
					<div
						class={classNames(
							'card bg-base-200 transition-all',
							{
								'cursor-pointer hover:shadow-lg hover:scale-[1.02]': canPlay,
								'opacity-50 cursor-not-allowed': !canPlay
							}
						)}
						onclick={() => canPlay && startGame(album)}
						onkeydown={(e) => e.key === 'Enter' && canPlay && startGame(album)}
						role="button"
						tabindex={canPlay ? 0 : -1}
					>
						{#if album.coverImage}
							<figure class="relative">
								<img
									src={album.coverImage}
									alt={album.title}
									class="w-full h-48 object-cover"
								/>
							</figure>
						{:else}
							<figure class="relative bg-base-300 h-48 flex items-center justify-center">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</figure>
						{/if}
						<div class="card-body p-4">
							<h2 class="card-title text-lg">{album.title}</h2>
							<p class="text-sm text-base-content/60">
								{cardCount} cards
							</p>
							{#if !canPlay}
								<p class="text-xs text-error">
									{#if cardCount < 2}
										Need at least 2 cards
									{:else}
										No other albums with cards
									{/if}
								</p>
							{/if}
							<div class="card-actions justify-end mt-2">
								<button
									class={classNames('btn btn-sm', {
										'btn-primary': canPlay,
										'btn-disabled': !canPlay
									})}
									disabled={!canPlay}
								>
									Play
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else if viewState === 'playing' || viewState === 'result'}
		<!-- Game View -->
		<div class="flex flex-col items-center gap-6">
			<!-- Album info and back button -->
			<div class="flex items-center justify-between w-full max-w-3xl">
				<button class="btn btn-ghost btn-sm gap-2" onclick={backToAlbums}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back to Albums
				</button>
				{#if selectedAlbum}
					<span class="badge badge-lg badge-outline">{selectedAlbum.title}</span>
				{/if}
			</div>

			<!-- Timer (always visible to prevent layout shift) -->
			<div class="flex flex-col items-center gap-2">
				<div class="relative w-24 h-24">
					<!-- Background circle -->
					<svg class="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
						<circle
							cx="50"
							cy="50"
							r="45"
							fill="none"
							stroke="currentColor"
							stroke-width="6"
							class="text-base-300"
						/>
						<circle
							cx="50"
							cy="50"
							r="45"
							fill="none"
							stroke="currentColor"
							stroke-width="6"
							stroke-linecap="round"
							stroke-dasharray="283"
							stroke-dashoffset={283 - (283 * timeRemaining) / GAME_DURATION}
							class={classNames({
								'transition-all duration-1000': viewState === 'playing',
								'text-success': timeRemaining > 20 && gameResult !== 'wrong',
								'text-warning': timeRemaining > 10 && timeRemaining <= 20 && gameResult !== 'wrong',
								'text-error': timeRemaining <= 10 || gameResult === 'wrong',
								'text-primary': gameResult === 'correct'
							})}
						/>
					</svg>
					<!-- Timer text -->
					<div class="absolute inset-0 flex items-center justify-center">
						<span
							class={classNames('text-3xl font-bold tabular-nums', {
								'text-success': timeRemaining > 20 && gameResult !== 'wrong',
								'text-warning': timeRemaining > 10 && timeRemaining <= 20 && gameResult !== 'wrong',
								'text-error': timeRemaining <= 10 || gameResult === 'wrong',
								'text-primary': gameResult === 'correct'
							})}
						>
							{timeRemaining}
						</span>
					</div>
				</div>
				<p class="text-base-content/60 text-sm">
					{#if viewState === 'playing'}
						Find the odd one out!
					{:else if gameResult === 'correct'}
						You found it!
					{:else}
						Time's up!
					{/if}
				</p>
			</div>

			<!-- Cards Display -->
			<div class="grid grid-cols-3 gap-6 w-full max-w-3xl">
				{#each gameCards as card, index (card.id)}
					{@const isOdd = index === oddCardIndex}
					{@const isSelected = index === selectedCardIndex}
					{@const showResult = viewState === 'result'}
					<div
						class={classNames(
							'card bg-base-200 transition-all aspect-[3/4]',
							{
								'cursor-pointer hover:scale-105 hover:shadow-xl': viewState === 'playing',
								'ring-4 ring-success': showResult && isOdd,
								'ring-4 ring-error': showResult && isSelected && !isOdd,
								'ring-4 ring-primary': showResult && isSelected && isOdd,
								'opacity-50': showResult && !isOdd && !isSelected
							}
						)}
						onclick={() => viewState === 'playing' && selectCard(index)}
						onkeydown={(e) => e.key === 'Enter' && viewState === 'playing' && selectCard(index)}
						role="button"
						tabindex={viewState === 'playing' ? 0 : -1}
					>
						<figure class="relative h-full">
							<img
								src={card.image}
								alt={viewState === 'result' ? card.name : 'Mystery card'}
								class="w-full h-full object-cover transition-all duration-100"
								style={viewState === 'playing' ? `filter: blur(${getCurrentBlur()}px)` : ''}
								onerror={(e) => {
									(e.target as HTMLImageElement).src =
										'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
								}}
							/>
							{#if showResult}
								<div class="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
									<p class="text-white text-center text-sm font-medium truncate" title={card.name}>
										{card.name}
									</p>
									{#if isOdd}
										<p class="text-success text-center text-xs">The odd one!</p>
									{/if}
								</div>
								{#if isOdd}
									<div class="absolute top-2 right-2 badge badge-success gap-1">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
									</div>
								{/if}
								{#if isSelected && !isOdd}
									<div class="absolute top-2 right-2 badge badge-error gap-1">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</div>
								{/if}
							{/if}
						</figure>
					</div>
				{/each}
			</div>

			<!-- Result Display -->
			{#if viewState === 'result'}
				<div class="card bg-base-200 w-full max-w-md">
					<div class="card-body items-center text-center">
						{#if gameResult === 'correct'}
							<div class="text-6xl mb-2">🎉</div>
							<h2 class="card-title text-success">Correct!</h2>
							<p class="text-base-content/70">
								You found the odd one out with {formatTime(timeRemaining)} remaining!
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-success">+{earnedPoints}</div>
							</div>
						{:else}
							<div class="text-6xl mb-2">😔</div>
							<h2 class="card-title text-error">
								{selectedCardIndex === null ? 'Time\'s Up!' : 'Wrong!'}
							</h2>
							<p class="text-base-content/70">
								{#if selectedCardIndex === null}
									You ran out of time.
								{:else}
									That card was from the same album.
								{/if}
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-error">0</div>
							</div>
						{/if}
						<div class="card-actions mt-4 gap-2">
							<button class="btn btn-primary" onclick={playAgain}>
								Play Again
							</button>
							<button class="btn btn-outline" onclick={backToAlbums}>
								Choose Album
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
