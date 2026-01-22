<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import type { Album } from '$types/album.type';
	import {
		searchAnime as searchAnimeApi,
		fetchSourceImages,
		filterImagesBySource,
		type AnimeSearchResult,
		type ImageItem as FetchImageItem,
		type CharacterItem as FetchCharacterItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';

	// Local image/character types for UI
	interface AnimeImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		source: 'anilist' | 'jikan';
	}

	interface AnimeCharacterImageItem {
		url: string;
		thumbUrl: string;
		characterId: number;
		characterName: string;
		role: string;
		source: 'anilist' | 'jikan';
		voiceActorName?: string;
		voiceActorImage?: string;
	}

	// Search state
	let searchQuery = $state('');
	let searchResults = $state<AnimeSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedAnime = $state<AnimeSearchResult | null>(null);

	// Image fetching state
	let isLoadingImages = $state(false);
	let anilistImages = $state<AnimeImageItem[]>([]);
	let jikanImages = $state<AnimeImageItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);
	let imageTab = $state<'anilist' | 'jikan' | 'anilist-characters' | 'jikan-characters'>('anilist');

	// Character fetching state
	let isLoadingCharacters = $state(false);
	let anilistCharacters = $state<AnimeCharacterImageItem[]>([]);
	let jikanCharacters = $state<AnimeCharacterImageItem[]>([]);

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);

	// Source existence tracking
	let sourceExistsMap = $state<Map<number, boolean>>(new Map());

	// Progress tracking
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());

	// Handle progress events
	function handleProgress(event: FetchProgressEvent) {
		fetchProgress = new Map(fetchProgress).set(event.source, {
			status: event.status,
			message: event.message
		});
	}

	// Search anime via Rust backend
	async function doSearchAnime() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];
		selectedAnime = null;
		resetImages();

		try {
			const results = await searchAnimeApi(searchQuery.trim(), 1, 15);
			searchResults = results;
			if (searchResults.length === 0) {
				searchError = 'No results found';
			}
		} catch (error) {
			searchError = 'Failed to search anime';
			console.error('[sources] searchAnime error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Reset images state
	function resetImages() {
		anilistImages = [];
		jikanImages = [];
		anilistCharacters = [];
		jikanCharacters = [];
		selectedCoverImage = null;
	}

	// Check if source already exists in database
	async function checkSourceExists(anilistId: number): Promise<boolean> {
		if (sourceExistsMap.has(anilistId)) {
			return sourceExistsMap.get(anilistId)!;
		}
		const exists = await sourceExists('anilist', String(anilistId));
		sourceExistsMap = new Map(sourceExistsMap).set(anilistId, exists);
		return exists;
	}

	// Check if source is already added (from cache)
	function isSourceAdded(anilistId: number): boolean {
		return sourceExistsMap.get(anilistId) ?? false;
	}

	// Select an anime and fetch images
	async function selectAnime(anime: AnimeSearchResult) {
		if (selectedAnime?.id === anime.id) {
			selectedAnime = null;
			resetImages();
		} else {
			selectedAnime = anime;
			albumCreated = null;
			selectedCoverImage = anime.coverImageLarge || anime.coverImage || null;
			// Check source existence and fetch all data via batch fetch
			await Promise.all([
				checkSourceExists(anime.id),
				fetchAllData(anime)
			]);
		}
	}

	// Fetch all images and characters via Rust backend
	async function fetchAllData(anime: AnimeSearchResult) {
		isLoadingImages = true;
		isLoadingCharacters = true;
		fetchProgress = new Map();

		// Preserve the selected cover image
		const preservedCoverImage = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCoverImage;

		try {
			// Fetch all data from backend in parallel
			const result = await fetchSourceImages({
				contentType: 'anime',
				externalId: String(anime.id),
				externalIdType: 'anilist',
				sources: ['anilist', 'anilist_characters', 'jikan', 'jikan_characters'],
				onProgress: handleProgress
			});

			// Process images - separate by source
			const anilistImgs: AnimeImageItem[] = [];
			const jikanImgs: AnimeImageItem[] = [];

			for (const img of result.images) {
				const localImg: AnimeImageItem = {
					url: img.url,
					thumbUrl: img.thumbUrl,
					type: img.imageType,
					source: img.source === 'anilist' ? 'anilist' : 'jikan'
				};
				if (img.source === 'anilist') {
					anilistImgs.push(localImg);
				} else if (img.source === 'jikan') {
					jikanImgs.push(localImg);
				}
			}

			anilistImages = anilistImgs;
			jikanImages = jikanImgs;

			// Process characters - separate by source
			const anilistChars: AnimeCharacterImageItem[] = [];
			const jikanChars: AnimeCharacterImageItem[] = [];

			for (const char of result.characters) {
				const localChar: AnimeCharacterImageItem = {
					url: char.profileUrl,
					thumbUrl: char.profileThumbUrl,
					characterId: parseInt(char.id) || 0,
					characterName: char.characterName || char.name,
					role: char.isActorHeadshot ? 'Voice Actor' : 'Character',
					source: char.source === 'anilist' || char.source === 'anilist_characters' ? 'anilist' : 'jikan'
				};
				if (char.source === 'anilist' || char.source === 'anilist_characters') {
					anilistChars.push(localChar);
				} else if (char.source === 'jikan' || char.source === 'jikan_characters') {
					jikanChars.push(localChar);
				}
			}

			anilistCharacters = anilistChars;
			jikanCharacters = jikanChars;

		} catch (error) {
			console.error('[sources] fetchAllData error:', error);
		} finally {
			isLoadingImages = false;
			isLoadingCharacters = false;
		}
	}

	// Select an image as cover
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Create album from selected anime
	async function createAlbumFromAnime() {
		if (!selectedAnime) return;

		// Check if already added
		const alreadyAdded = await sourceExists('anilist', String(selectedAnime.id));
		if (alreadyAdded) {
			console.warn('[sources] Anime already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			const title = selectedAnime.titleEnglish || selectedAnime.titleRomaji;
			const year = selectedAnime.startYear;

			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'anime',
				title,
				description: `Anime${year ? ` (${year})` : ''}${selectedAnime.genres?.length ? ` - ${selectedAnime.genres.slice(0, 3).join(', ')}` : ''}`,
				coverImage: selectedCoverImage || undefined,
				anilistId: selectedAnime.id,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'anime', 'anilist', String(selectedAnime.id));
				albumCreated = createdAlbum;
				// Update local cache
				sourceExistsMap = new Map(sourceExistsMap).set(selectedAnime.id, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumFromAnime error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		searchResults = [];
		searchError = null;
		selectedAnime = null;
		albumCreated = null;
		resetImages();
	}

	// Get current images based on selected tab
	function getCurrentImages(): AnimeImageItem[] {
		switch (imageTab) {
			case 'anilist':
				return anilistImages;
			case 'jikan':
				return jikanImages;
			default:
				return [];
		}
	}

	// Get current characters based on selected tab
	function getCurrentCharacters(): AnimeCharacterImageItem[] {
		switch (imageTab) {
			case 'anilist-characters':
				return anilistCharacters;
			case 'jikan-characters':
				return jikanCharacters;
			default:
				return [];
		}
	}

	// Check if current tab is a character tab
	function isCharacterTab(): boolean {
		return imageTab === 'anilist-characters' || imageTab === 'jikan-characters';
	}

	// Get image count for badge
	function getImageCount(source: 'anilist' | 'jikan' | 'anilist-characters' | 'jikan-characters'): number {
		switch (source) {
			case 'anilist':
				return anilistImages.length;
			case 'jikan':
				return jikanImages.length;
			case 'anilist-characters':
				return anilistCharacters.length;
			case 'jikan-characters':
				return jikanCharacters.length;
			default:
				return 0;
		}
	}

	// Get display title for anime
	function getDisplayTitle(anime: AnimeSearchResult): string {
		return anime.titleEnglish || anime.titleRomaji;
	}

	// Format anime format type
	function formatType(format: string | null | undefined): string {
		if (!format) return 'Anime';
		switch (format) {
			case 'TV': return 'TV Series';
			case 'TV_SHORT': return 'TV Short';
			case 'MOVIE': return 'Movie';
			case 'SPECIAL': return 'Special';
			case 'OVA': return 'OVA';
			case 'ONA': return 'ONA';
			case 'MUSIC': return 'Music';
			default: return format;
		}
	}
</script>

<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Anime</h2>

			<div class="space-y-3">
				<!-- Search input -->
				<div class="form-control">
					<input
						type="text"
						placeholder="Search anime..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && doSearchAnime()}
					/>
				</div>

				<!-- Search button -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={doSearchAnime}
						disabled={!searchQuery.trim() || isSearching}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Search
						{/if}
					</button>

					{#if searchResults.length > 0}
						<button class="btn btn-ghost btn-sm" onclick={resetSearch}>
							Clear
						</button>
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
						{#each searchResults as anime (anime.id)}
							{@const title = getDisplayTitle(anime)}
							{@const alreadyExists = isSourceAdded(anime.id)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedAnime?.id === anime.id,
										'bg-base-100': selectedAnime?.id !== anime.id
									}
								)}
								onclick={() => selectAnime(anime)}
								onkeydown={(e) => e.key === 'Enter' && selectAnime(anime)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if anime.coverImage}
										<img
											src={anime.coverImage}
											alt={title}
											class="w-10 h-14 object-cover rounded"
										/>
									{:else}
										<div class="w-10 h-14 bg-base-300 rounded flex items-center justify-center text-base-content/30">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{title}</div>
										<div class="text-xs text-base-content/60">
											{anime.startYear || 'TBA'} &middot; {formatType(anime.format)}
										</div>
										{#if anime.averageScore}
											<div class="text-xs text-base-content/50 truncate">
												Score: {anime.averageScore}%
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

	<!-- Column 2: Images -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Images</h2>

			{#if !selectedAnime}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select an anime to view images.</p>
				</div>
			{:else if isLoadingImages && isLoadingCharacters}
				<div class="flex-1 flex items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else}
				<!-- Image source tabs -->
				<div class="flex flex-col gap-2 mb-3">
					<!-- Show images tabs -->
					<div class="tabs tabs-boxed tabs-xs">
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'anilist' })}
							onclick={() => (imageTab = 'anilist')}
						>
							AniList
							{#if getImageCount('anilist') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('anilist')}</span>
							{/if}
						</button>
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'jikan' })}
							onclick={() => (imageTab = 'jikan')}
						>
							Jikan
							{#if getImageCount('jikan') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('jikan')}</span>
							{/if}
						</button>
					</div>
					<!-- Character tabs -->
					<div class="tabs tabs-boxed tabs-xs">
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'anilist-characters' })}
							onclick={() => (imageTab = 'anilist-characters')}
						>
							AL Characters
							{#if getImageCount('anilist-characters') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('anilist-characters')}</span>
							{/if}
							{#if isLoadingCharacters}
								<span class="loading loading-spinner loading-xs ml-1"></span>
							{/if}
						</button>
						<button
							class={classNames('tab', { 'tab-active': imageTab === 'jikan-characters' })}
							onclick={() => (imageTab = 'jikan-characters')}
						>
							Jikan Characters
							{#if getImageCount('jikan-characters') > 0}
								<span class="badge badge-xs ml-1">{getImageCount('jikan-characters')}</span>
							{/if}
							{#if isLoadingCharacters}
								<span class="loading loading-spinner loading-xs ml-1"></span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Image/Character grid -->
				<div class="flex-1 overflow-y-auto">
					{#if isCharacterTab()}
						<!-- Character grid -->
						{#if getCurrentCharacters().length === 0}
							<div class="text-center text-base-content/60 p-4">
								{#if isLoadingCharacters}
									<span class="loading loading-spinner loading-sm"></span>
									<p class="text-sm mt-2">Loading characters...</p>
								{:else}
									<p class="text-sm">No characters from this source.</p>
								{/if}
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								{#each getCurrentCharacters() as character, i (character.characterId + '-' + i)}
									<button
										class={classNames(
											'relative aspect-[2/3] rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': selectedCoverImage === character.url
											}
										)}
										onclick={() => selectCoverImage(character.url)}
										title={`${character.characterName} (${character.role}) - Click to select as cover`}
									>
										<img
											src={character.thumbUrl || character.url}
											alt={character.characterName}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
										{#if selectedCoverImage === character.url}
											<div class="absolute top-1 right-1">
												<span class="badge badge-success badge-xs">Cover</span>
											</div>
										{/if}
										<div class="absolute top-1 left-1">
											<span class={classNames('badge badge-xs', {
												'badge-primary': character.role === 'MAIN' || character.role === 'Main',
												'badge-secondary': character.role === 'SUPPORTING' || character.role === 'Supporting',
												'badge-ghost': character.role === 'BACKGROUND' || character.role === 'Background'
											})}>
												{character.role === 'MAIN' ? 'Main' : character.role === 'SUPPORTING' ? 'Supp' : character.role}
											</span>
										</div>
										<div class="absolute bottom-0 left-0 right-0 bg-base-300/90 px-1 py-0.5">
											<span class="text-xs truncate block font-medium">{character.characterName}</span>
											{#if character.voiceActorName}
												<span class="text-xs truncate block text-base-content/60">VA: {character.voiceActorName}</span>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						{/if}
					{:else}
						<!-- Regular image grid -->
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
				{#if !selectedAnime}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select an anime to create an album.</p>
					</div>
				{:else}
					{@const displayTitle = getDisplayTitle(selectedAnime)}
					<div class="space-y-4">
						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={displayTitle}
									class="w-20 h-28 object-cover rounded"
								/>
							{:else}
								<div class="w-20 h-28 bg-base-300 rounded flex items-center justify-center text-base-content/30">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{displayTitle}</h3>
								{#if selectedAnime.titleRomaji && selectedAnime.titleEnglish}
									<p class="text-xs text-base-content/50 truncate">{selectedAnime.titleRomaji}</p>
								{/if}
								<p class="text-sm text-base-content/60">
									{selectedAnime.startYear || 'TBA'}
								</p>
								<p class="text-sm">{formatType(selectedAnime.format)}</p>
								<a
									href="https://anilist.co/anime/{selectedAnime.id}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs mt-1 block"
								>
									AniList
								</a>
							</div>
						</div>

						<!-- Progress indicators -->
						{#if fetchProgress.size > 0}
							<div class="space-y-1">
								{#each [...fetchProgress.entries()] as [source, info]}
									<div class="flex items-center gap-2 text-xs">
										<span class="w-24 truncate">{source}:</span>
										{#if info.status === 'fetching'}
											<span class="loading loading-spinner loading-xs"></span>
										{:else if info.status === 'success'}
											<span class="text-success">Done</span>
										{:else if info.status === 'failed'}
											<span class="text-error">Failed</span>
										{:else}
											<span class="text-base-content/50">Pending</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<!-- Album details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">AniList ID:</span>
								<span class="font-mono text-xs">{selectedAnime.id}</span>
							</div>
							{#if selectedAnime.episodes}
								<div class="flex justify-between">
									<span class="text-base-content/60">Episodes:</span>
									<span class="text-xs">{selectedAnime.episodes}</span>
								</div>
							{/if}
							{#if selectedAnime.averageScore}
								<div class="flex justify-between">
									<span class="text-base-content/60">Score:</span>
									<span class="text-xs">{selectedAnime.averageScore}%</span>
								</div>
							{/if}
							{#if selectedAnime.genres?.length}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Genres:</span>
									<span class="text-xs text-right max-w-[60%]">
										{selectedAnime.genres.slice(0, 3).join(', ')}
									</span>
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
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">Album created!</span>
							</div>
							<a href="/admin/album" class="btn btn-outline btn-sm w-full">
								Go to Album Manager
							</a>
						{:else if isSourceAdded(selectedAnime.id)}
							<div class="alert alert-warning">
								<span class="text-sm">This anime has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumFromAnime}
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
