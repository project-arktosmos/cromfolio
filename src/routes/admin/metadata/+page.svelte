<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import { getCardCollection, getCardsByAlbum } from '$services/cards.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';

	type SourceTab = 'movies' | 'videogames' | 'anime' | 'sports' | 'animals' | 'music' | 'books';

	let activeTab = $state<SourceTab>('movies');
	let albums = $state<Album[]>([]);
	let cards = $state<Card[]>([]);
	let loading = $state(true);
	let expandedAlbums = $state<Set<string>>(new Set());
	let albumCards = $state<Map<string, Card[]>>(new Map());

	// Filter albums by source type
	let movieAlbums = $derived(albums.filter((a) => a.imdbId || a.tmdbId));
	let videogameAlbums = $derived(albums.filter((a) => a.igdbId));
	let animeAlbums = $derived(albums.filter((a) => a.anilistId));
	let sportsAlbums = $derived(albums.filter((a) => a.sportsDbTeamId || a.sportsDbLeagueId));
	let animalAlbums = $derived(albums.filter((a) => a.wikidataId && a.scientificName));
	let musicAlbums = $derived(albums.filter((a) => a.musicbrainzArtistId));
	let bookAlbums = $derived(albums.filter((a) => a.openLibraryAuthorId || a.openLibraryWorkId));

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			[albums, cards] = await Promise.all([getAlbumCollection(), getCardCollection()]);
		} catch (e) {
			console.error('Failed to load data:', e);
		}
		loading = false;
	}

	async function toggleAlbumExpand(albumId: string) {
		const newSet = new Set(expandedAlbums);
		if (newSet.has(albumId)) {
			newSet.delete(albumId);
		} else {
			newSet.add(albumId);
			// Load cards for this album if not already loaded
			if (!albumCards.has(albumId)) {
				const albumCardsData = await getCardsByAlbum(albumId);
				albumCards = new Map(albumCards).set(albumId, albumCardsData);
			}
		}
		expandedAlbums = newSet;
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString();
	}

	function formatArray(arr?: string[]): string {
		if (!arr || arr.length === 0) return '-';
		return arr.join(', ');
	}
</script>

