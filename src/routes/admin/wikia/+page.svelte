<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { tvShowsService } from '$services/tvshows.service';
	import { isTriviaSection } from '$services/fandom.service';
	import type { TVShow } from '$types/tvshow.type';
	import type {
		FandomWiki,
		FandomArticle,
		FandomArticleSection,
		FandomCategory
	} from '$types/fandom.type';

	// Collection state
	let shows: TVShow[] = $state([]);
	let isLoading = $state(true);
	let selectedShow = $state<TVShow | null>(null);

	// Manual show input
	let newShowTitle = $state('');

	// Wiki discovery state
	let wikiResults = $state<FandomWiki[]>([]);
	let isSearchingWikis = $state(false);
	let wikiSearchError = $state<string | null>(null);
	let selectedWiki = $state<FandomWiki | null>(null);
	let manualWikiInput = $state('');

	// Article/Content exploration state
	let activeTab = $state<'search' | 'sections' | 'categories'>('search');
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

	onMount(() => {
		// Load shows from localStorage service
		shows = tvShowsService.all();
		isLoading = false;
	});

	// Add a new show manually
	function addShow() {
		if (!newShowTitle.trim()) return;

		const show: TVShow = {
			id: crypto.randomUUID(),
			title: newShowTitle.trim(),
			addedAt: new Date().toISOString()
		};

		tvShowsService.add(show);
		shows = tvShowsService.all();
		newShowTitle = '';

		// Auto-select and search
		selectShow(show);
	}

	// Remove a show
	function removeShow(show: TVShow, event: MouseEvent) {
		event.stopPropagation();
		tvShowsService.remove(show);
		shows = tvShowsService.all();

		if (selectedShow?.id === show.id) {
			selectedShow = null;
			resetWikiExplorer();
		}
	}

	// Select/deselect a show
	function selectShow(show: TVShow) {
		if (selectedShow?.id === show.id) {
			selectedShow = null;
			resetWikiExplorer();
		} else {
			selectedShow = show;
			resetWikiExplorer();
			searchWikis(show.title);
		}
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
		// Pre-fill search with show title
		if (selectedShow) {
			articleSearchQuery = selectedShow.title;
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

	// Format article count
	function formatCount(count: number | undefined): string {
		if (count === undefined) return '';
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">TV Show Wikia Finder</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Shows List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">TV Shows</h2>

				<!-- Add show input -->
				<div class="flex gap-2 mb-3">
					<input
						type="text"
						placeholder="Enter TV show title..."
						class="input input-bordered input-sm flex-1"
						bind:value={newShowTitle}
						onkeydown={(e) => e.key === 'Enter' && addShow()}
					/>
					<button class="btn btn-primary btn-sm" onclick={addShow} disabled={!newShowTitle.trim()}>
						Add
					</button>
				</div>

				<!-- Shows list -->
				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if shows.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No TV shows added yet.</p>
							<p class="text-sm mt-1">Add a show to start finding wikis.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each shows as show (show.id)}
								<button
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedShow?.id === show.id,
											'bg-base-100': selectedShow?.id !== show.id
										}
									)}
									onclick={() => selectShow(show)}
								>
									<div class="flex items-center justify-between">
										<span class="font-medium truncate">{show.title}</span>
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={(e) => removeShow(show, e)}
											title="Remove show"
										>
											✕
										</button>
									</div>
								</button>
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
						disabled={!selectedShow}
					/>
					<button
						class="btn btn-secondary btn-sm"
						onclick={tryManualWiki}
						disabled={!manualWikiInput.trim() || !selectedShow}
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
					{#if !selectedShow}
						<div class="text-center text-base-content/60 p-4">
							<p>Select a TV show to discover wikis.</p>
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
								<button
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors',
										'hover:bg-base-300',
										{
											'bg-secondary/20 ring-2 ring-secondary': selectedWiki?.name === wiki.name,
											'bg-base-100': selectedWiki?.name !== wiki.name
										}
									)}
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
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
