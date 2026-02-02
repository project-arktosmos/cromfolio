<script lang="ts">
	import classNames from 'classnames';
	import {
		getConsoles,
		getGamesForConsole,
		getAllGames,
		getManufacturerBadgeClass,
		getConsoleTypeBadgeClass,
		formatCopiesSold,
		type ConsoleData,
		type GameWithConsole,
		type GameEntry
	} from '$services/console-bestsellers.service';
	import { searchGames as searchIGDB, type GameSearchResult } from '$services/fetch.service';
	import { addSource } from '$services/sources.service';
	import { addStickersBatch } from '$services/stickers.service';
	import { providerExists, createProvider } from '$services/providers.service';
	import { tagSticker } from '$services/tags.service';
	import { toastService } from '$services/toast.service';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Source } from '$types/source.type';
	import type { Sticker } from '$types/sticker.type';
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

	// Console selection state
	const consoles = getConsoles();
	let selectedConsoleId = $state<string>('');

	// Games list state
	let games = $state<(GameEntry & { consoleId?: string; consoleName?: string })[]>([]);
	let selectedGames = $state<Set<string>>(new Set());

	// Selected game for details
	let selectedGameForDetails = $state<
		(GameEntry & { consoleId?: string; consoleName?: string }) | null
	>(null);

	// IGDB search state
	let igdbResults = $state<GameSearchResult[]>([]);
	let selectedIgdbMatch = $state<GameSearchResult | null>(null);
	let isSearchingIgdb = $state(false);

	// Source creation state
	let isCreatingSource = $state(false);
	let sourceCreated = $state<Source | null>(null);
	let stickersCreated = $state(0);

	// Load games when console changes
	function handleConsoleChange(consoleId: string) {
		selectedConsoleId = consoleId;
		selectedGameForDetails = null;
		igdbResults = [];
		selectedIgdbMatch = null;
		sourceCreated = null;

		if (consoleId === '') {
			// All consoles - load all games
			const allGames = getAllGames();
			games = allGames.map((g) => ({
				...g,
				consoleId: g.consoleId,
				consoleName: g.consoleName
			}));
		} else {
			// Specific console
			const consoleData = consoles.find((c) => c.id === consoleId);
			games = getGamesForConsole(consoleId).map((g) => ({
				...g,
				consoleId,
				consoleName: consoleData?.name
			}));
		}

		// Select all games by default
		selectedGames = new Set(games.map((g) => getGameKey(g)));
	}

	// Initialize with all games
	$effect(() => {
		if (games.length === 0) {
			handleConsoleChange('');
		}
	});

	function getGameKey(game: GameEntry & { consoleId?: string }): string {
		return `${game.consoleId || 'unknown'}-${game.title}`;
	}

	function toggleGame(game: GameEntry & { consoleId?: string }) {
		const key = getGameKey(game);
		if (selectedGames.has(key)) {
			selectedGames.delete(key);
		} else {
			selectedGames.add(key);
		}
		selectedGames = new Set(selectedGames);
	}

	function toggleAllGames(selected: boolean) {
		if (selected) {
			selectedGames = new Set(games.map((g) => getGameKey(g)));
		} else {
			selectedGames = new Set();
		}
	}

	function selectGameForDetails(game: GameEntry & { consoleId?: string; consoleName?: string }) {
		selectedGameForDetails = game;
		igdbResults = [];
		selectedIgdbMatch = null;
		searchIgdbForGame(game.title);
	}

	async function searchIgdbForGame(title: string) {
		isSearchingIgdb = true;
		try {
			const results = await searchIGDB(title);
			igdbResults = results.slice(0, 10);
			// Auto-select best match if score is high enough
			if (igdbResults.length > 0) {
				selectedIgdbMatch = igdbResults[0];
			}
		} catch (error) {
			console.error('IGDB search failed:', error);
			igdbResults = [];
		} finally {
			isSearchingIgdb = false;
		}
	}

	function selectIgdbMatch(match: GameSearchResult) {
		selectedIgdbMatch = match;
	}

	function getSelectedCount(): number {
		return selectedGames.size;
	}

	function getSourceTitle(): string {
		if (selectedConsoleId) {
			const consoleData = consoles.find((c) => c.id === selectedConsoleId);
			return `Best-Selling ${consoleData?.name || 'Console'} Games`;
		}
		return 'Best-Selling Video Games (All Consoles)';
	}

	async function createConsoleSource() {
		const gamesToCreate = games.filter((g) => selectedGames.has(getGameKey(g)));
		if (gamesToCreate.length === 0) return;

		isCreatingSource = true;
		stickersCreated = 0;

		try {
			// Create source
			const sourceTitle = getSourceTitle();
			const source: Source = {
				id: crypto.randomUUID(),
				sourceType: 'game_console',
				title: sourceTitle,
				description: selectedConsoleId
					? `Top ${gamesToCreate.length} best-selling games`
					: `Top ${gamesToCreate.length} best-selling games across all consoles`,
				addedAt: new Date().toISOString()
			};

			const createdSource = await addSource(source);
			if (!createdSource) {
				throw new Error('Failed to create source');
			}

			sourceCreated = createdSource;

			// Create stickers
			const now = new Date().toISOString();
			const stickersToCreate: Sticker[] = [];

			for (const game of gamesToCreate) {
				stickersToCreate.push({
					id: crypto.randomUUID(),
					sourceId: createdSource.id,
					name: game.title,
					image: '', // Will need IGDB lookup for images
					stickerTypeId: 'game',
					imageSource: 'wikipedia',
					addedAt: now
				});
			}

			if (stickersToCreate.length > 0) {
				const created = await addStickersBatch(stickersToCreate);
				stickersCreated = created.length;

				// Add tags to each sticker
				for (let i = 0; i < created.length; i++) {
					const sticker = created[i];
					const game = gamesToCreate[i];

					await tagSticker(sticker.id, 'source', 'wikipedia-bestsellers');
					await tagSticker(sticker.id, 'rank', String(game.rank));
					await tagSticker(sticker.id, 'copies_sold', String(game.copies));

					if (game.consoleId) {
						await tagSticker(sticker.id, 'console', game.consoleId);
					}
					if (game.developer) {
						await tagSticker(sticker.id, 'developer', game.developer);
					}
					if (game.publisher) {
						await tagSticker(sticker.id, 'publisher', game.publisher);
					}
					if (game.genre) {
						await tagSticker(sticker.id, 'genre', game.genre);
					}
				}
			}

			toastService.success(`Created source with ${stickersCreated} stickers`);
		} catch (error) {
			console.error('Failed to create console source:', error);
			toastService.error('Failed to create console source');
		} finally {
			isCreatingSource = false;
		}
	}
