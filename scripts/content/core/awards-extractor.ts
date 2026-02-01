/**
 * Core awards extraction logic
 * Extracts movies from award event data and creates database entries
 * Used by both CLI scripts and UI services
 */

import type {
	ExtractAwardsOptions,
	ExtractAwardsResult,
	Source,
	Sticker,
	ContentDetails,
	AwardEvent
} from './types.js';
import type { DbAdapter } from './db/db-adapter.js';
import { getContentDetails } from './api/omdb.js';
import { findByImdbId, getMovieImages, getTvImages } from './api/tmdb.js';

type FragmentPosition = 1 | 2 | 3 | 4;

export interface AwardsDataLoader {
	loadAwardEvent(eventId: string): AwardEvent | null;
	getEventName(eventId: string): string;
	getYearsForEvent(event: AwardEvent): string[];
	getAwardTypesForYear(event: AwardEvent, year: string): string[];
	getCategoriesForAwardType(event: AwardEvent, year: string, awardType: string): string[];
	getNomineesForCategory(
		event: AwardEvent,
		year: string,
		awardType: string,
		category: string
	): { nominee: string[]; winner: string[] } | null;
	formatCategoryName(category: string): string;
	formatAwardTypeName(awardType: string): string;
}

interface NomineeInfo {
	imdbId: string;
	category: string;
	isWinner: boolean;
}

/**
 * Extract award entries and create database records
 */
