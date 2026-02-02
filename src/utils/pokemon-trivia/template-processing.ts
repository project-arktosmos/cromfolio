/**
 * Pokemon trivia template processing utilities
 * String replacement and value extraction for question/answer templates
 */

import { POKEMON_ATTRIBUTES } from '$types/pokemon-trivia-template.type';
import type { PokemonWithTags } from '$services/tags.service';

/**
 * Replace placeholders in a template string with Pokemon data
 *
 * @param template - Template string with {placeholder} syntax
 * @param pokemon - Pokemon data to fill placeholders
 * @returns Processed string with placeholders replaced
 */
export function replacePlaceholders(template: string, pokemon: PokemonWithTags | null): string {
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

/**
 * Extract the answer value from a Pokemon based on answer template
 *
 * @param pokemon - Pokemon data
 * @param answerTemplate - Template for the answer
 * @returns The answer value string
 */
export function getAnswerValue(pokemon: PokemonWithTags | null, answerTemplate: string): string {
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

/**
 * Get the relevant stat display string for a Pokemon
 *
 * @param pokemon - Pokemon data
 * @param primaryAttribute - The attribute to display
 * @returns Formatted stat string or null if not available
 */
export function getRelevantStat(pokemon: PokemonWithTags, primaryAttribute: string): string | null {
	if (!primaryAttribute || !pokemon.tags[primaryAttribute]) {
		return null;
	}

	const value = pokemon.tags[primaryAttribute];
	const attrInfo = POKEMON_ATTRIBUTES[primaryAttribute];

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

/**
 * Fisher-Yates shuffle for answer options
 *
 * @param items - Array of items to shuffle
 * @returns New shuffled array (does not mutate original)
 */
export function shuffleArray<T>(items: T[]): T[] {
	const result = [...items];

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
}
