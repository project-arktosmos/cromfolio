<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { getSourceCollection } from '$services/sources.service';
	import { getStickersBySource } from '$services/stickers.service';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';

	// Game configuration
	const GAME_DURATION = 30; // seconds
	const MAX_POINTS = 1000;
	const MIN_POINTS = 100;
	const GRID_SIZE = 12; // 6 pairs = 12 stickers
	const MIN_STICKERS_REQUIRED = 6; // Need at least 6 unique stickers for 6 pairs

	// View state
	type ViewState = 'source-select' | 'playing' | 'result';
	let viewState = $state<ViewState>('source-select');

	// Source selection state
	let sources: Source[] = $state([]);
	let sourceStickerCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game state
	let selectedSource = $state<Source | null>(null);
	let gameStickers = $state<{ sticker: Sticker; pairId: number; isFlipped: boolean; isMatched: boolean }[]>(
		[]
	);
	let timeRemaining = $state(GAME_DURATION);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let firstSelection = $state<number | null>(null);
	let secondSelection = $state<number | null>(null);
	let isProcessing = $state(false);
	let matchesFound = $state(0);
	let totalPairs = $state(0);
	let gameResult = $state<'won' | 'lost' | null>(null);
	let earnedPoints = $state(0);
	let totalScore = $state(0);
	let gamesPlayed = $state(0);

	onMount(async () => {
		sources = await getSourceCollection();

		// Count stickers per source
		const counts = new Map<string, number>();
		for (const source of sources) {
			const stickers = await getStickersBySource(source.id);
			counts.set(String(source.id), stickers.length);
		}
		sourceStickerCounts = counts;
		isLoading = false;
	});

	onDestroy(() => {
		if (timerInterval) {
			clearInterval(timerInterval);
		}
	});

	function getStickerCount(sourceId: string | number): number {
		return sourceStickerCounts.get(String(sourceId)) ?? 0;
	}

	function canPlaySource(sourceId: string | number): boolean {
		// Need at least 6 unique stickers for 6 pairs
		return getStickerCount(sourceId) >= MIN_STICKERS_REQUIRED;
	}

	async function startGame(source: Source) {
		selectedSource = source;
		viewState = 'playing';
		gameResult = null;
		firstSelection = null;
		secondSelection = null;
		isProcessing = false;
		matchesFound = 0;
		earnedPoints = 0;

		// Get stickers for this source
		const sourceStickers = await getStickersBySource(source.id);

		// Shuffle and pick 6 stickers
		const shuffledStickers = [...sourceStickers].sort(() => Math.random() - 0.5);
		const selectedStickers = shuffledStickers.slice(0, 6);
		totalPairs = selectedStickers.length;

		// Create pairs (duplicate each sticker)
		const pairs: { sticker: Sticker; pairId: number; isFlipped: boolean; isMatched: boolean }[] = [];
		selectedStickers.forEach((sticker, index) => {
			// Add two copies of each sticker with the same pairId
			pairs.push({ sticker, pairId: index, isFlipped: false, isMatched: false });
			pairs.push({ sticker, pairId: index, isFlipped: false, isMatched: false });
		});

		// Shuffle the pairs
		gameStickers = pairs.sort(() => Math.random() - 0.5);

		// Start timer
		timeRemaining = GAME_DURATION;
		timerInterval = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				endGame(false);
			}
		}, 1000);
	}

	function selectSticker(index: number) {
		// Ignore if processing, sticker is already matched, sticker is already flipped, or game is over
		if (
			isProcessing ||
			gameStickers[index].isMatched ||
			gameStickers[index].isFlipped ||
			gameResult !== null
		) {
			return;
		}

		// Flip the sticker
		gameStickers[index].isFlipped = true;

		if (firstSelection === null) {
			// First sticker of the pair
			firstSelection = index;
		} else {
			// Second sticker of the pair
			secondSelection = index;
			isProcessing = true;

			// Check for match
			const firstSticker = gameStickers[firstSelection];
			const secondSticker = gameStickers[index];

			if (firstSticker.pairId === secondSticker.pairId) {
				// Match found!
				gameStickers[firstSelection].isMatched = true;
				gameStickers[index].isMatched = true;
				matchesFound++;

				// Reset selections
				firstSelection = null;
				secondSelection = null;
				isProcessing = false;

				// Check for win
				if (matchesFound === totalPairs) {
					endGame(true);
				}
			} else {
				// No match - flip back after delay
				setTimeout(() => {
					if (firstSelection !== null && secondSelection !== null) {
						gameStickers[firstSelection].isFlipped = false;
						gameStickers[secondSelection].isFlipped = false;
					}
					firstSelection = null;
					secondSelection = null;
					isProcessing = false;
				}, 800);
			}
		}
	}

	function endGame(won: boolean) {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		if (won) {
			gameResult = 'won';
			// Calculate points based on time remaining
			const timeRatio = timeRemaining / GAME_DURATION;
			earnedPoints = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeRatio);
			totalScore += earnedPoints;
		} else {
			gameResult = 'lost';
			earnedPoints = 0;
		}

		gamesPlayed++;
		viewState = 'result';
	}

	function playAgain() {
		if (selectedSource) {
			startGame(selectedSource);
		}
	}

	function backToSources() {
		viewState = 'source-select';
		selectedSource = null;
		gameStickers = [];
		gameResult = null;
		firstSelection = null;
		secondSelection = null;
	}

	function formatTime(seconds: number): string {
		return `${seconds}s`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Matching Pairs</h1>
			<p class="text-base-content/70 mt-1">
				{#if viewState === 'source-select'}
					Pick a source to start the game
				{:else if viewState === 'playing'}
					Find all matching pairs before time runs out!
				{:else}
					{gameResult === 'won' ? 'Excellent memory!' : 'Time ran out!'}
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
	{:else if viewState === 'source-select'}
		<!-- Source Selection View -->
		{#if sources.length === 0}
			<div class="alert alert-info">
				<span>No sources available. Create sources with stickers in the admin panel first.</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each sources as source (source.id)}
					{@const stickerCount = getStickerCount(source.id)}
					{@const canPlay = canPlaySource(source.id)}
					<div
						class={classNames('card bg-base-200 transition-all', {
							'cursor-pointer hover:shadow-lg hover:scale-[1.02]': canPlay,
							'opacity-50 cursor-not-allowed': !canPlay
						})}
						onclick={() => canPlay && startGame(source)}
						onkeydown={(e) => e.key === 'Enter' && canPlay && startGame(source)}
						role="button"
						tabindex={canPlay ? 0 : -1}
					>
						{#if source.coverImage}
							<figure class="relative">
								<img src={source.coverImage} alt={source.title} class="w-full h-48 object-cover" />
							</figure>
						{:else}
							<figure class="relative bg-base-300 h-48 flex items-center justify-center">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-16 w-16 text-base-content/30"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
							</figure>
						{/if}
						<div class="card-body p-4">
							<h2 class="card-title text-lg">{source.title}</h2>
							<p class="text-sm text-base-content/60">
								{stickerCount} stickers
							</p>
							{#if !canPlay}
								<p class="text-xs text-error">
									Need at least {MIN_STICKERS_REQUIRED} stickers
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
			<!-- Source info and back button -->
			<div class="flex items-center justify-between w-full max-w-4xl">
				<button class="btn btn-ghost btn-sm gap-2" onclick={backToSources}>
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
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					Back to Sources
				</button>
				{#if selectedSource}
					<span class="badge badge-lg badge-outline">{selectedSource.title}</span>
				{/if}
			</div>

			<!-- Timer and Progress -->
			<div class="flex items-center gap-8">
				<!-- Timer -->
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
									'text-success': timeRemaining > 20 && gameResult !== 'lost',
									'text-warning': timeRemaining > 10 && timeRemaining <= 20 && gameResult !== 'lost',
									'text-error': timeRemaining <= 10 || gameResult === 'lost',
									'text-primary': gameResult === 'won'
								})}
							/>
						</svg>
						<!-- Timer text -->
						<div class="absolute inset-0 flex items-center justify-center">
							<span
								class={classNames('text-3xl font-bold tabular-nums', {
									'text-success': timeRemaining > 20 && gameResult !== 'lost',
									'text-warning': timeRemaining > 10 && timeRemaining <= 20 && gameResult !== 'lost',
									'text-error': timeRemaining <= 10 || gameResult === 'lost',
									'text-primary': gameResult === 'won'
								})}
							>
								{timeRemaining}
							</span>
						</div>
					</div>
				</div>

				<!-- Progress -->
				<div class="flex flex-col items-center gap-1">
					<div class="text-4xl font-bold text-primary">
						{matchesFound}/{totalPairs}
					</div>
					<div class="text-sm text-base-content/60">Pairs found</div>
				</div>
			</div>

			<!-- Stickers Grid -->
			<div class="grid grid-cols-4 gap-3 w-full max-w-2xl">
				{#each gameStickers as gameSticker, index (index)}
					{@const isClickable =
						viewState === 'playing' &&
						!isProcessing &&
						!gameSticker.isFlipped &&
						!gameSticker.isMatched}
					<div
						class={classNames(
							'aspect-[3/4] relative cursor-pointer perspective-1000',
							{
								'pointer-events-none': !isClickable
							}
						)}
						onclick={() => selectSticker(index)}
						onkeydown={(e) => e.key === 'Enter' && selectSticker(index)}
						role="button"
						tabindex={isClickable ? 0 : -1}
					>
						<!-- Sticker container with flip animation -->
						<div
							class={classNames(
								'w-full h-full transition-transform duration-300 transform-style-3d relative',
								{
									'rotate-y-180': gameSticker.isFlipped || gameSticker.isMatched
								}
							)}
						>
							<!-- Sticker Back (face down) -->
							<div
								class={classNames(
									'absolute inset-0 backface-hidden rounded-lg flex items-center justify-center',
									'bg-gradient-to-br from-primary to-secondary',
									{
										'hover:scale-105 hover:shadow-xl transition-all': isClickable
									}
								)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-12 w-12 text-primary-content/50"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>

							<!-- Sticker Front (face up) -->
							<div
								class={classNames(
									'absolute inset-0 backface-hidden rotate-y-180 rounded-lg overflow-hidden',
									'bg-base-200',
									{
										'ring-4 ring-success': gameSticker.isMatched,
										'opacity-70': gameSticker.isMatched && viewState === 'result'
									}
								)}
							>
								<img
									src={gameSticker.sticker.image}
									alt={gameSticker.sticker.name}
									class="w-full h-full object-cover"
									onerror={(e) => {
										(e.target as HTMLImageElement).src =
											'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
									}}
								/>
								{#if gameSticker.isMatched}
									<div class="absolute top-1 right-1 badge badge-success badge-sm">
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
												d="M5 13l4 4L19 7"
											/>
										</svg>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Result Display -->
			{#if viewState === 'result'}
				<div class="card bg-base-200 w-full max-w-md">
					<div class="card-body items-center text-center">
						{#if gameResult === 'won'}
							<div class="text-6xl mb-2">🎉</div>
							<h2 class="card-title text-success">You Won!</h2>
							<p class="text-base-content/70">
								You found all pairs with {formatTime(timeRemaining)} remaining!
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-success">+{earnedPoints}</div>
							</div>
						{:else}
							<div class="text-6xl mb-2">⏰</div>
							<h2 class="card-title text-error">Time's Up!</h2>
							<p class="text-base-content/70">
								You found {matchesFound} out of {totalPairs} pairs.
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-error">0</div>
							</div>
						{/if}
						<div class="card-actions mt-4 gap-2">
							<button class="btn btn-primary" onclick={playAgain}> Play Again </button>
							<button class="btn btn-outline" onclick={backToSources}> Choose Source </button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.perspective-1000 {
		perspective: 1000px;
	}
	.transform-style-3d {
		transform-style: preserve-3d;
	}
	.backface-hidden {
		backface-visibility: hidden;
	}
	.rotate-y-180 {
		transform: rotateY(180deg);
	}
</style>
