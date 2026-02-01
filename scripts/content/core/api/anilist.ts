/**
 * AniList API client for anime search, images, and characters
 * Uses GraphQL - no API key required
 * Works in both Node.js and browser
 */

import type { AnimeSearchResult, ImageItem, CharacterItem } from '../types.js';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

interface AniListSearchResponse {
	data: {
		Page: {
			media: AniListMedia[];
		};
	};
}

interface AniListMedia {
	id: number;
	idMal?: number;
	title: {
		romaji: string;
		english?: string;
	};
	coverImage: {
		large: string;
		medium: string;
		extraLarge?: string;
	};
	bannerImage?: string;
	description?: string;
	startDate?: {
		year?: number;
	};
	season?: string;
	format?: string;
	status?: string;
	episodes?: number;
	genres?: string[];
	averageScore?: number;
}

interface AniListCharactersResponse {
	data: {
		Media: {
			characters: {
				edges: AniListCharacterEdge[];
			};
		};
	};
}

interface AniListCharacterEdge {
	node: {
		id: number;
		name: {
			full: string;
		};
		image: {
			large: string;
			medium: string;
		};
	};
	role: string;
	voiceActors: {
		id: number;
		name: {
			full: string;
		};
		image: {
			large: string;
			medium: string;
		};
		languageV2: string;
	}[];
}

const SEARCH_QUERY = `
	query ($search: String, $page: Int, $perPage: Int) {
		Page(page: $page, perPage: $perPage) {
			media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
				id
				idMal
				title {
					romaji
					english
				}
				coverImage {
					large
					medium
					extraLarge
				}
				bannerImage
				description(asHtml: false)
				startDate {
					year
				}
				season
				format
				status
				episodes
				genres
				averageScore
			}
		}
	}
`;

const SEARCH_BY_ID_QUERY = `
	query ($id: Int) {
		Media(id: $id, type: ANIME) {
			id
			idMal
			title {
				romaji
				english
			}
			coverImage {
				large
				medium
				extraLarge
			}
			bannerImage
			description(asHtml: false)
			startDate {
				year
			}
			season
			format
			status
			episodes
			genres
			averageScore
		}
	}
`;

const CHARACTERS_QUERY = `
	query ($id: Int, $page: Int, $perPage: Int) {
		Media(id: $id, type: ANIME) {
			characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
				edges {
					node {
						id
						name {
							full
						}
						image {
							large
							medium
						}
					}
					role
					voiceActors(language: JAPANESE, sort: RELEVANCE) {
						id
						name {
							full
						}
						image {
							large
							medium
						}
						languageV2
					}
				}
			}
		}
	}
`;

const IMAGES_QUERY = `
	query ($id: Int) {
		Media(id: $id, type: ANIME) {
			coverImage {
				large
				medium
				extraLarge
			}
			bannerImage
		}
	}
`;

/**
 * Execute a GraphQL query against AniList
 */
async function executeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	const response = await fetch(ANILIST_GRAPHQL_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({ query, variables })
	});

	if (!response.ok) {
		throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	if (data.errors && data.errors.length > 0) {
		throw new Error(`AniList GraphQL error: ${data.errors[0].message}`);
	}

	return data;
}

/**
 * Convert AniList media to our AnimeSearchResult type
 */
function convertMedia(media: AniListMedia): AnimeSearchResult {
	return {
		id: media.id,
		malId: media.idMal,
		titleRomaji: media.title.romaji,
		titleEnglish: media.title.english,
		coverImage: media.coverImage.medium,
		coverImageLarge: media.coverImage.extraLarge || media.coverImage.large,
		bannerImage: media.bannerImage,
		description: media.description,
		startYear: media.startDate?.year,
		season: media.season,
		format: media.format,
		status: media.status,
		episodes: media.episodes,
		genres: media.genres || [],
		averageScore: media.averageScore
	};
}

/**
 * Search for anime by title
 */
export async function searchAnime(
	query: string,
	page: number = 1,
	perPage: number = 15
): Promise<AnimeSearchResult[]> {
	const data = await executeQuery<AniListSearchResponse>(SEARCH_QUERY, {
		search: query,
		page,
		perPage
	});

	return data.data.Page.media.map(convertMedia);
}

/**
 * Get anime details by AniList ID
 */
export async function getAnimeById(anilistId: number): Promise<AnimeSearchResult | null> {
	interface SingleMediaResponse {
		data: {
			Media: AniListMedia | null;
		};
	}

	const data = await executeQuery<SingleMediaResponse>(SEARCH_BY_ID_QUERY, {
		id: anilistId
	});

	if (!data.data.Media) {
		return null;
	}

	return convertMedia(data.data.Media);
}

/**
 * Get images for an anime (cover + banner)
 */
export async function getAnimeImages(anilistId: number): Promise<ImageItem[]> {
	interface ImagesResponse {
		data: {
			Media: {
				coverImage: {
					large: string;
					medium: string;
					extraLarge?: string;
				};
				bannerImage?: string;
			};
		};
	}

	const data = await executeQuery<ImagesResponse>(IMAGES_QUERY, {
		id: anilistId
	});

	const images: ImageItem[] = [];

	// Add cover image
	images.push({
		url: data.data.Media.coverImage.extraLarge || data.data.Media.coverImage.large,
		thumbUrl: data.data.Media.coverImage.medium,
		imageType: 'cover',
		source: 'anilist'
	});

	// Add banner if available
	if (data.data.Media.bannerImage) {
		images.push({
			url: data.data.Media.bannerImage,
			thumbUrl: data.data.Media.bannerImage,
			imageType: 'banner',
			source: 'anilist'
		});
	}

	return images;
}

/**
 * Get characters for an anime
 */
export async function getAnimeCharacters(
	anilistId: number,
	page: number = 1,
	perPage: number = 25
): Promise<CharacterItem[]> {
	const data = await executeQuery<AniListCharactersResponse>(CHARACTERS_QUERY, {
		id: anilistId,
		page,
		perPage
	});

	return data.data.Media.characters.edges.map((edge, index) => {
		const voiceActor = edge.voiceActors[0];

		return {
			id: edge.node.id.toString(),
			name: edge.node.name.full,
			characterName: voiceActor?.name.full,
			profileUrl: edge.node.image.large,
			profileThumbUrl: edge.node.image.medium,
			order: index,
			source: 'anilist',
			isActorHeadshot: false
		};
	});
}
