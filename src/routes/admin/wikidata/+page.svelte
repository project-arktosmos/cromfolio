<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import type { WikipediaSearchResult, WikidataItem, WikidataProperty } from '$types/wikidata.type';
	import {
		searchWikipedia,
		getWikidataForArticle,
		getCommonsImageUrl
	} from '$services/wikidata.service';
	import { WIKIDATA_PROPERTIES } from '$types/wikidata.type';

	// Search state
	let searchQuery = $state('');
	let searchResults = $state<WikipediaSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);

	// Selected item state
	let selectedResult = $state<WikipediaSearchResult | null>(null);
	let wikidataItem = $state<WikidataItem | null>(null);
	let isLoadingData = $state(false);
	let dataError = $state<string | null>(null);

	// Debounce timer
	let searchTimer: ReturnType<typeof setTimeout>;

	// Search handler with debounce
	function handleSearchInput() {
		clearTimeout(searchTimer);
		searchError = null;

		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		searchTimer = setTimeout(async () => {
			await performSearch();
		}, 300);
	}

	async function performSearch() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;

		try {
			searchResults = await searchWikipedia(searchQuery, 15);
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Search failed';
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}

	// Select a search result and fetch Wikidata
	async function selectResult(result: WikipediaSearchResult) {
		selectedResult = result;
		wikidataItem = null;
		isLoadingData = true;
		dataError = null;

		try {
			wikidataItem = await getWikidataForArticle(result.title);
			if (!wikidataItem) {
				dataError = 'No Wikidata entity found for this article';
			}
		} catch (err) {
			dataError = err instanceof Error ? err.message : 'Failed to load Wikidata';
		} finally {
			isLoadingData = false;
		}
	}

	// Strip HTML tags from snippet
	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '');
	}

	// Get badge color based on property type
	function getPropertyBadgeClass(prop: WikidataProperty): string {
		const priorityProps = Object.values(WIKIDATA_PROPERTIES);
		if (priorityProps.includes(prop.id as any)) {
			return 'badge-primary';
		}
		switch (prop.valueType) {
			case 'time':
				return 'badge-info';
			case 'quantity':
				return 'badge-success';
			case 'entity':
				return 'badge-secondary';
			case 'image':
				return 'badge-warning';
			default:
				return 'badge-ghost';
		}
	}

	// Check if property is an identifier
	function isIdentifier(propId: string): boolean {
		return [
			WIKIDATA_PROPERTIES.IMDB_ID,
			WIKIDATA_PROPERTIES.TMDB_MOVIE_ID,
			WIKIDATA_PROPERTIES.TMDB_TV_ID,
			WIKIDATA_PROPERTIES.SPOTIFY_ARTIST_ID,
			WIKIDATA_PROPERTIES.MUSICBRAINZ_ARTIST_ID
		].includes(propId as any);
	}
</script>

