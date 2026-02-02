#!/usr/bin/env tsx
/**
 * CLI entry point for awards extraction
 *
 * Usage:
 *   pnpm content:awards                                 # All events (sequential)
 *   pnpm content:awards -e ev0000003                    # All years of Academy Awards
 *   pnpm content:awards -e ev0000003 -y 2023            # Academy Awards 2023
 *   pnpm content:awards -e ev0000003 -y 2023 -t oscar   # Just oscars from 2023
 *   pnpm content:awards --list                          # List available events
 */

import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { extractAwards } from './core/awards-extractor.js';
import { createSqliteAdapter } from './core/db/sqlite-adapter.js';
import * as awardsLoader from './core/data/awards-loader.js';

// Load environment variables from .env file
config();

const { values, positionals } = parseArgs({
	options: {
		'event-id': { type: 'string', short: 'e' },
		year: { type: 'string', short: 'y' },
		'award-type': { type: 'string', short: 't' },
		category: { type: 'string', short: 'c' },
		'dry-run': { type: 'boolean', short: 'd', default: false },
		'db-path': { type: 'string', default: './app.db' },
		list: { type: 'boolean', short: 'l', default: false },
		'list-years': { type: 'boolean', default: false },
		'list-types': { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false }
	},
	allowPositionals: true
});

// Show help
if (values.help) {
	console.log(`
Awards Content Extractor

Fetches movie/TV data for award nominees/winners and creates database entries.
Winners get 4 fragment stickers, nominees get 1 sticker.

Usage:
  pnpm content:awards                                  Extract ALL events sequentially
  pnpm content:awards -e <event-id>                    Extract all years/types for one event
  pnpm content:awards -e <event-id> -y <year>          Filter by year
  pnpm content:awards -e <event-id> -y <year> -t <type> Filter by award type
  pnpm content:awards --list                           List available events

Options:
  -e, --event-id <id>       Award event ID (e.g., ev0000003 for Academy Awards)
  -y, --year <year>         Filter by year (e.g., 2023)
  -t, --award-type <type>   Filter by award type (e.g., oscar)
  -c, --category <cat>      Filter by category (e.g., "best picture")
  -d, --dry-run             Show what would be created without saving
  --db-path <path>          Path to database (default: ./app.db)
  -l, --list                List available award events
  --list-years              List years for an event (requires -e)
  --list-types              List award types for year (requires -e and -y)
  -h, --help                Show this help message

Environment:
  TMDB_API_KEY              TMDB API key (required)

Examples:
  pnpm content:awards                                  # Process ALL events
  pnpm content:awards --list
  pnpm content:awards -e ev0000003 --list-years
  pnpm content:awards -e ev0000003 -y 2023 --list-types
  pnpm content:awards -e ev0000003 -y 2023 -t oscar
  pnpm content:awards -e ev0000003 -y 2023 -t oscar --dry-run

Common Event IDs:
  ev0000003  Academy Awards, USA
  ev0000292  Golden Globes, USA
  ev0000123  BAFTA Awards
  ev0000223  Primetime Emmy Awards
  ev0000147  Cannes Film Festival
  ev0000681  Venice Film Festival
`);
	process.exit(0);
}

// List available events
if (values.list) {
	console.log('\nAvailable Award Events:\n');
	const events = awardsLoader.getAwardEvents();

	for (const event of events) {
		console.log(`  ${event.id}  ${event.name}`);
	}

	console.log(`\nTotal: ${events.length} events`);
	process.exit(0);
}

// Get event ID
const eventId = values['event-id'] || positionals[0];

// List years for event
if (values['list-years']) {
	if (!eventId) {
		console.error('Error: --event-id (-e) is required with --list-years');
		process.exit(1);
	}

	const eventData = awardsLoader.loadAwardEvent(eventId);
	if (!eventData) {
		console.error(`Error: Event not found: ${eventId}`);
		process.exit(1);
	}

	const eventName = awardsLoader.getEventName(eventId);
	const years = awardsLoader.getYearsForEvent(eventData);

	console.log(`\nYears for ${eventName}:\n`);
	for (const year of years) {
		const awardTypes = awardsLoader.getAwardTypesForYear(eventData, year);
		console.log(`  ${year}  (${awardTypes.length} award types)`);
	}

	console.log(`\nTotal: ${years.length} years`);
	process.exit(0);
}

// List award types for year
if (values['list-types']) {
	if (!eventId) {
		console.error('Error: --event-id (-e) is required with --list-types');
		process.exit(1);
	}

	if (!values.year) {
		console.error('Error: --year (-y) is required with --list-types');
		process.exit(1);
	}

	const eventData = awardsLoader.loadAwardEvent(eventId);
	if (!eventData) {
		console.error(`Error: Event not found: ${eventId}`);
		process.exit(1);
	}

	const eventName = awardsLoader.getEventName(eventId);
	const awardTypes = awardsLoader.getAwardTypesForYear(eventData, values.year);

	console.log(`\nAward Types for ${eventName} (${values.year}):\n`);
	for (const awardType of awardTypes) {
		const categories = awardsLoader.getCategoriesForAwardType(eventData, values.year, awardType);
		console.log(`  ${awardType}  (${categories.length} categories)`);
	}

	console.log(`\nTotal: ${awardTypes.length} award types`);
	process.exit(0);
}

