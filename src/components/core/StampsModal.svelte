<script lang="ts">
	import classNames from 'classnames';
	import lottie, { type AnimationItem } from 'lottie-web';
	import { onDestroy } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
	import { open } from '@tauri-apps/plugin-dialog';
	import { PUBLIC_TELEGRAM_BOT_TOKEN } from '$env/static/public';
	import type { TelegramStickerFormat } from '$types/telegram-sticker.type';
	import {
		startTelegramImport,
		getTelegramImportProgress,
		resetTelegramImport,
		type TelegramImportProgress
	} from '$services/telegram-import.service';
	import {
		startWhatsappImport,
		getWhatsappImportProgress,
		resetWhatsappImport,
		type WhatsappImportProgress
	} from '$services/whatsapp-import.service';
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
	import { stampsModalService } from '$services/stamps-modal.service';
	import { toastService } from '$services/toast.service';

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

	// Subscribe to modal state
	let modalState = $state({ isOpen: false });
	$effect(() => {
		const unsubscribe = stampsModalService.subscribe((state) => {
			modalState = state;
			if (state.isOpen && !isInitialized) {
				initializeData();
			}
		});
		return unsubscribe;
	});

	// State - Saved packs from database
	let isInitialized = $state(false);
	let allPacks: DisplayPack[] = $state([]);
	let selectedPack = $state<DisplayPack | null>(null);
	let packStamps: DisplayStamp[] = $state([]);
	let isLoading = $state(true);
	let isLoadingStamps = $state(false);
	let stampsDataDir = $state('');

	// Lottie animation references for thumbnails
	let lottieThumbAnims: SvelteMap<string, AnimationItem> = new SvelteMap();

	// Telegram import state
	let telegramUrl = $state('');
	let isTelegramImporting = $state(false);
	let telegramImportProgress = $state<TelegramImportProgress | null>(null);
	let telegramError = $state<string | null>(null);
	let telegramDragOver = $state(false);
	let telegramFileInputRef: HTMLInputElement | null = $state(null);
	let progressPollInterval: ReturnType<typeof setInterval> | null = null;

	// Telegram search state
	let searchQuery = $state('');
	let searchResults = $state<
		{ name: string; title: string; stickerCount?: number; thumbUrl?: string }[]
	>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let searchVariations = $state<string[]>([]);
	let searchOffset = $state(0);
	let searchSeenNames: SvelteSet<string> = new SvelteSet();
	let hasMoreSearchResults = $derived(searchOffset < searchVariations.length);

	// WhatsApp import state
	let isWhatsappImporting = $state(false);
	let whatsappImportProgress = $state<WhatsappImportProgress | null>(null);
	let whatsappError = $state<string | null>(null);
	let whatsappPollInterval: ReturnType<typeof setInterval> | null = null;

	// Toast IDs for tracking import progress
	let telegramImportToastId: string | null = null;
	let whatsappImportToastId: string | null = null;

	// Bot token from environment (used for search only)
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

	async function initializeData() {
		try {
			isLoading = true;
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
			isInitialized = true;
		} catch (e) {
			console.error('Failed to load packs:', e);
		} finally {
			isLoading = false;
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		// Don't clear polling intervals - let imports continue in background with toast updates
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
	 * Fetch sticker pack from Telegram API and save to database (via Rust backend)
	 */
	async function fetchTelegramStickerPack() {
		if (!telegramUrl.trim()) return;

		telegramError = null;
		isTelegramImporting = true;

		// Create a persistent toast for progress
		telegramImportToastId = toastService.info('Importing Telegram stickers...', 0);

		try {
			await startTelegramImport(telegramUrl);

			// Start polling for progress
			progressPollInterval = setInterval(async () => {
				try {
					const progress = await getTelegramImportProgress();
					telegramImportProgress = progress;

					// Update toast with progress
					if (telegramImportToastId && progress.total > 0) {
						toastService.updateMessage(
							telegramImportToastId,
							`Importing Telegram stickers: ${progress.completed}/${progress.total}`
						);
					}

					if (progress.status === 'completed') {
						clearInterval(progressPollInterval!);
						progressPollInterval = null;
						isTelegramImporting = false;
						telegramUrl = '';

						// Remove progress toast and show success
						if (telegramImportToastId) {
							toastService.remove(telegramImportToastId);
							telegramImportToastId = null;
						}
						toastService.success(`Imported ${progress.completed} stickers`);

						// Mark stamps as updated for other components to refresh
						stampsModalService.markStampsUpdated();

						// Refresh pack list and select new pack
						if (progress.resultPackId) {
							const packs = await getAllStampPacks();
							const packsWithCovers = await Promise.all(
								packs.map(async (pack) => ({
									...pack,
									coverUrl: await getPackCoverUrl(pack, stampsDataDir)
								}))
							);
							allPacks = packsWithCovers;

							const newPack = packsWithCovers.find((p) => p.id === progress.resultPackId);
							if (newPack) {
								selectedPack = newPack;
								await loadPackStamps(newPack);
							}
						}

						await resetTelegramImport();
					} else if (progress.status === 'failed' || progress.status === 'cancelled') {
						clearInterval(progressPollInterval!);
						progressPollInterval = null;
						isTelegramImporting = false;
						telegramError = progress.errors[0] || 'Import failed';

						// Remove progress toast and show error
						if (telegramImportToastId) {
							toastService.remove(telegramImportToastId);
							telegramImportToastId = null;
						}
						toastService.error(telegramError);

						await resetTelegramImport();
					}
				} catch (e) {
					console.error('Failed to poll progress:', e);
				}
			}, 500);
		} catch (e) {
			console.error('Failed to start import:', e);
			telegramError = e instanceof Error ? e.message : 'Failed to start import';
			isTelegramImporting = false;

			// Remove progress toast and show error
			if (telegramImportToastId) {
				toastService.remove(telegramImportToastId);
				telegramImportToastId = null;
			}
			toastService.error(telegramError);
		}
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

			// Mark stamps as updated for other components to refresh
			stampsModalService.markStampsUpdated();
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
		const variations = new SvelteSet<string>();

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
		searchSeenNames = new SvelteSet();
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
		seenNames: SvelteSet<string>,
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
					seenNames.add(pack.name.toLowerCase());
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
	 * Open file picker and import WhatsApp sticker packs (via Rust backend)
	 */
	async function handleWhatsappSelectFile() {
		whatsappError = null;

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
				return;
			}

			const files = Array.isArray(selected) ? selected : [selected];

			isWhatsappImporting = true;

			// Create a persistent toast for progress
			whatsappImportToastId = toastService.info('Importing WhatsApp stickers...', 0);

			await startWhatsappImport(files);

			// Start polling for progress
			whatsappPollInterval = setInterval(async () => {
				try {
					const progress = await getWhatsappImportProgress();
					whatsappImportProgress = progress;

					// Update toast with progress
					if (whatsappImportToastId && progress.totalFiles > 0) {
						toastService.updateMessage(
							whatsappImportToastId,
							`Importing WhatsApp stickers: ${progress.processedFiles}/${progress.totalFiles} files`
						);
					}

					if (progress.status === 'completed') {
						clearInterval(whatsappPollInterval!);
						whatsappPollInterval = null;
						isWhatsappImporting = false;

						// Remove progress toast and show success
						if (whatsappImportToastId) {
							toastService.remove(whatsappImportToastId);
							whatsappImportToastId = null;
						}
						toastService.success(`Imported ${progress.resultPackIds.length} pack(s)`);

						// Mark stamps as updated for other components to refresh
						stampsModalService.markStampsUpdated();

						// Refresh pack list and select first new pack
						if (progress.resultPackIds.length > 0) {
							const packs = await getAllStampPacks();
							const packsWithCovers = await Promise.all(
								packs.map(async (pack) => ({
									...pack,
									coverUrl: await getPackCoverUrl(pack, stampsDataDir)
								}))
							);
							allPacks = packsWithCovers;

							// Select the first newly imported pack
							const firstNewPackId = progress.resultPackIds[0];
							const newPack = packsWithCovers.find((p) => p.id === firstNewPackId);
							if (newPack) {
								selectedPack = newPack;
								await loadPackStamps(newPack);
							}
						}

						await resetWhatsappImport();
					} else if (progress.status === 'failed' || progress.status === 'cancelled') {
						clearInterval(whatsappPollInterval!);
						whatsappPollInterval = null;
						isWhatsappImporting = false;
						whatsappError = progress.errors[0] || 'Import failed';

						// Remove progress toast and show error
						if (whatsappImportToastId) {
							toastService.remove(whatsappImportToastId);
							whatsappImportToastId = null;
						}
						toastService.error(whatsappError);

						await resetWhatsappImport();
					}
				} catch (e) {
					console.error('Failed to poll WhatsApp progress:', e);
				}
			}, 500);
		} catch (e) {
			console.error('Failed to start WhatsApp import:', e);
			whatsappError = e instanceof Error ? e.message : 'Failed to start import';
			isWhatsappImporting = false;

			// Remove progress toast and show error
			if (whatsappImportToastId) {
				toastService.remove(whatsappImportToastId);
				whatsappImportToastId = null;
			}
			toastService.error(whatsappError);
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

	function handleClose() {
		stampsModalService.close();
	}
</script>

{#if modalState.isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="stamps-modal-title"
		tabindex="-1"
	>
		<div
			class="bg-base-100 flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<!-- Header -->
			<div class="bg-base-200 flex flex-shrink-0 items-center justify-between border-b p-4">
				<h3 id="stamps-modal-title" class="text-xl font-bold">Stamp Collections</h3>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={handleClose} aria-label="Close">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-hidden p-4">
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
										{#if isTelegramImporting && telegramImportProgress && telegramImportProgress.total > 0}
											{telegramImportProgress.completed}/{telegramImportProgress.total}
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
										{#if isWhatsappImporting && whatsappImportProgress && whatsappImportProgress.totalFiles > 0}
											{whatsappImportProgress.processedFiles}/{whatsappImportProgress.totalFiles} files
										{:else if isWhatsappImporting}
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
													<span
														class={classNames('badge badge-xs', getSourceBadgeClass(pack.source))}
													>
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
	</div>
{/if}
