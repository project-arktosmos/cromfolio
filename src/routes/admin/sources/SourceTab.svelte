<script lang="ts">
	import classNames from 'classnames';
	import { addSource } from '$services/sources.service';
	import { addStickersBatch } from '$services/stickers.service';
	import { providerExists, createProvider } from '$services/providers.service';
	import { toastService } from '$services/toast.service';
	import { findOrCreateTag, addTagToSticker } from '$services/tags.service';
	import {
		fetchSourceImages,
		getContentDetails,
		type ImageItem as FetchImageItem,
		type CharacterItem as FetchCharacterItem,
		type FetchProgressEvent,
		type FetchStatus,
		type ContentDetails
	} from '$services/fetch.service';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type {
		SourceTabConfig,
		SelectableImageItem,
		SelectableCharacterItem
	} from './sources.types';

	// Helper to create a mock StickerTypeEntity for preview
	function createStickerTypeEntity(typeId: string): StickerTypeEntity {
		const name = typeId.charAt(0).toUpperCase() + typeId.slice(1).replace(/-/g, ' ');
		return {
			id: typeId,
			name,
			description: '',
			category: 'Generic',
			badgeColor: 'badge-ghost',
			sortOrder: 0
		};
	}

	// Source type options (must match parent page)
	const sourceTypeOptions = [
		{ value: 'movies', label: 'Movies' },
		{ value: 'tv', label: 'TV Series' },
		{ value: 'videogames', label: 'Videogames' },
		{ value: 'anime', label: 'Anime' },
		{ value: 'sports', label: 'Sports' },
		{ value: 'animals', label: 'Animals' },
		{ value: 'awards', label: 'Award Lists' },
		{ value: 'grammy', label: 'Grammy Awards' },
		{ value: 'game-consoles', label: 'Game Consoles' }
	] as const;

	type SourceType = (typeof sourceTypeOptions)[number]['value'];

	// Props
	type TResult = $$Generic;
	let {
		config,
		sourceType,
		onSourceTypeChange
	}: {
		config: SourceTabConfig<TResult>;
		sourceType: SourceType;
		onSourceTypeChange: (type: SourceType) => void;
	} = $props();

	// Search state
	let searchQuery = $state('');
	let searchYear = $state('');
	let searchResults = $state<TResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedResult = $state<TResult | null>(null);

	// Image fetching state with progress
	let isLoadingImages = $state(false);
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());
	let imagesBySource = $state<Map<string, SelectableImageItem[]>>(new Map());
	let characterImages = $state<SelectableCharacterItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);
	let imageTab = $state<string>(config.imageSourceTabs[0]?.key ?? '');

	// Source creation state
	let isCreatingSource = $state(false);
	let sourceCreated = $state<Source | null>(null);
	let stickersCreated = $state<number>(0);

	// Selected sticker for details view (separate from selection for source)
	let selectedStickerForDetails = $state<SelectableImageItem | SelectableCharacterItem | null>(null);

	// Content details state
	let contentDetails = $state<ContentDetails | null>(null);
	let isLoadingDetails = $state(false);
	let detailsError = $state<string | null>(null);

	// Source existence tracking
	let providerExistsMap = $state<Map<string, boolean>>(new Map());

	// Language code to name mapping
	const languageNames: Record<string, string> = {
		en: 'English',
		pt: 'Portuguese',
		es: 'Spanish',
		de: 'German',
		fr: 'French',
		it: 'Italian',
		ja: 'Japanese',
		ko: 'Korean',
		zh: 'Chinese',
		ru: 'Russian',
		ar: 'Arabic',
		hi: 'Hindi',
		nl: 'Dutch',
		pl: 'Polish',
		sv: 'Swedish',
		da: 'Danish',
		no: 'Norwegian',
		fi: 'Finnish',
		tr: 'Turkish',
		th: 'Thai',
		vi: 'Vietnamese',
		id: 'Indonesian',
		he: 'Hebrew',
		cs: 'Czech',
		hu: 'Hungarian',
		ro: 'Romanian',
		uk: 'Ukrainian',
		el: 'Greek',
		bg: 'Bulgarian',
		hr: 'Croatian',
		sk: 'Slovak',
		sl: 'Slovenian',
		lt: 'Lithuanian',
		lv: 'Latvian',
		et: 'Estonian',
		ms: 'Malay',
		tl: 'Filipino'
	};

	function getLanguageName(code: string | undefined): string | null {
		if (!code) return null;
		return languageNames[code.toLowerCase()] || code.toUpperCase();
	}

	function capitalizeType(type: string): string {
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function formatTemplateName(title: string, imageType: string, language?: string): string {
		const langName = getLanguageName(language);
		const typeName = capitalizeType(imageType);
		return langName ? `${title} - ${langName} ${typeName}` : `${title} - ${typeName}`;
	}

	// Search function
	async function search() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];
		selectedResult = null;
		resetImages();

		try {
			const results = await config.searchFunction(
				searchQuery.trim(),
				config.showYearFilter ? searchYear.trim() || undefined : undefined
			);

			// Deduplicate by unique key
			const seen = new Set<string>();
			searchResults = results.filter((result) => {
				const key = config.getUniqueKey(result);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});

			if (searchResults.length === 0) {
				searchError = 'No results found';
			}
		} catch (error) {
			searchError = error instanceof Error ? error.message : 'Search failed';
			console.error('[sources] search error:', error);
		} finally {
			isSearching = false;
		}
	}

	function resetImages() {
		imagesBySource = new Map();
		characterImages = [];
		selectedCoverImage = null;
		stickersCreated = 0;
		fetchProgress = new Map();
		selectedStickerForDetails = null;
	}

	async function selectResult(result: TResult) {
		const resultId = config.getId(result);
		const selectedId = selectedResult ? config.getId(selectedResult) : null;

		if (selectedId === resultId) {
			selectedResult = null;
			resetImages();
			contentDetails = null;
			detailsError = null;
		} else {
			selectedResult = result;
			sourceCreated = null;
			selectedCoverImage = config.getPoster(result) || null;
			contentDetails = null;
			detailsError = null;
			await Promise.all([
				checkSourceExists(resultId),
				fetchAllImages(resultId),
				fetchDetails(resultId)
			]);
		}
	}

	async function fetchDetails(externalId: string) {
		// Only fetch details for movie/tv content types that use IMDB IDs
		if (config.externalIdType !== 'imdb') {
			return;
		}

		isLoadingDetails = true;
		detailsError = null;

		try {
			contentDetails = await getContentDetails(externalId);
		} catch (error) {
			console.error('[sources] fetchDetails error:', error);
			detailsError = error instanceof Error ? error.message : 'Failed to fetch details';
		} finally {
			isLoadingDetails = false;
		}
	}

	function handleProgress(event: FetchProgressEvent) {
		fetchProgress.set(event.source, {
			status: event.status,
			message: event.message
		});
		fetchProgress = new Map(fetchProgress);
	}

	async function fetchAllImages(externalId: string) {
		isLoadingImages = true;
		const preservedCoverImage = selectedCoverImage;
		resetImages();
		selectedCoverImage = preservedCoverImage;

		// Initialize progress for all sources
		for (const source of config.progressSources) {
			fetchProgress.set(source, { status: 'pending' });
		}
		fetchProgress = new Map(fetchProgress);

		try {
			const result = await fetchSourceImages({
				contentType: config.contentType,
				externalId,
				externalIdType: config.externalIdType,
				sources: config.imageSources,
				onProgress: handleProgress
			});

			// Group images by source
			const newImagesBySource = new Map<string, SelectableImageItem[]>();
			for (const tab of config.imageSourceTabs) {
				if (tab.key !== 'characters') {
					const sourceImages = result.images
						.filter((img) => img.source === tab.key)
						.map((img) => ({ ...img, selected: true }));
					newImagesBySource.set(tab.key, sourceImages);
				}
			}
			imagesBySource = newImagesBySource;

			// Process characters if enabled
			if (config.showCharacters) {
				characterImages = result.characters.map((char) => ({
					...char,
					character: char.characterName || '',
					selected: true
				}));
			}

			// Log any failed sources
			for (const failed of result.sourcesFailed) {
				console.warn(`[sources] ${failed.source} failed:`, failed.error);
			}
		} catch (error) {
			console.error('[sources] fetchAllImages error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			toastService.error(`Failed to fetch images: ${errorMessage}`);
		} finally {
			isLoadingImages = false;
		}
	}

	async function checkSourceExists(externalId: string): Promise<boolean> {
		if (providerExistsMap.has(externalId)) {
			return providerExistsMap.get(externalId) ?? false;
		}
		const exists = await providerExists(config.externalIdType, externalId);
		providerExistsMap.set(externalId, exists);
		providerExistsMap = new Map(providerExistsMap);
		return exists;
	}

	function isSourceAdded(externalId: string): boolean {
		return providerExistsMap.get(externalId) ?? false;
	}

	async function createAlbumAndTemplates() {
		if (!selectedResult) return;

		const externalId = config.getId(selectedResult);
		isCreatingSource = true;
		stickersCreated = 0;

		try {
			const exists = await providerExists(config.externalIdType, externalId);
			if (exists) {
				toastService.warning(`This ${config.sourceType} has already been added`);
				isCreatingSource = false;
				return;
			}

			const sourceData = config.buildSource(selectedResult, selectedCoverImage || undefined);
			const source: Source = {
				...sourceData,
				id: crypto.randomUUID(),
				addedAt: new Date().toISOString()
			};

			const createdSource = await addSource(source);
			if (createdSource) {
				// Create provider entry to prevent duplicates
				await createProvider(
					createdSource.id,
					config.providerType,
					config.externalIdType,
					externalId
				);
				sourceCreated = createdSource;

				const title = config.getTitle(selectedResult);
				const now = new Date().toISOString();

				// Normalize sticker type to match database sticker_types table
				// Strips trailing numbers (e.g., "poster1" -> "poster")
				const normalizeStickerType = (type: string): string => {
					return type.replace(/\d+$/, '');
				};

				// Build all stickers first, tracking metadata for tagging
				const stickersToCreate: Sticker[] = [];
				const stickerMetadataMap = new Map<string, SelectableImageItem | SelectableCharacterItem>();

				// Add stickers from all image sources
				for (const [source, images] of imagesBySource) {
					for (const image of images.filter((img) => img.selected)) {
						const stickerId = crypto.randomUUID();
						stickersToCreate.push({
							id: stickerId,
							sourceId: createdSource.id,
							name: formatTemplateName(title, image.imageType, image.language),
							image: image.url,
							stickerTypeId: normalizeStickerType(image.imageType),
							imageSource: source,
							width: image.width,
							height: image.height,
							addedAt: now
						});
						stickerMetadataMap.set(stickerId, image);
					}
				}

				// Add character stickers if enabled
				if (config.showCharacters) {
					for (const character of characterImages.filter((img) => img.selected)) {
						const stickerId = crypto.randomUUID();
						stickersToCreate.push({
							id: stickerId,
							sourceId: createdSource.id,
							name: character.name
								? `${character.name} as ${character.character}`
								: character.character || 'Character',
							image: character.profileUrl,
							stickerTypeId: character.isActorHeadshot ? 'cast' : 'character',
							imageSource: character.source,
							addedAt: now
						});
						stickerMetadataMap.set(stickerId, character);
					}
				}

				// Batch insert all stickers (all or nothing)
				if (stickersToCreate.length > 0) {
					const createdStickers = await addStickersBatch(stickersToCreate);
					stickersCreated = createdStickers.length;

					// Create tags for each sticker based on metadata
					for (const sticker of createdStickers) {
						const metadata = stickerMetadataMap.get(String(sticker.id));
						if (metadata) {
							const tags = getPreviewTags(metadata);
							for (const tagData of tags) {
								const tag = await findOrCreateTag(tagData.key, tagData.value);
								if (tag) {
									await addTagToSticker(sticker.id, tag.id);
								}
							}
						}
					}
				}

				providerExistsMap.set(externalId, true);
				providerExistsMap = new Map(providerExistsMap);
			}
		} catch (error) {
			console.error('[sources] createAlbumAndTemplates error:', error);
			toastService.error('Failed to create source and stickers');
		} finally {
			isCreatingSource = false;
		}
	}

	function resetSearch() {
		searchQuery = '';
		searchYear = '';
		searchResults = [];
		searchError = null;
		selectedResult = null;
		sourceCreated = null;
		resetImages();
	}

	function getCurrentImages(): SelectableImageItem[] {
		if (imageTab === 'characters') return [];
		return imagesBySource.get(imageTab) || [];
	}

	function getTmdbCastCharacters(): SelectableCharacterItem[] {
		return characterImages.filter((c) => c.source === 'tmdb-cast');
	}

	function getImageCount(source: string): number {
		if (source === 'characters') return characterImages.length;
		if (source === 'tmdb-cast') return getTmdbCastCharacters().length;
		return (imagesBySource.get(source) || []).length;
	}

	function getSelectedCount(source: string): number {
		if (source === 'characters') return characterImages.filter((img) => img.selected).length;
		if (source === 'tmdb-cast') return getTmdbCastCharacters().filter((img) => img.selected).length;
		return (imagesBySource.get(source) || []).filter((img) => img.selected).length;
	}

	function getTotalSelectedCount(): number {
		let total = 0;
		for (const images of imagesBySource.values()) {
			total += images.filter((img) => img.selected).length;
		}
		if (config.showCharacters) {
			total += characterImages.filter((img) => img.selected).length;
		}
		return total;
	}

	function toggleImage(image: SelectableImageItem) {
		image.selected = !image.selected;
		// Trigger reactivity
		imagesBySource = new Map(imagesBySource);
	}

	function toggleCharacter(character: SelectableCharacterItem) {
		character.selected = !character.selected;
		characterImages = [...characterImages];
	}

	function selectTemplateForDetails(item: SelectableImageItem | SelectableCharacterItem) {
		selectedStickerForDetails = item;
	}

	function toggleAllImages(selected: boolean) {
		if (imageTab === 'characters') {
			characterImages = characterImages.map((img) => ({ ...img, selected }));
		} else if (imageTab === 'tmdb-cast') {
			// Only toggle TMDB cast characters
			characterImages = characterImages.map((img) =>
				img.source === 'tmdb-cast' ? { ...img, selected } : img
			);
		} else {
			const images = imagesBySource.get(imageTab);
			if (images) {
				imagesBySource.set(
					imageTab,
					images.map((img) => ({ ...img, selected }))
				);
				imagesBySource = new Map(imagesBySource);
			}
		}
	}

	function getSourceStatusClass(source: string): string {
		const progress = fetchProgress.get(source);
		if (!progress) return '';
		switch (progress.status) {
			case 'pending':
				return 'text-base-content/50';
			case 'fetching':
				return 'text-info';
			case 'success':
				return 'text-success';
			case 'failed':
				return 'text-error';
			default:
				return '';
		}
	}

	function getSourceStatusIcon(source: string): string {
		const progress = fetchProgress.get(source);
		if (!progress) return '';
		switch (progress.status) {
			case 'pending':
				return '...';
			case 'fetching':
				return '...';
			case 'success':
				return '✓';
			case 'failed':
				return '✗';
			default:
				return '';
		}
	}

	// Generate preview tags from card metadata
	function getPreviewTags(card: SelectableImageItem | SelectableCharacterItem): { key: string; value: string }[] {
		const tags: { key: string; value: string }[] = [];

		if ('characterName' in card || 'character' in card) {
			// Character card
			const char = card as SelectableCharacterItem;
			tags.push({ key: 'source', value: char.source });
			tags.push({ key: 'type', value: char.isActorHeadshot ? 'cast' : 'character' });
			if (char.name) {
				tags.push({ key: 'actor', value: char.name });
			}
			if (char.character || char.characterName) {
				tags.push({ key: 'character', value: char.character || char.characterName || '' });
			}
		} else {
			// Image card
			const img = card as SelectableImageItem;
			tags.push({ key: 'source', value: img.source });
			tags.push({ key: 'type', value: img.imageType });
			if (img.language) {
				tags.push({ key: 'language', value: img.language });
			}
			if (img.width && img.height) {
				// Categorize by aspect ratio
				const ratio = img.width / img.height;
				let aspect = 'square';
				if (ratio > 1.5) aspect = 'landscape';
				else if (ratio < 0.75) aspect = 'portrait';
				tags.push({ key: 'aspect', value: aspect });
				// Categorize by resolution
				const pixels = img.width * img.height;
				let resolution = 'low';
				if (pixels >= 2073600) resolution = 'hd'; // 1920x1080
				else if (pixels >= 921600) resolution = 'medium'; // 1280x720
				tags.push({ key: 'resolution', value: resolution });
			}
		}

		return tags;
	}
</script>

<div class="grid grid-cols-5 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="form-control mb-3">
				<select
					class="select select-bordered select-sm w-full"
					value={sourceType}
					onchange={(e) => onSourceTypeChange(e.currentTarget.value as SourceType)}
				>
					{#each sourceTypeOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="flex-1 overflow-y-auto">
				<div class="space-y-3">
					<div class="form-control">
						<input
							type="text"
							placeholder={config.searchPlaceholder}
							class="input input-bordered input-sm w-full"
							bind:value={searchQuery}
							onkeydown={(e) => e.key === 'Enter' && search()}
						/>
					</div>

					<div class="flex gap-2">
						{#if config.showYearFilter}
							<input
								type="text"
								placeholder="Year"
								class="input input-bordered input-xs w-20"
								bind:value={searchYear}
							/>
						{/if}

						<button
							class="btn btn-primary btn-xs flex-1"
							onclick={search}
							disabled={!searchQuery.trim() || isSearching}
						>
							{#if isSearching}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Search
							{/if}
						</button>
					</div>

					{#if searchResults.length > 0}
						<button class="btn btn-ghost btn-xs" onclick={resetSearch}>Clear</button>
					{/if}
				</div>

				{#if searchError}
					<div class="alert alert-error alert-sm mt-3">
						<span class="text-sm">{searchError}</span>
					</div>
				{/if}

				{#if searchResults.length > 0}
					<div class="mt-3 space-y-2">
						{#each searchResults as result (config.getUniqueKey(result))}
							{@const resultId = config.getId(result)}
							{@const alreadyExists = isSourceAdded(resultId)}
							{@const isSelected = selectedResult && config.getId(selectedResult) === resultId}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': isSelected,
										'bg-base-100': !isSelected
									}
								)}
								onclick={() => selectResult(result)}
								onkeydown={(e) => e.key === 'Enter' && selectResult(result)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if config.getPoster(result)}
										<img
											src={config.getPoster(result)}
											alt={config.getTitle(result)}
											class="w-10 h-14 object-cover rounded"
										/>
									{:else}
										<div
											class="w-10 h-14 bg-base-300 rounded flex items-center justify-center text-base-content/30"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
												/>
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{config.getTitle(result)}</div>
										<div class="text-xs text-base-content/60">{config.getYear(result)}</div>
										{#if alreadyExists}
											<span class="badge badge-warning badge-xs mt-1">Exists</span>
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

	<!-- Column 2: Source Details Panel -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Source Details</h2>

			{#if !selectedResult}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a result to view details.</p>
				</div>
			{:else if isLoadingDetails}
				<div class="flex-1 flex items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else if detailsError}
				<div class="alert alert-warning alert-sm">
					<span class="text-sm">{detailsError}</span>
				</div>
			{:else if contentDetails}
				<div class="flex-1 overflow-y-auto space-y-3">
					<!-- Poster and Basic Info -->
					<div class="flex gap-3">
						{#if contentDetails.poster}
							<img
								src={contentDetails.poster}
								alt={contentDetails.title}
								class="w-20 h-30 object-cover rounded shadow"
							/>
						{/if}
						<div class="flex-1 min-w-0">
							<h3 class="font-bold text-base line-clamp-2">{contentDetails.title}</h3>
							<p class="text-sm text-base-content/60">{contentDetails.year}</p>
							{#if contentDetails.rated}
								<span class="badge badge-outline badge-xs mt-1">{contentDetails.rated}</span>
							{/if}
							{#if contentDetails.runtime}
								<span class="badge badge-outline badge-xs mt-1 ml-1">{contentDetails.runtime}</span>
							{/if}
						</div>
					</div>

					<!-- Ratings -->
					{#if contentDetails.imdbRating || contentDetails.metascore}
						<div class="flex gap-2 flex-wrap">
							{#if contentDetails.imdbRating}
								<div class="badge badge-warning gap-1">
									<span class="font-bold">IMDb</span>
									{contentDetails.imdbRating}
								</div>
							{/if}
							{#if contentDetails.metascore}
								<div class="badge badge-info gap-1">
									<span class="font-bold">Meta</span>
									{contentDetails.metascore}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Genre -->
					{#if contentDetails.genre}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Genre</span>
							<p class="text-sm">{contentDetails.genre}</p>
						</div>
					{/if}

					<!-- Plot -->
					{#if contentDetails.plot}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Plot</span>
							<p class="text-sm leading-relaxed">{contentDetails.plot}</p>
						</div>
					{/if}

					<!-- Director -->
					{#if contentDetails.director}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Director</span>
							<p class="text-sm">{contentDetails.director}</p>
						</div>
					{/if}

					<!-- Writer -->
					{#if contentDetails.writer}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Writer</span>
							<p class="text-sm">{contentDetails.writer}</p>
						</div>
					{/if}

					<!-- Actors -->
					{#if contentDetails.actors}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Cast</span>
							<p class="text-sm">{contentDetails.actors}</p>
						</div>
					{/if}

					<!-- Awards -->
					{#if contentDetails.awards}
						<div>
							<span class="text-xs font-semibold text-base-content/60 uppercase">Awards</span>
							<p class="text-sm">{contentDetails.awards}</p>
						</div>
					{/if}

					<!-- Additional Info -->
					<div class="divider my-1 text-xs">Additional Info</div>

					<div class="grid grid-cols-2 gap-2 text-xs">
						{#if contentDetails.released}
							<div>
								<span class="text-base-content/60">Released:</span>
								<span class="ml-1">{contentDetails.released}</span>
							</div>
						{/if}
						{#if contentDetails.language}
							<div>
								<span class="text-base-content/60">Language:</span>
								<span class="ml-1">{contentDetails.language}</span>
							</div>
						{/if}
						{#if contentDetails.country}
							<div>
								<span class="text-base-content/60">Country:</span>
								<span class="ml-1">{contentDetails.country}</span>
							</div>
						{/if}
						{#if contentDetails.boxOffice}
							<div>
								<span class="text-base-content/60">Box Office:</span>
								<span class="ml-1">{contentDetails.boxOffice}</span>
							</div>
						{/if}
						{#if contentDetails.totalSeasons}
							<div>
								<span class="text-base-content/60">Seasons:</span>
								<span class="ml-1">{contentDetails.totalSeasons}</span>
							</div>
						{/if}
						{#if contentDetails.production}
							<div class="col-span-2">
								<span class="text-base-content/60">Production:</span>
								<span class="ml-1">{contentDetails.production}</span>
							</div>
						{/if}
					</div>
				</div>
			{:else if selectedResult}
				<!-- No details available (e.g., for non-IMDB content) -->
				{@const title = config.getTitle(selectedResult)}
				{@const year = config.getYear(selectedResult)}
				{@const poster = config.getPoster(selectedResult)}
				{@const extraDetails = config.getExtraDetails?.(selectedResult) ?? []}
				<div class="flex-1 overflow-y-auto">
					<div class="space-y-3">
						<div class="flex gap-3">
							{#if poster}
								<img src={poster} alt={title} class="w-20 h-30 object-cover rounded shadow" />
							{/if}
							<div class="flex-1 min-w-0">
								<h3 class="font-bold text-base line-clamp-2">{title}</h3>
								<p class="text-sm text-base-content/60">{year}</p>
								<span class="badge {config.sourceBadgeClass} badge-sm mt-1"
									>{config.sourceBadgeText}</span
								>
							</div>
						</div>

						{#if extraDetails.length > 0}
							<div class="divider my-1 text-xs">Details</div>
							<div class="space-y-1 text-sm">
								{#each extraDetails as detail}
									<div class="flex justify-between">
										<span class="text-base-content/60">{detail.label}:</span>
										<span class="text-xs">{detail.value}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: Images (Templates) -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="flex items-center justify-between mb-2">
				<h2 class="card-title text-lg">Images (Stickers)</h2>
				{#if selectedResult && !isLoadingImages}
					<span class="badge badge-primary">{getTotalSelectedCount()}</span>
				{/if}
			</div>

			{#if !selectedResult}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a result to view images.</p>
				</div>
			{:else if isLoadingImages}
				<div class="flex-1 flex flex-col items-center justify-center gap-4">
					<span class="loading loading-spinner loading-md"></span>
					<div class="text-xs space-y-1">
						{#each config.progressSources as source}
							<div class="flex items-center gap-2 {getSourceStatusClass(source)}">
								<span class="w-16">{source}:</span>
								{#if fetchProgress.get(source)?.status === 'fetching'}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<span>{getSourceStatusIcon(source)}</span>
								{/if}
								{#if fetchProgress.get(source)?.message}
									<span class="text-xs opacity-70">{fetchProgress.get(source)?.message}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="tabs tabs-boxed tabs-xs mb-2">
					{#each config.imageSourceTabs as tab}
						<button
							class={classNames('tab', { 'tab-active': imageTab === tab.key })}
							onclick={() => (imageTab = tab.key)}
						>
							{tab.label}
							{#if getImageCount(tab.key) > 0}
								<span class="badge badge-xs ml-1"
									>{getSelectedCount(tab.key)}/{getImageCount(tab.key)}</span
								>
							{/if}
						</button>
					{/each}
				</div>

				{#if getCurrentImages().length > 0 || (imageTab === 'characters' && characterImages.length > 0) || (imageTab === 'tmdb-cast' && getTmdbCastCharacters().length > 0)}
					<div class="flex gap-2 mb-2">
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(true)}>
							Select All
						</button>
						<button class="btn btn-xs btn-ghost" onclick={() => toggleAllImages(false)}>
							Select None
						</button>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto">
					{#if imageTab === 'tmdb-cast' && config.showCharacters}
						{@const tmdbCharacters = getTmdbCastCharacters().sort((a, b) => a.order - b.order)}
						{#if tmdbCharacters.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No TMDB cast information available.</p>
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								{#each tmdbCharacters as character (character.id)}
									{@const templateName = character.name
										? `${character.name} as ${character.character}`
										: character.character || 'Character'}
									{@const stickerTypeId = character.isActorHeadshot ? 'cast' : 'character'}
									{@const previewSticker = {
										id: `preview-char-${character.id}`,
										sourceId: '',
										name: templateName,
										image: character.profileThumbUrl || character.profileUrl,
										stickerTypeId
									} as Sticker}
									{@const previewStickerType = createStickerTypeEntity(stickerTypeId)}
									<div
										class={classNames('relative cursor-pointer transition-all hover:scale-[1.02]', {
											'ring-2 ring-primary': character.selected,
											'opacity-50 grayscale': !character.selected
										})}
										onclick={() => selectTemplateForDetails(character)}
										onkeydown={(e) => e.key === 'Enter' && selectTemplateForDetails(character)}
										role="button"
										tabindex="0"
									>
										<div class="absolute top-2 left-2 z-10">
											<input
												type="checkbox"
												class="checkbox checkbox-primary checkbox-sm bg-base-100"
												checked={character.selected}
												onclick={(e) => { e.stopPropagation(); toggleCharacter(character); }}
											/>
										</div>
										<StickerItem sticker={previewSticker} />
										<div class="p-2 bg-base-200">
											{#if previewStickerType}
												<span class={classNames('badge badge-xs', previewStickerType.badgeColor)}>{previewStickerType.name}</span>
											{/if}
											<h3 class="text-xs font-medium leading-tight truncate">{previewSticker.name}</h3>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else if imageTab === 'characters' && config.showCharacters}
						{@const sortedCharacters = [...characterImages].sort((a, b) => {
							if (a.isActorHeadshot !== b.isActorHeadshot) {
								return a.isActorHeadshot ? 1 : -1;
							}
							return a.order - b.order;
						})}
						{#if sortedCharacters.length === 0}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No cast information available.</p>
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								{#each sortedCharacters as character (character.id)}
									{@const templateName = character.name
										? `${character.name} as ${character.character}`
										: character.character || 'Character'}
									{@const stickerTypeId = character.isActorHeadshot ? 'cast' : 'character'}
									{@const previewSticker = {
										id: `preview-char-${character.id}`,
										sourceId: '',
										name: templateName,
										image: character.profileThumbUrl || character.profileUrl,
										stickerTypeId
									} as Sticker}
									{@const previewStickerType = createStickerTypeEntity(stickerTypeId)}
									<div
										class={classNames('relative cursor-pointer transition-all hover:scale-[1.02]', {
											'ring-2 ring-primary': character.selected,
											'opacity-50 grayscale': !character.selected
										})}
										onclick={() => selectTemplateForDetails(character)}
										onkeydown={(e) => e.key === 'Enter' && selectTemplateForDetails(character)}
										role="button"
										tabindex="0"
									>
										<div class="absolute top-2 left-2 z-10">
											<input
												type="checkbox"
												class="checkbox checkbox-primary checkbox-sm bg-base-100"
												checked={character.selected}
												onclick={(e) => { e.stopPropagation(); toggleCharacter(character); }}
											/>
										</div>
										<StickerItem sticker={previewSticker} />
										<div class="p-2 bg-base-200">
											{#if previewStickerType}
												<span class={classNames('badge badge-xs', previewStickerType.badgeColor)}>{previewStickerType.name}</span>
											{/if}
											<h3 class="text-xs font-medium leading-tight truncate">{previewSticker.name}</h3>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else if getCurrentImages().length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p class="text-sm">No images from this source.</p>
						</div>
					{:else}
						{@const title = selectedResult ? config.getTitle(selectedResult) : ''}
						<div class="grid grid-cols-3 gap-2">
							{#each getCurrentImages() as image, i (image.url + i)}
								{@const previewSticker = {
									id: `preview-${i}`,
									sourceId: '',
									name: formatTemplateName(title, image.imageType, image.language),
									image: image.thumbUrl || image.url,
									stickerTypeId: image.imageType
								} as Sticker}
								{@const previewStickerType = createStickerTypeEntity(image.imageType)}
								<div
									class={classNames('relative cursor-pointer transition-all hover:scale-[1.02]', {
										'ring-2 ring-primary': image.selected,
										'opacity-50 grayscale': !image.selected
									})}
									onclick={() => selectTemplateForDetails(image)}
									onkeydown={(e) => e.key === 'Enter' && selectTemplateForDetails(image)}
									role="button"
									tabindex="0"
								>
									<div class="absolute top-2 left-2 z-10">
										<input
											type="checkbox"
											class="checkbox checkbox-primary checkbox-sm bg-base-100"
											checked={image.selected}
											onclick={(e) => { e.stopPropagation(); toggleImage(image); }}
										/>
									</div>
									<StickerItem sticker={previewSticker} />
									<div class="p-2 bg-base-200">
										{#if previewStickerType}
											<span class={classNames('badge badge-xs', previewStickerType.badgeColor)}>{previewStickerType.name}</span>
										{/if}
										<h3 class="text-xs font-medium leading-tight truncate">{previewSticker.name}</h3>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 4: Sticker Details -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Sticker Details</h2>

			{#if !selectedStickerForDetails}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Click a sticker to view its metadata.</p>
				</div>
			{:else}
				{@const isCharacter = 'characterName' in selectedStickerForDetails || 'character' in selectedStickerForDetails}
				<div class="flex-1 overflow-y-auto space-y-3">
					<!-- Sticker Preview Image -->
					<div class="flex justify-center">
						<img
							src={'profileUrl' in selectedStickerForDetails ? selectedStickerForDetails.profileUrl : selectedStickerForDetails.url}
							alt="Sticker preview"
							class="max-w-full max-h-48 object-contain rounded shadow"
						/>
					</div>

					<div class="divider my-1 text-xs">Metadata</div>

					{#if isCharacter}
						{@const char = selectedStickerForDetails as SelectableCharacterItem}
						<div class="space-y-2 text-sm">
							{#if char.name}
								<div class="flex justify-between">
									<span class="text-base-content/60">Actor:</span>
									<span class="text-xs font-medium">{char.name}</span>
								</div>
							{/if}
							{#if char.character || char.characterName}
								<div class="flex justify-between">
									<span class="text-base-content/60">Character:</span>
									<span class="text-xs">{char.character || char.characterName}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-base-content/60">Type:</span>
								<span class="badge badge-xs">{char.isActorHeadshot ? 'Actor Headshot' : 'Character'}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Source:</span>
								<span class="badge badge-ghost badge-xs">{char.source}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Order:</span>
								<span class="text-xs">{char.order}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">ID:</span>
								<span class="text-xs font-mono truncate ml-2">{char.id}</span>
							</div>
						</div>

						<div class="divider my-1 text-xs">URLs</div>
						<div class="space-y-2 text-xs">
							<div>
								<span class="text-base-content/60 block mb-1">Profile URL:</span>
								<a href={char.profileUrl} target="_blank" rel="noopener noreferrer" class="link link-primary break-all">
									{char.profileUrl}
								</a>
							</div>
							{#if char.profileThumbUrl && char.profileThumbUrl !== char.profileUrl}
								<div>
									<span class="text-base-content/60 block mb-1">Thumbnail URL:</span>
									<a href={char.profileThumbUrl} target="_blank" rel="noopener noreferrer" class="link link-primary break-all">
										{char.profileThumbUrl}
									</a>
								</div>
							{/if}
						</div>
					{:else}
						{@const img = selectedStickerForDetails as SelectableImageItem}
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Image Type:</span>
								<span class="badge badge-xs">{img.imageType}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Source:</span>
								<span class="badge badge-ghost badge-xs">{img.source}</span>
							</div>
							{#if img.width && img.height}
								<div class="flex justify-between">
									<span class="text-base-content/60">Dimensions:</span>
									<span class="text-xs">{img.width} x {img.height}</span>
								</div>
							{/if}
							{#if img.language}
								<div class="flex justify-between">
									<span class="text-base-content/60">Language:</span>
									<span class="badge badge-outline badge-xs">{img.language.toUpperCase()}</span>
								</div>
							{/if}
							{#if img.voteAverage !== undefined && img.voteAverage !== null}
								<div class="flex justify-between">
									<span class="text-base-content/60">Rating:</span>
									<span class="badge badge-warning badge-xs">{img.voteAverage.toFixed(1)}/10</span>
								</div>
							{/if}
							{#if img.likes !== undefined && img.likes !== null}
								<div class="flex justify-between">
									<span class="text-base-content/60">Likes:</span>
									<span class="text-xs">{img.likes}</span>
								</div>
							{/if}
						</div>

						<div class="divider my-1 text-xs">URLs</div>
						<div class="space-y-2 text-xs">
							<div>
								<span class="text-base-content/60 block mb-1">Full URL:</span>
								<a href={img.url} target="_blank" rel="noopener noreferrer" class="link link-primary break-all">
									{img.url}
								</a>
							</div>
							{#if img.thumbUrl && img.thumbUrl !== img.url}
								<div>
									<span class="text-base-content/60 block mb-1">Thumbnail URL:</span>
									<a href={img.thumbUrl} target="_blank" rel="noopener noreferrer" class="link link-primary break-all">
										{img.thumbUrl}
									</a>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Selection Status -->
					<div class="divider my-1 text-xs">Status</div>
					<div class="flex items-center justify-between">
						<span class="text-base-content/60 text-sm">Selected for import:</span>
						<span class={classNames('badge badge-sm', selectedStickerForDetails.selected ? 'badge-success' : 'badge-ghost')}>
							{selectedStickerForDetails.selected ? 'Yes' : 'No'}
						</span>
					</div>

					<!-- Tags Preview -->
					<div class="divider my-1 text-xs">Tags Preview</div>
					<div class="space-y-1">
						{#each getPreviewTags(selectedStickerForDetails) as tag}
							<div class="flex items-center gap-2">
								<span class="badge badge-outline badge-xs font-mono">{tag.key}</span>
								<span class="text-xs">=</span>
								<span class="badge badge-primary badge-xs">{tag.value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 5: Source Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Source</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedResult}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select a search result to create an source.</p>
					</div>
				{:else}
					{@const externalId = config.getId(selectedResult)}
					{@const title = config.getTitle(selectedResult)}
					{@const year = config.getYear(selectedResult)}
					{@const externalLinks = config.getExternalLinks(selectedResult)}
					{@const extraDetails = config.getExtraDetails?.(selectedResult) ?? []}
					<div class="space-y-4">
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={title}
									class="w-24 h-36 object-cover rounded"
								/>
							{:else}
								<div
									class="w-24 h-36 bg-base-300 rounded flex items-center justify-center text-base-content/30"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-10 w-10"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
										/>
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{title}</h3>
								<p class="text-sm text-base-content/60">{year}</p>
								<span class="badge {config.sourceBadgeClass} badge-sm"
									>{config.sourceBadgeText}</span
								>
								{#each externalLinks as link}
									<a
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										class="link link-primary text-xs mt-1 block"
									>
										{link.label}
									</a>
								{/each}
							</div>
						</div>

						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">{config.sourceType.toUpperCase()} ID:</span>
								<span class="font-mono text-xs">{externalId}</span>
							</div>
							{#each extraDetails as detail}
								<div class="flex justify-between">
									<span class="text-base-content/60">{detail.label}:</span>
									<span class="text-xs">{detail.value}</span>
								</div>
							{/each}
							<div class="flex justify-between">
								<span class="text-base-content/60">Cover:</span>
								<span class="text-xs">
									{selectedCoverImage ? 'Selected' : 'None'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Stickers to import:</span>
								<span class="text-xs font-bold">{getTotalSelectedCount()}</span>
							</div>
						</div>

						{#if sourceCreated}
							<div class="alert alert-success">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5 shrink-0 stroke-current"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<div>
									<span class="text-sm block">Source created!</span>
									<span class="text-xs">{stickersCreated} stickers imported</span>
								</div>
							</div>
							<a href="/admin/source" class="btn btn-outline btn-sm w-full">
								Go to Source Manager
							</a>
						{:else if isSourceAdded(externalId)}
							<div class="alert alert-warning">
								<span class="text-sm">This {config.sourceType} has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumAndTemplates}
								disabled={isCreatingSource || getTotalSelectedCount() === 0}
							>
								{#if isCreatingSource}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Source + {getTotalSelectedCount()} Stickers
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