export async function extractAwards(
	options: ExtractAwardsOptions,
	db: DbAdapter,
	dataLoader: AwardsDataLoader
): Promise<ExtractAwardsResult> {
	const {
		eventId,
		year: filterYear,
		awardType: filterAwardType,
		category: filterCategory,
		dryRun = false,
		apiKeys
	} = options;

	const errors: string[] = [];
	let sourcesCreated = 0;
	let stickersCreated = 0;
	let tagsCreated = 0;
	let skipped = 0;

	try {
		// Step 1: Load award event data
		console.log(`Loading award event: ${eventId}`);
		const eventData = dataLoader.loadAwardEvent(eventId);

		if (!eventData) {
			return {
				success: false,
				message: `Award event not found: ${eventId}`,
				sourcesCreated: 0,
				stickersCreated: 0,
				tagsCreated: 0,
				skipped: 0,
				errors: [`Event not found: ${eventId}`]
			};
		}

		const eventName = dataLoader.getEventName(eventId);
		console.log(`Event: ${eventName}`);

		// Step 2: Determine which years to process
		const allYears = dataLoader.getYearsForEvent(eventData);
		const yearsToProcess = filterYear ? [filterYear] : allYears;

		console.log(`Processing ${yearsToProcess.length} year(s)`);

		// Step 3: Collect all nominees to process
		const nomineesToProcess: NomineeInfo[] = [];

		for (const year of yearsToProcess) {
			if (!eventData[year]) {
				console.log(`Year ${year} not found in event data, skipping`);
				continue;
			}

			const awardTypes = filterAwardType
				? [filterAwardType]
				: dataLoader.getAwardTypesForYear(eventData, year);

			for (const awardType of awardTypes) {
				if (!eventData[year]?.[awardType]) {
					console.log(`Award type "${awardType}" not found for year ${year}, skipping`);
					continue;
				}

				const categories = filterCategory
					? [filterCategory]
					: dataLoader.getCategoriesForAwardType(eventData, year, awardType);

				for (const category of categories) {
					const categoryData = dataLoader.getNomineesForCategory(
						eventData,
						year,
						awardType,
						category
					);

					if (!categoryData) continue;

					// Collect all IMDB IDs from this category
					const allNominees = new Set([...categoryData.nominee, ...categoryData.winner]);
					const winners = new Set(categoryData.winner);

					for (const imdbId of allNominees) {
						nomineesToProcess.push({
							imdbId,
							category,
							isWinner: winners.has(imdbId)
						});
					}
				}
			}
		}

		// Deduplicate by IMDB ID (keep winner status if any occurrence is a winner)
		const uniqueNominees = new Map<string, NomineeInfo>();
		for (const nominee of nomineesToProcess) {
			const existing = uniqueNominees.get(nominee.imdbId);
			if (!existing) {
				uniqueNominees.set(nominee.imdbId, nominee);
			} else if (nominee.isWinner && !existing.isWinner) {
				// If this occurrence is a winner, update the status
				existing.isWinner = true;
			}
		}

		const nominees = Array.from(uniqueNominees.values());
		console.log(`\nFound ${nominees.length} unique nominees to process`);
		console.log(
			`  - Winners: ${nominees.filter((n) => n.isWinner).length}`
		);
		console.log(
			`  - Nominees only: ${nominees.filter((n) => !n.isWinner).length}`
		);

		if (dryRun) {
			console.log('\n=== DRY RUN - No changes will be made ===\n');
		}

		// Step 4: Create source for this award list
		const sourceTitle = buildAwardSourceTitle(
			eventName,
			filterYear,
			filterAwardType ? dataLoader.formatAwardTypeName(filterAwardType) : undefined
		);

		let source: Source | null = null;

		if (!dryRun) {
			console.log(`\nCreating source: "${sourceTitle}"`);
			source = await db.createSource({
				sourceType: 'award_list',
				title: sourceTitle,
				description: buildAwardSourceDescription(
					eventName,
					filterYear,
					filterAwardType,
					filterCategory,
					dataLoader
				)
			});
			sourcesCreated = 1;
		}

		// Step 5: Process each nominee
		let processedCount = 0;
		const totalCount = nominees.length;

		for (const nominee of nominees) {
			processedCount++;
			const progress = `[${processedCount}/${totalCount}]`;

			try {
				// Check if already exists
				const exists = await db.providerExists('imdb', nominee.imdbId);
				if (exists) {
					console.log(`${progress} Skipping ${nominee.imdbId} (already exists)`);
					skipped++;
					continue;
				}

				// Fetch content details from OMDB
				console.log(
					`${progress} Fetching ${nominee.imdbId}${nominee.isWinner ? ' (WINNER)' : ''}...`
				);
				let details: ContentDetails;
				try {
					details = await getContentDetails(apiKeys.omdb, nominee.imdbId);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.log(`  Error fetching OMDB details: ${msg}`);
					errors.push(`${nominee.imdbId}: ${msg}`);
					continue;
				}

				console.log(`  Title: ${details.title} (${details.year})`);

				// Get poster image (prefer TMDB for higher quality)
				let posterUrl = details.poster;

				try {
					const tmdbResult = await findByImdbId(apiKeys.tmdb, nominee.imdbId);
					if (tmdbResult) {
						const getImages =
							tmdbResult.mediaType === 'tv' ? getTvImages : getMovieImages;
						const images = await getImages(apiKeys.tmdb, tmdbResult.tmdbId);
						const posters = images.filter((img) => img.imageType === 'poster');
						if (posters.length > 0) {
							posterUrl = posters[0].url;
						}
					}
				} catch {
					// TMDB lookup failed, fall back to OMDB poster
				}

				if (!posterUrl) {
					console.log('  No poster available, skipping');
					errors.push(`${nominee.imdbId}: No poster available`);
					continue;
				}

				if (dryRun) {
					const stickerCount = nominee.isWinner ? 4 : 1;
					console.log(
						`  Would create ${stickerCount} sticker(s) for "${details.title}"`
					);
					stickersCreated += stickerCount;
					continue;
				}

				// Create stickers
				const sourceId = source!.id;
				const now = new Date().toISOString();

				if (nominee.isWinner) {
					// Winners get 4 fragment stickers
					const fragmentGroupId = crypto.randomUUID();
					const fragmentPositions: FragmentPosition[] = [1, 2, 3, 4];
					const positionLabels = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];

					const fragmentStickers: Partial<Sticker>[] = fragmentPositions.map((pos, i) => ({
						sourceId,
						name: `${details.title} (${positionLabels[i]})`,
						image: posterUrl!,
						stickerTypeId: 'winner',
						imageSource: 'tmdb',
						fragmentOf: fragmentGroupId,
						fragmentPosition: pos,
						addedAt: now
					}));

					const created = await db.createStickersBatch(fragmentStickers);
					stickersCreated += created.length;

					// Add tags to each fragment
					for (const sticker of created) {
						tagsCreated += await addAwardTags(
							db,
							sticker.id,
							eventId,
							eventName,
							filterYear || 'all',
							filterAwardType || 'all',
							nominee.category,
							'winner',
							nominee.imdbId
						);

						// Fragment-specific tags
						if (sticker.fragmentOf) {
							const fragOfTag = await db.findOrCreateTag('fragment_of', sticker.fragmentOf);
							await db.addTagToSticker(sticker.id, fragOfTag.id);
							tagsCreated++;

							if (sticker.fragmentPosition) {
								const fragPosTag = await db.findOrCreateTag(
									'fragment_position',
									String(sticker.fragmentPosition)
								);
								await db.addTagToSticker(sticker.id, fragPosTag.id);
								tagsCreated++;
							}
						}
					}

					console.log(`  Created 4 fragment stickers for winner "${details.title}"`);
				} else {
					// Nominees get 1 sticker
					const nomineeStickers: Partial<Sticker>[] = [
						{
							sourceId,
							name: details.title,
							image: posterUrl,
							stickerTypeId: 'nominee',
							imageSource: 'tmdb',
							addedAt: now
						}
					];

					const created = await db.createStickersBatch(nomineeStickers);
					stickersCreated += created.length;

					// Add tags
					for (const sticker of created) {
						tagsCreated += await addAwardTags(
							db,
							sticker.id,
							eventId,
							eventName,
							filterYear || 'all',
							filterAwardType || 'all',
							nominee.category,
							'nominee',
							nominee.imdbId
						);
					}

					console.log(`  Created sticker for nominee "${details.title}"`);
				}

				// Create provider record to prevent future duplicates
				await db.createProvider(source!.id, 'movie', 'imdb', nominee.imdbId);

				// Rate limiting pause to avoid API throttling
				await sleep(100);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`  Error processing ${nominee.imdbId}: ${msg}`);
				errors.push(`${nominee.imdbId}: ${msg}`);
			}
		}

		const message = dryRun
			? `Dry run complete: would create ${stickersCreated} stickers from ${totalCount} nominees`
			: `Created ${stickersCreated} stickers from ${totalCount - skipped - errors.length} nominees`;

		console.log(`\n${message}`);

		if (errors.length > 0) {
			console.log(`Errors: ${errors.length}`);
		}

		if (skipped > 0) {
			console.log(`Skipped (already exist): ${skipped}`);
		}

		return {
			success: true,
			message,
			sourcesCreated,
			stickersCreated,
			tagsCreated,
			skipped,
			errors
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		return {
			success: false,
			message: `Failed to extract awards`,
			sourcesCreated: 0,
			stickersCreated: 0,
			tagsCreated: 0,
			skipped: 0,
			errors: [errorMessage]
		};
	}
}

