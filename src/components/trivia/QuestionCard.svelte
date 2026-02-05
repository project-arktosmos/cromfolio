<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import AnswerButton from '$components/trivia/AnswerButton.svelte';
	import type { PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';

	interface Answer {
		text: string;
		pokemon: { name: string; image: string; tags?: Record<string, string> };
		isCorrect: boolean;
	}

	interface CorrectPokemon {
		name: string;
		image: string;
	}

	interface Props {
		question: string;
		answers: Answer[];
		correctPokemon: CorrectPokemon | null;
		template: PokemonTriviaTemplateV2 | null;
		selectedAnswerIndex: number | null;
		hasAnswered: boolean;
		isGameOver: boolean;
	}

	let {
		question,
		answers,
		correctPokemon,
		template,
		selectedAnswerIndex,
		hasAnswered,
		isGameOver
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		answer: number;
		next: void;
	}>();

	// Check if the question mentions the Pokemon by name (e.g., "What is Cyndaquil's...")
	let questionMentionsPokemon = $derived(template?.questionTemplate?.includes('{name}') ?? false);

	function handleAnswerSelect(event: CustomEvent<number>) {
		dispatch('answer', event.detail);
	}
</script>

<div class="card bg-base-200 w-full max-w-3xl">
	<div class="card-body">
		<!-- Pokemon image when the question mentions the Pokemon by name -->
		{#if questionMentionsPokemon && correctPokemon}
			<div class="mb-4 flex justify-center">
				<img
					src={correctPokemon.image}
					alt={correctPokemon.name}
					class="h-32 w-32 object-contain"
				/>
			</div>
		{/if}

		<h2 class="card-title justify-center text-center text-xl">{question}</h2>

		<!-- Answer buttons -->
		<div class="mt-6 flex flex-col gap-3">
			{#each answers as answer, index (index)}
				<AnswerButton
					{answer}
					{index}
					isSelected={selectedAnswerIndex === index}
					{hasAnswered}
					showPokemonImage={!questionMentionsPokemon}
					primaryAttribute={template?.primaryAttribute}
					attributeValue={hasAnswered && template
						? (answer.pokemon.tags?.[template.primaryAttribute] ?? 'N/A')
						: undefined}
					on:select={handleAnswerSelect}
				/>
			{/each}
		</div>

		<!-- Time out message -->
		{#if hasAnswered && selectedAnswerIndex === null}
			<p class="text-error mt-4 text-center">You ran out of time!</p>
		{/if}

		<!-- Next button (shown after answering) -->
		{#if hasAnswered}
			<div class="card-actions mt-6 justify-center">
				<button class="btn btn-primary btn-lg" onclick={() => dispatch('next')}>
					{isGameOver ? 'See Results' : 'Next Question'}
				</button>
			</div>
		{/if}
	</div>
</div>
