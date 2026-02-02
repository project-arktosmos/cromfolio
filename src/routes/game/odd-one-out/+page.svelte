<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { getSourceCollection } from '$services/sources.service';
	import { getStickersBySource, getStickerCollection } from '$services/stickers.service';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';

	// Game configuration
	const GAME_DURATION = 30; // seconds
	const MAX_POINTS = 1000;
	const MIN_POINTS = 100;
	const MAX_BLUR = 20; // pixels

	// View state
	type ViewState = 'source-select' | 'playing' | 'result';
	let viewState = $state<ViewState>('source-select');

	// Source selection state
	let sources: Source[] = $state([]);
	let sourceStickerCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game state
	let selectedSource = $state<Source | null>(null);
	let gameStickers = $state<Sticker[]>([]);
	let oddStickerIndex = $state<number>(-1);
	let timeRemaining = $state(GAME_DURATION);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let selectedStickerIndex = $state<number | null>(null);
	let gameResult = $state<'correct' | 'wrong' | null>(null);
	let earnedPoints = $state(0);
	let totalScore = $state(0);
	let gamesPlayed = $state(0);

	// All stickers cache for picking random stickers from other sources
	let allStickers: Sticker[] = [];

	onMount(async () => {
		sources = await getSourceCollection();
		allStickers = await getStickerCollection();

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
		// Need at least 2 stickers in the source
		const count = getStickerCount(sourceId);
		// Also need at least 1 sticker from other sources
		const otherSourceStickers = allStickers.filter((b) => String(b.sourceId) !== String(sourceId));
		return count >= 2 && otherSourceStickers.length >= 1;
	}

	async function startGame(source: Source) {
		selectedSource = source;
		viewState = 'playing';
		gameResult = null;
		selectedStickerIndex = null;
		earnedPoints = 0;

		// Get stickers for this source
		const sourceStickers = await getStickersBySource(source.id);

		// Get stickers from other sources
		const otherSourceStickers = allStickers.filter((b) => String(b.sourceId) !== String(source.id));

		// Shuffle and pick 2 stickers from this source
		const shuffledSourceStickers = [...sourceStickers].sort(() => Math.random() - 0.5);
		const twoFromSource = shuffledSourceStickers.slice(0, 2);

		// Pick 1 random sticker from other sources
		const shuffledOther = [...otherSourceStickers].sort(() => Math.random() - 0.5);
		const oneFromOther = shuffledOther[0];

		// Create the game stickers array and shuffle positions
		const combined = [...twoFromSource, oneFromOther];
		const shuffledCombined = combined
			.map((sticker, originalIndex) => ({ sticker, originalIndex, sort: Math.random() }))
			.sort((a, b) => a.sort - b.sort);

		gameStickers = shuffledCombined.map((item) => item.sticker);
		// Find where the "odd" sticker (originally at index 2) ended up
		oddStickerIndex = shuffledCombined.findIndex((item) => item.originalIndex === 2);

		// Start timer
		timeRemaining = GAME_DURATION;
		timerInterval = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				endGame(null);
			}
		}, 1000);
	}

	function selectSticker(index: number) {
		if (selectedStickerIndex !== null || gameResult !== null) return;
		endGame(index);
	}

	function endGame(chosenIndex: number | null) {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		selectedStickerIndex = chosenIndex;

		if (chosenIndex === null) {
			// Time ran out
			gameResult = 'wrong';
			earnedPoints = 0;
		} else if (chosenIndex === oddStickerIndex) {
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
		if (selectedSource) {
			startGame(selectedSource);
		}
	}

	function backToSources() {
		viewState = 'source-select';
		selectedSource = null;
		gameStickers = [];
		gameResult = null;
		selectedStickerIndex = null;
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
				{#if viewState === 'source-select'}
					Pick a source to start the game
				{:else if viewState === 'playing'}
					Find the one that doesn't belong!
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
	{:else if viewState === 'source-select'}
		<!-- Source Selection View -->
		{#if sources.length === 0}
			<div class="alert alert-info">
				<span>No sources available. Create sources with stickers in the admin panel first.</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each sources as source (source.id)}
					{@const stickerCount = getStickerCount(source.id)}
					{@const canPlay = canPlaySource(source.id)}
					<div
						class={classNames('card bg-base-200 transition-all', {
							'cursor-pointer hover:scale-[1.02] hover:shadow-lg': canPlay,
							'cursor-not-allowed opacity-50': !canPlay
						})}
						onclick={() => canPlay && startGame(source)}
						onkeydown={(e) => e.key === 'Enter' && canPlay && startGame(source)}
						role="button"
						tabindex={canPlay ? 0 : -1}
					>
						{#if source.coverImage}
							<figure class="relative">
								<img src={source.coverImage} alt={source.title} class="h-48 w-full object-cover" />
							</figure>
						{:else}
							<figure class="bg-base-300 relative flex h-48 items-center justify-center">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-base-content/30 h-16 w-16"
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
							<p class="text-base-content/60 text-sm">
								{stickerCount} stickers
							</p>
							{#if !canPlay}
								<p class="text-error text-xs">
									{#if stickerCount < 2}
										Need at least 2 stickers
									{:else}
										No other sources with stickers
									{/if}
								</p>
							{/if}
							<div class="card-actions mt-2 justify-end">
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
			<div class="flex w-full max-w-3xl items-center justify-between">
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

			<!-- Timer (always visible to prevent layout shift) -->
			<div class="flex flex-col items-center gap-2">
				<div class="relative h-24 w-24">
					<!-- Background circle -->
					<svg class="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
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

			<!-- Stickers Display -->
			<div class="grid w-full max-w-3xl grid-cols-3 gap-6">
				{#each gameStickers as sticker, index (sticker.id)}
					{@const isOdd = index === oddStickerIndex}
					{@const isSelected = index === selectedStickerIndex}
					{@const showResult = viewState === 'result'}
					<div
						class={classNames('card bg-base-200 aspect-[3/4] transition-all', {
							'cursor-pointer hover:scale-105 hover:shadow-xl': viewState === 'playing',
							'ring-success ring-4': showResult && isOdd,
							'ring-error ring-4': showResult && isSelected && !isOdd,
							'ring-primary ring-4': showResult && isSelected && isOdd,
							'opacity-50': showResult && !isOdd && !isSelected
						})}
						onclick={() => viewState === 'playing' && selectSticker(index)}
						onkeydown={(e) => e.key === 'Enter' && viewState === 'playing' && selectSticker(index)}
						role="button"
						tabindex={viewState === 'playing' ? 0 : -1}
					>
						<figure class="relative h-full">
							<img
								src={sticker.image}
								alt={viewState === 'result' ? sticker.name : 'Mystery'}
								class="h-full w-full object-cover transition-all duration-100"
								style={viewState === 'playing' ? `filter: blur(${getCurrentBlur()}px)` : ''}
								onerror={(e) => {
									(e.target as HTMLImageElement).src =
										'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
								}}
							/>
							{#if showResult}
								<div class="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
									<p
										class="truncate text-center text-sm font-medium text-white"
										title={sticker.name}
									>
										{sticker.name}
									</p>
									{#if isOdd}
										<p class="text-success text-center text-xs">The odd one!</p>
									{/if}
								</div>
								{#if isOdd}
									<div class="badge badge-success absolute right-2 top-2 gap-1">
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
												d="M5 13l4 4L19 7"
											/>
										</svg>
									</div>
								{/if}
								{#if isSelected && !isOdd}
									<div class="badge badge-error absolute right-2 top-2 gap-1">
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
												d="M6 18L18 6M6 6l12 12"
											/>
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
							<div class="mb-2 text-6xl">🎉</div>
							<h2 class="card-title text-success">Correct!</h2>
							<p class="text-base-content/70">
								You found the odd one out with {formatTime(timeRemaining)} remaining!
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-success">+{earnedPoints}</div>
							</div>
						{:else}
							<div class="mb-2 text-6xl">😔</div>
							<h2 class="card-title text-error">
								{selectedStickerIndex === null ? "Time's Up!" : 'Wrong!'}
							</h2>
							<p class="text-base-content/70">
								{#if selectedStickerIndex === null}
									You ran out of time.
								{:else}
									That one was from the same source.
								{/if}
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