/**
 * Build source title for award list
 */
function buildAwardSourceTitle(
	eventName: string,
	year?: string,
	awardType?: string
): string {
	const parts = [eventName];

	if (year) {
		parts.push(year);
	}

	if (awardType) {
		parts.push(awardType);
	}

	return parts.join(' - ');
}

/**
 * Build source description for award list
 */
function buildAwardSourceDescription(
	eventName: string,
	year?: string,
	awardType?: string,
	category?: string,
	dataLoader?: AwardsDataLoader
): string {
	const parts: string[] = [];

	parts.push(`Award event: ${eventName}`);

	if (year) {
		parts.push(`Year: ${year}`);
	}

	if (awardType && dataLoader) {
		parts.push(`Type: ${dataLoader.formatAwardTypeName(awardType)}`);
	}

	if (category && dataLoader) {
		parts.push(`Category: ${dataLoader.formatCategoryName(category)}`);
	}

	return parts.join(' | ');
}

/**
 * Add award metadata tags to a sticker
 */
async function addAwardTags(
	db: DbAdapter,
	stickerId: string | number,
	eventId: string,
	eventName: string,
	year: string,
	awardType: string,
	category: string,
	status: 'winner' | 'nominee',
	imdbId: string
): Promise<number> {
	let tagsCreated = 0;

	const tags: [string, string][] = [
		['award_event', eventId],
		['award_event_name', eventName],
		['award_year', year],
		['award_type', awardType],
		['award_category', category],
		['award_status', status],
		['imdb_id', imdbId]
	];

	for (const [key, value] of tags) {
		const tag = await db.findOrCreateTag(key, value);
		await db.addTagToSticker(stickerId, tag.id);
		tagsCreated++;
	}

	return tagsCreated;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
