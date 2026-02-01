/**
 * Core movie extraction logic
 * Orchestrates API calls and database operations
 * Used by both CLI scripts and UI services
 */

import type {
	ExtractMovieOptions,
	ExtractResult,
	Source,
	Sticker,
	ImageItem,
	CharacterItem,
	ContentDetails
} from './types.js';
import type { DbAdapter } from './db/db-adapter.js';
import { searchMovies, getMovieDetails } from './api/omdb.js';
import { findByImdbId, getMovieImages, getMovieCredits } from './api/tmdb.js';

const DEFAULT_MAX_POSTERS = 10;
const DEFAULT_MAX_BACKDROPS = 5;

/**
 * Extract movie content and create database entries
 */
export async function extractMovie(
	options: ExtractMovieOptions,
	db: DbAdapter
): Promise<ExtractResult> {
	const {
		imdbId: providedImdbId,
		searchQuery,
		year,
		withCast = false,
		dryRun = false,
		maxPosters = DEFAULT_MAX_POSTERS,
		maxBackdrops = DEFAULT_MAX_BACKDROPS,
		apiKeys
	} = options;

	let imdbId = providedImdbId;

	try {
		// Step 1: Resolve IMDB ID if search query provided
		if (!imdbId && searchQuery) {
			console.log(`Searching for: "${searchQuery}"${year ? ` (${year})` : ''}`);
			const results = await searchMovies(apiKeys.omdb, searchQuery, year);

			if (results.length === 0) {
				return {
					success: false,
					message: `No movies found for query: "${searchQuery}"`,
					stickersCreated: 0,
					tagsCreated: 0,
					imagesSkipped: 0
				};
			}

			imdbId = results[0].imdbId;
			console.log(`Found: ${results[0].title} (${results[0].year}) - ${imdbId}`);
		}

		if (!imdbId) {
			return {
				success: false,
				message: 'No IMDB ID provided and no search query given',
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0
			};
		}

		// Step 2: Check if already exists
		const exists = await db.providerExists('imdb', imdbId);
		if (exists) {
			return {
				success: false,
				message: `Source already exists for IMDB ID: ${imdbId}`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0
			};
		}

		// Step 3: Get content details from OMDB
		console.log(`Fetching details for ${imdbId}...`);
		const details = await getMovieDetails(apiKeys.omdb, imdbId);
		console.log(`Title: ${details.title} (${details.year})`);

		// Step 4: Resolve TMDB ID
		console.log('Resolving TMDB ID...');
		const tmdbResult = await findByImdbId(apiKeys.tmdb, imdbId);

		if (!tmdbResult) {
			return {
				success: false,
				message: `Could not find TMDB ID for IMDB ID: ${imdbId}`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped: 0,
				details
			};
		}

		console.log(`TMDB ID: ${tmdbResult.tmdbId}`);

		// Step 5: Fetch images from TMDB
		console.log('Fetching images from TMDB...');
		const images = await getMovieImages(apiKeys.tmdb, tmdbResult.tmdbId);
		console.log(`Found ${images.length} images`);

		// Step 6: Optionally fetch cast
		let cast: CharacterItem[] = [];
		if (withCast) {
			console.log('Fetching cast from TMDB...');
			cast = await getMovieCredits(apiKeys.tmdb, tmdbResult.tmdbId);
			console.log(`Found ${cast.length} cast members`);
		}

		// Step 7: Filter and limit images
		const posters = images.filter((img) => img.imageType === 'poster').slice(0, maxPosters);
		const backdrops = images.filter((img) => img.imageType === 'backdrop').slice(0, maxBackdrops);
		const logos = images.filter((img) => img.imageType === 'logo').slice(0, 3);
		const selectedImages = [...posters, ...backdrops, ...logos];

		const imagesSkipped = images.length - selectedImages.length;

		console.log(
			`Selected: ${posters.length} posters, ${backdrops.length} backdrops, ${logos.length} logos`
		);
		if (imagesSkipped > 0) {
			console.log(`Skipped: ${imagesSkipped} images (exceeds limits)`);
		}

		// Step 8: Select cover image (first poster)
		const coverImage = posters.length > 0 ? posters[0].url : undefined;

		if (dryRun) {
			console.log('\n=== DRY RUN - No changes made ===');
			console.log(`Would create source: ${details.title}`);
			console.log(`Would create ${selectedImages.length} stickers`);
			if (withCast) {
				console.log(`Would create ${cast.length} cast stickers`);
			}
			return {
				success: true,
				message: `Dry run complete for "${details.title}"`,
				stickersCreated: 0,
				tagsCreated: 0,
				imagesSkipped,
				details
			};
		}

		// Step 9: Create source record
		console.log('Creating source record...');
		const source = await db.createSource({
			sourceType: 'movie',
			title: details.title,
			description: buildDescription(details),
			coverImage,
			imdbId,
			tmdbId: tmdbResult.tmdbId
		});

		// Step 10: Create provider record
		await db.createProvider(source.id, 'movie', 'imdb', imdbId);

		// Step 11: Build stickers from images
		const stickerData = buildStickerData(source.id, selectedImages, cast, withCast);
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

				// Language tag (if available)
				if (image.language) {
					const langTag = await db.findOrCreateTag('language', image.language);
					await db.addTagToSticker(sticker.id, langTag.id);
					tagsCreated++;
				}

				// Aspect ratio tag
				if (image.width && image.height) {
					const aspectRatio = getAspectRatioTag(image.width, image.height);
					if (aspectRatio) {
						const aspectTag = await db.findOrCreateTag('aspect_ratio', aspectRatio);
						await db.addTagToSticker(sticker.id, aspectTag.id);
						tagsCreated++;
					}
				}
			}
		}

		// Tags for cast stickers
		if (withCast) {
			const castStickers = stickers.filter((s) => s.imageSource === 'tmdb-cast');
			for (const sticker of castStickers) {
				const sourceTag = await db.findOrCreateTag('source', 'tmdb-cast');
				await db.addTagToSticker(sticker.id, sourceTag.id);
				tagsCreated++;

				const typeTag = await db.findOrCreateTag('type', 'actor');
				await db.addTagToSticker(sticker.id, typeTag.id);
				tagsCreated++;
			}
		}

		console.log(`\nSuccess! Created source "${details.title}" with ${stickers.length} stickers`);

		return {
			success: true,
			message: `Created source "${details.title}" with ${stickers.length} stickers`,
			source,
			stickersCreated: stickers.length,
			tagsCreated,
			imagesSkipped,
			details
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		return {
			success: false,
			message: `Failed to extract movie`,
			stickersCreated: 0,
			tagsCreated: 0,
			imagesSkipped: 0,
			error: errorMessage
		};
	}
}

