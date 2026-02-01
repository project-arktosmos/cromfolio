<script lang="ts">
	import classNames from 'classnames';
	import lottie, { type AnimationItem } from 'lottie-web';
	import { onDestroy, onMount } from 'svelte';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import JSZip from 'jszip';
	import { PUBLIC_TELEGRAM_BOT_TOKEN } from '$env/static/public';
	import type { TelegramStickerFormat } from '$types/telegram-sticker.type';
	import { TELEGRAM_STICKER_EXTENSIONS } from '$types/telegram-sticker.type';
	import {
		getAllStampPacks,
		getStampsByPack,
		getStampsDataDir,
		createStampPack,
		createStampsBatch,
		writeStampFile,
		deleteStampPack,
		deleteStampPackFiles
	} from '$services/stamp-packs.service';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';

	// Display types for UI
	interface DisplayStamp extends Stamp {
		dataUrl?: string;
		lottieData?: object;
		format: TelegramStickerFormat;
	}

	interface DisplayPack extends StampPack {
		stickers?: DisplayStamp[];
	}

	// Filter state
	type SourceFilter = 'all' | 'telegram' | 'whatsapp';
	let sourceFilter = $state<SourceFilter>('all');

	// State - Saved packs from database
	let allPacks: DisplayPack[] = $state([]);
	let filteredPacks: DisplayPack[] = $state([]);
	let selectedPack = $state<DisplayPack | null>(null);
	let packStamps: DisplayStamp[] = $state([]);
	let selectedSticker = $state<DisplayStamp | null>(null);
	let isLoading = $state(true);
	let isLoadingStamps = $state(false);
	let stampsDataDir = $state('');

	// Lottie animation references
	let lottiePreviewContainer: HTMLDivElement | null = $state(null);
	let lottiePreviewAnim: AnimationItem | null = null;
	let lottieThumbAnims: Map<string, AnimationItem> = new Map();

	// Telegram import state
	let telegramUrl = $state('');
	let isTelegramImporting = $state(false);
	let telegramImportProgress = $state({ current: 0, total: 0 });
	let telegramError = $state<string | null>(null);
	let telegramDragOver = $state(false);
	let telegramFileInputRef: HTMLInputElement | null = $state(null);

	// Telegram search state
	let searchQuery = $state('');
	let searchResults = $state<{ name: string; title: string; stickerCount?: number }[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);

	// WhatsApp import state
	let isWhatsappImporting = $state(false);
	let whatsappError = $state<string | null>(null);

	// Bot token from environment
	const botToken = PUBLIC_TELEGRAM_BOT_TOKEN;

	// Derived counts
	let telegramCount = $derived(allPacks.filter((p) => p.source === 'telegram').length);
	let whatsappCount = $derived(allPacks.filter((p) => p.source === 'whatsapp').length);

	// Filter packs when filter or allPacks changes
	$effect(() => {
		if (sourceFilter === 'all') {
			filteredPacks = allPacks;
		} else {
			filteredPacks = allPacks.filter((p) => p.source === sourceFilter);
		}
	});

	// Load saved packs on mount
	onMount(async () => {
		try {
			stampsDataDir = await getStampsDataDir();
			allPacks = await getAllStampPacks();
		} catch (e) {
			console.error('Failed to load packs:', e);
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
	 * Get source badge color
	 */
	function getSourceBadgeClass(source: string): string {
		switch (source) {
			case 'telegram':
				return 'badge-info';
			case 'whatsapp':
				return 'badge-success';
			default:
				return 'badge-neutral';
		}
	}

	// ============================================================================
	// TELEGRAM IMPORT FUNCTIONS
	// ============================================================================

	/**
	 * Parse pack name from Telegram URL
	 */
	function parsePackName(input: string): string | null {
		const trimmed = input.trim();
		const urlMatch = trimmed.match(/(?:https?:\/\/)?t\.me\/addstickers\/([a-zA-Z0-9_]+)/);
		if (urlMatch) {
			return urlMatch[1];
		}
		if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			return trimmed;
		}
		return null;
	}

	/**
	 * Fetch sticker pack from Telegram API and save to database
	 */
	async function fetchTelegramStickerPack() {
		const packName = parsePackName(telegramUrl);
		if (!packName) {
			telegramError = 'Invalid sticker pack URL. Use format: https://t.me/addstickers/packname';
			return;
		}

		if (!botToken) {
			telegramError = 'Bot token not configured. Add PUBLIC_TELEGRAM_BOT_TOKEN to .env file.';
			return;
		}

		isTelegramImporting = true;
		telegramError = null;
		telegramImportProgress = { current: 0, total: 0 };

		try {
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
			telegramImportProgress = { current: 0, total: stickerSet.stickers.length };

			for (const telegramSticker of stickerSet.stickers) {
				try {
					const result = await downloadStickerData(telegramSticker);
					if (result) {
						downloadedStickers.push(result);
					}
				} catch (err) {
					console.error('Failed to download sticker:', err);
				}
				telegramImportProgress = { current: telegramImportProgress.current + 1, total: telegramImportProgress.total };
			}

			if (downloadedStickers.length === 0) {
				throw new Error('No stickers could be downloaded');
			}

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

			allPacks = [...allPacks, createdPack];
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
			telegramUrl = '';
		} catch (err) {
			console.error('Fetch error:', err);
			telegramError = `Failed to fetch sticker pack: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isTelegramImporting = false;
			telegramImportProgress = { current: 0, total: 0 };
		}
	}

	/**
	 * Download sticker data from Telegram
	 */
	async function downloadStickerData(telegramSticker: {
		file_id: string;
		file_unique_id: string;
		is_animated: boolean;
		is_video: boolean;
		emoji?: string;
	}): Promise<{ filename: string; data: Uint8Array; emoji: string | null } | null> {
		const fileResponse = await tauriFetch(
			`https://api.telegram.org/bot${botToken}/getFile?file_id=${telegramSticker.file_id}`
		);
		const fileData = await fileResponse.json();

		if (!fileData.ok) {
			throw new Error(fileData.description || 'Failed to get file info');
		}

		const filePath = fileData.result.file_path;
		const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
		const downloadResponse = await tauriFetch(downloadUrl);
		const arrayBuffer = await downloadResponse.arrayBuffer();

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
	 * Handle Telegram file import via drag-drop or file picker
	 */
	async function handleTelegramFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		isTelegramImporting = true;
		telegramError = null;

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
				telegramError = 'No valid sticker files found. Supported formats: .tgs, .webp, .webm';
				return;
			}

			const packName =
				files.length === 1
					? files[0].name.replace(/\.[^.]+$/, '')
					: `Imported Pack ${allPacks.length + 1}`;

			const packId = crypto.randomUUID();

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

			allPacks = [...allPacks, createdPack];
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
		} catch (err) {
			console.error('Import error:', err);
			telegramError = `Failed to import stickers: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isTelegramImporting = false;
		}
	}

	function handleTelegramDrop(event: DragEvent) {
		event.preventDefault();
		telegramDragOver = false;
		handleTelegramFiles(event.dataTransfer?.files || null);
	}

	function handleTelegramDragOver(event: DragEvent) {
		event.preventDefault();
		telegramDragOver = true;
	}

	function handleTelegramDragLeave() {
		telegramDragOver = false;
	}

	// ============================================================================
	// TELEGRAM SEARCH FUNCTIONS
	// ============================================================================

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
	async function searchTelegramPacks() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];

		const query = searchQuery.trim();

		try {
			const results: { name: string; title: string; stickerCount?: number }[] = [];

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
					'No packs found. Try an exact pack name (e.g., "AnimatedCats" or "pepe_pack").';
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
		telegramUrl = packName;
		searchResults = [];
		searchQuery = '';
		await fetchTelegramStickerPack();
	}

	/**
	 * Check if a Telegram pack is already imported
	 */
	function isPackImported(packName: string): boolean {
		return allPacks.some(
			(p) =>
				p.source === 'telegram' &&
				(p.author.toLowerCase() === packName.toLowerCase() ||
					p.name.toLowerCase() === packName.toLowerCase())
		);
	}

	// ============================================================================
	// WHATSAPP IMPORT FUNCTIONS
	// ============================================================================

	/**
	 * Open file picker and import WhatsApp sticker packs
	 */
	async function handleWhatsappSelectFile() {
		whatsappError = null;
		isWhatsappImporting = true;

		try {
			const selected = await open({
				multiple: true,
				title: 'Select WhatsApp Sticker Pack (.wastickers)',
				filters: [
					{
						name: 'WhatsApp Stickers',
						extensions: ['wastickers']
					}
				]
			});

			if (!selected) {
				isWhatsappImporting = false;
				return;
			}

			const files = Array.isArray(selected) ? selected : [selected];

			for (const filePath of files) {
				try {
					await importWastickersFile(filePath);
				} catch (e) {
					console.error(`Failed to import ${filePath}:`, e);
					whatsappError = `Failed to import: ${e instanceof Error ? e.message : 'Unknown error'}`;
				}
			}
		} catch (e) {
			console.error('Failed to open file picker:', e);
			whatsappError = e instanceof Error ? e.message : 'Failed to open file picker';
		} finally {
			isWhatsappImporting = false;
		}
	}

	/**
	 * Import a .wastickers file (ZIP archive)
	 */
	async function importWastickersFile(filePath: string) {
		const fileData = await readFile(filePath);
		const zip = await JSZip.loadAsync(fileData);

		let title = 'Unknown Pack';
		let author = 'Unknown Author';
		let trayImageData: Uint8Array | null = null;
		let trayFilename = '';
		const stickerFiles: { filename: string; data: Uint8Array }[] = [];

		for (const [filename, file] of Object.entries(zip.files)) {
			if (file.dir) continue;

			const cleanName = filename.replace(/^\//, '');

			if (cleanName === 'title.txt') {
				title = (await file.async('string')).trim();
			} else if (cleanName === 'author.txt') {
				author = (await file.async('string')).trim();
			} else if (cleanName.endsWith('.png')) {
				trayImageData = new Uint8Array(await file.async('arraybuffer'));
				trayFilename = cleanName;
			} else if (cleanName.endsWith('.webp')) {
				const data = new Uint8Array(await file.async('arraybuffer'));
				stickerFiles.push({ filename: cleanName, data });
			}
		}

		const packId = crypto.randomUUID();

		let trayImagePath: string | null = null;
		if (trayImageData && trayFilename) {
			trayImagePath = await writeStampFile(packId, trayFilename, trayImageData);
		}

		const originalFilename = filePath.split('/').pop() || 'pack.wastickers';
		const packFilePath = await writeStampFile(packId, originalFilename, new Uint8Array(fileData));

		const createdPack = await createStampPack({
			id: packId,
			source: 'whatsapp',
			name: title,
			author,
			trayImage: trayImagePath,
			packFile: packFilePath,
			stickerCount: stickerFiles.length
		});

		if (!createdPack) {
			throw new Error('Failed to create stamp pack in database');
		}

		const stampsToCreate = [];
		for (const { filename, data } of stickerFiles) {
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

		allPacks = [...allPacks, createdPack];

		if (!selectedPack) {
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
		}
	}

	// ============================================================================
	// DELETE FUNCTIONS
	// ============================================================================

	/**
	 * Delete a stamp pack and its files
	 */
	async function handleDeletePack(pack: DisplayPack, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm(`Delete sticker pack "${pack.name}"? This will remove all stickers and files.`)) {
			return;
		}

		try {
			await deleteStampPackFiles(pack.id);
			await deleteStampPack(pack.id);

			allPacks = allPacks.filter((p) => p.id !== pack.id);

			if (selectedPack?.id === pack.id) {
				selectedPack = filteredPacks.length > 0 ? filteredPacks[0] : null;
				if (selectedPack) {
					await loadPackStamps(selectedPack);
				} else {
					packStamps = [];
					selectedSticker = null;
				}
			}
		} catch (e) {
			console.error('Failed to delete pack:', e);
		}
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<h1 class="text-2xl font-bold mb-4 flex-shrink-0">Stamp Collections</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
		<!-- Column 1: Packs List with Import Panels -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0 gap-3">
				<h2 class="card-title text-lg">Stamp Packs</h2>

				<!-- Filter tabs -->
				<div class="tabs tabs-boxed tabs-sm w-full flex-shrink-0">
					<button
						class={classNames('tab flex-1', { 'tab-active': sourceFilter === 'all' })}
						onclick={() => (sourceFilter = 'all')}
					>
						All ({allPacks.length})
					</button>
					<button
						class={classNames('tab flex-1', { 'tab-active': sourceFilter === 'telegram' })}
						onclick={() => (sourceFilter = 'telegram')}
					>
						TG ({telegramCount})
					</button>
					<button
						class={classNames('tab flex-1', { 'tab-active': sourceFilter === 'whatsapp' })}
						onclick={() => (sourceFilter = 'whatsapp')}
					>
						WA ({whatsappCount})
					</button>
				</div>

				<!-- Import Panels -->
				<div class="space-y-1 flex-shrink-0">
					<!-- Search Telegram Panel -->
					<div class="collapse collapse-arrow bg-base-300 rounded-lg">
						<input type="radio" name="import-panel" />
						<div class="collapse-title text-sm font-medium py-2 min-h-0">
							<div class="flex items-center gap-2">
								<span>Search Telegram</span>
								{#if isSearching}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
							</div>
						</div>
						<div class="collapse-content px-2 pb-2 space-y-2">
							<!-- Search Input -->
							<div class="join w-full">
								<input
									type="text"
									class="input input-bordered input-xs join-item flex-1"
									placeholder="cat, anime, meme..."
									bind:value={searchQuery}
									onkeydown={(e) => e.key === 'Enter' && searchTelegramPacks()}
								/>
								<button
									class="btn btn-primary btn-xs join-item"
									onclick={searchTelegramPacks}
									disabled={isSearching || !searchQuery.trim()}
								>
									{#if isSearching}
										...
									{:else}
										Go
									{/if}
								</button>
							</div>

							{#if searchError}
								<div class="text-warning text-xs">{searchError}</div>
							{/if}

							<!-- Search Results -->
							{#if searchResults.length > 0}
								<div class="space-y-1 max-h-40 overflow-y-auto">
									{#each searchResults as result (result.name)}
										<div
											class={classNames(
												'flex items-center justify-between p-2 rounded bg-base-100 text-xs',
												{ 'opacity-50': isPackImported(result.name) }
											)}
										>
											<div class="flex-1 min-w-0 mr-2">
												<div class="font-medium truncate" title={result.title}>
													{result.title}
												</div>
												<div class="text-base-content/60 truncate">
													@{result.name}
													{#if result.stickerCount}
														<span class="badge badge-ghost badge-xs ml-1"
															>{result.stickerCount}</span
														>
													{/if}
												</div>
											</div>
											<button
												class="btn btn-primary btn-xs flex-shrink-0"
												onclick={() => importFromSearch(result.name)}
												disabled={isTelegramImporting || isPackImported(result.name)}
											>
												{#if isPackImported(result.name)}
													Added
												{:else}
													+
												{/if}
											</button>
										</div>
									{/each}
								</div>
							{:else if !isSearching && !searchError}
								<div class="text-xs text-base-content/60 text-center py-2">
									Enter a keyword or exact pack name
								</div>
							{/if}
						</div>
					</div>

					<!-- Telegram Import Panel -->
					<div class="collapse collapse-arrow bg-base-300 rounded-lg">
						<input type="radio" name="import-panel" />
						<div class="collapse-title text-sm font-medium py-2 min-h-0">
							<div class="flex items-center gap-2">
								<span>Import from Telegram</span>
								{#if isTelegramImporting}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
							</div>
						</div>
						<div class="collapse-content px-2 pb-2 space-y-2">
							<!-- URL Input -->
							<input
								type="text"
								class="input input-bordered input-xs w-full"
								placeholder="t.me/addstickers/packname"
								bind:value={telegramUrl}
								onkeydown={(e) => e.key === 'Enter' && fetchTelegramStickerPack()}
							/>
							<button
								class="btn btn-primary btn-xs w-full"
								onclick={fetchTelegramStickerPack}
								disabled={isTelegramImporting || !telegramUrl.trim()}
							>
								{#if isTelegramImporting && telegramImportProgress.total > 0}
									{telegramImportProgress.current}/{telegramImportProgress.total}
								{:else}
									Import URL
								{/if}
							</button>

							<div class="divider my-1 text-[10px]">OR</div>

							<!-- Drag-drop zone -->
							<div
								class={classNames(
									'border border-dashed rounded p-2 text-center text-xs cursor-pointer transition-colors',
									{
										'border-primary bg-primary/10': telegramDragOver,
										'border-base-content/20 hover:border-primary/50': !telegramDragOver
									}
								)}
								ondrop={handleTelegramDrop}
								ondragover={handleTelegramDragOver}
								ondragleave={handleTelegramDragLeave}
								onclick={() => telegramFileInputRef?.click()}
								onkeydown={(e) => e.key === 'Enter' && telegramFileInputRef?.click()}
								role="button"
								tabindex="0"
							>
								Drop .tgs/.webp/.webm
							</div>
							<input
								bind:this={telegramFileInputRef}
								type="file"
								class="hidden"
								accept=".tgs,.webp,.webm"
								multiple
								onchange={(e) => handleTelegramFiles(e.currentTarget.files)}
							/>

							{#if telegramError}
								<div class="text-error text-xs">{telegramError}</div>
							{/if}
						</div>
					</div>

					<!-- WhatsApp Import Panel -->
					<div class="collapse collapse-arrow bg-base-300 rounded-lg">
						<input type="radio" name="import-panel" />
						<div class="collapse-title text-sm font-medium py-2 min-h-0">
							<div class="flex items-center gap-2">
								<span>Import from WhatsApp</span>
								{#if isWhatsappImporting}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
							</div>
						</div>
						<div class="collapse-content px-2 pb-2">
							<button
								class="btn btn-success btn-xs w-full"
								onclick={handleWhatsappSelectFile}
								disabled={isWhatsappImporting}
							>
								{#if isWhatsappImporting}
									Importing...
								{:else}
									Select .wastickers file
								{/if}
							</button>
							{#if whatsappError}
								<div class="text-error text-xs mt-2">{whatsappError}</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Packs List -->
				<div class="flex-1 overflow-y-auto space-y-2 min-h-0">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if filteredPacks.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p class="text-sm">No packs found.</p>
							<p class="text-xs mt-2">Use the import panels above to add sticker packs.</p>
						</div>
					{:else}
						{#each filteredPacks as pack (pack.id)}
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
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium text-sm truncate">{pack.name}</span>
											<span class={classNames('badge badge-xs', getSourceBadgeClass(pack.source))}>
												{pack.source}
											</span>
										</div>
										<div class="text-xs text-base-content/60 mt-1">
											{pack.stickerCount} sticker{pack.stickerCount !== 1 ? 's' : ''}
											{#if pack.author}
												<span class="mx-1">·</span>
												{pack.author}
											{/if}
										</div>
									</div>
									<button
										class="btn btn-ghost btn-xs text-error opacity-50 hover:opacity-100"
										onclick={(e) => handleDeletePack(pack, e)}
										title="Delete pack"
									>
										&times;
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="text-xs text-base-content/60 pt-2 border-t border-base-300 flex-shrink-0">
					{filteredPacks.length} pack{filteredPacks.length !== 1 ? 's' : ''}
					{#if sourceFilter !== 'all'}
						({sourceFilter})
					{/if}
				</div>
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
							{#if selectedPack.author}
								<p class="text-base-content/60">{selectedPack.author}</p>
							{/if}
							<div class="divider my-2"></div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Source:</span>
								<span class={classNames('badge badge-sm', getSourceBadgeClass(selectedPack.source))}>
									{selectedPack.source}
								</span>
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
										class={classNames('badge badge-sm', getFormatBadgeClass(selectedSticker.format))}
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
