<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import StickerItem from '$components/core/StickerItem.svelte';
	import { getSourceCollection } from '$services/sources.service';
	import { getStickersBySource } from '$services/stickers.service';
	import {
		getAllCollections,
		createCollection,
		updateCollection,
		deleteCollection,
		getStickersForCollection,
		addStickerToCollection,
		removeStickerFromCollection
	} from '$services/collections.service';
	import { getAllCollectionTypes } from '$services/collection-types.service';
	import { getTagsBySticker } from '$services/tags.service';
	import type { Tag } from '$types/tag.type';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Collection } from '$types/collection.type';
	import type { CollectionType } from '$types/collection-type.type';

	// State
	let collections: Collection[] = $state([]);
	let collectionTypes: CollectionType[] = $state([]);
	let sources: Source[] = $state([]);
	let isLoading = $state(true);

	// Selection state
	let selectedCollection = $state<Collection | null>(null);
	let selectedSource = $state<Source | null>(null);

	// Stickers state
	let sourceStickers: Sticker[] = $state([]);
	let collectionStickers: Sticker[] = $state([]);
	let isLoadingAlbumTemplates = $state(false);
	let isLoadingCollectionTemplates = $state(false);

	// Form state
	let newCollectionTitle = $state('');
	let isCreating = $state(false);
	let isAutoGenerating = $state(false);

	// Track which sticker IDs are in the collection (for visual feedback)
	let collectionStickerIds = $state<Set<string>>(new Set());

	// Tags map for stickers (stickerId -> Tag[])
	let stickerTagsMap = $state<Map<string, Tag[]>>(new Map());

	// Hover state for sticker preview
	let hoveredSticker = $state<Sticker | null>(null);

	onMount(async () => {
		const [collectionsResult, albumsResult, typesResult] = await Promise.all([
			getAllCollections(),
			getSourceCollection(),
			getAllCollectionTypes()
		]);
		collections = collectionsResult;
		sources = albumsResult;
		collectionTypes = typesResult;
		isLoading = false;
	});

	// Select a collection
	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			selectedCollection = null;
			collectionStickers = [];
			collectionStickerIds = new Set();
		} else {
			selectedCollection = collection;
			isLoadingCollectionTemplates = true;
			collectionStickers = await getStickersForCollection(collection.id);
			collectionStickerIds = new Set(collectionStickers.map((t) => String(t.id)));
			isLoadingCollectionTemplates = false;
		}
	}

	// Select an source
	async function selectAlbum(source: Source) {
		if (selectedSource?.id === source.id) {
			selectedSource = null;
			sourceStickers = [];
			stickerTagsMap = new Map();
		} else {
			selectedSource = source;
			isLoadingAlbumTemplates = true;
			sourceStickers = await getStickersBySource(source.id);

			// Fetch tags for all stickers in parallel
			const tagsPromises = sourceStickers.map(async (sticker) => {
				const tags = await getTagsBySticker(sticker.id);
				return { stickerId: String(sticker.id), tags };
			});
			const tagsResults = await Promise.all(tagsPromises);
			const newTagsMap = new Map<string, Tag[]>();
			for (const result of tagsResults) {
				newTagsMap.set(result.stickerId, result.tags);
			}
			stickerTagsMap = newTagsMap;

			isLoadingAlbumTemplates = false;
		}
	}

	// Create a new collection
	async function handleCreateCollection() {
		if (!newCollectionTitle.trim() || isCreating) return;

		isCreating = true;
		const result = await createCollection({
			title: newCollectionTitle.trim(),
			description: ''
		});

		if (result) {
			collections = [...collections, result];
			newCollectionTitle = '';
		}
		isCreating = false;
	}

	// Delete a collection
	async function handleDeleteCollection(collection: Collection, event: MouseEvent) {
		event.stopPropagation();
		if (!confirm(`Delete collection "${collection.title}"?`)) return;

		const success = await deleteCollection(collection.id);
		if (success) {
			collections = collections.filter((c) => c.id !== collection.id);
			if (selectedCollection?.id === collection.id) {
				selectedCollection = null;
				collectionStickers = [];
				collectionStickerIds = new Set();
			}
		}
	}

	// Update collection type
	async function handleCollectionTypeChange(collection: Collection, typeId: string | undefined) {
		const updated = await updateCollection({
			...collection,
			collectionTypeId: typeId || undefined
		});
		if (updated) {
			collections = collections.map((c) => (c.id === updated.id ? updated : c));
			if (selectedCollection?.id === updated.id) {
				selectedCollection = updated;
			}
		}
	}

	// Get collection type by ID
	function getCollectionTypeById(typeId: string | number | undefined): CollectionType | undefined {
		if (!typeId) return undefined;
		return collectionTypes.find((t) => String(t.id) === String(typeId));
	}

	// Add sticker to collection
	async function handleAddSticker(sticker: Sticker) {
		if (!selectedCollection) return;
		if (collectionStickerIds.has(String(sticker.id))) return;

		const result = await addStickerToCollection(
			selectedCollection.id,
			sticker.id,
			collectionStickers.length
		);
		if (result) {
			collectionStickers = [...collectionStickers, sticker];
			collectionStickerIds = new Set(collectionStickers.map((t) => String(t.id)));
		}
	}

	// Remove sticker from collection
	async function handleRemoveSticker(sticker: Sticker) {
		if (!selectedCollection) return;

		const success = await removeStickerFromCollection(selectedCollection.id, sticker.id);
		if (success) {
			collectionStickers = collectionStickers.filter((t) => t.id !== sticker.id);
			collectionStickerIds = new Set(collectionStickers.map((t) => String(t.id)));
		}
	}

	// Auto-generate collection from selected source
	async function handleAutoGenerate() {
		if (!selectedSource || isAutoGenerating) return;

		isAutoGenerating = true;

		// Load stickers if not already loaded
		if (sourceStickers.length === 0) {
			sourceStickers = await getStickersBySource(selectedSource.id);
		}

		if (sourceStickers.length === 0) {
			isAutoGenerating = false;
			return;
		}

		// Create collection with source title
		const newCollection = await createCollection({
			title: selectedSource.title,
			description: `Auto-generated from source: ${selectedSource.title}`
		});

		if (newCollection) {
			collections = [...collections, newCollection];

			// Add all stickers to the new collection
			for (let i = 0; i < sourceStickers.length; i++) {
				await addStickerToCollection(newCollection.id, sourceStickers[i].id, i);
			}

			// Select the new collection to show results
			selectedCollection = newCollection;
			collectionStickers = [...sourceStickers];
			collectionStickerIds = new Set(collectionStickers.map((t) => String(t.id)));
		}

		isAutoGenerating = false;
	}

	// Check if sticker is in collection
	function isStickerInCollection(stickerId: string | number): boolean {
		return collectionStickerIds.has(String(stickerId));
	}

	// Get source type badge color
	function getAlbumTypeBadgeClass(sourceType: string): string {
		switch (sourceType) {
			case 'movie':
				return 'badge-primary';
			case 'tv':
				return 'badge-secondary';
			case 'videogame':
				return 'badge-accent';
			case 'anime':
				return 'badge-info';
			case 'sports_league':
				return 'badge-success';
			case 'animal':
				return 'badge-warning';
			default:
				return 'badge-ghost';
		}
	}

	// Get source by ID
	function getAlbumById(sourceId: string | number | undefined): Source | undefined {
		if (!sourceId) return undefined;
		return sources.find((a) => String(a.id) === String(sourceId));
	}

	// Get tags for a sticker
	function getStickerTags(stickerId: string | number): Tag[] {
		return stickerTagsMap.get(String(stickerId)) || [];
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<h1 class="text-2xl font-bold mb-4 flex-shrink-0">Collections</h1>

	<div class="grid grid-cols-5 gap-4 flex-1 min-h-0 overflow-hidden">
		<!-- Column 1: Sources List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">Sources</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if sources.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No sources found.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each sources as source (source.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedSource?.id === source.id,
											'bg-base-100': selectedSource?.id !== source.id
										}
									)}
									onclick={() => selectAlbum(source)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(source)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if source.coverImage}
											<img
												src={source.coverImage}
												alt={source.title}
												class="w-8 h-12 object-cover rounded"
											/>
										{:else}
											<div
												class="w-8 h-12 bg-base-300 rounded flex items-center justify-center text-base-content/30"
											>
												<span class="text-xs">?</span>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<span class="font-medium text-sm truncate block">{source.title}</span>
											<span
												class={classNames(
													'badge badge-xs mt-1',
													getAlbumTypeBadgeClass(source.sourceType)
												)}
											>
												{source.sourceType}
											</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Collections + Actions -->
		<div class="flex flex-col gap-4 min-h-0 overflow-hidden">
			<!-- Collections Panel (50%) -->
			<div class="card bg-base-200 overflow-hidden flex flex-col h-1/2">
				<div class="card-body p-4 flex flex-col min-h-0">
					<h2 class="card-title text-lg mb-2">Collections</h2>

					<!-- Create Form -->
					<div class="flex gap-2 mb-4">
						<input
							type="text"
							class="input input-bordered input-sm flex-1"
							placeholder="New collection title..."
							bind:value={newCollectionTitle}
							onkeydown={(e) => e.key === 'Enter' && handleCreateCollection()}
						/>
						<button
							class="btn btn-primary btn-sm"
							onclick={handleCreateCollection}
							disabled={!newCollectionTitle.trim() || isCreating}
						>
							{#if isCreating}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								+
							{/if}
						</button>
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if isLoading}
							<div class="flex justify-center p-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if collections.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p>No collections yet.</p>
								<p class="text-sm mt-1">Create one above.</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each collections as collection (collection.id)}
									{@const collectionType = getCollectionTypeById(collection.collectionTypeId)}
									<div
										class={classNames(
											'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
											'hover:bg-base-300',
											{
												'bg-primary/20 ring-2 ring-primary':
													selectedCollection?.id === collection.id,
												'bg-base-100': selectedCollection?.id !== collection.id
											}
										)}
										onclick={() => selectCollection(collection)}
										onkeydown={(e) => e.key === 'Enter' && selectCollection(collection)}
										role="button"
										tabindex="0"
									>
										<div class="flex items-center justify-between gap-1">
											<span class="font-medium truncate flex-1">{collection.title}</span>
											<button
												class="btn btn-ghost btn-xs text-error flex-shrink-0"
												onclick={(e) => handleDeleteCollection(collection, e)}
												title="Delete collection"
											>
												✕
											</button>
										</div>
										<!-- Collection Type Select -->
										<div class="mt-2" onclick={(e) => e.stopPropagation()}>
											<select
												class="select select-bordered select-xs w-full"
												value={collection.collectionTypeId ?? ''}
												onchange={(e) =>
													handleCollectionTypeChange(
														collection,
														(e.target as HTMLSelectElement).value || undefined
													)}
											>
												<option value="">No type</option>
												{#each collectionTypes as type (type.id)}
													<option value={type.id}>
														{type.icon ? `${type.icon} ` : ''}{type.name}
													</option>
												{/each}
											</select>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Actions Panel (50%) -->
			<div class="card bg-base-200 overflow-hidden flex flex-col h-1/2">
				<div class="card-body p-4 flex flex-col min-h-0">
					<h2 class="card-title text-lg mb-2">Actions</h2>

					<div class="flex flex-col gap-2">
						<button
							class="btn btn-secondary btn-sm w-full"
							onclick={handleAutoGenerate}
							disabled={!selectedSource || isAutoGenerating}
							title={selectedSource
								? `Create collection from "${selectedSource.title}"`
								: 'Select a source first'}
						>
							{#if isAutoGenerating}
								<span class="loading loading-spinner loading-xs"></span>
								Generating...
							{:else}
								Auto-generate
							{/if}
						</button>

						{#if !selectedSource}
							<p class="text-xs text-base-content/50 text-center">
								Select a source to enable auto-generate
							</p>
						{:else}
							<p class="text-xs text-base-content/50 text-center">
								Create collection "{selectedSource.title}" with all its stickers
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Column 3: Source Stickers (source) -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">
					{#if selectedSource}
						Stickers in "{selectedSource.title}"
					{:else}
						Source Stickers
					{/if}
				</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedSource}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an source to view its stickers.</p>
						</div>
					{:else if isLoadingAlbumTemplates}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if sourceStickers.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No stickers in this source.</p>
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							{#each sourceStickers as sticker (sticker.id)}
								{@const stickerAlbum = getAlbumById(sticker.sourceId)}
								{@const tags = getStickerTags(sticker.id)}
								<button
									class={classNames(
										'flex gap-3 p-2 rounded-lg transition-all bg-base-100 text-left',
										{
											'ring-2 ring-success opacity-50': isStickerInCollection(sticker.id),
											'hover:ring-2 hover:ring-primary cursor-pointer':
												!isStickerInCollection(sticker.id) && selectedCollection,
											'opacity-50 cursor-not-allowed': !selectedCollection
										}
									)}
									onclick={() => handleAddSticker(sticker)}
									onmouseenter={() => (hoveredSticker = sticker)}
									onmouseleave={() => (hoveredSticker = null)}
									disabled={!selectedCollection || isStickerInCollection(sticker.id)}
									title={isStickerInCollection(sticker.id)
										? 'Already in collection'
										: selectedCollection
											? 'Click to add to collection'
											: 'Select a collection first'}
								>
									<!-- Image -->
									<img
										src={sticker.image}
										alt={sticker.name}
										class="w-12 h-16 object-cover rounded flex-shrink-0"
										loading="lazy"
										onerror={(e) => {
											(e.target as HTMLImageElement).src =
												'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" viewBox="0 0 64 96"><rect fill="%23374151" width="64" height="96"/><text x="32" y="52" text-anchor="middle" fill="%239CA3AF" font-size="10">?</text></svg>';
										}}
									/>

									<!-- Content -->
									<div class="flex-1 min-w-0 flex flex-col gap-1">
										<!-- Name -->
										<div class="flex items-center justify-between gap-2">
											<span class="font-medium text-sm truncate">{sticker.name}</span>
											{#if isStickerInCollection(sticker.id)}
												<span class="badge badge-success badge-xs flex-shrink-0">
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
											{/if}
										</div>

										<!-- Source -->
										{#if stickerAlbum}
											<div class="flex items-center gap-1">
												<span class="text-xs text-base-content/60">Source:</span>
												<span
													class={classNames(
														'badge badge-xs',
														getAlbumTypeBadgeClass(stickerAlbum.sourceType)
													)}
												>
													{stickerAlbum.title}
												</span>
											</div>
										{/if}

										<!-- Tags -->
										{#if tags.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each tags as tag (tag.id)}
													<span class="badge badge-ghost badge-xs">
														{tag.key}: {tag.value}
													</span>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-base-content/40 italic">No tags</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if selectedSource && sourceStickers.length > 0 && !selectedCollection}
					<div class="mt-2 text-center">
						<span class="text-xs text-base-content/50">Select a collection to add stickers</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 4: Collection Stickers (target) -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">
					{#if selectedCollection}
						Stickers in "{selectedCollection.title}"
					{:else}
						Collection Stickers
					{/if}
				</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedCollection}
						<div class="text-center text-base-content/60 p-4">
							<p>Select a collection to view its stickers.</p>
						</div>
					{:else if isLoadingCollectionTemplates}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if collectionStickers.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No stickers in this collection.</p>
							<p class="text-sm mt-1">Click stickers from an source to add them.</p>
						</div>
					{:else}
						<div class="flex gap-2">
							<!-- Left column -->
							<div class="flex-1 flex flex-col gap-2">
								{#each collectionStickers.filter((_, i) => i % 2 === 0) as sticker (sticker.id)}
									<div
										class="relative group cursor-pointer ring-2 ring-primary"
										title="Click to remove from collection"
										onmouseenter={() => (hoveredSticker = sticker)}
										onmouseleave={() => (hoveredSticker = null)}
										onclick={() => handleRemoveSticker(sticker)}
										onkeydown={(e) => e.key === 'Enter' && handleRemoveSticker(sticker)}
										role="button"
										tabindex="0"
									>
										<StickerItem {sticker} />
										<div class="p-2 bg-base-200">
											<h3 class="text-xs font-medium text-center leading-tight truncate">{sticker.name}</h3>
										</div>
										<div
											class="absolute inset-0 bg-error/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded"
										>
											<span class="badge badge-error badge-sm">Remove</span>
										</div>
									</div>
								{/each}
							</div>
							<!-- Right column -->
							<div class="flex-1 flex flex-col gap-2">
								{#each collectionStickers.filter((_, i) => i % 2 === 1) as sticker (sticker.id)}
									<div
										class="relative group cursor-pointer ring-2 ring-primary"
										title="Click to remove from collection"
										onmouseenter={() => (hoveredSticker = sticker)}
										onmouseleave={() => (hoveredSticker = null)}
										onclick={() => handleRemoveSticker(sticker)}
										onkeydown={(e) => e.key === 'Enter' && handleRemoveSticker(sticker)}
										role="button"
										tabindex="0"
									>
										<StickerItem {sticker} />
										<div class="p-2 bg-base-200">
											<h3 class="text-xs font-medium text-center leading-tight truncate">{sticker.name}</h3>
										</div>
										<div
											class="absolute inset-0 bg-error/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded"
										>
											<span class="badge badge-error badge-sm">Remove</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				{#if selectedCollection && collectionStickers.length > 0}
					<div class="mt-2 text-center">
						<span class="text-xs text-base-content/50">
							{collectionStickers.length} sticker{collectionStickers.length === 1 ? '' : 's'}
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 5: Sticker Detail Preview -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">Sticker Details</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !hoveredSticker}
						<div class="text-center text-base-content/60 p-4">
							<p>Hover over a sticker to see details.</p>
						</div>
					{:else}
						{@const stickerSource = getAlbumById(hoveredSticker.sourceId)}
						{@const stickerTags = getStickerTags(hoveredSticker.id)}
						<div class="flex flex-col gap-4">
							<!-- Large Image -->
							<div class="w-full">
								<img
									src={hoveredSticker.image}
									alt={hoveredSticker.name}
									class="w-full rounded-lg shadow-lg"
									onerror={(e) => {
										(e.target as HTMLImageElement).src =
											'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="%23374151" width="200" height="300"/><text x="100" y="155" text-anchor="middle" fill="%239CA3AF" font-size="24">?</text></svg>';
									}}
								/>
							</div>

							<!-- Info Section -->
							<div class="space-y-3">
								<!-- Name -->
								<div>
									<span class="text-xs text-base-content/60 uppercase tracking-wide">Name</span>
									<p class="font-semibold text-lg">{hoveredSticker.name}</p>
								</div>

								<!-- ID -->
								<div>
									<span class="text-xs text-base-content/60 uppercase tracking-wide">ID</span>
									<p class="font-mono text-sm">{hoveredSticker.id}</p>
								</div>

								<!-- Source -->
								{#if stickerSource}
									<div>
										<span class="text-xs text-base-content/60 uppercase tracking-wide">Source</span>
										<div class="flex items-center gap-2 mt-1">
											{#if stickerSource.coverImage}
												<img
													src={stickerSource.coverImage}
													alt={stickerSource.title}
													class="w-8 h-12 object-cover rounded"
												/>
											{/if}
											<div>
												<p class="font-medium">{stickerSource.title}</p>
												<span
													class={classNames(
														'badge badge-xs',
														getAlbumTypeBadgeClass(stickerSource.sourceType)
													)}
												>
													{stickerSource.sourceType}
												</span>
											</div>
										</div>
									</div>
								{/if}

								<!-- Image Source -->
								{#if hoveredSticker.imageSource}
									<div>
										<span class="text-xs text-base-content/60 uppercase tracking-wide">Image Source</span>
										<p class="badge badge-ghost badge-sm">{hoveredSticker.imageSource}</p>
									</div>
								{/if}

								<!-- Tags -->
								{#if stickerTags.length > 0}
									<div>
										<span class="text-xs text-base-content/60 uppercase tracking-wide">Tags</span>
										<div class="flex flex-wrap gap-1 mt-1">
											{#each stickerTags as tag (tag.id)}
												<span class="badge badge-outline badge-sm">
													{tag.key}: {tag.value}
												</span>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Dates -->
								{#if hoveredSticker.createdAt}
									<div>
										<span class="text-xs text-base-content/60 uppercase tracking-wide">Created</span>
										<p class="text-sm">{new Date(hoveredSticker.createdAt).toLocaleDateString()}</p>
									</div>
								{/if}

								<!-- In Collection Status -->
								<div>
									<span class="text-xs text-base-content/60 uppercase tracking-wide">Status</span>
									<p class="mt-1">
										{#if isStickerInCollection(hoveredSticker.id)}
											<span class="badge badge-success badge-sm gap-1">
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
												In collection
											</span>
										{:else}
											<span class="badge badge-ghost badge-sm">Not in collection</span>
										{/if}
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
