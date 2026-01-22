<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { getAlbumCollection } from '$services/albums.service';
	import {
		getCardsByAlbum,
		addCard as addCardService,
		removeCard as removeCardService,
		removeCardsByAlbum
	} from '$services/cards.service';
	import type { Album, AlbumType } from '$types/album.type';
	import type { Card, CardType } from '$types/card.type';
	import { normalizeCardType } from '$types/card.type';

	// Card type labels for display
	const CARD_TYPE_LABELS: Record<CardType, string> = {
		other: 'Other',
		poster: 'Poster',
		backdrop: 'Backdrop',
		logo: 'Logo',
		cast: 'Cast',
		characterart: 'Character Art',
		cover: 'Cover',
		screenshot: 'Screenshot',
		artwork: 'Artwork',
		hero: 'Hero',
		icon: 'Icon',
		grid: 'Grid',
		character: 'Character',
		main_character: 'Main Character',
		player: 'Player',
		team_badge: 'Team Badge',
		photo: 'Photo',
		album: 'Album',
		artistthumb: 'Artist Thumb',
		artistbackground: 'Artist Background',
		book_cover: 'Book Cover'
	};

	// Types for fetched images
	interface FetchedImage {
		url: string;
		thumbUrl: string;
		type: string;
		source: string;
		name?: string;
		selected?: boolean;
	}

	// Collection state
	let albums: Album[] = $state([]);
	let albumCardCounts: Map<string, number> = $state(new Map());
	let cards: Card[] = $state([]);
	let isLoading = $state(true);
	let isLoadingCards = $state(false);
	let isSaving = $state(false);
	let selectedAlbum = $state<Album | null>(null);

	// Fetch images state
	let isFetchingImages = $state(false);
	let fetchedImages = $state<FetchedImage[]>([]);
	let fetchError = $state<string | null>(null);

	onMount(async () => {
		albums = await getAlbumCollection();
		// Load card counts for each album
		await loadAlbumCardCounts();
		isLoading = false;
	});

	// Load card counts for all albums
	async function loadAlbumCardCounts() {
		const counts = new Map<string, number>();
		for (const album of albums) {
			const albumCards = await getCardsByAlbum(album.id);
			counts.set(String(album.id), albumCards.length);
		}
		albumCardCounts = counts;
	}

	// Reset fetched images
	function resetFetchedImages() {
		fetchedImages = [];
		fetchError = null;
	}

	// Select an album to view its cards
	async function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id) {
			selectedAlbum = null;
			cards = [];
			resetFetchedImages();
		} else {
			selectedAlbum = album;
			isLoadingCards = true;
			cards = await getCardsByAlbum(album.id);
			isLoadingCards = false;
			resetFetchedImages();
		}
	}

	// Remove a card
	async function removeCard(card: Card, event: MouseEvent) {
		event.stopPropagation();
		const success = await removeCardService(card);
		if (success && selectedAlbum) {
			cards = await getCardsByAlbum(selectedAlbum.id);
			albumCardCounts.set(String(selectedAlbum.id), cards.length);
			albumCardCounts = new Map(albumCardCounts);
		}
	}

	// Clear all cards in the selected album
	async function clearAllCards() {
		if (!selectedAlbum || cards.length === 0 || isSaving) return;

		isSaving = true;
		const success = await removeCardsByAlbum(selectedAlbum.id);
		if (success) {
			cards = [];
			albumCardCounts.set(String(selectedAlbum.id), 0);
			albumCardCounts = new Map(albumCardCounts);
		}
		isSaving = false;
	}

	// Get card count for an album
	function getCardCount(albumId: string | number): number {
		return albumCardCounts.get(String(albumId)) ?? 0;
	}

	// Check if album type supports fetching
	function canFetchImages(albumType: AlbumType): boolean {
		return ['movie', 'tv', 'videogame', 'anime', 'sports_league', 'animal', 'musician', 'author'].includes(albumType);
	}

	// Get fetch button label based on album type
	function getFetchLabel(albumType: AlbumType): string {
		switch (albumType) {
			case 'movie':
			case 'tv':
				return 'Fetch from TMDB/Fanart';
			case 'videogame':
				return 'Fetch from IGDB/SGDB';
			case 'anime':
				return 'Fetch from AniList/Jikan';
			case 'sports_league':
				return 'Fetch from TheSportsDB';
			case 'animal':
				return 'Fetch from iNaturalist';
			case 'musician':
				return 'Fetch from Fanart/MusicBrainz';
			case 'author':
				return 'Fetch from OpenLibrary';
			default:
				return 'Fetch Images';
		}
	}

	// Fetch images based on album type
	async function fetchImagesForAlbum() {
		if (!selectedAlbum) return;

		isFetchingImages = true;
		fetchError = null;
		fetchedImages = [];

		try {
			switch (selectedAlbum.albumType) {
				case 'movie':
				case 'tv':
					await fetchMovieTVImages(selectedAlbum);
					break;
				case 'videogame':
					await fetchVideogameImages(selectedAlbum);
					break;
				case 'anime':
					await fetchAnimeImages(selectedAlbum);
					break;
				case 'sports_league':
					await fetchSportsImages(selectedAlbum);
					break;
				case 'animal':
					await fetchAnimalImages(selectedAlbum);
					break;
				case 'musician':
					await fetchMusicianImages(selectedAlbum);
					break;
				case 'author':
					await fetchAuthorImages(selectedAlbum);
					break;
				default:
					fetchError = 'This album type does not support automatic image fetching.';
			}
		} catch (error) {
			console.error('[card] fetchImagesForAlbum error:', error);
			fetchError = 'Failed to fetch images. Please try again.';
		} finally {
			isFetchingImages = false;
		}
	}

	// Fetch images for Movie/TV albums
	async function fetchMovieTVImages(album: Album) {
		const images: FetchedImage[] = [];
		const mediaType = album.albumType === 'movie' ? 'movie' : 'tv';

		// Fetch from TMDB using imdbId or tmdbId
		if (album.imdbId || album.tmdbId) {
			try {
				const tmdbParam = album.tmdbId ? `tmdbId=${album.tmdbId}` : `imdbId=${album.imdbId}`;
				const tmdbResult = await fetch(`/api/tmdb/images?${tmdbParam}`).then((r) => r.json()).catch(() => null);

				if (tmdbResult && !tmdbResult.error) {
					for (const img of tmdbResult.posters || []) {
						images.push({
							url: img.url,
							thumbUrl: img.thumbUrl,
							type: 'poster',
							source: 'tmdb',
							name: `${album.title} - poster`,
							selected: true
						});
					}
					for (const img of tmdbResult.backdrops || []) {
						images.push({
							url: img.url,
							thumbUrl: img.thumbUrl,
							type: 'backdrop',
							source: 'tmdb',
							name: `${album.title} - backdrop`,
							selected: true
						});
					}
					for (const img of tmdbResult.logos || []) {
						images.push({
							url: img.url,
							thumbUrl: img.thumbUrl,
							type: 'logo',
							source: 'tmdb',
							name: `${album.title} - logo`,
							selected: true
						});
					}

					// Fetch Fanart and Credits if we have tmdbId
					const tmdbId = tmdbResult.tmdbId || album.tmdbId;
					if (tmdbId) {
						const [fanartResult, creditsResult] = await Promise.all([
							fetch(`/api/fanart/images?tmdbId=${tmdbId}&type=${mediaType}`).then((r) => r.json()).catch(() => null),
							fetch(`/api/tmdb/credits?tmdbId=${tmdbId}&type=${mediaType}`).then((r) => r.json()).catch(() => null)
						]);

						if (fanartResult && !fanartResult.error && fanartResult.images) {
							for (const img of fanartResult.images) {
								images.push({
									url: img.url,
									thumbUrl: img.thumbUrl,
									type: img.type,
									source: 'fanart',
									name: `${album.title} - ${img.type}`,
									selected: true
								});
							}
						}

						if (creditsResult && !creditsResult.error && creditsResult.cast) {
							for (const member of creditsResult.cast) {
								if (member.profileUrl) {
									images.push({
										url: member.profileUrl,
										thumbUrl: member.profileThumbUrl || member.profileUrl,
										type: 'cast',
										source: 'tmdb-cast',
										name: member.name ? `${member.name} as ${member.character}` : member.character,
										selected: true
									});
								}
							}
						}
					}
				}
			} catch (e) {
				console.error('[card] TMDB fetch error:', e);
			}
		}

		// For TV, also fetch from TVMaze
		if (album.albumType === 'tv' && album.imdbId) {
			try {
				const tvmazeResult = await fetch(`/api/tvmaze/images?imdbId=${album.imdbId}`).then((r) => r.json()).catch(() => null);
				if (tvmazeResult && !tvmazeResult.error) {
					for (const img of tvmazeResult.images || []) {
						images.push({
							url: img.url,
							thumbUrl: img.thumbUrl,
							type: img.type,
							source: 'tvmaze',
							name: `${album.title} - ${img.type}`,
							selected: true
						});
					}
				}
			} catch (e) {
				console.error('[card] TVMaze fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has valid IMDB or TMDB IDs.';
		}

		fetchedImages = images;
	}

	// Fetch images for Videogame albums
	async function fetchVideogameImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.igdbId) {
			try {
				const [igdbResult, sgdbResult] = await Promise.all([
					fetch(`/api/igdb/images?id=${album.igdbId}`).then((r) => r.json()).catch(() => null),
					fetch(`/api/sgdb/images?name=${encodeURIComponent(album.title)}`).then((r) => r.json()).catch(() => null)
				]);

				if (igdbResult && !igdbResult.error) {
					if (igdbResult.cover) {
						images.push({
							url: igdbResult.cover.url,
							thumbUrl: igdbResult.cover.thumb_url,
							type: 'cover',
							source: 'igdb',
							name: `${album.title} - cover`,
							selected: true
						});
					}
					for (const ss of igdbResult.screenshots || []) {
						images.push({
							url: ss.url,
							thumbUrl: ss.thumb_url,
							type: 'screenshot',
							source: 'igdb',
							name: `${album.title} - screenshot`,
							selected: true
						});
					}
					for (const aw of igdbResult.artworks || []) {
						images.push({
							url: aw.url,
							thumbUrl: aw.thumb_url,
							type: 'artwork',
							source: 'igdb',
							name: `${album.title} - artwork`,
							selected: true
						});
					}
				}

				if (sgdbResult && !sgdbResult.error && sgdbResult.images) {
					for (const img of sgdbResult.images) {
						images.push({
							url: img.url,
							thumbUrl: img.thumb || img.url,
							type: img.type,
							source: 'sgdb',
							name: `${album.title} - ${img.type}`,
							selected: true
						});
					}
				}
			} catch (e) {
				console.error('[card] IGDB/SGDB fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has a valid IGDB ID.';
		}

		fetchedImages = images;
	}

	// Fetch images for Anime albums
	async function fetchAnimeImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.anilistId) {
			try {
				// Fetch from AniList
				const anilistResult = await fetch(`/api/anilist/anime/${album.anilistId}/characters?all=true`).then((r) => r.json()).catch(() => null);

				// Add characters from AniList
				if (anilistResult?.data?.Media?.characters?.edges) {
					for (const edge of anilistResult.data.Media.characters.edges) {
						const char = edge.node;
						if (char.image?.large || char.image?.medium) {
							images.push({
								url: char.image.large || char.image.medium,
								thumbUrl: char.image.medium || char.image.large,
								type: edge.role === 'MAIN' ? 'main-character' : 'character',
								source: 'anilist',
								name: char.name.full,
								selected: true
							});
						}
					}
				}

				// Fetch from Jikan
				const [jikanPics, jikanChars] = await Promise.all([
					fetch(`/api/jikan/anime/${album.anilistId}/pictures`).then((r) => r.json()).catch(() => null),
					fetch(`/api/jikan/anime/${album.anilistId}/characters`).then((r) => r.json()).catch(() => null)
				]);

				if (jikanPics?.data) {
					for (const pic of jikanPics.data) {
						const url = pic.jpg?.large_image_url || pic.jpg?.image_url || pic.webp?.large_image_url;
						const thumbUrl = pic.jpg?.small_image_url || pic.webp?.small_image_url || url;
						if (url) {
							images.push({
								url,
								thumbUrl,
								type: 'artwork',
								source: 'jikan',
								name: `${album.title} - artwork`,
								selected: true
							});
						}
					}
				}

				if (jikanChars?.data) {
					for (const charData of jikanChars.data) {
						const char = charData.character;
						if (char.images?.jpg?.image_url) {
							// Check if this character is already added from AniList
							const alreadyAdded = images.some(img => img.name === char.name && img.source === 'anilist');
							if (!alreadyAdded) {
								images.push({
									url: char.images.jpg.image_url,
									thumbUrl: char.images.jpg.small_image_url || char.images.jpg.image_url,
									type: charData.role === 'Main' ? 'main-character' : 'character',
									source: 'jikan',
									name: char.name,
									selected: true
								});
							}
						}
					}
				}
			} catch (e) {
				console.error('[card] AniList/Jikan fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has a valid AniList ID.';
		}

		fetchedImages = images;
	}

	// Fetch images for Sports albums
	async function fetchSportsImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.sportsDbTeamId) {
			// Fetch players for team
			try {
				const playersResult = await fetch(`/api/sports/players?team=${album.sportsDbTeamId}`).then((r) => r.json()).catch(() => null);

				if (playersResult?.player) {
					for (const player of playersResult.player) {
						const imageUrl = player.strCutout || player.strThumb || player.strRender;
						if (imageUrl) {
							images.push({
								url: imageUrl,
								thumbUrl: imageUrl + '/small',
								type: 'player',
								source: 'thesportsdb',
								name: player.strPlayer,
								selected: true
							});
						}
					}
				}
			} catch (e) {
				console.error('[card] TheSportsDB players fetch error:', e);
			}
		} else if (album.sportsDbLeagueId) {
			// Fetch teams for league
			try {
				const teamsResult = await fetch(`/api/sports/teams?league=${encodeURIComponent(album.league || '')}`).then((r) => r.json()).catch(() => null);

				if (teamsResult?.teams) {
					for (const team of teamsResult.teams) {
						if (team.strBadge) {
							images.push({
								url: team.strBadge,
								thumbUrl: team.strBadge + '/small',
								type: 'team-badge',
								source: 'thesportsdb',
								name: team.strTeam,
								selected: true
							});
						}
					}
				}
			} catch (e) {
				console.error('[card] TheSportsDB teams fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has valid TheSportsDB IDs.';
		}

		fetchedImages = images;
	}

	// Fetch images for Animal albums
	async function fetchAnimalImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.scientificName) {
			try {
				const result = await fetch(`/api/inaturalist/photos?name=${encodeURIComponent(album.scientificName)}&limit=20`).then((r) => r.json()).catch(() => null);

				if (result?.photos) {
					for (const photo of result.photos) {
						images.push({
							url: photo.largeUrl || photo.url,
							thumbUrl: photo.thumbUrl,
							type: 'photo',
							source: 'inaturalist',
							name: album.title,
							selected: true
						});
					}
				}
			} catch (e) {
				console.error('[card] iNaturalist fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has a valid scientific name.';
		}

		fetchedImages = images;
	}

	// Fetch images for Musician albums
	async function fetchMusicianImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.musicbrainzArtistId) {
			try {
				// Fetch artist images from Fanart
				const fanartResult = await fetch(`/api/fanart/music/artist/${album.musicbrainzArtistId}`).then((r) => r.json()).catch(() => null);

				if (fanartResult?.images) {
					for (const img of fanartResult.images) {
						images.push({
							url: img.url,
							thumbUrl: img.thumbUrl || img.url,
							type: img.type,
							source: 'fanart',
							name: `${album.title} - ${img.type}`,
							selected: true
						});
					}
				}

				// Fetch releases (albums) with covers
				const releasesResult = await fetch(`/api/musicbrainz/artist/${album.musicbrainzArtistId}/releases?covers=true`).then((r) => r.json()).catch(() => null);

				if (releasesResult?.releases) {
					for (const release of releasesResult.releases) {
						if (release.imageUrl) {
							images.push({
								url: release.imageUrl,
								thumbUrl: release.thumbUrl || release.imageUrl,
								type: release.type || 'album',
								source: 'musicbrainz',
								name: release.title,
								selected: true
							});
						}
					}
				}
			} catch (e) {
				console.error('[card] MusicBrainz/Fanart fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has a valid MusicBrainz artist ID.';
		}

		fetchedImages = images;
	}

	// Fetch images for Author albums
	async function fetchAuthorImages(album: Album) {
		const images: FetchedImage[] = [];

		if (album.openLibraryAuthorId) {
			try {
				// Fetch author's works
				const worksResult = await fetch(`/api/openlibrary/author/${album.openLibraryAuthorId}/works?limit=50`).then((r) => r.json()).catch(() => null);

				if (worksResult?.works) {
					for (const work of worksResult.works) {
						if (work.imageUrl) {
							images.push({
								url: work.imageUrl.replace('-M.jpg', '-L.jpg'),
								thumbUrl: work.imageUrl,
								type: 'book-cover',
								source: 'openlibrary',
								name: work.title,
								selected: true
							});
						}
					}
				}
			} catch (e) {
				console.error('[card] OpenLibrary fetch error:', e);
			}
		} else if (album.openLibraryWorkId) {
			try {
				// Fetch work editions for covers
				const workKey = album.openLibraryWorkId.replace('/works/', '');
				// For a single work, just use cover IDs if available
				if (album.coverImage) {
					images.push({
						url: album.coverImage.replace('-M.jpg', '-L.jpg'),
						thumbUrl: album.coverImage,
						type: 'cover',
						source: 'openlibrary',
						name: album.title,
						selected: true
					});
				}
			} catch (e) {
				console.error('[card] OpenLibrary work fetch error:', e);
			}
		}

		if (images.length === 0) {
			fetchError = 'No images found. Make sure the album has a valid OpenLibrary ID.';
		}

		fetchedImages = images;
	}

	// Toggle image selection
	function toggleImageSelection(image: FetchedImage) {
		image.selected = !image.selected;
		fetchedImages = [...fetchedImages];
	}

	// Select all images
	function selectAllImages() {
		fetchedImages = fetchedImages.map(img => ({ ...img, selected: true }));
	}

	// Deselect all images
	function deselectAllImages() {
		fetchedImages = fetchedImages.map(img => ({ ...img, selected: false }));
	}

	// Get selected count
	function getSelectedCount(): number {
		return fetchedImages.filter(img => img.selected).length;
	}

	// Import selected images as cards
	async function importSelectedImages() {
		if (!selectedAlbum || isSaving) return;

		const selectedImages = fetchedImages.filter(img => img.selected);
		if (selectedImages.length === 0) return;

		isSaving = true;

		try {
			for (const image of selectedImages) {
				const card: Card = {
					id: crypto.randomUUID(),
					albumId: selectedAlbum.id,
					name: image.name || `${selectedAlbum.title} - ${image.type}`,
					image: image.url,
					cardType: normalizeCardType(image.type),
					imageSource: image.source,
					addedAt: new Date().toISOString()
				};

				await addCardService(card);
			}

			// Refresh cards
			cards = await getCardsByAlbum(selectedAlbum.id);
			albumCardCounts.set(String(selectedAlbum.id), cards.length);
			albumCardCounts = new Map(albumCardCounts);

			// Clear fetched images
			resetFetchedImages();
		} catch (error) {
			console.error('[card] importSelectedImages error:', error);
		} finally {
			isSaving = false;
		}
	}

	// Get album type badge color
	function getAlbumTypeBadgeClass(albumType: AlbumType): string {
		switch (albumType) {
			case 'movie': return 'badge-primary';
			case 'tv': return 'badge-secondary';
			case 'videogame': return 'badge-accent';
			case 'anime': return 'badge-info';
			case 'sports_league': return 'badge-success';
			case 'animal': return 'badge-warning';
			case 'musician': return 'badge-error';
			case 'author': return 'badge-neutral';
			default: return 'badge-ghost';
		}
	}

	// Get card type display label
	function getCardTypeLabel(cardType: CardType | undefined): string {
		if (!cardType) return 'Other';
		return CARD_TYPE_LABELS[cardType] || cardType;
	}

	// Get card type badge color
	function getCardTypeBadgeClass(cardType: CardType | undefined): string {
		switch (cardType) {
			// Movie/TV
			case 'poster': return 'badge-primary';
			case 'backdrop': return 'badge-secondary';
			case 'logo': return 'badge-accent';
			case 'cast': return 'badge-info';
			case 'characterart': return 'badge-warning';
			// Videogame
			case 'cover': return 'badge-primary';
			case 'screenshot': return 'badge-secondary';
			case 'artwork': return 'badge-accent';
			case 'hero': return 'badge-info';
			case 'icon': return 'badge-warning';
			case 'grid': return 'badge-success';
			// Anime
			case 'character': return 'badge-info';
			case 'main_character': return 'badge-primary';
			// Sports
			case 'player': return 'badge-success';
			case 'team_badge': return 'badge-warning';
			// Animal
			case 'photo': return 'badge-success';
			// Music
			case 'album': return 'badge-primary';
			case 'artistthumb': return 'badge-secondary';
			case 'artistbackground': return 'badge-accent';
			// Book
			case 'book_cover': return 'badge-primary';
			default: return 'badge-ghost';
		}
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Card Manager</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Albums List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Albums</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if albums.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No albums created yet.</p>
							<p class="text-sm mt-1">Create albums in the Album Manager first.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each albums as album (album.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedAlbum?.id === album.id,
											'bg-base-100': selectedAlbum?.id !== album.id
										}
									)}
									onclick={() => selectAlbum(album)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(album)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-3">
										{#if album.coverImage}
											<img
												src={album.coverImage}
												alt={album.title}
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
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<span class="font-medium truncate block">{album.title}</span>
											<div class="flex items-center gap-2 mt-1">
												<span class={classNames('badge badge-xs', getAlbumTypeBadgeClass(album.albumType))}>
													{album.albumType}
												</span>
												<span class="text-xs text-base-content/60">
													{getCardCount(album.id)} cards
												</span>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Cards List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{#if selectedAlbum}
							Cards in "{selectedAlbum.title}"
						{:else}
							Cards
						{/if}
					</h2>
					{#if selectedAlbum && cards.length > 0}
						<button
							class="btn btn-ghost btn-xs text-error"
							onclick={clearAllCards}
							disabled={isSaving}
							title="Clear all cards"
						>
							Clear All
						</button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedAlbum}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an album to view its cards.</p>
						</div>
					{:else if isLoadingCards}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if cards.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No cards in this album yet.</p>
							<p class="text-sm mt-1">Fetch images using the panel on the right.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each cards as card (card.id)}
								<div
									class="w-full text-left p-3 rounded-lg bg-base-100"
								>
									<div class="flex items-start gap-3">
										<img
											src={card.image}
											alt={card.name}
											class="w-12 h-16 object-cover rounded"
											onerror={(e) => {
												(e.target as HTMLImageElement).src =
													'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64"><rect fill="%23374151" width="48" height="64"/><text x="24" y="36" text-anchor="middle" fill="%239CA3AF" font-size="8">?</text></svg>';
											}}
										/>
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between">
												<span class="font-medium truncate">{card.name}</span>
												<button
													class="btn btn-ghost btn-xs text-error"
													onclick={(e) => removeCard(card, e)}
													title="Remove card"
												>
													✕
												</button>
											</div>
											<div class="flex items-center gap-1 mt-1">
												<span class={classNames('badge badge-xs', getCardTypeBadgeClass(card.cardType))}>
													{getCardTypeLabel(card.cardType)}
												</span>
												{#if card.imageSource}
													<span class="badge badge-xs badge-outline">{card.imageSource}</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 3: Fetch Images -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				{#if !selectedAlbum}
					<h2 class="card-title text-lg mb-2">Fetch Images</h2>
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">Select an album first to fetch images.</p>
					</div>
				{:else if !canFetchImages(selectedAlbum.albumType)}
					<h2 class="card-title text-lg mb-2">Fetch Images</h2>
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p class="text-sm">This album type does not support automatic image fetching.</p>
					</div>
				{:else}
					<h2 class="card-title text-lg mb-2">Fetch Images</h2>

					<div class="flex-1 overflow-y-auto">
						<div class="space-y-4">
							<!-- Fetch button -->
							<button
								class="btn btn-primary w-full"
								onclick={fetchImagesForAlbum}
								disabled={isFetchingImages}
							>
								{#if isFetchingImages}
									<span class="loading loading-spinner loading-sm"></span>
									Fetching...
								{:else}
									{getFetchLabel(selectedAlbum.albumType)}
								{/if}
							</button>

							<!-- Error message -->
							{#if fetchError}
								<div class="alert alert-warning alert-sm">
									<span class="text-sm">{fetchError}</span>
								</div>
							{/if}

							<!-- Fetched images grid -->
							{#if fetchedImages.length > 0}
								<div class="flex items-center justify-between">
									<span class="text-sm text-base-content/60">
										{getSelectedCount()} of {fetchedImages.length} selected
									</span>
									<div class="flex gap-1">
										<button class="btn btn-ghost btn-xs" onclick={selectAllImages}>All</button>
										<button class="btn btn-ghost btn-xs" onclick={deselectAllImages}>None</button>
									</div>
								</div>

								<div class="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
									{#each fetchedImages as image, i (image.url + i)}
										<button
											class={classNames(
												'relative aspect-[2/3] rounded overflow-hidden transition-all bg-base-300',
												'hover:ring-2 hover:ring-primary',
												{
													'ring-2 ring-success': image.selected,
													'opacity-40': !image.selected
												}
											)}
											onclick={() => toggleImageSelection(image)}
											title={image.name || image.type}
										>
											<img
												src={image.thumbUrl || image.url}
												alt={image.name || image.type}
												class="w-full h-full object-cover"
												loading="lazy"
												onerror={(e) => {
													(e.target as HTMLImageElement).style.display = 'none';
												}}
											/>
											{#if image.selected}
												<div class="absolute top-1 right-1">
													<span class="badge badge-success badge-xs">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-3 w-3"
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fill-rule="evenodd"
																d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																clip-rule="evenodd"
															/>
														</svg>
													</span>
												</div>
											{/if}
											<div class="absolute bottom-0 left-0 right-0 bg-base-300/90 px-1 py-0.5">
												<span class="text-xs truncate block">{image.name || image.type}</span>
											</div>
										</button>
									{/each}
								</div>

								<!-- Import button -->
								<button
									class="btn btn-success w-full"
									onclick={importSelectedImages}
									disabled={getSelectedCount() === 0 || isSaving}
								>
									{#if isSaving}
										<span class="loading loading-spinner loading-sm"></span>
										Importing...
									{:else}
										Import {getSelectedCount()} Cards
									{/if}
								</button>
							{:else if !isFetchingImages && !fetchError}
								<div class="text-center text-base-content/60 p-4">
									<p class="text-sm">Click the button above to fetch available images for this album.</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
