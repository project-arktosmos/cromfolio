<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getStickerCollection, removeSticker } from '$services/stickers.service';
	import { getSourceCollection } from '$services/sources.service';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';

	// Extended sticker with source info and image hash
	interface StickerWithMeta extends Sticker {
		source?: Source;
		normalizedName: string;
		imageHash?: string; // Perceptual hash of the image
	}

	// Duplicate group
	interface DuplicateGroup {
		id: string;
		reason: string;
		stickers: StickerWithMeta[];
	}

	// State
	let stickers: StickerWithMeta[] = $state([]);
	let sources: Source[] = $state([]);
	let duplicateGroups: DuplicateGroup[] = $state([]);
	let isLoading = $state(false);
	let hasScanned = $state(false);

	// Image scan state
	let includeImageScan = $state(true);
	let imageScanProgress = $state({ current: 0, total: 0, phase: '' });

	// Pagination state
	const PAGE_SIZE = 20;
	let currentPage = $state(1);

	// Filter state
	let minGroupSize = $state(2);
	let filterReason = $state<string>('all');
	let searchQuery = $state('');

	// Selection state for bulk actions
	let selectedStickers = $state<Set<string>>(new Set());

	// Deletion state
	let isDeleting = $state(false);

	// Canvas for image hashing (reused for performance)
	let hashCanvas: HTMLCanvasElement | null = null;
	let hashCtx: CanvasRenderingContext2D | null = null;

	onMount(async () => {
		// Pre-load sources only
		sources = await getSourceCollection();

		// Initialize canvas for image hashing
		hashCanvas = document.createElement('canvas');
		hashCanvas.width = 9;
		hashCanvas.height = 8;
		hashCtx = hashCanvas.getContext('2d', { willReadFrequently: true });
	});

	// Compute perceptual hash (dHash) for an image
	async function computeImageHash(imageUrl: string): Promise<string | null> {
		if (!hashCanvas || !hashCtx) return null;

		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';

			const timeout = setTimeout(() => {
				resolve(null);
			}, 5000); // 5 second timeout per image

			img.onload = () => {
				clearTimeout(timeout);
				try {
					// Draw image scaled to 9x8
					hashCtx!.drawImage(img, 0, 0, 9, 8);

					// Get pixel data
					const imageData = hashCtx!.getImageData(0, 0, 9, 8);
					const pixels = imageData.data;

					// Convert to grayscale and compute dHash
					const grayscale: number[] = [];
					for (let i = 0; i < pixels.length; i += 4) {
						// Luminosity method for grayscale
						const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
						grayscale.push(gray);
					}

					// Compute difference hash (compare each pixel to its right neighbor)
					let hash = '';
					for (let row = 0; row < 8; row++) {
						for (let col = 0; col < 8; col++) {
							const idx = row * 9 + col;
							const left = grayscale[idx];
							const right = grayscale[idx + 1];
							hash += left < right ? '1' : '0';
						}
					}

					resolve(hash);
				} catch {
					resolve(null);
				}
			};

			img.onerror = () => {
				clearTimeout(timeout);
				resolve(null);
			};

			img.src = imageUrl;
		});
	}

	// Calculate Hamming distance between two hashes
	function hammingDistance(hash1: string, hash2: string): number {
		if (hash1.length !== hash2.length) return Infinity;
		let distance = 0;
		for (let i = 0; i < hash1.length; i++) {
			if (hash1[i] !== hash2[i]) distance++;
		}
		return distance;
	}

	async function scanForDuplicates() {
		isLoading = true;
		hasScanned = false;
		imageScanProgress = { current: 0, total: 0, phase: 'Loading stickers...' };

		const albumMap = new Map(sources.map((a) => [String(a.id), a]));

		// Fetch all stickers
		const stickersResult = await getStickerCollection();

		// Map stickers with source info and normalized names
		let stickersWithMeta: StickerWithMeta[] = stickersResult.map((sticker) => ({
			...sticker,
			source: albumMap.get(String(sticker.sourceId)),
			normalizedName: normalizeName(sticker.name)
		}));

		// Compute image hashes if enabled
		if (includeImageScan) {
			imageScanProgress = { current: 0, total: stickersWithMeta.length, phase: 'Computing image hashes...' };

			const BATCH_SIZE = 10;
			for (let i = 0; i < stickersWithMeta.length; i += BATCH_SIZE) {
				const batch = stickersWithMeta.slice(i, i + BATCH_SIZE);

				await Promise.all(
					batch.map(async (sticker, batchIdx) => {
						const hash = await computeImageHash(sticker.image);
						stickersWithMeta[i + batchIdx] = { ...sticker, imageHash: hash ?? undefined };
					})
				);

				imageScanProgress = {
					current: Math.min(i + BATCH_SIZE, stickersWithMeta.length),
					total: stickersWithMeta.length,
					phase: 'Computing image hashes...'
				};

				// Yield to UI
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		stickers = stickersWithMeta;
		imageScanProgress = { current: 0, total: 0, phase: 'Finding duplicates...' };

		// Find duplicates
		duplicateGroups = findDuplicates(stickers);
		currentPage = 1;
		hasScanned = true;
		isLoading = false;
	}

	// Normalize name for comparison
	function normalizeName(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Calculate similarity between two strings (Jaccard index on words)
	function calculateSimilarity(a: string, b: string): number {
		const wordsA = new Set(a.split(' ').filter((w) => w.length > 1));
		const wordsB = new Set(b.split(' ').filter((w) => w.length > 1));

		if (wordsA.size === 0 && wordsB.size === 0) return 1;
		if (wordsA.size === 0 || wordsB.size === 0) return 0;

		const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
		const union = new Set([...wordsA, ...wordsB]);

		return intersection.size / union.size;
	}

	// Find duplicate groups
	function findDuplicates(stickers: StickerWithMeta[]): DuplicateGroup[] {
		const groups: DuplicateGroup[] = [];
		const processedPairs = new Set<string>();

		// 1. Group by exact normalized name
		const byName = new Map<string, StickerWithMeta[]>();
		for (const t of stickers) {
			const existing = byName.get(t.normalizedName) || [];
			existing.push(t);
			byName.set(t.normalizedName, existing);
		}

		for (const [name, group] of byName) {
			if (group.length >= 2) {
				const ids = group.map((t) => String(t.id)).sort().join(',');
				if (!processedPairs.has(ids)) {
					processedPairs.add(ids);
					groups.push({
						id: `exact-${name}`,
						reason: 'Exact name match',
						stickers: group
					});
				}
			}
		}

		// 2. Group by source + similar name (>70% similarity)
		const byAlbum = new Map<string, StickerWithMeta[]>();
		for (const t of stickers) {
			if (t.sourceId) {
				const key = String(t.sourceId);
				const existing = byAlbum.get(key) || [];
				existing.push(t);
				byAlbum.set(key, existing);
			}
		}

		for (const [, albumStickers] of byAlbum) {
			for (let i = 0; i < albumStickers.length; i++) {
				for (let j = i + 1; j < albumStickers.length; j++) {
					const a = albumStickers[i];
					const b = albumStickers[j];
					const similarity = calculateSimilarity(a.normalizedName, b.normalizedName);

					if (similarity >= 0.7 && similarity < 1) {
						const ids = [String(a.id), String(b.id)].sort().join(',');
						if (!processedPairs.has(ids)) {
							processedPairs.add(ids);
							groups.push({
								id: `similar-source-${ids}`,
								reason: `Similar names in same source (${Math.round(similarity * 100)}%)`,
								stickers: [a, b]
							});
						}
					}
				}
			}
		}

		// 3. Group by similar images + similar names (if image hashing was performed)
		// Both criteria must match to reduce false positives
		if (includeImageScan) {
			const stickersWithHash = stickers.filter((t) => t.imageHash);
			const IMAGE_SIMILARITY_THRESHOLD = 10; // Can be more lenient since we require name match too
			const NAME_SIMILARITY_THRESHOLD = 0.4; // At least 40% name similarity

			// Compare all stickers with hashes
			for (let i = 0; i < stickersWithHash.length; i++) {
				for (let j = i + 1; j < stickersWithHash.length; j++) {
					const a = stickersWithHash[i];
					const b = stickersWithHash[j];

					const ids = [String(a.id), String(b.id)].sort().join(',');
					if (processedPairs.has(ids)) continue;

					// Check image similarity
					const imageDistance = hammingDistance(a.imageHash!, b.imageHash!);
					if (imageDistance > IMAGE_SIMILARITY_THRESHOLD) continue;

					// Check name similarity
					const nameSimilarity = calculateSimilarity(a.normalizedName, b.normalizedName);
					if (nameSimilarity < NAME_SIMILARITY_THRESHOLD) continue;

					// Both criteria met
					processedPairs.add(ids);
					const imageSimilarityPercent = Math.round((1 - imageDistance / 64) * 100);
					const nameSimilarityPercent = Math.round(nameSimilarity * 100);
					groups.push({
						id: `image-${ids}`,
						reason: `Similar images (${imageSimilarityPercent}%) + names (${nameSimilarityPercent}%)`,
						stickers: [a, b]
					});
				}
			}
		}

		// Sort by group size (largest first)
		return groups.sort((a, b) => b.stickers.length - a.stickers.length);
	}

	// Filtered groups based on UI filters
	let filteredGroups = $derived.by(() => {
		return duplicateGroups.filter((group) => {
			if (group.stickers.length < minGroupSize) return false;

			if (filterReason !== 'all') {
				if (filterReason === 'exact' && !group.reason.includes('Exact')) return false;
				if (filterReason === 'similar' && !group.reason.includes('Similar names')) return false;
				if (filterReason === 'image' && !group.reason.includes('Similar images')) return false;
			}

			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const matchesName = group.stickers.some((t) => t.name.toLowerCase().includes(query));
				const matchesAlbum = group.stickers.some((t) => t.source?.title.toLowerCase().includes(query));
				if (!matchesName && !matchesAlbum) return false;
			}

			return true;
		});
	});

	// Paginated groups
	let paginatedGroups = $derived.by(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		const end = start + PAGE_SIZE;
		return filteredGroups.slice(start, end);
	});

	// Total pages
	let totalPages = $derived(Math.ceil(filteredGroups.length / PAGE_SIZE));

	// Unique reasons for filter dropdown
	let uniqueReasons = $derived.by(() => {
		const reasons = new Set<string>();
		for (const group of duplicateGroups) {
			if (group.reason.includes('Exact')) reasons.add('exact');
			else if (group.reason.includes('Similar names')) reasons.add('similar');
			else if (group.reason.includes('Similar images')) reasons.add('image');
		}
		return [...reasons];
	});

	// Reset to page 1 when filters change
	$effect(() => {
		minGroupSize;
		filterReason;
		searchQuery;
		currentPage = 1;
	});

	function toggleSelection(stickerId: string) {
		const newSelection = new Set(selectedStickers);
		if (newSelection.has(stickerId)) {
			newSelection.delete(stickerId);
		} else {
			newSelection.add(stickerId);
		}
		selectedStickers = newSelection;
	}

	function selectDuplicatesInGroup(group: DuplicateGroup) {
		const newSelection = new Set(selectedStickers);
		group.stickers.slice(1).forEach((t) => newSelection.add(String(t.id)));
		selectedStickers = newSelection;
	}

	function clearSelection() {
		selectedStickers = new Set();
	}

	async function deleteSelected() {
		if (selectedStickers.size === 0) return;
		if (!confirm(`Delete ${selectedStickers.size} selected sticker(s)?`)) return;

		isDeleting = true;

		for (const id of selectedStickers) {
			const sticker = stickers.find((t) => String(t.id) === id);
			if (sticker) {
				await removeSticker(sticker);
			}
		}

		const deletedIds = selectedStickers;
		stickers = stickers.filter((t) => !deletedIds.has(String(t.id)));
		duplicateGroups = findDuplicates(stickers);
		selectedStickers = new Set();
		isDeleting = false;
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	function getAlbumTypeBadgeClass(sourceType?: string): string {
		if (!sourceType) return 'badge-ghost';
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

	function getReasonBadgeClass(reason: string): string {
		if (reason.includes('Exact')) return 'badge-error';
		if (reason.includes('Similar names')) return 'badge-warning';
		if (reason.includes('Similar images')) return 'badge-info';
		return 'badge-ghost';
	}
</script>

<div class="flex flex-col h-full gap-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Duplicate Detection</h1>

		<div class="flex items-center gap-2">
			{#if selectedStickers.size > 0}
				<span class="text-sm text-base-content/70">{selectedStickers.size} selected</span>
				<button class="btn btn-ghost btn-sm" onclick={clearSelection} disabled={isDeleting}>
					Clear
				</button>
				<button class="btn btn-error btn-sm" onclick={deleteSelected} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Delete Selected
				</button>
			{/if}

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					class="checkbox checkbox-sm checkbox-primary"
					bind:checked={includeImageScan}
					disabled={isLoading}
				/>
				<span class="text-sm">Image scan</span>
			</label>

			<button
				class="btn btn-primary btn-sm"
				onclick={scanForDuplicates}
				disabled={isLoading}
			>
				{#if isLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				{hasScanned ? 'Rescan' : 'Scan for Duplicates'}
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex flex-col items-center justify-center flex-1 gap-4">
			<span class="loading loading-spinner loading-lg"></span>
			<div class="text-center">
				<p class="text-base-content/70">{imageScanProgress.phase}</p>
				{#if imageScanProgress.total > 0}
					<p class="text-sm text-base-content/50 mt-1">
						{imageScanProgress.current} / {imageScanProgress.total}
					</p>
					<progress
						class="progress progress-primary w-56 mt-2"
						value={imageScanProgress.current}
						max={imageScanProgress.total}
					></progress>
				{/if}
			</div>
		</div>
	{:else if !hasScanned}
		<div class="flex flex-col items-center justify-center flex-1 gap-4">
			<div class="text-center">
				<p class="text-lg text-base-content/70 mb-2">Click "Scan for Duplicates" to analyze your sticker library</p>
				<p class="text-sm text-base-content/50">
					Checks for: exact name matches, similar names in same source{includeImageScan ? ', and visually similar images' : ''}.
				</p>
				{#if includeImageScan}
					<p class="text-xs text-base-content/40 mt-2">
						Image scanning uses perceptual hashing to detect similar images regardless of size or minor edits.
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Filters -->
		<div class="card bg-base-200 p-4">
			<div class="flex flex-wrap gap-4 items-center">
				<div class="form-control">
					<label class="label py-0">
						<span class="label-text text-xs">Search</span>
					</label>
					<input
						type="text"
						class="input input-bordered input-sm w-48"
						placeholder="Search by name or source..."
						bind:value={searchQuery}
					/>
				</div>

				<div class="form-control">
					<label class="label py-0">
						<span class="label-text text-xs">Duplicate Type</span>
					</label>
					<select class="select select-bordered select-sm" bind:value={filterReason}>
						<option value="all">All types</option>
						{#if uniqueReasons.includes('exact')}
							<option value="exact">Exact name matches</option>
						{/if}
						{#if uniqueReasons.includes('similar')}
							<option value="similar">Similar names</option>
						{/if}
						{#if uniqueReasons.includes('image')}
							<option value="image">Similar images</option>
						{/if}
					</select>
				</div>

				<div class="form-control">
					<label class="label py-0">
						<span class="label-text text-xs">Min Group Size</span>
					</label>
					<select class="select select-bordered select-sm" bind:value={minGroupSize}>
						<option value={2}>2+</option>
						<option value={3}>3+</option>
						<option value={4}>4+</option>
						<option value={5}>5+</option>
					</select>
				</div>

				<div class="flex-1"></div>

				<div class="stats stats-horizontal shadow bg-base-100">
					<div class="stat py-2 px-4">
						<div class="stat-title text-xs">Total Stickers</div>
						<div class="stat-value text-lg">{stickers.length}</div>
					</div>
					<div class="stat py-2 px-4">
						<div class="stat-title text-xs">Duplicate Groups</div>
						<div class="stat-value text-lg">{filteredGroups.length}</div>
					</div>
					<div class="stat py-2 px-4">
						<div class="stat-title text-xs">Potential Duplicates</div>
						<div class="stat-value text-lg text-warning">
							{filteredGroups.reduce((acc, g) => acc + g.stickers.length - 1, 0)}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Duplicate Groups -->
		<div class="flex-1 overflow-y-auto">
			{#if filteredGroups.length === 0}
				<div class="card bg-base-200 p-8 text-center">
					<p class="text-base-content/60">
						{#if duplicateGroups.length === 0}
							No duplicates found. Your sticker library is clean!
						{:else}
							No duplicates match the current filters.
						{/if}
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					{#each paginatedGroups as group (group.id)}
						<div class="card bg-base-200">
							<div class="card-body p-4">
								<div class="flex items-center justify-between mb-3">
									<div class="flex items-center gap-3">
										<span class={classNames('badge', getReasonBadgeClass(group.reason))}>
											{group.stickers.length} items
										</span>
										<span class="text-sm text-base-content/70">{group.reason}</span>
									</div>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => selectDuplicatesInGroup(group)}
										title="Select all except first"
									>
										Select duplicates
									</button>
								</div>

								<div class="flex flex-wrap gap-3">
									{#each group.stickers as sticker, idx (sticker.id)}
										{@const isSelected = selectedStickers.has(String(sticker.id))}
										<div
											class={classNames(
												'flex gap-3 p-3 rounded-lg bg-base-100 w-80 transition-all cursor-pointer',
												{
													'ring-2 ring-primary': isSelected,
													'ring-2 ring-success': idx === 0 && !isSelected,
													'hover:ring-2 hover:ring-base-content/20': !isSelected && idx !== 0
												}
											)}
											onclick={() => toggleSelection(String(sticker.id))}
											onkeydown={(e) => e.key === 'Enter' && toggleSelection(String(sticker.id))}
											role="button"
											tabindex="0"
										>
											<!-- Checkbox -->
											<div class="flex items-start pt-1">
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={isSelected}
													onclick={(e) => e.stopPropagation()}
													onchange={() => toggleSelection(String(sticker.id))}
												/>
											</div>

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
												<div class="flex items-center gap-2">
													<span class="font-medium text-sm truncate">{sticker.name}</span>
													{#if idx === 0}
														<span class="badge badge-success badge-xs">Keep</span>
													{/if}
												</div>

												{#if sticker.source}
													<div class="flex items-center gap-1">
														<span
															class={classNames(
																'badge badge-xs',
																getAlbumTypeBadgeClass(sticker.source.sourceType)
															)}
														>
															{sticker.source.title}
														</span>
													</div>
												{/if}

												<div class="text-xs text-base-content/40 mt-1">
													ID: {sticker.id}
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex justify-center items-center gap-2 mt-4 pb-4">
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => goToPage(1)}
							disabled={currentPage === 1}
						>
							&laquo;
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
						>
							&lsaquo;
						</button>

						<span class="text-sm px-4">
							Page {currentPage} of {totalPages}
						</span>

						<button
							class="btn btn-sm btn-ghost"
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
						>
							&rsaquo;
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => goToPage(totalPages)}
							disabled={currentPage === totalPages}
						>
							&raquo;
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
