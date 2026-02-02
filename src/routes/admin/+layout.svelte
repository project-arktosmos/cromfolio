<script lang="ts">
	import AdminSidebar from '$components/core/AdminSidebar.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';
	import menuData from '$data/admin-menu.json';

	let { children } = $props();
</script>

<div class="flex h-screen overflow-hidden">
	<AdminSidebar items={menuData.items} />

	<main class="bg-base-100 flex flex-1 flex-col overflow-hidden p-6">
		{@render children?.()}
	</main>
</div>

<ToastContainer />
