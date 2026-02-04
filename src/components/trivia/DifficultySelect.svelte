<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { GameDifficulty, DifficultyConfig } from '$types/game-state.type';

	interface Props {
		collectionTitle: string;
		configs: Record<GameDifficulty, DifficultyConfig>;
	}

	let { collectionTitle, configs }: Props = $props();

	const dispatch = createEventDispatcher<{
		select: GameDifficulty;
	}>();
</script>

<div class="flex flex-col items-center gap-6">
	<div class="text-center">
		<h2 class="text-2xl font-bold">{collectionTitle}</h2>
		<p class="text-base-content/70">Select difficulty to begin</p>
	</div>

	<div class="grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Easy Mode -->
		<div
			class="card bg-success/10 border-success hover:bg-success/20 cursor-pointer border-2 transition-all"
			onclick={() => dispatch('select', 'easy')}
			onkeydown={(e) => e.key === 'Enter' && dispatch('select', 'easy')}
			role="button"
			tabindex="0"
		>
			<div class="card-body items-center text-center">
				<div class="mb-2 text-5xl">🌱</div>
				<h3 class="card-title text-success text-2xl">{configs.easy.label}</h3>
				<div class="text-base-content/80 space-y-2">
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-success">{configs.easy.maxLives}</span> Lives
					</p>
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-success">{configs.easy.timePerQuestion}s</span> Per Question
					</p>
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-success">{configs.easy.answerCount}</span> Answer Choices
					</p>
				</div>
				<button class="btn btn-success btn-wide mt-4">Start Easy</button>
			</div>
		</div>

		<!-- Hard Mode -->
		<div
			class="card bg-error/10 border-error hover:bg-error/20 cursor-pointer border-2 transition-all"
			onclick={() => dispatch('select', 'hard')}
			onkeydown={(e) => e.key === 'Enter' && dispatch('select', 'hard')}
			role="button"
			tabindex="0"
		>
			<div class="card-body items-center text-center">
				<div class="mb-2 text-5xl">🔥</div>
				<h3 class="card-title text-error text-2xl">{configs.hard.label}</h3>
				<div class="text-base-content/80 space-y-2">
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-error">{configs.hard.maxLives}</span> Life
					</p>
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-error">{configs.hard.timePerQuestion}s</span> Per Question
					</p>
					<p class="flex items-center justify-center gap-2">
						<span class="badge badge-error">{configs.hard.answerCount}</span> Answer Choices
					</p>
				</div>
				<button class="btn btn-error btn-wide mt-4">Start Hard</button>
			</div>
		</div>
	</div>
</div>
