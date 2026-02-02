<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { save } from '@tauri-apps/plugin-dialog';
	import { writeTextFile } from '@tauri-apps/plugin-fs';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import {
		generateManifest,
		manifestToJson,
		sanitizeFilename
	} from '$services/torrent-manifest.service';
	import {
		checkCacheStatus,
		getCachedImage,
		startBackgroundDownload,
		getBackgroundDownloadProgress,
		cancelBackgroundDownload,
		resetBackgroundDownload,
		type CacheCheckResult,
		type BackgroundDownloadProgress
	} from '$services/image-cache.service';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { TorrentManifest } from '$types/torrent-manifest.type';

	// State
	let collections: Collection[] = $state([]);
	let isLoading = $state(true);

	// Selection state
	let selectedCollection = $state<Collection | null>(null);
	let collectionStickers: Sticker[] = $state([]);
	let isLoadingStickers = $state(false);

	// Preview state
	let previewManifest = $state<TorrentManifest | null>(null);
	let isGenerating = $state(false);
	let isSaving = $state(false);

	// Cache status
	let cacheStatus = $state<CacheCheckResult | null>(null);
	let isCheckingCache = $state(false);

	// Cached images for display
	interface CachedStickerImage {
		sticker: Sticker;
		localPath: string;
		assetUrl: string;
	}
	let cachedImages = $state<CachedStickerImage[]>([]);

	// Background download
	let downloadProgress = $state<BackgroundDownloadProgress | null>(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Feedback
	let successMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		// Load collections
		getAllCollections().then((result) => {
			collections = result;
			isLoading = false;
		});

		// Check for any running background download
		pollDownloadProgress().then(() => {
			if (downloadProgress?.status === 'running') {
				startPolling();
			}
		});

		// Cleanup on unmount
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
		};
	});

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(pollDownloadProgress, 1000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function pollDownloadProgress() {
		downloadProgress = await getBackgroundDownloadProgress();

		// Stop polling if download is no longer running
		if (downloadProgress.status !== 'running') {
			stopPolling();

			// Refresh cache status if download just finished for selected collection
			if (
				selectedCollection &&
				downloadProgress.collection_id === String(selectedCollection.id) &&
				(downloadProgress.status === 'completed' || downloadProgress.status === 'cancelled')
			) {
				const imageUrls = collectionStickers
					.map((s) => s.image)
					.filter((url): url is string => !!url);
				cacheStatus = await checkCacheStatus(imageUrls);
				await refreshCachedImages();
			}
		}
	}

	// Select a collection
	async function selectCollection(collection: Collection) {
		// Clear messages
		successMessage = null;
		errorMessage = null;
		previewManifest = null;
		cacheStatus = null;
		cachedImages = [];

		if (selectedCollection?.id === collection.id) {
			selectedCollection = null;
			collectionStickers = [];
		} else {
			selectedCollection = collection;
			isLoadingStickers = true;
			collectionStickers = await getStickersForCollection(collection.id);
			isLoadingStickers = false;

			// Check cache status for sticker images
			if (collectionStickers.length > 0) {
				isCheckingCache = true;
				const imageUrls = collectionStickers
					.map((s) => s.image)
					.filter((url): url is string => !!url);
				cacheStatus = await checkCacheStatus(imageUrls);

				// Fetch cached image paths
				await refreshCachedImages();
				isCheckingCache = false;
			}
		}
	}

	// Refresh the list of cached images for display
	async function refreshCachedImages() {
		const cached: CachedStickerImage[] = [];

		for (const sticker of collectionStickers) {
			if (!sticker.image) continue;

			const localPath = await getCachedImage(sticker.image);
			if (localPath) {
				cached.push({
					sticker,
					localPath,
					assetUrl: convertFileSrc(localPath)
				});
			}
		}

		cachedImages = cached;
	}

	// Generate and preview JSON
	async function handlePreview() {
		if (!selectedCollection) return;

		isGenerating = true;
		successMessage = null;
		errorMessage = null;

		try {
			previewManifest = generateManifest(selectedCollection, collectionStickers);
		} catch (e) {
			errorMessage = `Failed to generate manifest: ${e}`;
		}

		isGenerating = false;
	}

	// Download JSON file
	async function handleDownload() {
		if (!selectedCollection) return;

		isSaving = true;
		successMessage = null;
		errorMessage = null;

		try {
			const manifest = generateManifest(selectedCollection, collectionStickers);
			const json = manifestToJson(manifest);
			const filename = `${sanitizeFilename(selectedCollection.title)}-manifest.json`;

			const filePath = await save({
				defaultPath: filename,
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});

			if (filePath) {
				await writeTextFile(filePath, json);
				successMessage = `Saved to ${filePath}`;
			}
		} catch (e) {
			errorMessage = `Failed to save: ${e}`;
		}

		isSaving = false;
	}

	// Copy JSON to clipboard
	async function handleCopyToClipboard() {
		if (!previewManifest) return;

		try {
			const json = manifestToJson(previewManifest);
			await navigator.clipboard.writeText(json);
			successMessage = 'Copied to clipboard!';
		} catch (e) {
			errorMessage = `Failed to copy: ${e}`;
		}
	}

	// Start background download for missing images
	async function handleStartDownload() {
		if (!selectedCollection || !cacheStatus) return;

		try {
			await startBackgroundDownload(
				cacheStatus.missingUrls,
				String(selectedCollection.id),
				selectedCollection.title
			);
			startPolling();
			await pollDownloadProgress();
			successMessage = 'Background download started!';
		} catch (e) {
			errorMessage = `Failed to start download: ${e}`;
		}
	}

	// Cancel background download
	async function handleCancelDownload() {
		try {
			await cancelBackgroundDownload();
			successMessage = 'Download cancelled';
		} catch (e) {
			errorMessage = `Failed to cancel: ${e}`;
		}
	}

	// Reset download state
	async function handleResetDownload() {
		try {
			await resetBackgroundDownload();
			downloadProgress = null;
		} catch (e) {
			errorMessage = `Failed to reset: ${e}`;
		}
	}

	// Check if download is for current collection
	$effect(() => {
		if (downloadProgress?.status === 'running' && !pollInterval) {
			startPolling();
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<h1 class="mb-4 flex-shrink-0 text-2xl font-bold">Torrent Manifests</h1>

	<!-- Feedback messages -->
	{#if successMessage}
		<div class="alert alert-success mb-4 flex-shrink-0">
			<span>{successMessage}</span>
			<button class="btn btn-ghost btn-xs" onclick={() => (successMessage = null)}>
				Dismiss
			</button>
		</div>
	{/if}

	{#if errorMessage}
		<div class="alert alert-error mb-4 flex-shrink-0">
			<span>{errorMessage}</span>
			<button class="btn btn-ghost btn-xs" onclick={() => (errorMessage = null)}>Dismiss</button>
		</div>
	{/if}

	<div class="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-hidden">
		<!-- Column 1: Collections List -->
		<div class="card bg-base-200 flex min-h-0 flex-col overflow-hidden">
			<div class="card-body flex min-h-0 flex-col p-4">
				<h2 class="card-title mb-2 text-lg">Collections</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if collections.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p>No collections found.</p>
							<p class="mt-1 text-sm">Create collections in the Collections page.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each collections as collection (collection.id)}
								<div
									class={classNames(
										'w-full cursor-pointer rounded-lg p-3 text-left transition-colors',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-primary ring-2': selectedCollection?.id === collection.id,
											'bg-base-100': selectedCollection?.id !== collection.id
										}
									)}
									onclick={() => selectCollection(collection)}
									onkeydown={(e) => e.key === 'Enter' && selectCollection(collection)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if collection.coverImage}
											<img
												src={collection.coverImage}
												alt={collection.title}
												class="h-12 w-8 rounded object-cover"
											/>
										{:else}
											<div
												class="bg-base-300 text-base-content/30 flex h-12 w-8 items-center justify-center rounded"
											>
												<span class="text-xs">?</span>
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium">{collection.title}</span>
											{#if collection.description}
												<span class="text-base-content/60 block truncate text-xs">
													{collection.description}
												</span>
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

		<!-- Column 2: Collection Details -->
		<div class="card bg-base-200 flex min-h-0 flex-col overflow-hidden">
			<div class="card-body flex min-h-0 flex-col p-4">
				<h2 class="card-title mb-2 text-lg">Collection Details</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedCollection}
						<div class="text-base-content/60 p-4 text-center">
							<p>Select a collection to view details.</p>
						</div>
					{:else if isLoadingStickers}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else}
						<div class="space-y-4">
							<!-- Title -->
							<div>
								<span class="text-base-content/60 text-xs uppercase tracking-wide">Title</span>
								<p class="text-lg font-semibold">{selectedCollection.title}</p>
							</div>

							<!-- Description -->
							{#if selectedCollection.description}
								<div>
									<span class="text-base-content/60 text-xs uppercase tracking-wide"
										>Description</span
									>
									<p class="text-sm">{selectedCollection.description}</p>
								</div>
							{/if}

							<!-- Cover Image -->
							{#if selectedCollection.coverImage}
								<div>
									<span class="text-base-content/60 text-xs uppercase tracking-wide"
										>Cover Image</span
									>
									<img
										src={selectedCollection.coverImage}
										alt={selectedCollection.title}
										class="mt-1 w-full max-w-xs rounded-lg"
									/>
								</div>
							{/if}

							<!-- Sticker Count -->
							<div>
								<span class="text-base-content/60 text-xs uppercase tracking-wide"
									>Sticker Count</span
								>
								<p class="text-lg">
									{#if collectionStickers.length === 0}
										<span class="badge badge-warning">Empty Collection</span>
									{:else}
										<span class="badge badge-success"
											>{collectionStickers.length} sticker{collectionStickers.length === 1
												? ''
												: 's'}</span
										>
									{/if}
								</p>
							</div>

							<!-- Image Cache Status -->
							<div>
								<span class="text-base-content/60 text-xs uppercase tracking-wide"
									>Images Cached Locally</span
								>
								{#if isCheckingCache}
									<div class="mt-1 flex items-center gap-2">
										<span class="loading loading-spinner loading-xs"></span>
										<span class="text-base-content/60 text-sm">Checking cache...</span>
									</div>
								{:else if cacheStatus}
									<div class="mt-1 space-y-1">
										<div class="flex items-center gap-2">
											<div
												class="radial-progress text-primary"
												style="--value:{Math.round(
													(cacheStatus.cached / cacheStatus.total) * 100
												)}; --size:3rem; --thickness:4px;"
												role="progressbar"
											>
												<span class="text-xs font-bold"
													>{Math.round((cacheStatus.cached / cacheStatus.total) * 100)}%</span
												>
											</div>
											<div class="text-sm">
												<p>
													<span class="text-success font-semibold">{cacheStatus.cached}</span>
													<span class="text-base-content/60">/ {cacheStatus.total} cached</span>
												</p>
												{#if cacheStatus.missing > 0}
													<p class="text-warning text-xs">
														{cacheStatus.missing} image{cacheStatus.missing === 1 ? '' : 's'} not cached
													</p>
												{/if}
											</div>
										</div>
									</div>
								{:else if collectionStickers.length === 0}
									<p class="text-base-content/60 mt-1 text-sm">No images to check</p>
								{/if}
							</div>

							<!-- Background Download Progress -->
							{#if downloadProgress && downloadProgress.status !== 'idle'}
								<div class="bg-base-100 rounded-lg p-3">
									<div class="mb-2 flex items-center justify-between">
										<span class="text-base-content/60 text-xs uppercase tracking-wide"
											>Background Download</span
										>
										{#if downloadProgress.status === 'running'}
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={handleCancelDownload}
											>
												Cancel
											</button>
										{:else}
											<button class="btn btn-ghost btn-xs" onclick={handleResetDownload}>
												Clear
											</button>
										{/if}
									</div>

									<!-- Status badge -->
									<div class="mb-2 flex items-center gap-2">
										<span
											class={classNames('badge badge-sm', {
												'badge-info': downloadProgress.status === 'running',
												'badge-success': downloadProgress.status === 'completed',
												'badge-warning': downloadProgress.status === 'cancelled',
												'badge-error': downloadProgress.status === 'failed'
											})}
										>
											{downloadProgress.status}
										</span>
										{#if downloadProgress.collection_title}
											<span class="text-base-content/60 truncate text-xs">
												{downloadProgress.collection_title}
											</span>
										{/if}
									</div>

									<!-- Progress bar -->
									{#if downloadProgress.total > 0}
										<progress
											class="progress progress-primary w-full"
											value={downloadProgress.completed}
											max={downloadProgress.total}
										></progress>
										<div class="mt-1 flex justify-between text-xs">
											<span>
												{downloadProgress.completed} / {downloadProgress.total}
											</span>
											<span>
												{Math.round((downloadProgress.completed / downloadProgress.total) * 100)}%
											</span>
										</div>
									{/if}

									<!-- Stats -->
									<div class="mt-2 grid grid-cols-3 gap-1 text-xs">
										<div class="text-success">Cached: {downloadProgress.cached}</div>
										<div class="text-base-content/60">Skipped: {downloadProgress.skipped}</div>
										<div class="text-error">Failed: {downloadProgress.failed}</div>
									</div>

									<!-- Current URL -->
									{#if downloadProgress.status === 'running' && downloadProgress.current_url}
										<div class="text-base-content/50 mt-2 truncate text-xs">
											{downloadProgress.current_url}
										</div>
									{/if}

									<!-- Errors -->
									{#if downloadProgress.errors.length > 0}
										<details class="mt-2">
											<summary class="text-error cursor-pointer text-xs">
												{downloadProgress.errors.length} error{downloadProgress.errors.length === 1
													? ''
													: 's'}
											</summary>
											<ul class="mt-1 max-h-20 overflow-y-auto text-xs">
												{#each downloadProgress.errors.slice(0, 10) as error}
													<li class="text-error/80 truncate">{error}</li>
												{/each}
												{#if downloadProgress.errors.length > 10}
													<li class="text-base-content/50">
														...and {downloadProgress.errors.length - 10} more
													</li>
												{/if}
											</ul>
										</details>
									{/if}
								</div>
							{/if}

							<!-- Download Missing Images Button -->
							{#if cacheStatus && cacheStatus.missing > 0 && (!downloadProgress || downloadProgress.status !== 'running')}
								<button
									class="btn btn-accent btn-sm w-full"
									onclick={handleStartDownload}
									disabled={downloadProgress?.status === 'running'}
								>
									Download {cacheStatus.missing} Missing Image{cacheStatus.missing === 1 ? '' : 's'}
								</button>
							{/if}

							<!-- Dates -->
							{#if selectedCollection.createdAt}
								<div>
									<span class="text-base-content/60 text-xs uppercase tracking-wide">Created</span>
									<p class="text-sm">
										{new Date(selectedCollection.createdAt).toLocaleDateString()}
									</p>
								</div>
							{/if}

							{#if selectedCollection.updatedAt}
								<div>
									<span class="text-base-content/60 text-xs uppercase tracking-wide">Updated</span>
									<p class="text-sm">
										{new Date(selectedCollection.updatedAt).toLocaleDateString()}
									</p>
								</div>
							{/if}
						</div>

						<!-- Actions -->
						<div class="mt-6 space-y-2">
							<button
								class="btn btn-secondary btn-sm w-full"
								onclick={handlePreview}
								disabled={isGenerating}
							>
								{#if isGenerating}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
								Preview JSON
							</button>

							<button
								class="btn btn-primary btn-sm w-full"
								onclick={handleDownload}
								disabled={isSaving || collectionStickers.length === 0}
								title={collectionStickers.length === 0
									? 'Cannot download empty collection'
									: 'Download JSON manifest'}
							>
								{#if isSaving}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
								Download JSON
							</button>

							{#if collectionStickers.length === 0}
								<p class="text-warning text-center text-xs">
									Add stickers to this collection before downloading.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 3: Cached Images + JSON Preview -->
		<div class="flex min-h-0 flex-col gap-4 overflow-hidden">
			<!-- Cached Images Panel -->
			<div class="card bg-base-200 flex h-1/2 min-h-0 flex-col overflow-hidden">
				<div class="card-body flex min-h-0 flex-col p-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="card-title text-lg">Cached Images</h2>
						{#if cachedImages.length > 0}
							<span class="badge badge-success badge-sm">{cachedImages.length} files</span>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if !selectedCollection}
							<div class="text-base-content/60 p-4 text-center">
								<p>Select a collection to view cached images.</p>
							</div>
						{:else if isCheckingCache}
							<div class="flex justify-center p-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if cachedImages.length === 0}
							<div class="text-base-content/60 p-4 text-center">
								<p>No images cached locally yet.</p>
								<p class="mt-1 text-sm">Download missing images to see them here.</p>
							</div>
						{:else}
							<div class="grid grid-cols-4 gap-2">
								{#each cachedImages as cached (cached.sticker.id)}
									<div
										class="bg-base-300 group relative aspect-[2/3] overflow-hidden rounded"
										title={cached.sticker.name}
									>
										<img
											src={cached.assetUrl}
											alt={cached.sticker.name}
											class="h-full w-full object-cover"
											loading="lazy"
										/>
										<div
											class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<p class="truncate text-xs text-white">{cached.sticker.name}</p>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- JSON Preview Panel -->
			<div class="card bg-base-200 flex h-1/2 min-h-0 flex-col overflow-hidden">
				<div class="card-body flex min-h-0 flex-col p-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="card-title text-lg">JSON Preview</h2>
						{#if previewManifest}
							<button
								class="btn btn-ghost btn-xs"
								onclick={handleCopyToClipboard}
								title="Copy to clipboard"
							>
								Copy
							</button>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto">
						{#if !previewManifest}
							<div class="text-base-content/60 p-4 text-center">
								<p>Select a collection and click "Preview JSON" to see the manifest.</p>
							</div>
						{:else}
							<!-- Metadata summary -->
							<div class="bg-base-100 mb-4 rounded-lg p-3">
								<div class="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span class="text-base-content/60">Version:</span>
										<span class="ml-1 font-mono">{previewManifest.version}</span>
									</div>
									<div>
										<span class="text-base-content/60">Stickers:</span>
										<span class="ml-1 font-mono">{previewManifest.metadata.totalCount}</span>
									</div>
									<div>
										<span class="text-base-content/60">Has Images:</span>
										<span
											class={classNames('badge badge-xs ml-1', {
												'badge-success': previewManifest.metadata.hasImages,
												'badge-warning': !previewManifest.metadata.hasImages
											})}
										>
											{previewManifest.metadata.hasImages ? 'Yes' : 'No'}
										</span>
									</div>
									<div>
										<span class="text-base-content/60">Sources:</span>
										<span class="ml-1 font-mono"
											>{previewManifest.metadata.sources.length > 0
												? previewManifest.metadata.sources.join(', ')
												: 'none'}</span
										>
									</div>
								</div>
							</div>

							<!-- JSON output -->
							<pre
								class="bg-base-300 overflow-x-auto whitespace-pre-wrap break-all rounded-lg p-3 font-mono text-xs">{manifestToJson(
									previewManifest
								)}</pre>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
