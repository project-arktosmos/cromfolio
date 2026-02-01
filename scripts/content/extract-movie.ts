#!/usr/bin/env tsx
/**
 * CLI entry point for movie extraction
 *
 * Usage:
 *   pnpm content:movie -i tt0111161
 *   pnpm content:movie -s "The Matrix" -y 1999
 *   pnpm content:movie -i tt0111161 --with-cast --dry-run
 */

import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { extractMovie } from './core/movie-extractor.js';
import { createSqliteAdapter } from './core/db/sqlite-adapter.js';

// Load environment variables from .env file
config();

const { values, positionals } = parseArgs({
	options: {
		'imdb-id': { type: 'string', short: 'i' },
		search: { type: 'string', short: 's' },
		year: { type: 'string', short: 'y' },
		'with-cast': { type: 'boolean', short: 'c', default: false },
		'dry-run': { type: 'boolean', short: 'd', default: false },
		'max-posters': { type: 'string', default: '10' },
		'max-backdrops': { type: 'string', default: '5' },
		'db-path': { type: 'string', default: './app.db' },
		help: { type: 'boolean', short: 'h', default: false }
	},
	allowPositionals: true
});

// Show help
if (values.help) {
	console.log(`
Movie Content Extractor

Fetches movie data from OMDB/TMDB and creates database entries.

Usage:
  pnpm content:movie -i <imdb-id>           Extract by IMDB ID
  pnpm content:movie -s <query>             Search and extract first result
  pnpm content:movie -s <query> -y <year>   Search with year filter

Options:
  -i, --imdb-id <id>        IMDB ID (e.g., tt0111161)
  -s, --search <query>      Search query (alternative to IMDB ID)
  -y, --year <year>         Year filter for search
  -c, --with-cast           Include cast headshots as stickers
  -d, --dry-run             Show what would be created without saving
  --max-posters <n>         Maximum poster images (default: 10)
  --max-backdrops <n>       Maximum backdrop images (default: 5)
  --db-path <path>          Path to database (default: ./app.db)
  -h, --help                Show this help message

Environment:
  OMDB_API_KEY              OMDB API key (required)
  TMDB_API_KEY              TMDB API key (required)

Examples:
  pnpm content:movie -i tt0111161
  pnpm content:movie -s "The Shawshank Redemption"
  pnpm content:movie -s "The Matrix" -y 1999
  pnpm content:movie -i tt0111161 --with-cast --dry-run
`);
	process.exit(0);
}

// Validate API keys
const omdbApiKey = process.env.OMDB_API_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;

if (!omdbApiKey) {
	console.error('Error: OMDB_API_KEY environment variable is not set.');
	console.error('Add it to your .env file: OMDB_API_KEY=your_key_here');
	process.exit(1);
}

if (!tmdbApiKey) {
	console.error('Error: TMDB_API_KEY environment variable is not set.');
	console.error('Add it to your .env file: TMDB_API_KEY=your_key_here');
	process.exit(1);
}

// Validate input
const imdbId = values['imdb-id'] || positionals[0];
const searchQuery = values.search;

if (!imdbId && !searchQuery) {
	console.error('Error: Either --imdb-id (-i) or --search (-s) is required.');
	console.error('Run with --help for usage information.');
	process.exit(1);
}

// Resolve database path
const dbPath = resolve(process.cwd(), values['db-path'] || './app.db');

// Create database adapter
const db = createSqliteAdapter(dbPath);

try {
	console.log('='.repeat(60));
	console.log('Movie Content Extractor');
	console.log('='.repeat(60));
	console.log();

	const result = await extractMovie(
		{
			imdbId,
			searchQuery,
			year: values.year,
			withCast: values['with-cast'],
			dryRun: values['dry-run'],
			maxPosters: parseInt(values['max-posters'] || '10', 10),
			maxBackdrops: parseInt(values['max-backdrops'] || '5', 10),
			apiKeys: {
				omdb: omdbApiKey,
				tmdb: tmdbApiKey
			}
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