// Validate API keys
const tmdbApiKey = process.env.TMDB_API_KEY;

if (!tmdbApiKey) {
	console.error('Error: TMDB_API_KEY environment variable is not set.');
	console.error('Add it to your .env file: TMDB_API_KEY=your_key_here');
	process.exit(1);
}

// OMDB is no longer required (using TMDB for content details)
const omdbApiKey = process.env.OMDB_API_KEY || '';

// Resolve database path
const dbPath = resolve(process.cwd(), values['db-path'] || './app.db');

// Create database adapter
const db = createSqliteAdapter(dbPath);

// Determine which events to process
const eventsToProcess = eventId
	? [{ id: eventId, name: awardsLoader.getEventName(eventId) || eventId }]
	: awardsLoader.getAwardEvents();

try {
	console.log('='.repeat(60));
	console.log('Awards Content Extractor');
	console.log('='.repeat(60));
	console.log();

	if (!eventId) {
		console.log(`Processing ALL ${eventsToProcess.length} events sequentially...\n`);
	}

	// Cumulative totals
	const totals = {
		sourcesCreated: 0,
		stickersCreated: 0,
		tagsCreated: 0,
		skipped: 0,
		errors: [] as string[],
		eventsSucceeded: 0,
		eventsFailed: 0
	};

	for (const event of eventsToProcess) {
		if (!eventId) {
			console.log('-'.repeat(60));
			console.log(`Processing: ${event.name} (${event.id})`);
			console.log('-'.repeat(60));
		}

		const result = await extractAwards(
			{
				eventId: event.id,
				year: values.year,
				awardType: values['award-type'],
				category: values.category,
				dryRun: values['dry-run'],
				apiKeys: {
					omdb: omdbApiKey,
					tmdb: tmdbApiKey
				}
			},
			db,
			awardsLoader
		);

		// Accumulate results
		totals.sourcesCreated += result.sourcesCreated;
		totals.stickersCreated += result.stickersCreated;
		totals.tagsCreated += result.tagsCreated;
		totals.skipped += result.skipped;
		totals.errors.push(...result.errors.map((e) => `[${event.id}] ${e}`));

		if (result.success) {
			totals.eventsSucceeded++;
			if (!eventId) {
				console.log(`  ✓ ${result.message}`);
				if (result.sourcesCreated > 0) console.log(`    Sources: ${result.sourcesCreated}`);
				if (result.stickersCreated > 0) console.log(`    Stickers: ${result.stickersCreated}`);
				if (result.skipped > 0) console.log(`    Skipped: ${result.skipped}`);
			}
		} else {
			totals.eventsFailed++;
			if (!eventId) {
				console.log(`  ✗ ${result.message}`);
			}
		}

		console.log();
	}

	console.log('='.repeat(60));

	if (eventId) {
		// Single event mode - use original output format
		const result = totals;
		if (totals.eventsFailed === 0) {
			console.log('Result: SUCCESS');
			if (result.sourcesCreated > 0) {
				console.log(`Sources created: ${result.sourcesCreated}`);
			}
			if (result.stickersCreated > 0) {
				console.log(`Stickers created: ${result.stickersCreated}`);
				console.log(`Tags created: ${result.tagsCreated}`);
			}
			if (result.skipped > 0) {
				console.log(`Skipped (already exist): ${result.skipped}`);
			}
			if (result.errors.length > 0) {
				console.log(`Errors: ${result.errors.length}`);
			}
			process.exit(0);
		} else {
			console.log('Result: FAILED');
			if (result.errors.length > 0) {
				console.log('Errors:');
				for (const err of result.errors) {
					console.log(`  - ${err}`);
				}
			}
			process.exit(1);
		}
	} else {
		// All events mode - show summary
		console.log('SUMMARY');
		console.log('='.repeat(60));
		console.log(`Events processed: ${eventsToProcess.length}`);
		console.log(`  Succeeded: ${totals.eventsSucceeded}`);
		console.log(`  Failed: ${totals.eventsFailed}`);
		console.log();
		console.log(`Total sources created: ${totals.sourcesCreated}`);
		console.log(`Total stickers created: ${totals.stickersCreated}`);
		console.log(`Total tags created: ${totals.tagsCreated}`);
		console.log(`Total skipped: ${totals.skipped}`);

		if (totals.errors.length > 0) {
			console.log(`\nTotal errors: ${totals.errors.length}`);
			if (totals.errors.length <= 10) {
				for (const err of totals.errors) {
					console.log(`  - ${err}`);
				}
			} else {
				for (const err of totals.errors.slice(0, 10)) {
					console.log(`  - ${err}`);
				}
				console.log(`  ... and ${totals.errors.length - 10} more`);
			}
		}

		process.exit(totals.eventsFailed > 0 ? 1 : 0);
	}
} finally {
	db.close();
}
