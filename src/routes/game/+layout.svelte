<script lang="ts">
	import GameSidebar from '$components/core/GameSidebar.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/game-menu.json';

	let { children } = $props();
</script>

<div class="flex min-h-screen">
	<GameSidebar items={menuData.items} />

	<main class="flex-1 p-6 bg-base-100">
		{@render children?.()}
	</main>
</div>

<ToastContainer />