<div class="p-4">
	<h1 class="text-2xl font-bold mb-4">Metadata Browser</h1>

	<!-- Tabs -->
	<div class="tabs tabs-boxed mb-4">
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'movies' })}
			onclick={() => (activeTab = 'movies')}
		>
			Movies/TV ({movieAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'videogames' })}
			onclick={() => (activeTab = 'videogames')}
		>
			Videogames ({videogameAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'anime' })}
			onclick={() => (activeTab = 'anime')}
		>
			Anime ({animeAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'sports' })}
			onclick={() => (activeTab = 'sports')}
		>
			Sports ({sportsAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'animals' })}
			onclick={() => (activeTab = 'animals')}
		>
			Animals ({animalAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'music' })}
			onclick={() => (activeTab = 'music')}
		>
			Music ({musicAlbums.length})
		</button>
		<button
			class={classNames('tab tab-lg', { 'tab-active': activeTab === 'books' })}
			onclick={() => (activeTab = 'books')}
		>
			Books ({bookAlbums.length})
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<!-- Movies/TV Tab -->
		{#if activeTab === 'movies'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>IMDB ID</th>
							<th>TMDB ID</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each movieAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td><code class="text-xs">{album.imdbId || '-'}</code></td>
								<td><code class="text-xs">{album.tmdbId || '-'}</code></td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-14 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="6" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											<p><strong>Wikia URL:</strong> {album.wikiaUrl || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if movieAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No movies/TV shows added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Videogames Tab -->
		{#if activeTab === 'videogames'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>IGDB ID</th>
							<th>IGDB Slug</th>
							<th>SGDB ID</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each videogameAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td><code class="text-xs">{album.igdbId || '-'}</code></td>
								<td><code class="text-xs">{album.igdbSlug || '-'}</code></td>
								<td><code class="text-xs">{album.sgdbId || '-'}</code></td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-14 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="7" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if videogameAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No videogames added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Anime Tab -->
		{#if activeTab === 'anime'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>AniList ID</th>
							<th>MAL ID</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each animeAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td><code class="text-xs">{album.anilistId || '-'}</code></td>
								<td><code class="text-xs">{album.malId || '-'}</code></td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-14 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="6" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if animeAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No anime added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Sports Tab -->
		{#if activeTab === 'sports'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>Type</th>
							<th>Team ID</th>
							<th>League ID</th>
							<th>Sport</th>
							<th>League</th>
							<th>Country</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each sportsAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td><span class="badge badge-sm">{album.sportsType || '-'}</span></td>
								<td><code class="text-xs">{album.sportsDbTeamId || '-'}</code></td>
								<td><code class="text-xs">{album.sportsDbLeagueId || '-'}</code></td>
								<td>{album.sport || '-'}</td>
								<td>{album.league || '-'}</td>
								<td>{album.country || '-'}</td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-10 object-contain rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="10" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if sportsAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No sports teams/leagues added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Animals Tab -->
		{#if activeTab === 'animals'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>Scientific Name</th>
							<th>Wikidata ID</th>
							<th>Class</th>
							<th>Conservation</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each animalAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td class="italic">{album.scientificName || '-'}</td>
								<td><code class="text-xs">{album.wikidataId || '-'}</code></td>
								<td>{album.taxonomicClass || '-'}</td>
								<td>
									{#if album.conservationStatus}
										<span class="badge badge-sm">{album.conservationStatus}</span>
									{:else}
										-
									{/if}
								</td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-10 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="8" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if animalAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No animals added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Music Tab -->
		{#if activeTab === 'music'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>Artist</th>
							<th>Type</th>
							<th>MusicBrainz ID</th>
							<th>Genres</th>
							<th>Year</th>
							<th>Label</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each musicAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td>{album.artistName || '-'}</td>
								<td><span class="badge badge-sm">{album.musicType || '-'}</span></td>
								<td><code class="text-xs">{album.musicbrainzArtistId || '-'}</code></td>
								<td class="text-xs">{formatArray(album.musicGenres)}</td>
								<td>{album.releaseYear || '-'}</td>
								<td>{album.recordLabel || '-'}</td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-10 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="10" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if album.musicbrainzReleaseId}
												<p><strong>Release ID:</strong> <code>{album.musicbrainzReleaseId}</code></p>
											{/if}
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Releases ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="flex items-center gap-2 p-2 bg-base-100 rounded">
															{#if card.image}
																<img src={card.image} alt={card.name} class="w-8 h-8 object-cover rounded" />
															{/if}
															<div class="text-xs">
																<div class="font-medium">{card.name}</div>
																{#if card.releaseType}<span class="badge badge-xs">{card.releaseType}</span>{/if}
																{#if card.releaseYear}<span class="opacity-60">({card.releaseYear})</span>{/if}
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if musicAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No music artists added yet</div>
				{/if}
			</div>
		{/if}

		<!-- Books Tab -->
		{#if activeTab === 'books'}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th></th>
							<th>Title</th>
							<th>Author</th>
							<th>Type</th>
							<th>Author ID</th>
							<th>Work ID</th>
							<th>Subjects</th>
							<th>First Published</th>
							<th>Publisher</th>
							<th>Cover</th>
							<th>Added</th>
						</tr>
					</thead>
					<tbody>
						{#each bookAlbums as album (album.id)}
							<tr class="hover">
								<td>
									<button class="btn btn-xs btn-ghost" onclick={() => toggleAlbumExpand(String(album.id))}>
										{expandedAlbums.has(String(album.id)) ? '▼' : '▶'}
									</button>
								</td>
								<td class="font-medium">{album.title}</td>
								<td>{album.authorName || '-'}</td>
								<td><span class="badge badge-sm">{album.bookType || '-'}</span></td>
								<td><code class="text-xs">{album.openLibraryAuthorId || '-'}</code></td>
								<td><code class="text-xs">{album.openLibraryWorkId || '-'}</code></td>
								<td class="text-xs max-w-xs truncate">{formatArray(album.bookSubjects)}</td>
								<td>{album.firstPublishYear || '-'}</td>
								<td>{album.publisher || '-'}</td>
								<td>
									{#if album.coverImage}
										<img src={album.coverImage} alt={album.title} class="w-10 h-14 object-cover rounded" />
									{:else}
										-
									{/if}
								</td>
								<td class="text-xs">{formatDate(album.addedAt)}</td>
							</tr>
							{#if expandedAlbums.has(String(album.id))}
								<tr class="bg-base-200">
									<td colspan="11" class="p-4">
										<div class="text-sm">
											<p><strong>Description:</strong> {album.description || '-'}</p>
											{#if albumCards.has(String(album.id))}
												<p class="mt-2"><strong>Cards ({albumCards.get(String(album.id))?.length || 0}):</strong></p>
												<div class="flex flex-wrap gap-2 mt-1">
													{#each albumCards.get(String(album.id)) || [] as card (card.id)}
														<div class="badge badge-outline">{card.name}</div>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if bookAlbums.length === 0}
					<div class="text-center py-8 text-base-content/60">No books added yet</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
