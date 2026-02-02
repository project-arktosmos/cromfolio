/**
 * Pokemon trivia answer selection utilities
 * Algorithms for selecting correct and wrong answers based on template type
 */

import { POKEMON_ATTRIBUTES, type TemplateType } from '$types/pokemon-trivia-template.type';
import type { PokemonWithTags } from '$services/tags.service';

/**
 * Result of answer selection containing correct Pokemon, wrong options, and validation message
 */
export interface AnswerSelectionResult {
	correct: PokemonWithTags | null;
	wrong: PokemonWithTags[];
	message: string;
}

/**
 * Select correct and wrong Pokemon based on template type
 *
 * @param candidates - Array of Pokemon candidates to choose from
 * @param templateType - The type of template being previewed
 * @param primaryAttribute - The main attribute being queried
 * @param questionTemplate - The question template text (used for parsing range/superlative direction)
 * @returns Selection result with correct answer, wrong options, and validation message
 */
export function selectAnswers(
	candidates: PokemonWithTags[],
	templateType: TemplateType,
	primaryAttribute: string,
	questionTemplate: string
): AnswerSelectionResult {
	if (!primaryAttribute || candidates.length < 4) {
		return { correct: null, wrong: [], message: 'Not enough candidates' };
	}

	const attrInfo = POKEMON_ATTRIBUTES[primaryAttribute];
	const isNumeric = attrInfo?.type === 'number';

	switch (templateType) {
		case 'superlative':
		case 'comparison':
			return selectSuperlativeAnswers(candidates, primaryAttribute, questionTemplate, isNumeric);
		case 'reverse_lookup':
			return selectReverseLookupAnswers(candidates, primaryAttribute);
		case 'negation':
			return selectNegationAnswers(candidates, primaryAttribute);
		case 'range':
			return selectRangeAnswers(candidates, primaryAttribute, questionTemplate, isNumeric);
		case 'type_effectiveness':
			return selectTypeEffectivenessAnswers(candidates, primaryAttribute, questionTemplate);
		default:
			return {
				correct: candidates[0],
				wrong: candidates.slice(1, 4),
				message: ''
			};
	}
}

/**
 * Determine if question is looking for minimum value based on keywords
 */
function isMinQuestion(questionTemplate: string): boolean {
	const lower = questionTemplate.toLowerCase();
	return (
		lower.includes('lowest') ||
		lower.includes('least') ||
		lower.includes('slowest') ||
		lower.includes('shortest') ||
		lower.includes('lightest') ||
		lower.includes('weakest') ||
		lower.includes('earliest') ||
		lower.includes('last in battle')
	);
}

/**
 * Select answers for superlative/comparison questions
 * Finds Pokemon with highest or lowest stat value
 *
 * @param candidates - Array of Pokemon candidates
 * @param primaryAttribute - The stat attribute to compare
 * @param questionTemplate - Question text to determine max/min direction
 * @param isNumeric - Whether the attribute is numeric
 */
export function selectSuperlativeAnswers(
	candidates: PokemonWithTags[],
	primaryAttribute: string,
	questionTemplate: string,
	isNumeric: boolean
): AnswerSelectionResult {
	if (!isNumeric) {
		return { correct: candidates[0], wrong: candidates.slice(1, 4), message: '' };
	}

	const isMin = isMinQuestion(questionTemplate);

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

	const correct = withValues[0].pokemon;
	const wrong: PokemonWithTags[] = [];

	// Pick 3 others that have different values (to avoid ties being "wrong")
	for (let i = 1; i < withValues.length && wrong.length < 3; i++) {
		if (withValues[i].value !== withValues[0].value) {
			wrong.push(withValues[i].pokemon);
		}
	}

	const direction = isMin ? 'lowest' : 'highest';
	return {
		correct,
		wrong,
		message: `\u2713 ${correct.name} has ${direction} ${primaryAttribute}: ${withValues[0].value}`
	};
}

/**
 * Select answers for reverse lookup questions
 * Correct Pokemon HAS the attribute value, wrong Pokemon don't
 *
 * @param candidates - Array of Pokemon candidates
 * @param primaryAttribute - The attribute to match
 */
