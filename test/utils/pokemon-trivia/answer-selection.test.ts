import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	selectAnswers,
	selectSuperlativeAnswers,
	selectReverseLookupAnswers,
	selectNegationAnswers,
	selectRangeAnswers,
	selectTypeEffectivenessAnswers
} from '$utils/pokemon-trivia/answer-selection';
import type { PokemonWithTags } from '$services/tags.service';

describe('pokemon-trivia/answer-selection', () => {
	const createPokemon = (
		id: string,
		name: string,
		tags: Record<string, string>
	): PokemonWithTags => ({
		id,
		name,
		image: `${name.toLowerCase()}.png`,
		tags
	});

	beforeEach(() => {
		vi.spyOn(Math, 'random');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('selectAnswers', () => {
		it('should return empty result for insufficient candidates', () => {
			const candidates = [
				createPokemon('1', 'Pikachu', { type: 'Electric' }),
				createPokemon('2', 'Charizard', { type: 'Fire' })
			];

			const result = selectAnswers(candidates, 'attribute_question', 'type', 'What type?');

			expect(result.correct).toBeNull();
			expect(result.wrong).toHaveLength(0);
			expect(result.message).toBe('Not enough candidates');
		});

		it('should return default selection for attribute_question type', () => {
			const candidates = [
				createPokemon('1', 'Pikachu', { type: 'Electric' }),
				createPokemon('2', 'Charizard', { type: 'Fire' }),
				createPokemon('3', 'Bulbasaur', { type: 'Grass' }),
				createPokemon('4', 'Squirtle', { type: 'Water' })
			];

			const result = selectAnswers(candidates, 'attribute_question', 'type', 'What type?');

			expect(result.correct).not.toBeNull();
			expect(result.wrong).toHaveLength(3);
		});

		it('should handle superlative template type', () => {
			const candidates = [
				createPokemon('1', 'Pikachu', { attack: '55' }),
				createPokemon('2', 'Mewtwo', { attack: '110' }),
				createPokemon('3', 'Bulbasaur', { attack: '49' }),
				createPokemon('4', 'Machamp', { attack: '130' })
			];

			const result = selectAnswers(
				candidates,
				'superlative',
				'attack',
				'Which has highest attack?'
			);

			expect(result.correct?.name).toBe('Machamp');
		});

		it('should handle comparison template type', () => {
			const candidates = [
				createPokemon('1', 'Pikachu', { speed: '90' }),
				createPokemon('2', 'Snorlax', { speed: '30' }),
				createPokemon('3', 'Electrode', { speed: '150' }),
				createPokemon('4', 'Slowpoke', { speed: '15' })
			];

			const result = selectAnswers(candidates, 'comparison', 'speed', 'Which is fastest?');

			expect(result.correct?.name).toBe('Electrode');
		});
	});

	describe('selectSuperlativeAnswers', () => {
		it('should select Pokemon with highest value for max question', () => {
			const candidates = [
				createPokemon('1', 'Weak', { attack: '10' }),
				createPokemon('2', 'Medium', { attack: '50' }),
				createPokemon('3', 'Strong', { attack: '100' }),
				createPokemon('4', 'Stronger', { attack: '150' })
			];

			const result = selectSuperlativeAnswers(
				candidates,
				'attack',
				'Which has highest attack?',
				true
			);

			expect(result.correct?.name).toBe('Stronger');
			expect(result.message).toContain('highest');
		});

		it('should select Pokemon with lowest value for min question', () => {
			const candidates = [
				createPokemon('1', 'Fast', { speed: '100' }),
				createPokemon('2', 'Medium', { speed: '50' }),
				createPokemon('3', 'Slow', { speed: '20' }),
				createPokemon('4', 'Slowest', { speed: '5' })
			];

			const result = selectSuperlativeAnswers(candidates, 'speed', 'Which is slowest?', true);

			expect(result.correct?.name).toBe('Slowest');
			expect(result.message).toContain('lowest');
		});

		it('should handle non-numeric attributes', () => {
			const candidates = [
				createPokemon('1', 'Pikachu', { type: 'Electric' }),
				createPokemon('2', 'Charizard', { type: 'Fire' }),
				createPokemon('3', 'Bulbasaur', { type: 'Grass' }),
				createPokemon('4', 'Squirtle', { type: 'Water' })
			];

			const result = selectSuperlativeAnswers(candidates, 'type', 'Which type?', false);

			expect(result.correct).toBe(candidates[0]);
		});

		it('should avoid ties in wrong answers', () => {
			const candidates = [
				createPokemon('1', 'Highest', { attack: '100' }),
				createPokemon('2', 'Tied', { attack: '100' }),
				createPokemon('3', 'Lower', { attack: '50' }),
				createPokemon('4', 'Lowest', { attack: '25' })
			];

			const result = selectSuperlativeAnswers(
				candidates,
				'attack',
				'Which has highest attack?',
				true
			);

			// Wrong answers should not include tied values
			expect(result.wrong.every((p) => p.tags.attack !== '100')).toBe(true);
		});

		it('should detect min keywords in question', () => {
			const keywords = [
				'lowest',
				'least',
				'slowest',
				'shortest',
				'lightest',
				'weakest',
				'earliest',
				'last in battle'
			];

			keywords.forEach((keyword) => {
				const candidates = [
					createPokemon('1', 'High', { stat: '100' }),
					createPokemon('2', 'Med', { stat: '50' }),
					createPokemon('3', 'Low', { stat: '25' }),
					createPokemon('4', 'Lowest', { stat: '10' })
				];

				const result = selectSuperlativeAnswers(
					candidates,
					'stat',
					`Which has ${keyword} stat?`,
					true
				);

				expect(result.correct?.name).toBe('Lowest');
			});
		});
	});

	describe('selectReverseLookupAnswers', () => {
		it('should select Pokemon with matching attribute', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			// Use all unique types to ensure enough wrong answers with different types
			const candidates = [
				createPokemon('1', 'Pikachu', { type: 'Electric' }),
				createPokemon('2', 'Charizard', { type: 'Fire' }),
				createPokemon('3', 'Bulbasaur', { type: 'Grass' }),
				createPokemon('4', 'Squirtle', { type: 'Water' })
			];

			const result = selectReverseLookupAnswers(candidates, 'type');

			expect(result.correct).not.toBeNull();
			expect(result.wrong.every((p) => p.tags.type !== result.correct?.tags.type)).toBe(true);
		});

		it('should return empty result when no Pokemon has attribute', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', {}),
				createPokemon('2', 'Pokemon2', {}),
				createPokemon('3', 'Pokemon3', {}),
				createPokemon('4', 'Pokemon4', {})
			];

			const result = selectReverseLookupAnswers(candidates, 'type');

			expect(result.correct).toBeNull();
			expect(result.message).toBe('No Pokemon with this attribute');
		});

		it('should handle empty attribute values', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', { type: '' }),
				createPokemon('2', 'Pokemon2', { type: 'Fire' }),
				createPokemon('3', 'Pokemon3', { type: '' }),
				createPokemon('4', 'Pokemon4', { type: 'Water' })
			];

			vi.mocked(Math.random).mockReturnValue(0);
			const result = selectReverseLookupAnswers(candidates, 'type');

			// Should skip empty values
			expect(result.correct?.tags.type).not.toBe('');
		});
	});

	describe('selectNegationAnswers', () => {
		it('should select Pokemon without most common value', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Pikachu', { type: 'Electric' }),
				createPokemon('2', 'Charizard', { type: 'Fire' }),
				createPokemon('3', 'Magmar', { type: 'Fire' }),
				createPokemon('4', 'Arcanine', { type: 'Fire' })
			];

			const result = selectNegationAnswers(candidates, 'type');

			// Pikachu is the only non-Fire type
			expect(result.correct?.name).toBe('Pikachu');
			expect(result.wrong.every((p) => p.tags.type === 'Fire')).toBe(true);
		});

		it('should return empty when all have same value', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', { type: 'Fire' }),
				createPokemon('2', 'Pokemon2', { type: 'Fire' }),
				createPokemon('3', 'Pokemon3', { type: 'Fire' }),
				createPokemon('4', 'Pokemon4', { type: 'Fire' })
			];

			const result = selectNegationAnswers(candidates, 'type');

			expect(result.correct).toBeNull();
			expect(result.message).toBe('Cannot find enough differentiated options');
		});

		it('should return empty when no attribute values', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', {}),
				createPokemon('2', 'Pokemon2', {}),
				createPokemon('3', 'Pokemon3', {}),
				createPokemon('4', 'Pokemon4', {})
			];

			const result = selectNegationAnswers(candidates, 'type');

			expect(result.correct).toBeNull();
			expect(result.message).toBe('No attribute values found');
		});
	});

	describe('selectRangeAnswers', () => {
		it('should select Pokemon above threshold', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Strong', { attack: '150' }),
				createPokemon('2', 'Medium', { attack: '80' }),
				createPokemon('3', 'Weak', { attack: '40' }),
				createPokemon('4', 'Weaker', { attack: '30' })
			];

			const result = selectRangeAnswers(candidates, 'attack', 'Which has attack above 100?', true);

			expect(result.correct?.name).toBe('Strong');
			expect(result.wrong.every((p) => parseInt(p.tags.attack) <= 100)).toBe(true);
		});

		it('should select Pokemon below threshold', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Strong', { attack: '150' }),
				createPokemon('2', 'Medium', { attack: '80' }),
				createPokemon('3', 'Weak', { attack: '40' }),
				createPokemon('4', 'Weaker', { attack: '30' })
			];

			const result = selectRangeAnswers(candidates, 'attack', 'Which has attack below 50?', true);

			expect(['Weak', 'Weaker']).toContain(result.correct?.name);
		});

		it('should parse threshold from question', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Pokemon1', { stat: '200' }),
				createPokemon('2', 'Pokemon2', { stat: '150' }),
				createPokemon('3', 'Pokemon3', { stat: '50' }),
				createPokemon('4', 'Pokemon4', { stat: '25' })
			];

			const result = selectRangeAnswers(candidates, 'stat', 'Which has stat above 175?', true);

			expect(result.correct?.tags.stat).toBe('200');
		});

		it('should handle non-numeric attribute', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', { type: 'Fire' }),
				createPokemon('2', 'Pokemon2', { type: 'Water' }),
				createPokemon('3', 'Pokemon3', { type: 'Grass' }),
				createPokemon('4', 'Pokemon4', { type: 'Electric' })
			];

			const result = selectRangeAnswers(candidates, 'type', 'Range question', false);

			expect(result.correct).toBe(candidates[0]);
		});

		it('should return empty when no Pokemon meets criteria', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', { stat: '10' }),
				createPokemon('2', 'Pokemon2', { stat: '20' }),
				createPokemon('3', 'Pokemon3', { stat: '30' }),
				createPokemon('4', 'Pokemon4', { stat: '40' })
			];

			const result = selectRangeAnswers(candidates, 'stat', 'Which has stat above 1000?', true);

			expect(result.correct).toBeNull();
			expect(result.message).toBe('No Pokemon meets the range criteria');
		});
	});

	describe('selectTypeEffectivenessAnswers', () => {
		it('should select Pokemon with immune (0x) multiplier', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Normal', { 'against-ghost': '0' }),
				createPokemon('2', 'Fire', { 'against-ghost': '1' }),
				createPokemon('3', 'Water', { 'against-ghost': '1' }),
				createPokemon('4', 'Grass', { 'against-ghost': '1' })
			];

			const result = selectTypeEffectivenessAnswers(
				candidates,
				'against-ghost',
				'Which is immune to Ghost?'
			);

			expect(result.correct?.name).toBe('Normal');
		});

		it('should select Pokemon with 4x multiplier', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'GrassFly', { 'against-ice': '4' }),
				createPokemon('2', 'Fire', { 'against-ice': '1' }),
				createPokemon('3', 'Water', { 'against-ice': '0.5' }),
				createPokemon('4', 'Ice', { 'against-ice': '1' })
			];

			const result = selectTypeEffectivenessAnswers(
				candidates,
				'against-ice',
				'Which takes 4x from Ice?'
			);

			expect(result.correct?.name).toBe('GrassFly');
		});

		it('should select Pokemon with 0.5x multiplier', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Fire', { 'against-fire': '0.5' }),
				createPokemon('2', 'Grass', { 'against-fire': '2' }),
				createPokemon('3', 'Water', { 'against-fire': '0.5' }),
				createPokemon('4', 'Bug', { 'against-fire': '2' })
			];

			const result = selectTypeEffectivenessAnswers(
				candidates,
				'against-fire',
				'Which takes half damage from Fire?'
			);

			expect(['Fire', 'Water']).toContain(result.correct?.name);
		});

		it('should select Pokemon with 2x multiplier', () => {
			vi.mocked(Math.random).mockReturnValue(0);

			const candidates = [
				createPokemon('1', 'Grass', { 'against-fire': '2' }),
				createPokemon('2', 'Fire', { 'against-fire': '0.5' }),
				createPokemon('3', 'Water', { 'against-fire': '0.5' }),
				createPokemon('4', 'Rock', { 'against-fire': '0.5' })
			];

			const result = selectTypeEffectivenessAnswers(
				candidates,
				'against-fire',
				'Which takes 2x from Fire?'
			);

			expect(result.correct?.name).toBe('Grass');
		});

		it('should return empty when no Pokemon has target multiplier', () => {
			const candidates = [
				createPokemon('1', 'Pokemon1', { 'against-fire': '1' }),
				createPokemon('2', 'Pokemon2', { 'against-fire': '1' }),
				createPokemon('3', 'Pokemon3', { 'against-fire': '1' }),
				createPokemon('4', 'Pokemon4', { 'against-fire': '1' })
			];

			const result = selectTypeEffectivenessAnswers(candidates, 'against-fire', 'Which is immune?');

			expect(result.correct).toBeNull();
			expect(result.message).toContain('No Pokemon with');
		});
	});
});
