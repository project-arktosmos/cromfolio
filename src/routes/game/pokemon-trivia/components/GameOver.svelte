<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';
	import type { PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';

	interface AnsweredQuestion {
		question: string;
		pokemon: { name: string; image: string; tags?: Record<string, string> };
		template: PokemonTriviaTemplateV2 | null;
	}

	interface Props {
		correctAnswers: number;
		answeredQuestions: AnsweredQuestion[];
		difficulty: GameDifficulty;
		difficultyConfig: DifficultyConfig;
	}

	let { correctAnswers, answeredQuestions, difficulty, difficultyConfig }: Props = $props();

	const dispatch = createEventDispatcher<{
		playAgain: void;
		changeCollection: void;
	}>();

	function getResultEmoji(): string {
		if (correctAnswers >= 10) return '🏆';
		if (correctAnswers >= 5) return '🎉';
		if (correctAnswers >= 1) return '👍';
		return '📚';
	}

	function getResultMessage(): string {
		if (correctAnswers >= 10) return 'Amazing Run!';
		if (correctAnswers >= 5) return 'Great Job!';
		if (correctAnswers >= 1) return 'Good Try!';
		return 'Keep Learning!';
	}

	function getResultColorClass(): string {
		if (correctAnswers >= 10) return 'text-success';
		if (correctAnswers >= 5) return 'text-primary';
		if (correctAnswers >= 1) return 'text-info';
		return 'text-warning';
	}
</script>

<div class="flex flex-col items-center gap-6">
	<div class="card bg-base-200 w-full max-w-md">
		<div class="card-body items-center text-center">
			<div class="mb-2 text-6xl">{getResultEmoji()}</div>
			<h2 class={classNames('card-title text-2xl', getResultColorClass())}>{getResultMessage()}</h2>

			<div
				class={classNames('badge mt-2', {
					'badge-success': difficulty === 'easy',
					'badge-error': difficulty === 'hard'
				})}
			>
				{difficultyConfig.label} Mode
			</div>

			<p class="text-base-content/70 mt-2">
				You answered {correctAnswers} question{correctAnswers !== 1 ? 's' : ''} correctly before running out of lives!
			</p>

			<div class="stats bg-base-300 mt-6">
				<div class="stat">
					<div class="stat-title">Score</div>
					<div class="stat-value text-success">{correctAnswers}</div>
				</div>
			</div>

			<div class="card-actions mt-6 gap-2">
				<button class="btn btn-primary" onclick={() => dispatch('playAgain')}>Play Again</button>
				<button class="btn btn-outline" onclick={() => dispatch('changeCollection')}
					>Choose Collection</button
				>
			</div>
		</div>
	</div>

	<!-- Summary of correctly answered questions -->
	{#if answeredQuestions.length > 0}
		<div class="card bg-base-200 w-full max-w-2xl">
			<div class="card-body">
				<h3 class="card-title text-lg">Correctly Answered</h3>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{#each answeredQuestions as item, index (index)}
						<div class="bg-base-300 flex flex-col items-center gap-2 rounded-lg p-3">
							<img
								src={item.pokemon.image}
								alt={item.pokemon.name}
								class="h-16 w-16 object-contain"
							/>
							<span class="text-center text-sm font-medium">{item.pokemon.name}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
