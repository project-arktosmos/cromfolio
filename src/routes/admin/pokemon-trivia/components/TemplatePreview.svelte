<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import { TEMPLATE_TYPE_INFO, POKEMON_ATTRIBUTES, type TemplateType } from '$types/pokemon-trivia-template.type';
	import {
		getRandomPokemonWithTags,
		getRandomPokemonByGeneration,
		type PokemonWithTags
	} from '$services/tags.service';
	import { selectAnswers } from '$utils/pokemon-trivia/answer-selection';
	import {
		replacePlaceholders,
		getAnswerValue as getAnswerValueUtil,
		getRelevantStat as getRelevantStatUtil,
		shuffleArray
	} from '$utils/pokemon-trivia/template-processing';
	import { shouldShowStatsForType } from '$utils/pokemon-trivia/attributes';

	interface Props {
		templateType: TemplateType;
		questionTemplate: string;
		answerTemplate: string;
		primaryAttribute?: string;
	}

	let { templateType, questionTemplate, answerTemplate, primaryAttribute = '' }: Props = $props();

	// Pokemon data state
	let correctPokemon = $state<PokemonWithTags | null>(null);
	let wrongPokemon = $state<PokemonWithTags[]>([]);
	let isLoading = $state(true);
	let shuffledOptions = $state<{ pokemon: PokemonWithTags; isCorrect: boolean }[]>([]);
	let validationMessage = $state<string>('');

	onMount(async () => {
		await loadRandomPokemon();
	});

	async function loadRandomPokemon() {
		isLoading = true;
		validationMessage = '';

		// Get a random starting Pokemon
		const seedPokemon = await getRandomPokemonWithTags();
		if (!seedPokemon) {
			isLoading = false;
			return;
		}

		// Get many candidates from the same generation
		const generation = seedPokemon.tags['generation'] || '1';
		const candidates = await getRandomPokemonByGeneration(generation, '', 15);

		// Add the seed Pokemon to candidates if not already there
		if (!candidates.find((c) => c.id === seedPokemon.id)) {
			candidates.unshift(seedPokemon);
		}

		// Select correct and wrong Pokemon based on template type using utility
		const { correct, wrong, message } = selectAnswers(
			candidates,
			templateType,
			primaryAttribute,
			questionTemplate
		);

		if (!correct) {
			// Fallback: use seed Pokemon
			correctPokemon = seedPokemon;
			wrongPokemon = candidates.filter((c) => c.id !== seedPokemon.id).slice(0, 3);
			validationMessage = 'Could not validate answers for this template type';
		} else {
			correctPokemon = correct;
			wrongPokemon = wrong;
			validationMessage = message;
		}

		shuffleOptions();
		isLoading = false;
	}

	function shuffleOptions() {
		if (!correctPokemon) return;

		const options = [
			{ pokemon: correctPokemon, isCorrect: true },
			...wrongPokemon.map((p) => ({ pokemon: p, isCorrect: false }))
		];

		shuffledOptions = shuffleArray(options);
	}

	// Wrapper for getAnswerValue to use component's answerTemplate
	function getAnswerValue(pokemon: PokemonWithTags | null): string {
		return getAnswerValueUtil(pokemon, answerTemplate);
	}

	// Wrapper for getRelevantStat to use component's primaryAttribute
	function getRelevantStat(pokemon: PokemonWithTags): string | null {
		return getRelevantStatUtil(pokemon, primaryAttribute);
	}

	// Check if we should show stats
	let shouldShowStats = $derived(
		answerTemplate.trim() === '{name}' &&
			primaryAttribute &&
			shouldShowStatsForType(templateType)
	);

	// Get the attribute label for display
	let attributeLabel = $derived(
		primaryAttribute && POKEMON_ATTRIBUTES[primaryAttribute]
			? POKEMON_ATTRIBUTES[primaryAttribute].label
			: primaryAttribute
	);

	let previewQuestion = $derived(replacePlaceholders(questionTemplate, correctPokemon));
	let previewAnswer = $derived(getAnswerValue(correctPokemon));

	// Reactively reload when template type or primary attribute changes
	$effect(() => {
		if (templateType || primaryAttribute) {
			loadRandomPokemon();
		}
	});
