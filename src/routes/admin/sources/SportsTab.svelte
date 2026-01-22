<script lang="ts">
	import classNames from 'classnames';
	import { addAlbum } from '$services/albums.service';
	import { sourceExists, createSource } from '$services/sources.service';
	import type { Album } from '$types/album.type';
	import {
		searchSportsTeams,
		searchSportsLeagues,
		getTeamsInLeague,
		fetchSourceImages,
		type SportsTeamSearchResult,
		type SportsLeagueSearchResult,
		type ImageItem as FetchImageItem,
		type FetchProgressEvent,
		type FetchStatus
	} from '$services/fetch.service';

	// Local image/player types for UI
	interface SportsImageItem {
		url: string;
		thumbUrl: string;
		type: string;
		source: string;
	}

	interface SportsPlayerSearchResult {
		idPlayer: string;
		strPlayer: string;
		strPosition?: string;
		strThumb?: string;
		strCutout?: string;
	}

	// Search mode: teams or leagues
	let searchMode = $state<'teams' | 'leagues'>('teams');

	// Teams search state
	let teamSearchQuery = $state('');
	let teamResults = $state<SportsTeamSearchResult[]>([]);
	let isSearchingTeams = $state(false);
	let teamError = $state<string | null>(null);
	let selectedTeam = $state<SportsTeamSearchResult | null>(null);

	// Leagues search state
	let leagueCountry = $state('');
	let leagueResults = $state<SportsLeagueSearchResult[]>([]);
	let isSearchingLeagues = $state(false);
	let leagueError = $state<string | null>(null);
	let selectedLeague = $state<SportsLeagueSearchResult | null>(null);

	// Teams in selected league
	let teamsInLeague = $state<SportsTeamSearchResult[]>([]);
	let isLoadingTeamsInLeague = $state(false);

	// Players in selected team
	let playersInTeam = $state<SportsPlayerSearchResult[]>([]);
	let isLoadingPlayers = $state(false);

	// Images state
	let teamImages = $state<SportsImageItem[]>([]);
	let leagueImages = $state<SportsImageItem[]>([]);
	let selectedCover = $state<string | null>(null);

	// Album creation state
	let isCreatingAlbum = $state(false);
	let albumCreated = $state<Album | null>(null);

	// Source existence tracking (for teams and leagues)
	let teamSourceExistsMap = $state<Map<string, boolean>>(new Map());
	let leagueSourceExistsMap = $state<Map<string, boolean>>(new Map());

	// Progress tracking
	let fetchProgress = $state<Map<string, { status: FetchStatus; message?: string }>>(new Map());

	// Handle progress events
	function handleProgress(event: FetchProgressEvent) {
		fetchProgress = new Map(fetchProgress).set(event.source, {
			status: event.status,
			message: event.message
		});
	}

	// Search teams via Rust backend
	async function searchTeams() {
		if (!teamSearchQuery.trim()) return;

		isSearchingTeams = true;
		teamError = null;
		teamResults = [];
		selectedTeam = null;
		resetImages();

		try {
			const results = await searchSportsTeams(teamSearchQuery.trim());
			if (results.length > 0) {
				teamResults = results;
			} else {
				teamError = 'No teams found';
			}
		} catch (error) {
			teamError = 'Failed to search teams';
			console.error('[sports] searchTeams error:', error);
		} finally {
			isSearchingTeams = false;
		}
	}

	// Search leagues by country via Rust backend
	async function searchLeagues() {
		isSearchingLeagues = true;
		leagueError = null;
		leagueResults = [];
		selectedLeague = null;
		teamsInLeague = [];
		resetImages();

		try {
			const results = await searchSportsLeagues(leagueCountry.trim() || 'England');
			if (results.length > 0) {
				leagueResults = results;
			} else {
				leagueError = 'No leagues found';
			}
		} catch (error) {
			leagueError = 'Failed to search leagues';
			console.error('[sports] searchLeagues error:', error);
		} finally {
			isSearchingLeagues = false;
		}
	}

	// Reset images
	function resetImages() {
		teamImages = [];
		leagueImages = [];
		selectedCover = null;
		playersInTeam = [];
	}

	// Check if team source already exists in database
	async function checkTeamSourceExists(teamId: string): Promise<boolean> {
		if (teamSourceExistsMap.has(teamId)) {
			return teamSourceExistsMap.get(teamId)!;
		}
		const exists = await sourceExists('sportsdb_team', teamId);
		teamSourceExistsMap = new Map(teamSourceExistsMap).set(teamId, exists);
		return exists;
	}

	// Check if league source already exists in database
	async function checkLeagueSourceExists(leagueId: string): Promise<boolean> {
		if (leagueSourceExistsMap.has(leagueId)) {
			return leagueSourceExistsMap.get(leagueId)!;
		}
		const exists = await sourceExists('sportsdb_league', leagueId);
		leagueSourceExistsMap = new Map(leagueSourceExistsMap).set(leagueId, exists);
		return exists;
	}

	// Check if team is already added (from cache)
	function isTeamSourceAdded(teamId: string): boolean {
		return teamSourceExistsMap.get(teamId) ?? false;
	}

	// Check if league is already added (from cache)
	function isLeagueSourceAdded(leagueId: string): boolean {
		return leagueSourceExistsMap.get(leagueId) ?? false;
	}

	// Select a team and fetch images/players
	async function selectTeam(team: SportsTeamSearchResult) {
		if (selectedTeam?.id === team.id) {
			selectedTeam = null;
			resetImages();
		} else {
			selectedTeam = team;
			selectedLeague = null;
			albumCreated = null;
			selectedCover = team.badgeUrl || null;
			fetchProgress = new Map();
			// Extract images from the team data we already have
			extractTeamImages(team);
			// Check source existence and fetch additional data via Rust backend
			await Promise.all([
				checkTeamSourceExists(team.id),
				fetchTeamData(team)
			]);
		}
	}

	// Select a league and fetch teams/images
	async function selectLeague(league: SportsLeagueSearchResult) {
		if (selectedLeague?.id === league.id) {
			selectedLeague = null;
			teamsInLeague = [];
			resetImages();
		} else {
			selectedLeague = league;
			selectedTeam = null;
			albumCreated = null;
			selectedCover = league.badgeUrl || league.logoUrl || null;
			fetchProgress = new Map();
			// Extract images from the league data we already have
			extractLeagueImages(league);
			// Check source existence and fetch teams via Rust backend
			await Promise.all([
				checkLeagueSourceExists(league.id),
				fetchLeagueTeams(league.name)
			]);
		}
	}

	// Fetch additional team data via Rust backend
	async function fetchTeamData(team: SportsTeamSearchResult) {
		isLoadingPlayers = true;
		playersInTeam = [];

		try {
			// Fetch images via batch fetch
			const result = await fetchSourceImages({
				contentType: 'sports',
				externalId: team.id,
				externalIdType: 'team',
				sources: ['team'],
				onProgress: handleProgress
			});

			// Add any additional images from the fetch result
			const additionalImages: SportsImageItem[] = result.images.map(img => ({
				url: img.url,
				thumbUrl: img.thumbUrl,
				type: img.imageType,
				source: img.source
			}));

			// Merge with existing images, avoiding duplicates
			const existingUrls = new Set(teamImages.map(i => i.url));
			for (const img of additionalImages) {
				if (!existingUrls.has(img.url)) {
					teamImages = [...teamImages, img];
				}
			}

			// Players would come from characters in the batch result
			// For now, we extract from the existing team data
		} catch (error) {
			console.error('[sports] fetchTeamData error:', error);
		} finally {
			isLoadingPlayers = false;
		}
	}

	// Fetch teams in league via Rust backend
	async function fetchLeagueTeams(leagueName: string) {
		isLoadingTeamsInLeague = true;
		teamsInLeague = [];

		try {
			const teams = await getTeamsInLeague(leagueName);
			teamsInLeague = teams;
		} catch (error) {
			console.error('[sports] fetchLeagueTeams error:', error);
		} finally {
			isLoadingTeamsInLeague = false;
		}
	}

	// Extract images from team data
	function extractTeamImages(team: SportsTeamSearchResult) {
		const images: SportsImageItem[] = [];

		if (team.badgeUrl) {
			images.push({
				url: team.badgeUrl,
				thumbUrl: team.badgeUrl + '/small',
				type: 'badge',
				source: 'thesportsdb'
			});
		}
		if (team.logoUrl) {
			images.push({
				url: team.logoUrl,
				thumbUrl: team.logoUrl + '/small',
				type: 'logo',
				source: 'thesportsdb'
			});
		}

		teamImages = images;
	}

	// Extract images from league data
	function extractLeagueImages(league: SportsLeagueSearchResult) {
		const images: SportsImageItem[] = [];

		if (league.badgeUrl) {
			images.push({
				url: league.badgeUrl,
				thumbUrl: league.badgeUrl + '/small',
				type: 'badge',
				source: 'thesportsdb'
			});
		}
		if (league.logoUrl) {
			images.push({
				url: league.logoUrl,
				thumbUrl: league.logoUrl + '/small',
				type: 'logo',
				source: 'thesportsdb'
			});
		}
		if (league.bannerUrl) {
			images.push({
				url: league.bannerUrl,
				thumbUrl: league.bannerUrl + '/small',
				type: 'banner',
				source: 'thesportsdb'
			});
		}

		leagueImages = images;
	}

	// Select cover image
	function selectCover(url: string) {
		selectedCover = selectedCover === url ? null : url;
	}

	// Create album from selected team
	async function createAlbumFromTeam() {
		if (!selectedTeam) return;

		// Check if already added
		const alreadyAdded = await sourceExists('sportsdb_team', selectedTeam.id);
		if (alreadyAdded) {
			console.warn('[sports] Team already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'sports_league',
				title: selectedTeam.name,
				description: `${selectedTeam.sport} team - ${selectedTeam.league}${selectedTeam.country ? ` (${selectedTeam.country})` : ''}`,
				coverImage: selectedCover || undefined,
				sportsType: 'team',
				sportsDbTeamId: selectedTeam.id,
				sportsDbLeagueId: selectedTeam.leagueId,
				sport: selectedTeam.sport,
				league: selectedTeam.league,
				country: selectedTeam.country || undefined,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'sports_team', 'sportsdb_team', selectedTeam.id);
				albumCreated = createdAlbum;
				// Update local cache
				teamSourceExistsMap = new Map(teamSourceExistsMap).set(selectedTeam.id, true);
			}
		} catch (error) {
			console.error('[sports] createAlbumFromTeam error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Create album from selected league
	async function createAlbumFromLeague() {
		if (!selectedLeague) return;

		// Check if already added
		const alreadyAdded = await sourceExists('sportsdb_league', selectedLeague.id);
		if (alreadyAdded) {
			console.warn('[sports] League already added');
			return;
		}

		isCreatingAlbum = true;

		try {
			const album: Album = {
				id: crypto.randomUUID(),
				albumType: 'sports_league',
				title: selectedLeague.name,
				description: `${selectedLeague.sport} competition${selectedLeague.country ? ` (${selectedLeague.country})` : ''}`,
				coverImage: selectedCover || undefined,
				sportsType: 'league',
				sportsDbLeagueId: selectedLeague.id,
				sport: selectedLeague.sport,
				country: selectedLeague.country || undefined,
				addedAt: new Date().toISOString()
			};

			const createdAlbum = await addAlbum(album);
			if (createdAlbum) {
				// Create source entry to prevent duplicates
				await createSource(createdAlbum.id, 'sports_league', 'sportsdb_league', selectedLeague.id);
				albumCreated = createdAlbum;
				// Update local cache
				leagueSourceExistsMap = new Map(leagueSourceExistsMap).set(selectedLeague.id, true);
			}
		} catch (error) {
			console.error('[sports] createAlbumFromLeague error:', error);
		} finally {
			isCreatingAlbum = false;
		}
	}

	// Reset search
	function resetSearch() {
		teamSearchQuery = '';
		leagueCountry = '';
		teamResults = [];
		leagueResults = [];
		teamError = null;
		leagueError = null;
		selectedTeam = null;
		selectedLeague = null;
		teamsInLeague = [];
		playersInTeam = [];
		albumCreated = null;
		resetImages();
	}

	// Get current images based on selection
	function getCurrentImages(): SportsImageItem[] {
		if (selectedTeam) return teamImages;
		if (selectedLeague) return leagueImages;
		return [];
	}

	// Get selected item title
	function getSelectedTitle(): string {
		if (selectedTeam) return selectedTeam.name;
		if (selectedLeague) return selectedLeague.name;
		return '';
	}
</script>

<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
	<!-- Column 1: Search -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Search Sports</h2>

			<!-- Search mode tabs -->
			<div class="tabs tabs-boxed tabs-sm mb-3">
				<button
					class={classNames('tab', { 'tab-active': searchMode === 'teams' })}
					onclick={() => {
						searchMode = 'teams';
						resetSearch();
					}}
				>
					Teams
				</button>
				<button
					class={classNames('tab', { 'tab-active': searchMode === 'leagues' })}
					onclick={() => {
						searchMode = 'leagues';
						resetSearch();
					}}
				>
					Leagues
				</button>
			</div>

			{#if searchMode === 'teams'}
				<div class="space-y-3">
					<div class="form-control">
						<input
							type="text"
							placeholder="Search teams by name..."
							class="input input-bordered input-sm w-full"
							bind:value={teamSearchQuery}
							onkeydown={(e) => e.key === 'Enter' && searchTeams()}
						/>
						<label class="label py-1">
							<span class="label-text-alt text-base-content/50">Use full names: "Real Madrid", "Los Angeles Lakers"</span>
						</label>
					</div>

					<div class="flex gap-2">
						<button
							class="btn btn-primary btn-sm flex-1"
							onclick={searchTeams}
							disabled={!teamSearchQuery.trim() || isSearchingTeams}
						>
							{#if isSearchingTeams}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Search
							{/if}
						</button>

						{#if teamResults.length > 0}
							<button class="btn btn-ghost btn-sm" onclick={resetSearch}>
								Clear
							</button>
						{/if}
					</div>
				</div>

				{#if teamError}
					<div class="alert alert-error alert-sm mt-3">
						<span class="text-sm">{teamError}</span>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto mt-3">
					{#if teamResults.length > 0}
						<div class="space-y-2">
							{#each teamResults as team (team.id)}
								{@const alreadyExists = isTeamSourceAdded(team.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedTeam?.id === team.id,
											'bg-base-100': selectedTeam?.id !== team.id
										}
									)}
									onclick={() => selectTeam(team)}
									onkeydown={(e) => e.key === 'Enter' && selectTeam(team)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if team.badgeUrl}
											<img
												src={team.badgeUrl + '/small'}
												alt={team.name}
												class="w-10 h-10 object-contain rounded bg-base-100"
											/>
										{:else}
											<div class="w-10 h-10 bg-base-300 rounded flex items-center justify-center text-base-content/30">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{team.name}</div>
											<div class="text-xs text-base-content/60">
												{team.sport}
												{#if team.league}
													&middot; {team.league}
												{/if}
											</div>
											{#if team.country}
												<div class="text-xs text-base-content/50">{team.country}</div>
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
			{:else}
				<div class="space-y-3">
					<div class="form-control">
						<input
							type="text"
							placeholder="Country (e.g., England, Spain)..."
							class="input input-bordered input-sm w-full"
							bind:value={leagueCountry}
							onkeydown={(e) => e.key === 'Enter' && searchLeagues()}
						/>
					</div>

					<div class="flex gap-2">
						<button
							class="btn btn-primary btn-sm flex-1"
							onclick={searchLeagues}
							disabled={isSearchingLeagues}
						>
							{#if isSearchingLeagues}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Search
							{/if}
						</button>

						{#if leagueResults.length > 0}
							<button class="btn btn-ghost btn-sm" onclick={resetSearch}>
								Clear
							</button>
						{/if}
					</div>
				</div>

				{#if leagueError}
					<div class="alert alert-error alert-sm mt-3">
						<span class="text-sm">{leagueError}</span>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto mt-3">
					{#if leagueResults.length > 0}
						<div class="space-y-2">
							{#each leagueResults as league (league.id)}
								{@const alreadyExists = isLeagueSourceAdded(league.id)}
								<div
									class={classNames(
										'w-full text-left p-2 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedLeague?.id === league.id,
											'bg-base-100': selectedLeague?.id !== league.id
										}
									)}
									onclick={() => selectLeague(league)}
									onkeydown={(e) => e.key === 'Enter' && selectLeague(league)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-2">
										{#if league.badgeUrl || league.logoUrl}
											<img
												src={(league.badgeUrl || league.logoUrl) + '/small'}
												alt={league.name}
												class="w-10 h-10 object-contain rounded bg-base-100"
											/>
										{:else}
											<div class="w-10 h-10 bg-base-300 rounded flex items-center justify-center text-base-content/30">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{league.name}</div>
											<div class="text-xs text-base-content/60">
												{league.sport}
											</div>
											{#if league.country}
												<div class="text-xs text-base-content/50">{league.country}</div>
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
			{/if}
		</div>
	</div>

	<!-- Column 2: Images & Related -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Images & Related</h2>

			{#if !selectedTeam && !selectedLeague}
				<div class="flex-1 flex items-center justify-center text-base-content/60">
					<p class="text-sm">Select a team or league to view images.</p>
				</div>
			{:else}
				<!-- Images section -->
				<div class="mb-4">
					<h3 class="text-sm font-semibold mb-2">Cover Images</h3>
					{#if getCurrentImages().length === 0}
						<div class="text-center text-base-content/60 p-4 bg-base-300 rounded">
							<p class="text-sm">No images available.</p>
						</div>
					{:else}
						<div class="grid grid-cols-3 gap-2">
							{#each getCurrentImages() as image, i (image.url + i)}
								<button
									class={classNames(
										'relative aspect-square rounded overflow-hidden transition-all bg-base-300',
										'hover:ring-2 hover:ring-primary',
										{
											'ring-2 ring-success': selectedCover === image.url
										}
									)}
									onclick={() => selectCover(image.url)}
									title={`${image.type} - Click to select as cover`}
								>
									<img
										src={image.thumbUrl || image.url}
										alt={image.type}
										class="w-full h-full object-contain p-1"
										loading="lazy"
										onerror={(e) => {
											(e.target as HTMLImageElement).style.display = 'none';
										}}
									/>
									{#if selectedCover === image.url}
										<div class="absolute top-1 right-1">
											<span class="badge badge-success badge-xs">Cover</span>
										</div>
									{/if}
									<div class="absolute bottom-0 left-0 right-0 bg-base-300/80 px-1 py-0.5">
										<span class="text-xs truncate block">{image.type}</span>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Related items section -->
				<div class="flex-1 overflow-hidden flex flex-col">
					{#if selectedTeam}
						<h3 class="text-sm font-semibold mb-2">
							Players ({playersInTeam.length})
							{#if isLoadingPlayers}
								<span class="loading loading-spinner loading-xs ml-2"></span>
							{/if}
						</h3>
						<div class="flex-1 overflow-y-auto">
							{#if playersInTeam.length > 0}
								<div class="grid grid-cols-3 gap-2">
									{#each playersInTeam as player (player.idPlayer)}
										<div class="bg-base-100 rounded p-2 text-center">
											{#if player.strThumb || player.strCutout}
												<img
													src={(player.strCutout || player.strThumb) + '/small'}
													alt={player.strPlayer}
													class="w-12 h-12 mx-auto rounded-full object-cover mb-1"
												/>
											{:else}
												<div class="w-12 h-12 mx-auto rounded-full bg-base-300 flex items-center justify-center text-base-content/30 mb-1">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
													</svg>
												</div>
											{/if}
											<div class="text-xs font-medium truncate">{player.strPlayer}</div>
											{#if player.strPosition}
												<div class="text-xs text-base-content/50">{player.strPosition}</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else if !isLoadingPlayers}
								<div class="text-center text-base-content/60 p-4">
									<p class="text-sm">No players found.</p>
								</div>
							{/if}
						</div>
					{:else if selectedLeague}
						<h3 class="text-sm font-semibold mb-2">
							Teams in League ({teamsInLeague.length})
							{#if isLoadingTeamsInLeague}
								<span class="loading loading-spinner loading-xs ml-2"></span>
							{/if}
						</h3>
						<div class="flex-1 overflow-y-auto">
							{#if teamsInLeague.length > 0}
								<div class="grid grid-cols-3 gap-2">
									{#each teamsInLeague as team (team.id)}
										<div class="bg-base-100 rounded p-2 text-center">
											{#if team.badgeUrl}
												<img
													src={team.badgeUrl + '/small'}
													alt={team.name}
													class="w-10 h-10 mx-auto object-contain mb-1"
												/>
											{:else}
												<div class="w-10 h-10 mx-auto rounded bg-base-300 flex items-center justify-center text-base-content/30 mb-1">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
													</svg>
												</div>
											{/if}
											<div class="text-xs font-medium truncate">{team.name}</div>
										</div>
									{/each}
								</div>
							{:else if !isLoadingTeamsInLeague}
								<div class="text-center text-base-content/60 p-4">
									<p class="text-sm">No teams found in this league.</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Column 3: Album Creation -->
	<div class="card bg-base-200 overflow-hidden flex flex-col">
		<div class="card-body p-4 flex flex-col h-full">
			<h2 class="card-title text-lg mb-2">Create Album</h2>

			<div class="flex-1 overflow-y-auto">
				{#if !selectedTeam && !selectedLeague}
					<div class="flex items-center justify-center h-full text-base-content/60">
						<p class="text-sm">Select a team or league to create an album.</p>
					</div>
				{:else if selectedTeam}
					<div class="space-y-4">
						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCover}
								<img
									src={selectedCover}
									alt={selectedTeam.name}
									class="w-16 h-16 object-contain rounded bg-base-100 p-1"
								/>
							{:else}
								<div class="w-16 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{selectedTeam.name}</h3>
								<p class="text-sm text-base-content/60">{selectedTeam.sport}</p>
								<p class="text-xs text-base-content/50">{selectedTeam.league}</p>
							</div>
						</div>

						<!-- Progress indicators -->
						{#if fetchProgress.size > 0}
							<div class="space-y-1">
								{#each [...fetchProgress.entries()] as [source, info]}
									<div class="flex items-center gap-2 text-xs">
										<span class="w-24 truncate">{source}:</span>
										{#if info.status === 'fetching'}
											<span class="loading loading-spinner loading-xs"></span>
										{:else if info.status === 'success'}
											<span class="text-success">Done</span>
										{:else if info.status === 'failed'}
											<span class="text-error">Failed</span>
										{:else}
											<span class="text-base-content/50">Pending</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<!-- Details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Type:</span>
								<span class="badge badge-sm">Team</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Sport:</span>
								<span class="text-xs">{selectedTeam.sport}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">League:</span>
								<span class="text-xs truncate max-w-[60%]">{selectedTeam.league}</span>
							</div>
							{#if selectedTeam.country}
								<div class="flex justify-between">
									<span class="text-base-content/60">Country:</span>
									<span class="text-xs">{selectedTeam.country}</span>
								</div>
							{/if}
							{#if selectedTeam.formedYear}
								<div class="flex justify-between">
									<span class="text-base-content/60">Founded:</span>
									<span class="text-xs">{selectedTeam.formedYear}</span>
								</div>
							{/if}
							{#if selectedTeam.stadium}
								<div class="flex justify-between">
									<span class="text-base-content/60">Stadium:</span>
									<span class="text-xs truncate max-w-[60%]">{selectedTeam.stadium}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-base-content/60">Cover:</span>
								<span class="text-xs">{selectedCover ? 'Selected' : 'None'}</span>
							</div>
						</div>

						<!-- Create button -->
						{#if albumCreated}
							<div class="alert alert-success">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">Album created!</span>
							</div>
							<a href="/admin/album" class="btn btn-outline btn-sm w-full">
								Go to Album Manager
							</a>
						{:else if isTeamSourceAdded(selectedTeam.id)}
							<div class="alert alert-warning">
								<span class="text-sm">This team has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumFromTeam}
								disabled={isCreatingAlbum}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create Team Album
								{/if}
							</button>
						{/if}
					</div>
				{:else if selectedLeague}
					<div class="space-y-4">
						<!-- Preview -->
						<div class="flex gap-3">
							{#if selectedCover}
								<img
									src={selectedCover}
									alt={selectedLeague.name}
									class="w-16 h-16 object-contain rounded bg-base-100 p-1"
								/>
							{:else}
								<div class="w-16 h-16 bg-base-300 rounded flex items-center justify-center text-base-content/30">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
								</div>
							{/if}
							<div class="flex-1">
								<h3 class="font-bold">{selectedLeague.name}</h3>
								<p class="text-sm text-base-content/60">{selectedLeague.sport}</p>
								{#if selectedLeague.country}
									<p class="text-xs text-base-content/50">{selectedLeague.country}</p>
								{/if}
							</div>
						</div>

						<!-- Details -->
						<div class="divider my-2">Details</div>

						<div class="space-y-1 text-sm">
							<div class="flex justify-between">
								<span class="text-base-content/60">Type:</span>
								<span class="badge badge-sm">Competition</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Sport:</span>
								<span class="text-xs">{selectedLeague.sport}</span>
							</div>
							{#if selectedLeague.country}
								<div class="flex justify-between">
									<span class="text-base-content/60">Country:</span>
									<span class="text-xs">{selectedLeague.country}</span>
								</div>
							{/if}
							{#if selectedLeague.formedYear}
								<div class="flex justify-between">
									<span class="text-base-content/60">Founded:</span>
									<span class="text-xs">{selectedLeague.formedYear}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-base-content/60">Teams:</span>
								<span class="text-xs">{teamsInLeague.length} found</span>
							</div>
							<div class="flex justify-between">
								<span class="text-base-content/60">Cover:</span>
								<span class="text-xs">{selectedCover ? 'Selected' : 'None'}</span>
							</div>
						</div>

						<!-- Create button -->
						{#if albumCreated}
							<div class="alert alert-success">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">Album created!</span>
							</div>
							<a href="/admin/album" class="btn btn-outline btn-sm w-full">
								Go to Album Manager
							</a>
						{:else if isLeagueSourceAdded(selectedLeague.id)}
							<div class="alert alert-warning">
								<span class="text-sm">This league has already been added.</span>
							</div>
						{:else}
							<button
								class="btn btn-primary w-full"
								onclick={createAlbumFromLeague}
								disabled={isCreatingAlbum}
							>
								{#if isCreatingAlbum}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Create League Album
								{/if}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
