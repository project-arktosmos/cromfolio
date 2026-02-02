<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getActivePokemonTriviaTemplatesV2 } from '$services/pokemon-trivia-templates.service';
	import { getTagsBySticker, type PokemonWithTags } from '$services/tags.service';
	import type { Collection } from '$types/collection.type';
	import type { PokemonTriviaTemplateV2, TemplateType } from '$types/pokemon-trivia-template.type';
	import {
		replacePlaceholders,
		getAnswerValue,
		shuffleArray,
		selectAnswers
	} from '$utils/pokemon-trivia';

	// Difficulty configurations
	type GameDifficulty = 'easy' | 'hard';

	const DIFFICULTY_CONFIG: Record<
		GameDifficulty,
		{ questions: number; timePerQuestion: number; answerCount: number; label: string; description: string }
	> = {
		easy: {
			questions: 3,
			timePerQuestion: 10,
			answerCount: 3,
			label: 'Easy',
			description: '3 questions, 10 seconds each, 3 choices'
		},
		hard: {
			questions: 5,
			timePerQuestion: 5,
			answerCount: 4,
			label: 'Hard',
			description: '5 questions, 5 seconds each, 4 choices'
		}
	};

	// View state
	type ViewState = 'collection-select' | 'difficulty-select' | 'playing' | 'question-result' | 'game-over';
	let viewState = $state<ViewState>('collection-select');

	// Collection selection state
	let collections: Collection[] = $state([]);
	let collectionStickerCounts = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);

	// Game data
	let selectedCollection = $state<Collection | null>(null);
	let selectedDifficulty = $state<GameDifficulty>('easy');
	let templates: PokemonTriviaTemplateV2[] = $state([]);
	let pokemonPool: PokemonWithTags[] = $state([]);

	// Current question state
	let currentQuestionIndex = $state(0);
	let currentQuestion = $state<string>('');
	let currentAnswers = $state<{ text: string; pokemon: PokemonWithTags; isCorrect: boolean }[]>([]);
	let currentTemplate = $state<PokemonTriviaTemplateV2 | null>(null);
	let correctPokemon = $state<PokemonWithTags | null>(null);
	let selectedAnswerIndex = $state<number | null>(null);
	let hasAnswered = $state(false);

	// Timer state
	let timeRemaining = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Score tracking
	let correctAnswers = $state(0);
	let wrongAnswers = $state(0);

	// Stats persistence
	let totalGamesPlayed = $state(0);
	let totalCorrect = $state(0);
	let totalWrong = $state(0);

	// Derived values based on difficulty
	let totalQuestions = $derived(DIFFICULTY_CONFIG[selectedDifficulty].questions);
	let wrongAnswerCount = $derived(DIFFICULTY_CONFIG[selectedDifficulty].answerCount - 1);
	let timePerQuestion = $derived(DIFFICULTY_CONFIG[selectedDifficulty].timePerQuestion);

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

	onDestroy(() => {
		stopTimer();
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
		// Need at least 4 Pokemon for answer selection algorithm (1 correct + 3 wrong options pool)
		return getStickerCount(collectionId) >= 4 && templates.length > 0;
	}

	async function loadPokemonForCollection(collectionId: string | number): Promise<PokemonWithTags[]> {
		const stickers = await getStickersForCollection(collectionId);
		const pokemonList: PokemonWithTags[] = [];

		for (const sticker of stickers) {
			const tags = await getTagsBySticker(sticker.id);
			const tagsMap: Record<string, string> = {};
			for (const tag of tags) {
				// Handle multi-value tags by keeping the first one for simplicity
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

	function selectCollection(collection: Collection) {
		selectedCollection = collection;
		viewState = 'difficulty-select';
	}

	async function startGame(difficulty: GameDifficulty) {
		selectedDifficulty = difficulty;
		isLoading = true;

		// Load Pokemon with tags for this collection
		pokemonPool = await loadPokemonForCollection(selectedCollection!.id);

		// Reset game state
		currentQuestionIndex = 0;
		correctAnswers = 0;
		wrongAnswers = 0;

		isLoading = false;
		generateQuestion();
		startTimer();
		viewState = 'playing';
	}

	function startTimer() {
		stopTimer();
		timeRemaining = timePerQuestion;
		timerInterval = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				handleTimeOut();
			}
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function handleTimeOut() {
		if (hasAnswered) return;

		stopTimer();
		hasAnswered = true;
		selectedAnswerIndex = null; // No answer selected
		wrongAnswers++;
		viewState = 'question-result';
	}

	function generateQuestion() {
		if (pokemonPool.length < 4 || templates.length === 0) {
			viewState = 'game-over';
			return;
		}

		// Shuffle the pool for this question
		const shuffledPool = shuffleArray(pokemonPool);

		// Try to find a template that works with the available Pokemon
		let selectedTemplate: PokemonTriviaTemplateV2 | null = null;
		let selectionResult: ReturnType<typeof selectAnswers> | null = null;

		// Try each template weighted by their weight value
		const weightedTemplates = templates.flatMap((t) =>
			Array(Math.max(1, Math.min(t.weight, 10))).fill(t)
		);
		const shuffledTemplates = shuffleArray(weightedTemplates);

		for (const template of shuffledTemplates) {
			// Check if we have Pokemon with the primary attribute
			const pokemonWithAttr = shuffledPool.filter(
				(p) => p.tags[template.primaryAttribute] !== undefined
			);

			if (pokemonWithAttr.length < 4) continue;

			// Use the answer selection utility to get correct and wrong answers
			const result = selectAnswers(
				shuffledArray(pokemonWithAttr),
				template.templateType as TemplateType,
				template.primaryAttribute,
				template.questionTemplate
			);

			if (result.correct && result.wrong.length >= wrongAnswerCount) {
				selectedTemplate = template;
				selectionResult = result;
				break;
			}
		}

		// Fallback to simple name-based question if no template works
		if (!selectedTemplate || !selectionResult || !selectionResult.correct) {
			generateSimpleQuestion(shuffledPool);
			return;
		}

		currentTemplate = selectedTemplate;
		correctPokemon = selectionResult.correct;

		// Generate the question text using the utility
		currentQuestion = replacePlaceholders(selectedTemplate.questionTemplate, correctPokemon);

		// Get the correct answer value
		const correctAnswerText = getAnswerValue(correctPokemon, selectedTemplate.answerTemplate);

		// Build answer options: 1 correct + N wrong (shuffled)
		const wrongAnswersList = selectionResult.wrong.slice(0, wrongAnswerCount);
		const answers = [
			{ text: correctAnswerText, pokemon: correctPokemon, isCorrect: true },
			...wrongAnswersList.map((p) => ({
				text: getAnswerValue(p, selectedTemplate!.answerTemplate),
				pokemon: p,
				isCorrect: false
			}))
		];

		currentAnswers = shuffleArray(answers);

		// Reset answer state
		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function generateSimpleQuestion(pool: PokemonWithTags[]) {
		// Fallback: "Which Pokemon is this?" with image
		const correct = pool[0];
		correctPokemon = correct;
		currentTemplate = null;

		currentQuestion = `Which Pokemon is shown in the image?`;

		const wrongPokemon = pool.filter((p) => p.id !== correct.id).slice(0, wrongAnswerCount);

		const answers = [
			{ text: correct.name, pokemon: correct, isCorrect: true },
			...wrongPokemon.map((p) => ({
				text: p.name,
				pokemon: p,
				isCorrect: false
			}))
		];

		currentAnswers = shuffleArray(answers);
		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function shuffledArray<T>(items: T[]): T[] {
		return shuffleArray(items);
	}

	function selectAnswer(index: number) {
		if (hasAnswered) return;

		stopTimer();
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

		if (currentQuestionIndex >= totalQuestions) {
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
			startTimer();
			viewState = 'playing';
		}
	}

	function playAgain() {
		viewState = 'difficulty-select';
	}

	function backToCollections() {
		stopTimer();
		viewState = 'collection-select';
		selectedCollection = null;
		pokemonPool = [];
		currentQuestionIndex = 0;
		correctAnswers = 0;
		wrongAnswers = 0;
	}

	function backToDifficultySelect() {
		stopTimer();
		viewState = 'difficulty-select';
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
		return (currentQuestionIndex / totalQuestions) * 100;
	}

	function getTimerClass(): string {
		if (timeRemaining <= 3) return 'text-error';
		if (timeRemaining <= 5) return 'text-warning';
		return 'text-primary';
	}

	function getTimerProgressClass(): string {
		if (timeRemaining <= 3) return 'progress-error';
		if (timeRemaining <= 5) return 'progress-warning';
		return 'progress-primary';
	}

	// Check if the question mentions the Pokemon by name (e.g., "What is Cyndaquil's...")
	// If so, show the Pokemon image above the question, not in the answer buttons
	let questionMentionsPokemon = $derived(
		currentTemplate?.questionTemplate.includes('{name}') ?? false
	);

	// Timer percentage for progress bar
	let timerPercentage = $derived((timeRemaining / timePerQuestion) * 100);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Pokemon Trivia</h1>
			<p class="text-base-content/70 mt-1">
				{#if viewState === 'collection-select'}
					Select a collection to start the trivia game
				{:else if viewState === 'difficulty-select'}
					Choose your difficulty
				{:else if viewState === 'playing'}
					Question {currentQuestionIndex + 1} of {totalQuestions}
				{:else if viewState === 'question-result'}
					{#if selectedAnswerIndex === null}
						Time's up!
					{:else if currentAnswers[selectedAnswerIndex]?.isCorrect}
						Correct!
					{:else}
						Wrong!
					{/if}
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
						onclick={() => canPlay && selectCollection(collection)}
						onkeydown={(e) => e.key === 'Enter' && canPlay && selectCollection(collection)}
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
									{stickerCount < 4 ? 'Need at least 4 Pokemon' : 'No active trivia templates'}
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
	{:else if viewState === 'difficulty-select'}
		<!-- Difficulty Selection View -->
		<div class="flex flex-col items-center gap-6">
			<button class="btn btn-ghost btn-sm gap-2 self-start" onclick={backToCollections}>
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
				Back to Collections
			</button>

			{#if selectedCollection}
				<div class="text-center">
					<h2 class="text-2xl font-bold">{selectedCollection.title}</h2>
					<p class="text-base-content/70">Select difficulty to begin</p>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
				<!-- Easy Mode -->
				<div
					class="card bg-success/10 border-2 border-success hover:bg-success/20 transition-all cursor-pointer"
					onclick={() => startGame('easy')}
					onkeydown={(e) => e.key === 'Enter' && startGame('easy')}
					role="button"
					tabindex="0"
				>
					<div class="card-body items-center text-center">
						<div class="text-5xl mb-2">🌱</div>
						<h3 class="card-title text-success text-2xl">Easy</h3>
						<div class="space-y-2 text-base-content/80">
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-success">3</span> Questions
							</p>
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-success">10s</span> Per Question
							</p>
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-success">3</span> Answer Choices
							</p>
						</div>
						<button class="btn btn-success btn-wide mt-4">Start Easy</button>
					</div>
				</div>

				<!-- Hard Mode -->
				<div
					class="card bg-error/10 border-2 border-error hover:bg-error/20 transition-all cursor-pointer"
					onclick={() => startGame('hard')}
					onkeydown={(e) => e.key === 'Enter' && startGame('hard')}
					role="button"
					tabindex="0"
				>
					<div class="card-body items-center text-center">
						<div class="text-5xl mb-2">🔥</div>
						<h3 class="card-title text-error text-2xl">Hard</h3>
						<div class="space-y-2 text-base-content/80">
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-error">5</span> Questions
							</p>
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-error">5s</span> Per Question
							</p>
							<p class="flex items-center gap-2 justify-center">
								<span class="badge badge-error">4</span> Answer Choices
							</p>
						</div>
						<button class="btn btn-error btn-wide mt-4">Start Hard</button>
					</div>
				</div>
			</div>
		</div>
	{:else if viewState === 'playing' || viewState === 'question-result'}
		<!-- Game View -->
		<div class="flex flex-col items-center gap-6">
			<!-- Navigation and progress -->
			<div class="flex items-center justify-between w-full max-w-3xl">
				<button class="btn btn-ghost btn-sm gap-2" onclick={backToDifficultySelect}>
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
					Quit
				</button>

				<!-- Difficulty badge -->
				<div
					class={classNames('badge badge-lg', {
						'badge-success': selectedDifficulty === 'easy',
						'badge-error': selectedDifficulty === 'hard'
					})}
				>
					{DIFFICULTY_CONFIG[selectedDifficulty].label}
				</div>

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

			<!-- Timer (only during playing) -->
			{#if viewState === 'playing'}
				<div class="w-full max-w-3xl">
					<div class="flex items-center gap-3">
						<span class={classNames('text-2xl font-bold tabular-nums', getTimerClass())}>
							{timeRemaining}s
						</span>
						<progress
							class={classNames('progress flex-1', getTimerProgressClass())}
							value={timerPercentage}
							max="100"
						></progress>
					</div>
				</div>
			{/if}

			<!-- Question Card -->
			<div class="card bg-base-200 w-full max-w-3xl">
				<div class="card-body">
					<!-- Pokemon image when the question mentions the Pokemon by name -->
					{#if questionMentionsPokemon && correctPokemon}
						<div class="flex justify-center mb-4">
							<img
								src={correctPokemon.image}
								alt={correctPokemon.name}
								class="w-32 h-32 object-contain"
							/>
						</div>
					{/if}

					<h2 class="card-title text-xl text-center justify-center">{currentQuestion}</h2>

					<!-- Answer buttons -->
					<div class="flex flex-col gap-3 mt-6">
						{#each currentAnswers as answer, index}
							<button
								class={getAnswerClass(index)}
								onclick={() => selectAnswer(index)}
								disabled={hasAnswered}
							>
								{#if !questionMentionsPokemon}
									<img
										src={answer.pokemon.image}
										alt={hasAnswered ? answer.pokemon.name : 'Pokemon option'}
										class="w-12 h-12 object-contain flex-shrink-0"
									/>
								{/if}
								<span class="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
								<span class="flex-1">{answer.text}</span>
								{#if hasAnswered && currentTemplate}
									<span class="text-sm opacity-70 ml-auto">
										{answer.pokemon.tags[currentTemplate.primaryAttribute] || 'N/A'}
									</span>
								{/if}
							</button>
						{/each}
					</div>

					<!-- Time out message -->
					{#if viewState === 'question-result' && selectedAnswerIndex === null}
						<p class="text-center text-error mt-4">You ran out of time!</p>
					{/if}

					<!-- Next button (shown after answering) -->
					{#if viewState === 'question-result'}
						<div class="card-actions justify-center mt-6">
							<button class="btn btn-primary btn-lg" onclick={nextQuestion}>
								{currentQuestionIndex + 1 >= totalQuestions ? 'See Results' : 'Next Question'}
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
					{#if correctAnswers === totalQuestions}
						<div class="text-6xl mb-2">🏆</div>
						<h2 class="card-title text-success text-2xl">Perfect Score!</h2>
					{:else if correctAnswers >= totalQuestions / 2}
						<div class="text-6xl mb-2">🎉</div>
						<h2 class="card-title text-primary text-2xl">Good Job!</h2>
					{:else}
						<div class="text-6xl mb-2">📚</div>
						<h2 class="card-title text-warning text-2xl">Keep Learning!</h2>
					{/if}

					<div
						class={classNames('badge mt-2', {
							'badge-success': selectedDifficulty === 'easy',
							'badge-error': selectedDifficulty === 'hard'
						})}
					>
						{DIFFICULTY_CONFIG[selectedDifficulty].label} Mode
					</div>

					<p class="text-base-content/70 mt-2">
						You answered {correctAnswers} out of {totalQuestions} questions correctly.
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
								{Math.round((correctAnswers / totalQuestions) * 100)}%
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
