<script lang="ts">
	import menuData from '$data/game-menu.json';
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">Games</h1>
	<p class="text-base-content/70">Select a game from the sidebar to get started.</p>

	{#if menuData.items.length === 0}
		<div class="alert alert-info">
			<span>No games available yet. Add a new game by creating a folder under <code>src/routes/game/</code> with a <code>+page.svelte</code> file.</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each menuData.items as game (game.id)}
				<a href={game.path} class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
					<div class="card-body">
						<h2 class="card-title">{game.label}</h2>
						<p class="text-sm text-base-content/60">Play {game.label}</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
