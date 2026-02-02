<script lang="ts">
	import classNames from 'classnames';
	import {
		getAwardEvents,
		loadAwardEvent,
		getYearsForEvent,
		getAwardTypesForYear,
		getCategoriesForAwardType,
		getNomineesForCategory,
		formatCategoryName,
		formatAwardTypeName,
		type AwardEvent,
		type EventInfo
	} from '$services/awards.service';
	import {
		getContentDetails,
		fetchSourceImages,
		type ContentDetails,
		type FetchProgressEvent
	} from '$services/fetch.service';
	import { addSource } from '$services/sources.service';
	import { addStickersBatch } from '$services/stickers.service';
	import { providerExists, createProvider } from '$services/providers.service';
	import { tagSticker } from '$services/tags.service';
	import { toastService } from '$services/toast.service';
	import { getEventName } from '$services/awards.service';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Source } from '$types/source.type';
	import type { Sticker, FragmentPosition } from '$types/sticker.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';

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

	// Award selection state
	const events = getAwardEvents();
	let selectedEventId = $state<string>('');
	let selectedYear = $state<string>('');
	let selectedAwardType = $state<string>('');
	let selectedCategory = $state<string>('');

	// Loaded data
	let eventData = $state<AwardEvent | null>(null);
	let isLoadingEvent = $state(false);

	// Movie details state
	interface MovieWithDetails {
		imdbId: string;
		details: ContentDetails | null;
		isWinner: boolean;
		isLoading: boolean;
		error?: string;
		selected: boolean;
		posterImages: { url: string; thumbUrl: string }[];
		category: string; // Which award category this movie belongs to
	}
	let movies = $state<MovieWithDetails[]>([]);
	let isLoadingMovies = $state(false);

	// Sticker creation state
	let isCreatingSource = $state(false);
	let sourceCreated = $state<Source | null>(null);
	let stickersCreated = $state(0);

	// Selected movie for details
	let selectedMovieForDetails = $state<MovieWithDetails | null>(null);

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

	// Computed values
	let years = $derived(eventData ? getYearsForEvent(eventData) : []);
	let awardTypes = $derived(
		eventData && selectedYear ? getAwardTypesForYear(eventData, selectedYear) : []
	);
	let categories = $derived(
		eventData && selectedYear && selectedAwardType
			? getCategoriesForAwardType(eventData, selectedYear, selectedAwardType)
			: []
	);

	// Event handlers for cascading dropdowns - avoid effects that read/write same state
	function handleEventChange(newEventId: string) {
		selectedEventId = newEventId;
		selectedYear = '';
		selectedAwardType = '';
		selectedCategory = '';
		movies = [];
		sourceCreated = null;
		selectedMovieForDetails = null;
		if (newEventId) {
			loadEvent(newEventId);
		}
	}

	function handleYearChange(newYear: string) {
		selectedYear = newYear;
		selectedAwardType = '';
		selectedCategory = '';
		movies = [];
		sourceCreated = null;
		selectedMovieForDetails = null;
	}

	function handleAwardTypeChange(newAwardType: string) {
		selectedAwardType = newAwardType;
		selectedCategory = '';
		movies = [];
		sourceCreated = null;
		selectedMovieForDetails = null;
		if (newAwardType && eventData && selectedYear) {
			loadAllNominees();
		}
	}

	let loadEventError = $state<string | null>(null);

	function loadEvent(eventId: string) {
		isLoadingEvent = true;
		eventData = null;
		loadEventError = null;
		const data = loadAwardEvent(eventId);
		if (!data) {
			loadEventError = 'Failed to load award data. Event not found.';
			toastService.error('Failed to load award event data');
		} else {
			eventData = data;
		}
		isLoadingEvent = false;
	}

	async function loadAllNominees() {
		if (!eventData || !selectedYear || !selectedAwardType) return;

		// Get all categories for this award type
		const allCategories = getCategoriesForAwardType(eventData, selectedYear, selectedAwardType);
		if (allCategories.length === 0) return;

		isLoadingMovies = true;
		movies = [];
		selectedMovieForDetails = null;
		sourceCreated = null;

		// Collect all movies from all categories, tracking which category they're from
		// Use a map to dedupe by imdbId while preserving category info
		const movieMap = new Map<string, { isWinner: boolean; category: string }>();

		for (const category of allCategories) {
			const categoryData = getNomineesForCategory(
				eventData,
				selectedYear,
				selectedAwardType,
				category
			);
			if (!categoryData) continue;

			// Add winners
			for (const imdbId of categoryData.winner) {
				if (!movieMap.has(imdbId)) {
					movieMap.set(imdbId, { isWinner: true, category });
				}
			}

			// Add nominees (winners take precedence if already added)
			for (const imdbId of categoryData.nominee) {
				if (!movieMap.has(imdbId)) {
					movieMap.set(imdbId, { isWinner: false, category });
				}
			}
		}

		// Initialize movies with loading state
		movies = Array.from(movieMap.entries()).map(([imdbId, info]) => ({
			imdbId,
			details: null,
			isWinner: info.isWinner,
			isLoading: true,
			selected: true,
			posterImages: [],
			category: info.category
		}));

		// Fetch details for each movie in parallel (with concurrency limit)
		const batchSize = 5;
		const allImdbIds = Array.from(movieMap.keys());
		for (let i = 0; i < allImdbIds.length; i += batchSize) {
			const batch = allImdbIds.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (imdbId) => {
					const movieIndex = movies.findIndex((m) => m.imdbId === imdbId);
					if (movieIndex === -1) return;

					try {
						const details = await getContentDetails(imdbId);
						movies[movieIndex] = {
							...movies[movieIndex],
							details,
							isLoading: false
						};
						// Trigger reactivity
						movies = [...movies];
					} catch (error) {
						console.error(`Failed to fetch details for ${imdbId}:`, error);
						movies[movieIndex] = {
							...movies[movieIndex],
							isLoading: false,
							error: 'Failed to load'
						};
						movies = [...movies];
					}
				})
			);
		}

		isLoadingMovies = false;
	}

	async function fetchPostersForMovie(movie: MovieWithDetails) {
		if (movie.posterImages.length > 0) return; // Already fetched

		try {
			const result = await fetchSourceImages({
				contentType: 'movie',
				externalId: movie.imdbId,
				externalIdType: 'imdb',
				sources: ['tmdb'],
				onProgress: (event: FetchProgressEvent) => {
					// Could show progress if needed
				}
			});

			const posterImages = result.images
				.filter((img) => img.imageType === 'poster')
				.map((img) => ({ url: img.url, thumbUrl: img.thumbUrl }));

			// Update the movie with poster images
			const movieIndex = movies.findIndex((m) => m.imdbId === movie.imdbId);
			if (movieIndex !== -1) {
				movies[movieIndex] = { ...movies[movieIndex], posterImages };
				movies = [...movies];
			}
		} catch (error) {
			console.error(`Failed to fetch posters for ${movie.imdbId}:`, error);
		}
	}

	function toggleMovie(movie: MovieWithDetails) {
		const index = movies.findIndex((m) => m.imdbId === movie.imdbId);
		if (index !== -1) {
			movies[index] = { ...movies[index], selected: !movies[index].selected };
			movies = [...movies];
		}
	}

	function selectMovieForDetails(movie: MovieWithDetails) {
		selectedMovieForDetails = movie;
		// Fetch posters when selecting
		fetchPostersForMovie(movie);
	}

	function toggleAllMovies(selected: boolean) {
		movies = movies.map((m) => ({ ...m, selected }));
	}

	function getSelectedCount(): number {
		return movies.filter((m) => m.selected && m.details).length;
	}

	function getAwardListName(): string {
		const event = events.find((e) => e.id === selectedEventId);
		return `${event?.name || ''} ${selectedYear} - ${formatAwardTypeName(selectedAwardType)}`;
	}

	async function createAwardSource() {
		const selectedMovies = movies.filter((m) => m.selected && m.details);
		if (selectedMovies.length === 0) return;

		isCreatingSource = true;
		stickersCreated = 0;

		try {
			// Create source for the award list
			const sourceTitle = getAwardListName();
			const source: Source = {
				id: crypto.randomUUID(),
				sourceType: 'award_list',
				title: sourceTitle,
				description: `${formatAwardTypeName(selectedAwardType)} - ${formatCategoryName(selectedCategory)}`,
				coverImage: selectedMovies[0]?.details?.poster,
				addedAt: new Date().toISOString()
			};

			const createdSource = await addSource(source);
			if (!createdSource) {
				throw new Error('Failed to create source');
			}

			sourceCreated = createdSource;

			// Create stickers for each selected movie
			// Winners are split into 4 fragment stickers, nominees get 1 normal sticker
			const now = new Date().toISOString();
			const stickerMovieMap: { sticker: Sticker; movie: MovieWithDetails }[] = [];

			for (const movie of selectedMovies) {
				if (movie.isWinner) {
					// Winners get 4 fragment stickers
					const fragmentGroupId = crypto.randomUUID(); // Shared ID to link all 4 fragments
					const fragmentPositions: FragmentPosition[] = [1, 2, 3, 4];
					const positionLabels = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];

					for (let i = 0; i < 4; i++) {
						stickerMovieMap.push({
							sticker: {
								id: crypto.randomUUID(),
								sourceId: createdSource.id,
								name: `${movie.details!.title} (${positionLabels[i]})`,
								image: movie.details!.poster || '',
								stickerTypeId: 'winner',
								imageSource: 'omdb',
								fragmentOf: fragmentGroupId,
								fragmentPosition: fragmentPositions[i],
								addedAt: now
							},
							movie
						});
					}
				} else {
					// Nominees get a single normal sticker
					stickerMovieMap.push({
						sticker: {
							id: crypto.randomUUID(),
							sourceId: createdSource.id,
							name: movie.details!.title,
							image: movie.details!.poster || '',
							stickerTypeId: 'nominee',
							imageSource: 'omdb',
							addedAt: now
						},
						movie
					});
				}
			}

			const stickersToCreate = stickerMovieMap.map((sm) => sm.sticker);

			if (stickersToCreate.length > 0) {
				const created = await addStickersBatch(stickersToCreate);
				stickersCreated = created.length;

				// Add award metadata tags to each sticker
				const eventName = getEventName(selectedEventId);
				for (const { sticker, movie } of stickerMovieMap) {
					// Tag with award metadata
					await tagSticker(sticker.id, 'award_event', selectedEventId);
					await tagSticker(sticker.id, 'award_event_name', eventName);
					await tagSticker(sticker.id, 'award_year', selectedYear);
					await tagSticker(sticker.id, 'award_type', selectedAwardType);
					await tagSticker(sticker.id, 'award_category', movie.category);
					await tagSticker(sticker.id, 'award_status', movie.isWinner ? 'winner' : 'nominee');
					// Also tag with IMDb ID for cross-referencing
					await tagSticker(sticker.id, 'imdb_id', movie.imdbId);
					// Tag fragment info if applicable
					if (sticker.fragmentOf) {
						await tagSticker(sticker.id, 'fragment_of', sticker.fragmentOf);
						await tagSticker(sticker.id, 'fragment_position', String(sticker.fragmentPosition));
					}
				}
			}

			// Create provider entries to prevent duplicates
			for (const movie of selectedMovies) {
				const exists = await providerExists('imdb', movie.imdbId);
				if (!exists) {
					await createProvider(createdSource.id, 'movie', 'imdb', movie.imdbId);
				}
			}

			toastService.success(`Created source with ${stickersCreated} stickers and award tags`);
		} catch (error) {
			console.error('Failed to create award source:', error);
			toastService.error('Failed to create award source');
		} finally {
			isCreatingSource = false;
		}
	}
