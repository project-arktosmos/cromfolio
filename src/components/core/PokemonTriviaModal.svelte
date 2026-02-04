<script lang="ts">
	import { onDestroy } from 'svelte';
	import classNames from 'classnames';
	import { triviaModalService } from '$services/trivia-modal.service';
	import { getStickersForCollection } from '$services/collections.service';
	import { getActivePokemonTriviaTemplatesV2 } from '$services/pokemon-trivia-templates.service';
	import { getTagsBySticker, type PokemonWithTags } from '$services/tags.service';
	import { getTriviaStats, updateStatsAfterGame } from '$services/pokemon-trivia-game.service';
	import { awardUserBoosterPacksBatch } from '$services/user-booster-packs.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import {
		replacePlaceholders,
		getAnswerValue,
		shuffleArray,
		selectAnswers
	} from '$utils/pokemon-trivia';
	import type { PokemonTriviaTemplateV2, TemplateType } from '$types/pokemon-trivia-template.type';
	import type {
		TriviaViewState,
		GameDifficulty,
		TriviaStats,
		DifficultyConfig
	} from '$types/game-state.type';

	// Import trivia components
	import DifficultySelect from '$components/trivia/DifficultySelect.svelte';
	import GamePlayHeader from '$components/trivia/GamePlayHeader.svelte';
	import TimerBar from '$components/trivia/TimerBar.svelte';
	import QuestionCard from '$components/trivia/QuestionCard.svelte';
	import GameOver from '$components/trivia/GameOver.svelte';

	// Difficulty configuration - lives-based gameplay
	const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
		easy: {
			maxLives: 3,
			timePerQuestion: 10,
			answerCount: 3,
			label: 'Easy',
			description: '3 lives, 10s per question'
		},
		hard: {
			maxLives: 1,
			timePerQuestion: 5,
			answerCount: 4,
			label: 'Hard',
			description: '1 life, 5s per question'
		}
	};

	// Subscribe to modal state
	let modalState = $state($triviaModalService);
	$effect(() => {
		const unsubscribe = triviaModalService.subscribe((state) => {
			modalState = state;
			if (state.isOpen && state.collection) {
				initializeGame();
			}
		});
		return unsubscribe;
	});

	// View state (starts at difficulty-select since collection is already chosen)
	let viewState = $state<TriviaViewState>('difficulty-select');
	let isLoading = $state(false);

	// Data
	let templates: PokemonTriviaTemplateV2[] = $state([]);

	// Game configuration
	let selectedDifficulty = $state<GameDifficulty>('easy');
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

	// Booster pack state
	let boosterPacksClaimed = $state(false);
	let earnedPacksCount = $state(0); // Packs earned this game (saved to DB)

	// Stats from service (loaded async)
	let stats = $state<TriviaStats>({
		id: 'pokemon-trivia-stats',
		totalGamesPlayed: 0,
		totalCorrect: 0,
		totalWrong: 0,
		bestStreak: 0,
		longestGame: 0
	});

	// Derived values
	let difficultyConfig = $derived(DIFFICULTY_CONFIGS[selectedDifficulty]);
	let maxLives = $derived(difficultyConfig.maxLives);
	let livesRemaining = $derived(maxLives - wrongAnswers);
	let wrongAnswerCount = $derived(difficultyConfig.answerCount - 1);
	let timePerQuestion = $derived(difficultyConfig.timePerQuestion);
	let isGameOver = $derived(wrongAnswers >= maxLives);

	onDestroy(() => stopTimer());

	async function initializeGame() {
		isLoading = true;
		viewState = 'difficulty-select';
		resetGameState();
		templates = await getActivePokemonTriviaTemplatesV2();
		stats = await getTriviaStats();
		isLoading = false;
	}

	async function loadPokemonForCollection(
		collectionId: string | number
	): Promise<PokemonWithTags[]> {
		const stickers = await getStickersForCollection(collectionId);
		const pokemonList: PokemonWithTags[] = [];
		for (const sticker of stickers) {
			const tags = await getTagsBySticker(sticker.id);
			const tagsMap: Record<string, string> = {};
			for (const tag of tags) {
				if (!tagsMap[tag.key]) tagsMap[tag.key] = tag.value;
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

	async function handleDifficultySelect(event: CustomEvent<GameDifficulty>) {
		if (!modalState.collection) return;
		selectedDifficulty = event.detail;
		isLoading = true;
		pokemonPool = await loadPokemonForCollection(modalState.collection.id);
		resetGameState();
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
			if (timeRemaining <= 0) handleTimeOut();
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
		selectedAnswerIndex = null;
		wrongAnswers++;
		viewState = 'question-result';
	}

	function generateQuestion() {
		if (pokemonPool.length < 4 || templates.length === 0) {
			viewState = 'game-over';
			return;
		}

		const shuffledPool = shuffleArray(pokemonPool);
		let selectedTemplate: PokemonTriviaTemplateV2 | null = null;
		let selectionResult: ReturnType<typeof selectAnswers> | null = null;

		const weightedTemplates = templates.flatMap((t) =>
			Array(Math.max(1, Math.min(t.weight, 10))).fill(t)
		);
		const shuffledTemplates = shuffleArray(weightedTemplates);

		for (const template of shuffledTemplates) {
			const pokemonWithAttr = shuffledPool.filter(
				(p) => p.tags[template.primaryAttribute] !== undefined
			);
			if (pokemonWithAttr.length < 4) continue;

			const result = selectAnswers(
				shuffleArray(pokemonWithAttr),
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

		if (!selectedTemplate || !selectionResult || !selectionResult.correct) {
			generateSimpleQuestion(shuffledPool);
			return;
		}

		currentTemplate = selectedTemplate;
		correctPokemon = selectionResult.correct;

		// For negation questions, use targetValue for placeholder replacement instead of correct Pokemon's value
		// This ensures "Which is NOT Fire type?" shows "Fire" (the target), not the correct Pokemon's type
		if (selectedTemplate.templateType === 'negation' && selectionResult.targetValue) {
			const pokemonWithTargetValue = {
				...correctPokemon,
				tags: { ...correctPokemon.tags, [selectedTemplate.primaryAttribute]: selectionResult.targetValue }
			};
			currentQuestion = replacePlaceholders(selectedTemplate.questionTemplate, pokemonWithTargetValue);
		} else {
			currentQuestion = replacePlaceholders(selectedTemplate.questionTemplate, correctPokemon);
		}

		const correctAnswerText = getAnswerValue(correctPokemon, selectedTemplate.answerTemplate);

		const wrongAnswersList = selectionResult.wrong.slice(0, wrongAnswerCount);
		currentAnswers = shuffleArray([
			{ text: correctAnswerText, pokemon: correctPokemon, isCorrect: true },
			...wrongAnswersList.map((p) => ({
				text: getAnswerValue(p, selectedTemplate!.answerTemplate),
				pokemon: p,
				isCorrect: false
			}))
		]);
		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function generateSimpleQuestion(pool: PokemonWithTags[]) {
		correctPokemon = pool[0];
		currentTemplate = null;
		currentQuestion = 'Which Pokemon is shown in the image?';

		const wrongPokemon = pool.filter((p) => p.id !== correctPokemon!.id).slice(0, wrongAnswerCount);
		currentAnswers = shuffleArray([
			{ text: correctPokemon.name, pokemon: correctPokemon, isCorrect: true },
			...wrongPokemon.map((p) => ({ text: p.name, pokemon: p, isCorrect: false }))
		]);
		selectedAnswerIndex = null;
		hasAnswered = false;
	}

	function handleAnswer(event: CustomEvent<number>) {
		if (hasAnswered) return;
		stopTimer();
		selectedAnswerIndex = event.detail;
		hasAnswered = true;
		if (currentAnswers[event.detail].isCorrect) {
			correctAnswers++;
		} else {
			wrongAnswers++;
		}
		viewState = 'question-result';
	}

	async function handleNextQuestion() {
		// Check if game is over (ran out of lives)
		if (wrongAnswers >= maxLives) {
			stats = await updateStatsAfterGame(correctAnswers, wrongAnswers, 0);

			// Award booster packs to database (1 per 3 correct answers)
			earnedPacksCount = Math.floor(correctAnswers / 3);
			if (earnedPacksCount > 0 && modalState.collection) {
				await awardUserBoosterPacksBatch(
					earnedPacksCount,
					modalState.collection.id,
					'pokemon-trivia'
				);
			}

			viewState = 'game-over';
		} else {
			currentQuestionIndex++;
			generateQuestion();
			startTimer();
			viewState = 'playing';
		}
	}

	function handlePlayAgain() {
		viewState = 'difficulty-select';
	}

	function handleClose() {
		stopTimer();
		triviaModalService.close();
	}

	function handleQuit() {
		stopTimer();
		viewState = 'difficulty-select';
		pokemonPool = [];
		resetGameState();
	}

	function resetGameState() {
		currentQuestionIndex = 0;
		correctAnswers = 0;
		wrongAnswers = 0;
		boosterPacksClaimed = false;
		earnedPacksCount = 0;
	}

	function handleClaimBoosterPacks(event: CustomEvent<{ packCount: number }>) {
		if (!modalState.collection) return;
		const packCount = event.detail.packCount;
		boosterPackModalService.open(modalState.collection.id, packCount, 'pokemon-trivia');
		boosterPacksClaimed = true;
	}

	function getSubtitle(): string {
		switch (viewState) {
			case 'difficulty-select':
				return 'Choose your difficulty';
			case 'playing':
				return `Question ${currentQuestionIndex + 1}`;
			case 'question-result':
				if (selectedAnswerIndex === null) return "Time's up!";
				return currentAnswers[selectedAnswerIndex]?.isCorrect ? 'Correct!' : 'Wrong!';
			case 'game-over':
				return 'Game Over!';
			default:
				return '';
		}
	}
</script>

{#if modalState.isOpen && modalState.collection}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleClose}
		role="dialog"
		aria-modal="true"
		aria-labelledby="trivia-modal-title"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-base-100 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="bg-base-200 flex items-center justify-between border-b p-4">
				<div>
					<h3 id="trivia-modal-title" class="text-xl font-bold">
						Pokemon Trivia - {modalState.collection.title}
					</h3>
					<p class="text-base-content/70 text-sm">{getSubtitle()}</p>
				</div>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={handleClose} aria-label="Close">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if isLoading}
					<div class="flex justify-center p-8">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else if viewState === 'difficulty-select'}
					<DifficultySelect
						collectionTitle={modalState.collection.title}
						configs={DIFFICULTY_CONFIGS}
						on:select={handleDifficultySelect}
						on:back={handleClose}
					/>
				{:else if viewState === 'playing' || viewState === 'question-result'}
					<div class="flex flex-col items-center gap-6">
						<GamePlayHeader
							{currentQuestionIndex}
							{livesRemaining}
							{maxLives}
							{correctAnswers}
							difficulty={selectedDifficulty}
							{difficultyConfig}
							on:quit={handleQuit}
						/>

						{#if viewState === 'playing'}
							<TimerBar {timeRemaining} totalTime={timePerQuestion} />
						{/if}

						<QuestionCard
							question={currentQuestion}
							answers={currentAnswers}
							{correctPokemon}
							template={currentTemplate}
							{selectedAnswerIndex}
							{hasAnswered}
							{isGameOver}
							on:answer={handleAnswer}
							on:next={handleNextQuestion}
						/>
					</div>
				{:else if viewState === 'game-over'}
					<GameOver
						{correctAnswers}
						difficulty={selectedDifficulty}
						{difficultyConfig}
						{boosterPacksClaimed}
						on:playAgain={handlePlayAgain}
						on:claimBoosterPacks={handleClaimBoosterPacks}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}
