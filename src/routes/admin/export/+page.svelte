<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { getAllCollections, getStickersForCollection } from '$services/collections.service';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';

	// Types for export results
	interface PrepareExportResult {
		exportDir: string;
		collectionJsonPath: string;
		stickersCopied: number;
		stickersFetched: number;
		stickersMissing: number;
	}

	interface CreateTorrentResult {
		torrentPath: string;
		infoHash: string;
	}

	// State
	let collections: Collection[] = $state([]);
	let isLoadingCollections = $state(true);
	let isLoadingExport = $state(false);

	// Selection
	let selectedCollection = $state<Collection | null>(null);

	// Export data
	let exportData = $state<{ collection: Collection; stickers: Sticker[] } | null>(null);
	let jsonString = $state('');

	// Export to filesystem state
	let isPreparing = $state(false);
	let isCreatingTorrent = $state(false);
	let prepareResult = $state<PrepareExportResult | null>(null);
	let torrentResult = $state<CreateTorrentResult | null>(null);
	let exportError = $state<string | null>(null);

	// Search/filter
	let searchQuery = $state('');

	// Filtered collections
	let filteredCollections = $derived.by(() => {
		if (!searchQuery.trim()) return collections;
		const query = searchQuery.toLowerCase();
		return collections.filter((c) => c.title.toLowerCase().includes(query));
	});

	onMount(async () => {
		collections = await getAllCollections();
		isLoadingCollections = false;
	});

	// Select a collection and load its data
	async function selectCollection(collection: Collection) {
		if (selectedCollection?.id === collection.id) {
			// Deselect
			selectedCollection = null;
			exportData = null;
			jsonString = '';
			prepareResult = null;
			torrentResult = null;
			exportError = null;
			return;
		}

		selectedCollection = collection;
		isLoadingExport = true;
		prepareResult = null;
		torrentResult = null;
		exportError = null;

		try {
			const stickers = await getStickersForCollection(collection.id);
			exportData = { collection, stickers };
			jsonString = JSON.stringify(exportData, null, 2);
		} catch (error) {
			console.error('Failed to load collection data:', error);
			exportData = null;
			jsonString = '';
		} finally {
			isLoadingExport = false;
		}
	}

	// Copy JSON to clipboard
	async function copyToClipboard() {
		if (!jsonString) return;
		try {
			await navigator.clipboard.writeText(jsonString);
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
		}
	}

	// Prepare export to filesystem (copy files + write JSON)
	async function prepareExport() {
		if (!selectedCollection) return;

		isPreparing = true;
		exportError = null;
		prepareResult = null;
		torrentResult = null;

		try {
			prepareResult = await invoke<PrepareExportResult>('prepare_collection_export', {
				collectionId: String(selectedCollection.id)
			});
		} catch (error) {
			console.error('Failed to prepare export:', error);
			exportError = String(error);
		} finally {
			isPreparing = false;
		}
	}

	// Open export directory in file explorer
	async function openExportDir() {
		if (!prepareResult) return;
		try {
			await invoke('open_directory', { path: prepareResult.exportDir });
		} catch (error) {
			console.error('Failed to open directory:', error);
		}
	}

	// Create torrent for the export directory
	async function createTorrent() {
		if (!prepareResult || !selectedCollection) return;

		isCreatingTorrent = true;
		exportError = null;

		try {
			torrentResult = await invoke<CreateTorrentResult>('create_torrent_for_export', {
				exportDir: prepareResult.exportDir,
				torrentName: selectedCollection.title
			});
		} catch (error) {
			console.error('Failed to create torrent:', error);
			exportError = String(error);
		} finally {
			isCreatingTorrent = false;
		}
	}
</script>