<div class="flex h-full flex-col gap-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Wikidata Explorer</h1>
		<span class="text-base-content/60 text-sm">Search Wikipedia and view structured Wikidata</span>
	</div>

	<div class="grid min-h-0 flex-1 grid-cols-3 gap-4">
		<!-- Search Panel -->
		<div class="card flex flex-col overflow-hidden bg-base-200">
			<div class="card-body flex h-full flex-col p-4">
				<h2 class="card-title text-lg">Search Wikipedia</h2>

				<!-- Search Input -->
				<div class="form-control">
					<div class="relative">
						<input
							type="text"
							placeholder="Search for articles..."
							class="input input-bordered w-full pr-10"
							bind:value={searchQuery}
							oninput={handleSearchInput}
						/>
						{#if isSearching}
							<span class="loading loading-spinner loading-sm absolute top-3 right-3"></span>
						{/if}
					</div>
				</div>

				{#if searchError}
					<div class="alert alert-error mt-2 py-2 text-sm">
						{searchError}
					</div>
				{/if}

				<!-- Search Results -->
				<div class="mt-4 flex-1 space-y-2 overflow-y-auto">
					{#if searchResults.length === 0 && searchQuery && !isSearching}
						<p class="text-base-content/60 py-4 text-center text-sm">No results found</p>
					{:else}
						{#each searchResults as result (result.pageid)}
							<div
								class={classNames(
									'cursor-pointer rounded-lg p-3 transition-colors',
									'hover:bg-base-300',
									{
										'ring-primary bg-primary/20 ring-2':
											selectedResult?.pageid === result.pageid,
										'bg-base-100': selectedResult?.pageid !== result.pageid
									}
								)}
								onclick={() => selectResult(result)}
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && selectResult(result)}
							>
								<h3 class="font-medium">{result.title}</h3>
								<p class="text-base-content/60 mt-1 line-clamp-2 text-sm">
									{stripHtml(result.snippet)}
								</p>
								<div class="mt-2 flex gap-2">
									<span class="badge badge-ghost badge-xs">
										{result.wordcount.toLocaleString()} words
									</span>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<!-- Wikidata Panel -->
		<div class="card col-span-2 flex flex-col overflow-hidden bg-base-200">
			<div class="card-body flex h-full flex-col p-4">
				{#if !selectedResult}
					<div class="flex flex-1 items-center justify-center">
						<p class="text-base-content/60">Select a Wikipedia article to view its Wikidata</p>
					</div>
				{:else if isLoadingData}
					<div class="flex flex-1 items-center justify-center">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else if dataError}
					<div class="flex flex-1 flex-col items-center justify-center gap-4">
						<div class="alert alert-error max-w-md">
							<span>{dataError}</span>
						</div>
						<a
							href="https://en.wikipedia.org/wiki/{encodeURIComponent(selectedResult.title)}"
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-outline btn-sm"
						>
							View on Wikipedia
						</a>
					</div>
				{:else if wikidataItem}
					<div class="flex flex-1 flex-col overflow-hidden">
						<!-- Header -->
						<div class="mb-4 flex gap-4">
							{#if wikidataItem.imageUrl}
								<div class="flex-shrink-0">
									<img
										src={getCommonsImageUrl(wikidataItem.imageUrl, 150)}
										alt={wikidataItem.label}
										class="h-32 w-32 rounded-lg object-cover"
										onerror={(e) => {
											(e.target as HTMLImageElement).style.display = 'none';
										}}
									/>
								</div>
							{/if}
							<div class="flex-1">
								<h2 class="text-xl font-bold">{wikidataItem.label}</h2>
								<p class="text-base-content/70 mt-1">{wikidataItem.description}</p>
								<div class="mt-2 flex flex-wrap gap-2">
									<a
										href="https://en.wikipedia.org/wiki/{encodeURIComponent(wikidataItem.wikipediaTitle)}"
										target="_blank"
										rel="noopener noreferrer"
										class="badge badge-outline"
									>
										Wikipedia
									</a>
									<a
										href="https://www.wikidata.org/wiki/{wikidataItem.entityId}"
										target="_blank"
										rel="noopener noreferrer"
										class="badge badge-outline"
									>
										Wikidata: {wikidataItem.entityId}
									</a>
								</div>
							</div>
						</div>

						<!-- Properties -->
						<div class="divider my-2">Properties ({wikidataItem.properties.length})</div>

						<div class="flex-1 overflow-y-auto">
							<div class="grid gap-2">
								{#each wikidataItem.properties as prop (prop.id)}
									<div
										class={classNames('rounded-lg p-3', {
											'bg-primary/10': isIdentifier(prop.id),
											'bg-base-100': !isIdentifier(prop.id)
										})}
									>
										<div class="flex items-start gap-2">
											<span class={classNames('badge badge-sm', getPropertyBadgeClass(prop))}>
												{prop.label}
												<span class="text-base-content/50 ml-1 text-xs">({prop.id})</span>
											</span>
											<div class="flex-1">
												{#if prop.valueType === 'image'}
													<div class="flex flex-col gap-2">
														<a
															href="https://commons.wikimedia.org/wiki/File:{encodeURIComponent(prop.value)}"
															target="_blank"
															rel="noopener noreferrer"
															class="block"
														>
															<img
																src={getCommonsImageUrl(prop.value, 200)}
																alt={prop.value}
																class="max-h-32 rounded-lg object-contain"
																onerror={(e) => {
																	(e.target as HTMLImageElement).style.display = 'none';
																}}
															/>
														</a>
														<span class="text-base-content/60 text-xs">{prop.value}</span>
													</div>
												{:else if prop.id === WIKIDATA_PROPERTIES.IMDB_ID}
													<p class="mt-0.5">
														<a
															href="https://www.imdb.com/title/{prop.value}"
															target="_blank"
															rel="noopener noreferrer"
															class="link link-primary"
														>
															{prop.value}
														</a>
													</p>
												{:else}
													<p class="mt-0.5">{prop.value}</p>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