</script>

<div class="bg-base-300 rounded-lg p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="font-semibold text-sm">Live Preview</h3>
		<div class="flex items-center gap-2">
			{#if templateType && TEMPLATE_TYPE_INFO[templateType]}
				<span class="badge badge-sm"
					>{TEMPLATE_TYPE_INFO[templateType].icon}
					{TEMPLATE_TYPE_INFO[templateType].label}</span
				>
			{/if}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => loadRandomPokemon()}
				disabled={isLoading}
				title="Load new random Pokemon"
			>
				🔄
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-4">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else if !correctPokemon}
		<div class="text-center text-base-content/50 py-4">
			<p>No Pokemon data available.</p>
			<p class="text-sm mt-1">Make sure Pokemon stickers are imported.</p>
		</div>
	{:else if questionTemplate || answerTemplate}
		<div class="space-y-3">
			<!-- Question -->
			<div>
				<div class="text-xs text-base-content/60 mb-1">Question</div>
				<div class="font-medium text-sm bg-base-100 p-2 rounded">
					{previewQuestion || 'No question template'}
				</div>
			</div>

			<!-- Answer Options (multiple choice style) -->
			<div>
				<div class="text-xs text-base-content/60 mb-1">
					Options
					{#if shouldShowStats && attributeLabel}
						<span class="text-info ml-1">(showing {attributeLabel} for verification)</span>
					{/if}
				</div>
				<div class="grid grid-cols-2 gap-2">
					{#each shuffledOptions as option, index}
						{@const stat = getRelevantStat(option.pokemon)}
						<div
							class={classNames('p-2 rounded text-sm border-2 transition-colors', {
								'bg-success/20 border-success': option.isCorrect,
								'bg-base-100 border-base-300': !option.isCorrect
							})}
						>
							<div class="flex items-center justify-between">
								<div>
									<span class="font-mono text-xs text-base-content/50 mr-2"
										>{String.fromCharCode(65 + index)}.</span
									>
									<span class={option.isCorrect ? 'font-semibold' : ''}>
										{getAnswerValue(option.pokemon)}
									</span>
									{#if option.isCorrect}
										<span class="text-success ml-1">✓</span>
									{/if}
								</div>
								{#if shouldShowStats && stat}
									<span
										class={classNames('text-xs px-1.5 py-0.5 rounded', {
											'bg-success/30 text-success-content font-semibold': option.isCorrect,
											'bg-base-200 text-base-content/70': !option.isCorrect
										})}
									>
										{stat}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Validation Message -->
			{#if validationMessage}
				<div
					class={classNames('text-xs p-2 rounded', {
						'bg-success/10 text-success': validationMessage.startsWith('✓'),
						'bg-warning/10 text-warning': validationMessage.startsWith('⚠️'),
						'bg-error/10 text-error': !validationMessage.startsWith('✓') && !validationMessage.startsWith('⚠️')
					})}
				>
					{validationMessage}
				</div>
			{/if}

			<!-- Correct Answer (explicit) -->
			<div>
				<div class="text-xs text-base-content/60 mb-1">Correct Answer</div>
				<div
					class="font-medium text-sm text-success bg-base-100 p-2 rounded flex items-center justify-between"
				>
					<span>→ {previewAnswer || 'No answer template'}</span>
					{#if shouldShowStats && correctPokemon}
						{@const correctStat = getRelevantStat(correctPokemon)}
						{#if correctStat}
							<span class="text-xs bg-success/20 px-2 py-0.5 rounded">{correctStat}</span>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-content/10">
			<div class="text-xs text-base-content/50">
				Preview uses: <strong>{correctPokemon.name}</strong>
				(Gen {correctPokemon.tags['generation'] || '?'})
			</div>
		</div>
	{:else}
		<div class="text-center text-base-content/50 py-4">
			<p>Enter question and answer templates to see a preview</p>
		</div>
	{/if}
</div>
