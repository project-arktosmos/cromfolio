<script lang="ts">
	import AdminSidebar from '$components/core/AdminSidebar.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/admin-menu.json';

	let { children } = $props();
</script>

<div class="flex h-screen overflow-hidden">
	<AdminSidebar items={menuData.items} />

	<main class="flex-1 p-6 bg-base-100 overflow-hidden flex flex-col">
		{@render children?.()}
	</main>
</div>

<ToastContainer />
