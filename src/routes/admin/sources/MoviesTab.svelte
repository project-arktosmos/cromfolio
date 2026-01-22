<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { addCard } from '$services/cards.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import { toastService } from '$services/toast.service';
	import {
		searchMovies,
		fetchSourceImages,
		type MovieSearchResult,
		type ImageItem as FetchImageItem,
		type CharacterItem as FetchCharacterItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';

	// Local ImageItem with selected state
	interface ImageItem extends FetchImageItem {
		selected: boolean;
	}

	interface CharacterItem extends FetchCharacterItem {
		selected: boolean;
		character: string; // Alias for characterName for compatibility
	}

	// Tab state for Movies
	let activeTab = $state<'search'>('search');

	// Search state
	let searchQuery = $state('');
	let searchYear = $state('');
	let searchResults = $state<MovieSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedResult = $state<MovieSearchResult | null>(null);

	// Image fetching state with progress
	let isLoadingImages = $state(false);
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());
	let tmdbImages = $state<ImageItem[]>([]);
	let fanartImages = $state<ImageItem[]>([]);
	let characterImages = $state<CharacterItem[]>([]);
	let tmdbId = $state<number | null>(null);
	let selectedCoverImage = $state<string | null>(null);
	let imageTab = $state<'tmdb' | 'fanart' | 'characters'>('tmdb');

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);
	let cardsCreated = $state<number>(0);

	// Search movies using Rust backend
	async function search() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];
		selectedResult = null;
		resetImages();

		try {
			const results = await searchMovies(searchQuery.trim(), searchYear.trim() || undefined);

			// Deduplicate by imdbId
			const seen = new Set<string>();
			searchResults = results.filter((result) => {
				if (seen.has(result.imdbId)) return false;
				seen.add(result.imdbId);
				return true;
			});

			if (searchResults.length === 0) {
				searchError = 'No results found';
			}
		} catch (error) {
			searchError = error instanceof Error ? error.message : 'Failed to search movies';
			console.error('[sources] search error:', error);
		} finally {
			isSearching = false;
		}
	}

	function resetImages() {
		tmdbImages = [];
		fanartImages = [];
		characterImages = [];
		tmdbId = null;
		selectedCoverImage = null;
		cardsCreated = 0;
		fetchProgress = new Map();
	}

	async function selectResult(result: MovieSearchResult) {
		if (selectedResult?.imdbId === result.imdbId) {
			selectedResult = null;
			resetImages();
		} else {
			selectedResult = result;
			albumCreated = null;
			selectedCoverImage = result.poster || null;
			await Promise.all([checkSourceExists(result.imdbId), fetchAllImages(result.imdbId)]);
		}
	}

	function handleProgress(event: FetchProgressEvent) {
		fetchProgress.set(event.source, {
			status: event.status,
			message: event.message
		});
		fetchProgress = new Map(fetchProgress);
	}

	async function fetchAllImages(imdbId: string) {
		isLoadingImages = true;
		const preservedCoverImage = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCoverImage;

		// Initialize progress for all sources
		const sources = ['tmdb', 'fanart', 'credits'];
		for (const source of sources) {
			fetchProgress.set(source, { status: 'pending' });
		}
		fetchProgress = new Map(fetchProgress);

		try {
			const result = await fetchSourceImages({
				contentType: 'movie',
				externalId: imdbId,
				externalIdType: 'imdb',
				sources,
				onProgress: handleProgress
			});

			// Process images from backend result
			const allImages = result.images;
			const allCharacters = result.characters;

			// Separate by source and add selected state
			tmdbImages = allImages
				.filter((img) => img.source === 'tmdb')
				.map((img) => ({ ...img, selected: true }));

			fanartImages = allImages
				.filter((img) => img.source === 'fanart')
				.map((img) => ({ ...img, selected: true }));

			// Process characters
			characterImages = allCharacters.map((char) => ({
				...char,
				character: char.characterName || '',
				selected: true
			}));

			// Extract TMDB ID from first TMDB image URL (it's typically in the path)
			// Or we can use the backend to return it separately - for now we'll check if any tmdb images exist
			if (tmdbImages.length > 0) {
				// TMDB ID will be tracked when we have images
				tmdbId = null; // We'll get this from backend in future enhancement
			}

			// Add fanart character art to characters section
			const fanartCharacterArt = fanartImages.filter((img) => img.imageType === 'characterart');
			for (const img of fanartCharacterArt) {
				characterImages.push({
					id: `fanart-${img.url}`,
					name: '',
					characterName: 'Character Art',
					character: 'Character Art',
					profileUrl: img.url,
					profileThumbUrl: img.thumbUrl,
					order: characterImages.length,
					source: 'fanart',
					isActorHeadshot: false,
					selected: true
				});
			}

			// Log any failed sources
			for (const failed of result.sourcesFailed) {
				console.warn(`[sources] ${failed.source} failed:`, failed.error);
			}
		} catch (error) {
			console.error('[sources] fetchAllImages error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			toastService.error(`Failed to fetch images: ${errorMessage}`);
		} finally {
			isLoadingImages = false;
		}
	}

	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	let sourceExistsMap = $state<Map<string, boolean>>(new Map());

	async function checkSourceExists(imdbId: string): Promise<boolean> {
		if (sourceExistsMap.has(imdbId)) {
			return sourceExistsMap.get(imdbId) ?? false;
		}
		const exists = await sourceExists('imdb', imdbId);
		sourceExistsMap.set(imdbId, exists);
		sourceExistsMap = new Map(sourceExistsMap);
		return exists;
	}

	async function createAlbumAndCards() {
		if (!selectedResult) return;

		isCreatingAlbum = true;
		cardsCreated = 0;

		try {
			const exists = await sourceExists('imdb', selectedResult.imdbId);
			if (exists) {
				toastService.warning('This movie has already been added');
				isCreatingAlbum = false;
				return;
			}

			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'movie',
				title: selectedResult.title,
				description: `Movie (${selectedResult.year})`,
				coverImage: selectedCoverImage || undefined,
				imdbId: selectedResult.imdbId,
				tmdbId: tmdbId || undefined,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				await createSource(createdAlbum.id, 'movie', 'imdb', selectedResult.imdbId);
				if (tmdbId) {
					await createSource(createdAlbum.id, 'movie', 'tmdb', String(tmdbId));
				}
				albumCreated = createdAlbum;

				let created = 0;

				for (const image of tmdbImages.filter((img) => img.selected)) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: `${selectedResult.title} - ${image.imageType}`,
						image: image.url,
						cardType: image.imageType as Card['cardType'],
						imageSource: 'tmdb',
						addedAt: new Date().toISOString()
					};
					try {
						await addCard(card);
						created++;
					} catch (e) {
						console.error('[sources] Failed to create card:', e);
					}
				}

				for (const image of fanartImages.filter((img) => img.selected)) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: `${selectedResult.title} - ${image.imageType}`,
						image: image.url,
						cardType: image.imageType as Card['cardType'],
						imageSource: 'fanart',
						addedAt: new Date().toISOString()
					};
					try {
						await addCard(card);
						created++;
					} catch (e) {
						console.error('[sources] Failed to create card:', e);
					}
				}

				for (const character of characterImages.filter((img) => img.selected)) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: character.name
							? `${character.name} as ${character.character}`
							: character.character || 'Character',
						image: character.profileUrl,
						cardType: character.isActorHeadshot ? 'cast' : 'character',
						imageSource: character.source,
						addedAt: new Date().toISOString()
					};
					try {
						await addCard(card);
						created++;
					} catch (e) {
						console.error('[sources] Failed to create card:', e);
					}
				}

				cardsCreated = created;

				sourceExistsMap.set(selectedResult.imdbId, true);
				sourceExistsMap = new Map(sourceExistsMap);
			}
		} catch (error) {
			console.error('[sources] createAlbumAndCards error:', error);
			toastService.error('Failed to create album');
		} finally {
			isCreatingAlbum = false;
		}
	}

	function isSourceAdded(imdbId: string): boolean {
		return sourceExistsMap.get(imdbId) ?? false;
	}

	function resetSearch() {
		searchQuery = '';
		searchYear = '';
		searchResults = [];
		searchError = null;
		selectedResult = null;
		albumCreated = null;
		resetImages();
	}

	function getCurrentImages(): ImageItem[] {
		switch (imageTab) {
			case 'tmdb':
				return tmdbImages;
			case 'fanart':
				return fanartImages;
			default:
				return [];
		}
	}

	function getImageCount(source: 'tmdb' | 'fanart' | 'characters'): number {
		switch (source) {
			case 'tmdb':
				return tmdbImages.length;
			case 'fanart':
				return fanartImages.length;
			case 'characters':
				return characterImages.length;
			default:
				return 0;
		}
	}

	function getSelectedCount(source: 'tmdb' | 'fanart' | 'characters'): number {
		switch (source) {
			case 'tmdb':
				return tmdbImages.filter((img) => img.selected).length;
			case 'fanart':
				return fanartImages.filter((img) => img.selected).length;
			case 'characters':
				return characterImages.filter((img) => img.selected).length;
			default:
				return 0;
		}
	}

	function getTotalSelectedCount(): number {
		return (
			tmdbImages.filter((img) => img.selected).length +
			fanartImages.filter((img) => img.selected).length +
			characterImages.filter((img) => img.selected).length
		);
	}

	function toggleImage(image: ImageItem) {
		image.selected = !image.selected;
		if (tmdbImages.includes(image)) {
			tmdbImages = [...tmdbImages];
		} else if (fanartImages.includes(image)) {
			fanartImages = [...fanartImages];
		}
	}

	function toggleCharacter(character: CharacterItem) {
		character.selected = !character.selected;
		characterImages = [...characterImages];
	}

	function toggleAllImages(selected: boolean) {
		switch (imageTab) {
			case 'tmdb':
				tmdbImages = tmdbImages.map((img) => ({ ...img, selected }));
				break;
			case 'fanart':
				fanartImages = fanartImages.map((img) => ({ ...img, selected }));
				break;
			case 'characters':
				characterImages = characterImages.map((img) => ({ ...img, selected }));
				break;
		}
	}

	function getSourceStatusClass(source: string): string {
		const progress = fetchProgress.get(source);
		if (!progress) return '';
		switch (progress.status) {
			case 'pending':
				return 'text-base-content/50';
			case 'fetching':
				return 'text-info';
			case 'success':
				return 'text-success';
			case 'failed':
				return 'text-error';
			default:
				return '';
		}
	}

	function getSourceStatusIcon(source: string): string {
		const progress = fetchProgress.get(source);
		if (!progress) return '';
		switch (progress.status) {
			case 'pending':
				return '...';
			case 'fetching':
				return '...';
			case 'success':
				return '✓';
			case 'failed':
				return '✗';
			default:
				return '';
		}
	}
