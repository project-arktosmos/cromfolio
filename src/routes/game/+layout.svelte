<script lang="ts">
	import GameSidebar from '$components/core/GameSidebar.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/game-menu.json';

	let { children } = $props();
</script>

<div class="flex h-screen">
	<GameSidebar items={menuData.items} />

	<main class="bg-base-100 flex flex-1 flex-col overflow-hidden p-6">
		{@render children?.()}
	</main>
</div>

<ToastContainer />
