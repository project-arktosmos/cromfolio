import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	getTriviaStats,
	getDifficultyConfig,
	getAllDifficultyConfigs,
	generateQuestion,
	generateSimpleQuestion,
	calculateProgressPercentage,
	isGameComplete,
	updateStatsAfterGame,
	getAccuracyPercentage,
	createTimer
} from '$services/pokemon-trivia-game.service';
import type { PokemonWithTags } from '$services/pokemon-trivia-game.service';
import type { PokemonTriviaTemplateV2, TemplateType } from '$types/pokemon-trivia-template.type';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

describe('pokemon-trivia-game.service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock for get_user_game_stats to return null (no stats)
		mockedInvoke.mockResolvedValue(null);
	});

	describe('getTriviaStats', () => {
		it('should return default stats when no stats exist', async () => {
			mockedInvoke.mockResolvedValue(null);

			const stats = await getTriviaStats();

			expect(stats.id).toBe('pokemon-trivia-stats');
			expect(stats.totalGamesPlayed).toBe(0);
			expect(stats.totalCorrect).toBe(0);
			expect(stats.totalWrong).toBe(0);
		});

		it('should return existing stats from database', async () => {
			mockedInvoke.mockResolvedValue({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 5,
				totalScore: 100,
				bestScore: 50,
				totalCorrect: 40,
				totalWrong: 10,
				bestStreak: 8,
				longestGame: 15,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-15'
			});

			const stats = await getTriviaStats();

			expect(stats.totalGamesPlayed).toBe(5);
			expect(stats.totalCorrect).toBe(40);
			expect(stats.totalWrong).toBe(10);
			expect(stats.bestStreak).toBe(8);
		});
	});

	describe('getDifficultyConfig', () => {
		it('should return easy difficulty config', () => {
			const config = getDifficultyConfig('easy');

			expect(config.maxLives).toBe(3);
			expect(config.timePerQuestion).toBe(10);
			expect(config.answerCount).toBe(3);
			expect(config.label).toBe('Easy');
		});

		it('should return hard difficulty config', () => {
			const config = getDifficultyConfig('hard');

			expect(config.maxLives).toBe(1);
			expect(config.timePerQuestion).toBe(5);
			expect(config.answerCount).toBe(4);
			expect(config.label).toBe('Hard');
		});
	});

	describe('getAllDifficultyConfigs', () => {
		it('should return all difficulty configs', () => {
			const configs = getAllDifficultyConfigs();

			expect(configs.easy).toBeDefined();
			expect(configs.hard).toBeDefined();
		});
	});

	describe('updateStatsAfterGame', () => {
		it('should call record_user_game with correct parameters', async () => {
			mockedInvoke.mockResolvedValue({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 1,
				totalScore: 0,
				bestScore: 0,
				totalCorrect: 3,
				totalWrong: 2,
				bestStreak: 3,
				longestGame: 5,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-15',
				updatedAt: '2024-01-15'
			});

			const stats = await updateStatsAfterGame(3, 2, 3);

			expect(mockedInvoke).toHaveBeenCalledWith('record_user_game', {
				gameType: 'pokemon-trivia',
				score: 0,
				correct: 3,
				wrong: 2,
				streak: 3
			});
			expect(stats.totalGamesPlayed).toBe(1);
			expect(stats.totalCorrect).toBe(3);
			expect(stats.totalWrong).toBe(2);
		});

		it('should accumulate stats over multiple games', async () => {
			// First game
			mockedInvoke.mockResolvedValueOnce({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 1,
				totalScore: 0,
				bestScore: 0,
				totalCorrect: 5,
				totalWrong: 0,
				bestStreak: 5,
				longestGame: 5,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-15',
				updatedAt: '2024-01-15'
			});

			await updateStatsAfterGame(5, 0, 5);

			// Second game
			mockedInvoke.mockResolvedValueOnce({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 2,
				totalScore: 0,
				bestScore: 0,
				totalCorrect: 8,
				totalWrong: 2,
				bestStreak: 5,
				longestGame: 5,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-15',
				updatedAt: '2024-01-15'
			});

			const stats = await updateStatsAfterGame(3, 2, 3);

			expect(stats.totalGamesPlayed).toBe(2);
			expect(stats.totalCorrect).toBe(8);
			expect(stats.totalWrong).toBe(2);
		});

		it('should track best streak', async () => {
			// First game with 5 streak
			mockedInvoke.mockResolvedValueOnce({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 1,
				totalScore: 0,
				bestScore: 0,
				totalCorrect: 5,
				totalWrong: 0,
				bestStreak: 5,
				longestGame: 5,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-15',
				updatedAt: '2024-01-15'
			});

			await updateStatsAfterGame(5, 0, 5);

			// Second game with 3 streak (best should stay 5)
			mockedInvoke.mockResolvedValueOnce({
				id: 'test-id',
				gameType: 'pokemon-trivia',
				totalGamesPlayed: 2,
				totalScore: 0,
				bestScore: 0,
				totalCorrect: 8,
				totalWrong: 0,
				bestStreak: 5,
				longestGame: 5,
				lastPlayedAt: '2024-01-15',
				createdAt: '2024-01-15',
				updatedAt: '2024-01-15'
			});

			const stats = await updateStatsAfterGame(3, 0, 3);

			expect(stats.bestStreak).toBe(5);
		});
	});

	describe('calculateProgressPercentage', () => {
		it('should calculate percentage correctly', () => {
			expect(calculateProgressPercentage(0, 10)).toBe(0);
			expect(calculateProgressPercentage(5, 10)).toBe(50);
			expect(calculateProgressPercentage(10, 10)).toBe(100);
		});

		it('should round to nearest integer', () => {
			expect(calculateProgressPercentage(1, 3)).toBe(33);
			expect(calculateProgressPercentage(2, 3)).toBe(67);
		});
	});

	describe('isGameComplete', () => {
		it('should return false when game is not complete', () => {
			expect(isGameComplete(0, 10)).toBe(false);
			expect(isGameComplete(5, 10)).toBe(false);
			expect(isGameComplete(9, 10)).toBe(false);
		});

		it('should return true when game is complete', () => {
			expect(isGameComplete(10, 10)).toBe(true);
			expect(isGameComplete(11, 10)).toBe(true);
		});
	});

	describe('getAccuracyPercentage', () => {
		it('should calculate accuracy correctly', () => {
			expect(getAccuracyPercentage(10, 0)).toBe(100);
			expect(getAccuracyPercentage(5, 5)).toBe(50);
			expect(getAccuracyPercentage(0, 10)).toBe(0);
		});

		it('should return 0 for no answers', () => {
			expect(getAccuracyPercentage(0, 0)).toBe(0);
		});

		it('should round percentage', () => {
			expect(getAccuracyPercentage(1, 2)).toBe(33);
		});
	});

	describe('generateQuestion', () => {
		const mockPool: PokemonWithTags[] = [
			{ id: '1', name: 'Pikachu', image: 'pika.png', tags: { type: 'Electric', generation: '1' } },
			{ id: '2', name: 'Charizard', image: 'char.png', tags: { type: 'Fire', generation: '1' } },
			{ id: '3', name: 'Bulbasaur', image: 'bulb.png', tags: { type: 'Grass', generation: '1' } },
			{ id: '4', name: 'Squirtle', image: 'squirt.png', tags: { type: 'Water', generation: '1' } }
		];

		const mockTemplates: PokemonTriviaTemplateV2[] = [
			{
				id: '1',
				name: 'Type Question',
				questionTemplate: 'What type is {name}?',
				answerTemplate: '{type}',
				primaryAttribute: 'type',
				templateType: 'attribute_question' as TemplateType,
				isActive: true,
				weight: 1,
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01'
			}
		];

		it('should generate a valid question', () => {
			const question = generateQuestion(mockPool, mockTemplates, 3);

			expect(question).not.toBeNull();
			if (question) {
				expect(question.text.length).toBeGreaterThan(0);
				expect(question.answers.length).toBeGreaterThanOrEqual(2);
				expect(question.correctPokemonId).toBeDefined();
				expect(question.answers.some((a) => a.isCorrect)).toBe(true);
			}
		});

		it('should return null for empty pool', () => {
			const question = generateQuestion([], mockTemplates, 3);
			expect(question).toBeNull();
		});

		it('should return null for empty templates', () => {
			const question = generateQuestion(mockPool, [], 3);
			expect(question).toBeNull();
		});

		it('should return null if pool is smaller than wrong answer count + 1', () => {
			const smallPool = mockPool.slice(0, 2);
			const question = generateQuestion(smallPool, mockTemplates, 3);
			expect(question).toBeNull();
		});

		it('should include correct answer in answers', () => {
			const question = generateQuestion(mockPool, mockTemplates, 2);

			expect(question).not.toBeNull();
			if (question) {
				const correctAnswer = question.answers.find((a) => a.isCorrect);
				expect(correctAnswer).toBeDefined();
				expect(correctAnswer?.pokemonId).toBe(question.correctPokemonId);
			}
		});
	});

	describe('generateSimpleQuestion', () => {
		const mockPool: PokemonWithTags[] = [
			{ id: '1', name: 'Pikachu', image: 'pika.png', tags: {} },
			{ id: '2', name: 'Charizard', image: 'char.png', tags: {} },
			{ id: '3', name: 'Bulbasaur', image: 'bulb.png', tags: {} },
			{ id: '4', name: 'Squirtle', image: 'squirt.png', tags: {} }
		];

		it('should generate a simple question', () => {
			const question = generateSimpleQuestion(mockPool, 3);

			expect(question).not.toBeNull();
			if (question) {
				expect(question.text).toBe("Who's that Pokemon?");
				expect(question.answers.length).toBe(4); // 1 correct + 3 wrong
				expect(question.showsPokemonImage).toBe(true);
			}
		});

		it('should return null for insufficient pool', () => {
			const smallPool = mockPool.slice(0, 2);
			const question = generateSimpleQuestion(smallPool, 3);
			expect(question).toBeNull();
		});

		it('should have exactly one correct answer', () => {
			const question = generateSimpleQuestion(mockPool, 3);

			expect(question).not.toBeNull();
			if (question) {
				const correctAnswers = question.answers.filter((a) => a.isCorrect);
				expect(correctAnswers.length).toBe(1);
			}
		});
	});

	describe('createTimer', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should create timer with initial state', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			const state = timer.getState();

			expect(state.remaining).toBe(10);
			expect(state.total).toBe(10);
			expect(state.isRunning).toBe(false);
			expect(state.isPaused).toBe(false);
		});

		it('should start and tick down', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			timer.start();

			expect(timer.getState().isRunning).toBe(true);

			vi.advanceTimersByTime(1000);
			expect(onTick).toHaveBeenCalledWith(9);

			vi.advanceTimersByTime(1000);
			expect(onTick).toHaveBeenCalledWith(8);
		});

		it('should call onComplete when time runs out', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(3, onTick, onComplete);
			timer.start();

			// Timer ticks: 1000ms (3->2), 2000ms (2->1), 3000ms (1->0), 4000ms (check 0, call onComplete)
			vi.advanceTimersByTime(4000);

			expect(onComplete).toHaveBeenCalled();
		});

		it('should stop timer', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			timer.start();
			timer.stop();

			expect(timer.getState().isRunning).toBe(false);

			vi.advanceTimersByTime(2000);
			expect(onTick).not.toHaveBeenCalled();
		});

		it('should pause and resume timer', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			timer.start();

			vi.advanceTimersByTime(2000);
			expect(onTick).toHaveBeenCalledTimes(2);

			timer.pause();
			expect(timer.getState().isPaused).toBe(true);

			vi.advanceTimersByTime(2000);
			expect(onTick).toHaveBeenCalledTimes(2); // No more ticks

			timer.resume();
			expect(timer.getState().isPaused).toBe(false);

			vi.advanceTimersByTime(1000);
			expect(onTick).toHaveBeenCalledTimes(3);
		});

		it('should reset timer', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			timer.start();

			vi.advanceTimersByTime(3000);

			timer.reset();
			const state = timer.getState();

			expect(state.remaining).toBe(10);
			expect(state.isRunning).toBe(false);
		});

		it('should reset timer with new duration', () => {
			const onTick = vi.fn();
			const onComplete = vi.fn();

			const timer = createTimer(10, onTick, onComplete);
			timer.reset(15);

			expect(timer.getState().remaining).toBe(15);
			expect(timer.getState().total).toBe(15);
		});
	});
});
