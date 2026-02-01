<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getSourceCollection } from '$services/sources.service';
	import { getStickersBySource } from '$services/stickers.service';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';

	// Game configuration
	const MAX_BLUR = 20; // pixels - maximum blur at start
	const MIN_BLUR = 0; // no blur when fully revealed
	const MAX_POINTS = 1000;
	const MIN_POINTS = 100;

	// View state
	type ViewState = 'source-select' | 'playing' | 'result';
	let viewState = $state<ViewState>('source-select');

	// Source selection state
	let sources: Source[] = $state([]);
	let sourceStickerCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game state
	let selectedSource = $state<Source | null>(null);
	let currentSticker = $state<Sticker | null>(null);
	let targetName = $state('');
	let normalizedTargetName = $state('');
	let revealedLetters = $state<Set<number>>(new Set());
	let guessedLetters = $state<Set<string>>(new Set());
	let correctGuesses = $state(0);
	let wrongGuesses = $state(0);
	let gameResult = $state<'won' | 'lost' | null>(null);
	let earnedPoints = $state(0);
	let totalScore = $state(0);
	let gamesPlayed = $state(0);

	// Keyboard layout (same as wordle)
	const KEYBOARD_ROWS = [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['z', 'x', 'c', 'v', 'b', 'n', 'm']
	];

	// Letter status for keyboard coloring
	type LetterStatus = 'correct' | 'wrong' | 'unused';

	onMount(async () => {
		if (browser) {
			loadStats();
		}
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
		if (browser) {
			saveStats();
		}
	});

	function loadStats() {
		const saved = localStorage.getItem('guess-the-name-stats');
		if (saved) {
			const stats = JSON.parse(saved);
			totalScore = stats.totalScore || 0;
			gamesPlayed = stats.gamesPlayed || 0;
		}
	}

	function saveStats() {
		localStorage.setItem(
			'guess-the-name-stats',
			JSON.stringify({
				totalScore,
				gamesPlayed
			})
		);
	}

	function getStickerCount(sourceId: string | number): number {
		return sourceStickerCounts.get(String(sourceId)) ?? 0;
	}

	function canPlaySource(sourceId: string | number): boolean {
		return getStickerCount(sourceId) >= 1;
	}

	function normalizeForGame(name: string): string {
		// Keep only letters and spaces, convert to uppercase
		return name
			.toUpperCase()
			.replace(/[^A-Z\s]/g, '')
			.trim();
	}

	function getUniqueLetters(name: string): Set<string> {
		const letters = new Set<string>();
		for (const char of name) {
			if (/[A-Z]/.test(char)) {
				letters.add(char);
			}
		}
		return letters;
	}

	async function startGame(source: Source) {
		selectedSource = source;
		viewState = 'playing';
		gameResult = null;
		earnedPoints = 0;
		revealedLetters = new Set();
		guessedLetters = new Set();
		correctGuesses = 0;
		wrongGuesses = 0;

		// Get stickers for this source and pick a random one
		const sourceStickers = await getStickersBySource(source.id);
		const randomIndex = Math.floor(Math.random() * sourceStickers.length);
		currentSticker = sourceStickers[randomIndex];
		targetName = currentSticker!.name;
		normalizedTargetName = normalizeForGame(targetName);
	}

	function handleKeyPress(key: string) {
		if (gameResult !== null) return;

		const upperKey = key.toUpperCase();
		if (guessedLetters.has(upperKey)) return; // Already guessed

		guessedLetters = new Set([...guessedLetters, upperKey]);

		// Check if this letter is in the name
		const isCorrect = normalizedTargetName.includes(upperKey);

		if (isCorrect) {
			correctGuesses++;
			// Reveal all instances of this letter
			const newRevealed = new Set(revealedLetters);
			for (let i = 0; i < normalizedTargetName.length; i++) {
				if (normalizedTargetName[i] === upperKey) {
					newRevealed.add(i);
				}
			}
			revealedLetters = newRevealed;

			// Check for win - all letters revealed
			const uniqueLetters = getUniqueLetters(normalizedTargetName);
			const revealedUniqueLetters = new Set(
				[...revealedLetters].map((i) => normalizedTargetName[i])
			);
			if (revealedUniqueLetters.size === uniqueLetters.size) {
				endGame(true);
			}
		} else {
			wrongGuesses++;
			// Check for loss after too many wrong guesses (max 6 wrong)
			if (wrongGuesses >= 6) {
				endGame(false);
			}
		}
	}

	function endGame(won: boolean) {
		gameResult = won ? 'won' : 'lost';
		gamesPlayed++;

		if (won) {
			// Calculate points based on how few wrong guesses
			// More wrong guesses = fewer points
			const wrongRatio = wrongGuesses / 6;
			earnedPoints = Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * wrongRatio);
			totalScore += earnedPoints;
		} else {
			earnedPoints = 0;
		}

		viewState = 'result';
		saveStats();
	}

	function getCurrentBlur(): number {
		if (gameResult !== null) return MIN_BLUR;

		const uniqueLetters = getUniqueLetters(normalizedTargetName);
		if (uniqueLetters.size === 0) return MIN_BLUR;

		const revealedUniqueLetters = new Set(
			[...revealedLetters].map((i) => normalizedTargetName[i])
		);
		const revealRatio = revealedUniqueLetters.size / uniqueLetters.size;

		// Blur decreases as more letters are revealed
		return MAX_BLUR * (1 - revealRatio);
	}

	function getLetterStatus(key: string): LetterStatus {
		const upperKey = key.toUpperCase();
		if (!guessedLetters.has(upperKey)) return 'unused';
		if (normalizedTargetName.includes(upperKey)) return 'correct';
		return 'wrong';
	}

	function getKeyClasses(key: string): string {
		const status = getLetterStatus(key);

		return classNames(
			'h-12 sm:h-14 flex items-center justify-center font-semibold uppercase rounded-md transition-colors cursor-pointer select-none min-w-[2rem] sm:min-w-[2.75rem] text-sm sm:text-base',
			{
				'bg-base-300 hover:bg-base-content/30 text-base-content': status === 'unused',
				'bg-success text-success-content': status === 'correct',
				'bg-error text-error-content': status === 'wrong'
			}
		);
	}

	function playAgain() {
		if (selectedSource) {
			startGame(selectedSource);
		}
	}

	function backToSources() {
		viewState = 'source-select';
		selectedSource = null;
		currentSticker = null;
		gameResult = null;
	}

	// Handle physical keyboard
	function handleKeyDown(e: KeyboardEvent) {
		if (viewState !== 'playing' || gameResult !== null) return;

		const key = e.key.toLowerCase();
		if (/^[a-z]$/.test(key)) {
			e.preventDefault();
			handleKeyPress(key);
		}
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Guess the Name</h1>
			<p class="text-base-content/70 mt-1">
				{#if viewState === 'source-select'}
					Pick a source to start the game
				{:else if viewState === 'playing'}
					Guess letters to reveal the name!
				{:else}
					{gameResult === 'won' ? 'Well done!' : 'Better luck next time!'}
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
								<p class="text-xs text-error">Need at least 1 sticker</p>
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
			<div class="flex items-center justify-between w-full max-w-3xl">
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

			<!-- Wrong guesses counter -->
			<div class="flex items-center gap-4">
				<div class="flex gap-1">
					{#each Array(6) as _, i}
						<div
							class={classNames('w-4 h-4 rounded-full transition-colors', {
								'bg-error': i < wrongGuesses,
								'bg-base-300': i >= wrongGuesses
							})}
						></div>
					{/each}
				</div>
				<span class="text-base-content/70 text-sm">{wrongGuesses}/6 wrong guesses</span>
			</div>

			<!-- Sticker Display with blur -->
			{#if currentSticker}
				<div class="relative w-full max-w-md">
					<div class="card bg-base-200 overflow-hidden">
						<figure class="relative aspect-[3/4]">
							<img
								src={currentSticker.image}
								alt={viewState === 'result' ? currentSticker.name : 'Mystery'}
								class="w-full h-full object-cover transition-all duration-300"
								style={`filter: blur(${getCurrentBlur()}px)`}
								onerror={(e) => {
									(e.target as HTMLImageElement).src =
										'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23374151" width="128" height="128"/><text x="64" y="68" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';
								}}
							/>
						</figure>
					</div>
				</div>
			{/if}

			<!-- Letter tiles display -->
			<div class="flex flex-wrap justify-center gap-2 max-w-3xl">
				{#each normalizedTargetName.split('') as char, index}
					{#if char === ' '}
						<div class="w-4"></div>
					{:else}
						<div
							class={classNames(
								'w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-bold uppercase border-2 rounded transition-all',
								{
									'border-success bg-success/20 text-success': revealedLetters.has(index),
									'border-base-content/30 bg-base-200': !revealedLetters.has(index)
								}
							)}
						>
							{#if revealedLetters.has(index) || viewState === 'result'}
								{char}
							{:else}
								_
							{/if}
						</div>
					{/if}
				{/each}
			</div>

			<!-- Virtual Keyboard -->
			{#if viewState === 'playing'}
				<div class="flex flex-col items-center gap-1.5 pt-4 w-full max-w-lg">
					{#each KEYBOARD_ROWS as row}
						<div class="flex gap-1.5 justify-center">
							{#each row as key}
								<button
									class={getKeyClasses(key)}
									onclick={() => handleKeyPress(key)}
									disabled={guessedLetters.has(key.toUpperCase())}
								>
									{key}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Result Display -->
			{#if viewState === 'result'}
				<div class="card bg-base-200 w-full max-w-md">
					<div class="card-body items-center text-center">
						{#if gameResult === 'won'}
							<div class="text-6xl mb-2">🎉</div>
							<h2 class="card-title text-success">You got it!</h2>
							<p class="text-base-content/70">
								The answer was: <span class="font-bold">{targetName}</span>
							</p>
							<p class="text-base-content/60 text-sm">
								You made {wrongGuesses} wrong {wrongGuesses === 1 ? 'guess' : 'guesses'}
							</p>
							<div class="stat">
								<div class="stat-title">Points Earned</div>
								<div class="stat-value text-success">+{earnedPoints}</div>
							</div>
						{:else}
							<div class="text-6xl mb-2">😔</div>
							<h2 class="card-title text-error">Game Over</h2>
							<p class="text-base-content/70">
								The answer was: <span class="font-bold">{targetName}</span>
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

			<!-- Instructions -->
			{#if viewState === 'playing' && guessedLetters.size === 0}
				<div class="mt-4 text-center text-sm text-base-content/50">
					<p>Guess letters to reveal the name.</p>
					<p class="mt-1">Each correct guess removes blur from the image!</p>
					<p class="mt-1">
						<span class="inline-block h-4 w-4 bg-success rounded"></span> Correct &nbsp;
						<span class="inline-block h-4 w-4 bg-error rounded"></span> Wrong
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
