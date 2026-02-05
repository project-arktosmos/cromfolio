-- Migration: Convert TEXT UUIDs to INTEGER IDs
-- This script migrates all tables from TEXT PRIMARY KEY to INTEGER PRIMARY KEY AUTOINCREMENT
-- It preserves all existing data by creating ID mapping tables
--
-- Run with: sqlite3 app.db < src-tauri/migrations/migrate_to_integer_ids.sql
--
-- IMPORTANT: Backup your database first!
-- cp app.db app.db.backup

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ============================================================================
-- PHASE 1: DROP REDUNDANT INDEX
-- ============================================================================
-- idx_sticker_tags_sticker_id is redundant (composite PK covers sticker_id lookups)
DROP INDEX IF EXISTS idx_sticker_tags_sticker_id;

-- ============================================================================
-- PHASE 2: LEVEL 0 TABLES (No FK dependencies)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_sources (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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
    musicbrainz_artist_id TEXT,
    musicbrainz_release_id TEXT,
    artist_name TEXT,
    music_type TEXT,
    music_genres TEXT,
    release_year INTEGER,
    record_label TEXT,
    open_library_author_id TEXT,
    open_library_work_id TEXT,
    author_name TEXT,
    book_type TEXT,
    book_subjects TEXT,
    first_publish_year INTEGER,
    publisher TEXT,
    added_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO sources_new (
    source_type, title, description, cover_image, wikia_url,
    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id, anilist_id, mal_id,
    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
    sport, league, country, wikidata_id, scientific_name, conservation_status,
    taxonomic_class, musicbrainz_artist_id, musicbrainz_release_id, artist_name,
    music_type, music_genres, release_year, record_label, open_library_author_id,
    open_library_work_id, author_name, book_type, book_subjects, first_publish_year,
    publisher, added_at, created_at, updated_at
)
SELECT
    source_type, title, description, cover_image, wikia_url,
    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id, anilist_id, mal_id,
    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
    sport, league, country, wikidata_id, scientific_name, conservation_status,
    taxonomic_class, musicbrainz_artist_id, musicbrainz_release_id, artist_name,
    music_type, music_genres, release_year, record_label, open_library_author_id,
    open_library_work_id, author_name, book_type, book_subjects, first_publish_year,
    publisher, added_at, created_at, updated_at
FROM sources;

INSERT INTO _id_map_sources (old_id, new_id)
SELECT s.id, sn.id FROM sources s
JOIN sources_new sn ON s.created_at = sn.created_at AND s.title = sn.title;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_tags (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE tags_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(key, value)
);

INSERT INTO tags_new (key, value, created_at, updated_at)
SELECT key, value, created_at, updated_at FROM tags;

INSERT INTO _id_map_tags (old_id, new_id)
SELECT t.id, tn.id FROM tags t
JOIN tags_new tn ON t.key = tn.key AND t.value = tn.value;

DROP TABLE tags;
ALTER TABLE tags_new RENAME TO tags;

CREATE INDEX idx_tags_key ON tags(key);

-- ---------------------------------------------------------------------------
-- rarities
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_rarities (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE rarities_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color_from TEXT NOT NULL DEFAULT '#808080',
    color_to TEXT NOT NULL DEFAULT '#A0A0A0',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO rarities_new (name, color_from, color_to, sort_order, created_at, updated_at)
SELECT name, color_from, color_to, sort_order, created_at, updated_at FROM rarities;

INSERT INTO _id_map_rarities (old_id, new_id)
SELECT r.id, rn.id FROM rarities r
JOIN rarities_new rn ON r.name = rn.name;

DROP TABLE rarities;
ALTER TABLE rarities_new RENAME TO rarities;

-- ---------------------------------------------------------------------------
-- sticker_types
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_sticker_types (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO sticker_types_new (name, description, category, source_type, badge_color, sort_order, created_at, updated_at)
SELECT name, description, category, source_type, badge_color, sort_order, created_at, updated_at FROM sticker_types;

INSERT INTO _id_map_sticker_types (old_id, new_id)
SELECT st.id, stn.id FROM sticker_types st
JOIN sticker_types_new stn ON st.name = stn.name;

DROP TABLE sticker_types;
ALTER TABLE sticker_types_new RENAME TO sticker_types;

-- ---------------------------------------------------------------------------
-- collection_types
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_collection_types (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE collection_types_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO collection_types_new (name, description, icon, sort_order, created_at, updated_at)
SELECT name, description, icon, sort_order, created_at, updated_at FROM collection_types;

INSERT INTO _id_map_collection_types (old_id, new_id)
SELECT ct.id, ctn.id FROM collection_types ct
JOIN collection_types_new ctn ON ct.name = ctn.name;

DROP TABLE collection_types;
ALTER TABLE collection_types_new RENAME TO collection_types;

CREATE INDEX idx_collection_types_sort_order ON collection_types(sort_order);

-- ---------------------------------------------------------------------------
-- llm_configs
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_llm_configs (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE llm_configs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('lmstudio', 'ollama')),
    base_url TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO llm_configs_new (name, provider, base_url, is_default, created_at, updated_at)
SELECT name, provider, base_url, is_default, created_at, updated_at FROM llm_configs;

INSERT INTO _id_map_llm_configs (old_id, new_id)
SELECT lc.id, lcn.id FROM llm_configs lc
JOIN llm_configs_new lcn ON lc.name = lcn.name AND lc.created_at = lcn.created_at;

DROP TABLE llm_configs;
ALTER TABLE llm_configs_new RENAME TO llm_configs;

-- ---------------------------------------------------------------------------
-- stamp_packs
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_stamp_packs (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO stamp_packs_new (source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at)
SELECT source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at FROM stamp_packs;

INSERT INTO _id_map_stamp_packs (old_id, new_id)
SELECT sp.id, spn.id FROM stamp_packs sp
JOIN stamp_packs_new spn ON sp.name = spn.name AND sp.created_at = spn.created_at;

DROP TABLE stamp_packs;
ALTER TABLE stamp_packs_new RENAME TO stamp_packs;

CREATE INDEX idx_stamp_packs_source ON stamp_packs(source);

-- ---------------------------------------------------------------------------
-- _user_player (singleton - special case)
-- ---------------------------------------------------------------------------
CREATE TABLE _user_player_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'Adventurer',
    experience INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_played_at TEXT NOT NULL
);

INSERT INTO _user_player_new (name, experience, created_at, last_played_at)
SELECT name, experience, created_at, last_played_at FROM _user_player;

DROP TABLE _user_player;
ALTER TABLE _user_player_new RENAME TO _user_player;

-- ---------------------------------------------------------------------------
-- pokemon_trivia_templates
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_pokemon_trivia_templates (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE pokemon_trivia_templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_key TEXT NOT NULL,
    question_template TEXT NOT NULL,
    answer_template TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO pokemon_trivia_templates_new (tag_key, question_template, answer_template, is_active, created_at, updated_at)
SELECT tag_key, question_template, answer_template, is_active, created_at, updated_at FROM pokemon_trivia_templates;

INSERT INTO _id_map_pokemon_trivia_templates (old_id, new_id)
SELECT ptt.id, pttn.id FROM pokemon_trivia_templates ptt
JOIN pokemon_trivia_templates_new pttn ON ptt.tag_key = pttn.tag_key AND ptt.created_at = pttn.created_at;

DROP TABLE pokemon_trivia_templates;
ALTER TABLE pokemon_trivia_templates_new RENAME TO pokemon_trivia_templates;

CREATE INDEX idx_pokemon_trivia_templates_tag_key ON pokemon_trivia_templates(tag_key);

-- ---------------------------------------------------------------------------
-- pokemon_trivia_templates_v2
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_pokemon_trivia_templates_v2 (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO pokemon_trivia_templates_v2_new (
    name, description, template_type, question_template, answer_template,
    primary_attribute, conditions, condition_logic, scope_filters,
    comparison_config, difficulty, weight, is_active, created_at, updated_at
)
SELECT
    name, description, template_type, question_template, answer_template,
    primary_attribute, conditions, condition_logic, scope_filters,
    comparison_config, difficulty, weight, is_active, created_at, updated_at
FROM pokemon_trivia_templates_v2;

INSERT INTO _id_map_pokemon_trivia_templates_v2 (old_id, new_id)
SELECT pttv2.id, pttv2n.id FROM pokemon_trivia_templates_v2 pttv2
JOIN pokemon_trivia_templates_v2_new pttv2n ON pttv2.name = pttv2n.name AND pttv2.created_at = pttv2n.created_at;

DROP TABLE pokemon_trivia_templates_v2;
ALTER TABLE pokemon_trivia_templates_v2_new RENAME TO pokemon_trivia_templates_v2;

CREATE INDEX idx_ptt_v2_template_type ON pokemon_trivia_templates_v2(template_type);
CREATE INDEX idx_ptt_v2_primary_attribute ON pokemon_trivia_templates_v2(primary_attribute);
CREATE INDEX idx_ptt_v2_is_active ON pokemon_trivia_templates_v2(is_active);
CREATE INDEX idx_ptt_v2_difficulty ON pokemon_trivia_templates_v2(difficulty);

-- ============================================================================
-- PHASE 3: LEVEL 1 TABLES (Depend on Level 0)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- stickers (depends on sources)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_stickers (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO stickers_new (
    source_id, name, image, sticker_type_id, image_source,
    width, height, fragment_of, fragment_position, added_at, created_at, updated_at
)
SELECT
    (SELECT new_id FROM _id_map_sources WHERE old_id = s.source_id),
    s.name, s.image,
    (SELECT new_id FROM _id_map_sticker_types WHERE old_id = s.sticker_type_id),
    s.image_source, s.width, s.height,
    NULL, -- fragment_of will be updated later
    s.fragment_position, s.added_at, s.created_at, s.updated_at
FROM stickers s;

INSERT INTO _id_map_stickers (old_id, new_id)
SELECT s.id, sn.id FROM stickers s
JOIN stickers_new sn ON s.name = sn.name AND s.created_at = sn.created_at
    AND (SELECT new_id FROM _id_map_sources WHERE old_id = s.source_id) = sn.source_id;

-- Now update fragment_of references
UPDATE stickers_new SET fragment_of = (
    SELECT new_id FROM _id_map_stickers WHERE old_id = (
        SELECT fragment_of FROM stickers WHERE stickers.name = stickers_new.name
        AND stickers.created_at = stickers_new.created_at
    )
) WHERE EXISTS (
    SELECT 1 FROM stickers WHERE stickers.name = stickers_new.name
    AND stickers.created_at = stickers_new.created_at AND stickers.fragment_of IS NOT NULL
);

DROP TABLE stickers;
ALTER TABLE stickers_new RENAME TO stickers;

CREATE INDEX idx_stickers_source_id ON stickers(source_id);

-- ---------------------------------------------------------------------------
-- providers (depends on sources)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_providers (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO providers_new (source_id, provider_type, external_id, external_id_type, created_at)
SELECT
    (SELECT new_id FROM _id_map_sources WHERE old_id = p.source_id),
    p.provider_type, p.external_id, p.external_id_type, p.created_at
FROM providers p;

INSERT INTO _id_map_providers (old_id, new_id)
SELECT p.id, pn.id FROM providers p
JOIN providers_new pn ON p.provider_type = pn.provider_type
    AND p.external_id = pn.external_id AND p.external_id_type = pn.external_id_type;

DROP TABLE providers;
ALTER TABLE providers_new RENAME TO providers;

-- ---------------------------------------------------------------------------
-- questions (depends on sources)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_questions (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE questions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    wrong_answers TEXT NOT NULL DEFAULT '[]',
    difficulty TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO questions_new (source_id, question_text, correct_answer, wrong_answers, difficulty, created_at, updated_at)
SELECT
    (SELECT new_id FROM _id_map_sources WHERE old_id = q.source_id),
    q.question_text, q.correct_answer, q.wrong_answers, q.difficulty, q.created_at, q.updated_at
FROM questions q;

INSERT INTO _id_map_questions (old_id, new_id)
SELECT q.id, qn.id FROM questions q
JOIN questions_new qn ON q.question_text = qn.question_text AND q.created_at = qn.created_at;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

-- ---------------------------------------------------------------------------
-- collections (depends on collection_types)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_collections (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE collections_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_type_id INTEGER REFERENCES collection_types(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_image TEXT,
    region TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO collections_new (collection_type_id, title, description, cover_image, region, created_at, updated_at)
SELECT
    (SELECT new_id FROM _id_map_collection_types WHERE old_id = c.collection_type_id),
    c.title, c.description, c.cover_image, c.region, c.created_at, c.updated_at
FROM collections c;

INSERT INTO _id_map_collections (old_id, new_id)
SELECT c.id, cn.id FROM collections c
JOIN collections_new cn ON c.title = cn.title AND c.created_at = cn.created_at;

DROP TABLE collections;
ALTER TABLE collections_new RENAME TO collections;

CREATE INDEX idx_collections_collection_type_id ON collections(collection_type_id);

-- ---------------------------------------------------------------------------
-- stamps (depends on stamp_packs)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_stamps (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE stamps_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    emojis TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (pack_id) REFERENCES stamp_packs(id) ON DELETE CASCADE
);

INSERT INTO stamps_new (pack_id, image_path, emojis, created_at)
SELECT
    (SELECT new_id FROM _id_map_stamp_packs WHERE old_id = s.pack_id),
    s.image_path, s.emojis, s.created_at
FROM stamps s;

INSERT INTO _id_map_stamps (old_id, new_id)
SELECT s.id, sn.id FROM stamps s
JOIN stamps_new sn ON s.image_path = sn.image_path AND s.created_at = sn.created_at;

DROP TABLE stamps;
ALTER TABLE stamps_new RENAME TO stamps;

CREATE INDEX idx_stamps_pack_id ON stamps(pack_id);

-- ---------------------------------------------------------------------------
-- _user_sources (depends on sources)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_sources (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE _user_sources_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL UNIQUE,
    acquired_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

INSERT INTO _user_sources_new (source_id, acquired_at)
SELECT
    (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id),
    us.acquired_at
FROM _user_sources us;

INSERT INTO _id_map_user_sources (old_id, new_id)
SELECT us.id, usn.id FROM _user_sources us
JOIN _user_sources_new usn ON
    (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id) = usn.source_id;

DROP TABLE _user_sources;
ALTER TABLE _user_sources_new RENAME TO _user_sources;

CREATE INDEX idx_user_sources_source_id ON _user_sources(source_id);

-- ---------------------------------------------------------------------------
-- _user_game_stats
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_game_stats (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO _user_game_stats_new (
    game_type, total_games_played, total_score, best_score,
    total_correct, total_wrong, best_streak, longest_game,
    last_played_at, created_at, updated_at
)
SELECT
    game_type, total_games_played, total_score, best_score,
    total_correct, total_wrong, best_streak, longest_game,
    last_played_at, created_at, updated_at
FROM _user_game_stats;

INSERT INTO _id_map_user_game_stats (old_id, new_id)
SELECT ugs.id, ugsn.id FROM _user_game_stats ugs
JOIN _user_game_stats_new ugsn ON ugs.game_type = ugsn.game_type;

DROP TABLE _user_game_stats;
ALTER TABLE _user_game_stats_new RENAME TO _user_game_stats;

CREATE INDEX idx_user_game_stats_game_type ON _user_game_stats(game_type);

-- ============================================================================
-- PHASE 4: LEVEL 2 TABLES (Depend on Level 1)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sticker_tags (depends on stickers, tags)
-- ---------------------------------------------------------------------------
CREATE TABLE sticker_tags_new (
    sticker_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (sticker_id, tag_id),
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

INSERT INTO sticker_tags_new (sticker_id, tag_id, created_at)
SELECT
    (SELECT new_id FROM _id_map_stickers WHERE old_id = st.sticker_id),
    (SELECT new_id FROM _id_map_tags WHERE old_id = st.tag_id),
    st.created_at
FROM sticker_tags st;

DROP TABLE sticker_tags;
ALTER TABLE sticker_tags_new RENAME TO sticker_tags;

-- Only keep the tag_id index (sticker_id lookups are covered by composite PK)
CREATE INDEX idx_sticker_tags_tag_id ON sticker_tags(tag_id);

-- ---------------------------------------------------------------------------
-- collection_stickers (depends on collections, stickers)
-- ---------------------------------------------------------------------------
CREATE TABLE collection_stickers_new (
    collection_id INTEGER NOT NULL,
    sticker_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL,
    PRIMARY KEY (collection_id, sticker_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE
);

INSERT INTO collection_stickers_new (collection_id, sticker_id, sort_order, added_at)
SELECT
    (SELECT new_id FROM _id_map_collections WHERE old_id = cs.collection_id),
    (SELECT new_id FROM _id_map_stickers WHERE old_id = cs.sticker_id),
    cs.sort_order, cs.added_at
FROM collection_stickers cs;

DROP TABLE collection_stickers;
ALTER TABLE collection_stickers_new RENAME TO collection_stickers;

CREATE INDEX idx_collection_stickers_collection_id ON collection_stickers(collection_id);
CREATE INDEX idx_collection_stickers_sticker_id ON collection_stickers(sticker_id);

-- ---------------------------------------------------------------------------
-- _user_stickers (depends on stickers, sources, collections, rarities)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_stickers (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO _user_stickers_new (sticker_id, source_id, rarity_id, collection_id, acquired_at)
SELECT
    (SELECT new_id FROM _id_map_stickers WHERE old_id = us.sticker_id),
    (SELECT new_id FROM _id_map_sources WHERE old_id = us.source_id),
    (SELECT new_id FROM _id_map_rarities WHERE old_id = us.rarity_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = us.collection_id),
    us.acquired_at
FROM _user_stickers us;

INSERT INTO _id_map_user_stickers (old_id, new_id)
SELECT us.id, usn.id FROM _user_stickers us
JOIN _user_stickers_new usn ON us.acquired_at = usn.acquired_at
    AND (SELECT new_id FROM _id_map_stickers WHERE old_id = us.sticker_id) = usn.sticker_id;

DROP TABLE _user_stickers;
ALTER TABLE _user_stickers_new RENAME TO _user_stickers;

CREATE INDEX idx_user_stickers_sticker_id ON _user_stickers(sticker_id);
CREATE INDEX idx_user_stickers_source_id ON _user_stickers(source_id);
CREATE INDEX idx_user_stickers_rarity_id ON _user_stickers(rarity_id);
CREATE INDEX idx_user_stickers_collection_id ON _user_stickers(collection_id);

-- ---------------------------------------------------------------------------
-- _user_collections (depends on collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_collections (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE _user_collections_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_collections_new (collection_id, started_at, completed_at)
SELECT
    (SELECT new_id FROM _id_map_collections WHERE old_id = uc.collection_id),
    uc.started_at, uc.completed_at
FROM _user_collections uc;

INSERT INTO _id_map_user_collections (old_id, new_id)
SELECT uc.id, ucn.id FROM _user_collections uc
JOIN _user_collections_new ucn ON
    (SELECT new_id FROM _id_map_collections WHERE old_id = uc.collection_id) = ucn.collection_id
    AND uc.started_at = ucn.started_at;

DROP TABLE _user_collections;
ALTER TABLE _user_collections_new RENAME TO _user_collections;

CREATE INDEX idx_user_collections_collection_id ON _user_collections(collection_id);

-- ---------------------------------------------------------------------------
-- _user_booster_packs (depends on collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_booster_packs (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE _user_booster_packs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    earned_from TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    opened_at TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_booster_packs_new (collection_id, earned_from, earned_at, opened_at)
SELECT
    (SELECT new_id FROM _id_map_collections WHERE old_id = ubp.collection_id),
    ubp.earned_from, ubp.earned_at, ubp.opened_at
FROM _user_booster_packs ubp;

INSERT INTO _id_map_user_booster_packs (old_id, new_id)
SELECT ubp.id, ubpn.id FROM _user_booster_packs ubp
JOIN _user_booster_packs_new ubpn ON
    (SELECT new_id FROM _id_map_collections WHERE old_id = ubp.collection_id) = ubpn.collection_id
    AND ubp.earned_at = ubpn.earned_at;

DROP TABLE _user_booster_packs;
ALTER TABLE _user_booster_packs_new RENAME TO _user_booster_packs;

CREATE INDEX idx_user_booster_packs_collection_id ON _user_booster_packs(collection_id);
CREATE INDEX idx_user_booster_packs_opened_at ON _user_booster_packs(opened_at);

-- ---------------------------------------------------------------------------
-- _user_collection_rewards (depends on collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_collection_rewards (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE _user_collection_rewards_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL UNIQUE,
    last_claimed_at TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

INSERT INTO _user_collection_rewards_new (collection_id, last_claimed_at)
SELECT
    (SELECT new_id FROM _id_map_collections WHERE old_id = ucr.collection_id),
    ucr.last_claimed_at
FROM _user_collection_rewards ucr;

INSERT INTO _id_map_user_collection_rewards (old_id, new_id)
SELECT ucr.id, ucrn.id FROM _user_collection_rewards ucr
JOIN _user_collection_rewards_new ucrn ON
    (SELECT new_id FROM _id_map_collections WHERE old_id = ucr.collection_id) = ucrn.collection_id;

DROP TABLE _user_collection_rewards;
ALTER TABLE _user_collection_rewards_new RENAME TO _user_collection_rewards;

CREATE INDEX idx_user_collection_rewards_collection_id ON _user_collection_rewards(collection_id);

-- ============================================================================
-- PHASE 5: LEVEL 3 TABLES (Depend on Level 2)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- _user_placed_stamps (depends on stamps, collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_placed_stamps (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO _user_placed_stamps_new (
    stamp_id, collection_id, page_index, position_x, position_y, scale, rotation, placed_at
)
SELECT
    (SELECT new_id FROM _id_map_stamps WHERE old_id = ups.stamp_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = ups.collection_id),
    ups.page_index, ups.position_x, ups.position_y, ups.scale, ups.rotation, ups.placed_at
FROM _user_placed_stamps ups;

INSERT INTO _id_map_user_placed_stamps (old_id, new_id)
SELECT ups.id, upsn.id FROM _user_placed_stamps ups
JOIN _user_placed_stamps_new upsn ON ups.placed_at = upsn.placed_at
    AND (SELECT new_id FROM _id_map_stamps WHERE old_id = ups.stamp_id) = upsn.stamp_id;

DROP TABLE _user_placed_stamps;
ALTER TABLE _user_placed_stamps_new RENAME TO _user_placed_stamps;

CREATE INDEX idx_user_placed_stamps_collection_id ON _user_placed_stamps(collection_id);
CREATE INDEX idx_user_placed_stamps_stamp_id ON _user_placed_stamps(stamp_id);
CREATE INDEX idx_user_placed_stamps_collection_page ON _user_placed_stamps(collection_id, page_index);

-- ---------------------------------------------------------------------------
-- _user_sticker_placements (depends on stickers, collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_sticker_placements (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

CREATE TABLE _user_sticker_placements_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sticker_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    placed_at TEXT NOT NULL,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(sticker_id, collection_id)
);

INSERT INTO _user_sticker_placements_new (sticker_id, collection_id, placed_at)
SELECT
    (SELECT new_id FROM _id_map_stickers WHERE old_id = usp.sticker_id),
    (SELECT new_id FROM _id_map_collections WHERE old_id = usp.collection_id),
    usp.placed_at
FROM _user_sticker_placements usp;

INSERT INTO _id_map_user_sticker_placements (old_id, new_id)
SELECT usp.id, uspn.id FROM _user_sticker_placements usp
JOIN _user_sticker_placements_new uspn ON usp.placed_at = uspn.placed_at
    AND (SELECT new_id FROM _id_map_stickers WHERE old_id = usp.sticker_id) = uspn.sticker_id;

DROP TABLE _user_sticker_placements;
ALTER TABLE _user_sticker_placements_new RENAME TO _user_sticker_placements;

CREATE INDEX idx_user_sticker_placements_sticker_id ON _user_sticker_placements(sticker_id);
CREATE INDEX idx_user_sticker_placements_collection_id ON _user_sticker_placements(collection_id);

-- ---------------------------------------------------------------------------
-- _user_placed_icons (depends on collections)
-- ---------------------------------------------------------------------------
CREATE TABLE _id_map_user_placed_icons (old_id TEXT PRIMARY KEY, new_id INTEGER NOT NULL);

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

INSERT INTO _user_placed_icons_new (
    icon_path, collection_id, page_index, position_x, position_y, scale, rotation, color, placed_at
)
SELECT
    upi.icon_path,
    (SELECT new_id FROM _id_map_collections WHERE old_id = upi.collection_id),
    upi.page_index, upi.position_x, upi.position_y, upi.scale, upi.rotation, upi.color, upi.placed_at
FROM _user_placed_icons upi;

INSERT INTO _id_map_user_placed_icons (old_id, new_id)
SELECT upi.id, upin.id FROM _user_placed_icons upi
JOIN _user_placed_icons_new upin ON upi.placed_at = upin.placed_at
    AND upi.icon_path = upin.icon_path;

DROP TABLE _user_placed_icons;
ALTER TABLE _user_placed_icons_new RENAME TO _user_placed_icons;

CREATE INDEX idx_user_placed_icons_collection_id ON _user_placed_icons(collection_id);
CREATE INDEX idx_user_placed_icons_collection_page ON _user_placed_icons(collection_id, page_index);

-- ============================================================================
-- PHASE 6: CLEANUP
-- ============================================================================

-- Drop all mapping tables (no longer needed)
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

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;

-- Verify foreign keys are intact
PRAGMA foreign_key_check;

-- Reclaim space
VACUUM;

-- Show final database size
SELECT 'Migration complete! Run: ls -lh app.db to check size' AS status;
