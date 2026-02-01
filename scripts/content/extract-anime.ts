#!/usr/bin/env tsx
/**
 * CLI entry point for anime extraction
 *
 * Usage:
 *   pnpm content:anime -a 1                           # By AniList ID
 *   pnpm content:anime -s "Attack on Titan"           # By search query
 *   pnpm content:anime -a 1 --no-characters --dry-run # Without characters
 */

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { extractAnime } from './core/anime-extractor.js';
import { createSqliteAdapter } from './core/db/sqlite-adapter.js';

const { values, positionals } = parseArgs({
	options: {
		'anilist-id': { type: 'string', short: 'a' },
		'mal-id': { type: 'string', short: 'm' },
		search: { type: 'string', short: 's' },
		'with-characters': { type: 'boolean', short: 'c', default: true },
		'no-characters': { type: 'boolean', default: false },
		'with-jikan': { type: 'boolean', short: 'j', default: true },
		'no-jikan': { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', short: 'd', default: false },
		'max-images': { type: 'string', default: '10' },
		'max-characters': { type: 'string', default: '20' },
		'db-path': { type: 'string', default: './app.db' },
		help: { type: 'boolean', short: 'h', default: false }
	},
	allowPositionals: true
});

// Show help
if (values.help) {
	console.log(`
Anime Content Extractor

Fetches anime data from AniList/Jikan and creates database entries.

Usage:
  pnpm content:anime -a <anilist-id>     Extract by AniList ID
  pnpm content:anime -s <query>          Search and extract first result

Options:
  -a, --anilist-id <id>     AniList ID (e.g., 1 for Cowboy Bebop)
  -m, --mal-id <id>         MyAnimeList ID (alternative identifier)
  -s, --search <query>      Search query (alternative to ID)
  -c, --with-characters     Include character images (default: true)
  --no-characters           Exclude character images
  -j, --with-jikan          Fetch additional images from Jikan/MAL (default: true)
  --no-jikan                Skip Jikan images (faster, fewer images)
  -d, --dry-run             Show what would be created without saving
  --max-images <n>          Maximum images (default: 10)
  --max-characters <n>      Maximum characters (default: 20)
  --db-path <path>          Path to database (default: ./app.db)
  -h, --help                Show this help message

Note: No API keys required - AniList and Jikan are free public APIs.

Examples:
  pnpm content:anime -a 1
  pnpm content:anime -s "Attack on Titan"
  pnpm content:anime -s "Spirited Away" --no-characters
  pnpm content:anime -a 20 --dry-run
`);
	process.exit(0);
}

// Parse IDs
const anilistId = values['anilist-id'] || positionals[0];
const malId = values['mal-id'];
const searchQuery = values.search;

// Validate input
if (!anilistId && !malId && !searchQuery) {
	console.error('Error: Either --anilist-id (-a), --mal-id (-m), or --search (-s) is required.');
	console.error('Run with --help for usage information.');
	process.exit(1);
}

// Resolve database path
const dbPath = resolve(process.cwd(), values['db-path'] || './app.db');

// Determine character and jikan options
const withCharacters = values['no-characters'] ? false : values['with-characters'];
const withJikanImages = values['no-jikan'] ? false : values['with-jikan'];

// Create database adapter
const db = createSqliteAdapter(dbPath);

try {
	console.log('='.repeat(60));
	console.log('Anime Content Extractor');
	console.log('='.repeat(60));
	console.log();

	const result = await extractAnime(
		{
			anilistId: anilistId ? parseInt(anilistId, 10) : undefined,
			malId: malId ? parseInt(malId, 10) : undefined,
			searchQuery,
			withCharacters,
			withJikanImages,
			dryRun: values['dry-run'],
			maxImages: parseInt(values['max-images'] || '10', 10),
			maxCharacters: parseInt(values['max-characters'] || '20', 10)
		},
		db
	);

	console.log();
	console.log('='.repeat(60));

	if (result.success) {
		console.log('Result: SUCCESS');
		console.log(`Message: ${result.message}`);
		if (result.stickersCreated > 0) {
			console.log(`Stickers created: ${result.stickersCreated}`);
			console.log(`Tags created: ${result.tagsCreated}`);
		}
		if (result.imagesSkipped > 0) {
			console.log(`Images skipped: ${result.imagesSkipped}`);
		}
		process.exit(0);
	} else {
		console.log('Result: FAILED');
		console.log(`Message: ${result.message}`);
		if (result.error) {
			console.log(`Error: ${result.error}`);
		}
		process.exit(1);
	}
} finally {
	db.close();
}
