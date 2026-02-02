<script lang="ts">
	import type { TriviaStats } from '$types/game-state.type';

	interface Props {
		title: string;
		subtitle: string;
		stats: TriviaStats;
	}

	let { title, subtitle, stats }: Props = $props();
</script>

<div class="flex items-center justify-between">
	<div>
		<h1 class="text-3xl font-bold">{title}</h1>
		<p class="text-base-content/70 mt-1">{subtitle}</p>
	</div>
	<div class="stats bg-base-200">
		<div class="stat">
			<div class="stat-title">Games Played</div>
			<div class="stat-value text-primary">{stats.totalGamesPlayed}</div>
			<div class="stat-desc">
				{stats.totalCorrect} correct / {stats.totalWrong} wrong
			</div>
		</div>
	</div>
</div>
