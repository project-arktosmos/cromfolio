<script lang="ts">
	import adminMenuData from '$data/admin-menu.json';
	import gameMenuData from '$data/game-menu.json';
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
	<div class="flex gap-16">
		<!-- Admin Menu Column -->
		<div class="flex flex-col items-center">
			<h2 class="text-2xl font-bold mb-6 text-secondary">Admin</h2>
			<ul class="menu bg-base-100 rounded-box w-56 shadow-lg">
				{#each adminMenuData.items as item}
					<li>
						<a href={item.path} class="text-lg">{item.label}</a>
					</li>
				{/each}
			</ul>
		</div>

		<!-- Game Menu Column -->
		<div class="flex flex-col items-center">
			<h2 class="text-2xl font-bold mb-6 text-primary">Game</h2>
			<ul class="menu bg-base-100 rounded-box w-56 shadow-lg">
				{#each gameMenuData.items as item}
					<li>
						<a href={item.path} class="text-lg">{item.label}</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
