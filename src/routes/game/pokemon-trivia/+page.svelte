<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getActivePokemonTriviaTemplatesV2 } from '$services/pokemon-trivia-templates.service';
	import { getTagsBySticker, type PokemonWithTags } from '$services/tags.service';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';
	import type { Tag } from '$types/tag.type';

	// Game configuration
	const TOTAL_QUESTIONS = 5;
	const ANSWER_COUNT = 3; // 1 correct + 2 wrong

	// View state
	type ViewState = 'collection-select' | 'playing' | 'question-result' | 'game-over';
	let viewState = $state<ViewState>('collection-select');

	// Collection selection state
	let collections: Collection[] = $state([]);
	let collectionStickerCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game data
	let selectedCollection = $state<Collection | null>(null);
	let templates: PokemonTriviaTemplateV2[] = $state([]);
	let pokemonPool: PokemonWithTags[] = $state([]);

	// Current question state
	let currentQuestionIndex = $state(0);
	let currentQuestion = $state<string>('');
	let currentAnswers = $state<{ text: string; isCorrect: boolean }[]>([]);
	let currentPokemon = $state<PokemonWithTags | null>(null);
	let selectedAnswerIndex = $state<number | null>(null);
	let hasAnswered = $state(false);

	// Score tracking
	let correctAnswers = $state(0);
	let wrongAnswers = $state(0);

	// Stats persistence
	let totalGamesPlayed = $state(0);
	let totalCorrect = $state(0);
	let totalWrong = $state(0);

	onMount(async () => {
		if (browser) {
			loadStats();
		}

		// Load collections
		collections = await getAllCollections();

		// Count stickers per collection
		const counts = new Map<string, number>();
		for (const collection of collections) {
			const stickers = await getStickersForCollection(collection.id);
			counts.set(String(collection.id), stickers.length);
		}
		collectionStickerCounts = counts;

		// Load active templates
		templates = await getActivePokemonTriviaTemplatesV2();

		isLoading = false;
	});

	function loadStats() {
		const saved = localStorage.getItem('pokemon-trivia-stats');
		if (saved) {
			const stats = JSON.parse(saved);
			totalGamesPlayed = stats.totalGamesPlayed || 0;
			totalCorrect = stats.totalCorrect || 0;
			totalWrong = stats.totalWrong || 0;
		}
	}

	function saveStats() {
		localStorage.setItem(
			'pokemon-trivia-stats',
			JSON.stringify({
				totalGamesPlayed,
				totalCorrect,
				totalWrong
			})
		);
	}

	function getStickerCount(collectionId: string | number): number {
		return collectionStickerCounts.get(String(collectionId)) ?? 0;
	}

	function canPlayCollection(collectionId: string | number): boolean {
		// Need at least 3 Pokemon for wrong answers
		return getStickerCount(collectionId) >= 3 && templates.length > 0;
	}

	async function loadPokemonForCollection(collectionId: string | number): Promise<PokemonWithTags[]> {
		const stickers = await getStickersForCollection(collectionId);
		const pokemonList: PokemonWithTags[] = [];

		for (const sticker of stickers) {
			const tags = await getTagsBySticker(sticker.id);
			const tagsMap: Record<string, string> = {};
			for (const tag of tags) {
				// Handle multi-value tags (like type) by keeping the first one for simplicity
				if (!tagsMap[tag.key]) {
					tagsMap[tag.key] = tag.value;
				}
			}
			pokemonList.push({
				id: String(sticker.id),
				name: sticker.name,
				image: sticker.image,
				tags: tagsMap
			});
		}

		return pokemonList;
	}

	async function startGame(collection: Collection) {
		selectedCollection = collection;
		isLoading = true;

		// Load Pokemon with tags for this collection
		pokemonPool = await loadPokemonForCollection(collection.id);

		// Reset game state
		currentQuestionIndex = 0;
		correctAnswers = 0;
		wrongAnswers = 0;

		isLoading = false;
		generateQuestion();
		viewState = 'playing';
	}

	function generateQuestion() {
		if (pokemonPool.length < 3 || templates.length === 0) {
			viewState = 'game-over';
			return;
		}

		// Pick a random Pokemon
		const randomPokemonIndex = Math.floor(Math.random() * pokemonPool.length);
		currentPokemon = pokemonPool[randomPokemonIndex];

		// Try to find a template that works with this Pokemon's tags
		let template: PokemonTriviaTemplateV2 | null = null;
		let attempts = 0;
		const maxAttempts = templates.length * 2;

		while (!template && attempts < maxAttempts) {
			const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
			const primaryAttr = randomTemplate.primaryAttribute;

			// Check if the Pokemon has this attribute
			if (currentPokemon.tags[primaryAttr]) {
				template = randomTemplate;
			}
			attempts++;
		}

		// If no suitable template found, use a simple name-based question
		if (!template) {
			generateSimpleQuestion();
			return;
		}

		// Generate the question text
		currentQuestion = renderTemplate(template.questionTemplate, currentPokemon);

		// Get the correct answer
		const correctAnswer = renderTemplate(template.answerTemplate, currentPokemon);

		// Get wrong answers from other Pokemon
		const wrongAnswerTexts = getWrongAnswers(template.primaryAttribute, correctAnswer, 2);

		// Combine and shuffle answers
		const answers = [
			{ text: correctAnswer, isCorrect: true },
			...wrongAnswerTexts.map((text) => ({ text, isCorrect: false }))
		];
		currentAnswers = shuffleArray(answers);

		// Reset answer state
		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function generateSimpleQuestion() {
		if (!currentPokemon) return;

		// Fallback: "What is the name of this Pokemon?" with image
		currentQuestion = `Which Pokemon is shown in the image?`;

		const correctAnswer = currentPokemon.name;

		// Get wrong answers from other Pokemon names
		const otherPokemon = pokemonPool.filter((p) => p.id !== currentPokemon!.id);
		const shuffledOthers = shuffleArray(otherPokemon);
		const wrongAnswers = shuffledOthers.slice(0, 2).map((p) => p.name);

		const answers = [
			{ text: correctAnswer, isCorrect: true },
			...wrongAnswers.map((text) => ({ text, isCorrect: false }))
		];
		currentAnswers = shuffleArray(answers);

		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function renderTemplate(template: string, pokemon: PokemonWithTags): string {
		let result = template;

		// Replace {name} with Pokemon name
		result = result.replace(/{name}/gi, pokemon.name);

		// Replace any {attribute} with the Pokemon's tag value
		const tagPlaceholders = result.match(/{([^}]+)}/g);
		if (tagPlaceholders) {
			for (const placeholder of tagPlaceholders) {
				const attr = placeholder.slice(1, -1); // Remove { and }
				const value = pokemon.tags[attr] || '???';
				result = result.replace(placeholder, value);
			}
		}

		return result;
	}

	function getWrongAnswers(attribute: string, correctAnswer: string, count: number): string[] {
		// Get unique values for this attribute from other Pokemon
		const otherValues = new Set<string>();

		for (const pokemon of pokemonPool) {
			const value = pokemon.tags[attribute];
			if (value && value !== correctAnswer) {
				otherValues.add(value);
			}
		}

		// If not enough unique values, fall back to Pokemon names
		if (otherValues.size < count) {
			const otherNames = pokemonPool
				.filter((p) => p.name !== correctAnswer)
				.map((p) => p.name);
			return shuffleArray(otherNames).slice(0, count);
		}

		return shuffleArray([...otherValues]).slice(0, count);
	}

	function shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	function selectAnswer(index: number) {
		if (hasAnswered) return;

		selectedAnswerIndex = index;
		hasAnswered = true;

		const isCorrect = currentAnswers[index].isCorrect;
		if (isCorrect) {
			correctAnswers++;
		} else {
			wrongAnswers++;
		}

		viewState = 'question-result';
	}

	function nextQuestion() {
		currentQuestionIndex++;

		if (currentQuestionIndex >= TOTAL_QUESTIONS) {
			// Game over
			totalGamesPlayed++;
			totalCorrect += correctAnswers;
			totalWrong += wrongAnswers;
			if (browser) {
				saveStats();
			}
			viewState = 'game-over';
		} else {
			generateQuestion();
			viewState = 'playing';
		}
	}

	function playAgain() {
		if (selectedCollection) {
			startGame(selectedCollection);
		}
	}

	function backToCollections() {
		viewState = 'collection-select';
		selectedCollection = null;
		pokemonPool = [];
		currentQuestionIndex = 0;
		correctAnswers = 0;
		wrongAnswers = 0;
	}

	function getAnswerClass(index: number): string {
		if (!hasAnswered) {
			return classNames(
				'btn btn-lg btn-block justify-start text-left h-auto py-4 px-6',
				'bg-base-200 hover:bg-base-300 border-2 border-base-300'
			);
		}

		const answer = currentAnswers[index];
		const isSelected = selectedAnswerIndex === index;

		return classNames('btn btn-lg btn-block justify-start text-left h-auto py-4 px-6 border-2', {
			'bg-success text-success-content border-success': answer.isCorrect,
			'bg-error text-error-content border-error': isSelected && !answer.isCorrect,
			'bg-base-200 border-base-300 opacity-50': !isSelected && !answer.isCorrect
		});
	}

	function getProgressPercentage(): number {
		return (currentQuestionIndex / TOTAL_QUESTIONS) * 100;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Pokemon Trivia</h1>
			<p class="text-base-content/70 mt-1">
				{#if viewState === 'collection-select'}
					Select a collection to start the trivia game
				{:else if viewState === 'playing'}
					Question {currentQuestionIndex + 1} of {TOTAL_QUESTIONS}
				{:else if viewState === 'question-result'}
					{currentAnswers[selectedAnswerIndex ?? 0]?.isCorrect ? 'Correct!' : 'Wrong!'}
				{:else}
					Game Over!
				{/if}
			</p>
		</div>
		<div class="stats bg-base-200">
			<div class="stat">
				<div class="stat-title">Games Played</div>
				<div class="stat-value text-primary">{totalGamesPlayed}</div>
				<div class="stat-desc">
					{totalCorrect} correct / {totalWrong} wrong
				</div>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if viewState === 'collection-select'}
		<!-- Collection Selection View -->
		{#if templates.length === 0}
			<div class="alert alert-warning">
				<span>No active trivia templates found. Create templates in the admin panel first.</span>
			</div>
		{/if}

		{#if collections.length === 0}
			<div class="alert alert-info">
				<span>No collections available. Create collections in the admin panel first.</span>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each collections as collection (collection.id)}
					{@const stickerCount = getStickerCount(collection.id)}
					{@const canPlay = canPlayCollection(collection.id)}
					<div
						class={classNames('card bg-base-200 transition-all', {
							'cursor-pointer hover:shadow-lg hover:scale-[1.02]': canPlay,
							'opacity-50 cursor-not-allowed': !canPlay
						})}
						onclick={() => canPlay && startGame(collection)}
						onkeydown={(e) => e.key === 'Enter' && canPlay && startGame(collection)}
						role="button"
						tabindex={canPlay ? 0 : -1}
					>
						{#if collection.coverImage}
							<figure class="relative">
								<img
									src={collection.coverImage}
									alt={collection.title}
									class="w-full h-48 object-cover"
								/>
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
							<h2 class="card-title text-lg">{collection.title}</h2>
							<p class="text-sm text-base-content/60">
								{stickerCount} Pokemon
							</p>
							{#if !canPlay}
								<p class="text-xs text-error">
									{stickerCount < 3
										? 'Need at least 3 Pokemon'
										: 'No active trivia templates'}
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
	{:else if viewState === 'playing' || viewState === 'question-result'}
		<!-- Game View -->
		<div class="flex flex-col items-center gap-6">
			<!-- Navigation and progress -->
			<div class="flex items-center justify-between w-full max-w-3xl">
				<button class="btn btn-ghost btn-sm gap-2" onclick={backToCollections}>
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
					Back
				</button>

				<!-- Score display -->
				<div class="flex gap-4">
					<div class="badge badge-success badge-lg gap-1">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
						{correctAnswers}
					</div>
					<div class="badge badge-error badge-lg gap-1">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
						{wrongAnswers}
					</div>
				</div>
			</div>

			<!-- Progress bar -->
			<div class="w-full max-w-3xl">
				<progress
					class="progress progress-primary w-full"
					value={getProgressPercentage()}
					max="100"
				></progress>
			</div>

			<!-- Pokemon Image (if showing image-based question) -->
			{#if currentPokemon && currentQuestion.includes('image')}
				<div class="w-48 h-48">
					<img
						src={currentPokemon.image}
						alt="Mystery Pokemon"
						class="w-full h-full object-contain"
					/>
				</div>
			{/if}

			<!-- Question Card -->
			<div class="card bg-base-200 w-full max-w-3xl">
				<div class="card-body">
					<h2 class="card-title text-xl text-center justify-center">{currentQuestion}</h2>

					<!-- Answer buttons -->
					<div class="flex flex-col gap-3 mt-6">
						{#each currentAnswers as answer, index}
							<button
								class={getAnswerClass(index)}
								onclick={() => selectAnswer(index)}
								disabled={hasAnswered}
							>
								<span class="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
								{answer.text}
							</button>
						{/each}
					</div>

					<!-- Next button (shown after answering) -->
					{#if viewState === 'question-result'}
						<div class="card-actions justify-center mt-6">
							<button class="btn btn-primary btn-lg" onclick={nextQuestion}>
								{currentQuestionIndex + 1 >= TOTAL_QUESTIONS ? 'See Results' : 'Next Question'}
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else if viewState === 'game-over'}
		<!-- Game Over View -->
		<div class="flex flex-col items-center gap-6">
			<div class="card bg-base-200 w-full max-w-md">
				<div class="card-body items-center text-center">
					{#if correctAnswers === TOTAL_QUESTIONS}
						<div class="text-6xl mb-2">🏆</div>
						<h2 class="card-title text-success text-2xl">Perfect Score!</h2>
					{:else if correctAnswers >= TOTAL_QUESTIONS / 2}
						<div class="text-6xl mb-2">🎉</div>
						<h2 class="card-title text-primary text-2xl">Good Job!</h2>
					{:else}
						<div class="text-6xl mb-2">📚</div>
						<h2 class="card-title text-warning text-2xl">Keep Learning!</h2>
					{/if}

					<p class="text-base-content/70 mt-2">
						You answered {correctAnswers} out of {TOTAL_QUESTIONS} questions correctly.
					</p>

					<div class="stats stats-vertical sm:stats-horizontal mt-6 bg-base-300">
						<div class="stat">
							<div class="stat-title">Correct</div>
							<div class="stat-value text-success">{correctAnswers}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Wrong</div>
							<div class="stat-value text-error">{wrongAnswers}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Score</div>
							<div class="stat-value text-primary">
								{Math.round((correctAnswers / TOTAL_QUESTIONS) * 100)}%
							</div>
						</div>
					</div>

					<div class="card-actions mt-6 gap-2">
						<button class="btn btn-primary" onclick={playAgain}>Play Again</button>
						<button class="btn btn-outline" onclick={backToCollections}>
							Choose Collection
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
