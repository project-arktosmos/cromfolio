<script lang="ts">
	import gameMenuData from '$data/game-menu.json';
</script>

<div class="bg-base-200 flex min-h-screen items-center justify-center">
	<div class="flex flex-col items-center">
		<h2 class="text-primary mb-6 text-2xl font-bold">Games</h2>
		<ul class="menu bg-base-100 rounded-box w-56 shadow-lg">
			{#each gameMenuData.items as item}
				<li>
					<a href={item.path} class="text-lg">{item.label}</a>
				</li>
			{/each}
		</ul>
	</div>
</div>