</script>

<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="tabs tabs-boxed mb-3">
				<button
					class={classNames('tab', { 'tab-active': activeTab === 'search' })}
					onclick={() => (activeTab = 'search')}
				>
					Search
				</button>
			</div>

			<div class="flex-1 overflow-y-auto">
				{#if activeTab === 'search'}
					<div class="space-y-3">
						<div class="form-control">
							<input
								type="text"
								placeholder="Search movies..."
								class="input input-bordered input-sm w-full"
								bind:value={searchQuery}
								onkeydown={(e) => e.key === 'Enter' && search()}
							/>
						</div>

						<div class="flex gap-2">
							<input
								type="text"
								placeholder="Year"
								class="input input-bordered input-xs w-20"
								bind:value={searchYear}
							/>

							<button
								class="btn btn-primary btn-xs flex-1"
								onclick={search}
								disabled={!searchQuery.trim() || isSearching}
							>
								{#if isSearching}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									Search
								{/if}
							</button>
						</div>

						{#if searchResults.length > 0}
							<button class="btn btn-ghost btn-xs" onclick={resetSearch}> Clear </button>
						{/if}
					</div>

					{#if searchError}
						<div class="alert alert-error alert-sm mt-3">
							<span class="text-sm">{searchError}</span>
						</div>
					{/if}

					{#if searchResults.length > 0}
						<div class="mt-3 space-y-2">
							{#each searchResults as result (result.imdbId)}
								{@const alreadyExists = isSourceAdded(result.imdbId)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary':
												selectedResult?.imdbId === result.imdbId,
											'bg-base-100': selectedResult?.imdbId !== result.imdbId
										}
									)}
									onclick={() => selectResult(result)}
									onkeydown={(e) => e.key === 'Enter' && selectResult(result)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if result.poster}
											<img
												src={result.poster}
												alt={result.title}
												class="w-10 h-14 object-cover rounded"
											/>
										{:else}
											<div
												class="w-10 h-14 bg-base-300 rounded flex items-center justify-center text-base-content/30"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-5 w-5"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
													/>
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{result.title}</div>
											<div class="text-xs text-base-content/60">
												{result.year}
											</div>
											{#if alreadyExists}
												<span class="badge badge-warning badge-xs mt-1">Exists</span>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Column 2: Images (Cards) -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="flex items-center justify-between mb-2">
				<h2 class="card-title text-lg">Images (Cards)</h2>
				{#if selectedResult && !isLoadingImages}
					<span class="badge badge-primary">{getTotalSelectedCount()}</span>
				{/if}
			</div>

			{#if !selectedResult}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a result to view images.</p>
				</div>
			{:else if isLoadingImages}
				<div class="flex-1 flex flex-col items-center justify-center gap-4">
					<span class="loading loading-spinner loading-md"></span>
					<!-- Progress indicators -->
					<div class="text-xs space-y-1">
						{#each ['tmdb', 'fanart', 'credits'] as source}
							<div class="flex items-center gap-2 {getSourceStatusClass(source)}">
								<span class="w-16">{source}:</span>
								{#if fetchProgress.get(source)?.status === 'fetching'}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<span>{getSourceStatusIcon(source)}</span>
								{/if}
								{#if fetchProgress.get(source)?.message}
									<span class="text-xs opacity-70">{fetchProgress.get(source)?.message}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="tabs tabs-boxed tabs-xs mb-2">
					<button
						class={classNames('tab', { 'tab-active': imageTab === 'tmdb' })}
						onclick={() => (imageTab = 'tmdb')}
					>
						TMDB
						{#if getImageCount('tmdb') > 0}
							<span class="badge badge-xs ml-1"
								>{getSelectedCount('tmdb')}/{getImageCount('tmdb')}</span
							>
						{/if}
					</button>
					<button
						class={classNames('tab', { 'tab-active': imageTab === 'fanart' })}
						onclick={() => (imageTab = 'fanart')}
					>
						Fanart
						{#if getImageCount('fanart') > 0}
							<span class="badge badge-xs ml-1"
								>{getSelectedCount('fanart')}/{getImageCount('fanart')}</span
							>
						{/if}
					</button>
					<button
						class={classNames('tab', { 'tab-active': imageTab === 'characters' })}
						onclick={() => (imageTab = 'characters')}
					>
						Cast
						{#if getImageCount('characters') > 0}
							<span class="badge badge-xs ml-1"
								>{getSelectedCount('characters')}/{getImageCount('characters')}</span
							>
						{/if}
					</button>
				</div>

				{#if getCurrentImages().length > 0 || (imageTab === 'characters' && characterImages.length > 0)}
					<div class="flex gap-2 mb-2">
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(true)}>
							Select All
						</button>
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(false)}>
							Select None
						</button>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto">
					{#if imageTab === 'characters'}
						{@const sortedCharacters = [...characterImages].sort((a, b) => {
							if (a.isActorHeadshot !== b.isActorHeadshot) {
								return a.isActorHeadshot ? 1 : -1;
							}
							return a.order - b.order;
						})}
						{#if sortedCharacters.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No cast information available.</p>
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								{#each sortedCharacters as character (character.id)}
									<button
										class={classNames(
											'relative aspect-[2/3] rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': character.selected,
												'opacity-40': !character.selected,
												'ring-1 ring-accent/50': !character.isActorHeadshot && character.selected
											}
										)}
										onclick={() => toggleCharacter(character)}
										title={`${character.name || 'Character'} ${character.character ? `as ${character.character}` : ''} - Click to toggle selection`}
									>
										<img
											src={character.profileThumbUrl || character.profileUrl}
											alt={character.name || character.character}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
										{#if character.selected}
											<div class="absolute top-1 right-1">
												<span class="badge badge-success badge-xs">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-3 w-3"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fill-rule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												</span>
											</div>
										{/if}
										{#if !character.isActorHeadshot}
											<div class="absolute top-1 left-1">
												<span class="badge badge-accent badge-xs">Character</span>
											</div>
										{/if}
										<div class="absolute bottom-0 left-0 right-0 bg-base-300/90 px-1 py-0.5">
											{#if character.name}
												<span class="text-xs font-medium truncate block">{character.name}</span>
											{/if}
											<span class="text-xs text-base-content/70 truncate block">
												{character.character ||
													(character.isActorHeadshot ? 'Actor' : 'Character')}
											</span>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					{:else if getCurrentImages().length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p class="text-sm">No images from this source.</p>
						</div>
					{:else}
						<div class="grid grid-cols-3 gap-2">
							{#each getCurrentImages() as image, i (image.url + i)}
								<button
									class={classNames(
										'relative aspect-[2/3] rounded overflow-hidden transition-all bg-base-300',
										'hover:ring-2 hover:ring-primary',
										{
											'ring-2 ring-success': image.selected,
											'opacity-40': !image.selected
										}
									)}
									onclick={() => toggleImage(image)}
									title={`${image.imageType} - Click to toggle selection`}
								>
									<img
										src={image.thumbUrl || image.url}
										alt={image.imageType}
										class="w-full h-full object-cover"
										loading="lazy"
										onerror={(e) => {
											(e.target as HTMLImageElement).style.display = 'none';
										}}
									/>
									{#if image.selected}
										<div class="absolute top-1 right-1">
											<span class="badge badge-success badge-xs">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-3 w-3"
													viewBox="0 0 20 20"
													fill="currentColor"
												>
													<path
														fill-rule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														clip-rule="evenodd"
													/>
												</svg>
											</span>
										</div>
									{/if}
									<div class="absolute bottom-0 left-0 right-0 bg-base-300/80 px-1 py-0.5">
										<span class="text-xs truncate block">{image.imageType}</span>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedResult}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select a search result to create an album.</p>
					</div>
				{:else}
					<div class="space-y-4">
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={selectedResult.title}
									class="w-24 h-36 object-cover rounded"
								/>
							{:else}
								<div
									class="w-24 h-36 bg-base-300 rounded flex items-center justify-center text-base-content/30"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-10 w-10"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{selectedResult.title}</h3>
								<p class="text-sm text-base-content/60">{selectedResult.year}</p>
								<span class="badge badge-primary badge-sm">Movie</span>
								<a
									href="https://www.imdb.com/title/{selectedResult.imdbId}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs mt-1 block"
								>
									IMDb
								</a>
							</div>
						</div>

						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">IMDb ID:</span>
								<span class="font-mono text-xs">{selectedResult.imdbId}</span>
							</div>
							{#if tmdbId}
								<div class="flex justify-between">
									<span class="text-base-content/60">TMDB ID:</span>
									<span class="font-mono text-xs">{tmdbId}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-base-content/60">Cover:</span>
								<span class="text-xs">
									{selectedCoverImage ? 'Selected' : 'None'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Cards to import:</span>
								<span class="text-xs font-bold">{getTotalSelectedCount()}</span>
							</div>
						</div>

						{#if albumCreated}
							<div class="alert alert-success">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5 shrink-0 stroke-current"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<div>
									<span class="text-sm block">Album created!</span>
									<span class="text-xs">{cardsCreated} cards imported</span>
								</div>
							</div>
							<a href="/admin/album" class="btn btn-outline btn-sm w-full">
								Go to Album Manager
							</a>
						{:else if isSourceAdded(selectedResult.imdbId)}
							<div class="alert alert-warning">
								<span class="text-sm">This movie has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumAndCards}
								disabled={isCreatingAlbum || getTotalSelectedCount() === 0}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Album + {getTotalSelectedCount()} Cards
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