</script>

<div class="grid min-h-0 flex-1 grid-cols-5 gap-4">
	<!-- Column 1: Award Selection -->
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
					<!-- Event Selection -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Award Event</span>
						</label>
						<select
							class="select select-bordered select-sm w-full"
							value={selectedEventId}
							onchange={(e) => handleEventChange(e.currentTarget.value)}
						>
							<option value="">Select an event...</option>
							{#each events as event (event.id)}
								<option value={event.id}>{event.name}</option>
							{/each}
						</select>
					</div>

					{#if isLoadingEvent}
						<div class="flex justify-center py-4">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{:else if loadEventError}
						<div class="alert alert-error alert-sm">
							<span class="text-xs">{loadEventError}</span>
						</div>
					{:else if eventData}
						<!-- Year Selection -->
						<div class="form-control">
							<label class="label py-1">
								<span class="label-text text-xs">Year</span>
							</label>
							<select
								class="select select-bordered select-sm w-full"
								value={selectedYear}
								onchange={(e) => handleYearChange(e.currentTarget.value)}
								disabled={years.length === 0}
							>
								<option value="">Select year...</option>
								{#each years as year (year)}
									<option value={year}>{year}</option>
								{/each}
							</select>
						</div>

						<!-- Award Type Selection -->
						{#if selectedYear}
							<div class="form-control">
								<label class="label py-1">
									<span class="label-text text-xs">Award Type</span>
								</label>
								<select
									class="select select-bordered select-sm w-full"
									value={selectedAwardType}
									onchange={(e) => handleAwardTypeChange(e.currentTarget.value)}
									disabled={awardTypes.length === 0}
								>
									<option value="">Select award type...</option>
									{#each awardTypes as awardType (awardType)}
										<option value={awardType}>{formatAwardTypeName(awardType)}</option>
									{/each}
								</select>
							</div>
						{/if}

						<!-- Category info (shows count of categories) -->
						{#if selectedAwardType && categories.length > 0}
							<div class="text-base-content/60 mt-2 text-xs">
								{categories.length} categories loaded
							</div>
						{/if}
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
				{#if movies.length > 0}
					<span class="badge badge-primary">{getSelectedCount()}/{movies.length}</span>
				{/if}
			</div>

			{#if !selectedAwardType}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select an award type to view nominees.</p>
				</div>
			{:else if isLoadingMovies}
				<div class="flex flex-1 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else if movies.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No nominees found.</p>
				</div>
			{:else}
				<div class="mb-2 flex gap-2">
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllMovies(true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllMovies(false)}>
						Select None
					</button>
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-2">
						{#each movies as movie (movie.imdbId)}
							{@const isSelected = selectedMovieForDetails?.imdbId === movie.imdbId}
							<div
								class={classNames(
									'w-full cursor-pointer rounded-lg p-2 text-left transition-colors',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-primary ring-2': isSelected,
										'bg-base-100': !isSelected
									}
								)}
								onclick={() => selectMovieForDetails(movie)}
								onkeydown={(e) => e.key === 'Enter' && selectMovieForDetails(movie)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-1"
										checked={movie.selected}
										onclick={(e) => e.stopPropagation()}
										onchange={() => toggleMovie(movie)}
									/>
									{#if movie.isLoading}
										<div class="bg-base-300 flex h-14 w-10 items-center justify-center rounded">
											<span class="loading loading-spinner loading-xs"></span>
										</div>
									{:else if movie.details?.poster}
										<img
											src={movie.details.poster}
											alt={movie.details.title}
											class="h-14 w-10 rounded object-cover"
										/>
									{:else}
										<div
											class="bg-base-300 text-base-content/30 flex h-14 w-10 items-center justify-center rounded"
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
									<div class="min-w-0 flex-1">
										{#if movie.isLoading}
											<div class="text-base-content/50 truncate text-sm font-medium">
												Loading...
											</div>
											<div class="text-base-content/40 text-xs">{movie.imdbId}</div>
										{:else if movie.error}
											<div class="text-error truncate text-sm font-medium">
												{movie.error}
											</div>
											<div class="text-base-content/60 text-xs">{movie.imdbId}</div>
										{:else if movie.details}
											<div class="truncate text-sm font-medium">{movie.details.title}</div>
											<div class="text-base-content/60 text-xs">{movie.details.year}</div>
										{/if}
										<div class="mt-1 flex flex-wrap gap-1">
											{#if movie.isWinner}
												<span class="badge badge-warning badge-xs">Winner</span>
											{/if}
											<span
												class="badge badge-ghost badge-xs max-w-[100px] truncate"
												title={formatCategoryName(movie.category)}
											>
												{formatCategoryName(movie.category)}
											</span>
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

	<!-- Column 3: Movie Details -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Movie Details</h2>

			{#if !selectedMovieForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a movie to view details.</p>
				</div>
			{:else if selectedMovieForDetails.isLoading}
				<div class="flex flex-1 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else if selectedMovieForDetails.details}
				{@const details = selectedMovieForDetails.details}
				<div class="flex-1 space-y-3 overflow-y-auto">
					<!-- Poster and Basic Info -->
					<div class="flex gap-3">
						{#if details.poster}
							<img
								src={details.poster}
								alt={details.title}
								class="h-30 w-20 rounded object-cover shadow"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<h3 class="line-clamp-2 text-base font-bold">{details.title}</h3>
							<p class="text-base-content/60 text-sm">{details.year}</p>
							{#if details.rated}
								<span class="badge badge-outline badge-xs mt-1">{details.rated}</span>
							{/if}
							{#if details.runtime}
								<span class="badge badge-outline badge-xs ml-1 mt-1">{details.runtime}</span>
							{/if}
							{#if selectedMovieForDetails.isWinner}
								<div class="mt-1">
									<span class="badge badge-warning badge-sm">Winner</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Ratings -->
					{#if details.imdbRating || details.metascore}
						<div class="flex flex-wrap gap-2">
							{#if details.imdbRating}
								<div class="badge badge-warning gap-1">
									<span class="font-bold">IMDb</span>
									{details.imdbRating}
								</div>
							{/if}
							{#if details.metascore}
								<div class="badge badge-info gap-1">
									<span class="font-bold">Meta</span>
									{details.metascore}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Genre -->
					{#if details.genre}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase">Genre</span>
							<p class="text-sm">{details.genre}</p>
						</div>
					{/if}

					<!-- Plot -->
					{#if details.plot}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase">Plot</span>
							<p class="text-sm leading-relaxed">{details.plot}</p>
						</div>
					{/if}

					<!-- Director -->
					{#if details.director}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase">Director</span>
							<p class="text-sm">{details.director}</p>
						</div>
					{/if}

					<!-- Awards -->
					{#if details.awards}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase">Awards</span>
							<p class="text-sm">{details.awards}</p>
						</div>
					{/if}

					<!-- External Links -->
					<div class="divider my-1 text-xs">Links</div>
					<a
						href="https://www.imdb.com/title/{selectedMovieForDetails.imdbId}"
						target="_blank"
						rel="noopener noreferrer"
						class="link link-primary text-xs"
					>
						View on IMDb
					</a>
				</div>
			{:else}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Failed to load movie details.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 4: Poster Preview -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Sticker Preview</h2>

			{#if !selectedMovieForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a movie to preview sticker.</p>
				</div>
			{:else if selectedMovieForDetails.details}
				{@const details = selectedMovieForDetails.details}
				{@const stickerTypeId = selectedMovieForDetails.isWinner ? 'winner' : 'nominee'}
				{@const previewSticker = {
					id: `preview-${selectedMovieForDetails.imdbId}`,
					sourceId: '',
					name: details.title,
					image: details.poster || '',
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
							<p class="text-sm font-medium">{details.title}</p>
							<p class="text-base-content/60 text-xs">{details.year}</p>
							{#if selectedMovieForDetails.isWinner}
								<span class="badge badge-warning badge-sm mt-1">Winner</span>
							{:else}
								<span class="badge badge-ghost badge-sm mt-1">Nominee</span>
							{/if}
						</div>

						<!-- Additional posters from TMDB -->
						{#if selectedMovieForDetails.posterImages.length > 1}
							<div class="divider text-xs">Additional Posters</div>
							<div class="grid grid-cols-2 gap-2">
								{#each selectedMovieForDetails.posterImages.slice(1, 5) as poster, i}
									<img
										src={poster.thumbUrl}
										alt="Poster {i + 2}"
										class="h-auto w-full rounded shadow"
									/>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No preview available.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 5: Create Source -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Create Source</h2>

			{#if !selectedAwardType}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select an award type to create an award source.</p>
				</div>
			{:else if movies.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No movies loaded yet.</p>
				</div>
			{:else}
				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Award Info -->
						<div>
							<h3 class="text-sm font-bold">{getAwardListName()}</h3>
							<p class="text-base-content/60 mt-1 text-xs">
								{formatAwardTypeName(selectedAwardType)}
							</p>
						</div>

						<div class="divider my-2">Summary</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Total nominees:</span>
								<span class="font-mono text-xs">{movies.length}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Selected:</span>
								<span class="font-mono text-xs font-bold">{getSelectedCount()}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Winners:</span>
								<span class="font-mono text-xs">
									{movies.filter((m) => m.isWinner).length}
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
								onclick={createAwardSource}
								disabled={isCreatingSource || getSelectedCount() === 0 || isLoadingMovies}
							>
								{#if isCreatingSource}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Award Source + {getSelectedCount()} Stickers
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