</script>

<div class="grid min-h-0 flex-1 grid-cols-5 gap-4">
	<!-- Column 1: Console Selection -->
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
					<!-- Console Selection -->
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs">Game Console</span>
						</label>
						<select
							class="select select-bordered select-sm w-full"
							value={selectedConsoleId}
							onchange={(e) => handleConsoleChange(e.currentTarget.value)}
						>
							<option value="">All Consoles ({games.length} games)</option>
							{#each consoles as console (console.id)}
								<option value={console.id}>
									{console.name} ({console.games.length} games)
								</option>
							{/each}
						</select>
					</div>

					<!-- Console info -->
					{#if selectedConsoleId}
						{@const consoleData = consoles.find((c) => c.id === selectedConsoleId)}
						{#if consoleData}
							<div class="bg-base-100 space-y-1 rounded p-2 text-xs">
								<div class="flex justify-between">
									<span class="text-base-content/60">Manufacturer:</span>
									<span
										class={classNames(
											'badge badge-xs',
											getManufacturerBadgeClass(consoleData.manufacturer)
										)}
									>
										{consoleData.manufacturer}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-base-content/60">Release Year:</span>
									<span>{consoleData.releaseYear}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-base-content/60">Type:</span>
									<span
										class={classNames('badge badge-xs', getConsoleTypeBadgeClass(consoleData.type))}
									>
										{consoleData.type}
									</span>
								</div>
							</div>
						{/if}
					{:else}
						<div class="text-base-content/60 bg-base-100 rounded p-2 text-xs">
							Showing best-selling games across all consoles, sorted by copies sold.
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Column 2: Games List -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="card-title text-lg">Games</h2>
				{#if games.length > 0}
					<span class="badge badge-primary">{getSelectedCount()}/{games.length}</span>
				{/if}
			</div>

			{#if games.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No games available.</p>
				</div>
			{:else}
				<div class="mb-2 flex gap-2">
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllGames(true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" onclick={() => toggleAllGames(false)}>
						Select None
					</button>
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-2">
						{#each games as game (getGameKey(game))}
							{@const isSelected =
								selectedGameForDetails && getGameKey(selectedGameForDetails) === getGameKey(game)}
							<div
								class={classNames(
									'w-full cursor-pointer rounded-lg p-2 text-left transition-colors',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-primary ring-2': isSelected,
										'bg-base-100': !isSelected
									}
								)}
								onclick={() => selectGameForDetails(game)}
								onkeydown={(e) => e.key === 'Enter' && selectGameForDetails(game)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-1"
										checked={selectedGames.has(getGameKey(game))}
										onclick={(e) => e.stopPropagation()}
										onchange={() => toggleGame(game)}
									/>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="badge badge-ghost badge-xs">#{game.rank}</span>
											<span class="truncate text-sm font-medium">{game.title}</span>
										</div>
										<div class="mt-1 flex items-center gap-2">
											<span class="text-base-content/60 text-xs">
												{formatCopiesSold(game.copies)} copies
											</span>
											{#if game.consoleName && !selectedConsoleId}
												<span class="badge badge-outline badge-xs">{game.consoleName}</span>
											{/if}
										</div>
										{#if game.genre}
											<div class="text-base-content/50 mt-1 text-xs">{game.genre}</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: IGDB Match -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">IGDB Match</h2>

			{#if !selectedGameForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a game to search IGDB.</p>
				</div>
			{:else if isSearchingIgdb}
				<div class="flex flex-1 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else}
				<div class="flex-1 space-y-3 overflow-y-auto">
					<div>
						<span class="text-base-content/60 text-xs font-semibold uppercase">Search Query</span>
						<p class="text-sm">{selectedGameForDetails.title}</p>
					</div>

					{#if igdbResults.length > 0}
						<div>
							<span class="text-base-content/60 text-xs font-semibold uppercase">
								Results ({igdbResults.length})
							</span>
						</div>

						<div class="space-y-2">
							{#each igdbResults as result (result.id)}
								{@const isCurrentMatch = selectedIgdbMatch?.id === result.id}
								<div
									class={classNames('cursor-pointer rounded-lg p-2 transition-colors', {
										'bg-success/20 ring-success ring-2': isCurrentMatch,
										'bg-base-100 hover:bg-base-300': !isCurrentMatch
									})}
									onclick={() => selectIgdbMatch(result)}
									onkeydown={(e) => e.key === 'Enter' && selectIgdbMatch(result)}
									role="button"
									tabindex="0"
								>
									<div class="flex gap-2">
										{#if result.coverThumbUrl}
											<img
												src={result.coverThumbUrl}
												alt={result.name}
												class="h-16 w-12 rounded object-cover"
											/>
										{:else}
											<div class="bg-base-300 flex h-16 w-12 items-center justify-center rounded">
												<span class="text-base-content/30 text-xs">No img</span>
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<div class="text-sm font-medium">{result.name}</div>
											{#if result.firstReleaseDate}
												<div class="text-base-content/60 text-xs">
													{new Date(result.firstReleaseDate * 1000).getFullYear()}
												</div>
											{/if}
											{#if result.platforms && result.platforms.length > 0}
												<div class="text-base-content/50 text-xs">
													{result.platforms.slice(0, 3).join(', ')}
												</div>
											{/if}
										</div>
									</div>
									{#if isCurrentMatch}
										<div class="mt-1 flex justify-end">
											<span class="badge badge-success badge-xs">Selected</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-base-content/60 flex flex-1 items-center justify-center">
							<p class="text-sm">No IGDB results found.</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 4: Preview -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Preview</h2>

			{#if !selectedGameForDetails}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">Select a game to preview.</p>
				</div>
			{:else}
				{@const previewSticker = {
					id: `preview-${selectedGameForDetails.title}`,
					sourceId: '',
					name: selectedGameForDetails.title,
					image: selectedIgdbMatch?.coverThumbUrl || '',
					stickerTypeId: 'game'
				} as Sticker}
				{@const previewStickerType = createStickerTypeEntity('game')}

				<div class="flex-1 overflow-y-auto">
					<div class="flex flex-col items-center gap-4">
						<div class="w-48">
							<StickerItem sticker={previewSticker} />
							<div class="bg-base-200 rounded-b p-2">
								{#if previewStickerType}
									<div class="mb-1 flex justify-center">
										<span class={classNames('badge badge-xs', previewStickerType.badgeColor)}>
											{previewStickerType.name}
										</span>
									</div>
								{/if}
								<h3 class="text-center text-xs font-medium leading-tight">
									{previewSticker.name}
								</h3>
							</div>
						</div>

						<div class="space-y-1 text-center">
							<p class="text-sm font-medium">{selectedGameForDetails.title}</p>
							<p class="text-base-content/60 text-xs">
								#{selectedGameForDetails.rank} - {formatCopiesSold(selectedGameForDetails.copies)} copies
							</p>
							{#if selectedGameForDetails.consoleName}
								<span class="badge badge-outline badge-sm"
									>{selectedGameForDetails.consoleName}</span
								>
							{/if}
							{#if selectedGameForDetails.developer}
								<p class="text-base-content/50 text-xs">Dev: {selectedGameForDetails.developer}</p>
							{/if}
							{#if selectedGameForDetails.genre}
								<p class="text-base-content/50 text-xs">{selectedGameForDetails.genre}</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 5: Create Source -->
	<div class="card bg-base-200 flex flex-col overflow-hidden">
		<div class="card-body flex h-full flex-col p-4">
			<h2 class="card-title mb-2 text-lg">Create Source</h2>

			{#if games.length === 0}
				<div class="text-base-content/60 flex flex-1 items-center justify-center">
					<p class="text-sm">No games available.</p>
				</div>
			{:else}
				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<div>
							<h3 class="text-sm font-bold">{getSourceTitle()}</h3>
							<p class="text-base-content/60 mt-1 text-xs">
								{selectedConsoleId
									? consoles.find((c) => c.id === selectedConsoleId)?.name
									: 'All consoles combined'}
							</p>
						</div>

						<div class="divider my-2">Summary</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Total games:</span>
								<span class="font-mono text-xs">{games.length}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Selected:</span>
								<span class="font-mono text-xs font-bold">{getSelectedCount()}</span>
							</div>
							{#if selectedConsoleId}
								{@const consoleData = consoles.find((c) => c.id === selectedConsoleId)}
								{#if consoleData}
									<div class="flex justify-between">
										<span class="text-base-content/60">Console:</span>
										<span class="text-xs">{consoleData.name}</span>
									</div>
								{/if}
							{:else}
								<div class="flex justify-between">
									<span class="text-base-content/60">Consoles:</span>
									<span class="text-xs">{consoles.length}</span>
								</div>
							{/if}
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
								onclick={createConsoleSource}
								disabled={isCreatingSource || getSelectedCount() === 0}
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
