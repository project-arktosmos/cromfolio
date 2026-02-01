<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import JSZip from 'jszip';
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

	interface DisplayStamp extends Stamp {
		dataUrl?: string;
	}

	interface DisplayPack extends StampPack {
		trayDataUrl?: string;
	}

	let packs: DisplayPack[] = $state([]);
	let isLoading = $state(true);
	let isImporting = $state(false);
	let error = $state<string | null>(null);
	let selectedPack = $state<DisplayPack | null>(null);
	let packStamps: DisplayStamp[] = $state([]);
	let isLoadingStamps = $state(false);
	let stampsDataDir = $state('');

	onMount(async () => {
		try {
			stampsDataDir = await getStampsDataDir();
			const dbPacks = await getStampPacksBySource('whatsapp');
			packs = dbPacks;
		} catch (e) {
			console.error('Failed to load packs:', e);
			error = 'Failed to load saved packs';
		} finally {
			isLoading = false;
		}
	});

	async function loadPackStamps(pack: DisplayPack) {
		isLoadingStamps = true;
		try {
			const stamps = await getStampsByPack(pack.id);
			packStamps = stamps.map((s) => ({
				...s,
				dataUrl: convertFileSrc(`${stampsDataDir}/${s.imagePath}`)
			}));
		} catch (e) {
			console.error('Failed to load stamps:', e);
			packStamps = [];
		} finally {
			isLoadingStamps = false;
		}
	}

	async function selectPack(pack: DisplayPack) {
		if (selectedPack?.id === pack.id) {
			return;
		}
		selectedPack = pack;
		await loadPackStamps(pack);
	}

	async function handleSelectFile() {
		error = null;
		isImporting = true;

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
				isImporting = false;
				return;
			}

			const files = Array.isArray(selected) ? selected : [selected];

			for (const filePath of files) {
				try {
					await importWastickersFile(filePath);
				} catch (e) {
					console.error(`Failed to import ${filePath}:`, e);
					error = `Failed to import: ${e instanceof Error ? e.message : 'Unknown error'}`;
				}
			}
		} catch (e) {
			console.error('Failed to open file picker:', e);
			error = e instanceof Error ? e.message : 'Failed to open file picker';
		} finally {
			isImporting = false;
		}
	}

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

		packs = [...packs, createdPack];

		if (!selectedPack) {
			selectedPack = createdPack;
			await loadPackStamps(createdPack);
		}
	}

	async function handleDeletePack(pack: DisplayPack, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm(`Delete sticker pack "${pack.name}"? This will remove all stickers and files.`)) {
			return;
		}

		try {
			await deleteStampPackFiles(pack.id);
			await deleteStampPack(pack.id);

			packs = packs.filter((p) => p.id !== pack.id);

			if (selectedPack?.id === pack.id) {
				selectedPack = packs.length > 0 ? packs[0] : null;
				if (selectedPack) {
					await loadPackStamps(selectedPack);
				} else {
					packStamps = [];
				}
			}
		} catch (e) {
			console.error('Failed to delete pack:', e);
			error = 'Failed to delete pack';
		}
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<div class="flex items-center justify-between mb-4 flex-shrink-0">
		<h1 class="text-2xl font-bold">WhatsApp Stickers</h1>
		<button class="btn btn-primary btn-sm" onclick={handleSelectFile} disabled={isImporting}>
			{#if isImporting}
				<span class="loading loading-spinner loading-xs"></span>
				Importing...
			{:else}
				Import .wastickers
			{/if}
		</button>
	</div>

	{#if error}
		<div class="alert alert-error mb-4 flex-shrink-0">
			<span>{error}</span>
			<button class="btn btn-ghost btn-xs" onclick={() => (error = null)}>Dismiss</button>
		</div>
	{/if}

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
		<!-- Column 1: Pack List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">Saved Packs</h2>

				<div class="flex-1 overflow-y-auto space-y-2">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if packs.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No packs imported yet.</p>
							<p class="text-sm mt-1">Click "Import .wastickers" to add a sticker pack.</p>
						</div>
					{:else}
						{#each packs as pack (pack.id)}
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
								<div class="flex items-center gap-3">
									{#if pack.trayImage}
										<img
											src={convertFileSrc(`${stampsDataDir}/${pack.trayImage}`)}
											alt={pack.name}
											class="w-12 h-12 object-contain rounded"
										/>
									{:else}
										<div
											class="w-12 h-12 bg-base-300 rounded flex items-center justify-center text-2xl"
										>
											📦
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate">{pack.name}</div>
										<div class="text-sm text-base-content/60 truncate">
											{pack.author}
										</div>
										<span class="badge badge-ghost badge-xs">
											{pack.stickerCount} stickers
										</span>
									</div>
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={(e) => handleDeletePack(pack, e)}
										title="Delete pack"
									>
										×
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
					{packs.length} pack{packs.length !== 1 ? 's' : ''} saved
				</div>
			</div>
		</div>

		<!-- Column 2: Pack Details -->
		<div class="card bg-base-200 overflow-hidden flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col min-h-0">
				<h2 class="card-title text-lg mb-2">Pack Details</h2>

				{#if !selectedPack}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a pack to view details</p>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto space-y-4">
						<div class="flex items-center gap-4">
							{#if selectedPack.trayImage}
								<img
									src={convertFileSrc(`${stampsDataDir}/${selectedPack.trayImage}`)}
									alt={selectedPack.name}
									class="w-24 h-24 object-contain rounded bg-base-100 p-2"
								/>
							{:else}
								<div
									class="w-24 h-24 bg-base-100 rounded flex items-center justify-center text-4xl"
								>
									📦
								</div>
							{/if}
							<div>
								<h3 class="font-bold text-lg">{selectedPack.name}</h3>
								<p class="text-base-content/60">{selectedPack.author}</p>
							</div>
						</div>

						<div class="divider my-2"></div>

						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Source:</span>
								<span class="badge badge-success badge-sm">WhatsApp</span>
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
					</div>
				{/if}
			</div>
		</div>

		<!-- Column 3: Stickers Grid -->
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
						<div class="grid grid-cols-3 gap-2">
							{#each packStamps as stamp, index (stamp.id)}
								<div class="relative group">
									<div
										class="bg-base-100 rounded p-1 aspect-square flex items-center justify-center"
									>
										<img
											src={stamp.dataUrl}
											alt="Sticker {index + 1}"
											class="max-w-full max-h-full object-contain"
											loading="lazy"
										/>
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
