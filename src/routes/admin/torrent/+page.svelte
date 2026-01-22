<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import {
		addTorrent,
		listTorrents,
		pauseTorrent,
		resumeTorrent,
		removeTorrent,
		getTorrentDownloadDir,
		onTorrentProgress,
		onTorrentAdded,
		onTorrentCompleted,
		formatBytes,
		formatSpeed,
		formatEta,
		formatProgress,
		getStatusBadgeClass,
		isValidMagnetUri
	} from '$services/torrent.service';
	import type { TorrentInfo, TorrentProgressEvent } from '$types/torrent.type';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	// State
	let torrents: TorrentInfo[] = $state([]);
	let isLoading = $state(true);
	let isAdding = $state(false);
	let selectedTorrent = $state<TorrentInfo | null>(null);
	let downloadDir = $state('');

	// Form state
	let magnetUri = $state('');
	let magnetError = $state('');

	// Event listeners
	let unlistenProgress: UnlistenFn | null = null;
	let unlistenAdded: UnlistenFn | null = null;
	let unlistenCompleted: UnlistenFn | null = null;

	onMount(async () => {
		// Load initial data
		try {
			torrents = await listTorrents();
			downloadDir = await getTorrentDownloadDir();
		} catch (e) {
			console.error('Failed to load torrents:', e);
		}
		isLoading = false;

		// Set up event listeners for real-time updates
		unlistenProgress = await onTorrentProgress(handleProgressUpdate);
		unlistenAdded = await onTorrentAdded(handleTorrentAdded);
		unlistenCompleted = await onTorrentCompleted(handleTorrentCompleted);
	});

	onDestroy(() => {
		// Clean up event listeners
		unlistenProgress?.();
		unlistenAdded?.();
		unlistenCompleted?.();
	});

	// Handle progress updates from backend
	function handleProgressUpdate(event: TorrentProgressEvent) {
		torrents = torrents.map((t) => {
			if (t.id === event.torrentId) {
				return {
					...t,
					status: event.status,
					progress: event.progress,
					downloadedBytes: event.downloadedBytes,
					totalBytes: event.totalBytes,
					downloadSpeed: event.downloadSpeed,
					uploadSpeed: event.uploadSpeed,
					peersConnected: event.peersConnected,
					seedsConnected: event.seedsConnected,
					etaSeconds: event.etaSeconds
				};
			}
			return t;
		});

		// Update selected torrent if it's the one being updated
		if (selectedTorrent?.id === event.torrentId) {
			selectedTorrent = torrents.find((t) => t.id === event.torrentId) || null;
		}
	}

	// Handle new torrent added
	async function handleTorrentAdded() {
		// Refresh the list
		torrents = await listTorrents();
	}

	// Handle torrent completed
	function handleTorrentCompleted(event: TorrentProgressEvent) {
		console.log('Torrent completed:', event.name);
	}

	// Add a new torrent
	async function handleAddTorrent() {
		magnetError = '';

		if (!magnetUri.trim()) {
			magnetError = 'Please enter a magnet URI';
			return;
		}

		if (!isValidMagnetUri(magnetUri.trim())) {
			magnetError = 'Invalid magnet URI format';
			return;
		}

		isAdding = true;
		try {
			await addTorrent(magnetUri.trim());
			magnetUri = '';
			// List will be updated by the event listener
		} catch (e) {
			magnetError = e instanceof Error ? e.message : String(e);
		}
		isAdding = false;
	}

	// Pause a torrent
	async function handlePause(torrent: TorrentInfo, event: MouseEvent) {
		event.stopPropagation();
		try {
			await pauseTorrent(torrent.id as string);
			torrents = await listTorrents();
		} catch (e) {
			console.error('Failed to pause torrent:', e);
		}
	}

	// Resume a torrent
	async function handleResume(torrent: TorrentInfo, event: MouseEvent) {
		event.stopPropagation();
		try {
			await resumeTorrent(torrent.id as string);
			torrents = await listTorrents();
		} catch (e) {
			console.error('Failed to resume torrent:', e);
		}
	}

	// Remove a torrent
	async function handleRemove(torrent: TorrentInfo, deleteFiles: boolean, event: MouseEvent) {
		event.stopPropagation();
		try {
			await removeTorrent(torrent.id as string, deleteFiles);
			torrents = await listTorrents();
			if (selectedTorrent?.id === torrent.id) {
				selectedTorrent = null;
			}
		} catch (e) {
			console.error('Failed to remove torrent:', e);
		}
	}

	// Select a torrent to view details
	function selectTorrent(torrent: TorrentInfo) {
		if (selectedTorrent?.id === torrent.id) {
			selectedTorrent = null;
		} else {
			selectedTorrent = torrent;
		}
	}

	// Get appropriate action buttons based on status
	function canPause(status: string): boolean {
		return status === 'downloading' || status === 'seeding' || status === 'initializing';
	}

	function canResume(status: string): boolean {
		return status === 'paused';
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Torrent Client</h1>

	<div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
		<!-- Column 1: Torrent List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Downloads</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if torrents.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No active downloads.</p>
							<p class="text-sm mt-1">Add a magnet link using the form on the right.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each torrents as torrent (torrent.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedTorrent?.id === torrent.id,
											'bg-base-100': selectedTorrent?.id !== torrent.id
										}
									)}
									onclick={() => selectTorrent(torrent)}
									onkeydown={(e) => e.key === 'Enter' && selectTorrent(torrent)}
									role="button"
									tabindex="0"
								>
									<div class="flex flex-col gap-2">
										<!-- Header row -->
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<span class="font-medium truncate block" title={torrent.name}>
													{torrent.name}
												</span>
											</div>
											<div class="flex items-center gap-1 shrink-0">
												<span class={classNames('badge badge-sm', getStatusBadgeClass(torrent.status))}>
													{torrent.status}
												</span>
												{#if canPause(torrent.status)}
													<button
														class="btn btn-ghost btn-xs"
														onclick={(e) => handlePause(torrent, e)}
														title="Pause"
													>
														⏸
													</button>
												{/if}
												{#if canResume(torrent.status)}
													<button
														class="btn btn-ghost btn-xs"
														onclick={(e) => handleResume(torrent, e)}
														title="Resume"
													>
														▶
													</button>
												{/if}
												<button
													class="btn btn-ghost btn-xs text-error"
													onclick={(e) => handleRemove(torrent, false, e)}
													title="Remove"
												>
													✕
												</button>
											</div>
										</div>

										<!-- Progress bar -->
										<div class="w-full">
											<progress
												class={classNames('progress w-full h-2', {
													'progress-info': torrent.status === 'downloading',
													'progress-success': torrent.status === 'completed' || torrent.status === 'seeding',
													'progress-warning': torrent.status === 'paused'
												})}
												value={torrent.progress * 100}
												max="100"
											></progress>
										</div>

										<!-- Stats row -->
										<div class="flex items-center justify-between text-xs text-base-content/60">
											<span>
												{formatBytes(torrent.downloadedBytes)} / {formatBytes(torrent.totalBytes)}
												({formatProgress(torrent.progress)})
											</span>
											{#if torrent.status === 'downloading'}
												<span>
													↓ {formatSpeed(torrent.downloadSpeed)}
													{#if torrent.uploadSpeed > 0}
														↑ {formatSpeed(torrent.uploadSpeed)}
													{/if}
												</span>
											{/if}
										</div>

										<!-- Peers and ETA -->
										{#if torrent.status === 'downloading' || torrent.status === 'seeding'}
											<div class="flex items-center justify-between text-xs text-base-content/60">
												<span>
													Peers: {torrent.peersConnected} | Seeds: {torrent.seedsConnected}
												</span>
												{#if torrent.etaSeconds}
													<span>ETA: {formatEta(torrent.etaSeconds)}</span>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Add Torrent / Details -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">
					{selectedTorrent ? 'Torrent Details' : 'Add Torrent'}
				</h2>

				<div class="flex-1 overflow-y-auto">
					{#if selectedTorrent}
						<!-- Torrent Details View -->
						<div class="space-y-4">
							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Name</span>
								</label>
								<p class="text-sm break-all">{selectedTorrent.name}</p>
							</div>

							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Info Hash</span>
								</label>
								<p class="text-xs font-mono break-all text-base-content/70">
									{selectedTorrent.infoHash}
								</p>
							</div>

							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Status</span>
								</label>
								<span class={classNames('badge', getStatusBadgeClass(selectedTorrent.status))}>
									{selectedTorrent.status}
								</span>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div class="form-control">
									<label class="label">
										<span class="label-text font-medium">Downloaded</span>
									</label>
									<p class="text-sm">{formatBytes(selectedTorrent.downloadedBytes)}</p>
								</div>
								<div class="form-control">
									<label class="label">
										<span class="label-text font-medium">Total Size</span>
									</label>
									<p class="text-sm">{formatBytes(selectedTorrent.totalBytes)}</p>
								</div>
							</div>

							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Progress</span>
								</label>
								<div class="flex items-center gap-2">
									<progress
										class="progress progress-primary flex-1"
										value={selectedTorrent.progress * 100}
										max="100"
									></progress>
									<span class="text-sm">{formatProgress(selectedTorrent.progress)}</span>
								</div>
							</div>

							{#if selectedTorrent.files.length > 0}
								<div class="form-control">
									<label class="label">
										<span class="label-text font-medium">Files ({selectedTorrent.files.length})</span>
									</label>
									<div class="max-h-40 overflow-y-auto bg-base-100 rounded-lg p-2">
										{#each selectedTorrent.files as file}
											<div class="text-xs py-1 border-b border-base-200 last:border-0">
												<span class="break-all">{file.path}</span>
												<span class="text-base-content/60 ml-2">({formatBytes(file.size)})</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Download Location</span>
								</label>
								<p class="text-xs font-mono break-all text-base-content/70">
									{selectedTorrent.downloadDir}
								</p>
							</div>

							<div class="form-control">
								<label class="label">
									<span class="label-text font-medium">Added</span>
								</label>
								<p class="text-sm">{new Date(selectedTorrent.addedAt).toLocaleString()}</p>
							</div>

							<!-- Actions -->
							<div class="flex gap-2 mt-4">
								{#if canPause(selectedTorrent.status)}
									<button
										class="btn btn-warning flex-1"
										onclick={(e) => selectedTorrent && handlePause(selectedTorrent, e)}
									>
										Pause
									</button>
								{/if}
								{#if canResume(selectedTorrent.status)}
									<button
										class="btn btn-success flex-1"
										onclick={(e) => selectedTorrent && handleResume(selectedTorrent, e)}
									>
										Resume
									</button>
								{/if}
								<button
									class="btn btn-error flex-1"
									onclick={(e) => selectedTorrent && handleRemove(selectedTorrent, true, e)}
								>
									Remove + Delete Files
								</button>
							</div>

							<button class="btn btn-ghost btn-sm w-full" onclick={() => (selectedTorrent = null)}>
								Close Details
							</button>
						</div>
					{:else}
						<!-- Add Torrent Form -->
						<div class="space-y-4">
							<div class="form-control">
								<label class="label" for="magnet-uri">
									<span class="label-text">Magnet URI *</span>
								</label>
								<textarea
									id="magnet-uri"
									placeholder="magnet:?xt=urn:btih:..."
									class={classNames('textarea textarea-bordered w-full h-32 font-mono text-xs', {
										'textarea-error': magnetError
									})}
									bind:value={magnetUri}
								></textarea>
								{#if magnetError}
									<label class="label">
										<span class="label-text-alt text-error">{magnetError}</span>
									</label>
								{/if}
							</div>

							<div class="form-control">
								<label class="label">
									<span class="label-text">Download Directory</span>
								</label>
								<p class="text-xs font-mono break-all text-base-content/70 bg-base-100 p-2 rounded">
									{downloadDir || 'Loading...'}
								</p>
								<label class="label">
									<span class="label-text-alt">Files will be saved to the app data directory</span>
								</label>
							</div>

							<button
								class="btn btn-primary w-full"
								onclick={handleAddTorrent}
								disabled={!magnetUri.trim() || isAdding}
							>
								{#if isAdding}
									<span class="loading loading-spinner loading-sm"></span>
									Adding Torrent...
								{:else}
									Add Torrent
								{/if}
							</button>

							<div class="divider text-xs text-base-content/60">Tips</div>

							<ul class="text-xs text-base-content/60 space-y-1">
								<li>• Paste a magnet link to start downloading</li>
								<li>• Downloads will start automatically after adding</li>
								<li>• Click on a torrent to view details</li>
								<li>• Progress updates in real-time</li>
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
