<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';

	interface Props {
		currentQuestionIndex: number;
		totalQuestions: number;
		correctAnswers: number;
		wrongAnswers: number;
		difficulty: GameDifficulty;
		difficultyConfig: DifficultyConfig;
	}

	let {
		currentQuestionIndex,
		totalQuestions,
		correctAnswers,
		wrongAnswers,
		difficulty,
		difficultyConfig
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		quit: void;
	}>();

	let progressPercentage = $derived((currentQuestionIndex / totalQuestions) * 100);
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
		<div class="flex gap-4">
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
			<div class="badge badge-error badge-lg gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
				{wrongAnswers}
			</div>
		</div>
	</div>

	<!-- Progress bar -->
	<div class="w-full">
		<progress class="progress progress-primary w-full" value={progressPercentage} max="100"
		></progress>
	</div>
</div>
