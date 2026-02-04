<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';

	interface Answer {
		text: string;
		pokemon: { name: string; image: string };
		isCorrect: boolean;
	}

	interface Props {
		answer: Answer;
		index: number;
		isSelected: boolean;
		hasAnswered: boolean;
		showPokemonImage: boolean;
		primaryAttribute?: string;
		attributeValue?: string;
	}

	let {
		answer,
		index,
		isSelected,
		hasAnswered,
		showPokemonImage,
		primaryAttribute,
		attributeValue
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		select: number;
	}>();

	let buttonClass = $derived.by(() => {
		if (!hasAnswered) {
			return classNames(
				'btn btn-lg btn-block justify-start text-left h-auto py-4 px-6',
				'bg-base-200 hover:bg-base-300 border-2 border-base-300'
			);
		}

		return classNames('btn btn-lg btn-block justify-start text-left h-auto py-4 px-6 border-2', {
			'bg-success text-success-content border-success': answer.isCorrect,
			'bg-error text-error-content border-error': isSelected && !answer.isCorrect,
			'bg-base-200 border-base-300 opacity-50': !isSelected && !answer.isCorrect
		});
	});
</script>

<button class={buttonClass} onclick={() => dispatch('select', index)} disabled={hasAnswered}>
	{#if showPokemonImage}
		<img
			src={answer.pokemon.image}
			alt={hasAnswered ? answer.pokemon.name : 'Pokemon option'}
			class="h-12 w-12 flex-shrink-0 object-contain"
		/>
	{/if}
	<span class="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
	<span class="flex-1">{answer.text}</span>
	{#if hasAnswered && primaryAttribute && attributeValue}
		<span class="ml-auto text-sm opacity-70">{attributeValue}</span>
	{/if}
</button>
