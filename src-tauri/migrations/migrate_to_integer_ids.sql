-- Migration: Convert TEXT UUIDs to INTEGER IDs
-- This script migrates all tables from TEXT PRIMARY KEY to INTEGER PRIMARY KEY AUTOINCREMENT
-- Run with: sqlite3 app.db < src-tauri/migrations/migrate_to_integer_ids.sql

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Drop redundant index
DROP INDEX IF EXISTS idx_sticker_tags_sticker_id;

-- ============================================================================
-- LEVEL 0 TABLES (No FK dependencies)
-- ============================================================================

-- sources
CREATE TABLE _id_map_sources (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_sources (old_id) SELECT id FROM sources ORDER BY rowid;
UPDATE _id_map_sources SET new_id = rowid;

CREATE TABLE sources_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
);

INSERT INTO sources_new SELECT
    m.new_id, s.source_type, s.title, s.description, s.cover_image, s.wikia_url,
    s.imdb_id, s.tmdb_id, s.igdb_id, s.igdb_slug, s.sgdb_id, s.anilist_id, s.mal_id,
    s.sports_type, s.sports_db_team_id, s.sports_db_league_id, s.sports_db_player_id,
    s.sport, s.league, s.country, s.wikidata_id, s.scientific_name, s.conservation_status,
    s.taxonomic_class, s.added_at, s.created_at, s.updated_at
FROM sources s JOIN _id_map_sources m ON s.id = m.old_id;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

-- tags
CREATE TABLE _id_map_tags (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_tags (old_id) SELECT id FROM tags ORDER BY rowid;
UPDATE _id_map_tags SET new_id = rowid;

CREATE TABLE tags_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(key, value)
);

INSERT INTO tags_new SELECT m.new_id, t.key, t.value, t.created_at, t.updated_at
FROM tags t JOIN _id_map_tags m ON t.id = m.old_id;

DROP TABLE tags;
ALTER TABLE tags_new RENAME TO tags;
CREATE INDEX idx_tags_key ON tags(key);

