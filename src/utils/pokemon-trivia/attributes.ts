/**
 * Pokemon trivia attribute utilities
 * Provides grouping and filtering of POKEMON_ATTRIBUTES and template type rules
 */

import {
	POKEMON_ATTRIBUTES,
	type TemplateType,
	type PokemonAttributeInfo
} from '$types/pokemon-trivia-template.type';

/**
 * Template types that require the condition builder UI
 */
export const CONDITION_BUILDER_TYPES: TemplateType[] = [
	'reverse_lookup',
	'multi_condition',
	'range',
	'negation',
	'statistical',
	'type_effectiveness'
];

/**
 * Template types that require comparison config UI
 */
export const COMPARISON_CONFIG_TYPES: TemplateType[] = ['superlative', 'comparison'];

/**
 * Template types that should show stats in preview
 */
export const STATS_DISPLAY_TYPES: TemplateType[] = [
	'superlative',
	'comparison',
	'range',
	'multi_condition',
	'reverse_lookup',
	'negation',
	'statistical',
	'type_effectiveness'
];

/**
 * Group attributes by category for dropdown display
 *
 * @param attributes - Record of attributes to group (defaults to POKEMON_ATTRIBUTES)
 * @returns Record of category name to array of [key, info] tuples
 */
export function groupAttributesByCategory(
	attributes: Record<string, PokemonAttributeInfo> = POKEMON_ATTRIBUTES
): Record<string, [string, PokemonAttributeInfo][]> {
	const grouped: Record<string, [string, PokemonAttributeInfo][]> = {};

	for (const [key, info] of Object.entries(attributes)) {
		if (!grouped[info.category]) {
			grouped[info.category] = [];
		}
		grouped[info.category].push([key, info]);
	}

	return grouped;
}

/**
 * Get only numeric attributes, grouped by category
 *
 * @returns Record of category name to array of numeric [key, info] tuples
 */
export function getNumericAttributesByCategory(): Record<string, [string, PokemonAttributeInfo][]> {
	const numericAttrs: Record<string, PokemonAttributeInfo> = {};

	for (const [key, info] of Object.entries(POKEMON_ATTRIBUTES)) {
		if (info.type === 'number') {
			numericAttrs[key] = info;
		}
	}

	return groupAttributesByCategory(numericAttrs);
}

/**
 * Check if template type requires condition builder
 *
 * @param templateType - The template type to check
 * @returns True if the type requires a condition builder
 */
export function requiresConditionBuilder(templateType: TemplateType): boolean {
	return CONDITION_BUILDER_TYPES.includes(templateType);
}

/**
 * Check if template type requires comparison config
 *
 * @param templateType - The template type to check
 * @returns True if the type requires comparison config
 */
export function requiresComparisonConfig(templateType: TemplateType): boolean {
	return COMPARISON_CONFIG_TYPES.includes(templateType);
}

/**
 * Check if template type should show stats in preview
 *
 * @param templateType - The template type to check
 * @returns True if the type should display stats
 */
export function shouldShowStatsForType(templateType: TemplateType): boolean {
	return STATS_DISPLAY_TYPES.includes(templateType);
}
