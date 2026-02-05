use rusqlite::{params, Connection};
use crate::models::{UserCollectionReward, EligibleRewardCollection};

/// Reward cooldown in minutes
const REWARD_COOLDOWN_MINUTES: i64 = 10;

/// Get all user collection rewards
pub fn get_all(conn: &Connection) -> Result<Vec<UserCollectionReward>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, last_claimed_at
             FROM _user_collection_rewards
             ORDER BY last_claimed_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_collection_reward(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a user collection reward by collection ID
pub fn get_by_collection_id(conn: &Connection, collection_id: i64) -> Result<Option<UserCollectionReward>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, last_claimed_at
             FROM _user_collection_rewards
             WHERE collection_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_collection_reward(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Get all collections where user has at least 1 sticker, with reward eligibility info
pub fn get_eligible_collections(conn: &Connection) -> Result<Vec<EligibleRewardCollection>, String> {
    let now = chrono::Utc::now();

    // Query finds collections where user owns at least 1 sticker that was earned FROM that collection
    // Uses us.collection_id to match how /game/collections page filters stickers
    // Also joins collection_stickers to count total stickers in collection
    // And left joins _user_collection_rewards to get last claimed time
    let mut stmt = conn
        .prepare(
            "SELECT
                c.id as collection_id,
                c.title as collection_title,
                c.cover_image as collection_cover_image,
                COUNT(DISTINCT us.sticker_id) as stickers_owned,
                (SELECT COUNT(*) FROM collection_stickers cs WHERE cs.collection_id = c.id) as total_stickers,
                ucr.last_claimed_at
             FROM collections c
             INNER JOIN _user_stickers us ON us.collection_id = c.id
             LEFT JOIN _user_collection_rewards ucr ON ucr.collection_id = c.id
             GROUP BY c.id
             HAVING COUNT(DISTINCT us.sticker_id) > 0
             ORDER BY c.title",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let collection_id: i64 = row.get(0)?;
            let collection_title: String = row.get(1)?;
            let collection_cover_image: Option<String> = row.get(2)?;
            let stickers_owned: i64 = row.get(3)?;
            let total_stickers: i64 = row.get(4)?;
            let last_claimed_at: Option<String> = row.get(5)?;

            Ok((collection_id, collection_title, collection_cover_image, stickers_owned, total_stickers, last_claimed_at))
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let (collection_id, collection_title, collection_cover_image, stickers_owned, total_stickers, last_claimed_at) = row.map_err(|e| e.to_string())?;

        // Calculate minutes since last claim and accumulated rewards
        let (minutes_since_claim, can_claim, claimable_count, minutes_until_next) = if let Some(ref claimed_at) = last_claimed_at {
            match chrono::DateTime::parse_from_rfc3339(claimed_at) {
                Ok(claimed_time) => {
                    let duration = now.signed_duration_since(claimed_time);
                    let minutes = duration.num_minutes();
                    let count = minutes / REWARD_COOLDOWN_MINUTES;
                    let remaining = REWARD_COOLDOWN_MINUTES - (minutes % REWARD_COOLDOWN_MINUTES);
                    (Some(minutes), count > 0, count, remaining)
                }
                Err(_) => (None, true, 1, 0) // If we can't parse the date, allow 1 claim
            }
        } else {
            (None, true, 1, 0) // Never claimed, can claim 1
        };

        results.push(EligibleRewardCollection {
            collection_id,
            collection_title,
            collection_cover_image,
            stickers_owned,
            total_stickers,
            last_claimed_at,
            minutes_since_claim,
            can_claim,
            claimable_count,
            minutes_until_next,
        });
    }

    Ok(results)
}

/// Claim a reward for a collection - updates or creates the reward tracking record
/// Returns the updated/created UserCollectionReward
pub fn claim_reward(conn: &Connection, collection_id: i64) -> Result<UserCollectionReward, String> {
    let now = chrono_now();

    // Check if record exists
    let existing = get_by_collection_id(conn, collection_id)?;

    if let Some(existing_reward) = existing {
        // Update existing record
        conn.execute(
            "UPDATE _user_collection_rewards SET last_claimed_at = ?1 WHERE collection_id = ?2",
            params![now, collection_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(UserCollectionReward {
            id: existing_reward.id,
            collection_id,
            last_claimed_at: now,
        })
    } else {
        // Create new record
        conn.execute(
            "INSERT INTO _user_collection_rewards (collection_id, last_claimed_at)
             VALUES (?1, ?2)",
            params![collection_id, now],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();

        Ok(UserCollectionReward {
            id,
            collection_id,
            last_claimed_at: now,
        })
    }
}

/// Delete a user collection reward by collection ID
pub fn delete_by_collection_id(conn: &Connection, collection_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_collection_rewards WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all user collection rewards
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_collection_rewards", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_collection_reward(row: &rusqlite::Row) -> UserCollectionReward {
    UserCollectionReward {
        id: row.get(0).unwrap_or_default(),
        collection_id: row.get(1).unwrap_or_default(),
        last_claimed_at: row.get(2).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
