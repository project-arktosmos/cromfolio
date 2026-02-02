<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';

	interface Props {
		correctAnswers: number;
		wrongAnswers: number;
		totalQuestions: number;
		difficulty: GameDifficulty;
		difficultyConfig: DifficultyConfig;
	}

	let { correctAnswers, wrongAnswers, totalQuestions, difficulty, difficultyConfig }: Props =
		$props();

	const dispatch = createEventDispatcher<{
		playAgain: void;
		changeCollection: void;
	}>();

	let scorePercentage = $derived(Math.round((correctAnswers / totalQuestions) * 100));

	function getResultEmoji(): string {
		if (correctAnswers === totalQuestions) return '🏆';
		if (correctAnswers >= totalQuestions / 2) return '🎉';
		return '📚';
	}

	function getResultMessage(): string {
		if (correctAnswers === totalQuestions) return 'Perfect Score!';
		if (correctAnswers >= totalQuestions / 2) return 'Good Job!';
		return 'Keep Learning!';
	}

	function getResultColorClass(): string {
		if (correctAnswers === totalQuestions) return 'text-success';
		if (correctAnswers >= totalQuestions / 2) return 'text-primary';
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
				You answered {correctAnswers} out of {totalQuestions} questions correctly.
			</p>

			<div class="stats stats-vertical sm:stats-horizontal bg-base-300 mt-6">
				<div class="stat">
					<div class="stat-title">Correct</div>
					<div class="stat-value text-success">{correctAnswers}</div>
				</div>
				<div class="stat">
					<div class="stat-title">Wrong</div>
					<div class="stat-value text-error">{wrongAnswers}</div>
				</div>
				<div class="stat">
					<div class="stat-title">Score</div>
					<div class="stat-value text-primary">{scorePercentage}%</div>
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
</div>
