<script lang="ts">
	import classNames from 'classnames';
	import {
		searchSketchfab,
		getModelDetails,
		getThumbnailUrl,
		getModelPageUrl,
		getEmbedUrl,
		formatCount,
		getLicenseInfo,
		SKETCHFAB_CATEGORIES,
		SKETCHFAB_SORT_OPTIONS,
		type SketchfabSearchOptions
	} from '$services/sketchfab.service';
	import type { SketchfabModel } from '$types/sketchfab.type';

	// Search state
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let sortBy = $state<SketchfabSearchOptions['sortBy']>('relevance');
	let downloadableOnly = $state(true);
	let animatedOnly = $state(false);
	let staffpickedOnly = $state(false);

	// Results state
	let searchResults = $state<SketchfabModel[]>([]);
	let nextCursor = $state<string | undefined>();
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let hasSearched = $state(false);

	// Selected model state
	let selectedModel = $state<SketchfabModel | null>(null);
	let showPreview = $state(false);

	// Search for models
	async function search(cursor?: string) {
		isSearching = true;
		searchError = null;
		hasSearched = true;

		if (!cursor) {
			searchResults = [];
		}

		try {
			const result = await searchSketchfab({
				query: searchQuery,
				categories: selectedCategory ? [selectedCategory] : undefined,
				sortBy,
				downloadable: downloadableOnly,
				animated: animatedOnly ? true : undefined,
				staffpicked: staffpickedOnly ? true : undefined,
				cursor,
				count: 24
			});

			if (cursor) {
				searchResults = [...searchResults, ...result.results];
			} else {
				searchResults = result.results;
			}
			nextCursor = result.nextCursor;

			if (searchResults.length === 0) {
				searchError = 'No models found. Try different search terms or filters.';
			}
		} catch (error) {
			searchError = 'Search failed. Please try again.';
			console.error('[sketchfab] Search error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Load more results
	function loadMore() {
		if (nextCursor && !isSearching) {
			search(nextCursor);
		}
	}

	// Select a model for preview
	function selectModel(model: SketchfabModel) {
		selectedModel = model;
		showPreview = true;
	}

	// Close preview
	function closePreview() {
		showPreview = false;
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		selectedCategory = '';
		sortBy = 'relevance';
		downloadableOnly = true;
		animatedOnly = false;
		staffpickedOnly = false;
		searchResults = [];
		nextCursor = undefined;
		searchError = null;
		hasSearched = false;
		selectedModel = null;
		showPreview = false;
	}

	// Browse all downloadable models
	async function browseAll() {
		searchQuery = '';
		await search();
	}
</script>

<div class="flex flex-col h-full">
	<!-- Page header -->
	<div class="mb-4">
		<h1 class="text-2xl font-bold">3D Models</h1>
		<p class="text-sm text-base-content/60">
			Search and browse 3D models from Sketchfab (Creative Commons)
		</p>
	</div>

	<div class="grid grid-cols-4 gap-4 flex-1 min-h-0">
		<!-- Column 1: Search & Filters -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Search & Filters</h2>

				<div class="space-y-3">
					<!-- Search input -->
					<div class="form-control">
						<input
							type="text"
							placeholder="Search 3D models..."
							class="input input-bordered input-sm w-full"
							bind:value={searchQuery}
							onkeydown={(e) => e.key === 'Enter' && search()}
						/>
					</div>

					<!-- Category selector -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Category</span>
						</label>
						<select class="select select-bordered select-sm w-full" bind:value={selectedCategory}>
							<option value="">All Categories</option>
							{#each SKETCHFAB_CATEGORIES as category}
								<option value={category.id}>{category.label}</option>
							{/each}
						</select>
					</div>

					<!-- Sort selector -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Sort By</span>
						</label>
						<select class="select select-bordered select-sm w-full" bind:value={sortBy}>
							{#each SKETCHFAB_SORT_OPTIONS as option}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>

					<!-- Filters -->
					<div class="space-y-2">
						<label class="label py-1">
							<span class="label-text text-xs">Filters</span>
						</label>

						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={downloadableOnly}
							/>
							<span class="text-sm">Downloadable only</span>
						</label>

						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={animatedOnly}
							/>
							<span class="text-sm">Animated only</span>
						</label>

						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={staffpickedOnly}
							/>
							<span class="text-sm">Staff picked</span>
						</label>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-2 pt-2">
						<button class="btn btn-primary btn-sm flex-1" onclick={() => search()} disabled={isSearching}>
							{#if isSearching}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Search
							{/if}
						</button>
						<button class="btn btn-outline btn-sm flex-1" onclick={browseAll} disabled={isSearching}>
							Browse
						</button>
					</div>

					{#if hasSearched}
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
				{#if searchResults.length > 0}
					<div class="text-xs text-base-content/60 mt-2">
						Showing {searchResults.length} models
						{#if nextCursor}
							<span class="text-base-content/40">(more available)</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 2-4: Results Grid -->
		<div class="col-span-3 card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Results</h2>

				{#if !hasSearched}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<div class="text-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-16 w-16 mx-auto mb-4 opacity-30"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<p class="text-sm">Search for 3D models or click Browse to see all.</p>
						</div>
					</div>
				{:else if isSearching && searchResults.length === 0}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else if searchResults.length > 0}
					<div class="flex-1 overflow-y-auto">
						<div class="grid grid-cols-3 gap-3">
							{#each searchResults as model (model.uid)}
								<div
									class={classNames(
										'card bg-base-100 cursor-pointer transition-all hover:shadow-lg',
										'hover:ring-2 hover:ring-primary/50',
										{
											'ring-2 ring-primary': selectedModel?.uid === model.uid
										}
									)}
									onclick={() => selectModel(model)}
									onkeydown={(e) => e.key === 'Enter' && selectModel(model)}
									role="button"
									tabindex="0"
								>
									<figure class="relative aspect-video bg-base-300">
										<img
											src={getThumbnailUrl(model)}
											alt={model.name}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
										{#if model.animationCount > 0}
											<span class="absolute top-2 left-2 badge badge-primary badge-xs">
												Animated
											</span>
										{/if}
										{#if model.isDownloadable}
											<span class="absolute top-2 right-2 badge badge-success badge-xs">
												Free
											</span>
										{/if}
									</figure>
									<div class="card-body p-3">
										<h3 class="font-medium text-sm truncate" title={model.name}>
											{model.name}
										</h3>
										<div class="flex items-center gap-2 text-xs text-base-content/60">
											<span>{model.user.displayName}</span>
										</div>
										<div class="flex items-center gap-3 text-xs text-base-content/50 mt-1">
											<span title="Views">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-3 w-3 inline mr-1"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
												{formatCount(model.viewCount)}
											</span>
											<span title="Likes">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-3 w-3 inline mr-1"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
													/>
												</svg>
												{formatCount(model.likeCount)}
											</span>
											<span title="Faces">
												{formatCount(model.faceCount)} tris
											</span>
										</div>
									</div>
								</div>
							{/each}
						</div>

						<!-- Load more button -->
						{#if nextCursor}
							<div class="flex justify-center mt-4">
								<button class="btn btn-outline btn-sm" onclick={loadMore} disabled={isSearching}>
									{#if isSearching}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Load More
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Model Preview Modal -->
{#if showPreview && selectedModel}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl h-[80vh] flex flex-col">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={closePreview}
			>
				✕
			</button>

			<h3 class="font-bold text-lg pr-8 truncate">{selectedModel.name}</h3>
			<p class="text-sm text-base-content/60">by {selectedModel.user.displayName}</p>

			<!-- 3D Viewer Embed -->
			<div class="flex-1 mt-4 bg-base-300 rounded-lg overflow-hidden">
				<iframe
					title="Sketchfab 3D Viewer"
					class="w-full h-full"
					src="{getEmbedUrl(selectedModel.uid)}?autostart=1&ui_theme=dark"
					frameborder="0"
					allow="autoplay; fullscreen; xr-spatial-tracking"
					allowfullscreen
				></iframe>
			</div>

			<!-- Model Details -->
			<div class="mt-4 grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Faces:</span>
						<span>{formatCount(selectedModel.faceCount)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Vertices:</span>
						<span>{formatCount(selectedModel.vertexCount)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Animations:</span>
						<span>{selectedModel.animationCount}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">License:</span>
						<span>{getLicenseInfo(selectedModel)}</span>
					</div>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Views:</span>
						<span>{selectedModel.viewCount.toLocaleString()}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Likes:</span>
						<span>{selectedModel.likeCount.toLocaleString()}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-base-content/60">Published:</span>
						<span>{new Date(selectedModel.publishedAt).toLocaleDateString()}</span>
					</div>
				</div>
			</div>

			<!-- Tags -->
			{#if selectedModel.tags?.length}
				<div class="mt-3">
					<div class="flex flex-wrap gap-1">
						{#each selectedModel.tags.slice(0, 10) as tag}
							<span class="badge badge-ghost badge-sm">{tag.name}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="modal-action">
				<a
					href={getModelPageUrl(selectedModel)}
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-primary btn-sm"
				>
					View on Sketchfab
				</a>
				{#if selectedModel.isDownloadable}
					<a
						href="{getModelPageUrl(selectedModel)}#download"
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-outline btn-sm"
					>
						Download
					</a>
				{/if}
				<button class="btn btn-ghost btn-sm" onclick={closePreview}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={closePreview}></div>
	</div>
{/if}
