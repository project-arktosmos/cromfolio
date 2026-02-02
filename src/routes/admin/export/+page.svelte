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

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Export Collections</h1>

	<div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
		<!-- Column 1: Collections List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Collections</h2>

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
						<div class="text-center text-base-content/60 p-4">
							<p>No collections found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each filteredCollections as collection (collection.id)}
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
									<div class="flex items-center gap-3">
										{#if collection.coverImage}
											<img
												src={collection.coverImage}
												alt={collection.title}
												class="w-10 h-10 rounded object-cover"
											/>
										{:else}
											<div
												class="w-10 h-10 rounded bg-base-300 flex items-center justify-center text-lg"
											>
												?
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{collection.title}</div>
											{#if collection.description}
												<div class="text-xs text-base-content/60 truncate">
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

				<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
					{filteredCollections.length} collection{filteredCollections.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 2: Export Panel -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						Export Data
						{#if selectedCollection}
							<span class="text-sm font-normal text-base-content/60">
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

				<div class="flex-1 overflow-hidden flex flex-col">
					{#if !selectedCollection}
						<div class="flex-1 flex items-center justify-center text-base-content/60">
							<p>Select a collection to export its data.</p>
						</div>
					{:else if isLoadingExport}
						<div class="flex-1 flex items-center justify-center">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if exportData}
						<!-- Stats -->
						<div class="mb-3 flex gap-2 flex-wrap">
							<span class="badge badge-info">
								{exportData.stickers.length} sticker{exportData.stickers.length !== 1
									? 's'
									: ''}
							</span>
						</div>

						<!-- Export Actions -->
						<div class="mb-4 p-3 bg-base-100 rounded-lg space-y-3">
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
								<div class="text-xs space-y-1 p-2 bg-success/10 rounded">
									<div class="flex justify-between">
										<span class="text-base-content/60">From cache:</span>
										<span class="font-mono text-success">{prepareResult.stickersCopied}</span>
									</div>
									{#if prepareResult.stickersFetched > 0}
										<div class="flex justify-between">
											<span class="text-base-content/60">Fetched:</span>
											<span class="font-mono text-info">{prepareResult.stickersFetched}</span>
										</div>
									{/if}
									{#if prepareResult.stickersMissing > 0}
										<div class="flex justify-between">
											<span class="text-base-content/60">Failed:</span>
											<span class="font-mono text-error">{prepareResult.stickersMissing}</span>
										</div>
									{/if}
									<div class="pt-1 border-t border-base-300">
										<div class="flex items-center justify-between">
											<span class="text-base-content/60">Export directory:</span>
											<button class="btn btn-xs btn-ghost" onclick={openExportDir}>
												Open
											</button>
										</div>
										<div class="font-mono text-xs break-all mt-1">{prepareResult.exportDir}</div>
									</div>
								</div>

								<!-- Create Torrent -->
								<div class="flex items-center justify-between pt-2 border-t border-base-300">
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
									<div class="text-xs space-y-1 p-2 bg-accent/10 rounded">
										<div>
											<span class="text-base-content/60">Info Hash:</span>
											<div class="font-mono text-xs break-all mt-1">{torrentResult.infoHash}</div>
										</div>
										<div class="pt-1 border-t border-base-300">
											<span class="text-base-content/60">Torrent file:</span>
											<div class="font-mono text-xs break-all mt-1">
												{torrentResult.torrentPath}
											</div>
										</div>
									</div>
								{/if}
							{/if}

							{#if exportError}
								<div class="text-xs p-2 bg-error/10 text-error rounded">
									{exportError}
								</div>
							{/if}
						</div>

						<!-- JSON Preview -->
						<div class="flex-1 overflow-auto bg-base-300 rounded-lg p-3">
							<pre class="text-xs font-mono whitespace-pre-wrap break-all">{jsonString}</pre>
						</div>
					{:else}
						<div class="flex-1 flex items-center justify-center text-error">
							<p>Failed to load collection data.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
