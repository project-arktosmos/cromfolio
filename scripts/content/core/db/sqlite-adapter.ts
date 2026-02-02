/**
 * SQLite adapter for CLI scripts
 * Uses better-sqlite3 for direct database access
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { DbAdapter } from './db-adapter.js';
import type { ID, Source, Sticker, Provider, Tag, ProviderType, ExternalIdType, Collection, CollectionSticker } from '../types.js';

function chrono_now(): string {
	return new Date().toISOString();
}

/**
 * Run database migrations to ensure all required tables exist.
 * Mirrors the Rust migrations in src-tauri/src/db/connection.rs
 */
function runMigrations(db: Database.Database): void {
	// Create sources table
	db.exec(`
		CREATE TABLE IF NOT EXISTS sources (
			id TEXT PRIMARY KEY,
			source_type TEXT NOT NULL DEFAULT 'movie',
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			cover_image TEXT,
			wikia_url TEXT,
			imdb_id TEXT,
			tmdb_id INTEGER,
			igdb_id INTEGER,
			igdb_slug TEXT,
			sgdb_id INTEGER,
			anilist_id INTEGER,
			mal_id INTEGER,
			sports_type TEXT,
			sports_db_team_id TEXT,
			sports_db_league_id TEXT,
			sports_db_player_id TEXT,
			sport TEXT,
			league TEXT,
			country TEXT,
			wikidata_id TEXT,
			scientific_name TEXT,
			conservation_status TEXT,
			taxonomic_class TEXT,
			added_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`);

	// Create stickers table
	db.exec(`
		CREATE TABLE IF NOT EXISTS stickers (
			id TEXT PRIMARY KEY,
			source_id TEXT NOT NULL,
			name TEXT NOT NULL,
			image TEXT NOT NULL,
			sticker_type_id TEXT,
			image_source TEXT,
			width INTEGER,
			height INTEGER,
			fragment_of TEXT,
			fragment_position INTEGER,
			added_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
		)
	`);

	// Create stickers index
	db.exec(`CREATE INDEX IF NOT EXISTS idx_stickers_source_id ON stickers(source_id)`);

	// Create providers table
	db.exec(`
		CREATE TABLE IF NOT EXISTS providers (
			id TEXT PRIMARY KEY,
			source_id TEXT NOT NULL,
			provider_type TEXT NOT NULL,
			external_id TEXT NOT NULL,
			external_id_type TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
			UNIQUE(provider_type, external_id_type, external_id)
		)
	`);

	// Create tags table
	db.exec(`
		CREATE TABLE IF NOT EXISTS tags (
			id TEXT PRIMARY KEY,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			UNIQUE(key, value)
		)
	`);

	// Create sticker_tags junction table
	db.exec(`
		CREATE TABLE IF NOT EXISTS sticker_tags (
			sticker_id TEXT NOT NULL,
			tag_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			PRIMARY KEY (sticker_id, tag_id),
			FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
			FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
		)
	`);

	// Create tags indexes
	db.exec(`CREATE INDEX IF NOT EXISTS idx_tags_key ON tags(key)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sticker_tags_sticker_id ON sticker_tags(sticker_id)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sticker_tags_tag_id ON sticker_tags(tag_id)`);

	// Create collection_types table
	db.exec(`
		CREATE TABLE IF NOT EXISTS collection_types (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL DEFAULT '',
			icon TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`);

	// Seed default collection types if empty
	const typeCount = db.prepare('SELECT COUNT(*) as count FROM collection_types').get() as { count: number };
	if (typeCount.count === 0) {
		const now = chrono_now();
		const insertType = db.prepare(`
			INSERT INTO collection_types (id, name, description, icon, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);
		insertType.run('anime', 'Anime', 'Collections featuring anime series and movies', '🎌', 0, now, now);
		insertType.run('awards', 'Awards', 'Collections featuring award shows and ceremonies', '🏆', 1, now, now);
		insertType.run('pokemon', 'Pokemon', 'Collections featuring Pokemon from various generations', '⚡', 2, now, now);
	}

	// Create collections table
	db.exec(`
		CREATE TABLE IF NOT EXISTS collections (
			id TEXT PRIMARY KEY,
			collection_type_id TEXT REFERENCES collection_types(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			cover_image TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`);

	// Create collection_stickers junction table
	db.exec(`
		CREATE TABLE IF NOT EXISTS collection_stickers (
			collection_id TEXT NOT NULL,
			sticker_id TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			added_at TEXT NOT NULL,
			PRIMARY KEY (collection_id, sticker_id),
			FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
			FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE
		)
	`);

	// Create collection indexes
	db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_stickers_collection_id ON collection_stickers(collection_id)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_stickers_sticker_id ON collection_stickers(sticker_id)`);
}

export function createSqliteAdapter(dbPath: string): DbAdapter {
	const db = new Database(dbPath);

	// Enable foreign keys
	db.pragma('foreign_keys = ON');

	// Run migrations to ensure tables exist
	runMigrations(db);

	return {
		async providerExists(externalIdType: ExternalIdType, externalId: string): Promise<boolean> {
			const stmt = db.prepare(
				'SELECT COUNT(*) as count FROM providers WHERE external_id_type = ? AND external_id = ?'
			);
			const result = stmt.get(externalIdType, externalId) as { count: number };
			return result.count > 0;
		},

		async createSource(source: Partial<Source>): Promise<Source> {
			const id = (source.id as string) || randomUUID();
			const now = chrono_now();

			const stmt = db.prepare(`
				INSERT INTO sources (
					id, source_type, title, description, cover_image, wikia_url,
					imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
					anilist_id, mal_id,
					sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
					sport, league, country,
					wikidata_id, scientific_name, conservation_status, taxonomic_class,
					added_at, created_at, updated_at
				) VALUES (
					?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?,
					?, ?,
					?, ?, ?, ?,
					?, ?, ?,
					?, ?, ?, ?,
					?, ?, ?
				)
			`);

			stmt.run(
				id,
				source.sourceType || 'movie',
				source.title || '',
				source.description || '',
				source.coverImage || null,
				source.wikiaUrl || null,
				source.imdbId || null,
				source.tmdbId || null,
				source.igdbId || null,
				source.igdbSlug || null,
				source.sgdbId || null,
				source.anilistId || null,
				source.malId || null,
				source.sportsType || null,
				source.sportsDbTeamId || null,
				source.sportsDbLeagueId || null,
				source.sportsDbPlayerId || null,
				source.sport || null,
				source.league || null,
				source.country || null,
				source.wikidataId || null,
				source.scientificName || null,
				source.conservationStatus || null,
				source.taxonomicClass || null,
				source.addedAt || now,
				now,
				now
			);

			return {
				...source,
				id,
				sourceType: source.sourceType || 'movie',
				title: source.title || '',
				description: source.description || ''
			} as Source;
		},

		async createProvider(
			sourceId: ID,
			providerType: ProviderType,
			externalIdType: ExternalIdType,
			externalId: string
		): Promise<Provider> {
			const id = randomUUID();
			const now = chrono_now();

			const stmt = db.prepare(`
				INSERT INTO providers (id, source_id, provider_type, external_id, external_id_type, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`);

			stmt.run(id, sourceId, providerType, externalId, externalIdType, now);

			return {
				id,
				sourceId,
				providerType,
				externalId,
				externalIdType,
				createdAt: now
			};
		},

		async createStickersBatch(stickers: Partial<Sticker>[]): Promise<Sticker[]> {
			const now = chrono_now();
			const created: Sticker[] = [];

			const insertStmt = db.prepare(`
				INSERT INTO stickers (
					id, source_id, name, image, sticker_type_id, image_source,
					width, height, fragment_of, fragment_position, added_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			// Use a transaction for atomic batch insert
			const insertMany = db.transaction((stickers: Partial<Sticker>[]) => {
				for (const sticker of stickers) {
					const id = (sticker.id as string) || randomUUID();

					insertStmt.run(
						id,
						sticker.sourceId || '',
						sticker.name || '',
						sticker.image || '',
						sticker.stickerTypeId || null,
						sticker.imageSource || null,
						sticker.width || null,
						sticker.height || null,
						sticker.fragmentOf || null,
						sticker.fragmentPosition || null,
						sticker.addedAt || now,
						now,
						now
					);

					created.push({
						...sticker,
						id,
						sourceId: sticker.sourceId || '',
						name: sticker.name || '',
						image: sticker.image || '',
						createdAt: now,
						updatedAt: now
					} as Sticker);
				}
			});

			insertMany(stickers);
			return created;
		},

		async findOrCreateTag(key: string, value: string): Promise<Tag> {
			// Try to find existing tag
			const findStmt = db.prepare(
				'SELECT id, key, value, created_at, updated_at FROM tags WHERE key = ? AND value = ?'
			);
			const existing = findStmt.get(key, value) as
				| { id: string; key: string; value: string; created_at: string; updated_at: string }
				| undefined;

			if (existing) {
				return {
					id: existing.id,
					key: existing.key,
					value: existing.value,
					createdAt: existing.created_at,
					updatedAt: existing.updated_at
				};
			}

			// Create new tag
			const id = randomUUID();
			const now = chrono_now();

			const insertStmt = db.prepare(`
				INSERT INTO tags (id, key, value, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?)
			`);

			insertStmt.run(id, key, value, now, now);

			return {
				id,
				key,
				value,
				createdAt: now,
				updatedAt: now
			};
		},

		async addTagToSticker(stickerId: ID, tagId: ID): Promise<void> {
			const now = chrono_now();

			const stmt = db.prepare(`
				INSERT OR IGNORE INTO sticker_tags (sticker_id, tag_id, created_at)
				VALUES (?, ?, ?)
			`);

			stmt.run(stickerId, tagId, now);
		},

		async findSourceByTitle(title: string): Promise<Source | null> {
			const stmt = db.prepare(`
				SELECT id, source_type, title, description, cover_image
				FROM sources
				WHERE title = ?
			`);

			const row = stmt.get(title) as {
				id: string;
				source_type: string;
				title: string;
				description: string;
				cover_image: string | null;
			} | undefined;

			if (!row) return null;

			return {
				id: row.id,
				sourceType: row.source_type as Source['sourceType'],
				title: row.title,
				description: row.description,
				coverImage: row.cover_image || undefined
			};
		},

		async findCollectionByTitle(title: string): Promise<Collection | null> {
			const stmt = db.prepare(`
				SELECT id, collection_type_id, title, description, cover_image, created_at, updated_at
				FROM collections
				WHERE title = ?
			`);

			const row = stmt.get(title) as {
				id: string;
				collection_type_id: string | null;
				title: string;
				description: string;
				cover_image: string | null;
				created_at: string;
				updated_at: string;
			} | undefined;

			if (!row) return null;

			return {
				id: row.id,
				collectionTypeId: row.collection_type_id || undefined,
				title: row.title,
				description: row.description,
				coverImage: row.cover_image || undefined,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		},

		async createCollection(collection: Partial<Collection>): Promise<Collection> {
			const id = (collection.id as string) || randomUUID();
			const now = chrono_now();

			const stmt = db.prepare(`
				INSERT INTO collections (
					id, collection_type_id, title, description, cover_image, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)
			`);

			stmt.run(
				id,
				collection.collectionTypeId || null,
				collection.title || '',
				collection.description || '',
				collection.coverImage || null,
				now,
				now
			);

			return {
				...collection,
				id,
				title: collection.title || '',
				description: collection.description || '',
				createdAt: now,
				updatedAt: now
			} as Collection;
		},

		async addStickerToCollection(collectionId: ID, stickerId: ID, sortOrder: number = 0): Promise<CollectionSticker> {
			const now = chrono_now();

			const stmt = db.prepare(`
				INSERT OR IGNORE INTO collection_stickers (collection_id, sticker_id, sort_order, added_at)
				VALUES (?, ?, ?, ?)
			`);

			stmt.run(collectionId, stickerId, sortOrder, now);

			return {
				collectionId,
				stickerId,
				sortOrder,
				addedAt: now
			};
		},

		close(): void {
			db.close();
		}
	};
}
