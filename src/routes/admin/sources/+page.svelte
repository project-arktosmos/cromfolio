<script lang="ts">
	import classNames from 'classnames';
	import MoviesTab from './MoviesTab.svelte';
	import TVTab from './TVTab.svelte';
	import VideogamesTab from './VideogamesTab.svelte';
	import AnimeTab from './AnimeTab.svelte';
	import SportsTab from './SportsTab.svelte';
	import AnimalsTab from './AnimalsTab.svelte';
	import MusicTab from './MusicTab.svelte';
	import BooksTab from './BooksTab.svelte';

	// Top-level tab state
	let mainTab = $state<'movies' | 'tv' | 'videogames' | 'anime' | 'sports' | 'animals' | 'music' | 'books'>('movies');
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">External Sources</h1>

	<!-- Main category tabs -->
	<div class="tabs tabs-boxed mb-4">
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'movies' })}
			onclick={() => (mainTab = 'movies')}
		>
			Movies
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'tv' })}
			onclick={() => (mainTab = 'tv')}
		>
			TV
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'videogames' })}
			onclick={() => (mainTab = 'videogames')}
		>
			Videogames
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'anime' })}
			onclick={() => (mainTab = 'anime')}
		>
			Anime
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'sports' })}
			onclick={() => (mainTab = 'sports')}
		>
			Sports
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'animals' })}
			onclick={() => (mainTab = 'animals')}
		>
			Animals
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'music' })}
			onclick={() => (mainTab = 'music')}
		>
			Musicians
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': mainTab === 'books' })}
			onclick={() => (mainTab = 'books')}
		>
			Authors
		</button>
	</div>

	{#if mainTab === 'movies'}
		<MoviesTab />
	{:else if mainTab === 'tv'}
		<TVTab />
	{:else if mainTab === 'videogames'}
		<VideogamesTab />
	{:else if mainTab === 'anime'}
		<AnimeTab />
	{:else if mainTab === 'sports'}
		<SportsTab />
	{:else if mainTab === 'animals'}
		<AnimalsTab />
	{:else if mainTab === 'music'}
		<MusicTab />
	{:else}
		<BooksTab />
	{/if}
</div>
