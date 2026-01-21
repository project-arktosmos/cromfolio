<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { albumsService } from '$services/albums.service';
	import type { Album } from '$types/album.type';

	// Collection state
	let albums: Album[] = $state([]);
	let isLoading = $state(true);
	let selectedAlbum = $state<Album | null>(null);

	// Form state
	let isEditing = $state(false);
	let formTitle = $state('');
	let formDescription = $state('');
	let formCoverImage = $state('');
	let formWikiaUrl = $state('');
	let formImdbId = $state('');
	let formTmdbId = $state<number | null>(null);

	onMount(() => {
		albums = albumsService.all();
		isLoading = false;
	});

	// Reset form
	function resetForm() {
		formTitle = '';
		formDescription = '';
		formCoverImage = '';
		formWikiaUrl = '';
		formImdbId = '';
		formTmdbId = null;
		isEditing = false;
		selectedAlbum = null;
	}

	// Add a new album
	function addAlbum() {
		if (!formTitle.trim()) return;

		const album: Album = {
			id: crypto.randomUUID(),
			title: formTitle.trim(),
			description: formDescription.trim(),
			coverImage: formCoverImage.trim() || undefined,
			wikiaUrl: formWikiaUrl.trim() || undefined,
			imdbId: formImdbId.trim() || undefined,
			tmdbId: formTmdbId || undefined,
			addedAt: new Date().toISOString()
		};

		albumsService.add(album);
		albums = albumsService.all();
		resetForm();
	}

	// Update an existing album
	function updateAlbum() {
		if (!selectedAlbum || !formTitle.trim()) return;

		const updatedAlbum: Album = {
			...selectedAlbum,
			title: formTitle.trim(),
			description: formDescription.trim(),
			coverImage: formCoverImage.trim() || undefined,
			wikiaUrl: formWikiaUrl.trim() || undefined,
			imdbId: formImdbId.trim() || undefined,
			tmdbId: formTmdbId || undefined
		};

		albumsService.update(updatedAlbum);
		albums = albumsService.all();
		resetForm();
	}

	// Remove an album
	function removeAlbum(album: Album, event: MouseEvent) {
		event.stopPropagation();
		albumsService.remove(album);
		albums = albumsService.all();

		if (selectedAlbum?.id === album.id) {
			resetForm();
		}
	}

	// Select an album for editing
	function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id && !isEditing) {
			resetForm();
		} else {
			selectedAlbum = album;
			formTitle = album.title;
			formDescription = album.description;
			formCoverImage = album.coverImage || '';
			formWikiaUrl = album.wikiaUrl || '';
			formImdbId = album.imdbId || '';
			formTmdbId = album.tmdbId || null;
			isEditing = true;
		}
	}

	// Handle form submission
	function handleSubmit() {
		if (isEditing) {
			updateAlbum();
		} else {
			addAlbum();
		}
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Album Manager</h1>

	<div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
		<!-- Column 1: Albums List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Albums</h2>

				<!-- Albums list -->
				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if albums.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No albums created yet.</p>
							<p class="text-sm mt-1">Create an album using the form on the right.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each albums as album (album.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedAlbum?.id === album.id,
											'bg-base-100': selectedAlbum?.id !== album.id
										}
									)}
									onclick={() => selectAlbum(album)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(album)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-3">
										{#if album.coverImage}
											<img
												src={album.coverImage}
												alt={album.title}
												class="w-12 h-16 object-cover rounded"
											/>
										{:else}
											<div
												class="w-12 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-6 w-6"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between">
												<span class="font-medium truncate">{album.title}</span>
												<button
													class="btn btn-ghost btn-xs text-error"
													onclick={(e) => removeAlbum(album, e)}
													title="Remove album"
												>
													✕
												</button>
											</div>
											{#if album.description}
												<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
													{album.description}
												</p>
											{/if}
											{#if album.imdbId || album.tmdbId || album.wikiaUrl}
												<div class="flex items-center gap-1 mt-1 flex-wrap">
													{#if album.imdbId}
														<span class="badge badge-warning badge-xs">IMDb</span>
													{/if}
													{#if album.tmdbId}
														<span class="badge badge-success badge-xs">TMDB</span>
													{/if}
													{#if album.wikiaUrl}
														<span class="badge badge-info badge-xs">Wikia</span>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Album Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Album' : 'Create Album'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}> Cancel </button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Title -->
						<div class="form-control">
							<label class="label" for="album-title">
								<span class="label-text">Title *</span>
							</label>
							<input
								id="album-title"
								type="text"
								placeholder="Enter album title..."
								class="input input-bordered w-full"
								bind:value={formTitle}
							/>
						</div>

						<!-- Description -->
						<div class="form-control">
							<label class="label" for="album-description">
								<span class="label-text">Description *</span>
							</label>
							<textarea
								id="album-description"
								placeholder="Enter album description..."
								class="textarea textarea-bordered w-full h-24"
								bind:value={formDescription}
							></textarea>
						</div>

						<!-- Cover Image URL -->
						<div class="form-control">
							<label class="label" for="album-cover">
								<span class="label-text">Cover Image URL</span>
							</label>
							<input
								id="album-cover"
								type="text"
								placeholder="https://example.com/cover.jpg"
								class="input input-bordered w-full"
								bind:value={formCoverImage}
							/>
							{#if formCoverImage}
								<div class="mt-2">
									<img
										src={formCoverImage}
										alt="Cover preview"
										class="w-24 h-32 object-cover rounded"
										onerror={(e) => {
											(e.target as HTMLImageElement).style.display = 'none';
										}}
									/>
								</div>
							{/if}
						</div>

						<!-- IMDb ID -->
						<div class="form-control">
							<label class="label" for="album-imdb">
								<span class="label-text">IMDb ID</span>
							</label>
							<input
								id="album-imdb"
								type="text"
								placeholder="tt1234567"
								class="input input-bordered w-full"
								bind:value={formImdbId}
							/>
							{#if formImdbId}
								<label class="label">
									<a
										href="https://www.imdb.com/title/{formImdbId}"
										target="_blank"
										rel="noopener noreferrer"
										class="label-text-alt link link-primary"
									>
										View on IMDb
									</a>
								</label>
							{/if}
						</div>

						<!-- Wikia URL -->
						<div class="form-control">
							<label class="label" for="album-wikia">
								<span class="label-text">Wikia URL</span>
							</label>
							<input
								id="album-wikia"
								type="text"
								placeholder="https://example.fandom.com/wiki/Album_Name"
								class="input input-bordered w-full"
								bind:value={formWikiaUrl}
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									Use the Wikia page to link and discover this album's content
								</span>
							</label>
						</div>

						<!-- Submit button -->
						<button
							class="btn btn-primary w-full"
							onclick={handleSubmit}
							disabled={!formTitle.trim()}
						>
							{isEditing ? 'Update Album' : 'Create Album'}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
