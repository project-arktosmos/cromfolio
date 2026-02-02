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
		coverUrl?: string;
	}

	// State - Saved packs from database
	let allPacks: DisplayPack[] = $state([]);
	let selectedPack = $state<DisplayPack | null>(null);
	let packStamps: DisplayStamp[] = $state([]);
	let isLoading = $state(true);
	let isLoadingStamps = $state(false);
	let stampsDataDir = $state('');

	// Lottie animation references for thumbnails
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
	let searchResults = $state<
		{ name: string; title: string; stickerCount?: number; thumbUrl?: string }[]
	>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let searchVariations = $state<string[]>([]);
	let searchOffset = $state(0);
	let searchSeenNames = $state<Set<string>>(new Set());
	let hasMoreSearchResults = $derived(searchOffset < searchVariations.length);

	// WhatsApp import state
	let isWhatsappImporting = $state(false);
	let whatsappError = $state<string | null>(null);

	// Bot token from environment
	const botToken = PUBLIC_TELEGRAM_BOT_TOKEN;

	/**
	 * Get cover URL for a pack (trayImage or first stamp)
	 */
	async function getPackCoverUrl(pack: StampPack, dataDir: string): Promise<string | undefined> {
		// Use tray image if available
		if (pack.trayImage) {
			return convertFileSrc(`${dataDir}/${pack.trayImage}`);
		}
		// Otherwise get first stamp
		try {
			const stamps = await getStampsByPack(pack.id);
			if (stamps.length > 0) {
				const firstStamp = stamps[0];
				const format = getFormatFromFilename(firstStamp.imagePath);
				// Only use static images for covers (not animated/video)
				if (format === 'static' || format === 'video') {
					return convertFileSrc(`${dataDir}/${firstStamp.imagePath}`);
				}
				// For animated, try to find a static one or just use the first
				const staticStamp = stamps.find((s) => getFormatFromFilename(s.imagePath) === 'static');
				if (staticStamp) {
					return convertFileSrc(`${dataDir}/${staticStamp.imagePath}`);
				}
				// Fallback to first stamp even if animated
				return convertFileSrc(`${dataDir}/${firstStamp.imagePath}`);
			}
		} catch (e) {
			console.error('Failed to get cover for pack:', pack.id, e);
		}
		return undefined;
	}

	// Load saved packs on mount
	onMount(async () => {
		try {
			stampsDataDir = await getStampsDataDir();
			const packs = await getAllStampPacks();
			// Load cover URLs for all packs
			const packsWithCovers: DisplayPack[] = await Promise.all(
				packs.map(async (pack) => ({
					...pack,
					coverUrl: await getPackCoverUrl(pack, stampsDataDir)
				}))
			);
			allPacks = packsWithCovers;
		} catch (e) {
			console.error('Failed to load packs:', e);
		} finally {
			isLoading = false;
		}
	});

	// Cleanup Lottie animations on destroy
	onDestroy(() => {
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
		await loadPackStamps(pack);
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
				telegramImportProgress = {
					current: telegramImportProgress.current + 1,
					total: telegramImportProgress.total
				};
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

			const packWithCover: DisplayPack = {
				...createdPack,
				coverUrl: await getPackCoverUrl(createdPack, stampsDataDir)
			};
			allPacks = [...allPacks, packWithCover];
			selectedPack = packWithCover;
			await loadPackStamps(packWithCover);
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
		} else if (
			!telegramSticker.is_animated &&
			!telegramSticker.is_video &&
			!filename.endsWith('.webp')
		) {
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

			const packWithCover: DisplayPack = {
				...createdPack,
				coverUrl: await getPackCoverUrl(createdPack, stampsDataDir)
			};
			allPacks = [...allPacks, packWithCover];
			selectedPack = packWithCover;
			await loadPackStamps(packWithCover);
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
	): Promise<{ name: string; title: string; stickerCount: number; thumbUrl?: string } | null> {
		if (!botToken) return null;

		try {
			const response = await tauriFetch(
				`https://api.telegram.org/bot${botToken}/getStickerSet?name=${packName}`
			);
			const data = await response.json();

			if (data.ok && data.result) {
				let thumbUrl: string | undefined;

				// Try to get thumbnail from first sticker
				const firstSticker = data.result.stickers?.[0];
				if (firstSticker?.thumbnail?.file_id) {
					try {
						const fileResponse = await tauriFetch(
							`https://api.telegram.org/bot${botToken}/getFile?file_id=${firstSticker.thumbnail.file_id}`
						);
						const fileData = await fileResponse.json();
						if (fileData.ok && fileData.result?.file_path) {
							thumbUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
						}
					} catch {
						// Ignore thumbnail fetch errors
					}
				}

				return {
					name: data.result.name,
					title: data.result.title,
					stickerCount: data.result.stickers?.length || 0,
					thumbUrl
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
		const base = query
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/g, '');
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
		searchSeenNames = new Set();
		searchOffset = 0;

		const query = searchQuery.trim();

		try {
			const results: { name: string; title: string; stickerCount?: number; thumbUrl?: string }[] =
				[];

			// If query looks like an exact pack name, try it first
			if (/^[a-zA-Z0-9_]+$/.test(query)) {
				const directPack = await tryGetPackFromTelegram(query);
				if (directPack) {
					results.push({
						name: directPack.name,
						title: directPack.title,
						stickerCount: directPack.stickerCount,
						thumbUrl: directPack.thumbUrl
					});
					searchSeenNames.add(directPack.name.toLowerCase());
				}
			}

			// Generate and store variations for pagination
			searchVariations = generatePackNameVariations(query);

			// Load first batch
			const { newResults, newOffset } = await loadSearchBatch(
				searchVariations,
				0,
				searchSeenNames,
				5
			);

			for (const pack of newResults) {
				results.push(pack);
				searchSeenNames.add(pack.name.toLowerCase());
			}
			searchOffset = newOffset;
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
	 * Load a batch of search results from variations
	 */
	async function loadSearchBatch(
		variations: string[],
		startOffset: number,
		seenNames: Set<string>,
		maxResults: number
	): Promise<{
		newResults: { name: string; title: string; stickerCount?: number; thumbUrl?: string }[];
		newOffset: number;
	}> {
		const newResults: { name: string; title: string; stickerCount?: number; thumbUrl?: string }[] =
			[];
		let offset = startOffset;

		// Try variations in parallel (batch of 5 at a time to avoid rate limits)
		while (offset < variations.length && newResults.length < maxResults) {
			const batch = variations.slice(offset, offset + 5);
			const batchResults = await Promise.all(
				batch.map(async (variation) => {
					if (seenNames.has(variation.toLowerCase())) return null;
					return tryGetPackFromTelegram(variation);
				})
			);

			for (const pack of batchResults) {
				if (pack && !seenNames.has(pack.name.toLowerCase())) {
					newResults.push({
						name: pack.name,
						title: pack.title,
						stickerCount: pack.stickerCount,
						thumbUrl: pack.thumbUrl
					});
				}
			}

			offset += 5;
		}

		return { newResults, newOffset: offset };
	}

	/**
	 * Load more search results
	 */
	async function loadMoreSearchResults() {
		if (!hasMoreSearchResults || isSearching) return;

		isSearching = true;
		searchError = null;

		try {
			const { newResults, newOffset } = await loadSearchBatch(
				searchVariations,
				searchOffset,
				searchSeenNames,
				5
			);

			for (const pack of newResults) {
				searchSeenNames.add(pack.name.toLowerCase());
			}
			searchOffset = newOffset;
			searchResults = [...searchResults, ...newResults];

			if (newResults.length === 0 && !hasMoreSearchResults) {
				searchError = 'No more packs found.';
			}
		} catch (err) {
			console.error('Load more error:', err);
			searchError = `Failed to load more: ${err instanceof Error ? err.message : 'Unknown error'}`;
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

		const packWithCover: DisplayPack = {
			...createdPack,
			coverUrl: await getPackCoverUrl(createdPack, stampsDataDir)
		};
		allPacks = [...allPacks, packWithCover];

		if (!selectedPack) {
			selectedPack = packWithCover;
			await loadPackStamps(packWithCover);
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
				selectedPack = allPacks.length > 0 ? allPacks[0] : null;
				if (selectedPack) {
					await loadPackStamps(selectedPack);
				} else {
					packStamps = [];
				}
			}
		} catch (e) {
			console.error('Failed to delete pack:', e);
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<h1 class="mb-4 flex-shrink-0 text-2xl font-bold">Stamp Collections</h1>

	<div class="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-hidden">
		<!-- Column 1: Import Panels -->
		<div class="card bg-base-200 flex min-h-0 flex-col overflow-hidden">
			<div class="card-body flex min-h-0 flex-col gap-3 p-4">
				<h2 class="card-title text-lg">Import Stickers</h2>

				<div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
					<!-- Search Telegram Panel -->
					<div class="bg-base-300 rounded-lg p-3">
						<div class="mb-2 flex items-center gap-2 text-sm font-medium">
							<span>Search Telegram</span>
							{#if isSearching}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
						</div>
						<div class="space-y-2">
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
								<div class="max-h-64 space-y-1 overflow-y-auto">
									{#each searchResults as result (result.name)}
										<div
											class={classNames(
												'bg-base-100 flex items-center gap-2 rounded p-2 text-xs',
												{ 'opacity-50': isPackImported(result.name) }
											)}
										>
											<!-- Thumbnail -->
											<div
												class="bg-base-300 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded"
											>
												{#if result.thumbUrl}
													<img
														src={result.thumbUrl}
														alt={result.title}
														class="h-full w-full object-contain"
														loading="lazy"
													/>
												{:else}
													<span class="text-base-content/30 text-sm">?</span>
												{/if}
											</div>
											<!-- Pack Info -->
											<div class="min-w-0 flex-1">
												<div class="truncate font-medium" title={result.title}>
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
											<!-- Import Button -->
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
									<!-- Load More Button -->
									{#if hasMoreSearchResults}
										<button
											class="btn btn-ghost btn-xs w-full"
											onclick={loadMoreSearchResults}
											disabled={isSearching}
										>
											{#if isSearching}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												Load more...
											{/if}
										</button>
									{/if}
								</div>
								<!-- Results count -->
								<div class="text-base-content/60 text-center text-xs">
									{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
								</div>
							{:else if !isSearching && !searchError}
								<div class="text-base-content/60 py-2 text-center text-xs">
									Enter a keyword or exact pack name
								</div>
							{/if}
						</div>
					</div>

					<!-- Telegram Import Panel -->
					<div class="bg-base-300 rounded-lg p-3">
						<div class="mb-2 flex items-center gap-2 text-sm font-medium">
							<span>Import from Telegram</span>
							{#if isTelegramImporting}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
						</div>
						<div class="space-y-2">
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
									'cursor-pointer rounded border border-dashed p-2 text-center text-xs transition-colors',
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
					<div class="bg-base-300 rounded-lg p-3">
						<div class="mb-2 flex items-center gap-2 text-sm font-medium">
							<span>Import from WhatsApp</span>
							{#if isWhatsappImporting}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
						</div>
						<div>
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
								<div class="text-error mt-2 text-xs">{whatsappError}</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Column 2: Packs List -->
		<div class="card bg-base-200 flex min-h-0 flex-col overflow-hidden">
			<div class="card-body flex min-h-0 flex-col gap-3 p-4">
				<h2 class="card-title text-lg">Stamp Packs</h2>

				<!-- Packs List -->
				<div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if allPacks.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p class="text-sm">No packs found.</p>
							<p class="mt-2 text-xs">Use the import panel to add sticker packs.</p>
						</div>
					{:else}
						{#each allPacks as pack (pack.id)}
							<div
								class={classNames(
									'hover:bg-base-300 cursor-pointer rounded-lg p-2 transition-colors',
									{
										'bg-primary/20 ring-primary ring-2': selectedPack?.id === pack.id,
										'bg-base-100': selectedPack?.id !== pack.id
									}
								)}
								onclick={() => selectPack(pack)}
								onkeydown={(e) => e.key === 'Enter' && selectPack(pack)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center gap-2">
									<!-- Cover Image -->
									<div
										class="bg-base-300 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded"
									>
										{#if pack.coverUrl}
											<img
												src={pack.coverUrl}
												alt={pack.name}
												class="h-full w-full object-contain"
												loading="lazy"
											/>
										{:else}
											<span class="text-base-content/30 text-lg">?</span>
										{/if}
									</div>
									<!-- Pack Info -->
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="truncate text-sm font-medium">{pack.name}</span>
											<span class={classNames('badge badge-xs', getSourceBadgeClass(pack.source))}>
												{pack.source}
											</span>
										</div>
										<div class="text-base-content/60 text-xs">
											{pack.stickerCount} sticker{pack.stickerCount !== 1 ? 's' : ''}
											{#if pack.author}
												<span class="mx-1">·</span>
												<span class="truncate">{pack.author}</span>
											{/if}
										</div>
									</div>
									<!-- Delete Button -->
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

				<div class="text-base-content/60 border-base-300 flex-shrink-0 border-t pt-2 text-xs">
					{allPacks.length} pack{allPacks.length !== 1 ? 's' : ''}
				</div>
			</div>
		</div>

		<!-- Column 3: Stickers Grid -->
		<div class="card bg-base-200 flex min-h-0 flex-col overflow-hidden">
			<div class="card-body flex min-h-0 flex-col p-4">
				<h2 class="card-title mb-2 text-lg">
					{#if selectedPack}
						{selectedPack.name} ({selectedPack.stickerCount})
					{:else}
						Stickers
					{/if}
				</h2>

				{#if !selectedPack}
					<div class="text-base-content/60 flex flex-1 items-center justify-center">
						<p>Select a pack to view stickers</p>
					</div>
				{:else if isLoadingStamps}
					<div class="flex flex-1 items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if packStamps.length === 0}
					<div class="text-base-content/60 flex flex-1 items-center justify-center">
						<p>No stickers loaded</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						<div class="grid grid-cols-5 gap-2">
							{#each packStamps as sticker (sticker.id)}
								<div
									class="bg-base-300 group relative aspect-square overflow-hidden rounded-lg"
								>
									{#if sticker.format === 'static' && sticker.dataUrl}
										<img
											src={sticker.dataUrl}
											alt={sticker.imagePath}
											class="h-full w-full object-contain"
											loading="lazy"
										/>
									{:else if sticker.format === 'video' && sticker.dataUrl}
										<video
											src={sticker.dataUrl}
											class="h-full w-full object-contain"
											autoplay
											loop
											muted
											playsinline
										></video>
									{:else if sticker.format === 'animated' && sticker.lottieData}
										<div class="h-full w-full" use:lottieThumbAction={sticker}></div>
									{/if}
									{#if sticker.emojis}
										<div
											class="absolute right-0.5 top-0.5 text-sm opacity-0 transition-opacity group-hover:opacity-100"
										>
											{sticker.emojis}
										</div>
									{/if}
									<div
										class={classNames(
											'absolute bottom-0 left-0 right-0 px-1 py-0.5',
											getFormatBadgeClass(sticker.format),
											'text-center text-[10px] opacity-0 transition-opacity group-hover:opacity-100'
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
	</div>
</div>
