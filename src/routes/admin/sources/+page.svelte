<script lang="ts">
	import classNames from 'classnames';
	import { albumsService } from '$services/albums.service';
	import type { Album } from '$types/album.type';

	// Tab state
	let activeTab = $state<'omdb'>('omdb');

	// OMDB search state
	let omdbSearchQuery = $state('');
	let omdbSearchType = $state<'movie' | 'series' | 'episode' | ''>('');
	let omdbYear = $state('');
	let omdbResults = $state<OMDBSearchResult[]>([]);
	let isSearchingOmdb = $state(false);
	let omdbError = $state<string | null>(null);
	let selectedResult = $state<OMDBSearchResult | null>(null);

	// Image fetching state
	let isLoadingImages = $state(false);
	let tmdbImages = $state<ImageItem[]>([]);
	let fanartImages = $state<ImageItem[]>([]);
	let tvmazeImages = $state<ImageItem[]>([]);
	let tmdbId = $state<number | null>(null);
	let mediaType = $state<'movie' | 'tv' | null>(null);
	let selectedCoverImage = $state<string | null>(null);
	let imageTab = $state<'tmdb' | 'fanart' | 'tvmaze'>('tmdb');

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);

	// Types
	interface OMDBSearchResult {
		Title: string;
		Year: string;
		imdbID: string;
		Type: string;
		Poster: string;
	}

	interface ImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		width?: number;
		height?: number;
		source: 'tmdb' | 'fanart' | 'tvmaze';
	}

	// Search OMDB
	async function searchOmdb() {
		if (!omdbSearchQuery.trim()) return;

		isSearchingOmdb = true;
		omdbError = null;
		omdbResults = [];
		selectedResult = null;
		resetImages();

		try {
			const params = new URLSearchParams({
				s: omdbSearchQuery.trim()
			});

			if (omdbSearchType) {
				params.set('type', omdbSearchType);
			}
			if (omdbYear.trim()) {
				params.set('y', omdbYear.trim());
			}

			const response = await fetch(`/api/omdb/search?${params.toString()}`);
			const data = await response.json();

			if (data.error) {
				omdbError = data.error;
			} else if (data.Response === 'False') {
				omdbError = data.Error || 'No results found';
			} else {
				// Deduplicate results by imdbID (OMDB sometimes returns duplicates)
				const seen = new Set<string>();
				omdbResults = (data.Search || []).filter((result: OMDBSearchResult) => {
					if (seen.has(result.imdbID)) return false;
					seen.add(result.imdbID);
					return true;
				});
			}
		} catch (error) {
			omdbError = 'Failed to search OMDB';
			console.error('[sources] searchOmdb error:', error);
		} finally {
			isSearchingOmdb = false;
		}
	}

	// Reset images state
	function resetImages() {
		tmdbImages = [];
		fanartImages = [];
		tvmazeImages = [];
		tmdbId = null;
		mediaType = null;
		selectedCoverImage = null;
	}

	// Select a result and fetch images
	async function selectResult(result: OMDBSearchResult) {
		if (selectedResult?.imdbID === result.imdbID) {
			selectedResult = null;
			resetImages();
		} else {
			selectedResult = result;
			albumCreated = null;
			selectedCoverImage = result.Poster !== 'N/A' ? result.Poster : null;
			await fetchAllImages(result.imdbID);
		}
	}

	// Fetch images from all APIs
	async function fetchAllImages(imdbId: string) {
		isLoadingImages = true;
		resetImages();

		try {
			// Fetch from all APIs in parallel
			const [tmdbResult, tvmazeResult] = await Promise.all([
				fetch(`/api/tmdb/images?imdbId=${imdbId}`).then((r) => r.json()).catch(() => null),
				fetch(`/api/tvmaze/images?imdbId=${imdbId}`).then((r) => r.json()).catch(() => null)
			]);

			// Process TMDB results
			if (tmdbResult && !tmdbResult.error) {
				tmdbId = tmdbResult.tmdbId;
				mediaType = tmdbResult.mediaType;

				const images: ImageItem[] = [];

				// Add posters
				for (const img of tmdbResult.posters || []) {
					images.push({
						url: img.url,
						thumbUrl: img.thumbUrl,
						type: 'poster',
						width: img.width,
						height: img.height,
						source: 'tmdb'
					});
				}

				// Add backdrops
				for (const img of tmdbResult.backdrops || []) {
					images.push({
						url: img.url,
						thumbUrl: img.thumbUrl,
						type: 'backdrop',
						width: img.width,
						height: img.height,
						source: 'tmdb'
					});
				}

				// Add logos
				for (const img of tmdbResult.logos || []) {
					images.push({
						url: img.url,
						thumbUrl: img.thumbUrl,
						type: 'logo',
						width: img.width,
						height: img.height,
						source: 'tmdb'
					});
				}

				tmdbImages = images;

				// Fetch Fanart.tv images if we have a TMDB ID
				if (tmdbId) {
					try {
						const fanartResult = await fetch(
							`/api/fanart/images?tmdbId=${tmdbId}&type=${mediaType}`
						).then((r) => r.json());

						if (fanartResult && !fanartResult.error && fanartResult.images) {
							fanartImages = fanartResult.images.map((img: { url: string; thumbUrl: string; type: string }) => ({
								url: img.url,
								thumbUrl: img.thumbUrl,
								type: img.type,
								source: 'fanart' as const
							}));
						}
					} catch (e) {
						console.error('[sources] Fanart.tv fetch error:', e);
					}
				}
			}

			// Process TVMaze results (TV shows only)
			if (tvmazeResult && !tvmazeResult.error && tvmazeResult.show) {
				const images: ImageItem[] = [];

				for (const img of tvmazeResult.images || []) {
					images.push({
						url: img.url,
						thumbUrl: img.thumbUrl,
						type: img.type,
						width: img.width,
						height: img.height,
						source: 'tvmaze'
					});
				}

				for (const img of tvmazeResult.castImages || []) {
					images.push({
						url: img.url,
						thumbUrl: img.thumbUrl,
						type: img.type,
						source: 'tvmaze'
					});
				}

				tvmazeImages = images;
			}
		} catch (error) {
			console.error('[sources] fetchAllImages error:', error);
		} finally {
			isLoadingImages = false;
		}
	}

	// Select an image as cover
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Create album from selected result
	function createAlbumFromResult() {
		if (!selectedResult) return;

		isCreatingAlbum = true;

		try {
			const album: Album = {
				id: crypto.randomUUID(),
				title: selectedResult.Title,
				description: `${selectedResult.Type} (${selectedResult.Year})`,
				coverImage: selectedCoverImage || undefined,
				imdbId: selectedResult.imdbID,
				tmdbId: tmdbId || undefined,
				addedAt: new Date().toISOString()
			};

			albumsService.add(album);
			albumCreated = album;
		} catch (error) {
			console.error('[sources] createAlbumFromResult error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Check if album already exists by title
	function albumExistsByTitle(title: string): boolean {
		const albums = albumsService.all();
		return albums.some((a) => a.title.toLowerCase() === title.toLowerCase());
	}

	// Reset search
	function resetSearch() {
		omdbSearchQuery = '';
		omdbSearchType = '';
		omdbYear = '';
		omdbResults = [];
		omdbError = null;
		selectedResult = null;
		albumCreated = null;
		resetImages();
	}

	// Get current images based on selected tab
	function getCurrentImages(): ImageItem[] {
		switch (imageTab) {
			case 'tmdb':
				return tmdbImages;
			case 'fanart':
				return fanartImages;
			case 'tvmaze':
				return tvmazeImages;
			default:
				return [];
		}
	}

	// Get image count for badge
	function getImageCount(source: 'tmdb' | 'fanart' | 'tvmaze'): number {
		switch (source) {
			case 'tmdb':
				return tmdbImages.length;
			case 'fanart':
				return fanartImages.length;
			case 'tvmaze':
				return tvmazeImages.length;
			default:
				return 0;
		}
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">External Sources</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Search -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<!-- Tabs -->
				<div class="tabs tabs-boxed mb-3">
					<button
						class={classNames('tab', { 'tab-active': activeTab === 'omdb' })}
						onclick={() => (activeTab = 'omdb')}
					>
						OMDB
					</button>
				</div>

				<!-- Tab content -->
				<div class="flex-1 overflow-y-auto">
					{#if activeTab === 'omdb'}
						<!-- OMDB Search Tab -->
						<div class="space-y-3">
							<!-- Search input -->
							<div class="form-control">
								<input
									type="text"
									placeholder="Search movies, series..."
									class="input input-bordered input-sm w-full"
									bind:value={omdbSearchQuery}
									onkeydown={(e) => e.key === 'Enter' && searchOmdb()}
								/>
							</div>

							<!-- Filters row -->
							<div class="flex gap-2">
								<select
									class="select select-bordered select-xs flex-1"
									bind:value={omdbSearchType}
								>
									<option value="">All</option>
									<option value="movie">Movie</option>
									<option value="series">Series</option>
								</select>

								<input
									type="text"
									placeholder="Year"
									class="input input-bordered input-xs w-16"
									bind:value={omdbYear}
								/>

								<button
									class="btn btn-primary btn-xs"
									onclick={searchOmdb}
									disabled={!omdbSearchQuery.trim() || isSearchingOmdb}
								>
									{#if isSearchingOmdb}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Search
									{/if}
								</button>
							</div>

							{#if omdbResults.length > 0}
								<button class="btn btn-ghost btn-xs" onclick={resetSearch}>
									Clear
								</button>
							{/if}
						</div>

						<!-- Error message -->
						{#if omdbError}
							<div class="alert alert-error alert-sm mt-3">
								<span class="text-sm">{omdbError}</span>
							</div>
						{/if}

						<!-- Results -->
						{#if omdbResults.length > 0}
							<div class="mt-3 space-y-2">
								{#each omdbResults as result (result.imdbID)}
									{@const alreadyExists = albumExistsByTitle(result.Title)}
									<div
										class={classNames(
											'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
											'hover:bg-base-300',
											{
												'bg-primary/20 ring-2 ring-primary':
													selectedResult?.imdbID === result.imdbID,
												'bg-base-100': selectedResult?.imdbID !== result.imdbID
											}
										)}
										onclick={() => selectResult(result)}
										onkeydown={(e) => e.key === 'Enter' && selectResult(result)}
										role="button"
										tabindex="0"
									>
										<div class="flex items-start gap-2">
											{#if result.Poster && result.Poster !== 'N/A'}
												<img
													src={result.Poster}
													alt={result.Title}
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
												<div class="font-medium text-sm truncate">{result.Title}</div>
												<div class="text-xs text-base-content/60">
													{result.Year} &middot; {result.Type}
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

		<!-- Column 2: Images -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Images</h2>

				{#if !selectedResult}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">Select a result to view images.</p>
					</div>
				{:else if isLoadingImages}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else}
					<!-- Image source tabs -->
					<div class="tabs tabs-boxed tabs-xs mb-3">
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'tmdb' })}
							onclick={() => (imageTab = 'tmdb')}
						>
							TMDB
							{#if getImageCount('tmdb') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('tmdb')}</span>
							{/if}
						</button>
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'fanart' })}
							onclick={() => (imageTab = 'fanart')}
						>
							Fanart
							{#if getImageCount('fanart') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('fanart')}</span>
							{/if}
						</button>
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'tvmaze' })}
							onclick={() => (imageTab = 'tvmaze')}
						>
							TVMaze
							{#if getImageCount('tvmaze') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('tvmaze')}</span>
							{/if}
						</button>
					</div>

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
											'relative aspect-[2/3] rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': selectedCoverImage === image.url
											}
										)}
										onclick={() => selectCoverImage(image.url)}
										title={`${image.type} - Click to select as cover`}
									>
										<img
											src={image.thumbUrl || image.url}
											alt={image.type}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
										{#if selectedCoverImage === image.url}
											<div class="absolute top-1 right-1">
												<span class="badge badge-success badge-xs">Cover</span>
											</div>
										{/if}
										<div class="absolute bottom-0 left-0 right-0 bg-base-300/80 px-1 py-0.5">
											<span class="text-xs truncate block">{image.type}</span>
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
							<!-- Preview -->
							<div class="flex gap-3">
								{#if selectedCoverImage}
									<img
										src={selectedCoverImage}
										alt={selectedResult.Title}
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
									<h3 class="font-bold">{selectedResult.Title}</h3>
									<p class="text-sm text-base-content/60">{selectedResult.Year}</p>
									<p class="text-sm capitalize">{selectedResult.Type}</p>
									<a
										href="https://www.imdb.com/title/{selectedResult.imdbID}"
										target="_blank"
										rel="noopener noreferrer"
										class="link link-primary text-xs mt-1 block"
									>
										IMDb
									</a>
								</div>
							</div>

							<!-- Album details -->
							<div class="divider my-2">Details</div>

							<div class="space-y-1 text-sm">
								<div class="flex justify-between">
									<span class="text-base-content/60">IMDb ID:</span>
									<span class="font-mono text-xs">{selectedResult.imdbID}</span>
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
									<span class="text-sm">Album created!</span>
								</div>
								<a href="/admin/album" class="btn btn-outline btn-sm w-full">
									Go to Album Manager
								</a>
							{:else if albumExistsByTitle(selectedResult.Title)}
								<div class="alert alert-warning">
									<span class="text-sm">Album with this title exists.</span>
								</div>
								<button
									class="btn btn-warning btn-sm w-full"
									onclick={createAlbumFromResult}
									disabled={isCreatingAlbum}
								>
									{#if isCreatingAlbum}
										<span class="loading loading-spinner loading-sm"></span>
									{:else}
										Create Anyway
									{/if}
								</button>
							{:else}
								<button
									class="btn btn-primary w-full"
									onclick={createAlbumFromResult}
									disabled={isCreatingAlbum}
								>
									{#if isCreatingAlbum}
										<span class="loading loading-spinner loading-sm"></span>
									{:else}
										Create Album
									{/if}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