-- rarities
CREATE TABLE _id_map_rarities (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_rarities (old_id) SELECT id FROM rarities ORDER BY rowid;
UPDATE _id_map_rarities SET new_id = rowid;

CREATE TABLE rarities_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color_from TEXT NOT NULL DEFAULT '#808080',
    color_to TEXT NOT NULL DEFAULT '#A0A0A0',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO rarities_new SELECT m.new_id, r.name, r.color_from, r.color_to, r.sort_order, r.created_at, r.updated_at
FROM rarities r JOIN _id_map_rarities m ON r.id = m.old_id;

DROP TABLE rarities;
ALTER TABLE rarities_new RENAME TO rarities;

-- sticker_types
CREATE TABLE _id_map_sticker_types (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_sticker_types (old_id) SELECT id FROM sticker_types ORDER BY rowid;
UPDATE _id_map_sticker_types SET new_id = rowid;

CREATE TABLE sticker_types_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Generic',
    source_type TEXT,
    badge_color TEXT NOT NULL DEFAULT 'badge-ghost',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO sticker_types_new SELECT m.new_id, st.name, st.description, st.category, st.source_type, st.badge_color, st.sort_order, st.created_at, st.updated_at
FROM sticker_types st JOIN _id_map_sticker_types m ON st.id = m.old_id;

DROP TABLE sticker_types;
ALTER TABLE sticker_types_new RENAME TO sticker_types;

-- collection_types
CREATE TABLE _id_map_collection_types (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_collection_types (old_id) SELECT id FROM collection_types ORDER BY rowid;
UPDATE _id_map_collection_types SET new_id = rowid;

CREATE TABLE collection_types_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO collection_types_new SELECT m.new_id, ct.name, ct.description, ct.icon, ct.sort_order, ct.created_at, ct.updated_at
FROM collection_types ct JOIN _id_map_collection_types m ON ct.id = m.old_id;

DROP TABLE collection_types;
ALTER TABLE collection_types_new RENAME TO collection_types;
CREATE INDEX idx_collection_types_sort_order ON collection_types(sort_order);

-- llm_configs
CREATE TABLE _id_map_llm_configs (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_llm_configs (old_id) SELECT id FROM llm_configs ORDER BY rowid;
UPDATE _id_map_llm_configs SET new_id = rowid;

CREATE TABLE llm_configs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('lmstudio', 'ollama')),
    base_url TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO llm_configs_new SELECT m.new_id, lc.name, lc.provider, lc.base_url, lc.is_default, lc.created_at, lc.updated_at
FROM llm_configs lc JOIN _id_map_llm_configs m ON lc.id = m.old_id;

DROP TABLE llm_configs;
ALTER TABLE llm_configs_new RENAME TO llm_configs;

-- stamp_packs
CREATE TABLE _id_map_stamp_packs (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_stamp_packs (old_id) SELECT id FROM stamp_packs ORDER BY rowid;
UPDATE _id_map_stamp_packs SET new_id = rowid;

CREATE TABLE stamp_packs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    tray_image TEXT,
    pack_file TEXT,
    sticker_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO stamp_packs_new SELECT m.new_id, sp.source, sp.name, sp.author, sp.tray_image, sp.pack_file, sp.sticker_count, sp.created_at, sp.updated_at
FROM stamp_packs sp JOIN _id_map_stamp_packs m ON sp.id = m.old_id;

DROP TABLE stamp_packs;
ALTER TABLE stamp_packs_new RENAME TO stamp_packs;
CREATE INDEX idx_stamp_packs_source ON stamp_packs(source);

-- pokemon_trivia_templates
CREATE TABLE _id_map_pokemon_trivia_templates (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_pokemon_trivia_templates (old_id) SELECT id FROM pokemon_trivia_templates ORDER BY rowid;
UPDATE _id_map_pokemon_trivia_templates SET new_id = rowid;

CREATE TABLE pokemon_trivia_templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_key TEXT NOT NULL,
    question_template TEXT NOT NULL,
    answer_template TEXT NOT NULL,
    difficulty TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO pokemon_trivia_templates_new SELECT m.new_id, pt.tag_key, pt.question_template, pt.answer_template, pt.difficulty, pt.is_active, pt.created_at, pt.updated_at
FROM pokemon_trivia_templates pt JOIN _id_map_pokemon_trivia_templates m ON pt.id = m.old_id;

DROP TABLE pokemon_trivia_templates;
ALTER TABLE pokemon_trivia_templates_new RENAME TO pokemon_trivia_templates;
CREATE INDEX idx_pokemon_trivia_templates_tag_key ON pokemon_trivia_templates(tag_key);

-- pokemon_trivia_templates_v2
CREATE TABLE _id_map_pokemon_trivia_templates_v2 (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_pokemon_trivia_templates_v2 (old_id) SELECT id FROM pokemon_trivia_templates_v2 ORDER BY rowid;
UPDATE _id_map_pokemon_trivia_templates_v2 SET new_id = rowid;

CREATE TABLE pokemon_trivia_templates_v2_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    template_type TEXT NOT NULL,
    question_template TEXT NOT NULL,
    answer_template TEXT NOT NULL,
    primary_attribute TEXT NOT NULL,
    conditions TEXT NOT NULL DEFAULT '[]',
    condition_logic TEXT NOT NULL DEFAULT 'and',
    scope_filters TEXT NOT NULL DEFAULT '{}',
    comparison_config TEXT,
    difficulty TEXT,
    weight INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO pokemon_trivia_templates_v2_new SELECT m.new_id, pt.name, pt.description, pt.template_type, pt.question_template, pt.answer_template, pt.primary_attribute, pt.conditions, pt.condition_logic, pt.scope_filters, pt.comparison_config, pt.difficulty, pt.weight, pt.is_active, pt.created_at, pt.updated_at
FROM pokemon_trivia_templates_v2 pt JOIN _id_map_pokemon_trivia_templates_v2 m ON pt.id = m.old_id;

DROP TABLE pokemon_trivia_templates_v2;
ALTER TABLE pokemon_trivia_templates_v2_new RENAME TO pokemon_trivia_templates_v2;
CREATE INDEX idx_ptt_v2_template_type ON pokemon_trivia_templates_v2(template_type);
CREATE INDEX idx_ptt_v2_primary_attribute ON pokemon_trivia_templates_v2(primary_attribute);
CREATE INDEX idx_ptt_v2_is_active ON pokemon_trivia_templates_v2(is_active);
CREATE INDEX idx_ptt_v2_difficulty ON pokemon_trivia_templates_v2(difficulty);

-- _user_game_stats
CREATE TABLE _id_map_user_game_stats (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_game_stats (old_id) SELECT id FROM _user_game_stats ORDER BY rowid;
UPDATE _id_map_user_game_stats SET new_id = rowid;

CREATE TABLE _user_game_stats_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type TEXT NOT NULL UNIQUE,
    total_games_played INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_wrong INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    longest_game INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO _user_game_stats_new SELECT m.new_id, ugs.game_type, ugs.total_games_played, ugs.total_score, ugs.best_score, ugs.total_correct, ugs.total_wrong, ugs.best_streak, ugs.longest_game, ugs.last_played_at, ugs.created_at, ugs.updated_at
FROM _user_game_stats ugs JOIN _id_map_user_game_stats m ON ugs.id = m.old_id;

DROP TABLE _user_game_stats;
ALTER TABLE _user_game_stats_new RENAME TO _user_game_stats;
CREATE INDEX idx_user_game_stats_game_type ON _user_game_stats(game_type);

-- ============================================================================
-- LEVEL 1 TABLES (Depend on Level 0)
-- ============================================================================

-- stickers
CREATE TABLE _id_map_stickers (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_stickers (old_id) SELECT id FROM stickers ORDER BY rowid;
UPDATE _id_map_stickers SET new_id = rowid;

CREATE TABLE stickers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    sticker_type_id INTEGER,
    image_source TEXT,
    width INTEGER,
    height INTEGER,
    fragment_of INTEGER,
    fragment_position INTEGER,
    added_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO stickers_new SELECT
    m.new_id,
    (SELECT new_id FROM _id_map_sources WHERE old_id = s.source_id),
    s.name, s.image,
    (SELECT new_id FROM _id_map_sticker_types WHERE old_id = s.sticker_type_id),
    s.image_source, s.width, s.height,
    (SELECT new_id FROM _id_map_stickers WHERE old_id = s.fragment_of),
    s.fragment_position, s.added_at, s.created_at, s.updated_at
FROM stickers s JOIN _id_map_stickers m ON s.id = m.old_id;

DROP TABLE stickers;
ALTER TABLE stickers_new RENAME TO stickers;
CREATE INDEX idx_stickers_source_id ON stickers(source_id);

-- providers
CREATE TABLE _id_map_providers (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_providers (old_id) SELECT id FROM providers ORDER BY rowid;
UPDATE _id_map_providers SET new_id = rowid;

CREATE TABLE providers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    provider_type TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_id_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    UNIQUE(provider_type, external_id_type, external_id)
);

INSERT INTO providers_new SELECT m.new_id, (SELECT new_id FROM _id_map_sources WHERE old_id = p.source_id), p.provider_type, p.external_id, p.external_id_type, p.created_at
FROM providers p JOIN _id_map_providers m ON p.id = m.old_id;

DROP TABLE providers;
ALTER TABLE providers_new RENAME TO providers;

-- questions
CREATE TABLE _id_map_questions (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_questions (old_id) SELECT id FROM questions ORDER BY rowid;
UPDATE _id_map_questions SET new_id = rowid;

CREATE TABLE questions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    answer_a TEXT NOT NULL,
    answer_b TEXT NOT NULL,
    answer_c TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK(correct_answer IN ('a', 'b', 'c')),
    difficulty TEXT,
    wrong_answers TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO questions_new SELECT m.new_id, (SELECT new_id FROM _id_map_sources WHERE old_id = q.source_id), q.question_text, q.answer_a, q.answer_b, q.answer_c, q.correct_answer, q.difficulty, q.wrong_answers, q.created_at, q.updated_at
FROM questions q JOIN _id_map_questions m ON q.id = m.old_id;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

-- collections
CREATE TABLE _id_map_collections (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_collections (old_id) SELECT id FROM collections ORDER BY rowid;
UPDATE _id_map_collections SET new_id = rowid;

CREATE TABLE collections_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_type_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_image TEXT,
    region TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO collections_new SELECT m.new_id, (SELECT new_id FROM _id_map_collection_types WHERE old_id = c.collection_type_id), c.title, c.description, c.cover_image, c.region, c.created_at, c.updated_at
FROM collections c JOIN _id_map_collections m ON c.id = m.old_id;

DROP TABLE collections;
ALTER TABLE collections_new RENAME TO collections;
CREATE INDEX idx_collections_collection_type_id ON collections(collection_type_id);

-- stamps
CREATE TABLE _id_map_stamps (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_stamps (old_id) SELECT id FROM stamps ORDER BY rowid;
UPDATE _id_map_stamps SET new_id = rowid;

CREATE TABLE stamps_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    emojis TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (pack_id) REFERENCES stamp_packs(id) ON DELETE CASCADE
);

INSERT INTO stamps_new SELECT m.new_id, (SELECT new_id FROM _id_map_stamp_packs WHERE old_id = s.pack_id), s.image_path, s.emojis, s.created_at
FROM stamps s JOIN _id_map_stamps m ON s.id = m.old_id;

DROP TABLE stamps;
ALTER TABLE stamps_new RENAME TO stamps;
CREATE INDEX idx_stamps_pack_id ON stamps(pack_id);

-- _user_sources
CREATE TABLE _id_map_user_sources (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_sources (old_id) SELECT id FROM _user_sources ORDER BY rowid;
UPDATE _id_map_user_sources SET new_id = rowid;

CREATE TABLE _user_sources_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL UNIQUE,
    acquired_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO _user_sources_new SELECT m.new_id, (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id), us.acquired_at
FROM _user_sources us JOIN _id_map_user_sources m ON us.id = m.old_id;

DROP TABLE _user_sources;
ALTER TABLE _user_sources_new RENAME TO _user_sources;
CREATE INDEX idx_user_sources_source_id ON _user_sources(source_id);

-- ============================================================================
-- LEVEL 2 TABLES (Depend on Level 1)
-- ============================================================================

-- sticker_tags
CREATE TABLE sticker_tags_new (
    sticker_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (sticker_id, tag_id),
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

INSERT INTO sticker_tags_new SELECT
    (SELECT new_id FROM _id_map_stickers WHERE old_id = st.sticker_id),
    (SELECT new_id FROM _id_map_tags WHERE old_id = st.tag_id),
    st.created_at
FROM sticker_tags st
WHERE (SELECT new_id FROM _id_map_stickers WHERE old_id = st.sticker_id) IS NOT NULL
  AND (SELECT new_id FROM _id_map_tags WHERE old_id = st.tag_id) IS NOT NULL;

DROP TABLE sticker_tags;
ALTER TABLE sticker_tags_new RENAME TO sticker_tags;
CREATE INDEX idx_sticker_tags_tag_id ON sticker_tags(tag_id);

-- collection_stickers
CREATE TABLE collection_stickers_new (
    collection_id INTEGER NOT NULL,
    sticker_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL,
    PRIMARY KEY (collection_id, sticker_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE
);

INSERT INTO collection_stickers_new SELECT
    (SELECT new_id FROM _id_map_collections WHERE old_id = cs.collection_id),
    (SELECT new_id FROM _id_map_stickers WHERE old_id = cs.sticker_id),
    cs.sort_order, cs.added_at
FROM collection_stickers cs
WHERE (SELECT new_id FROM _id_map_collections WHERE old_id = cs.collection_id) IS NOT NULL
  AND (SELECT new_id FROM _id_map_stickers WHERE old_id = cs.sticker_id) IS NOT NULL;

DROP TABLE collection_stickers;
ALTER TABLE collection_stickers_new RENAME TO collection_stickers;
CREATE INDEX idx_collection_stickers_collection_id ON collection_stickers(collection_id);
CREATE INDEX idx_collection_stickers_sticker_id ON collection_stickers(sticker_id);

-- _user_stickers
CREATE TABLE _id_map_user_stickers (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_stickers (old_id) SELECT id FROM _user_stickers ORDER BY rowid;
UPDATE _id_map_user_stickers SET new_id = rowid;

CREATE TABLE _user_stickers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sticker_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    rarity_id INTEGER REFERENCES rarities(id) ON DELETE SET NULL,
    collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    acquired_at TEXT NOT NULL,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO _user_stickers_new SELECT m.new_id,
    (SELECT new_id FROM _id_map_stickers WHERE old_id = us.sticker_id),
    (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id),
    (SELECT new_id FROM _id_map_rarities WHERE old_id = us.rarity_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = us.collection_id),
    us.acquired_at
FROM _user_stickers us JOIN _id_map_user_stickers m ON us.id = m.old_id
WHERE (SELECT new_id FROM _id_map_stickers WHERE old_id = us.sticker_id) IS NOT NULL
  AND (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id) IS NOT NULL;

DROP TABLE _user_stickers;
ALTER TABLE _user_stickers_new RENAME TO _user_stickers;
CREATE INDEX idx_user_stickers_sticker_id ON _user_stickers(sticker_id);
CREATE INDEX idx_user_stickers_source_id ON _user_stickers(source_id);
CREATE INDEX idx_user_stickers_rarity_id ON _user_stickers(rarity_id);
CREATE INDEX idx_user_stickers_collection_id ON _user_stickers(collection_id);

-- _user_collections
CREATE TABLE _id_map_user_collections (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_collections (old_id) SELECT id FROM _user_collections ORDER BY rowid;
UPDATE _id_map_user_collections SET new_id = rowid;

CREATE TABLE _user_collections_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_collections_new SELECT m.new_id, (SELECT new_id FROM _id_map_collections WHERE old_id = uc.collection_id), uc.started_at, uc.completed_at
FROM _user_collections uc JOIN _id_map_user_collections m ON uc.id = m.old_id
WHERE (SELECT new_id FROM _id_map_collections WHERE old_id = uc.collection_id) IS NOT NULL;

DROP TABLE _user_collections;
ALTER TABLE _user_collections_new RENAME TO _user_collections;
CREATE INDEX idx_user_collections_collection_id ON _user_collections(collection_id);

-- _user_booster_packs
CREATE TABLE _id_map_user_booster_packs (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_booster_packs (old_id) SELECT id FROM _user_booster_packs ORDER BY rowid;
UPDATE _id_map_user_booster_packs SET new_id = rowid;

CREATE TABLE _user_booster_packs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    earned_from TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    opened_at TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_booster_packs_new SELECT m.new_id, (SELECT new_id FROM _id_map_collections WHERE old_id = ubp.collection_id), ubp.earned_from, ubp.earned_at, ubp.opened_at
FROM _user_booster_packs ubp JOIN _id_map_user_booster_packs m ON ubp.id = m.old_id
WHERE (SELECT new_id FROM _id_map_collections WHERE old_id = ubp.collection_id) IS NOT NULL;

DROP TABLE _user_booster_packs;
ALTER TABLE _user_booster_packs_new RENAME TO _user_booster_packs;
CREATE INDEX idx_user_booster_packs_collection_id ON _user_booster_packs(collection_id);
CREATE INDEX idx_user_booster_packs_opened_at ON _user_booster_packs(opened_at);

-- _user_collection_rewards
CREATE TABLE _id_map_user_collection_rewards (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_collection_rewards (old_id) SELECT id FROM _user_collection_rewards ORDER BY rowid;
UPDATE _id_map_user_collection_rewards SET new_id = rowid;

CREATE TABLE _user_collection_rewards_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL UNIQUE,
    last_claimed_at TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_collection_rewards_new SELECT m.new_id, (SELECT new_id FROM _id_map_collections WHERE old_id = ucr.collection_id), ucr.last_claimed_at
FROM _user_collection_rewards ucr JOIN _id_map_user_collection_rewards m ON ucr.id = m.old_id
WHERE (SELECT new_id FROM _id_map_collections WHERE old_id = ucr.collection_id) IS NOT NULL;

DROP TABLE _user_collection_rewards;
ALTER TABLE _user_collection_rewards_new RENAME TO _user_collection_rewards;
CREATE INDEX idx_user_collection_rewards_collection_id ON _user_collection_rewards(collection_id);

-- ============================================================================
-- LEVEL 3 TABLES
-- ============================================================================

-- _user_placed_stamps
CREATE TABLE _id_map_user_placed_stamps (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_placed_stamps (old_id) SELECT id FROM _user_placed_stamps ORDER BY rowid;
UPDATE _id_map_user_placed_stamps SET new_id = rowid;

CREATE TABLE _user_placed_stamps_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stamp_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    page_index INTEGER NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    scale REAL NOT NULL DEFAULT 1.0,
    rotation REAL NOT NULL DEFAULT 0,
    placed_at TEXT NOT NULL,
    FOREIGN KEY (stamp_id) REFERENCES stamps(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_placed_stamps_new SELECT m.new_id,
    (SELECT new_id FROM _id_map_stamps WHERE old_id = ups.stamp_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = ups.collection_id),
    ups.page_index, ups.position_x, ups.position_y, ups.scale, ups.rotation, ups.placed_at
FROM _user_placed_stamps ups JOIN _id_map_user_placed_stamps m ON ups.id = m.old_id
WHERE (SELECT new_id FROM _id_map_stamps WHERE old_id = ups.stamp_id) IS NOT NULL
  AND (SELECT new_id FROM _id_map_collections WHERE old_id = ups.collection_id) IS NOT NULL;

DROP TABLE _user_placed_stamps;
ALTER TABLE _user_placed_stamps_new RENAME TO _user_placed_stamps;
CREATE INDEX idx_user_placed_stamps_collection_id ON _user_placed_stamps(collection_id);
CREATE INDEX idx_user_placed_stamps_stamp_id ON _user_placed_stamps(stamp_id);
CREATE INDEX idx_user_placed_stamps_collection_page ON _user_placed_stamps(collection_id, page_index);

-- _user_sticker_placements
CREATE TABLE _id_map_user_sticker_placements (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_sticker_placements (old_id) SELECT id FROM _user_sticker_placements ORDER BY rowid;
UPDATE _id_map_user_sticker_placements SET new_id = rowid;

CREATE TABLE _user_sticker_placements_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sticker_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    placed_at TEXT NOT NULL,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(sticker_id, collection_id)
);

INSERT INTO _user_sticker_placements_new SELECT m.new_id,
    (SELECT new_id FROM _id_map_stickers WHERE old_id = usp.sticker_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = usp.collection_id),
    usp.placed_at
FROM _user_sticker_placements usp JOIN _id_map_user_sticker_placements m ON usp.id = m.old_id
WHERE (SELECT new_id FROM _id_map_stickers WHERE old_id = usp.sticker_id) IS NOT NULL
  AND (SELECT new_id FROM _id_map_collections WHERE old_id = usp.collection_id) IS NOT NULL;

DROP TABLE _user_sticker_placements;
ALTER TABLE _user_sticker_placements_new RENAME TO _user_sticker_placements;
CREATE INDEX idx_user_sticker_placements_sticker_id ON _user_sticker_placements(sticker_id);
CREATE INDEX idx_user_sticker_placements_collection_id ON _user_sticker_placements(collection_id);

-- _user_placed_icons
CREATE TABLE _id_map_user_placed_icons (old_id TEXT PRIMARY KEY, new_id INTEGER);
INSERT INTO _id_map_user_placed_icons (old_id) SELECT id FROM _user_placed_icons ORDER BY rowid;
UPDATE _id_map_user_placed_icons SET new_id = rowid;

CREATE TABLE _user_placed_icons_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon_path TEXT NOT NULL,
    collection_id INTEGER NOT NULL,
    page_index INTEGER NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    scale REAL NOT NULL DEFAULT 1.0,
    rotation REAL NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#000000',
    placed_at TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_placed_icons_new SELECT m.new_id, upi.icon_path,
    (SELECT new_id FROM _id_map_collections WHERE old_id = upi.collection_id),
    upi.page_index, upi.position_x, upi.position_y, upi.scale, upi.rotation, upi.color, upi.placed_at
FROM _user_placed_icons upi JOIN _id_map_user_placed_icons m ON upi.id = m.old_id
WHERE (SELECT new_id FROM _id_map_collections WHERE old_id = upi.collection_id) IS NOT NULL;

DROP TABLE _user_placed_icons;
ALTER TABLE _user_placed_icons_new RENAME TO _user_placed_icons;
CREATE INDEX idx_user_placed_icons_collection_id ON _user_placed_icons(collection_id);
CREATE INDEX idx_user_placed_icons_collection_page ON _user_placed_icons(collection_id, page_index);

-- ============================================================================
-- CLEANUP
-- ============================================================================

DROP TABLE IF EXISTS _id_map_sources;
DROP TABLE IF EXISTS _id_map_tags;
DROP TABLE IF EXISTS _id_map_rarities;
DROP TABLE IF EXISTS _id_map_sticker_types;
DROP TABLE IF EXISTS _id_map_collection_types;
DROP TABLE IF EXISTS _id_map_llm_configs;
DROP TABLE IF EXISTS _id_map_stamp_packs;
DROP TABLE IF EXISTS _id_map_pokemon_trivia_templates;
DROP TABLE IF EXISTS _id_map_pokemon_trivia_templates_v2;
DROP TABLE IF EXISTS _id_map_stickers;
DROP TABLE IF EXISTS _id_map_providers;
DROP TABLE IF EXISTS _id_map_questions;
DROP TABLE IF EXISTS _id_map_collections;
DROP TABLE IF EXISTS _id_map_stamps;
DROP TABLE IF EXISTS _id_map_user_sources;
DROP TABLE IF EXISTS _id_map_user_game_stats;
DROP TABLE IF EXISTS _id_map_user_stickers;
DROP TABLE IF EXISTS _id_map_user_collections;
DROP TABLE IF EXISTS _id_map_user_booster_packs;
DROP TABLE IF EXISTS _id_map_user_collection_rewards;
DROP TABLE IF EXISTS _id_map_user_placed_stamps;
DROP TABLE IF EXISTS _id_map_user_sticker_placements;
DROP TABLE IF EXISTS _id_map_user_placed_icons;

COMMIT;

PRAGMA foreign_keys = ON;
PRAGMA integrity_check;
SELECT 'Migration complete!' AS status;
