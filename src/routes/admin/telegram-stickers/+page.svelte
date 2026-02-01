<script lang="ts">
	import classNames from 'classnames';
	import lottie, { type AnimationItem } from 'lottie-web';
	import { onDestroy, onMount } from 'svelte';
	import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { PUBLIC_TELEGRAM_BOT_TOKEN } from '$env/static/public';
	import type { TelegramStickerFormat } from '$types/telegram-sticker.type';
	import { TELEGRAM_STICKER_EXTENSIONS } from '$types/telegram-sticker.type';
	import {
		getStampPacksBySource,
		getStampsByPack,
		createStampPack,
		createStampsBatch,
		deleteStampPack,
		deleteStampPackFiles,
		writeStampFile,
		getStampsDataDir
	} from '$services/stamp-packs.service';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';

	// Bot token from environment
	const botToken = PUBLIC_TELEGRAM_BOT_TOKEN;

	// Display types for UI
	interface DisplayStamp extends Stamp {
		dataUrl?: string;
		lottieData?: object;
		format: TelegramStickerFormat;
	}

	interface DisplayPack extends StampPack {
		stickers?: DisplayStamp[];
	}

	// State - Saved packs from database
	let savedPacks: DisplayPack[] = $state([]);
	let selectedPack = $state<DisplayPack | null>(null);
	let packStamps: DisplayStamp[] = $state([]);
	let selectedSticker = $state<DisplayStamp | null>(null);
	let isLoading = $state(true);
	let isLoadingStamps = $state(false);
	let stampsDataDir = $state('');

	// Import state
	let isImporting = $state(false);
	let importError = $state<string | null>(null);
	let dragOver = $state(false);

	// URL import state
	let stickerPackUrl = $state('');
	let importProgress = $state({ current: 0, total: 0 });

	// Search state
	let searchQuery = $state('');
	let searchResults = $state<{ name: string; title: string; preview?: string; stickerCount?: number }[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let activeTab = $state<'import' | 'search'>('import');

	// File input reference
	let fileInputRef: HTMLInputElement | null = $state(null);

	// Lottie animation references
	let lottiePreviewContainer: HTMLDivElement | null = $state(null);
	let lottiePreviewAnim: AnimationItem | null = null;
	let lottieThumbAnims: Map<string, AnimationItem> = new Map();

	// Load saved packs on mount
	onMount(async () => {
		try {
			stampsDataDir = await getStampsDataDir();
			const dbPacks = await getStampPacksBySource('telegram');
			savedPacks = dbPacks;
		} catch (e) {
			console.error('Failed to load packs:', e);
			importError = 'Failed to load saved packs';
		} finally {
			isLoading = false;
		}
	});

	// Cleanup Lottie animations on destroy
	onDestroy(() => {
		lottiePreviewAnim?.destroy();
		lottieThumbAnims.forEach((anim) => anim.destroy());
	});

	/**
	 * Load stamps for a pack from the database
	 */
	async function loadPackStamps(pack: DisplayPack) {
		isLoadingStamps = true;
		try {
			const stamps = await getStampsByPack(pack.id);
			const loadedStamps: DisplayStamp[] = [];

			for (const s of stamps) {
				const format = getFormatFromFilename(s.imagePath);
				const filePath = `${stampsDataDir}/${s.imagePath}`;

				const displayStamp: DisplayStamp = {
					...s,
					format: format || 'static',
					dataUrl: ''
				};

				if (format === 'animated') {
					// Load TGS file and decompress
					try {
						const response = await fetch(convertFileSrc(filePath));
						const arrayBuffer = await response.arrayBuffer();
						displayStamp.lottieData = await decompressTgs(arrayBuffer);
					} catch (err) {
						console.error('Failed to load TGS:', err);
					}
				} else {
					displayStamp.dataUrl = convertFileSrc(filePath);
				}

				loadedStamps.push(displayStamp);
			}

			packStamps = loadedStamps;
		} catch (e) {
			console.error('Failed to load stamps:', e);
			packStamps = [];
		} finally {
			isLoadingStamps = false;
		}
	}

	/**
	 * Select a pack and load its stamps
	 */
	async function selectPack(pack: DisplayPack) {
		if (selectedPack?.id === pack.id) {
			return;
		}
		selectedPack = pack;
		selectedSticker = null;
		await loadPackStamps(pack);
		// Select first sticker if available
		if (packStamps.length > 0) {
			selectedSticker = packStamps[0];
		}
	}

	// Effect to render Lottie preview when selected sticker changes
	$effect(() => {
		if (lottiePreviewAnim) {
			lottiePreviewAnim.destroy();
			lottiePreviewAnim = null;
		}

		if (
			selectedSticker?.format === 'animated' &&
			selectedSticker.lottieData &&
			lottiePreviewContainer
		) {
			lottiePreviewAnim = lottie.loadAnimation({
				container: lottiePreviewContainer,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				animationData: selectedSticker.lottieData
			});
		}
	});

	/**
	 * Parse pack name from Telegram URL
	 * Supports: https://t.me/addstickers/packname or just packname
	 */
	function parsePackName(input: string): string | null {
		const trimmed = input.trim();

		// Try to extract from URL
		const urlMatch = trimmed.match(/(?:https?:\/\/)?t\.me\/addstickers\/([a-zA-Z0-9_]+)/);
		if (urlMatch) {
			return urlMatch[1];
		}

		// If it's just alphanumeric with underscores, treat as pack name
		if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			return trimmed;
		}

		return null;
	}

	/**
	 * Fetch sticker pack from Telegram API and save to database
	 */
	async function fetchStickerPack() {
		const packName = parsePackName(stickerPackUrl);
		if (!packName) {
			importError = 'Invalid sticker pack URL. Use format: https://t.me/addstickers/packname';
			return;
		}

		if (!botToken) {
			importError = 'Bot token not configured. Add PUBLIC_TELEGRAM_BOT_TOKEN to .env file.';
			return;
		}

		isImporting = true;
		importError = null;
		importProgress = { current: 0, total: 0 };

		try {
			// Get sticker set metadata
			const setResponse = await tauriFetch(
				`https://api.telegram.org/bot${botToken}/getStickerSet?name=${packName}`
			);
			const setData = await setResponse.json();

			if (!setData.ok) {
				throw new Error(setData.description || 'Failed to fetch sticker set');
			}

			const stickerSet = setData.result;
			const packId = crypto.randomUUID();
			const downloadedStickers: { filename: string; data: Uint8Array; emoji: string | null }[] = [];
			importProgress = { current: 0, total: stickerSet.stickers.length };

			// Download each sticker
			for (const telegramSticker of stickerSet.stickers) {
				try {
					const result = await downloadStickerData(telegramSticker);
					if (result) {
						downloadedStickers.push(result);
					}
				} catch (err) {
					console.error('Failed to download sticker:', err);
				}
				importProgress = { current: importProgress.current + 1, total: importProgress.total };
			}

			if (downloadedStickers.length === 0) {
				throw new Error('No stickers could be downloaded');
			}

			// Create the stamp pack in database
			const createdPack = await createStampPack({
				id: packId,
				source: 'telegram',
				name: stickerSet.title || packName,
				author: packName,
				trayImage: null,
				packFile: null,
				stickerCount: downloadedStickers.length
			});

			if (!createdPack) {
				throw new Error('Failed to create stamp pack in database');
			}

			// Write files and create stamp records
			const stampsToCreate = [];
			for (const { filename, data, emoji } of downloadedStickers) {
				const imagePath = await writeStampFile(packId, filename, data);
				stampsToCreate.push({
					packId: createdPack.id,
					imagePath,
					emojis: emoji
				});
			}

			if (stampsToCreate.length > 0) {
				await createStampsBatch(stampsToCreate);
			}

			// Add to saved packs and select
			savedPacks = [...savedPacks, createdPack];
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
			stickerPackUrl = '';
		} catch (err) {
			console.error('Fetch error:', err);
			importError = `Failed to fetch sticker pack: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isImporting = false;
			importProgress = { current: 0, total: 0 };
		}
	}

	/**
	 * Download sticker data from Telegram (returns raw data for saving)
	 */
	async function downloadStickerData(telegramSticker: {
		file_id: string;
		file_unique_id: string;
		is_animated: boolean;
		is_video: boolean;
		emoji?: string;
	}): Promise<{ filename: string; data: Uint8Array; emoji: string | null } | null> {
		// Get file path
		const fileResponse = await tauriFetch(
			`https://api.telegram.org/bot${botToken}/getFile?file_id=${telegramSticker.file_id}`
		);
		const fileData = await fileResponse.json();

		if (!fileData.ok) {
			throw new Error(fileData.description || 'Failed to get file info');
		}

		const filePath = fileData.result.file_path;

		// Download the file
		const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
		const downloadResponse = await tauriFetch(downloadUrl);
		const arrayBuffer = await downloadResponse.arrayBuffer();

		// Determine filename with proper extension
		let filename = filePath.split('/').pop() || `sticker_${telegramSticker.file_unique_id}`;
		if (telegramSticker.is_animated && !filename.endsWith('.tgs')) {
			filename = `${telegramSticker.file_unique_id}.tgs`;
		} else if (telegramSticker.is_video && !filename.endsWith('.webm')) {
			filename = `${telegramSticker.file_unique_id}.webm`;
		} else if (!telegramSticker.is_animated && !telegramSticker.is_video && !filename.endsWith('.webp')) {
			filename = `${telegramSticker.file_unique_id}.webp`;
		}

		return {
			filename,
			data: new Uint8Array(arrayBuffer),
			emoji: telegramSticker.emoji || null
		};
	}

	/**
	 * Svelte action for initializing Lottie thumbnail animation
	 */
	function lottieThumbAction(node: HTMLElement, sticker: DisplayStamp) {
		if (!sticker.lottieData) return;

		// Destroy existing animation if any
		const existingAnim = lottieThumbAnims.get(sticker.id);
		if (existingAnim) {
			existingAnim.destroy();
		}

		const anim = lottie.loadAnimation({
			container: node,
			renderer: 'svg',
			loop: true,
			autoplay: true,
			animationData: sticker.lottieData
		});
		lottieThumbAnims.set(sticker.id, anim);

		return {
			destroy() {
				anim.destroy();
				lottieThumbAnims.delete(sticker.id);
			}
		};
	}

	/**
	 * Decompress a TGS (gzipped Lottie) file
	 */
	async function decompressTgs(arrayBuffer: ArrayBuffer): Promise<object> {
		const ds = new DecompressionStream('gzip');
		const blob = new Blob([arrayBuffer]);
		const decompressedStream = blob.stream().pipeThrough(ds);
		const decompressedBlob = await new Response(decompressedStream).blob();
		const text = await decompressedBlob.text();
		return JSON.parse(text);
	}

	/**
	 * Get format from file extension
	 */
	function getFormatFromFilename(filename: string): TelegramStickerFormat | null {
		const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
		if (ext && ext in TELEGRAM_STICKER_EXTENSIONS) {
			return TELEGRAM_STICKER_EXTENSIONS[ext];
		}
		return null;
	}

	/**
	 * Handle file selection and save to database
	 */
	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		isImporting = true;
		importError = null;

		try {
			const validFiles: { filename: string; data: Uint8Array }[] = [];

			for (const file of Array.from(files)) {
				const format = getFormatFromFilename(file.name);
				if (format) {
					const arrayBuffer = await file.arrayBuffer();
					validFiles.push({
						filename: file.name,
						data: new Uint8Array(arrayBuffer)
					});
				}
			}

			if (validFiles.length === 0) {
				importError = 'No valid sticker files found. Supported formats: .tgs, .webp, .webm';
				return;
			}

			// Create pack name
			const packName =
				files.length === 1
					? files[0].name.replace(/\.[^.]+$/, '')
					: `Imported Pack ${savedPacks.length + 1}`;

			const packId = crypto.randomUUID();

			// Create the stamp pack in database
			const createdPack = await createStampPack({
				id: packId,
				source: 'telegram',
				name: packName,
				author: 'File Import',
				trayImage: null,
				packFile: null,
				stickerCount: validFiles.length
			});

			if (!createdPack) {
				throw new Error('Failed to create stamp pack in database');
			}

			// Write files and create stamp records
			const stampsToCreate = [];
			for (const { filename, data } of validFiles) {
				const imagePath = await writeStampFile(packId, filename, data);
				stampsToCreate.push({
					packId: createdPack.id,
					imagePath,
					emojis: null
				});
			}

			if (stampsToCreate.length > 0) {
				await createStampsBatch(stampsToCreate);
			}

			// Add to saved packs and select
			savedPacks = [...savedPacks, createdPack];
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
		} catch (err) {
			console.error('Import error:', err);
			importError = `Failed to import stickers: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isImporting = false;
		}
	}

	/**
	 * Handle drag and drop
	 */
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		handleFiles(event.dataTransfer?.files || null);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	/**
	 * Delete a pack from database
	 */
	async function handleDeletePack(pack: DisplayPack, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm(`Delete sticker pack "${pack.name}"? This will remove all stickers and files.`)) {
			return;
		}

		try {
			await deleteStampPackFiles(pack.id);
			await deleteStampPack(pack.id);

			savedPacks = savedPacks.filter((p) => p.id !== pack.id);

			if (selectedPack?.id === pack.id) {
				selectedPack = savedPacks.length > 0 ? savedPacks[0] : null;
				if (selectedPack) {
					await loadPackStamps(selectedPack);
				} else {
					packStamps = [];
				}
			}
		} catch (e) {
			console.error('Failed to delete pack:', e);
			importError = 'Failed to delete pack';
		}
	}

	/**
	 * Get format badge color
	 */
	function getFormatBadgeClass(format: TelegramStickerFormat): string {
		switch (format) {
			case 'static':
				return 'badge-info';
			case 'animated':
				return 'badge-success';
			case 'video':
				return 'badge-warning';
		}
	}

	/**
	 * Try to get pack info directly from Telegram API
	 */
	async function tryGetPackFromTelegram(
		packName: string
	): Promise<{ name: string; title: string; stickerCount: number } | null> {
		if (!botToken) return null;

		try {
			const response = await tauriFetch(
				`https://api.telegram.org/bot${botToken}/getStickerSet?name=${packName}`
			);
			const data = await response.json();

			if (data.ok && data.result) {
				return {
					name: data.result.name,
					title: data.result.title,
					stickerCount: data.result.stickers?.length || 0
				};
			}
		} catch {
			// Silently fail - pack doesn't exist or API error
		}
		return null;
	}

	/**
	 * Generate common pack name variations to try
	 */
	function generatePackNameVariations(query: string): string[] {
		const base = query.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
		const variations = new Set<string>();

		// Add base variations
		variations.add(base);
		variations.add(`${base}_stickers`);
		variations.add(`${base}stickers`);
		variations.add(`${base}_pack`);
		variations.add(`${base}pack`);

		// Common suffixes used by Telegram sticker creators
		const suffixes = ['', '_by_fStikBot', '_by_stckrRobot', 'Pack', 'Stickers', '_animated'];
		for (const suffix of suffixes) {
			variations.add(`${base}${suffix}`);
		}

		// CamelCase version
		const camel = query
			.split(/\s+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join('');
		variations.add(camel);
		variations.add(`${camel}Stickers`);

		return Array.from(variations).filter((v) => v.length >= 3 && v.length <= 64);
	}

	/**
	 * Search for sticker packs using Telegram API with pattern matching
	 */
	async function searchStickerPacks() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];

		const query = searchQuery.trim();

		try {
			const results: { name: string; title: string; preview?: string; stickerCount?: number }[] =
				[];

			// If query looks like an exact pack name, try it first
			if (/^[a-zA-Z0-9_]+$/.test(query)) {
				const directPack = await tryGetPackFromTelegram(query);
				if (directPack) {
					results.push({
						name: directPack.name,
						title: directPack.title,
						stickerCount: directPack.stickerCount
					});
				}
			}

			// Generate and try variations
			const variations = generatePackNameVariations(query);
			const seenNames = new Set(results.map((r) => r.name.toLowerCase()));

			// Try variations in parallel (batch of 5 at a time to avoid rate limits)
			for (let i = 0; i < variations.length && results.length < 10; i += 5) {
				const batch = variations.slice(i, i + 5);
				const batchResults = await Promise.all(
					batch.map(async (variation) => {
						if (seenNames.has(variation.toLowerCase())) return null;
						return tryGetPackFromTelegram(variation);
					})
				);

				for (const pack of batchResults) {
					if (pack && !seenNames.has(pack.name.toLowerCase())) {
						seenNames.add(pack.name.toLowerCase());
						results.push({
							name: pack.name,
							title: pack.title,
							stickerCount: pack.stickerCount
						});
					}
				}
			}

			searchResults = results;

			if (results.length === 0) {
				searchError =
					'No sticker packs found. Try entering an exact pack name (e.g., "AnimatedCats" or "pepe_pack").';
			}
		} catch (err) {
			console.error('Search error:', err);
			searchError = `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isSearching = false;
		}
	}

	/**
	 * Import a pack from search results
	 */
	async function importFromSearch(packName: string) {
		stickerPackUrl = packName;
		activeTab = 'import';
		await fetchStickerPack();
	}

	/**
	 * Check if a pack is already imported
	 */
	function isPackImported(packName: string): boolean {
		return savedPacks.some(
			(p) => p.author.toLowerCase() === packName.toLowerCase() || p.name.toLowerCase() === packName.toLowerCase()
		);
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<h1 class="text-2xl font-bold mb-4 flex-shrink-0">Telegram Stickers</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
		<!-- Column 1: Imported Packs & Search -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<!-- Tabs -->
				<div class="tabs tabs-boxed mb-3">
					<button
						class={classNames('tab tab-sm flex-1', { 'tab-active': activeTab === 'import' })}
						onclick={() => (activeTab = 'import')}
					>
						Import
					</button>
					<button
						class={classNames('tab tab-sm flex-1', { 'tab-active': activeTab === 'search' })}
						onclick={() => (activeTab = 'search')}
					>
						Search
					</button>
				</div>

				{#if activeTab === 'import'}
					<!-- URL Import -->
					<div class="space-y-2 mb-4">
						<div class="form-control">
							<label class="label py-1" for="pack-url">
								<span class="label-text text-xs">Sticker Pack URL</span>
							</label>
							<input
								id="pack-url"
								type="text"
								class="input input-bordered input-sm"
								placeholder="https://t.me/addstickers/packname"
								bind:value={stickerPackUrl}
								onkeydown={(e) => e.key === 'Enter' && fetchStickerPack()}
							/>
						</div>

						<button
							class="btn btn-primary btn-sm w-full"
							onclick={fetchStickerPack}
							disabled={isImporting || !stickerPackUrl.trim()}
						>
							{#if isImporting && importProgress.total > 0}
								<span class="loading loading-spinner loading-xs"></span>
								{importProgress.current}/{importProgress.total}
							{:else if isImporting}
								<span class="loading loading-spinner loading-xs"></span>
								Fetching...
							{:else}
								Import from URL
							{/if}
						</button>
					</div>

					<div class="divider my-1 text-xs">OR</div>

					<!-- Drop Zone / Import Button -->
					<div
						class={classNames(
							'border-2 border-dashed rounded-lg p-3 mb-3 text-center transition-colors cursor-pointer',
							{
								'border-primary bg-primary/10': dragOver,
								'border-base-300 hover:border-primary/50': !dragOver
							}
						)}
						ondrop={handleDrop}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						onclick={() => fileInputRef?.click()}
						onkeydown={(e) => e.key === 'Enter' && fileInputRef?.click()}
						role="button"
						tabindex="0"
					>
						{#if isImporting && importProgress.total === 0}
							<span class="loading loading-spinner loading-sm"></span>
							<span class="ml-2 text-sm">Importing...</span>
						{:else}
							<div class="text-base-content/60">
								<p class="text-sm font-medium">Drop files here</p>
								<p class="text-xs mt-1">.tgs, .webp, .webm</p>
							</div>
						{/if}
					</div>

					<input
						bind:this={fileInputRef}
						type="file"
						class="hidden"
						accept=".tgs,.webp,.webm"
						multiple
						onchange={(e) => handleFiles(e.currentTarget.files)}
					/>

					{#if importError}
						<div class="alert alert-error text-xs mb-3 py-2">
							<span>{importError}</span>
						</div>
					{/if}

					<!-- Packs List -->
					<h3 class="font-medium text-sm mb-2">Saved Packs</h3>
					<div class="flex-1 overflow-y-auto space-y-2">
						{#if isLoading}
							<div class="flex justify-center p-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if savedPacks.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No packs imported yet.</p>
							</div>
						{:else}
							{#each savedPacks as pack (pack.id)}
								<div
									class={classNames(
										'p-3 rounded-lg transition-colors cursor-pointer hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedPack?.id === pack.id,
											'bg-base-100': selectedPack?.id !== pack.id
										}
									)}
									onclick={() => selectPack(pack)}
									onkeydown={(e) => e.key === 'Enter' && selectPack(pack)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center justify-between">
										<div>
											<span class="font-medium text-sm">{pack.name}</span>
											<span class="badge badge-ghost badge-sm ml-2">
												{pack.stickerCount}
											</span>
										</div>
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={(e) => handleDeletePack(pack, e)}
											title="Delete pack"
										>
											x
										</button>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
						{savedPacks.length} pack{savedPacks.length !== 1 ? 's' : ''} saved
					</div>
				{:else}
					<!-- Search Tab -->
					<div class="space-y-2 mb-4">
						<div class="form-control">
							<label class="label py-1" for="search-query">
								<span class="label-text text-xs">Search Sticker Packs</span>
							</label>
							<div class="join w-full">
								<input
									id="search-query"
									type="text"
									class="input input-bordered input-sm join-item flex-1"
									placeholder="e.g. cat, anime, meme..."
									bind:value={searchQuery}
									onkeydown={(e) => e.key === 'Enter' && searchStickerPacks()}
								/>
								<button
									class="btn btn-primary btn-sm join-item"
									onclick={searchStickerPacks}
									disabled={isSearching || !searchQuery.trim()}
								>
									{#if isSearching}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Search
									{/if}
								</button>
							</div>
						</div>
					</div>

					{#if searchError}
						<div class="alert alert-warning text-xs mb-3 py-2">
							<span>{searchError}</span>
						</div>
					{/if}

					<!-- Search Results -->
					<h3 class="font-medium text-sm mb-2">
						{#if searchResults.length > 0}
							Results ({searchResults.length})
						{:else}
							Results
						{/if}
					</h3>
					<div class="flex-1 overflow-y-auto space-y-2">
						{#if isSearching}
							<div class="flex justify-center p-4">
								<span class="loading loading-spinner loading-md"></span>
							</div>
						{:else if searchResults.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">Search for Telegram sticker packs</p>
								<p class="text-xs mt-1">Enter a pack name or keyword</p>
							</div>
						{:else}
							{#each searchResults as result (result.name)}
								<div
									class={classNames('p-3 rounded-lg bg-base-100 hover:bg-base-300 transition-colors', {
										'opacity-50': isPackImported(result.name)
									})}
								>
									<div class="flex items-center gap-3">
										{#if result.preview}
											<img
												src={result.preview}
												alt={result.title}
												class="w-12 h-12 object-contain rounded bg-base-300"
												loading="lazy"
											/>
										{:else}
											<div
												class="w-12 h-12 rounded bg-base-300 flex items-center justify-center text-base-content/40 text-xl"
											>
												?
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<p class="font-medium text-sm truncate" title={result.title}>
													{result.title}
												</p>
												{#if result.stickerCount}
													<span class="badge badge-ghost badge-xs">{result.stickerCount}</span>
												{/if}
											</div>
											<p class="text-xs text-base-content/60 truncate">@{result.name}</p>
										</div>
										<button
											class="btn btn-primary btn-xs"
											onclick={() => importFromSearch(result.name)}
											disabled={isImporting || isPackImported(result.name)}
										>
											{#if isPackImported(result.name)}
												Added
											{:else}
												Import
											{/if}
										</button>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
						Searches via Telegram Bot API
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 2: Stickers Grid -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">
					{#if selectedPack}
						Stickers ({selectedPack.stickerCount})
					{:else}
						Stickers
					{/if}
				</h2>

				{#if !selectedPack}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a pack to view stickers</p>
					</div>
				{:else if isLoadingStamps}
					<div class="flex-1 flex justify-center items-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if packStamps.length === 0}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>No stickers loaded</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						<div class="grid grid-cols-4 gap-2">
							{#each packStamps as sticker (sticker.id)}
								<div
									class={classNames(
										'relative group cursor-pointer rounded-lg overflow-hidden aspect-square bg-base-300',
										{
											'ring-2 ring-primary': selectedSticker?.id === sticker.id
										}
									)}
									onclick={() => (selectedSticker = sticker)}
									onkeydown={(e) => e.key === 'Enter' && (selectedSticker = sticker)}
									role="button"
									tabindex="0"
								>
									{#if sticker.format === 'static' && sticker.dataUrl}
										<img
											src={sticker.dataUrl}
											alt={sticker.imagePath}
											class="w-full h-full object-contain"
											loading="lazy"
										/>
									{:else if sticker.format === 'video' && sticker.dataUrl}
										<video
											src={sticker.dataUrl}
											class="w-full h-full object-contain"
											autoplay
											loop
											muted
											playsinline
										></video>
									{:else if sticker.format === 'animated' && sticker.lottieData}
										<div class="w-full h-full" use:lottieThumbAction={sticker}></div>
									{/if}
									{#if sticker.emojis}
										<div
											class="absolute top-0.5 right-0.5 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
										>
											{sticker.emojis}
										</div>
									{/if}
									<div
										class={classNames(
											'absolute bottom-0 left-0 right-0 px-1 py-0.5',
											getFormatBadgeClass(sticker.format),
											'text-[10px] text-center opacity-0 group-hover:opacity-100 transition-opacity'
										)}
									>
										{sticker.format}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 3: Pack Details & Sticker Preview -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">Details</h2>

				{#if !selectedPack}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a pack to view details</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto space-y-4">
						<!-- Pack Details -->
						<div class="space-y-2 text-sm">
							<h3 class="font-bold text-lg">{selectedPack.name}</h3>
							<p class="text-base-content/60">{selectedPack.author}</p>
							<div class="divider my-2"></div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Source:</span>
								<span class="badge badge-info badge-sm">Telegram</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Stickers:</span>
								<span>{selectedPack.stickerCount}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Imported:</span>
								<span class="text-xs">
									{new Date(selectedPack.createdAt).toLocaleDateString()}
								</span>
							</div>
						</div>

						{#if selectedSticker}
							<div class="divider my-2"></div>

							<!-- Sticker Preview Area -->
							<div class="flex justify-center items-center bg-base-300 rounded-lg p-4 min-h-48">
								{#if selectedSticker.format === 'static' && selectedSticker.dataUrl}
									<img
										src={selectedSticker.dataUrl}
										alt={selectedSticker.imagePath}
										class="max-w-full max-h-64 object-contain"
									/>
								{:else if selectedSticker.format === 'video' && selectedSticker.dataUrl}
									<video
										src={selectedSticker.dataUrl}
										class="max-w-full max-h-64 object-contain"
										autoplay
										loop
										muted
										playsinline
										controls
									></video>
								{:else if selectedSticker.format === 'animated' && selectedSticker.lottieData}
									<div bind:this={lottiePreviewContainer} class="w-64 h-64"></div>
								{/if}
							</div>

							<!-- Sticker Details -->
							<div class="space-y-2 text-sm">
								<div class="flex justify-between">
									<span class="text-base-content/60">File:</span>
									<span
										class="font-mono text-xs truncate max-w-48"
										title={selectedSticker.imagePath}
									>
										{selectedSticker.imagePath.split('/').pop()}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-base-content/60">Format:</span>
									<span
										class={classNames(
											'badge badge-sm',
											getFormatBadgeClass(selectedSticker.format)
										)}
									>
										{selectedSticker.format}
									</span>
								</div>
								{#if selectedSticker.emojis}
									<div class="flex justify-between">
										<span class="text-base-content/60">Emoji:</span>
										<span class="text-2xl">{selectedSticker.emojis}</span>
									</div>
								{/if}
							</div>

							<!-- Lottie JSON Preview for TGS -->
							{#if selectedSticker.format === 'animated' && selectedSticker.lottieData}
								<div class="collapse collapse-arrow bg-base-300">
									<input type="checkbox" />
									<div class="collapse-title text-sm font-medium">Lottie JSON Data</div>
									<div class="collapse-content">
										<pre class="text-xs overflow-x-auto max-h-48 overflow-y-auto">{JSON.stringify(
												selectedSticker.lottieData,
												null,
												2
											)}</pre>
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
