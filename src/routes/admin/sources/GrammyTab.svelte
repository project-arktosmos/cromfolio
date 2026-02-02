<script lang="ts">
	import classNames from 'classnames';
	import {
		getGrammyYears,
		getGrammyCategories,
		getGrammyNomineesForYear,
		normalizeWikipediaName,
		formatGrammyCategoryName,
		getEntityTypeLabel,
		getEntityTypeBadgeClass
	} from '$services/grammy.service';
	import {
		searchMusicBrainz,
		getMusicBrainzCoverArt,
		getMusicBrainzResultName,
		getMusicBrainzResultMbid,
		isMusicBrainzRelease,
		isMusicBrainzRecording
	} from '$services/musicbrainz.service';
	import { addSource } from '$services/sources.service';
	import { addStickersBatch } from '$services/stickers.service';
	import { providerExists, createProvider } from '$services/providers.service';
	import { tagSticker } from '$services/tags.service';
	import { toastService } from '$services/toast.service';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Source } from '$types/source.type';
	import type { Sticker, FragmentPosition } from '$types/sticker.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type {
		GrammyNomineeWithMatch,
		MusicBrainzResult,
		MusicBrainzReleaseResult,
		MusicBrainzRecordingResult
	} from '$types/grammy.type';

	// Source type options for dropdown
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
	let {
		sourceType,
		onSourceTypeChange
	}: {
		sourceType: SourceType;
		onSourceTypeChange: (type: SourceType) => void;
	} = $props();

	// Grammy selection state
	const years = getGrammyYears();
	let selectedYear = $state<string>('');
	let selectedCategory = $state<string>('');

	// Computed values
	let categories = $derived(selectedYear ? getGrammyCategories(selectedYear) : []);

	// Nominees state
	let nominees = $state<GrammyNomineeWithMatch[]>([]);
	let isLoadingNominees = $state(false);

	// Selected nominee for details
	let selectedNomineeForDetails = $state<GrammyNomineeWithMatch | null>(null);

	// Source creation state
	let isCreatingSource = $state(false);
	let sourceCreated = $state<Source | null>(null);
	let stickersCreated = $state(0);

	// Helper to create mock sticker type entity
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

	// Filtered nominees based on selected category
	let filteredNominees = $derived(
		selectedCategory ? nominees.filter((n) => n.category === selectedCategory) : nominees
	);

	// Event handlers for cascading dropdowns
	function handleYearChange(newYear: string) {
		selectedYear = newYear;
		selectedCategory = '';
		nominees = [];
		sourceCreated = null;
		selectedNomineeForDetails = null;
		if (newYear) {
			loadNominees();
		}
	}

	function handleCategoryChange(newCategory: string) {
		selectedCategory = newCategory;
		sourceCreated = null;
		selectedNomineeForDetails = null;
	}

	async function loadNominees() {
		if (!selectedYear) return;

		isLoadingNominees = true;
		nominees = [];
		selectedNomineeForDetails = null;
		sourceCreated = null;

		const rawNominees = getGrammyNomineesForYear(selectedYear);
		if (rawNominees.length === 0) {
			isLoadingNominees = false;
			return;
		}

		// Initialize nominees with loading state
		nominees = rawNominees.map((n) => ({
			...n,
			isLoading: true,
			selected: true,
			mbSearchResults: []
		}));

		// Fetch MusicBrainz data for each nominee (with concurrency limit)
		const batchSize = 3; // MusicBrainz is rate-limited to 1 req/sec
		for (let i = 0; i < nominees.length; i += batchSize) {
			const batch = nominees.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (nominee, batchIdx) => {
					const nomineeIndex = i + batchIdx;
					const searchQuery = normalizeWikipediaName(nominee.wikipediaArticle);

					try {
						const results = await searchMusicBrainz(searchQuery, nominee.entityType, 5);

						// Auto-select best match (highest score)
						const bestMatch = results.length > 0 ? results[0] : undefined;

						// Get cover art for releases/recordings based on entity type
						let coverArtUrl: string | undefined = undefined;
						if (bestMatch) {
							// Use entity type to determine how to fetch cover art
							// (more reliable than type guards since we know what was searched)
							if (nominee.entityType === 'album') {
								const release = bestMatch as MusicBrainzReleaseResult;
								console.log(
									'[Grammy] Album entity - fetching cover art for:',
									release.title,
									'mbid:',
									release.mbid,
									'release-group:',
									release.releaseGroupMbid
								);
								try {
									const coverArt = await getMusicBrainzCoverArt(
										release.mbid,
										release.releaseGroupMbid
									);
									console.log('[Grammy] Cover art result:', coverArt);
									if (coverArt) coverArtUrl = coverArt;
								} catch (err) {
									console.error('[Grammy] Cover art error:', err);
								}
							} else if (nominee.entityType === 'recording') {
								const recording = bestMatch as MusicBrainzRecordingResult;
								console.log(
									'[Grammy] Recording entity:',
									recording.title,
									'releaseMbid:',
									recording.releaseMbid
								);
								if (recording.releaseMbid) {
									try {
										const coverArt = await getMusicBrainzCoverArt(recording.releaseMbid);
										console.log('[Grammy] Recording cover art result:', coverArt);
										if (coverArt) coverArtUrl = coverArt;
									} catch (err) {
										console.error('[Grammy] Recording cover art error:', err);
									}
								}
							}
							// Artists don't have cover art in Cover Art Archive
						}

						nominees[nomineeIndex] = {
							...nominees[nomineeIndex],
							mbSearchResults: results as MusicBrainzResult[],
							mbMatch: bestMatch as MusicBrainzResult | undefined,
							coverArtUrl,
							isLoading: false
						};
						nominees = [...nominees];
					} catch (error) {
						console.error(`Failed to search MusicBrainz for ${searchQuery}:`, error);
						nominees[nomineeIndex] = {
							...nominees[nomineeIndex],
							isLoading: false,
							error: 'Failed to search'
						};
						nominees = [...nominees];
					}
				})
			);
		}

		isLoadingNominees = false;
	}

	function selectNomineeForDetails(nominee: GrammyNomineeWithMatch) {
		selectedNomineeForDetails = nominee;
	}

	function toggleNominee(nominee: GrammyNomineeWithMatch) {
		const index = nominees.findIndex(
			(n) => n.wikipediaArticle === nominee.wikipediaArticle && n.category === nominee.category
		);
		if (index !== -1) {
			nominees[index] = { ...nominees[index], selected: !nominees[index].selected };
			nominees = [...nominees];
		}
	}

	function toggleAllNominees(selected: boolean) {
		// Only toggle filtered nominees
		const filteredArticles = new Set(filteredNominees.map((n) => n.wikipediaArticle + n.category));
		nominees = nominees.map((n) =>
			filteredArticles.has(n.wikipediaArticle + n.category) ? { ...n, selected } : n
		);
	}

	function selectMbMatch(nominee: GrammyNomineeWithMatch, match: MusicBrainzResult) {
		const index = nominees.findIndex(
			(n) => n.wikipediaArticle === nominee.wikipediaArticle && n.category === nominee.category
		);
		if (index !== -1) {
			nominees[index] = { ...nominees[index], mbMatch: match };
			nominees = [...nominees];
			if (
				selectedNomineeForDetails?.wikipediaArticle === nominee.wikipediaArticle &&
				selectedNomineeForDetails?.category === nominee.category
			) {
				selectedNomineeForDetails = nominees[index];
			}
		}
	}

	function getSelectedCount(): number {
		return filteredNominees.filter((n) => n.selected && n.mbMatch).length;
	}

	function getSourceTitle(): string {
		if (selectedCategory) {
			return `Grammy Awards ${selectedYear} - ${formatGrammyCategoryName(selectedCategory)}`;
		}
		return `Grammy Awards ${selectedYear}`;
	}

	async function createGrammySource() {
		const selectedNominees = filteredNominees.filter((n) => n.selected && n.mbMatch);
		if (selectedNominees.length === 0) return;

		isCreatingSource = true;
		stickersCreated = 0;

		try {
			// Create source
			const sourceTitle = getSourceTitle();
			const firstNomineeWithCover = selectedNominees.find((n) => n.coverArtUrl);
			const description = selectedCategory
				? formatGrammyCategoryName(selectedCategory)
				: `All categories (${categories.length})`;
			const source: Source = {
				id: crypto.randomUUID(),
				sourceType: 'grammy',
				title: sourceTitle,
				description,
				coverImage: firstNomineeWithCover?.coverArtUrl,
				addedAt: new Date().toISOString()
			};

			const createdSource = await addSource(source);
			if (!createdSource) {
				throw new Error('Failed to create source');
			}

			sourceCreated = createdSource;

			// Create stickers
			const now = new Date().toISOString();
			const stickerNomineeMap: { sticker: Sticker; nominee: GrammyNomineeWithMatch }[] = [];

			for (const nominee of selectedNominees) {
				const name = getMusicBrainzResultName(nominee.mbMatch!);

				if (nominee.isWinner) {
					// Winners get 4 fragment stickers
					const fragmentGroupId = crypto.randomUUID();
					const fragmentPositions: FragmentPosition[] = [1, 2, 3, 4];
					const positionLabels = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];

					for (let i = 0; i < 4; i++) {
						stickerNomineeMap.push({
							sticker: {
								id: crypto.randomUUID(),
								sourceId: createdSource.id,
								name: `${name} (${positionLabels[i]})`,
								image: nominee.coverArtUrl || '',
								stickerTypeId: 'winner',
								imageSource: 'musicbrainz',
								fragmentOf: fragmentGroupId,
								fragmentPosition: fragmentPositions[i],
								addedAt: now
							},
							nominee
						});
					}
				} else {
					// Nominees get a single sticker
					stickerNomineeMap.push({
						sticker: {
							id: crypto.randomUUID(),
							sourceId: createdSource.id,
							name,
							image: nominee.coverArtUrl || '',
							stickerTypeId: 'nominee',
							imageSource: 'musicbrainz',
							addedAt: now
						},
						nominee
					});
				}
			}

			const stickersToCreate = stickerNomineeMap.map((sm) => sm.sticker);

			if (stickersToCreate.length > 0) {
				const created = await addStickersBatch(stickersToCreate);
				stickersCreated = created.length;

				// Add tags to each sticker
				for (const { sticker, nominee } of stickerNomineeMap) {
					const mbid = getMusicBrainzResultMbid(nominee.mbMatch!);

					// Grammy metadata tags
					await tagSticker(sticker.id, 'award_event', 'grammy');
					await tagSticker(sticker.id, 'award_event_name', 'Grammy Awards');
					await tagSticker(sticker.id, 'award_year', selectedYear);
					await tagSticker(sticker.id, 'award_category', selectedCategory);
					await tagSticker(sticker.id, 'award_status', nominee.isWinner ? 'winner' : 'nominee');
					await tagSticker(sticker.id, 'musicbrainz_id', mbid);
					await tagSticker(sticker.id, 'entity_type', nominee.entityType);
					await tagSticker(sticker.id, 'wikipedia_article', nominee.wikipediaArticle);

					// Fragment tags
					if (sticker.fragmentOf) {
						await tagSticker(sticker.id, 'fragment_of', sticker.fragmentOf);
						await tagSticker(sticker.id, 'fragment_position', String(sticker.fragmentPosition));
					}
				}
			}

			// Create provider entries
			for (const nominee of selectedNominees) {
				const mbid = getMusicBrainzResultMbid(nominee.mbMatch!);
				const exists = await providerExists('musicbrainz', mbid);
				if (!exists) {
					await createProvider(
						createdSource.id,
						`music_${nominee.entityType}`,
						'musicbrainz',
						mbid
					);
				}
			}

			toastService.success(`Created source with ${stickersCreated} stickers`);
		} catch (error) {
			console.error('Failed to create Grammy source:', error);
			toastService.error('Failed to create Grammy source');
		} finally {
			isCreatingSource = false;
		}
	}
