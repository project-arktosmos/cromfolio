/**
 * Core anime extraction logic
 * Orchestrates AniList/Jikan API calls and database operations
 * Used by both CLI scripts and UI services
 */

import type {
	ExtractAnimeOptions,
	ExtractAnimeResult,
	Sticker,
	ImageItem,
	CharacterItem,
	AnimeSearchResult
} from './types.js';
import type { DbAdapter } from './db/db-adapter.js';
import {
	searchAnime as searchAniList,
	getAnimeById,
	getAnimeImages as getAniListImages,
	getAnimeCharacters as getAniListCharacters
} from './api/anilist.js';
import {
	getAnimePictures as getJikanPictures,
	getAnimeCharacters as getJikanCharacters,
	findMalId
} from './api/jikan.js';

const DEFAULT_MAX_IMAGES = 10;
const DEFAULT_MAX_CHARACTERS = 20;

/**
 * Extract anime content and create database entries
 */
export async function extractAnime(
	options: ExtractAnimeOptions,
	db: DbAdapter
): Promise<ExtractAnimeResult> {
	const {
		anilistId: providedAnilistId,
		malId: providedMalId,
		searchQuery,
		withCharacters = true,
		withJikanImages = true,
		dryRun = false,
		maxImages = DEFAULT_MAX_IMAGES,
		maxCharacters = DEFAULT_MAX_CHARACTERS
	} = options;

	let anilistId = providedAnilistId;
	let malId = providedMalId;

	try {
		// Step 1: Resolve AniList ID if search query provided
		if (!anilistId && searchQuery) {
			console.log(`Searching for: "${searchQuery}"`);
			const results = await searchAniList(searchQuery, 1, 5);

			if (results.length === 0) {
				return {
					success: false,
					message: `No anime found for query: "${searchQuery}"`,
					stickersCreated: 0,
					tagsCreated: 0,
					imagesSkipped: 0
				};
			}

			anilistId = results[0].id;
			malId = results[0].malId;
			console.log(
				`Found: ${results[0].titleEnglish || results[0].titleRomaji} (${results[0].startYear || 'TBA'}) - AniList ID: ${anilistId}`
			);
		}

		if (!anilistId) {
			return {
				success: false,
				message: 'No AniList ID provided and no search query given',
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0
			};
		}

		// Step 2: Check if already exists
		const exists = await db.providerExists('anilist', anilistId.toString());
		if (exists) {
			return {
				success: false,
				message: `Source already exists for AniList ID: ${anilistId}`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0
			};
		}

		// Step 3: Get anime details from AniList
		console.log(`Fetching details for AniList ID ${anilistId}...`);
		const anime = await getAnimeById(anilistId);

		if (!anime) {
			return {
				success: false,
				message: `Anime not found for AniList ID: ${anilistId}`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0
			};
		}

		const displayTitle = anime.titleEnglish || anime.titleRomaji;
		console.log(`Title: ${displayTitle} (${anime.startYear || 'TBA'})`);

		// Update MAL ID if we got it from AniList
		if (!malId && anime.malId) {
			malId = anime.malId;
		}

		// Step 4: Fetch images from AniList
		console.log('Fetching images from AniList...');
		const aniListImages = await getAniListImages(anilistId);
		console.log(`Found ${aniListImages.length} images from AniList`);

		// Step 5: Optionally fetch additional images from Jikan (MAL)
		let jikanImages: ImageItem[] = [];
		if (withJikanImages && malId) {
			console.log(`Fetching additional images from Jikan (MAL ID: ${malId})...`);
			try {
				jikanImages = await getJikanPictures(malId);
				console.log(`Found ${jikanImages.length} images from Jikan`);
			} catch (err) {
				console.log(`Warning: Could not fetch Jikan images: ${err}`);
			}
		} else if (withJikanImages && !malId) {
			// Try to find MAL ID by title
			console.log('Trying to find MAL ID by title...');
			try {
				const foundMalId = await findMalId(displayTitle);
				if (foundMalId) {
					malId = foundMalId;
					console.log(`Found MAL ID: ${malId}`);
					jikanImages = await getJikanPictures(malId);
					console.log(`Found ${jikanImages.length} images from Jikan`);
				}
			} catch (err) {
				console.log(`Warning: Could not find MAL ID or fetch images: ${err}`);
			}
		}

		// Step 6: Optionally fetch characters
		let characters: CharacterItem[] = [];
		if (withCharacters) {
			console.log('Fetching characters from AniList...');
			characters = await getAniListCharacters(anilistId, 1, maxCharacters);
			console.log(`Found ${characters.length} characters from AniList`);

			// Optionally fetch from Jikan if we have MAL ID and want more
			if (malId && characters.length < maxCharacters) {
				try {
					console.log('Fetching additional characters from Jikan...');
					const jikanChars = await getJikanCharacters(malId);
					// Deduplicate by name
					const existingNames = new Set(characters.map((c) => c.name.toLowerCase()));
					const newChars = jikanChars.filter((c) => !existingNames.has(c.name.toLowerCase()));
					characters = [...characters, ...newChars].slice(0, maxCharacters);
					console.log(`Total characters: ${characters.length}`);
				} catch (err) {
					console.log(`Warning: Could not fetch Jikan characters: ${err}`);
				}
			}
		}

		// Step 7: Combine and limit images
		const allImages = [...aniListImages, ...jikanImages];
		const selectedImages = allImages.slice(0, maxImages);
		const imagesSkipped = allImages.length - selectedImages.length;

		console.log(`Selected ${selectedImages.length} images`);
		if (imagesSkipped > 0) {
			console.log(`Skipped: ${imagesSkipped} images (exceeds limit)`);
		}

		// Step 8: Select cover image
		const coverImage = anime.coverImageLarge || anime.coverImage || selectedImages[0]?.url;

		if (dryRun) {
			console.log('\n=== DRY RUN - No changes made ===');
			console.log(`Would create source: ${displayTitle}`);
			console.log(`Would create ${selectedImages.length} image stickers`);
			if (withCharacters) {
				console.log(`Would create ${characters.length} character stickers`);
			}
			return {
				success: true,
				message: `Dry run complete for "${displayTitle}"`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped,
				anime
			};
		}

		// Step 9: Create source record
		console.log('Creating source record...');
		const source = await db.createSource({
			sourceType: 'anime',
			title: displayTitle,
			description: buildDescription(anime),
			coverImage,
			anilistId,
			malId
		});

		// Step 10: Create provider records
		await db.createProvider(source.id, 'anime', 'anilist', anilistId.toString());

		// Step 11: Build stickers from images
		const stickerData = buildStickerData(source.id, selectedImages, characters, withCharacters);
		console.log(`Creating ${stickerData.length} stickers...`);

		const stickers = await db.createStickersBatch(stickerData);

		// Step 12: Create tags for stickers
		console.log('Creating tags...');
		let tagsCreated = 0;

		for (const sticker of stickers) {
			const image = selectedImages.find((img) => img.url === sticker.image);
			if (image) {
				// Source tag
				const sourceTag = await db.findOrCreateTag('source', image.source);
				await db.addTagToSticker(sticker.id, sourceTag.id);
				tagsCreated++;

				// Image type tag
				const typeTag = await db.findOrCreateTag('type', image.imageType);
				await db.addTagToSticker(sticker.id, typeTag.id);
				tagsCreated++;
			}
		}

		// Tags for character stickers
		if (withCharacters) {
			const charStickers = stickers.filter(
				(s) => s.imageSource === 'anilist' || s.imageSource === 'jikan'
			);
			for (const sticker of charStickers) {
				const char = characters.find((c) => c.profileUrl === sticker.image);
				if (char) {
					const sourceTag = await db.findOrCreateTag('source', char.source);
					await db.addTagToSticker(sticker.id, sourceTag.id);
					tagsCreated++;

					const typeTag = await db.findOrCreateTag('type', 'character');
					await db.addTagToSticker(sticker.id, typeTag.id);
					tagsCreated++;
				}
			}
		}

		// Add genre tags
		if (anime.genres && anime.genres.length > 0) {
			for (const sticker of stickers) {
				for (const genre of anime.genres.slice(0, 3)) {
					const genreTag = await db.findOrCreateTag('genre', genre.toLowerCase());
					await db.addTagToSticker(sticker.id, genreTag.id);
					tagsCreated++;
				}
			}
		}

		console.log(`\nSuccess! Created source "${displayTitle}" with ${stickers.length} stickers`);

		return {
			success: true,
			message: `Created source "${displayTitle}" with ${stickers.length} stickers`,
			source,
			stickersCreated: stickers.length,
			tagsCreated,
			imagesSkipped,
			anime
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		return {
			success: false,
			message: `Failed to extract anime`,
			stickersCreated: 0,
			tagsCreated: 0,
			imagesSkipped: 0,
			error: errorMessage
		};
	}
}

/**
 * Build description from anime details
 */
function buildDescription(anime: AnimeSearchResult): string {
	const parts: string[] = [];

	// Format type
	if (anime.format) {
		parts.push(formatType(anime.format));
	} else {
		parts.push('Anime');
	}

	// Year
	if (anime.startYear) {
		parts.push(`(${anime.startYear})`);
	}

	// Genres
	if (anime.genres && anime.genres.length > 0) {
		parts.push(anime.genres.slice(0, 3).join(', '));
	}

	// Score
	if (anime.averageScore) {
		parts.push(`Score: ${anime.averageScore}%`);
	}

	return parts.join(' | ');
}

/**
 * Format anime type
 */
function formatType(format: string): string {
	switch (format) {
		case 'TV':
			return 'TV Series';
		case 'TV_SHORT':
			return 'TV Short';
		case 'MOVIE':
			return 'Movie';
		case 'SPECIAL':
			return 'Special';
		case 'OVA':
			return 'OVA';
		case 'ONA':
			return 'ONA';
		case 'MUSIC':
			return 'Music';
		default:
			return format;
	}
}

/**
 * Build sticker data from images and characters
 */
function buildStickerData(
	sourceId: string | number,
	images: ImageItem[],
	characters: CharacterItem[],
	withCharacters: boolean
): Partial<Sticker>[] {
	const stickers: Partial<Sticker>[] = [];

	// Create stickers from images
	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const typeNum = images.filter((x, idx) => x.imageType === img.imageType && idx < i).length + 1;

		stickers.push({
			sourceId,
			name: `${capitalizeFirst(img.imageType)} ${typeNum}`,
			image: img.url,
			imageSource: img.source,
			width: img.width,
			height: img.height
		});
	}

	// Create stickers from characters (if requested)
	if (withCharacters) {
		for (const char of characters) {
			stickers.push({
				sourceId,
				name: char.characterName ? `${char.name} (VA: ${char.characterName})` : char.name,
				image: char.profileUrl,
				imageSource: char.source
			});
		}
	}

	return stickers;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
