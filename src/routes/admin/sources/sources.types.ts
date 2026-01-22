export interface OMDBSearchResult {
	Title: string;
	Year: string;
	imdbID: string;
	Type: string;
	Poster: string;
}

export interface ImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	width?: number;
	height?: number;
	source: 'tmdb' | 'fanart' | 'tvmaze' | 'igdb' | 'sgdb' | 'tmdb-cast';
	selected?: boolean; // For card selection
}

// Character/Cast types for Movies & TV
export interface CharacterItem {
	id: number | string;
	name: string;
	character: string;
	profileUrl: string;
	profileThumbUrl: string;
	order: number;
	source: 'tmdb-cast' | 'tvmaze-character' | 'fanart-characterart';
	isActorHeadshot: boolean; // true for actor photos, false for actual character images
	selected?: boolean; // For card selection
}

// IGDB Game types
export interface IGDBCover {
	id: number;
	url: string;
	thumb_url: string;
	width: number;
	height: number;
	image_id: string;
}

export interface IGDBScreenshot {
	url: string;
	thumb_url: string;
	width: number;
	height: number;
}

export interface IGDBArtwork {
	url: string;
	thumb_url: string;
	width: number;
	height: number;
}

export interface IGDBPlatform {
	id: number;
	name: string;
	abbreviation?: string;
}

export interface IGDBGenre {
	id: number;
	name: string;
}

export interface GameSearchResult {
	id: number;
	slug: string;
	name: string;
	summary?: string;
	first_release_date?: number;
	rating?: number;
	aggregated_rating?: number;
	cover?: IGDBCover | null;
	platforms?: IGDBPlatform[];
	genres?: IGDBGenre[];
	url: string;
}

// Anime types (AniList)
export interface AniListShow {
	id: number;
	title: {
		romaji: string;
		english: string | null;
	};
	coverImage: {
		large: string;
		medium: string;
	};
	bannerImage: string | null;
	description: string | null;
	startDate: {
		year: number | null;
		month: number | null;
		day: number | null;
	};
	season: string | null;
	seasonYear: number | null;
	format: string | null;
	status: string | null;
	episodes: number | null;
	genres: string[];
	averageScore: number | null;
	popularity: number;
	favourites: number;
	studios: {
		nodes: {
			id: number;
			name: string;
		}[];
	};
}

export interface AniListShowSearchResponse {
	data: {
		Page: {
			pageInfo: {
				total: number;
				currentPage: number;
				lastPage: number;
				hasNextPage: boolean;
				perPage: number;
			};
			media: AniListShow[];
		};
	};
}

// Jikan types (for additional images)
export interface JikanAnimePicture {
	jpg: {
		image_url: string;
		small_image_url: string;
		large_image_url: string;
	};
	webp: {
		image_url: string;
		small_image_url: string;
		large_image_url: string;
	};
}

export interface AnimeImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	source: 'anilist' | 'jikan';
}

// Anime Character types (AniList)
export interface AniListCharacter {
	id: number;
	name: {
		full: string;
		native: string | null;
	};
	image: {
		large: string;
		medium: string;
	};
	description: string | null;
	gender: string | null;
	age: string | null;
	role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
	voiceActors: {
		id: number;
		name: {
			full: string;
			native: string | null;
		};
		image: {
			large: string;
			medium: string;
		};
		languageV2: string;
	}[];
}

export interface AniListCharactersResponse {
	data: {
		Media: {
			characters: {
				pageInfo: {
					total: number;
					currentPage: number;
					lastPage: number;
					hasNextPage: boolean;
				};
				edges: {
					node: {
						id: number;
						name: {
							full: string;
							native: string | null;
						};
						image: {
							large: string;
							medium: string;
						};
						description: string | null;
						gender: string | null;
						age: string | null;
					};
					role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
					voiceActors: {
						id: number;
						name: {
							full: string;
							native: string | null;
						};
						image: {
							large: string;
							medium: string;
						};
						languageV2: string;
					}[];
				}[];
			};
		};
	};
}

// Jikan Character types
export interface JikanCharacter {
	character: {
		mal_id: number;
		url: string;
		images: {
			jpg: {
				image_url: string;
				small_image_url: string;
			};
			webp: {
				image_url: string;
				small_image_url: string;
			};
		};
		name: string;
	};
	role: string;
	favorites: number;
	voice_actors: {
		person: {
			mal_id: number;
			url: string;
			images: {
				jpg: {
					image_url: string;
				};
			};
			name: string;
		};
		language: string;
	}[];
}

export interface JikanCharactersResponse {
	data: JikanCharacter[];
}

