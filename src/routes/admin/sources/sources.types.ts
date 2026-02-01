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
	source: 'tmdb' | 'tvmaze' | 'igdb' | 'sgdb' | 'tmdb-cast';
	selected?: boolean; // For template selection
}

// Character/Cast types for Movies & TV
export interface CharacterItem {
	id: number | string;
	name: string;
	character: string;
	profileUrl: string;
	profileThumbUrl: string;
	order: number;
	source: 'tmdb-cast' | 'tvmaze-character';
	isActorHeadshot: boolean; // true for actor photos, false for actual character images
	selected?: boolean; // For template selection
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

// ============================================================================
// SHARED SOURCE TAB CONFIGURATION TYPES
// ============================================================================

import type { ContentType, ImageItem as FetchImageItem, CharacterItem as FetchCharacterItem, FetchProgressEvent, FetchStatus } from '$services/fetch.service';
import type { Source } from '$types/source.type';
import type { ExternalIdType, ProviderType } from '$types/provider.type';

/** Local ImageItem with selected state for the UI */
export interface SelectableImageItem extends FetchImageItem {
	selected: boolean;
}

/** Local CharacterItem with selected state for the UI */
export interface SelectableCharacterItem extends FetchCharacterItem {
	selected: boolean;
	character: string;
}

/** Configuration for an image source tab */
export interface ImageSourceTab {
	key: string;
	label: string;
}

/** External link configuration */
export interface ExternalLink {
	label: string;
	url: string;
}

/** Configuration for a source tab - generic over the search result type */
export interface SourceTabConfig<TResult> {
	// Search configuration
	searchPlaceholder: string;
	showYearFilter: boolean;
	searchFunction: (query: string, year?: string) => Promise<TResult[]>;

	// Result accessors - how to extract data from search results
	getId: (result: TResult) => string;
	getTitle: (result: TResult) => string;
	getYear: (result: TResult) => string;
	getPoster: (result: TResult) => string | undefined;
	getUniqueKey: (result: TResult) => string;

	// Image fetching configuration
	contentType: ContentType;
	externalIdType: ExternalIdType;
	imageSources: string[];
	imageSourceTabs: ImageSourceTab[];
	showCharacters: boolean;
	progressSources: string[];

	// Source creation configuration
	sourceType: string;
	sourceBadgeText: string;
	sourceBadgeClass: string;
	providerType: ProviderType;
	buildSource: (result: TResult, coverImage: string | undefined) => Omit<Source, 'id' | 'addedAt'>;
	getExternalLinks: (result: TResult) => ExternalLink[];

	// Optional: Extra details to show in the source panel
	getExtraDetails?: (result: TResult) => { label: string; value: string }[];
}

/** Re-export provider types for convenience */
export type { ExternalIdType, ProviderType };

/** Re-export fetch types for convenience */
export type { FetchProgressEvent, FetchStatus };
