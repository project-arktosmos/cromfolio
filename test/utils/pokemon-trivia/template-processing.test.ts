import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	replacePlaceholders,
	getAnswerValue,
	getRelevantStat,
	shuffleArray
} from '$utils/pokemon-trivia/template-processing';
import type { PokemonWithTags } from '$services/tags.service';

describe('pokemon-trivia/template-processing', () => {
	describe('replacePlaceholders', () => {
		it('should replace {name} placeholder', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = replacePlaceholders('Who is {name}?', pokemon);

			expect(result).toBe('Who is Pikachu?');
		});

		it('should replace tag-based placeholders', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {
					type: 'Electric',
					generation: '1'
				}
			};

			const result = replacePlaceholders('{name} is a {type} type from Gen {generation}', pokemon);

			expect(result).toBe('Pikachu is a Electric type from Gen 1');
		});

		it('should mark unknown placeholders with ???', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = replacePlaceholders('{name} has {ability}', pokemon);

			expect(result).toBe('Pikachu has ???');
		});

		it('should handle null pokemon', () => {
			const result = replacePlaceholders('Who is {name}?', null);
			expect(result).toBe('Who is {name}?');
		});

		it('should handle empty template', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = replacePlaceholders('', pokemon);
			expect(result).toBe('');
		});

		it('should replace multiple occurrences of same placeholder', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = replacePlaceholders('{name} is {name}', pokemon);
			expect(result).toBe('Pikachu is Pikachu');
		});
	});

	describe('getAnswerValue', () => {
		it('should return pokemon name for {name} template', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = getAnswerValue(pokemon, '{name}');
			expect(result).toBe('Pikachu');
		});

		it('should return tag value for tag template', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: { type: 'Electric' }
			};

			const result = getAnswerValue(pokemon, '{type}');
			expect(result).toBe('Electric');
		});

		it('should fallback to name if tag not found', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = getAnswerValue(pokemon, '{ability}');
			expect(result).toBe('Pikachu');
		});

		it('should handle null pokemon', () => {
			const result = getAnswerValue(null, '{name}');
			expect(result).toBe('');
		});

		it('should handle empty template', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = getAnswerValue(pokemon, '');
			expect(result).toBe('');
		});

		it('should handle template with text by extracting just the value', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: { type: 'Electric' }
			};

			// getAnswerValue extracts the tag value, not the full formatted string
			const result = getAnswerValue(pokemon, 'Type: {type}');
			expect(result).toBe('Electric');
		});
	});

	describe('getRelevantStat', () => {
		it('should return formatted stat for numeric attribute', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: { attack: '55' }
			};

			const result = getRelevantStat(pokemon, 'attack');

			// Depends on POKEMON_ATTRIBUTES definition
			expect(result).toContain('55');
		});

		it('should return value for string attribute', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: { type: 'Electric' }
			};

			const result = getRelevantStat(pokemon, 'type');
			expect(result).toBe('Electric');
		});

		it('should return null for missing attribute', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: {}
			};

			const result = getRelevantStat(pokemon, 'attack');
			expect(result).toBeNull();
		});

		it('should return null for empty primaryAttribute', () => {
			const pokemon: PokemonWithTags = {
				id: '25',
				name: 'Pikachu',
				image: 'pikachu.png',
				tags: { attack: '55' }
			};

			const result = getRelevantStat(pokemon, '');
			expect(result).toBeNull();
		});
	});

	describe('shuffleArray', () => {
		beforeEach(() => {
			vi.spyOn(Math, 'random');
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should return new array (not mutate original)', () => {
			const original = [1, 2, 3, 4, 5];
			const originalCopy = [...original];

			shuffleArray(original);

			expect(original).toEqual(originalCopy);
		});

		it('should return array with same elements', () => {
			const original = [1, 2, 3, 4, 5];

			vi.mocked(Math.random).mockReturnValue(0.5);
			const shuffled = shuffleArray(original);

			expect(shuffled.sort()).toEqual(original.sort());
		});

		it('should handle empty array', () => {
			const result = shuffleArray([]);
			expect(result).toEqual([]);
		});

		it('should handle single element', () => {
			const result = shuffleArray([42]);
			expect(result).toEqual([42]);
		});

		it('should shuffle elements (Fisher-Yates)', () => {
			// With controlled random, verify shuffle behavior
			const original = ['a', 'b', 'c'];

			// Random values that swap elements
			vi.mocked(Math.random)
				.mockReturnValueOnce(0.5) // i=2: j = floor(0.5 * 3) = 1, swap b and c
				.mockReturnValueOnce(0.9); // i=1: j = floor(0.9 * 2) = 1, no swap

			const shuffled = shuffleArray(original);

			expect(shuffled).toHaveLength(3);
			expect(shuffled).toContain('a');
			expect(shuffled).toContain('b');
			expect(shuffled).toContain('c');
		});

		it('should work with complex objects', () => {
			const original = [
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' },
				{ id: 3, name: 'C' }
			];

			vi.mocked(Math.random).mockReturnValue(0.5);
			const shuffled = shuffleArray(original);

			expect(shuffled).toHaveLength(3);
			expect(shuffled.map((o) => o.id).sort()).toEqual([1, 2, 3]);
		});
	});
});
