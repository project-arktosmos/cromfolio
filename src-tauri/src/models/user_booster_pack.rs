use serde::{Deserialize, Serialize};

/// User-owned booster pack entity - tracks booster packs earned from games
/// Stored in the _user_booster_packs table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserBoosterPack {
    #[serde(default)]
    pub id: String,

    /// The collection this booster pack is for
    #[serde(default)]
    pub collection_id: String,

    /// Source of the booster pack (e.g., "pokemon-trivia", "daily-reward")
    #[serde(default)]
    pub earned_from: String,

    /// Timestamp when the booster pack was earned
    #[serde(default)]
    pub earned_at: String,

    /// Timestamp when the booster pack was opened (None if unopened)
    #[serde(default)]
    pub opened_at: Option<String>,
}
