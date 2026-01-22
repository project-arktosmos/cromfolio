<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { addCard } from '$services/cards.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';
	import {
		searchMusicArtists,
		getArtistReleases,
		fetchSourceImages,
		type MusicArtistSearchResult,
		type MusicReleaseResult,
		type ImageItem as FetchImageItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';

	// Local image type for UI
	interface MusicImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		source: string;
	}

	interface ArtistRelease {
		id: string;
		title: string;
		type?: string;
		releaseYear?: number;
		imageUrl?: string;
		thumbUrl?: string;
		selected: boolean;
	}

	// Search state
	let searchQuery = $state('');
	let artistResults = $state<MusicArtistSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedArtist = $state<MusicArtistSearchResult | null>(null);

	// Artist releases (will become cards)
	let artistReleases = $state<ArtistRelease[]>([]);
	let isLoadingReleases = $state(false);
	let releasesError = $state<string | null>(null);

	// Image fetching state for artist (album cover)
	let isLoadingImages = $state(false);
	let fanartImages = $state<MusicImageItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);
	let cardsCreated = $state<number>(0);

	// Source existence tracking
	let sourceExistsMap = $state<Map<string, boolean>>(new Map());

	// Progress tracking
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());

	// Handle progress events
	function handleProgress(event: FetchProgressEvent) {
		fetchProgress = new Map(fetchProgress).set(event.source, {
			status: event.status,
			message: event.message
		});
	}

	// Search artists via Rust backend
	async function searchArtists() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		artistResults = [];
		selectedArtist = null;
		resetState();

		try {
			const results = await searchMusicArtists(searchQuery.trim());
			artistResults = results;
			if (artistResults.length === 0) {
				searchError = 'No artists found';
			}
		} catch (error) {
			searchError = 'Failed to search artists';
			console.error('[sources] searchArtists error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Reset all state
	function resetState() {
		artistReleases = [];
		fanartImages = [];
		selectedCoverImage = null;
		albumCreated = null;
		cardsCreated = 0;
		releasesError = null;
	}

	// Check if source already exists in database
	async function checkSourceExists(artistId: string): Promise<boolean> {
		if (sourceExistsMap.has(artistId)) {
			return sourceExistsMap.get(artistId)!;
		}
		const exists = await sourceExists('musicbrainz_artist', artistId);
		sourceExistsMap = new Map(sourceExistsMap).set(artistId, exists);
		return exists;
	}

	// Check if source is already added (from cache)
	function isSourceAdded(artistId: string): boolean {
		return sourceExistsMap.get(artistId) ?? false;
	}

	// Select an artist and fetch their releases + images
	async function selectArtist(artist: MusicArtistSearchResult) {
		if (selectedArtist?.id === artist.id) {
			selectedArtist = null;
			resetState();
		} else {
			selectedArtist = artist;
			albumCreated = null;
			cardsCreated = 0;
			fetchProgress = new Map();
			await Promise.all([
				checkSourceExists(artist.id),
				fetchArtistReleases(artist),
				fetchArtistImages(artist)
			]);
		}
	}

	// Fetch artist's releases via Rust backend
	async function fetchArtistReleases(artist: MusicArtistSearchResult) {
		isLoadingReleases = true;
		releasesError = null;
		artistReleases = [];

		try {
			const releases = await getArtistReleases(artist.id, true);
			// All releases selected by default
			artistReleases = releases.map((r) => ({
				id: r.id,
				title: r.title,
				type: r.releaseType,
				releaseYear: r.releaseYear,
				imageUrl: r.coverUrl,
				thumbUrl: r.thumbUrl,
				selected: true
			}));
		} catch (error) {
			releasesError = 'Failed to fetch artist releases';
			console.error('[sources] fetchArtistReleases error:', error);
		} finally {
			isLoadingReleases = false;
		}
	}

	// Fetch artist images via Rust backend (Fanart.tv)
	async function fetchArtistImages(artist: MusicArtistSearchResult) {
		isLoadingImages = true;
		fanartImages = [];

		try {
			const result = await fetchSourceImages({
				contentType: 'music',
				externalId: artist.id,
				externalIdType: 'musicbrainz',
				sources: ['fanart'],
				onProgress: handleProgress
			});

			fanartImages = result.images.map((img) => ({
				url: img.url,
				thumbUrl: img.thumbUrl,
				type: img.imageType,
				source: img.source
			}));

			// Auto-select first artist thumb as cover
			const thumbImg = fanartImages.find((img) => img.type === 'artistthumb');
			if (thumbImg) {
				selectedCoverImage = thumbImg.url;
			}
		} catch (e) {
			console.error('[sources] Fanart fetch error:', e);
		} finally {
			isLoadingImages = false;
		}
	}

	// Toggle release selection
	function toggleRelease(release: ArtistRelease) {
		release.selected = !release.selected;
		artistReleases = [...artistReleases];
	}

	// Select/deselect all releases
	function toggleAllReleases(selected: boolean) {
		artistReleases = artistReleases.map((r) => ({ ...r, selected }));
	}

	// Select an image as cover
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Create album from artist and cards from releases
	async function createAlbumAndCards() {
		if (!selectedArtist) return;

		// Check if already added
		const alreadyAdded = await sourceExists('musicbrainz_artist', selectedArtist.id);
		if (alreadyAdded) {
			console.warn('[sources] Artist already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			// Create Album from Artist
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'musician',
				title: selectedArtist.name,
				description: `Music Artist${selectedArtist.country ? ` (${selectedArtist.country})` : ''}${selectedArtist.beginYear ? ` - Active since ${selectedArtist.beginYear}` : ''}${selectedArtist.tags?.length ? ` - ${selectedArtist.tags.slice(0, 3).join(', ')}` : ''}`,
				coverImage: selectedCoverImage || undefined,
				musicbrainzArtistId: selectedArtist.id,
				artistName: selectedArtist.name,
				musicType: 'artist',
				musicGenres: selectedArtist.tags || [],
				country: selectedArtist.country,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'music', 'musicbrainz_artist', selectedArtist.id);
				albumCreated = createdAlbum;

				// Create Cards from selected releases
				const selectedReleases = artistReleases.filter((r) => r.selected);
				let created = 0;

				for (const release of selectedReleases) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: release.title,
						image: release.imageUrl || release.thumbUrl || '',
						musicbrainzReleaseGroupId: release.id,
						releaseType: release.type,
						releaseYear: release.releaseYear,
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
				sourceExistsMap = new Map(sourceExistsMap).set(selectedArtist.id, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumAndCards error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		artistResults = [];
		searchError = null;
		selectedArtist = null;
		resetState();
	}

	// Get selected releases count
	function getSelectedCount(): number {
		return artistReleases.filter((r) => r.selected).length;
	}

	// Format artist type
	function formatArtistType(type: string | undefined): string {
		if (!type) return 'Artist';
		switch (type.toLowerCase()) {
			case 'person':
				return 'Solo Artist';
			case 'group':
				return 'Band/Group';
			case 'orchestra':
				return 'Orchestra';
			case 'choir':
				return 'Choir';
			case 'character':
				return 'Character';
			case 'other':
				return 'Other';
			default:
				return type;
		}
	}

	// Format release type
	function formatReleaseType(type: string | undefined): string {
		if (!type) return 'Release';
		return type;
	}
</script>

<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search Artists -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Artists</h2>

			<div class="space-y-3">
				<!-- Search input -->
				<div class="form-control">
					<input
						type="text"
						placeholder="Search artists..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && searchArtists()}
					/>
				</div>

				<!-- Search button -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={searchArtists}
						disabled={!searchQuery.trim() || isSearching}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Search
						{/if}
					</button>

					{#if artistResults.length > 0}
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
				{#if artistResults.length > 0}
					<div class="space-y-2">
						{#each artistResults as artist (artist.id)}
							{@const alreadyExists = isSourceAdded(artist.id)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedArtist?.id === artist.id,
										'bg-base-100': selectedArtist?.id !== artist.id
									}
								)}
								onclick={() => selectArtist(artist)}
								onkeydown={(e) => e.key === 'Enter' && selectArtist(artist)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									<div
										class="w-10 h-10 bg-base-300 rounded flex items-center justify-center text-base-content/30"
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
												d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
											/>
										</svg>
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{artist.name}</div>
										<div class="text-xs text-base-content/60">
											{formatArtistType(artist.artistType)}{artist.country
												? ` - ${artist.country}`
												: ''}
										</div>
										{#if artist.disambiguation}
											<div class="text-xs text-base-content/50 truncate">
												{artist.disambiguation}
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

	<!-- Column 2: Artist Releases (Cards) -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="flex items-center justify-between mb-2">
				<h2 class="card-title text-lg">Releases (Cards)</h2>
				{#if artistReleases.length > 0}
					<span class="badge badge-primary">{getSelectedCount()}/{artistReleases.length}</span>
				{/if}
			</div>

			{#if !selectedArtist}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select an artist to view their releases.</p>
				</div>
			{:else if isLoadingReleases}
				<div class="flex-1 flex items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else if releasesError}
				<div class="alert alert-error alert-sm">
					<span class="text-sm">{releasesError}</span>
				</div>
			{:else if artistReleases.length === 0}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">No releases found for this artist.</p>
				</div>
			{:else}
				<!-- Select all / none -->
				<div class="flex gap-2 mb-2">
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllReleases(true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllReleases(false)}>
						Select None
					</button>
				</div>

				<!-- Releases grid -->
				<div class="flex-1 overflow-y-auto">
					<div class="grid grid-cols-3 gap-2">
						{#each artistReleases as release (release.id)}
							<button
								class={classNames(
									'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
									'hover:ring-2 hover:ring-primary',
									{
										'ring-2 ring-success': release.selected,
										'opacity-40': !release.selected
									}
								)}
								onclick={() => toggleRelease(release)}
								title={`${release.title} (${release.releaseYear || 'Unknown'}) - ${formatReleaseType(release.type)}`}
							>
								{#if release.thumbUrl || release.imageUrl}
									<img
										src={release.thumbUrl || release.imageUrl}
										alt={release.title}
										class="w-full h-full object-cover"
										loading="lazy"
										onerror={(e) => {
											(e.target as HTMLImageElement).style.display = 'none';
										}}
									/>
								{:else}
									<div
										class="w-full h-full flex items-center justify-center text-base-content/30"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-8 w-8"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
											/>
										</svg>
									</div>
								{/if}
								{#if release.selected}
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
								<div class="absolute bottom-0 left-0 right-0 bg-base-300/90 px-1 py-0.5">
									<span class="text-xs truncate block">{release.title}</span>
									<span class="text-xs text-base-content/60"
										>{release.releaseYear || '?'}</span
									>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedArtist}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select an artist to create an album.</p>
					</div>
				{:else}
					{@const displayTitle = selectedArtist.name}
					<div class="space-y-4">
						<!-- Artist image selection -->
						{#if isLoadingImages}
							<div class="flex justify-center py-4">
								<span class="loading loading-spinner loading-sm"></span>
							</div>
						{:else if fanartImages.length > 0}
							<div>
								<span class="text-xs text-base-content/60 mb-1 block">Artist Cover Image</span>
								<div class="grid grid-cols-3 gap-1">
									{#each fanartImages.slice(0, 6) as image (image.url)}
										<button
											class={classNames(
												'relative aspect-square rounded overflow-hidden bg-base-300',
												'hover:ring-2 hover:ring-primary',
												{
													'ring-2 ring-success': selectedCoverImage === image.url
												}
											)}
											onclick={() => selectCoverImage(image.url)}
										>
											<img
												src={image.thumbUrl || image.url}
												alt={image.type}
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={displayTitle}
									class="w-16 h-16 object-cover rounded"
								/>
							{:else}
								<div
									class="w-16 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-8 w-8"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{displayTitle}</h3>
								{#if selectedArtist.disambiguation}
									<p class="text-xs text-base-content/50 truncate">
										{selectedArtist.disambiguation}
									</p>
								{/if}
								<p class="text-sm text-base-content/60">
									{formatArtistType(selectedArtist.artistType)}
								</p>
								<a
									href="https://musicbrainz.org/artist/{selectedArtist.id}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs"
								>
									MusicBrainz
								</a>
							</div>
						</div>

						<!-- Details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">MusicBrainz ID:</span>
								<span class="font-mono text-xs truncate max-w-[50%]">{selectedArtist.id}</span>
							</div>
							{#if selectedArtist.country}
								<div class="flex justify-between">
									<span class="text-base-content/60">Country:</span>
									<span class="text-xs">{selectedArtist.country}</span>
								</div>
							{/if}
							{#if selectedArtist.beginYear}
								<div class="flex justify-between">
									<span class="text-base-content/60">Active Since:</span>
									<span class="text-xs">{selectedArtist.beginYear}</span>
								</div>
							{/if}
							{#if selectedArtist.tags?.length}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Tags:</span>
									<span class="text-xs text-right max-w-[60%]">
										{selectedArtist.tags.slice(0, 3).join(', ')}
									</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-base-content/60">Releases to import:</span>
								<span class="text-xs font-bold">{getSelectedCount()}</span>
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
						{:else if isSourceAdded(selectedArtist.id)}
							<div class="alert alert-warning">
								<span class="text-sm">This artist has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumAndCards}
								disabled={isCreatingAlbum || getSelectedCount() === 0}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Album + {getSelectedCount()} Cards
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