// Unified character image item for display
export interface AnimeCharacterImageItem {
	url: string;
	thumbUrl: string;
	characterId: number | string;
	characterName: string;
	role: string;
	source: 'anilist' | 'jikan';
	voiceActorName?: string;
	voiceActorImage?: string;
}

// Sports types (TheSportsDB)
export interface SportsTeamSearchResult {
	idTeam: string;
	strTeam: string;
	strTeamShort: string | null;
	strAlternate: string | null;
	intFormedYear: string | null;
	strSport: string;
	strLeague: string;
	idLeague: string;
	strStadium: string | null;
	strStadiumThumb: string | null;
	strStadiumLocation: string | null;
	intStadiumCapacity: string | null;
	strWebsite: string | null;
	strBadge: string | null;
	strJersey: string | null;
	strLogo: string | null;
	strBanner: string | null;
	strDescriptionEN: string | null;
	strCountry: string | null;
}

export interface SportsLeagueSearchResult {
	idLeague: string;
	strLeague: string;
	strSport: string;
	strLeagueAlternate: string | null;
	intFormedYear: string | null;
	strCountry: string | null;
	strWebsite: string | null;
	strDescriptionEN: string | null;
	strBadge: string | null;
	strLogo: string | null;
	strBanner: string | null;
	strPoster: string | null;
	strTrophy: string | null;
	strFanart1: string | null;
	strFanart2: string | null;
	strFanart3: string | null;
	strFanart4: string | null;
}

export interface SportsPlayerSearchResult {
	idPlayer: string;
	strPlayer: string;
	strNationality: string | null;
	strTeam: string | null;
	idTeam: string | null;
	strSport: string;
	strPosition: string | null;
	strNumber: string | null;
	strHeight: string | null;
	strWeight: string | null;
	dateBorn: string | null;
	strDescriptionEN: string | null;
	strThumb: string | null;
	strCutout: string | null;
	strRender: string | null;
	strBanner: string | null;
	strFanart1: string | null;
	strFanart2: string | null;
	strFanart3: string | null;
	strFanart4: string | null;
}

export interface SportsImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	source: 'thesportsdb';
}

export type SportsSearchType = 'teams' | 'leagues' | 'players';

// Animals types (Wikipedia/Wikidata) - Genus/Species based
export interface GenusSearchResult {
	wikidataId: string;
	genusName: string; // Latin genus name (e.g., "Panthera")
	commonName?: string; // Common name if available
	description?: string;
	imageUrl?: string;
	thumbUrl?: string;
	taxonomicFamily?: string;
	speciesCount?: number;
}

export interface SpeciesResult {
	wikidataId: string;
	scientificName: string; // Full scientific name (e.g., "Panthera leo")
	speciesEpithet: string; // Species epithet only (e.g., "leo")
	commonName?: string;
	description?: string;
	imageUrl?: string;
	thumbUrl?: string;
	conservationStatus?: string;
}

export interface AnimalImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	source: 'wikipedia' | 'wikimedia';
}

// Music types (MusicBrainz / Last.fm / Discogs)
export interface MusicArtistSearchResult {
	id: string;
	name: string;
	disambiguation?: string;
	type?: string;
	country?: string;
	area?: string;
	beginYear?: number;
	endYear?: number;
	tags?: string[];
	imageUrl?: string;
}

export interface MusicReleaseSearchResult {
	id: string;
	title: string;
	artistId?: string;
	artistName: string;
	releaseDate?: string;
	releaseYear?: number;
	type?: string;
	format?: string;
	trackCount?: number;
	country?: string;
	label?: string;
	tags?: string[];
	imageUrl?: string;
}

export interface MusicImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	source: 'musicbrainz' | 'lastfm' | 'discogs' | 'fanart';
}

export type MusicSearchType = 'artists' | 'releases';

// Books types (Open Library)
export interface BookAuthorSearchResult {
	key: string; // Open Library author key (e.g., "OL23919A")
	name: string;
	alternateNames?: string[];
	birthDate?: string;
	deathDate?: string;
	topWork?: string;
	workCount?: number;
	topSubjects?: string[];
	imageUrl?: string;
}

export interface BookWorkSearchResult {
	key: string; // Open Library work key (e.g., "/works/OL45883W")
	title: string;
	authorKey?: string;
	authorName?: string;
	firstPublishYear?: number;
	editionCount?: number;
	subjects?: string[];
	coverIds?: number[];
	imageUrl?: string;
	description?: string;
}

export interface BookImageItem {
	url: string;
	thumbUrl: string;
	type: string;
	source: 'openlibrary';
}

export type BookSearchType = 'authors' | 'works';
