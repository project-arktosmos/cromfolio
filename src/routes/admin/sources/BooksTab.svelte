<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import type { Album } from '$types/album.type';
	import {
		searchBookAuthors,
		searchBookWorks,
		getAuthorWorks,
		fetchSourceImages,
		type BookAuthorSearchResult,
		type BookWorkSearchResult,
		type ImageItem as FetchImageItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';

	// Local image type for UI
	interface BookImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		source: string;
	}

	type BookSearchType = 'authors' | 'works';

	// Extended work type that includes images from the author works endpoint
	interface AuthorWorkResult extends BookWorkSearchResult {
		imageUrl?: string;
		images?: BookImageItem[];
	}

	// Search state
	let searchQuery = $state('');
	let searchType = $state<BookSearchType>('authors');
	let authorResults = $state<BookAuthorSearchResult[]>([]);
	let workResults = $state<BookWorkSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedAuthor = $state<BookAuthorSearchResult | null>(null);
	let selectedWork = $state<BookWorkSearchResult | null>(null);

	// Author's works state (when an author is selected)
	let authorWorks = $state<AuthorWorkResult[]>([]);
	let isLoadingWorks = $state(false);

	// Image fetching state
	let isLoadingImages = $state(false);
	let openlibraryImages = $state<BookImageItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);

	// Source existence tracking (for both authors and works)
	let authorSourceExistsMap = $state<Map<string, boolean>>(new Map());
	let workSourceExistsMap = $state<Map<string, boolean>>(new Map());

	// Progress tracking
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());

	// Handle progress events
	function handleProgress(event: FetchProgressEvent) {
		fetchProgress = new Map(fetchProgress).set(event.source, {
			status: event.status,
			message: event.message
		});
	}

	// Get selected item (author or work)
	function getSelectedItem(): BookAuthorSearchResult | BookWorkSearchResult | null {
		return searchType === 'authors' ? selectedAuthor : selectedWork;
	}

	// Derived state for selected work key (avoids type narrowing issues in templates)
	let selectedWorkKey = $derived(selectedWork?.key ?? null);

	// Search books via Rust backend
	async function searchBooks() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		authorResults = [];
		workResults = [];
		selectedAuthor = null;
		selectedWork = null;
		authorWorks = [];
		resetImages();

		try {
			if (searchType === 'authors') {
				const results = await searchBookAuthors(searchQuery.trim());
				authorResults = results;
				if (authorResults.length === 0) {
					searchError = 'No authors found';
				}
			} else {
				const results = await searchBookWorks(searchQuery.trim());
				workResults = results;
				if (workResults.length === 0) {
					searchError = 'No books found';
				}
			}
		} catch (error) {
			searchError = 'Failed to search books';
			console.error('[sources] searchBooks error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Reset images state
	function resetImages() {
		openlibraryImages = [];
		selectedCoverImage = null;
	}

	// Check if author source already exists in database
	async function checkAuthorSourceExists(authorKey: string): Promise<boolean> {
		if (authorSourceExistsMap.has(authorKey)) {
			return authorSourceExistsMap.get(authorKey)!;
		}
		const exists = await sourceExists('openlibrary_author', authorKey);
		authorSourceExistsMap = new Map(authorSourceExistsMap).set(authorKey, exists);
		return exists;
	}

	// Check if work source already exists in database
	async function checkWorkSourceExists(workKey: string): Promise<boolean> {
		const key = workKey.replace('/works/', '');
		if (workSourceExistsMap.has(key)) {
			return workSourceExistsMap.get(key)!;
		}
		const exists = await sourceExists('openlibrary_work', key);
		workSourceExistsMap = new Map(workSourceExistsMap).set(key, exists);
		return exists;
	}

	// Check if author is already added (from cache)
	function isAuthorSourceAdded(authorKey: string): boolean {
		return authorSourceExistsMap.get(authorKey) ?? false;
	}

	// Check if work is already added (from cache)
	function isWorkSourceAdded(workKey: string): boolean {
		const key = workKey.replace('/works/', '');
		return workSourceExistsMap.get(key) ?? false;
	}

	// Select an author and fetch their works
	async function selectAuthor(author: BookAuthorSearchResult) {
		if (selectedAuthor?.key === author.key) {
			selectedAuthor = null;
			authorWorks = [];
			resetImages();
		} else {
			selectedAuthor = author;
			selectedWork = null;
			albumCreated = null;
			selectedCoverImage = author.imageUrl || null;
			fetchProgress = new Map();
			await Promise.all([
				checkAuthorSourceExists(author.key),
				fetchAuthorWorksData(author)
			]);
			fetchAuthorImages(author);
		}
	}

	// Fetch works by the selected author via Rust backend
	async function fetchAuthorWorksData(author: BookAuthorSearchResult) {
		isLoadingWorks = true;
		authorWorks = [];

		try {
			const works = await getAuthorWorks(author.key, 50);
			authorWorks = works.map(w => ({
				...w,
				imageUrl: w.coverUrl
			}));
		} catch (error) {
			console.error('[sources] fetchAuthorWorks error:', error);
		} finally {
			isLoadingWorks = false;
		}
	}

	// Fetch images for author
	function fetchAuthorImages(author: BookAuthorSearchResult) {
		isLoadingImages = true;
		// Preserve the selected cover image (set from author.imageUrl in selectAuthor)
		const preservedCoverImage = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCoverImage;

		const images: BookImageItem[] = [];

		// Add author photo if available
		if (author.imageUrl) {
			images.push({
				url: author.imageUrl.replace('-M.jpg', '-L.jpg'),
				thumbUrl: author.imageUrl,
				type: 'author-photo',
				source: 'openlibrary'
			});
		}

		openlibraryImages = images;
		isLoadingImages = false;
	}

	// Select a work and fetch images
	async function selectWork(work: BookWorkSearchResult) {
		if (selectedWork?.key === work.key) {
			selectedWork = null;
			resetImages();
		} else {
			selectedWork = work;
			selectedAuthor = null;
			authorWorks = [];
			albumCreated = null;
			selectedCoverImage = work.coverUrl || null;
			await checkWorkSourceExists(work.key);
			fetchWorkImages(work);
		}
	}

	// Fetch images for work
	function fetchWorkImages(work: BookWorkSearchResult) {
		isLoadingImages = true;
		// Preserve the selected cover image (set from work.coverUrl in selectWork)
		const preservedCoverImage = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCoverImage;

		const images: BookImageItem[] = [];

		// Add cover image if available
		if (work.coverUrl) {
			images.push({
				url: work.coverUrl.replace('-M.jpg', '-L.jpg'),
				thumbUrl: work.coverUrl,
				type: 'cover',
				source: 'openlibrary'
			});
		}

		openlibraryImages = images;
		isLoadingImages = false;
	}

	// Select a work from author's works list
	function selectWorkFromAuthor(work: AuthorWorkResult) {
		selectedWork = work;
		albumCreated = null;
		selectedCoverImage = work.imageUrl || null;

		// If work already has images from the API response, use those
		if (work.images && work.images.length > 0) {
			openlibraryImages = work.images;
			isLoadingImages = false;
		} else {
			fetchWorkImages(work);
		}
	}

	// Select an image as cover
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Create album from selected author
	async function createAlbumFromAuthor() {
		if (!selectedAuthor) return;

		// Check if already added
		const alreadyAdded = await sourceExists('openlibrary_author', selectedAuthor.key);
		if (alreadyAdded) {
			console.warn('[sources] Author already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'author',
				title: selectedAuthor.name,
				description: `Author${selectedAuthor.birthDate ? ` (b. ${selectedAuthor.birthDate})` : ''}${selectedAuthor.workCount ? ` - ${selectedAuthor.workCount} works` : ''}${selectedAuthor.topWork ? ` - Known for: ${selectedAuthor.topWork}` : ''}`,
				coverImage: selectedCoverImage || undefined,
				openLibraryAuthorId: selectedAuthor.key,
				authorName: selectedAuthor.name,
				bookType: 'author',
				bookSubjects: selectedAuthor.topSubjects,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'book_author', 'openlibrary_author', selectedAuthor.key);
				albumCreated = createdAlbum;
				// Update local cache
				authorSourceExistsMap = new Map(authorSourceExistsMap).set(selectedAuthor.key, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumFromAuthor error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Create album from selected work
	async function createAlbumFromWork() {
		if (!selectedWork) return;

		const workKey = selectedWork.key.replace('/works/', '');

		// Check if already added
		const alreadyAdded = await sourceExists('openlibrary_work', workKey);
		if (alreadyAdded) {
			console.warn('[sources] Work already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'author',
				title: selectedWork.title,
				description: `Book by ${selectedWork.authorName || 'Unknown'}${selectedWork.firstPublishYear ? ` (${selectedWork.firstPublishYear})` : ''}${selectedWork.editionCount ? ` - ${selectedWork.editionCount} editions` : ''}`,
				coverImage: selectedCoverImage || undefined,
				openLibraryWorkId: workKey,
				openLibraryAuthorId: selectedWork.authorKey,
				authorName: selectedWork.authorName,
				bookType: 'work',
				bookSubjects: selectedWork.subjects,
				firstPublishYear: selectedWork.firstPublishYear,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'book_work', 'openlibrary_work', workKey);
				albumCreated = createdAlbum;
				// Update local cache
				workSourceExistsMap = new Map(workSourceExistsMap).set(workKey, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumFromWork error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Create album based on current selection
	async function createAlbum() {
		if (selectedWork) {
			await createAlbumFromWork();
		} else if (selectedAuthor) {
			await createAlbumFromAuthor();
		}
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		authorResults = [];
		workResults = [];
		searchError = null;
		selectedAuthor = null;
		selectedWork = null;
		authorWorks = [];
		albumCreated = null;
		resetImages();
	}

	// Get display title
	function getDisplayTitle(): string {
		if (selectedWork) {
			return selectedWork.title;
		}
		if (selectedAuthor) {
			return selectedAuthor.name;
		}
		return '';
	}
</script>

<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Books</h2>

			<div class="space-y-3">
				<!-- Search type selector -->
				<div class="tabs tabs-boxed tabs-xs">
					<button
						class={classNames('tab', { 'tab-active': searchType === 'authors' })}
						onclick={() => {
							searchType = 'authors';
							resetSearch();
						}}
					>
						Authors
					</button>
					<button
						class={classNames('tab', { 'tab-active': searchType === 'works' })}
						onclick={() => {
							searchType = 'works';
							resetSearch();
						}}
					>
						Books
					</button>
				</div>

				<!-- Search input -->
				<div class="form-control">
					<input
						type="text"
						placeholder={searchType === 'authors' ? 'Search authors...' : 'Search books...'}
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && searchBooks()}
					/>
				</div>

				<!-- Search button -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={searchBooks}
						disabled={!searchQuery.trim() || isSearching}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Search
						{/if}
					</button>

					{#if authorResults.length > 0 || workResults.length > 0}
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
				{#if searchType === 'authors' && authorResults.length > 0}
					<div class="space-y-2">
						{#each authorResults as author (author.key)}
							{@const alreadyExists = isAuthorSourceAdded(author.key)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedAuthor?.key === author.key,
										'bg-base-100': selectedAuthor?.key !== author.key
									}
								)}
								onclick={() => selectAuthor(author)}
								onkeydown={(e) => e.key === 'Enter' && selectAuthor(author)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if author.imageUrl}
										<img
											src={author.imageUrl}
											alt={author.name}
											class="w-10 h-14 object-cover rounded"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
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
													d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
												/>
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{author.name}</div>
										<div class="text-xs text-base-content/60">
											{author.workCount || 0} works
										</div>
										{#if author.topWork}
											<div class="text-xs text-base-content/50 truncate">
												Best: {author.topWork}
											</div>
										{/if}
										{#if author.birthDate || author.deathDate}
											<div class="text-xs text-base-content/50">
												{author.birthDate || '?'} - {author.deathDate || 'present'}
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
				{:else if searchType === 'works' && workResults.length > 0}
					<div class="space-y-2">
						{#each workResults as work (work.key)}
							{@const alreadyExists = isWorkSourceAdded(work.key)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedWork?.key === work.key,
										'bg-base-100': selectedWork?.key !== work.key
									}
								)}
								onclick={() => selectWork(work)}
								onkeydown={(e) => e.key === 'Enter' && selectWork(work)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if work.coverUrl}
										<img
											src={work.coverUrl}
											alt={work.title}
											class="w-10 h-14 object-cover rounded"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
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
													d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
												/>
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{work.title}</div>
										<div class="text-xs text-base-content/60">
											{work.authorName || 'Unknown author'}
										</div>
										<div class="text-xs text-base-content/50">
											{work.firstPublishYear || 'Unknown'} &middot; {work.editionCount || 0} editions
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
			</div>
		</div>
	</div>

	<!-- Column 2: Images / Author's Works -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			{#if selectedAuthor && !selectedWork}
				<!-- Show author's works when author is selected -->
				<h2 class="card-title text-lg mb-2">Works by {selectedAuthor.name}</h2>

				{#if isLoadingWorks}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if authorWorks.length === 0}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">No works found for this author.</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						<div class="space-y-2">
							{#each authorWorks as work (work.key)}
								{@const alreadyExists = isWorkSourceAdded(work.key)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedWorkKey === work.key,
											'bg-base-100': selectedWorkKey !== work.key
										}
									)}
									onclick={() => selectWorkFromAuthor(work)}
									onkeydown={(e) => e.key === 'Enter' && selectWorkFromAuthor(work)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if work.imageUrl}
											<img
												src={work.imageUrl}
												alt={work.title}
												class="w-8 h-12 object-cover rounded"
												onerror={(e) => {
													(e.target as HTMLImageElement).style.display = 'none';
												}}
											/>
										{:else}
											<div
												class="w-8 h-12 bg-base-300 rounded flex items-center justify-center text-base-content/30"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
													/>
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{work.title}</div>
											{#if work.firstPublishYear}
												<div class="text-xs text-base-content/50">{work.firstPublishYear}</div>
											{/if}
											{#if alreadyExists}
												<span class="badge badge-warning badge-xs">Exists</span>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<!-- Show images when a work is selected or no author selected -->
				<h2 class="card-title text-lg mb-2">Images</h2>

				{#if !getSelectedItem() && !selectedWork}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">Select an author or book to view images.</p>
					</div>
				{:else if isLoadingImages}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else}
					<!-- Image grid -->
					<div class="flex-1 overflow-y-auto">
						{#if openlibraryImages.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No images available.</p>
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								{#each openlibraryImages as image, i (image.url + i)}
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
			{/if}
		</div>
	</div>

	<!-- Column 3: Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedAuthor && !selectedWork}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select an author or book to create an album.</p>
					</div>
				{:else if selectedWork}
					{@const displayTitle = selectedWork.title}
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
								<div
									class="w-20 h-28 bg-base-300 rounded flex items-center justify-center text-base-content/30"
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
											d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{displayTitle}</h3>
								<p class="text-sm text-base-content/60">
									{selectedWork.authorName || 'Unknown author'}
								</p>
								{#if selectedWork.firstPublishYear}
									<p class="text-sm">{selectedWork.firstPublishYear}</p>
								{/if}
								<a
									href="https://openlibrary.org{selectedWork.key}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs mt-1 block"
								>
									Open Library
								</a>
							</div>
						</div>

						<!-- Album details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Work Key:</span>
								<span class="font-mono text-xs truncate max-w-[50%]"
									>{selectedWork.key.replace('/works/', '')}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Author:</span>
								<span class="text-xs truncate max-w-[60%]"
									>{selectedWork.authorName || 'Unknown'}</span
								>
							</div>
							{#if selectedWork.firstPublishYear}
								<div class="flex justify-between">
									<span class="text-base-content/60">First Published:</span>
									<span class="text-xs">{selectedWork.firstPublishYear}</span>
								</div>
							{/if}
							{#if selectedWork.editionCount}
								<div class="flex justify-between">
									<span class="text-base-content/60">Editions:</span>
									<span class="text-xs">{selectedWork.editionCount}</span>
								</div>
							{/if}
							{#if selectedWork.subjects?.length}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Subjects:</span>
									<span class="text-xs text-right max-w-[60%]">
										{selectedWork.subjects.slice(0, 3).join(', ')}
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
							<a href="/admin/album" class="btn btn-outline btn-sm w-full"> Go to Album Manager </a>
						{:else if isWorkSourceAdded(selectedWork.key)}
							<div class="alert alert-warning">
								<span class="text-sm">This book has already been added.</span>
							</div>
						{:else}
							<button class="btn btn-primary w-full" onclick={createAlbum} disabled={isCreatingAlbum}>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Album
								{/if}
							</button>
						{/if}
					</div>
				{:else if selectedAuthor}
					{@const displayTitle = selectedAuthor.name}
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
								<div
									class="w-20 h-28 bg-base-300 rounded flex items-center justify-center text-base-content/30"
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
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{displayTitle}</h3>
								{#if selectedAuthor.birthDate || selectedAuthor.deathDate}
									<p class="text-sm text-base-content/60">
										{selectedAuthor.birthDate || '?'} - {selectedAuthor.deathDate || 'present'}
									</p>
								{/if}
								{#if selectedAuthor.workCount}
									<p class="text-sm">{selectedAuthor.workCount} works</p>
								{/if}
								<a
									href="https://openlibrary.org/authors/{selectedAuthor.key}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs mt-1 block"
								>
									Open Library
								</a>
							</div>
						</div>

						<!-- Album details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Author Key:</span>
								<span class="font-mono text-xs truncate max-w-[50%]">{selectedAuthor.key}</span>
							</div>
							{#if selectedAuthor.workCount}
								<div class="flex justify-between">
									<span class="text-base-content/60">Works:</span>
									<span class="text-xs">{selectedAuthor.workCount}</span>
								</div>
							{/if}
							{#if selectedAuthor.topWork}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Top Work:</span>
									<span class="text-xs text-right max-w-[60%] truncate"
										>{selectedAuthor.topWork}</span
									>
								</div>
							{/if}
							{#if selectedAuthor.topSubjects?.length}
								<div class="flex justify-between items-start">
									<span class="text-base-content/60">Subjects:</span>
									<span class="text-xs text-right max-w-[60%]">
										{selectedAuthor.topSubjects.slice(0, 3).join(', ')}
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

						<div class="alert alert-info alert-sm">
							<span class="text-xs"
								>Select a work from the middle column to create a book album, or create an author
								album below.</span
							>
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
							<a href="/admin/album" class="btn btn-outline btn-sm w-full"> Go to Album Manager </a>
						{:else if isAuthorSourceAdded(selectedAuthor.key)}
							<div class="alert alert-warning">
								<span class="text-sm">This author has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-secondary w-full"
								onclick={createAlbum}
								disabled={isCreatingAlbum}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Author Album
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
