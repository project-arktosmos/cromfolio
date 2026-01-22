<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { addCard } from '$services/cards.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';
	import {
		searchAnimals,
		getSpeciesInGenus,
		fetchSourceImages,
		type AnimalSearchResult,
		type SpeciesResult,
		type ImageItem as FetchImageItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';

	// Local image type for UI
	interface AnimalImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		source: string;
	}

	// Search state
	let searchQuery = $state('');
	let searchResults = $state<AnimalSearchResult[]>([]);
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let selectedGenus = $state<AnimalSearchResult | null>(null);

	// Species state
	let isLoadingSpecies = $state(false);
	let speciesList = $state<SpeciesResult[]>([]);
	let selectedSpecies = $state<Set<string>>(new Set());

	// Species image selection - maps wikidataId to selected image URL
	let speciesImageSelection = $state<Map<string, string>>(new Map());

	// iNaturalist images state
	let focusedSpecies = $state<SpeciesResult | null>(null);
	let iNatImages = $state<AnimalImageItem[]>([]);
	let isLoadingINatImages = $state(false);

	// Image state for genus
	let genusImages = $state<AnimalImageItem[]>([]);
	let selectedCoverImage = $state<string | null>(null);

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);

	// Source existence tracking
	let sourceExistsMap = $state<Map<string, boolean>>(new Map());

	// Progress tracking
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());

	// Handle progress events
	function handleProgress(event: FetchProgressEvent) {
		fetchProgress = new Map(fetchProgress).set(event.source, {
			status: event.status,
			message: event.message
		});
	}

	// Search for genera via Rust backend
	async function searchGenera() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = null;
		searchResults = [];
		selectedGenus = null;
		resetState();

		try {
			const results = await searchAnimals(searchQuery.trim());
			searchResults = results;

			if (searchResults.length === 0) {
				searchError = 'No genera found. Try a Latin genus name like "Panthera" or "Canis".';
			}
		} catch (error) {
			searchError = 'Failed to search genera';
			console.error('[sources] searchGenera error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Reset state
	function resetState() {
		speciesList = [];
		selectedSpecies = new Set();
		speciesImageSelection = new Map();
		genusImages = [];
		selectedCoverImage = null;
		albumCreated = null;
		focusedSpecies = null;
		iNatImages = [];
	}

	// Check if source already exists in database
	async function checkSourceExists(wikidataId: string): Promise<boolean> {
		if (sourceExistsMap.has(wikidataId)) {
			return sourceExistsMap.get(wikidataId)!;
		}
		const exists = await sourceExists('wikidata', wikidataId);
		sourceExistsMap = new Map(sourceExistsMap).set(wikidataId, exists);
		return exists;
	}

	// Check if source is already added (from cache)
	function isSourceAdded(wikidataId: string): boolean {
		return sourceExistsMap.get(wikidataId) ?? false;
	}

	// Select a genus and fetch its species
	async function selectGenus(genus: AnimalSearchResult) {
		if (selectedGenus?.wikidataId === genus.wikidataId) {
			selectedGenus = null;
			resetState();
		} else {
			selectedGenus = genus;
			albumCreated = null;
			selectedCoverImage = genus.imageUrl || null;
			fetchProgress = new Map();

			// Set genus image
			if (genus.imageUrl && genus.thumbUrl) {
				genusImages = [
					{
						url: genus.imageUrl,
						thumbUrl: genus.thumbUrl,
						type: 'genus-image',
						source: 'wikimedia'
					}
				];
			}

			// Check source existence and fetch species in parallel
			await Promise.all([
				checkSourceExists(genus.wikidataId),
				fetchSpecies(genus)
			]);
		}
	}

	// Fetch species within a genus via Rust backend
	async function fetchSpecies(genus: AnimalSearchResult) {
		isLoadingSpecies = true;
		speciesList = [];
		selectedSpecies = new Set();
		speciesImageSelection = new Map();
		focusedSpecies = null;
		iNatImages = [];

		try {
			const results = await getSpeciesInGenus(genus.wikidataId);
			const initialImageSelection = new Map<string, string>();

			for (const species of results) {
				// Set initial image selection to Wikimedia image if available
				if (species.imageUrl) {
					initialImageSelection.set(species.wikidataId, species.imageUrl);
				}
			}

			speciesList = results;
			speciesImageSelection = initialImageSelection;

			// Auto-select all species by default
			selectedSpecies = new Set(results.map((s) => s.wikidataId));
		} catch (error) {
			console.error('[sources] fetchSpecies error:', error);
		} finally {
			isLoadingSpecies = false;
		}
	}

	// Focus on a species to load its iNaturalist images via Rust backend
	async function focusOnSpecies(species: SpeciesResult) {
		if (focusedSpecies?.wikidataId === species.wikidataId) {
			focusedSpecies = null;
			iNatImages = [];
			return;
		}

		focusedSpecies = species;
		iNatImages = [];
		isLoadingINatImages = true;

		try {
			const result = await fetchSourceImages({
				contentType: 'animal',
				externalId: species.scientificName,
				externalIdType: 'scientific_name',
				sources: ['inaturalist'],
				onProgress: handleProgress
			});

			iNatImages = result.images.map((img, index) => ({
				url: img.url,
				thumbUrl: img.thumbUrl,
				type: `inat-${index}`,
				source: img.source
			}));
		} catch (error) {
			console.error('[sources] fetchINatImages error:', error);
		} finally {
			isLoadingINatImages = false;
		}
	}

	// Select an image for a species card
	function selectSpeciesImage(speciesId: string, imageUrl: string) {
		const newMap = new Map(speciesImageSelection);
		newMap.set(speciesId, imageUrl);
		speciesImageSelection = newMap;
	}

	// Toggle species selection
	function toggleSpecies(wikidataId: string) {
		const newSet = new Set(selectedSpecies);
		if (newSet.has(wikidataId)) {
			newSet.delete(wikidataId);
		} else {
			newSet.add(wikidataId);
		}
		selectedSpecies = newSet;
	}

	// Select/deselect all species
	function toggleAllSpecies() {
		if (selectedSpecies.size === speciesList.length) {
			selectedSpecies = new Set();
		} else {
			selectedSpecies = new Set(speciesList.map((s) => s.wikidataId));
		}
	}

	// Select cover image
	function selectCoverImage(url: string) {
		selectedCoverImage = selectedCoverImage === url ? null : url;
	}

	// Create album and cards from selected genus/species
	async function createAlbumFromGenus() {
		if (!selectedGenus || selectedSpecies.size === 0) return;

		// Check if already added
		const alreadyAdded = await sourceExists('wikidata', selectedGenus.wikidataId);
		if (alreadyAdded) {
			console.warn('[sources] Genus already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			// Create album for the genus
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'animal',
				title: selectedGenus.genusName,
				description: selectedGenus.description || `Genus ${selectedGenus.genusName}${selectedGenus.taxonomicFamily ? ` (${selectedGenus.taxonomicFamily})` : ''}`,
				coverImage: selectedCoverImage || undefined,
				wikidataId: selectedGenus.wikidataId,
				scientificName: selectedGenus.genusName,
				taxonomicClass: selectedGenus.taxonomicFamily,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'animal', 'wikidata', selectedGenus.wikidataId);

				// Create cards for each selected species
				const selectedSpeciesList = speciesList.filter((s) => selectedSpecies.has(s.wikidataId));

				for (const species of selectedSpeciesList) {
					const card: Card = {
						id: crypto.randomUUID(),
						albumId: createdAlbum.id,
						name: species.commonName || species.scientificName,
						image: getSpeciesImage(species),
						addedAt: new Date().toISOString()
					};

					await addCard(card);
				}

				albumCreated = createdAlbum;
				// Update local cache
				sourceExistsMap = new Map(sourceExistsMap).set(selectedGenus.wikidataId, true);
			}
		} catch (error) {
			console.error('[sources] createAlbumFromGenus error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Get the selected image for a species (or default to Wikimedia)
	function getSpeciesImage(species: SpeciesResult): string {
		return speciesImageSelection.get(species.wikidataId) || species.imageUrl || '';
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		searchResults = [];
		searchError = null;
		selectedGenus = null;
		resetState();
	}
</script>

<div class="grid grid-cols-4 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search Genera -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Genera</h2>

			<div class="space-y-3">
				<!-- Search input -->
				<div class="form-control">
					<input
						type="text"
						placeholder="Latin genus name (e.g., Panthera, Canis)..."
						class="input input-bordered input-sm w-full"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && searchGenera()}
					/>
				</div>

				<!-- Search button -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={searchGenera}
						disabled={!searchQuery.trim() || isSearching}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Search
						{/if}
					</button>

					{#if searchResults.length > 0}
						<button class="btn btn-ghost btn-sm" onclick={resetSearch}>
							Clear
						</button>
					{/if}
				</div>
			</div>

			<!-- Error message -->
			{#if searchError}
				<div class="alert alert-warning alert-sm mt-3">
					<span class="text-sm">{searchError}</span>
				</div>
			{/if}

			<!-- Results -->
			<div class="flex-1 overflow-y-auto mt-3">
				{#if searchResults.length > 0}
					<div class="space-y-2">
						{#each searchResults as genus (genus.wikidataId)}
							{@const alreadyExists = isSourceAdded(genus.wikidataId)}
							<div
								class={classNames(
									'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedGenus?.wikidataId === genus.wikidataId,
										'bg-base-100': selectedGenus?.wikidataId !== genus.wikidataId
									}
								)}
								onclick={() => selectGenus(genus)}
								onkeydown={(e) => e.key === 'Enter' && selectGenus(genus)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									{#if genus.thumbUrl}
										<img
											src={genus.thumbUrl}
											alt={genus.genusName}
											class="w-10 h-14 object-cover rounded"
											onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
										/>
									{:else}
										<div class="w-10 h-14 bg-base-300 rounded flex items-center justify-center text-base-content/30 shrink-0">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
											</svg>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm italic">{genus.genusName}</div>
										{#if genus.taxonomicFamily}
											<div class="text-xs text-base-content/60">
												Family: {genus.taxonomicFamily}
											</div>
										{/if}
										{#if genus.description}
											<div class="text-xs text-base-content/50 line-clamp-2">
												{genus.description}
											</div>
										{/if}
										{#if genus.commonName}
											<div class="text-xs text-base-content/60">
												{genus.commonName}
											</div>
										{/if}
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

	<!-- Column 2: Species (Cards) -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<div class="flex items-center justify-between mb-2">
				<h2 class="card-title text-lg">Species (Cards)</h2>
				{#if speciesList.length > 0}
					<button class="btn btn-ghost btn-xs" onclick={toggleAllSpecies}>
						{selectedSpecies.size === speciesList.length ? 'Deselect All' : 'Select All'}
					</button>
				{/if}
			</div>

			{#if !selectedGenus}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a genus to view species.</p>
				</div>
			{:else if isLoadingSpecies}
				<div class="flex-1 flex items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else}
				<!-- Species list -->
				<div class="flex-1 overflow-y-auto">
					{#if speciesList.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p class="text-sm">No species found for this genus.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each speciesList as species (species.wikidataId)}
								{@const isSelected = selectedSpecies.has(species.wikidataId)}
								{@const isFocused = focusedSpecies?.wikidataId === species.wikidataId}
								{@const selectedImage = getSpeciesImage(species)}
								<div
									class={classNames(
										'p-2 rounded-lg transition-colors',
										{
											'bg-success/20': isSelected && !isFocused,
											'bg-primary/20 ring-2 ring-primary': isFocused,
											'bg-base-100': !isSelected && !isFocused
										}
									)}
								>
									<div class="flex items-center gap-2">
										<input
											type="checkbox"
											class="checkbox checkbox-sm checkbox-success"
											checked={isSelected}
											onchange={() => toggleSpecies(species.wikidataId)}
										/>
										<button
											class="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-base-300/50 rounded p-1 -m-1"
											onclick={() => focusOnSpecies(species)}
										>
											{#if selectedImage}
												<img
													src={species.thumbUrl || selectedImage}
													alt={species.scientificName}
													class="w-8 h-8 object-cover rounded"
													onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
												/>
											{:else}
												<div class="w-8 h-8 bg-base-300 rounded flex items-center justify-center text-base-content/20">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
													</svg>
												</div>
											{/if}
											<div class="flex-1 min-w-0">
												<div class="text-sm font-medium truncate">
													{species.commonName || species.speciesEpithet}
												</div>
												<div class="text-xs text-base-content/60 italic truncate">
													{species.scientificName}
												</div>
											</div>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Selected count -->
				{#if speciesList.length > 0}
					<div class="mt-2 text-xs text-base-content/60 text-center">
						{selectedSpecies.size} of {speciesList.length} species selected
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Column 3: iNaturalist Images -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Species Images</h2>

			{#if !focusedSpecies}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm text-center">Click on a species to browse<br />iNaturalist photos.</p>
				</div>
			{:else}
				<div class="mb-2">
					<div class="font-medium text-sm">{focusedSpecies.commonName || focusedSpecies.speciesEpithet}</div>
					<div class="text-xs text-base-content/60 italic">{focusedSpecies.scientificName}</div>
				</div>

				{#if isLoadingINatImages}
					<div class="flex-1 flex items-center justify-center">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else}
					<div class="flex-1 overflow-y-auto">
						{#if iNatImages.length === 0 && !focusedSpecies.imageUrl}
							<div class="text-center text-base-content/60 p-4">
								<p class="text-sm">No images found on iNaturalist.</p>
							</div>
						{:else}
							<div class="grid grid-cols-3 gap-2">
								<!-- Wikimedia image first if available -->
								{#if focusedSpecies.imageUrl}
									<button
										class={classNames(
											'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': speciesImageSelection.get(focusedSpecies.wikidataId) === focusedSpecies.imageUrl
											}
										)}
										onclick={() => selectSpeciesImage(focusedSpecies!.wikidataId, focusedSpecies!.imageUrl!)}
										title="Wikimedia Commons"
									>
										<img
											src={focusedSpecies.thumbUrl || focusedSpecies.imageUrl}
											alt="Wikimedia"
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
										/>
										<div class="absolute bottom-0 left-0 right-0 bg-base-300/80 px-1 py-0.5">
											<span class="text-xs">Wikimedia</span>
										</div>
										{#if speciesImageSelection.get(focusedSpecies.wikidataId) === focusedSpecies.imageUrl}
											<div class="absolute top-1 right-1">
												<span class="badge badge-success badge-xs">Selected</span>
											</div>
										{/if}
									</button>
								{/if}

								<!-- iNaturalist images -->
								{#each iNatImages as image, i (image.type)}
									<button
										class={classNames(
											'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': speciesImageSelection.get(focusedSpecies.wikidataId) === image.url
											}
										)}
										onclick={() => selectSpeciesImage(focusedSpecies!.wikidataId, image.url)}
										title={`iNaturalist photo ${i + 1}`}
									>
										<img
											src={image.thumbUrl || image.url}
											alt={`Photo ${i + 1}`}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
										/>
										<div class="absolute bottom-0 left-0 right-0 bg-base-300/80 px-1 py-0.5">
											<span class="text-xs">iNat #{i + 1}</span>
										</div>
										{#if speciesImageSelection.get(focusedSpecies.wikidataId) === image.url}
											<div class="absolute top-1 right-1">
												<span class="badge badge-success badge-xs">Selected</span>
											</div>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="mt-2 text-xs text-base-content/60 text-center">
						{iNatImages.length + (focusedSpecies.imageUrl ? 1 : 0)} images available
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Column 4: Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedGenus}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select a genus to create an album.</p>
					</div>
				{:else}
					<div class="space-y-4">
						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCoverImage}
								<img
									src={selectedCoverImage}
									alt={selectedGenus.genusName}
									class="w-20 h-28 object-cover rounded"
									onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
								/>
							{:else}
								<div class="w-20 h-28 bg-base-300 rounded flex items-center justify-center text-base-content/30">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold italic">{selectedGenus.genusName}</h3>
								{#if selectedGenus.taxonomicFamily}
									<p class="text-xs text-base-content/50">Family: {selectedGenus.taxonomicFamily}</p>
								{/if}
								{#if selectedGenus.description}
									<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
										{selectedGenus.description}
									</p>
								{/if}
								<a
									href="https://www.wikidata.org/wiki/{selectedGenus.wikidataId}"
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary text-xs mt-1 block"
								>
									Wikidata
								</a>
							</div>
						</div>

						<!-- Album details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Wikidata ID:</span>
								<span class="font-mono text-xs">{selectedGenus.wikidataId}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Species Found:</span>
								<span class="text-xs">{speciesList.length}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Cards to Create:</span>
								<span class="text-xs font-semibold text-success">{selectedSpecies.size}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">With Images:</span>
								<span class="text-xs">{speciesList.filter(s => selectedSpecies.has(s.wikidataId) && getSpeciesImage(s)).length}</span>
							</div>
						</div>

						<!-- Cover Image Selection -->
						{#if speciesList.filter(s => getSpeciesImage(s)).length > 0}
							<div class="divider my-2">Cover Image</div>
							<div class="grid grid-cols-4 gap-1 max-h-24 overflow-y-auto">
								{#each speciesList.filter(s => getSpeciesImage(s)) as species (species.wikidataId)}
									{@const imgUrl = getSpeciesImage(species)}
									<button
										class={classNames(
											'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
											'hover:ring-2 hover:ring-primary',
											{
												'ring-2 ring-success': selectedCoverImage === imgUrl
											}
										)}
										onclick={() => selectCoverImage(imgUrl)}
										title={species.scientificName}
									>
										<img
											src={species.thumbUrl || imgUrl}
											alt={species.scientificName}
											class="w-full h-full object-cover"
											loading="lazy"
											onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
										/>
									</button>
								{/each}
							</div>
						{/if}

						<!-- Create button -->
						{#if albumCreated}
							<div class="alert alert-success">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<div class="text-sm">
									<p>Album created!</p>
									<p class="text-xs opacity-70">{selectedSpecies.size} cards added</p>
								</div>
							</div>
							<a href="/admin/album" class="btn btn-outline btn-sm w-full">
								Go to Album Manager
							</a>
						{:else if selectedSpecies.size === 0}
							<div class="alert alert-warning">
								<span class="text-sm">Select at least one species.</span>
							</div>
						{:else if isSourceAdded(selectedGenus.wikidataId)}
							<div class="alert alert-warning">
								<span class="text-sm">This genus has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumFromGenus}
								disabled={isCreatingAlbum || selectedSpecies.size === 0}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Album ({selectedSpecies.size} cards)
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