</script>

<div class="grid min-h-0 flex-1 grid-cols-5 gap-4">
	<!-- Column 1: Grammy Selection -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
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
					<!-- Year Selection -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Grammy Year</span>
						</label>
						<select
							class="select select-bordered select-sm w-full"
							value={selectedYear}
							onchange={(e) => handleYearChange(e.currentTarget.value)}
						>
							<option value="">Select year...</option>
							{#each years as year (year)}
								<option value={year}>{year}</option>
							{/each}
						</select>
					</div>

					<!-- Category Filter (optional) -->
					{#if selectedYear && categories.length > 0}
						<div class="form-control">
							<label class="label py-1">
								<span class="label-text text-xs">Filter by Category</span>
							</label>
							<select
								class="select select-bordered select-sm w-full"
								value={selectedCategory}
								onchange={(e) => handleCategoryChange(e.currentTarget.value)}
								disabled={isLoadingNominees}
							>
								<option value="">All categories ({categories.length})</option>
								{#each categories as category (category)}
									<option value={category}>{formatGrammyCategoryName(category)}</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Stats -->
					{#if nominees.length > 0 && !isLoadingNominees}
						<div class="text-base-content/60 mt-2 space-y-1 text-xs">
							<div>Total nominees: {nominees.length}</div>
							{#if selectedCategory}
								{@const entityType = filteredNominees[0]?.entityType || 'album'}
								<div>
									Entity type: <span
										class={classNames('badge badge-xs', getEntityTypeBadgeClass(entityType))}
										>{getEntityTypeLabel(entityType)}</span
									>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Column 2: Nominees List -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="card-title text-lg">Nominees</h2>
				{#if filteredNominees.length > 0}
					<span class="badge badge-primary">{getSelectedCount()}/{filteredNominees.length}</span>
				{/if}
			</div>

			{#if !selectedYear}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a year to view nominees.</p>
				</div>
			{:else if isLoadingNominees}
				<div class="flex flex-1 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else if filteredNominees.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No nominees found.</p>
				</div>
			{:else}
				<div class="mb-2 flex gap-2">
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllNominees(true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllNominees(false)}>
						Select None
					</button>
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-2">
						{#each filteredNominees as nominee (nominee.wikipediaArticle + nominee.category)}
							{@const isSelected =
								selectedNomineeForDetails?.wikipediaArticle === nominee.wikipediaArticle}
							<div
								class={classNames(
									'w-full cursor-pointer rounded-lg p-2 text-left transition-colors',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-primary ring-2': isSelected,
										'bg-base-100': !isSelected
									}
								)}
								onclick={() => selectNomineeForDetails(nominee)}
								onkeydown={(e) => e.key === 'Enter' && selectNomineeForDetails(nominee)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-1"
										checked={nominee.selected}
										onclick={(e) => e.stopPropagation()}
										onchange={() => toggleNominee(nominee)}
									/>
									{#if nominee.isLoading}
										<div class="bg-base-300 flex h-10 w-10 items-center justify-center rounded">
											<span class="loading loading-spinner loading-xs"></span>
										</div>
									{:else if nominee.coverArtUrl}
										<img
											src={nominee.coverArtUrl}
											alt={nominee.wikipediaArticle}
											class="h-10 w-10 rounded object-cover"
										/>
									{:else}
										<div
											class="bg-base-300 text-base-content/30 flex h-10 w-10 items-center justify-center rounded"
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
													d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
												/>
											</svg>
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium">
											{normalizeWikipediaName(nominee.wikipediaArticle)}
										</div>
										{#if nominee.mbMatch}
											<div class="text-base-content/60 truncate text-xs">
												{getMusicBrainzResultName(nominee.mbMatch)}
											</div>
										{:else if nominee.error}
											<div class="text-error text-xs">{nominee.error}</div>
										{:else if !nominee.isLoading}
											<div class="text-warning text-xs">No match found</div>
										{/if}
										<div class="mt-1 flex flex-wrap gap-1">
											{#if nominee.isWinner}
												<span class="badge badge-warning badge-xs">Winner</span>
											{/if}
											<span
												class={classNames(
													'badge badge-xs',
													getEntityTypeBadgeClass(nominee.entityType)
												)}
											>
												{getEntityTypeLabel(nominee.entityType)}
											</span>
											{#if !selectedCategory}
												<span
													class="badge badge-ghost badge-xs max-w-24 truncate"
													title={formatGrammyCategoryName(nominee.category)}
												>
													{formatGrammyCategoryName(nominee.category)}
												</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: MusicBrainz Match -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">MusicBrainz Match</h2>

			{#if !selectedNomineeForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a nominee to view matches.</p>
				</div>
			{:else if selectedNomineeForDetails.isLoading}
				<div class="flex flex-1 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else}
				<div class="flex-1 space-y-3 overflow-y-auto">
					<div>
						<span class="text-base-content/60 text-xs font-semibold uppercase">Search Query</span>
						<p class="text-sm">
							{normalizeWikipediaName(selectedNomineeForDetails.wikipediaArticle)}
						</p>
					</div>

					{#if selectedNomineeForDetails.mbSearchResults && selectedNomineeForDetails.mbSearchResults.length > 0}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase"
								>Results ({selectedNomineeForDetails.mbSearchResults.length})</span
							>
						</div>

						<div class="space-y-2">
							{#each selectedNomineeForDetails.mbSearchResults as result (getMusicBrainzResultMbid(result))}
								{@const isCurrentMatch =
									selectedNomineeForDetails.mbMatch &&
									getMusicBrainzResultMbid(selectedNomineeForDetails.mbMatch) ===
										getMusicBrainzResultMbid(result)}
								<div
									class={classNames('cursor-pointer rounded-lg p-2 transition-colors', {
										'bg-success/20 ring-success ring-2': isCurrentMatch,
										'bg-base-100 hover:bg-base-300': !isCurrentMatch
									})}
									onclick={() => selectMbMatch(selectedNomineeForDetails!, result)}
									onkeydown={(e) =>
										e.key === 'Enter' && selectMbMatch(selectedNomineeForDetails!, result)}
									role="button"
									tabindex="0"
								>
									<div class="text-sm font-medium">{getMusicBrainzResultName(result)}</div>
									{#if 'artistCredit' in result && result.artistCredit}
										<div class="text-base-content/60 text-xs">{result.artistCredit}</div>
									{/if}
									{#if 'date' in result && result.date}
										<div class="text-base-content/60 text-xs">{result.date}</div>
									{/if}
									{#if 'disambiguation' in result && result.disambiguation}
										<div class="text-base-content/50 text-xs italic">{result.disambiguation}</div>
									{/if}
									<div class="mt-1 flex items-center justify-between">
										<span class="text-base-content/40 text-xs">Score: {result.score}</span>
										{#if isCurrentMatch}
											<span class="badge badge-success badge-xs">Selected</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-base-content/60 flex flex-1 items-center justify-center">
							<p class="text-sm">No MusicBrainz results found.</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 4: Preview -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Sticker Preview</h2>

			{#if !selectedNomineeForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a nominee to preview sticker.</p>
				</div>
			{:else if selectedNomineeForDetails.mbMatch}
				{@const name = getMusicBrainzResultName(selectedNomineeForDetails.mbMatch)}
				{@const stickerTypeId = selectedNomineeForDetails.isWinner ? 'winner' : 'nominee'}
				{@const previewSticker = {
					id: `preview-${selectedNomineeForDetails.wikipediaArticle}`,
					sourceId: '',
					name,
					image: selectedNomineeForDetails.coverArtUrl || '',
					stickerTypeId
				} as Sticker}
				{@const previewStickerType = createStickerTypeEntity(stickerTypeId)}

				<div class="flex-1 overflow-y-auto">
					<div class="flex flex-col items-center gap-4">
						<div class="w-48">
							<StickerItem sticker={previewSticker} />
							<div class="bg-base-200 rounded-b p-2">
								{#if previewStickerType}
									<div class="mb-1 flex justify-center">
										<span class={classNames('badge badge-xs', previewStickerType.badgeColor)}
											>{previewStickerType.name}</span
										>
									</div>
								{/if}
								<h3 class="text-center text-xs font-medium leading-tight">{previewSticker.name}</h3>
							</div>
						</div>

						<div class="text-center">
							<p class="text-sm font-medium">{name}</p>
							{#if 'artistCredit' in selectedNomineeForDetails.mbMatch && selectedNomineeForDetails.mbMatch.artistCredit}
								<p class="text-base-content/60 text-xs">
									{selectedNomineeForDetails.mbMatch.artistCredit}
								</p>
							{/if}
							{#if selectedNomineeForDetails.isWinner}
								<span class="badge badge-warning badge-sm mt-1">Winner</span>
							{:else}
								<span class="badge badge-ghost badge-sm mt-1">Nominee</span>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No MusicBrainz match selected.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 5: Create Source -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Create Source</h2>

			{#if !selectedYear}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a year to create a Grammy source.</p>
				</div>
			{:else if filteredNominees.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No nominees loaded yet.</p>
				</div>
			{:else}
				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<div>
							<h3 class="text-sm font-bold">{getSourceTitle()}</h3>
							<p class="text-base-content/60 mt-1 text-xs">
								{#if selectedCategory}
									{formatGrammyCategoryName(selectedCategory)}
								{:else}
									All categories ({categories.length})
								{/if}
							</p>
						</div>

						<div class="divider my-2">Summary</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Total nominees:</span>
								<span class="font-mono text-xs">{filteredNominees.length}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">With match:</span>
								<span class="font-mono text-xs"
									>{filteredNominees.filter((n) => n.mbMatch).length}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Selected:</span>
								<span class="font-mono text-xs font-bold">{getSelectedCount()}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Winners:</span>
								<span class="font-mono text-xs">
									{filteredNominees.filter((n) => n.isWinner).length}
								</span>
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
									<span class="block text-sm">Source created!</span>
									<span class="text-xs">{stickersCreated} stickers imported</span>
								</div>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createGrammySource}
								disabled={isCreatingSource || getSelectedCount() === 0 || isLoadingNominees}
							>
								{#if isCreatingSource}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Source + {getSelectedCount()} Stickers
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
