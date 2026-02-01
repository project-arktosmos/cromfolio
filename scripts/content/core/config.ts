/**
 * Configuration loader for content extraction scripts
 * Loads API keys from environment variables (via dotenv in Node.js)
 */

import type { ApiKeys } from './types.js';

/**
 * Load API keys from environment variables
 * In Node.js context, expects dotenv to be configured
 * In browser context, keys should be passed directly
 */
export function getApiKeys(): ApiKeys {
	const omdb = process.env.OMDB_API_KEY;
	const tmdb = process.env.TMDB_API_KEY;

	if (!omdb) {
		throw new Error('OMDB_API_KEY environment variable is not set. Add it to your .env file.');
	}

	if (!tmdb) {
		throw new Error('TMDB_API_KEY environment variable is not set. Add it to your .env file.');
	}

	return { omdb, tmdb };
}

/**
 * Validate that required API keys are present
 */
export function validateApiKeys(keys: ApiKeys): void {
	if (!keys.omdb || keys.omdb.trim() === '') {
		throw new Error('OMDB API key is missing or empty');
	}

	if (!keys.tmdb || keys.tmdb.trim() === '') {
		throw new Error('TMDB API key is missing or empty');
	}
}

/**
 * Get database path - resolves to app.db in project root
 */
export function getDatabasePath(): string {
	// In Node.js context, use process.cwd() or resolve relative to script
	return process.env.DATABASE_PATH || './app.db';
}
