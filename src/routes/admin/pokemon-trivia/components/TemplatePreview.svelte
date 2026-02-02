<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import {
		TEMPLATE_TYPE_INFO,
		POKEMON_ATTRIBUTES,
		type TemplateType
	} from '$types/pokemon-trivia-template.type';
	import {
		getRandomPokemonWithTags,
		getRandomPokemonByGeneration,
		type PokemonWithTags
	} from '$services/tags.service';

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

		// Select correct and wrong Pokemon based on template type
		const { correct, wrong, message } = selectAnswers(candidates);

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

	/**
	 * Select the correct Pokemon and wrong alternatives based on template type
	 */
	function selectAnswers(candidates: PokemonWithTags[]): {
		correct: PokemonWithTags | null;
		wrong: PokemonWithTags[];
		message: string;
	} {
		if (!primaryAttribute || candidates.length < 4) {
			return { correct: null, wrong: [], message: 'Not enough candidates' };
		}

		const attrInfo = POKEMON_ATTRIBUTES[primaryAttribute];
		const isNumeric = attrInfo?.type === 'number';

		// For superlative/comparison: find highest or lowest
		if (['superlative', 'comparison'].includes(templateType)) {
			return selectSuperlativeAnswers(candidates, isNumeric);
		}

		// For reverse_lookup: correct has the attribute, wrong don't
		if (templateType === 'reverse_lookup') {
			return selectReverseLookupAnswers(candidates);
		}

		// For negation: correct does NOT have the attribute, wrong DO have it
		if (templateType === 'negation') {
			return selectNegationAnswers(candidates);
		}

		// For range: correct is within range criteria
		if (templateType === 'range') {
			return selectRangeAnswers(candidates, isNumeric);
		}

		// For type_effectiveness: similar to reverse_lookup
		if (templateType === 'type_effectiveness') {
			return selectTypeEffectivenessAnswers(candidates);
		}

		// For simple_match and others: just pick randomly
		return {
			correct: candidates[0],
			wrong: candidates.slice(1, 4),
			message: ''
		};
	}

	/**
	 * For superlative/comparison: find the Pokemon with highest/lowest stat
	 */
	function selectSuperlativeAnswers(
		candidates: PokemonWithTags[],
		isNumeric: boolean
	): { correct: PokemonWithTags | null; wrong: PokemonWithTags[]; message: string } {
		if (!isNumeric) {
			return { correct: candidates[0], wrong: candidates.slice(1, 4), message: '' };
		}

		// Determine if we're looking for max or min based on question
		const questionLower = questionTemplate.toLowerCase();
		const isMin =
			questionLower.includes('lowest') ||
			questionLower.includes('least') ||
			questionLower.includes('slowest') ||
			questionLower.includes('shortest') ||
			questionLower.includes('lightest') ||
			questionLower.includes('weakest') ||
			questionLower.includes('earliest') ||
			questionLower.includes('last in battle');

		// Sort by the attribute value
		const withValues = candidates
			.filter((c) => c.tags[primaryAttribute] !== undefined)
			.map((c) => ({
				pokemon: c,
				value: parseFloat(c.tags[primaryAttribute]) || 0
			}))
			.sort((a, b) => (isMin ? a.value - b.value : b.value - a.value));

		if (withValues.length < 4) {
			return { correct: null, wrong: [], message: 'Not enough Pokemon with this stat' };
		}

		// The first one (after sorting) is the correct answer
		const correct = withValues[0].pokemon;

		// Pick 3 others that have different values (to avoid ties being "wrong")
		const wrong: PokemonWithTags[] = [];
		for (let i = 1; i < withValues.length && wrong.length < 3; i++) {
			// Skip if same value as correct (would be a tie)
			if (withValues[i].value !== withValues[0].value) {
				wrong.push(withValues[i].pokemon);
			}
		}

		const correctValue = withValues[0].value;
		const direction = isMin ? 'lowest' : 'highest';
		return {
			correct,
			wrong,
			message: `✓ ${correct.name} has ${direction} ${primaryAttribute}: ${correctValue}`
		};
	}

	/**
	 * For reverse_lookup: correct Pokemon HAS the attribute value from the question
	 */
	function selectReverseLookupAnswers(candidates: PokemonWithTags[]): {
		correct: PokemonWithTags | null;
		wrong: PokemonWithTags[];
		message: string;
	} {
		// The question template contains the attribute value to match
		// e.g., "Which of these Pokemon is {type} type?" where {type} will be replaced
		// We need to find Pokemon that have/don't have this attribute

		// Pick a random Pokemon as correct - it has some value for this attribute
		const withAttribute = candidates.filter(
			(c) => c.tags[primaryAttribute] !== undefined && c.tags[primaryAttribute] !== ''
		);
		if (withAttribute.length === 0) {
			return { correct: null, wrong: [], message: 'No Pokemon with this attribute' };
		}

		const correct = withAttribute[Math.floor(Math.random() * withAttribute.length)];
		const correctValue = correct.tags[primaryAttribute];

		// Wrong answers: Pokemon that DON'T have the same attribute value
		const wrong = candidates
			.filter((c) => c.id !== correct.id && c.tags[primaryAttribute] !== correctValue)
			.slice(0, 3);

		if (wrong.length < 3) {
			// Not enough differentiated options, just use others
			const fallbackWrong = candidates.filter((c) => c.id !== correct.id).slice(0, 3);
			return {
				correct,
				wrong: fallbackWrong,
				message: `⚠️ Some wrong options may share the attribute`
			};
		}

		return {
			correct,
			wrong,
			message: `✓ Only ${correct.name} has ${primaryAttribute}: ${correctValue}`
		};
	}

	/**
	 * For negation: correct Pokemon does NOT have the attribute, wrong DO have it
	 */
	function selectNegationAnswers(candidates: PokemonWithTags[]): {
		correct: PokemonWithTags | null;
		wrong: PokemonWithTags[];
		message: string;
	} {
		// Extract what we're negating from the question
		// e.g., "Which of these Pokemon is NOT Water type?" → looking for non-Water

		// For type-based negation, we need to pick:
		// - Correct: a Pokemon that is NOT the specified type
		// - Wrong: Pokemon that ARE the specified type

		// First, find what type/value we're looking for in the question
		// This is tricky without more context, so we'll use a simpler approach:
		// Pick a value that MOST candidates have, then find one that doesn't

		const valueCounts: Record<string, number> = {};
		for (const c of candidates) {
			const val = c.tags[primaryAttribute];
			if (val) {
				valueCounts[val] = (valueCounts[val] || 0) + 1;
			}
		}

		// Find the most common value
		const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
		if (sortedValues.length === 0) {
			return { correct: null, wrong: [], message: 'No attribute values found' };
		}

		const targetValue = sortedValues[0][0];

		// Correct: Pokemon that does NOT have this value
		const withoutValue = candidates.filter((c) => c.tags[primaryAttribute] !== targetValue);
		// Wrong: Pokemon that DO have this value
		const withValue = candidates.filter((c) => c.tags[primaryAttribute] === targetValue);

		if (withoutValue.length === 0 || withValue.length < 3) {
			return { correct: null, wrong: [], message: 'Cannot find enough differentiated options' };
		}

		const correct = withoutValue[Math.floor(Math.random() * withoutValue.length)];
		const wrong = withValue.slice(0, 3);

		return {
			correct,
			wrong,
			message: `✓ ${correct.name} is NOT ${targetValue}, others are`
		};
	}

	/**
	 * For range: correct is within the range, wrong are outside
	 */
	function selectRangeAnswers(
		candidates: PokemonWithTags[],
		isNumeric: boolean
	): { correct: PokemonWithTags | null; wrong: PokemonWithTags[]; message: string } {
		if (!isNumeric) {
			return { correct: candidates[0], wrong: candidates.slice(1, 4), message: '' };
		}

		// Parse the question to understand the range
		// e.g., "over 100", "below 40", "between 500 and 600"
		const questionLower = questionTemplate.toLowerCase();

		let threshold = 100; // default
		let isAbove = true;

		// Try to extract numbers from question
		const numbers = questionTemplate.match(/\d+/g);
		if (numbers && numbers.length > 0) {
			threshold = parseInt(numbers[0]);
		}

		if (
			questionLower.includes('below') ||
			questionLower.includes('under') ||
			questionLower.includes('less than') ||
			questionLower.includes('shorter than') ||
			questionLower.includes('lighter than')
		) {
			isAbove = false;
		}

		const withValues = candidates
			.filter((c) => c.tags[primaryAttribute] !== undefined)
			.map((c) => ({
				pokemon: c,
				value: parseFloat(c.tags[primaryAttribute]) || 0
			}));

		// Separate into those that meet criteria and those that don't
		const meetsRange = withValues.filter((c) =>
			isAbove ? c.value > threshold : c.value < threshold
		);
		const failsRange = withValues.filter((c) =>
			isAbove ? c.value <= threshold : c.value >= threshold
		);

		if (meetsRange.length === 0) {
			return { correct: null, wrong: [], message: `No Pokemon meets the range criteria` };
		}

		if (failsRange.length < 3) {
			// Not enough wrong options, use what we have
			const correct = meetsRange[0].pokemon;
			const wrong = failsRange.map((f) => f.pokemon);
			return {
				correct,
				wrong: [...wrong, ...meetsRange.slice(1).map((m) => m.pokemon)].slice(0, 3),
				message: `⚠️ Limited wrong options available`
			};
		}

		const correct = meetsRange[Math.floor(Math.random() * meetsRange.length)].pokemon;
		const wrong = failsRange.slice(0, 3).map((f) => f.pokemon);

		const correctValue = parseFloat(correct.tags[primaryAttribute]);
		const rangeDesc = isAbove ? `> ${threshold}` : `< ${threshold}`;

		return {
			correct,
			wrong,
			message: `✓ ${correct.name} (${correctValue}) meets ${rangeDesc}, others don't`
		};
	}

	/**
	 * For type_effectiveness: similar to reverse_lookup but for damage multipliers
	 */
	function selectTypeEffectivenessAnswers(candidates: PokemonWithTags[]): {
		correct: PokemonWithTags | null;
		wrong: PokemonWithTags[];
		message: string;
	} {
		// Look for specific multiplier values in the question
		const questionLower = questionTemplate.toLowerCase();

		let targetValue: string;
		if (questionLower.includes('immune') || questionLower.includes('0x')) {
			targetValue = '0';
		} else if (questionLower.includes('4x')) {
			targetValue = '4';
		} else if (questionLower.includes('half') || questionLower.includes('0.5x')) {
			targetValue = '0.5';
		} else if (questionLower.includes('2x') || questionLower.includes('double')) {
			targetValue = '2';
		} else {
			targetValue = '0'; // default to immunity
		}

		const withTarget = candidates.filter((c) => c.tags[primaryAttribute] === targetValue);
		const withoutTarget = candidates.filter((c) => c.tags[primaryAttribute] !== targetValue);

		if (withTarget.length === 0) {
			return { correct: null, wrong: [], message: `No Pokemon with ${primaryAttribute}=${targetValue}` };
		}

		const correct = withTarget[Math.floor(Math.random() * withTarget.length)];
		const wrong = withoutTarget.slice(0, 3);

		if (wrong.length < 3) {
			return {
				correct,
				wrong: candidates.filter((c) => c.id !== correct.id).slice(0, 3),
				message: `⚠️ Limited differentiated options`
			};
		}

		return {
			correct,
			wrong,
			message: `✓ ${correct.name} has ${primaryAttribute}: ${targetValue}x`
		};
	}

	function shuffleOptions() {
		if (!correctPokemon) return;

		const options = [
			{ pokemon: correctPokemon, isCorrect: true },
			...wrongPokemon.map((p) => ({ pokemon: p, isCorrect: false }))
		];

		// Fisher-Yates shuffle
		for (let i = options.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[options[i], options[j]] = [options[j], options[i]];
		}

		shuffledOptions = options;
	}

	function replacePlaceholders(template: string, pokemon: PokemonWithTags | null): string {
		if (!template || !pokemon) return template || '';

		let result = template;

		// Replace {name} with Pokemon name
		result = result.replace(/\{name\}/g, pokemon.name);

		// Replace all tag-based placeholders
		for (const [key, value] of Object.entries(pokemon.tags)) {
			const regex = new RegExp(`\\{${key}\\}`, 'g');
			result = result.replace(regex, value);
		}

		// Mark any remaining unknown placeholders
		result = result.replace(/\{[^}]+\}/g, '???');

		return result;
	}

	function getAnswerValue(pokemon: PokemonWithTags | null): string {
		if (!pokemon || !answerTemplate) return '';

		// If answer template is {name}, return the Pokemon name
		if (answerTemplate.trim() === '{name}') {
			return pokemon.name;
		}

		// Otherwise, try to extract the tag value from the answer template
		const match = answerTemplate.match(/\{([^}]+)\}/);
		if (match) {
			const tagKey = match[1];
			return pokemon.tags[tagKey] || pokemon.name;
		}

		return replacePlaceholders(answerTemplate, pokemon);
	}

	// Get the relevant stat value for a Pokemon based on the primary attribute
	function getRelevantStat(pokemon: PokemonWithTags): string | null {
		if (!primaryAttribute || !pokemon.tags[primaryAttribute]) {
			return null;
		}

		const value = pokemon.tags[primaryAttribute];
		const attrInfo = POKEMON_ATTRIBUTES[primaryAttribute];

		// Format the stat nicely
		if (attrInfo) {
			// For numeric stats, show with label
			if (attrInfo.type === 'number') {
				return `${attrInfo.label}: ${value}`;
			}
			// For string attributes, just show the value
			return value;
		}

		return value;
	}

	// Check if we should show stats
	let shouldShowStats = $derived(
		answerTemplate.trim() === '{name}' &&
			primaryAttribute &&
			[
				'superlative',
				'comparison',
				'range',
				'multi_condition',
				'reverse_lookup',
				'negation',
				'statistical',
				'type_effectiveness'
			].includes(templateType)
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
