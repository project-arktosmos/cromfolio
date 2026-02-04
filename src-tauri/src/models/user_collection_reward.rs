use serde::{Deserialize, Serialize};

/// User collection reward tracking - tracks when rewards were last claimed per collection
/// Stored in the _user_collection_rewards table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserCollectionReward {
    #[serde(default)]
    pub id: String,

    /// The collection this reward tracking is for
    #[serde(default)]
    pub collection_id: String,

    /// Timestamp when the reward was last claimed for this collection
    #[serde(default)]
    pub last_claimed_at: String,
}

/// Summary of an eligible reward collection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EligibleRewardCollection {
    /// The collection ID
    pub collection_id: String,

    /// The collection title
    pub collection_title: String,

    /// The collection cover image
    pub collection_cover_image: Option<String>,

    /// Number of unique stickers owned in this collection
    pub stickers_owned: i64,

    /// Total stickers in the collection
    pub total_stickers: i64,

    /// When rewards were last claimed (empty if never)
    pub last_claimed_at: Option<String>,

    /// Minutes since last claim (None if never claimed)
    pub minutes_since_claim: Option<i64>,

    /// Whether the user can claim a reward now (10+ min passed or never claimed)
    pub can_claim: bool,

    /// Number of rewards that can be claimed (accumulated over time)
    pub claimable_count: i64,

    /// Minutes until next reward becomes available (0-9)
    pub minutes_until_next: i64,
}
