<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';

	interface Props {
		currentQuestionIndex: number;
		livesRemaining: number;
		maxLives: number;
		correctAnswers: number;
		difficulty: GameDifficulty;
		difficultyConfig: DifficultyConfig;
	}

	let { currentQuestionIndex, livesRemaining, maxLives, correctAnswers, difficulty, difficultyConfig }: Props =
		$props();

	const dispatch = createEventDispatcher<{
		quit: void;
	}>();
</script>

<div class="flex w-full max-w-3xl flex-col items-center gap-6">
	<!-- Navigation and progress -->
	<div class="flex w-full items-center justify-between">
		<button class="btn btn-ghost btn-sm gap-2" onclick={() => dispatch('quit')}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Quit
		</button>

		<!-- Difficulty badge -->
		<div
			class={classNames('badge badge-lg', {
				'badge-success': difficulty === 'easy',
				'badge-error': difficulty === 'hard'
			})}
		>
			{difficultyConfig.label}
		</div>

		<!-- Score display -->
		<div class="badge badge-success badge-lg gap-1">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
					clip-rule="evenodd"
				/>
			</svg>
			{correctAnswers}
		</div>
	</div>

	<!-- Lives display -->
	<div class="flex w-full items-center justify-center gap-2">
		<span class="text-base-content/70 text-sm">Lives:</span>
		<div class="flex gap-1">
			{#each Array(maxLives) as _, i}
				<span class={classNames('text-2xl transition-all', {
					'opacity-100': i < livesRemaining,
					'opacity-30 grayscale': i >= livesRemaining
				})}>❤️</span>
			{/each}
		</div>
	</div>
</div>
