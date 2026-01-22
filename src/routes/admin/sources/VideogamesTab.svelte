<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { addCard } from '$services/cards.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import { toastService } from '$services/toast.service';
	import {
		searchGames,
		fetchSourceImages,
		type GameSearchResult,
		type ImageItem as FetchImageItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';

	// Local ImageItem with selected state
	interface ImageItem extends FetchImageItem {
		selected: boolean;
	}

	// Videogames search state
	let searchQuery = $state('');
	let searchResults = $state<GameSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedGame = $state<GameSearchResult | null>(null);

	// Game images state with progress
	let isLoadingImages = $state(false);
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());
	let igdbImages = $state<ImageItem[]>([]);
	let sgdbImages = $state<ImageItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);
	let imageTab = $state<'igdb' | 'sgdb'>('igdb');

	// Game album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);
	let cardsCreated = $state<number>(0);

	// Source existence tracking
	let sourceExistsMap = $state<Map<number, boolean>>(new Map());

	// Search games via Rust backend
	async function search() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];
		selectedGame = null;
		resetImages();

		try {
			const results = await searchGames(searchQuery.trim());

			if (results.length > 0) {
				searchResults = results;
			} else {
				searchError = 'No results found';
			}
		} catch (error) {
			searchError = error instanceof Error ? error.message : 'Failed to search games';
			console.error('[sources] search error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Reset images
	function resetImages() {
		igdbImages = [];
		sgdbImages = [];
		selectedCoverImage = null;
		cardsCreated = 0;
		fetchProgress = new Map();
	}

	// Check if source already exists in database
	async function checkSourceExists(game: GameSearchResult): Promise<boolean> {
		if (sourceExistsMap.has(game.id)) {
			return sourceExistsMap.get(game.id)!;
		}
		const sourceType = game.source || 'igdb';
		const exists = await sourceExists(sourceType, String(game.id));
		sourceExistsMap = new Map(sourceExistsMap).set(game.id, exists);
		return exists;
	}

	// Check if source is already added (from cache)
	function isSourceAdded(gameId: number): boolean {
		return sourceExistsMap.get(gameId) ?? false;
	}

	// Select a game and fetch images
	async function selectGame(game: GameSearchResult) {
		if (selectedGame?.id === game.id) {
			selectedGame = null;
			resetImages();
		} else {
			selectedGame = game;
			albumCreated = null;
			selectedCoverImage = game.coverUrl || null;
			// Check source existence and fetch images in parallel
			await Promise.all([checkSourceExists(game), fetchAllImages(game.id)]);
		}
	}

	function handleProgress(event: FetchProgressEvent) {
		fetchProgress.set(event.source, {
			status: event.status,
			message: event.message
		});
		fetchProgress = new Map(fetchProgress);
	}

	// Fetch images for a game
	async function fetchAllImages(gameId: number) {
		isLoadingImages = true;
		const preservedCover = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCover;

		// Determine source type from selected game
		const idType = selectedGame?.source || 'igdb';

		// Only fetch from sources that work with our ID type
		// IGDB images require IGDB IDs, SGDB images work with SGDB IDs
		const sources = idType === 'igdb' ? ['igdb', 'sgdb'] : ['sgdb'];
		for (const source of sources) {
			fetchProgress.set(source, { status: 'pending' });
		}
		fetchProgress = new Map(fetchProgress);

		try {
			const result = await fetchSourceImages({
				contentType: 'game',
				externalId: String(gameId),
				externalIdType: idType,
				sources,
				onProgress: handleProgress
			});

			// Process images from backend result
			const allImages = result.images;

			// Separate by source and add selected state
			igdbImages = allImages
				.filter((img) => img.source === 'igdb')
				.map((img) => ({ ...img, selected: true }));

			sgdbImages = allImages
				.filter((img) => img.source === 'sgdb')
				.map((img) => ({ ...img, selected: true }));

			// Log any failed sources
			for (const failed of result.sourcesFailed) {
				console.warn(`[sources] ${failed.source} failed:`, failed.error);
			}
		} catch (error) {
			console.error('[sources] fetchAllImages error:', error);
			toastService.error('Failed to fetch images');
		} finally {
			isLoadingImages = false;
		}
	}

	// Select a game image as cover
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Get release year from game
	function getReleaseYear(game: GameSearchResult): string {
		if (game.firstReleaseDate) {
			return new Date(game.firstReleaseDate * 1000).getFullYear().toString();
		}
		return 'TBA';
	}

	// Create album from selected game
	async function createAlbumAndCards() {
		if (!selectedGame) return;

		isCreatingAlbum = true;
		cardsCreated = 0;

		const sourceType = selectedGame.source || 'igdb';

		try {
			// Check if already added
			const alreadyAdded = await sourceExists(sourceType, String(selectedGame.id));
			if (alreadyAdded) {
				toastService.warning('This game has already been added');
				isCreatingAlbum = false;
				return;
			}

			const genreNames = selectedGame.genres?.join(', ') || '';
			const releaseYear = getReleaseYear(selectedGame);

			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'videogame',
				title: selectedGame.name,
				description: `Game${releaseYear !== 'TBA' ? ` (${releaseYear})` : ''}${genreNames ? ` - ${genreNames}` : ''}`,
				coverImage: selectedCoverImage || undefined,
				igdbId: sourceType === 'igdb' ? selectedGame.id : undefined,
				sgdbId: sourceType === 'sgdb' ? selectedGame.id : undefined,
				igdbSlug: selectedGame.slug,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'game', sourceType, String(selectedGame.id));
				albumCreated = createdAlbum;

				let created = 0;

				// Add cards from IGDB images
				for (const image of igdbImages.filter((img) => img.selected)) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: `${selectedGame.name} - ${image.imageType}`,
						image: image.url,
						cardType: image.imageType as Card['cardType'],
						imageSource: 'igdb',
						addedAt: new Date().toISOString()
					};
					try {
						await addCard(card);
						created++;
					} catch (e) {
						console.error('[sources] Failed to create card:', e);
					}
				}

				// Add cards from SGDB images
				for (const image of sgdbImages.filter((img) => img.selected)) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: `${selectedGame.name} - ${image.imageType}`,
						image: image.url,
						cardType: image.imageType as Card['cardType'],
						imageSource: 'sgdb',
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

				// Update local cache
				sourceExistsMap = new Map(sourceExistsMap).set(selectedGame.id, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumAndCards error:', error);
			toastService.error('Failed to create album');
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Reset game search
	function resetSearch() {
		searchQuery = '';
		searchResults = [];
		searchError = null;
		selectedGame = null;
		albumCreated = null;
		resetImages();
	}

	// Get current game images based on selected tab
	function getCurrentImages(): ImageItem[] {
		switch (imageTab) {
			case 'igdb':
				return igdbImages;
			case 'sgdb':
				return sgdbImages;
			default:
				return [];
		}
	}

	// Get game image count for badge
	function getImageCount(source: 'igdb' | 'sgdb'): number {
		switch (source) {
			case 'igdb':
				return igdbImages.length;
			case 'sgdb':
				return sgdbImages.length;
			default:
				return 0;
		}
	}

	function getSelectedCount(source: 'igdb' | 'sgdb'): number {
		switch (source) {
			case 'igdb':
				return igdbImages.filter((img) => img.selected).length;
			case 'sgdb':
				return sgdbImages.filter((img) => img.selected).length;
			default:
				return 0;
		}
	}

	function getTotalSelectedCount(): number {
		return (
			igdbImages.filter((img) => img.selected).length +
			sgdbImages.filter((img) => img.selected).length
		);
	}

	function toggleImage(image: ImageItem) {
		image.selected = !image.selected;
		if (igdbImages.includes(image)) {
			igdbImages = [...igdbImages];
		} else if (sgdbImages.includes(image)) {
			sgdbImages = [...sgdbImages];
		}
	}

	function toggleAllImages(selected: boolean) {
		switch (imageTab) {
			case 'igdb':
				igdbImages = igdbImages.map((img) => ({ ...img, selected }));
				break;
			case 'sgdb':
				sgdbImages = sgdbImages.map((img) => ({ ...img, selected }));
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
	<!-- Column 1: Game Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Games</h2>

			<div class="space-y-3">
				<!-- Search input -->
				<div class="form-control">
					<input
						type="text"
						placeholder="Search videogames..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && search()}
					/>
				</div>

				<!-- Search button -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={search}
						disabled={!searchQuery.trim() || isSearching}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Search
						{/if}
					</button>

					{#if searchResults.length > 0}
						<button class="btn btn-ghost btn-sm" onclick={resetSearch}> Clear </button>
					{/if}
				</div>
			</div>

			<!-- Error message -->
			{#if searchError}
				<div class="alert alert-error alert-sm mt-3">
					<span class="text-sm">{searchError}</span>
				</div>
			{/if}

			<!-- Results -->
			<div class="flex-1 overflow-y-auto mt-3">
				{#if searchResults.length > 0}
					<div class="space-y-2">
						{#each searchResults as game (game.id)}
							{@const alreadyExists = isSourceAdded(game.id)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedGame?.id === game.id,
										'bg-base-100': selectedGame?.id !== game.id
									}
								)}
								onclick={() => selectGame(game)}
								onkeydown={(e) => e.key === 'Enter' && selectGame(game)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if game.coverThumbUrl}
										<img
											src={game.coverThumbUrl}
											alt={game.name}
											class="w-14 h-10 object-cover rounded"
										/>
									{:else}
										<div
											class="w-14 h-10 bg-base-300 rounded flex items-center justify-center text-base-content/30"
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
													d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
												/>
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{game.name}</div>
										<div class="text-xs text-base-content/60">
											{getReleaseYear(game)}
											{#if game.rating}
												&middot; Rating: {Math.round(game.rating)}
											{/if}
										</div>
										{#if game.genres && game.genres.length > 0}
											<div class="text-xs text-base-content/50 truncate">
												{game.genres.slice(0, 3).join(', ')}
											</div>
										{/if}
										{#if alreadyExists}
											<span class="badge badge-warning badge-xs mt-1">Exists</span>
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

	<!-- Column 2: Game Images -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="flex items-center justify-between mb-2">
				<h2 class="card-title text-lg">Images (Cards)</h2>
				{#if selectedGame && !isLoadingImages}
					<span class="badge badge-primary">{getTotalSelectedCount()}</span>
				{/if}
			</div>

			{#if !selectedGame}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a game to view images.</p>
				</div>
			{:else if isLoadingImages}
				<div class="flex-1 flex flex-col items-center justify-center gap-4">
					<span class="loading loading-spinner loading-md"></span>
					<!-- Progress indicators -->
					<div class="text-xs space-y-1">
						{#each ['igdb', 'sgdb'] as source}
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
				<!-- Image source tabs -->
				<div class="tabs tabs-boxed tabs-xs mb-3">
					<button
						class={classNames('tab', { 'tab-active': imageTab === 'igdb' })}
						onclick={() => (imageTab = 'igdb')}
					>
						IGDB
						{#if getImageCount('igdb') > 0}
							<span class="badge badge-xs ml-1"
								>{getSelectedCount('igdb')}/{getImageCount('igdb')}</span
							>
						{/if}
					</button>
					<button
						class={classNames('tab', { 'tab-active': imageTab === 'sgdb' })}
						onclick={() => (imageTab = 'sgdb')}
					>
						SteamGridDB
						{#if getImageCount('sgdb') > 0}
							<span class="badge badge-xs ml-1"
								>{getSelectedCount('sgdb')}/{getImageCount('sgdb')}</span
							>
						{/if}
					</button>
				</div>

				{#if getCurrentImages().length > 0}
					<div class="flex gap-2 mb-2">
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(true)}>
							Select All
						</button>
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(false)}>
							Select None
						</button>
					</div>
				{/if}

				<!-- Image grid -->
				<div class="flex-1 overflow-y-auto">
					{#if getCurrentImages().length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p class="text-sm">No images from this source.</p>
						</div>
					{:else}
						<div class="grid grid-cols-3 gap-2">
							{#each getCurrentImages() as image, i (image.url + i)}
								<button
									class={classNames(
										'relative aspect-video rounded overflow-hidden transition-all bg-base-300',
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

	<!-- Column 3: Game Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedGame}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select a game to create an album.</p>
					</div>
				{:else}
					<div class="space-y-4">
						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={selectedGame.name}
									class="w-24 h-16 object-cover rounded"
								/>
							{:else}
								<div
									class="w-24 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30"
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
											d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{selectedGame.name}</h3>
								<p class="text-sm text-base-content/60">
									{getReleaseYear(selectedGame)}
								</p>
								{#if selectedGame.genres && selectedGame.genres.length > 0}
									<p class="text-xs text-base-content/50">
										{selectedGame.genres.join(', ')}
									</p>
								{/if}
								<span class="badge badge-accent badge-sm mt-1">Game</span>
							</div>
						</div>

						<!-- Album details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">IGDB ID:</span>
								<span class="font-mono text-xs">{selectedGame.id}</span>
							</div>
							{#if selectedGame.rating}
								<div class="flex justify-between">
									<span class="text-base-content/60">Rating:</span>
									<span class="font-mono text-xs">{Math.round(selectedGame.rating)}</span>
								</div>
							{/if}
							{#if selectedGame.platforms && selectedGame.platforms.length > 0}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Platforms:</span>
									<span class="text-xs text-right max-w-[60%]">
										{selectedGame.platforms.slice(0, 3).join(', ')}
										{#if selectedGame.platforms.length > 3}
											...
										{/if}
									</span>
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

						<!-- Create button -->
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
						{:else if isSourceAdded(selectedGame.id)}
							<div class="alert alert-warning">
								<span class="text-sm">This game has already been added.</span>
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
