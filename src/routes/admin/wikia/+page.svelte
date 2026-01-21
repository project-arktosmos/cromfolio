<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { albumsService } from '$services/albums.service';
	import { isTriviaSection } from '$services/fandom.service';
	import type { Album } from '$types/album.type';
	import type {
		FandomWiki,
		FandomArticle,
		FandomArticleSection,
		FandomCategory,
		FandomImage
	} from '$types/fandom.type';

	// Collection state
	let albums: Album[] = $state([]);
	let isLoading = $state(true);
	let selectedAlbum = $state<Album | null>(null);

	// Wiki discovery state
	let wikiResults = $state<FandomWiki[]>([]);
	let isSearchingWikis = $state(false);
	let wikiSearchError = $state<string | null>(null);
	let selectedWiki = $state<FandomWiki | null>(null);
	let manualWikiInput = $state('');

	// Article/Content exploration state
	let activeTab = $state<'search' | 'sections' | 'categories' | 'images'>('search');
	let articleSearchQuery = $state('');
	let articleResults = $state<FandomArticle[]>([]);
	let isSearchingArticles = $state(false);
	let selectedArticle = $state<FandomArticle | null>(null);
	let articleSections = $state<FandomArticleSection[]>([]);
	let selectedSection = $state<FandomArticleSection | null>(null);
	let sectionContent = $state<string | null>(null);
	let categories = $state<FandomCategory[]>([]);
	let selectedCategory = $state<FandomCategory | null>(null);
	let categoryMembers = $state<FandomArticle[]>([]);
	let isLoadingCategories = $state(false);
	let isLoadingCategoryMembers = $state(false);
	let isLoadingSections = $state(false);
	let isLoadingContent = $state(false);

	// Image search state
	let imageSearchQuery = $state('');
	let imageResults = $state<FandomImage[]>([]);
	let isSearchingImages = $state(false);
	let selectedImage = $state<FandomImage | null>(null);

	onMount(() => {
		// Load albums from localStorage service
		albums = albumsService.all();
		isLoading = false;
	});

	// Select/deselect an album
	function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id) {
			selectedAlbum = null;
			resetWikiExplorer();
		} else {
			selectedAlbum = album;
			resetWikiExplorer();
			// If album has a wikia URL, try to extract wiki name and select it
			if (album.wikiaUrl) {
				const match = album.wikiaUrl.match(/https?:\/\/([^.]+)\.fandom\.com/);
				if (match) {
					manualWikiInput = match[1];
					tryManualWiki();
				}
			} else {
				searchWikis(album.title);
			}
		}
	}

	// Link the selected wiki to the current album
	function linkWikiToAlbum(wiki: FandomWiki) {
		if (!selectedAlbum) return;

		const updatedAlbum: Album = {
			...selectedAlbum,
			wikiaUrl: wiki.url
		};

		albumsService.update(updatedAlbum);
		albums = albumsService.all();
		selectedAlbum = updatedAlbum;
	}

	// Reset wiki explorer state
	function resetWikiExplorer() {
		wikiResults = [];
		selectedWiki = null;
		wikiSearchError = null;
		resetArticleExplorer();
	}

	// Reset article explorer state
	function resetArticleExplorer() {
		activeTab = 'search';
		articleSearchQuery = '';
		articleResults = [];
		selectedArticle = null;
		articleSections = [];
		selectedSection = null;
		sectionContent = null;
		categories = [];
		selectedCategory = null;
		categoryMembers = [];
		imageSearchQuery = '';
		imageResults = [];
		selectedImage = null;
	}

	// Search for wikis
	async function searchWikis(query: string) {
		isSearchingWikis = true;
		wikiSearchError = null;

		try {
			const response = await fetch(`/api/fandom/wikis?query=${encodeURIComponent(query)}&limit=10`);
			const data = await response.json();

			if (data.error) {
				wikiSearchError = data.error;
			} else {
				wikiResults = data.wikis || [];
			}
		} catch (error) {
			wikiSearchError = 'Failed to search wikis';
			console.error('[wikia] searchWikis error:', error);
		} finally {
			isSearchingWikis = false;
		}
	}

	// Try to add a manual wiki
	async function tryManualWiki() {
		if (!manualWikiInput.trim()) return;

		isSearchingWikis = true;
		wikiSearchError = null;

		try {
			const response = await fetch(
				`/api/fandom/wikis?query=${encodeURIComponent(manualWikiInput.trim())}&limit=1`
			);
			const data = await response.json();

			if (data.wikis && data.wikis.length > 0) {
				const wiki = data.wikis[0];
				// Add to results if not already there
				if (!wikiResults.find((w) => w.name === wiki.name)) {
					wikiResults = [wiki, ...wikiResults];
				}
				selectWiki(wiki);
			} else {
				wikiSearchError = `Wiki "${manualWikiInput}" not found`;
			}
		} catch (error) {
			wikiSearchError = 'Failed to validate wiki';
			console.error('[wikia] tryManualWiki error:', error);
		} finally {
			isSearchingWikis = false;
			manualWikiInput = '';
		}
	}

	// Select a wiki
	function selectWiki(wiki: FandomWiki) {
		selectedWiki = wiki;
		resetArticleExplorer();
		// Pre-fill search with album title
		if (selectedAlbum) {
			articleSearchQuery = selectedAlbum.title;
		}
	}

	// Search articles in the selected wiki
	async function searchArticles() {
		if (!selectedWiki || !articleSearchQuery.trim()) return;

		isSearchingArticles = true;

		try {
			const response = await fetch(
				`/api/fandom/wiki/search?wiki=${encodeURIComponent(selectedWiki.name)}&query=${encodeURIComponent(articleSearchQuery)}&limit=20`
			);
			const data = await response.json();
			articleResults = data.articles || [];
		} catch (error) {
			console.error('[wikia] searchArticles error:', error);
		} finally {
			isSearchingArticles = false;
		}
	}

	// Select an article and load its sections
	async function selectArticleForSections(article: FandomArticle) {
		selectedArticle = article;
		selectedSection = null;
		sectionContent = null;
		activeTab = 'sections';
		isLoadingSections = true;

		try {
			const response = await fetch(
				`/api/fandom/wiki/article?wiki=${encodeURIComponent(selectedWiki!.name)}&title=${encodeURIComponent(article.title)}&sectionsOnly=true`
			);
			const data = await response.json();
			articleSections = data.sections || [];
		} catch (error) {
			console.error('[wikia] selectArticleForSections error:', error);
		} finally {
			isLoadingSections = false;
		}
	}

	// Load section content
	async function loadSectionContent(section: FandomArticleSection) {
		if (!selectedWiki || !selectedArticle) return;

		selectedSection = section;
		isLoadingContent = true;

		try {
			const response = await fetch(
				`/api/fandom/wiki/article?wiki=${encodeURIComponent(selectedWiki.name)}&title=${encodeURIComponent(selectedArticle.title)}&section=${section.index}`
			);
			const data = await response.json();
			sectionContent = data.content || null;
		} catch (error) {
			console.error('[wikia] loadSectionContent error:', error);
		} finally {
			isLoadingContent = false;
		}
	}

	// Load categories
	async function loadCategories() {
		if (!selectedWiki) return;

		activeTab = 'categories';
		isLoadingCategories = true;

		try {
			const response = await fetch(
				`/api/fandom/wiki/categories?wiki=${encodeURIComponent(selectedWiki.name)}&limit=50`
			);
			const data = await response.json();
			categories = data.categories || [];
		} catch (error) {
			console.error('[wikia] loadCategories error:', error);
		} finally {
			isLoadingCategories = false;
		}
	}

	// Select a category and load its members
	async function selectCategory(category: FandomCategory) {
		if (!selectedWiki) return;

		selectedCategory = category;
		isLoadingCategoryMembers = true;

		try {
			const response = await fetch(
				`/api/fandom/wiki/category-members?wiki=${encodeURIComponent(selectedWiki.name)}&category=${encodeURIComponent(category.title)}&limit=50`
			);
			const data = await response.json();
			categoryMembers = data.members || [];
		} catch (error) {
			console.error('[wikia] selectCategory error:', error);
		} finally {
			isLoadingCategoryMembers = false;
		}
	}

	// Search images in the selected wiki
	async function searchImages() {
		if (!selectedWiki) return;

		isSearchingImages = true;
		selectedImage = null;

		try {
			const params = new URLSearchParams({
				wiki: selectedWiki.name,
				limit: '24',
				thumbWidth: '200'
			});

			if (imageSearchQuery.trim()) {
				params.set('query', imageSearchQuery.trim());
			}

			const response = await fetch(`/api/fandom/wiki/images?${params}`);
			const data = await response.json();
			imageResults = data.images || [];

			// Debug: log full image URLs (not truncated)
			console.log('[wikia] searchImages results:');
			imageResults.forEach((img, i) => {
				console.log(`[${i}] ${img.name}`);
				console.log(`    url: ${img.url}`);
				console.log(`    thumbUrl: ${img.thumbUrl}`);
			});
		} catch (error) {
			console.error('[wikia] searchImages error:', error);
		} finally {
			isSearchingImages = false;
		}
	}

	// Handle image load error
	function handleImageError(event: Event, image: FandomImage) {
		const img = event.target as HTMLImageElement;
		console.error('[wikia] Image failed to load:', {
			name: image.name,
			attemptedUrl: img.src,
			originalUrl: image.url,
			thumbUrl: image.thumbUrl
		});
		// Hide the broken image
		img.style.display = 'none';
	}

	// Format file size
	function formatFileSize(bytes: number | undefined): string {
		if (bytes === undefined) return '';
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${bytes} B`;
	}

	// Format article count
	function formatCount(count: number | undefined): string {
		if (count === undefined) return '';
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Album Wikia Finder</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
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
							<p class="text-sm mt-1">
								Create albums in the <a href="/admin/album" class="link link-primary">Album Manager</a> first.
							</p>
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
												class="w-10 h-14 object-cover rounded"
											/>
										{/if}
										<div class="flex-1 min-w-0">
											<span class="font-medium truncate block">{album.title}</span>
											{#if album.wikiaUrl}
												<span class="badge badge-info badge-xs mt-1">Wikia linked</span>
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

		<!-- Column 2: Wiki Discovery -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Wiki Discovery</h2>

				<!-- Manual wiki input -->
				<div class="flex gap-2 mb-3">
					<input
						type="text"
						placeholder="Enter wiki name (e.g., breakingbad)"
						class="input input-bordered input-sm flex-1"
						bind:value={manualWikiInput}
						onkeydown={(e) => e.key === 'Enter' && tryManualWiki()}
						disabled={!selectedAlbum}
					/>
					<button
						class="btn btn-secondary btn-sm"
						onclick={tryManualWiki}
						disabled={!manualWikiInput.trim() || !selectedAlbum}
					>
						+
					</button>
				</div>

				{#if wikiSearchError}
					<div class="alert alert-error alert-sm mb-3">
						<span>{wikiSearchError}</span>
					</div>
				{/if}

				<!-- Wiki results -->
				<div class="flex-1 overflow-y-auto">
					{#if !selectedAlbum}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an album to discover wikis.</p>
						</div>
					{:else if isSearchingWikis}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if wikiResults.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No wikis found.</p>
							<p class="text-sm mt-1">Try entering a wiki name manually.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each wikiResults as wiki (wiki.name)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors',
										'hover:bg-base-300',
										{
											'bg-secondary/20 ring-2 ring-secondary': selectedWiki?.name === wiki.name,
											'bg-base-100': selectedWiki?.name !== wiki.name
										}
									)}
								>
									<button
										class="w-full text-left"
										onclick={() => selectWiki(wiki)}
									>
										<div class="font-medium truncate">{wiki.title}</div>
										<div class="text-sm text-base-content/60 truncate">{wiki.url}</div>
										{#if wiki.stats?.articles}
											<div class="text-xs text-base-content/50 mt-1">
												{formatCount(wiki.stats.articles)} articles
											</div>
										{/if}
									</button>
									{#if selectedAlbum && selectedAlbum.wikiaUrl !== wiki.url}
										<button
											class="btn btn-info btn-xs mt-2"
											onclick={() => linkWikiToAlbum(wiki)}
										>
											Link to Album
										</button>
									{:else if selectedAlbum?.wikiaUrl === wiki.url}
										<span class="badge badge-success badge-sm mt-2">Linked</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 3: Wiki Explorer -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">
					{#if selectedWiki}
						{selectedWiki.title}
					{:else}
						Wiki Explorer
					{/if}
				</h2>

				{#if !selectedWiki}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a wiki to explore.</p>
					</div>
				{:else}
					<!-- Tabs -->
					<div class="tabs tabs-boxed mb-3">
						<button
							class={classNames('tab', { 'tab-active': activeTab === 'search' })}
							onclick={() => (activeTab = 'search')}
						>
							Search
						</button>
						<button
							class={classNames('tab', { 'tab-active': activeTab === 'sections' })}
							onclick={() => (activeTab = 'sections')}
						>
							Sections
						</button>
						<button
							class={classNames('tab', { 'tab-active': activeTab === 'categories' })}
							onclick={() => {
								if (categories.length === 0) loadCategories();
								else activeTab = 'categories';
							}}
						>
							Categories
						</button>
						<button
							class={classNames('tab', { 'tab-active': activeTab === 'images' })}
							onclick={() => {
								activeTab = 'images';
								if (imageResults.length === 0) searchImages();
							}}
						>
							Images
						</button>
					</div>

					<!-- Tab content -->
					<div class="flex-1 overflow-y-auto">
						{#if activeTab === 'search'}
							<!-- Search tab -->
							<div class="flex gap-2 mb-3">
								<input
									type="text"
									placeholder="Search articles..."
									class="input input-bordered input-sm flex-1"
									bind:value={articleSearchQuery}
									onkeydown={(e) => e.key === 'Enter' && searchArticles()}
								/>
								<button
									class="btn btn-primary btn-sm"
									onclick={searchArticles}
									disabled={!articleSearchQuery.trim() || isSearchingArticles}
								>
									{#if isSearchingArticles}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Search
									{/if}
								</button>
							</div>

							{#if articleResults.length > 0}
								<div class="space-y-2">
									{#each articleResults as article (article.id)}
										<div class="p-2 rounded bg-base-100">
											<div class="flex items-center justify-between">
												<a
													href={article.url}
													target="_blank"
													rel="noopener noreferrer"
													class="font-medium text-primary hover:underline truncate flex-1"
												>
													{article.title}
												</a>
												<button
													class="btn btn-ghost btn-xs"
													onclick={() => selectArticleForSections(article)}
													title="View sections"
												>
													→
												</button>
											</div>
											{#if article.snippet}
												<div
													class="text-sm text-base-content/60 mt-1 line-clamp-2"
													>{@html article.snippet}</div
												>
											{/if}
										</div>
									{/each}
								</div>
							{:else if !isSearchingArticles && articleSearchQuery}
								<div class="text-center text-base-content/60 p-4">
									<p>No articles found.</p>
								</div>
							{/if}
						{:else if activeTab === 'sections'}
							<!-- Sections tab -->
							{#if !selectedArticle}
								<div class="text-center text-base-content/60 p-4">
									<p>Search for an article and click → to view its sections.</p>
								</div>
							{:else}
								<div class="mb-3">
									<div class="font-medium">{selectedArticle.title}</div>
									<a
										href={selectedArticle.url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-sm text-primary hover:underline"
									>
										Open in browser →
									</a>
								</div>

								{#if isLoadingSections}
									<div class="flex justify-center p-4">
										<span class="loading loading-spinner loading-md"></span>
									</div>
								{:else if articleSections.length === 0}
									<div class="text-center text-base-content/60 p-4">
										<p>No sections found.</p>
									</div>
								{:else}
									<div class="space-y-1 mb-4">
										{#each articleSections as section (section.index)}
											{@const isTrivia = isTriviaSection(section.line)}
											<button
												class={classNames(
													'w-full text-left p-2 rounded transition-colors',
													'hover:bg-base-300',
													{
														'bg-warning/20 font-medium': isTrivia,
														'bg-base-100': !isTrivia,
														'ring-2 ring-primary': selectedSection?.index === section.index
													}
												)}
												style={`padding-left: ${section.toclevel * 12 + 8}px`}
												onclick={() => loadSectionContent(section)}
											>
												<span class="text-base-content/50 mr-2">{section.number}</span>
												{section.line}
												{#if isTrivia}
													<span class="badge badge-warning badge-xs ml-2">Trivia</span>
												{/if}
											</button>
										{/each}
									</div>

									{#if selectedSection}
										<div class="divider my-2"></div>
										<div class="font-medium mb-2">{selectedSection.line}</div>
										{#if isLoadingContent}
											<div class="flex justify-center p-4">
												<span class="loading loading-spinner loading-sm"></span>
											</div>
										{:else if sectionContent}
											<div class="prose prose-sm max-w-none bg-base-100 p-3 rounded">
												{@html sectionContent}
											</div>
										{/if}
									{/if}
								{/if}
							{/if}
						{:else if activeTab === 'categories'}
							<!-- Categories tab -->
							{#if isLoadingCategories}
								<div class="flex justify-center p-4">
									<span class="loading loading-spinner loading-md"></span>
								</div>
							{:else if categories.length === 0}
								<div class="text-center text-base-content/60 p-4">
									<p>No categories found.</p>
								</div>
							{:else}
								<div class="grid grid-cols-2 gap-2">
									{#each categories as category (category.title)}
										<button
											class={classNames(
												'text-left p-2 rounded transition-colors text-sm',
												'hover:bg-base-300',
												{
													'bg-accent/20 ring-2 ring-accent':
														selectedCategory?.title === category.title,
													'bg-base-100': selectedCategory?.title !== category.title
												}
											)}
											onclick={() => selectCategory(category)}
										>
											<div class="truncate">{category.title.replace('Category:', '')}</div>
											{#if category.size !== undefined}
												<div class="text-xs text-base-content/50">{category.size} pages</div>
											{/if}
										</button>
									{/each}
								</div>

								{#if selectedCategory}
									<div class="divider my-3"></div>
									<div class="font-medium mb-2">
										{selectedCategory.title.replace('Category:', '')}
									</div>

									{#if isLoadingCategoryMembers}
										<div class="flex justify-center p-4">
											<span class="loading loading-spinner loading-sm"></span>
										</div>
									{:else if categoryMembers.length === 0}
										<div class="text-center text-base-content/60 p-4">
											<p>No articles in this category.</p>
										</div>
									{:else}
										<div class="space-y-1">
											{#each categoryMembers as member (member.id)}
												<div class="flex items-center justify-between p-2 rounded bg-base-100">
													<a
														href={member.url}
														target="_blank"
														rel="noopener noreferrer"
														class="text-primary hover:underline truncate flex-1"
													>
														{member.title}
													</a>
													<button
														class="btn btn-ghost btn-xs"
														onclick={() => selectArticleForSections(member)}
														title="View sections"
													>
														→
													</button>
												</div>
											{/each}
										</div>
									{/if}
								{/if}
							{/if}
						{:else if activeTab === 'images'}
							<!-- Images tab -->
							<div class="flex gap-2 mb-3">
								<input
									type="text"
									placeholder="Search images..."
									class="input input-bordered input-sm flex-1"
									bind:value={imageSearchQuery}
									onkeydown={(e) => e.key === 'Enter' && searchImages()}
								/>
								<button
									class="btn btn-primary btn-sm"
									onclick={searchImages}
									disabled={isSearchingImages}
								>
									{#if isSearchingImages}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Search
									{/if}
								</button>
							</div>

							{#if isSearchingImages}
								<div class="flex justify-center p-4">
									<span class="loading loading-spinner loading-md"></span>
								</div>
							{:else if imageResults.length === 0}
								<div class="text-center text-base-content/60 p-4">
									<p>No images found.</p>
									<p class="text-sm mt-1">Try searching for a character or episode name.</p>
								</div>
							{:else}
								<div class="grid grid-cols-3 gap-2 mb-3">
									{#each imageResults as image (image.name)}
										<button
											class={classNames(
												'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
												'hover:ring-2 hover:ring-primary',
												{
													'ring-2 ring-primary': selectedImage?.name === image.name
												}
											)}
											onclick={() => (selectedImage = selectedImage?.name === image.name ? null : image)}
											title={image.title}
										>
											<img
												src={image.thumbUrl || image.url}
												alt={image.title}
												class="w-full h-full object-cover"
												loading="lazy"
												referrerpolicy="no-referrer"
												onerror={(e) => handleImageError(e, image)}
											/>
										</button>
									{/each}
								</div>

								{#if selectedImage}
									<div class="divider my-2"></div>
									<div class="bg-base-100 rounded p-3">
										<div class="font-medium truncate mb-2" title={selectedImage.title}>
											{selectedImage.title}
										</div>
										<div class="flex gap-3">
											<img
												src={selectedImage.thumbUrl || selectedImage.url}
												alt={selectedImage.title}
												class="w-24 h-24 object-cover rounded bg-base-300"
												referrerpolicy="no-referrer"
												onerror={(e) => handleImageError(e, selectedImage)}
											/>
											<div class="flex-1 text-sm space-y-1">
												{#if selectedImage.width && selectedImage.height}
													<div class="text-base-content/60">
														{selectedImage.width} x {selectedImage.height}
													</div>
												{/if}
												{#if selectedImage.size}
													<div class="text-base-content/60">
														{formatFileSize(selectedImage.size)}
													</div>
												{/if}
												{#if selectedImage.mime}
													<div class="text-base-content/60">
														{selectedImage.mime}
													</div>
												{/if}
												<div class="flex flex-wrap gap-1 mt-2">
													<a
														href={selectedImage.url}
														target="_blank"
														rel="noopener noreferrer"
														class="btn btn-xs btn-primary"
													>
														Full Image
													</a>
													<a
														href={selectedImage.descriptionUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="btn btn-xs btn-ghost"
													>
														Wiki Page
													</a>
												</div>
											</div>
										</div>
									</div>
								{/if}
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