/**
 * Build description from content details
 */
function buildDescription(details: ContentDetails): string {
	const parts: string[] = [`Movie (${details.year})`];

	if (details.genre) {
		parts.push(details.genre);
	}

	if (details.runtime) {
		parts.push(details.runtime);
	}

	if (details.imdbRating) {
		parts.push(`IMDb: ${details.imdbRating}`);
	}

	return parts.join(' | ');
}

/**
 * Build sticker data from images and cast
 */
function buildStickerData(
	sourceId: string | number,
	images: ImageItem[],
	cast: CharacterItem[],
	withCast: boolean
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

	// Create stickers from cast (if requested)
	if (withCast) {
		for (const member of cast) {
			stickers.push({
				sourceId,
				name: member.characterName ? `${member.name} as ${member.characterName}` : member.name,
				image: member.profileUrl,
				imageSource: member.source
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

/**
 * Get aspect ratio tag from dimensions
 */
function getAspectRatioTag(width: number, height: number): string | null {
	const ratio = width / height;

	if (Math.abs(ratio - 2 / 3) < 0.1) return 'portrait';
	if (Math.abs(ratio - 16 / 9) < 0.1) return 'landscape';
	if (Math.abs(ratio - 1) < 0.1) return 'square';
	if (ratio > 2) return 'ultrawide';

	return null;
}
