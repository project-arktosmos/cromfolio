<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import { getActivePokemonTriviaTemplatesV2 } from '$services/pokemon-trivia-templates.service';
	import { getTagsBySticker, type PokemonWithTags } from '$services/tags.service';
	import { triviaStatsService, updateStatsAfterGame } from '$services/pokemon-trivia-game.service';
	import {
		replacePlaceholders,
		getAnswerValue,
		shuffleArray,
		selectAnswers
	} from '$utils/pokemon-trivia';
	import type { Collection } from '$types/collection.type';
	import type { PokemonTriviaTemplateV2, TemplateType } from '$types/pokemon-trivia-template.type';
	import type {
		TriviaViewState,
		GameDifficulty,
		TriviaStats,
		DifficultyConfig
	} from '$types/game-state.type';

	// Child components
	import TriviaHeader from './components/TriviaHeader.svelte';
	import CollectionSelect from './components/CollectionSelect.svelte';
	import DifficultySelect from './components/DifficultySelect.svelte';
	import GamePlayHeader from './components/GamePlayHeader.svelte';
	import TimerBar from './components/TimerBar.svelte';
	import QuestionCard from './components/QuestionCard.svelte';
	import GameOver from './components/GameOver.svelte';

	// Difficulty configuration (matches original game settings)
	const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
		easy: {
			questions: 3,
			timePerQuestion: 10,
			answerCount: 3,
			label: 'Easy',
			description: '3 questions, 10s each'
		},
		hard: {
			questions: 5,
			timePerQuestion: 5,
			answerCount: 4,
			label: 'Hard',
			description: '5 questions, 5s each'
		}
	};

	// View state
	let viewState = $state<TriviaViewState>('collection-select');
	let isLoading = $state(true);

	// Data
	let collections: Collection[] = $state([]);
	let collectionStickerCounts = $state<Map<string, number>>(new Map());
	let templates: PokemonTriviaTemplateV2[] = $state([]);

	// Game configuration
	let selectedCollection = $state<Collection | null>(null);
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

	// Stats from service
	let stats = $state<TriviaStats>(triviaStatsService.get());

	// Derived values
	let difficultyConfig = $derived(DIFFICULTY_CONFIGS[selectedDifficulty]);
	let totalQuestions = $derived(difficultyConfig.questions);
	let wrongAnswerCount = $derived(difficultyConfig.answerCount - 1);
	let timePerQuestion = $derived(difficultyConfig.timePerQuestion);

	let headerSubtitle = $derived.by(() => {
		switch (viewState) {
			case 'collection-select':
				return 'Select a collection to start the trivia game';
			case 'difficulty-select':
				return 'Choose your difficulty';
			case 'playing':
				return `Question ${currentQuestionIndex + 1} of ${totalQuestions}`;
			case 'question-result':
				if (selectedAnswerIndex === null) return "Time's up!";
				return currentAnswers[selectedAnswerIndex]?.isCorrect ? 'Correct!' : 'Wrong!';
			case 'game-over':
				return 'Game Over!';
			default:
				return '';
		}
	});

	onMount(async () => {
		if (browser) stats = triviaStatsService.get();

		collections = await getAllCollections();
		const counts = new Map<string, number>();
		for (const collection of collections) {
			const stickers = await getStickersForCollection(collection.id);
			counts.set(String(collection.id), stickers.length);
		}
		collectionStickerCounts = counts;
		templates = await getActivePokemonTriviaTemplatesV2();
		isLoading = false;
	});

	onDestroy(() => stopTimer());

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

	function handleCollectionSelect(event: CustomEvent<Collection>) {
		selectedCollection = event.detail;
		viewState = 'difficulty-select';
	}

	async function handleDifficultySelect(event: CustomEvent<GameDifficulty>) {
		selectedDifficulty = event.detail;
		isLoading = true;
		pokemonPool = await loadPokemonForCollection(selectedCollection!.id);
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
		currentQuestion = replacePlaceholders(selectedTemplate.questionTemplate, correctPokemon);
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
		if (currentAnswers[event.detail].isCorrect) correctAnswers++;
		else wrongAnswers++;
		viewState = 'question-result';
	}

	function handleNextQuestion() {
		currentQuestionIndex++;
		if (currentQuestionIndex >= totalQuestions) {
			updateStatsAfterGame(correctAnswers, wrongAnswers, 0);
			stats = triviaStatsService.get();
			viewState = 'game-over';
		} else {
			generateQuestion();
			startTimer();
			viewState = 'playing';
		}
	}

	function handlePlayAgain() {
		viewState = 'difficulty-select';
	}

	function handleBackToCollections() {
		stopTimer();
		viewState = 'collection-select';
		selectedCollection = null;
		pokemonPool = [];
		resetGameState();
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
	}
</script>

<div class="space-y-6">
	<TriviaHeader title="Pokemon Trivia" subtitle={headerSubtitle} {stats} />

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if viewState === 'collection-select'}
		<CollectionSelect
			{collections}
			{collectionStickerCounts}
			hasTemplates={templates.length > 0}
			on:select={handleCollectionSelect}
		/>
	{:else if viewState === 'difficulty-select' && selectedCollection}
		<DifficultySelect
			collectionTitle={selectedCollection.title}
			configs={DIFFICULTY_CONFIGS}
			on:select={handleDifficultySelect}
			on:back={handleBackToCollections}
		/>
	{:else if viewState === 'playing' || viewState === 'question-result'}
		<div class="flex flex-col items-center gap-6">
			<GamePlayHeader
				{currentQuestionIndex}
				{totalQuestions}
				{correctAnswers}
				{wrongAnswers}
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
				isLastQuestion={currentQuestionIndex + 1 >= totalQuestions}
				on:answer={handleAnswer}
				on:next={handleNextQuestion}
			/>
		</div>
	{:else if viewState === 'game-over'}
		<GameOver
			{correctAnswers}
			{wrongAnswers}
			{totalQuestions}
			difficulty={selectedDifficulty}
			{difficultyConfig}
			on:playAgain={handlePlayAgain}
			on:changeCollection={handleBackToCollections}
		/>
	{/if}
</div>
