<script lang="ts">
	import '../css/app.css';
	import '$services/i18n';
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import PokemonTriviaModal from '$components/core/PokemonTriviaModal.svelte';
	import BoosterPackRevealModal from '$components/core/BoosterPackRevealModal.svelte';
	import StampsModal from '$components/core/StampsModal.svelte';
	import ToastContainer from '$components/core/ToastContainer.svelte';

	interface MenuItem {
		id: string;
		path: string;
		label: string;
	}

	interface MenuData {
		items: MenuItem[];
		generatedAt: string;
	}

	import menuDataRaw from '$data/game-menu.json';
	const menuData = menuDataRaw as MenuData;

	let currentPath = $derived($page.url.pathname);

	function isActive(itemPath: string): boolean {
		return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
	}

	function getNavLinkClasses(itemPath: string): string {
		return classNames('btn btn-ghost btn-sm', {
			'btn-active': isActive(itemPath)
		});
	}

	let { children } = $props();
</script>

<div class="flex h-screen flex-col">
	<div class="navbar bg-base-300">
		<div class="navbar-start">
			<a href="/" class="btn btn-ghost text-lg font-bold">Cromfolio</a>
		</div>
		<div class="navbar-end gap-2">
			{#each menuData.items as item (item.id)}
				<a href={item.path} class={getNavLinkClasses(item.path)}>
					{item.label}
				</a>
			{/each}
			<a href="/rewards" class={getNavLinkClasses('/rewards')}>Rewards</a>
			<a href="/settings" class={getNavLinkClasses('/settings')}>Settings</a>
		</div>
	</div>

	<main class="bg-base-100 flex flex-1 flex-col overflow-y-auto">
		{@render children?.()}
	</main>
</div>

<PokemonTriviaModal />
<BoosterPackRevealModal />
<StampsModal />
<ToastContainer />