<div class="flex h-full flex-col">
	<h1 class="mb-4 text-2xl font-bold">Export Collections</h1>

	<div class="grid min-h-0 flex-1 grid-cols-2 gap-4">
		<!-- Column 1: Collections List -->
		<div class="card bg-base-200 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<h2 class="card-title mb-2 text-lg">Collections</h2>

				<!-- Search -->
				<div class="mb-3">
					<input
						type="text"
						placeholder="Search collections..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
					/>
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if isLoadingCollections}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredCollections.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p>No collections found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each filteredCollections as collection (collection.id)}
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
									<div class="flex items-center gap-3">
										{#if collection.coverImage}
											<img
												src={collection.coverImage}
												alt={collection.title}
												class="h-10 w-10 rounded object-cover"
											/>
										{:else}
											<div
												class="bg-base-300 flex h-10 w-10 items-center justify-center rounded text-lg"
											>
												?
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<div class="truncate font-medium">{collection.title}</div>
											{#if collection.description}
												<div class="text-base-content/60 truncate text-xs">
													{collection.description}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="text-base-content/60 border-base-300 mt-2 border-t pt-2 text-xs">
					{filteredCollections.length} collection{filteredCollections.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 2: Export Panel -->
		<div class="card bg-base-200 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="card-title text-lg">
						Export Data
						{#if selectedCollection}
							<span class="text-base-content/60 text-sm font-normal">
								- {selectedCollection.title}
							</span>
						{/if}
					</h2>
					{#if exportData}
						<div class="flex gap-2">
							<button class="btn btn-sm btn-ghost" onclick={copyToClipboard}> Copy JSON </button>
						</div>
					{/if}
				</div>

				<div class="flex flex-1 flex-col overflow-hidden">
					{#if !selectedCollection}
						<div class="text-base-content/60 flex flex-1 items-center justify-center">
							<p>Select a collection to export its data.</p>
						</div>
					{:else if isLoadingExport}
						<div class="flex flex-1 items-center justify-center">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if exportData}
						<!-- Stats -->
						<div class="mb-3 flex flex-wrap gap-2">
							<span class="badge badge-info">
								{exportData.stickers.length} sticker{exportData.stickers.length !== 1 ? 's' : ''}
							</span>
						</div>

						<!-- Export Actions -->
						<div class="bg-base-100 mb-4 space-y-3 rounded-lg p-3">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium">Export to Filesystem</span>
								<button
									class="btn btn-sm btn-primary"
									onclick={prepareExport}
									disabled={isPreparing || exportData.stickers.length === 0}
								>
									{#if isPreparing}
										<span class="loading loading-spinner loading-xs"></span>
									{/if}
									Prepare Export
								</button>
							</div>

							{#if prepareResult}
								<div class="bg-success/10 space-y-1 rounded p-2 text-xs">
									<div class="flex justify-between">
										<span class="text-base-content/60">From cache:</span>
										<span class="text-success font-mono">{prepareResult.stickersCopied}</span>
									</div>
									{#if prepareResult.stickersFetched > 0}
										<div class="flex justify-between">
											<span class="text-base-content/60">Fetched:</span>
											<span class="text-info font-mono">{prepareResult.stickersFetched}</span>
										</div>
									{/if}
									{#if prepareResult.stickersMissing > 0}
										<div class="flex justify-between">
											<span class="text-base-content/60">Failed:</span>
											<span class="text-error font-mono">{prepareResult.stickersMissing}</span>
										</div>
									{/if}
									<div class="border-base-300 border-t pt-1">
										<div class="flex items-center justify-between">
											<span class="text-base-content/60">Export directory:</span>
											<button class="btn btn-xs btn-ghost" onclick={openExportDir}> Open </button>
										</div>
										<div class="mt-1 break-all font-mono text-xs">{prepareResult.exportDir}</div>
									</div>
								</div>

								<!-- Create Torrent -->
								<div class="border-base-300 flex items-center justify-between border-t pt-2">
									<span class="text-sm font-medium">Create Torrent</span>
									<button
										class="btn btn-sm btn-accent"
										onclick={createTorrent}
										disabled={isCreatingTorrent}
									>
										{#if isCreatingTorrent}
											<span class="loading loading-spinner loading-xs"></span>
										{/if}
										Create .torrent
									</button>
								</div>

								{#if torrentResult}
									<div class="bg-accent/10 space-y-1 rounded p-2 text-xs">
										<div>
											<span class="text-base-content/60">Info Hash:</span>
											<div class="mt-1 break-all font-mono text-xs">{torrentResult.infoHash}</div>
										</div>
										<div class="border-base-300 border-t pt-1">
											<span class="text-base-content/60">Torrent file:</span>
											<div class="mt-1 break-all font-mono text-xs">
												{torrentResult.torrentPath}
											</div>
										</div>
									</div>
								{/if}
							{/if}

							{#if exportError}
								<div class="bg-error/10 text-error rounded p-2 text-xs">
									{exportError}
								</div>
							{/if}
						</div>

						<!-- JSON Preview -->
						<div class="bg-base-300 flex-1 overflow-auto rounded-lg p-3">
							<pre class="whitespace-pre-wrap break-all font-mono text-xs">{jsonString}</pre>
						</div>
					{:else}
						<div class="text-error flex flex-1 items-center justify-center">
							<p>Failed to load collection data.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
