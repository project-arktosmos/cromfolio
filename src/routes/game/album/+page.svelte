<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import {
		playerAlbumsService,
		ownsAlbum,
		acquireAlbum,
		releaseAlbum
	} from '$services/player-albums.service';
	import type { Album } from '$types/album.type';

	let albums: Album[] = $state([]);
	let isLoading = $state(true);
	let ownedAlbumIds = $state<Set<string | number>>(new Set());

	onMount(async () => {
		albums = await getAlbumCollection();
		updateOwnedSet();
		isLoading = false;

		// Subscribe to player albums changes
		const unsubscribe = playerAlbumsService.store.subscribe(() => {
			updateOwnedSet();
		});

		return () => unsubscribe();
	});

	function updateOwnedSet() {
		ownedAlbumIds = new Set(playerAlbumsService.all().map((o) => o.albumId));
	}

	function toggleOwnership(album: Album) {
		if (ownsAlbum(album.id)) {
			releaseAlbum(album.id);
		} else {
			acquireAlbum(album.id);
		}
	}

	function isOwned(albumId: string | number): boolean {
		return ownedAlbumIds.has(albumId);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Album Collection</h1>
			<p class="text-base-content/70 mt-1">
				Collect albums and track your progress
			</p>
		</div>
		<div class="stats bg-base-200">
			<div class="stat">
				<div class="stat-title">Owned</div>
				<div class="stat-value text-primary">{ownedAlbumIds.size}</div>
				<div class="stat-desc">of {albums.length} albums</div>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if albums.length === 0}
		<div class="alert alert-info">
			<span>No albums available. Create albums in the admin panel first.</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each albums as album (album.id)}
				{@const owned = isOwned(album.id)}
				<div
					class={classNames(
						'card bg-base-200 transition-all cursor-pointer',
						'hover:shadow-lg hover:scale-[1.02]',
						{
							'ring-2 ring-primary': owned,
							'opacity-60': !owned
						}
					)}
					onclick={() => toggleOwnership(album)}
					onkeydown={(e) => e.key === 'Enter' && toggleOwnership(album)}
					role="button"
					tabindex="0"
				>
					{#if album.coverImage}
						<figure class="relative">
							<img
								src={album.coverImage}
								alt={album.title}
								class="w-full h-48 object-cover"
							/>
							{#if owned}
								<div class="absolute top-2 right-2 badge badge-primary gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Owned
								</div>
							{/if}
						</figure>
					{:else}
						<figure class="relative bg-base-300 h-48 flex items-center justify-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							{#if owned}
								<div class="absolute top-2 right-2 badge badge-primary gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Owned
								</div>
							{/if}
						</figure>
					{/if}
					<div class="card-body p-4">
						<h2 class="card-title text-lg">{album.title}</h2>
						{#if album.description}
							<p class="text-sm text-base-content/60 line-clamp-2">{album.description}</p>
						{/if}
						<div class="card-actions justify-end mt-2">
							<button
								class={classNames('btn btn-sm', {
									'btn-error': owned,
									'btn-primary': !owned
								})}
								onclick={(e) => {
									e.stopPropagation();
									toggleOwnership(album);
								}}
							>
								{owned ? 'Release' : 'Acquire'}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
