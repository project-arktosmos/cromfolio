<script lang="ts">
	import classNames from 'classnames';
	import {
		searchInternetArchive,
		getItemDetails,
		getFileUrl,
		getThumbnailUrl,
		getItemPageUrl,
		getAudioFiles,
		getBestAudioFile,
		formatDuration,
		formatFileSize,
		IA_MUSIC_COLLECTIONS,
		type IASearchResult,
		type IAItemDetails,
		type IAFile
	} from '$services/internet-archive.service';

	// Search state
	let searchQuery = $state('');
	let selectedCollection = $state('opensource_audio');
	let searchResults = $state<IASearchResult[]>([]);
	let totalResults = $state(0);
	let currentPage = $state(1);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);

	// Selected item state
	let selectedItem = $state<IASearchResult | null>(null);
	let itemDetails = $state<IAItemDetails | null>(null);
	let isLoadingDetails = $state(false);
	let detailsError = $state<string | null>(null);

	// Audio player state
	let audioFiles = $state<IAFile[]>([]);
	let currentTrack = $state<IAFile | null>(null);
	let audioElement: HTMLAudioElement | null = $state(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);

	// Search for items
	async function search(page: number = 1) {
		isSearching = true;
		searchError = null;

		try {
			const result = await searchInternetArchive(searchQuery, {
				collection: selectedCollection,
				page,
				rows: 30
			});
			searchResults = result.results;
			totalResults = result.total;
			currentPage = page;

			if (searchResults.length === 0) {
				searchError = 'No results found';
			}
		} catch (error) {
			searchError = 'Search failed. Please try again.';
			console.error('[internet-archive] Search error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Select an item and load its details
	async function selectItem(item: IASearchResult) {
		if (selectedItem?.identifier === item.identifier) {
			selectedItem = null;
			itemDetails = null;
			audioFiles = [];
			stopPlayback();
			return;
		}

		selectedItem = item;
		itemDetails = null;
		audioFiles = [];
		detailsError = null;
		isLoadingDetails = true;
		stopPlayback();

		try {
			const details = await getItemDetails(item.identifier);
			itemDetails = details;
			audioFiles = getAudioFiles(details.files);
		} catch (error) {
			detailsError = 'Failed to load item details';
			console.error('[internet-archive] Details error:', error);
		} finally {
			isLoadingDetails = false;
		}
	}

	// Play a track
	function playTrack(file: IAFile) {
		if (!selectedItem) return;

		if (currentTrack?.name === file.name && isPlaying) {
			pausePlayback();
			return;
		}

		currentTrack = file;
		const url = getFileUrl(selectedItem.identifier, file.name);

		if (audioElement) {
			audioElement.src = url;
			audioElement.play().catch((e) => console.error('Playback error:', e));
			isPlaying = true;
		}
	}

	// Pause playback
	function pausePlayback() {
		audioElement?.pause();
		isPlaying = false;
	}

	// Stop playback
	function stopPlayback() {
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
		}
		isPlaying = false;
		currentTrack = null;
		currentTime = 0;
		duration = 0;
	}

	// Handle time update
	function onTimeUpdate() {
		if (audioElement) {
			currentTime = audioElement.currentTime;
			duration = audioElement.duration || 0;
		}
	}

	// Handle track end
	function onTrackEnd() {
		isPlaying = false;
		// Auto-play next track
		if (currentTrack && audioFiles.length > 0) {
			const currentIndex = audioFiles.findIndex((f) => f.name === currentTrack?.name);
			if (currentIndex < audioFiles.length - 1) {
				playTrack(audioFiles[currentIndex + 1]);
			}
		}
	}

	// Seek in track
	function seekTo(e: MouseEvent) {
		const target = e.currentTarget as HTMLDivElement;
		const rect = target.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		if (audioElement && duration > 0) {
			audioElement.currentTime = percent * duration;
		}
	}

	// Format time for display
	function formatTime(seconds: number): string {
		if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		searchResults = [];
		totalResults = 0;
		searchError = null;
		selectedItem = null;
		itemDetails = null;
		audioFiles = [];
		stopPlayback();
	}

	// Browse collection (search with empty query)
	async function browseCollection() {
		searchQuery = '';
		await search(1);
	}

	// Get total pages
	$effect(() => {
		// Reset selection when collection changes
		selectedItem = null;
		itemDetails = null;
		audioFiles = [];
		stopPlayback();
	});
</script>

<!-- Hidden audio element -->
<audio
	bind:this={audioElement}
	ontimeupdate={onTimeUpdate}
	onended={onTrackEnd}
	onplay={() => (isPlaying = true)}
	onpause={() => (isPlaying = false)}
></audio>

<div class="flex flex-col h-full">
	<!-- Page header -->
	<div class="mb-4">
		<h1 class="text-2xl font-bold">Internet Archive Music</h1>
		<p class="text-sm text-base-content/60">Browse and preview public domain music from archive.org</p>
	</div>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Search & Browse -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Search & Browse</h2>

				<div class="space-y-3">
					<!-- Collection selector -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Collection</span>
						</label>
						<select
							class="select select-bordered select-sm w-full"
							bind:value={selectedCollection}
						>
							{#each IA_MUSIC_COLLECTIONS as collection}
								<option value={collection.id}>{collection.label}</option>
							{/each}
						</select>
					</div>

					<!-- Search input -->
					<div class="form-control">
						<input
							type="text"
							placeholder="Search music..."
							class="input input-bordered input-sm w-full"
							bind:value={searchQuery}
							onkeydown={(e) => e.key === 'Enter' && search(1)}
						/>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-2">
						<button
							class="btn btn-primary btn-sm flex-1"
							onclick={() => search(1)}
							disabled={isSearching}
						>
							{#if isSearching}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Search
							{/if}
						</button>
						<button
							class="btn btn-outline btn-sm flex-1"
							onclick={browseCollection}
							disabled={isSearching}
						>
							Browse All
						</button>
					</div>

					{#if searchResults.length > 0}
						<button class="btn btn-ghost btn-xs" onclick={resetSearch}>Clear Results</button>
					{/if}
				</div>

				<!-- Error message -->
				{#if searchError}
					<div class="alert alert-warning alert-sm mt-3">
						<span class="text-sm">{searchError}</span>
					</div>
				{/if}

				<!-- Results count -->
				{#if totalResults > 0}
					<div class="text-xs text-base-content/60 mt-2">
						Showing {searchResults.length} of {totalResults.toLocaleString()} results
					</div>
				{/if}

				<!-- Results list -->
				<div class="flex-1 overflow-y-auto mt-3">
					{#if searchResults.length > 0}
						<div class="space-y-2">
							{#each searchResults as item (item.identifier)}
								<div
									class={classNames(
										'p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary':
												selectedItem?.identifier === item.identifier,
											'bg-base-100': selectedItem?.identifier !== item.identifier
										}
									)}
									onclick={() => selectItem(item)}
									onkeydown={(e) => e.key === 'Enter' && selectItem(item)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										<img
											src={getThumbnailUrl(item.identifier)}
											alt={item.title}
											class="w-12 h-12 object-cover rounded bg-base-300"
											loading="lazy"
											onerror={(e) => {
												(e.target as HTMLImageElement).src =
													'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
											}}
										/>
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{item.title}</div>
											{#if item.creator}
												<div class="text-xs text-base-content/60 truncate">
													{item.creator}
												</div>
											{/if}
											<div class="flex items-center gap-2 mt-1">
												{#if item.year}
													<span class="badge badge-ghost badge-xs">{item.year}</span>
												{/if}
												{#if item.downloads}
													<span class="text-xs text-base-content/50">
														{item.downloads.toLocaleString()} plays
													</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>

						<!-- Pagination -->
						{#if totalResults > 30}
							<div class="flex justify-center gap-2 mt-4">
								<button
									class="btn btn-xs btn-ghost"
									disabled={currentPage <= 1}
									onclick={() => search(currentPage - 1)}
								>
									Previous
								</button>
								<span class="text-xs self-center">Page {currentPage}</span>
								<button
									class="btn btn-xs btn-ghost"
									disabled={searchResults.length < 30}
									onclick={() => search(currentPage + 1)}
								>
									Next
								</button>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Track List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">Tracks</h2>
					{#if audioFiles.length > 0}
						<span class="badge badge-primary">{audioFiles.length}</span>
					{/if}
				</div>

				{#if !selectedItem}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">Select an item to view tracks.</p>
					</div>
				{:else if isLoadingDetails}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if detailsError}
					<div class="alert alert-error alert-sm">
						<span class="text-sm">{detailsError}</span>
					</div>
				{:else if audioFiles.length === 0}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">No playable audio files found.</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						<div class="space-y-1">
							{#each audioFiles as file, index (file.name)}
								{@const isCurrentTrack = currentTrack?.name === file.name}
								<button
									class={classNames(
										'w-full text-left p-2 rounded transition-colors',
										'hover:bg-base-300',
										{
											'bg-primary/20': isCurrentTrack,
											'bg-base-100': !isCurrentTrack
										}
									)}
									onclick={() => playTrack(file)}
								>
									<div class="flex items-center gap-2">
										<div
											class={classNames(
												'w-8 h-8 rounded flex items-center justify-center shrink-0',
												{
													'bg-primary text-primary-content': isCurrentTrack && isPlaying,
													'bg-base-300': !isCurrentTrack || !isPlaying
												}
											)}
										>
											{#if isCurrentTrack && isPlaying}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
												</svg>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M8 5v14l11-7z" />
												</svg>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<div class="text-sm truncate">
												{file.title || file.name.replace(/\.[^/.]+$/, '')}
											</div>
											<div class="flex items-center gap-2 text-xs text-base-content/60">
												{#if file.track}
													<span>Track {file.track}</span>
												{/if}
												<span>{formatDuration(file.length)}</span>
												{#if file.size}
													<span>{formatFileSize(file.size)}</span>
												{/if}
											</div>
										</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 3: Player & Details -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Now Playing</h2>

				{#if !selectedItem}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">Select an item to start playing.</p>
					</div>
				{:else}
					<div class="space-y-4">
						<!-- Album art and info -->
						<div class="flex gap-3">
							<img
								src={getThumbnailUrl(selectedItem.identifier)}
								alt={selectedItem.title}
								class="w-24 h-24 object-cover rounded bg-base-300"
								onerror={(e) => {
									(e.target as HTMLImageElement).src =
										'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
								}}
							/>
							<div class="flex-1 min-w-0">
								<h3 class="font-bold text-sm truncate">{selectedItem.title}</h3>
								{#if selectedItem.creator}
									<p class="text-sm text-base-content/60 truncate">{selectedItem.creator}</p>
								{/if}
								{#if selectedItem.year}
									<p class="text-xs text-base-content/50">{selectedItem.year}</p>
								{/if}
								<a
									href={getItemPageUrl(selectedItem.identifier)}
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs"
								>
									View on Archive.org
								</a>
							</div>
						</div>

						<!-- Player controls -->
						{#if currentTrack}
							<div class="bg-base-300 rounded-lg p-3">
								<div class="text-sm font-medium truncate mb-2">
									{currentTrack.title || currentTrack.name.replace(/\.[^/.]+$/, '')}
								</div>

								<!-- Progress bar -->
								<div
									class="h-2 bg-base-100 rounded-full cursor-pointer mb-2"
									onclick={seekTo}
									role="slider"
									aria-label="Seek"
									aria-valuemin={0}
									aria-valuemax={duration}
									aria-valuenow={currentTime}
									tabindex="0"
								>
									<div
										class="h-full bg-primary rounded-full transition-all"
										style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
									></div>
								</div>

								<!-- Time display -->
								<div class="flex justify-between text-xs text-base-content/60 mb-2">
									<span>{formatTime(currentTime)}</span>
									<span>{formatTime(duration)}</span>
								</div>

								<!-- Play controls -->
								<div class="flex justify-center gap-2">
									<button
										class="btn btn-circle btn-sm"
										onclick={() => {
											if (audioElement) audioElement.currentTime -= 10;
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="currentColor"
										>
											<path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
										</svg>
									</button>

									<button
										class="btn btn-circle btn-primary"
										onclick={() => (isPlaying ? pausePlayback() : audioElement?.play())}
									>
										{#if isPlaying}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
											</svg>
										{:else}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path d="M8 5v14l11-7z" />
											</svg>
										{/if}
									</button>

									<button
										class="btn btn-circle btn-sm"
										onclick={() => {
											if (audioElement) audioElement.currentTime += 10;
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="currentColor"
										>
											<path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
										</svg>
									</button>

									<button class="btn btn-circle btn-sm btn-ghost" onclick={stopPlayback}>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="currentColor"
										>
											<path d="M6 6h12v12H6z" />
										</svg>
									</button>
								</div>
							</div>
						{/if}

						<!-- Item details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-2 text-sm flex-1 overflow-y-auto">
							<div class="flex justify-between">
								<span class="text-base-content/60">Identifier:</span>
								<span class="font-mono text-xs truncate max-w-[50%]">
									{selectedItem.identifier}
								</span>
							</div>

							{#if itemDetails?.metadata?.date}
								<div class="flex justify-between">
									<span class="text-base-content/60">Date:</span>
									<span class="text-xs">{itemDetails.metadata.date}</span>
								</div>
							{/if}

							{#if itemDetails?.metadata?.runtime}
								<div class="flex justify-between">
									<span class="text-base-content/60">Runtime:</span>
									<span class="text-xs">{itemDetails.metadata.runtime}</span>
								</div>
							{/if}

							{#if selectedItem.downloads}
								<div class="flex justify-between">
									<span class="text-base-content/60">Downloads:</span>
									<span class="text-xs">{selectedItem.downloads.toLocaleString()}</span>
								</div>
							{/if}

							{#if itemDetails?.metadata?.subject?.length}
								<div>
									<span class="text-base-content/60 block mb-1">Tags:</span>
									<div class="flex flex-wrap gap-1">
										{#each itemDetails.metadata.subject.slice(0, 10) as tag}
											<span class="badge badge-ghost badge-xs">{tag}</span>
										{/each}
									</div>
								</div>
							{/if}

							{#if itemDetails?.metadata?.description}
								<div>
									<span class="text-base-content/60 block mb-1">Description:</span>
									<p class="text-xs text-base-content/80 line-clamp-4">
										{@html itemDetails.metadata.description.replace(/<[^>]*>/g, '')}
									</p>
								</div>
							{/if}

							{#if itemDetails?.metadata?.licenseurl}
								<div class="flex justify-between items-center">
									<span class="text-base-content/60">License:</span>
									<a
										href={itemDetails.metadata.licenseurl}
										target="_blank"
										rel="noopener noreferrer"
										class="link link-primary text-xs"
									>
										View License
									</a>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