export function selectReverseLookupAnswers(
	candidates: PokemonWithTags[],
	primaryAttribute: string
): AnswerSelectionResult {
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

	// If no differentiated wrong answers exist, this template can't work for this pool
	if (wrong.length === 0) {
		return {
			correct: null,
			wrong: [],
			message: 'No differentiated options for this attribute'
		};
	}

	return {
		correct,
		wrong,
		message: wrong.length < 3
			? 'Limited differentiated options'
			: `\u2713 Only ${correct.name} has ${primaryAttribute}: ${correctValue}`
	};
}

/**
 * Select answers for negation questions
 * Correct Pokemon does NOT have the attribute, wrong Pokemon DO have it
 *
 * @param candidates - Array of Pokemon candidates
 * @param primaryAttribute - The attribute to negate
 */
export function selectNegationAnswers(
	candidates: PokemonWithTags[],
	primaryAttribute: string
): AnswerSelectionResult {
	// Count attribute values to find the most common one
	const valueCounts: Record<string, number> = {};

	for (const c of candidates) {
		const val = c.tags[primaryAttribute];
		if (val) {
			valueCounts[val] = (valueCounts[val] || 0) + 1;
		}
	}

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
		message: `\u2713 ${correct.name} is NOT ${targetValue}, others are`
	};
}

/**
 * Parse range threshold from question template
 */
function parseRangeThreshold(questionTemplate: string): { threshold: number; isAbove: boolean } {
	const questionLower = questionTemplate.toLowerCase();

	let threshold = 100;
	const numbers = questionTemplate.match(/\d+/g);
	if (numbers && numbers.length > 0) {
		threshold = parseInt(numbers[0]);
	}

	const isAbove = !(
		questionLower.includes('below') ||
		questionLower.includes('under') ||
		questionLower.includes('less than') ||
		questionLower.includes('shorter than') ||
		questionLower.includes('lighter than')
	);

	return { threshold, isAbove };
}

/**
 * Select answers for range questions
 * Correct Pokemon is within the range, wrong Pokemon are outside
 *
 * @param candidates - Array of Pokemon candidates
 * @param primaryAttribute - The numeric attribute to check
 * @param questionTemplate - Question text to parse range criteria
 * @param isNumeric - Whether the attribute is numeric
 */
export function selectRangeAnswers(
	candidates: PokemonWithTags[],
	primaryAttribute: string,
	questionTemplate: string,
	isNumeric: boolean
): AnswerSelectionResult {
	if (!isNumeric) {
		return { correct: candidates[0], wrong: candidates.slice(1, 4), message: '' };
	}

	const { threshold, isAbove } = parseRangeThreshold(questionTemplate);

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
		return { correct: null, wrong: [], message: 'No Pokemon meets the range criteria' };
	}

	if (failsRange.length < 3) {
		const correct = meetsRange[0].pokemon;
		const wrong = failsRange.map((f) => f.pokemon);
		return {
			correct,
			wrong: [...wrong, ...meetsRange.slice(1).map((m) => m.pokemon)].slice(0, 3),
			message: `\u26a0\ufe0f Limited wrong options available`
		};
	}

	const correct = meetsRange[Math.floor(Math.random() * meetsRange.length)].pokemon;
	const wrong = failsRange.slice(0, 3).map((f) => f.pokemon);

	const correctValue = parseFloat(correct.tags[primaryAttribute]);
	const rangeDesc = isAbove ? `> ${threshold}` : `< ${threshold}`;

	return {
		correct,
		wrong,
		message: `\u2713 ${correct.name} (${correctValue}) meets ${rangeDesc}, others don't`
	};
}

/**
 * Select answers for type effectiveness questions
 * Based on damage multipliers (0x, 0.5x, 2x, 4x)
 *
 * @param candidates - Array of Pokemon candidates
 * @param primaryAttribute - The type effectiveness attribute (e.g., "against-fire")
 * @param questionTemplate - Question text to determine target multiplier
 */
export function selectTypeEffectivenessAnswers(
	candidates: PokemonWithTags[],
	primaryAttribute: string,
	questionTemplate: string
): AnswerSelectionResult {
	const questionLower = questionTemplate.toLowerCase();

	// Determine target multiplier from question text
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
		return {
			correct: null,
			wrong: [],
			message: `No Pokemon with ${primaryAttribute}=${targetValue}`
		};
	}

	const correct = withTarget[Math.floor(Math.random() * withTarget.length)];
	const wrong = withoutTarget.slice(0, 3);

	return {
		correct,
		wrong,
		message: wrong.length < 3
			? 'Limited differentiated options'
			: `\u2713 ${correct.name} has ${primaryAttribute}: ${targetValue}x`
	};
}
