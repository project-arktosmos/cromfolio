/**
 * SQLite adapter for CLI scripts
 * Uses better-sqlite3 for direct database access
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { DbAdapter } from './db-adapter.js';
import type { ID, Source, Sticker, Provider, Tag, ProviderType, ExternalIdType } from '../types.js';

function chrono_now(): string {
	return new Date().toISOString();
}

export function createSqliteAdapter(dbPath: string): DbAdapter {
	const db = new Database(dbPath);

	// Enable foreign keys
	db.pragma('foreign_keys = ON');

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
					id, source_id, name, image, sticker_type_id, rarity_id, image_source,
					width, height, fragment_of, fragment_position, added_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
						sticker.rarityId || null,
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

		close(): void {
			db.close();
		}
	};
}
