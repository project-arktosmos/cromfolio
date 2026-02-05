<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';

	interface Props {
		correctAnswers: number;
		difficulty: GameDifficulty;
		difficultyConfig: DifficultyConfig;
		boosterPacksClaimed?: boolean;
	}

	let {
		correctAnswers,
		difficulty,
		difficultyConfig,
		boosterPacksClaimed = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		playAgain: void;
		claimBoosterPacks: { packCount: number };
	}>();

	// Calculate earned booster packs (1 per 3 correct answers)
	let earnedPacks = $derived(Math.floor(correctAnswers / 3));

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
				You answered {correctAnswers} question{correctAnswers !== 1 ? 's' : ''} correctly before running
				out of lives!
			</p>

			<div class="stats bg-base-300 mt-6">
				<div class="stat">
					<div class="stat-title">Score</div>
					<div class="stat-value text-success">{correctAnswers}</div>
				</div>
				{#if earnedPacks > 0}
					<div class="stat">
						<div class="stat-title">Packs Earned</div>
						<div class="stat-value text-primary">{earnedPacks}</div>
					</div>
				{/if}
			</div>

			<!-- Booster Pack Reward Section -->
			<div class="bg-primary/10 border-primary/30 mt-4 rounded-lg border p-4 text-center">
				{#if boosterPacksClaimed}
					<p class="text-success font-medium">Booster packs claimed!</p>
				{:else if earnedPacks > 0}
					<p class="mb-2 text-sm">
						You earned <span class="text-primary font-bold">{earnedPacks}</span> booster pack{earnedPacks !==
						1
							? 's'
							: ''}!
					</p>
					<button
						class="btn btn-primary"
						onclick={() => dispatch('claimBoosterPacks', { packCount: earnedPacks })}
					>
						Open Booster Pack{earnedPacks !== 1 ? 's' : ''}
					</button>
				{:else}
					<p class="text-base-content/50 mb-2 text-sm">
						Get 3+ correct answers to earn booster packs!
					</p>
					<button class="btn btn-primary" disabled> Open Booster Packs </button>
				{/if}
			</div>

			<div class="card-actions mt-6">
				<button class="btn btn-primary" onclick={() => dispatch('playAgain')}>Play Again</button>
			</div>
		</div>
	</div>
</div>
