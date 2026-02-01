use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{SportsTeamSearchResult, SportsLeagueSearchResult, ImageItem};

const SPORTSDB_BASE_URL: &str = "https://www.thesportsdb.com/api/v1/json";

// Free tier API key
const SPORTSDB_FREE_KEY: &str = "3";

#[derive(Debug, Deserialize)]
struct TeamsResponse {
    teams: Option<Vec<SportsDbTeam>>,
}

#[derive(Debug, Deserialize)]
struct LeaguesResponse {
    countries: Option<Vec<SportsDbLeague>>,
}

#[derive(Debug, Deserialize)]
struct SportsDbTeam {
    #[serde(rename = "idTeam")]
    id_team: String,
    #[serde(rename = "strTeam")]
    str_team: String,
    #[serde(rename = "strTeamShort")]
    str_team_short: Option<String>,
    #[serde(rename = "strSport")]
    str_sport: String,
    #[serde(rename = "strLeague")]
    str_league: String,
    #[serde(rename = "idLeague")]
    id_league: String,
    #[serde(rename = "strCountry")]
    str_country: Option<String>,
    #[serde(rename = "strBadge")]
    str_badge: Option<String>,
    #[serde(rename = "strLogo")]
    str_logo: Option<String>,
    #[serde(rename = "strBanner")]
    str_banner: Option<String>,
    #[serde(rename = "strJersey")]
    str_jersey: Option<String>,
    #[serde(rename = "strStadium")]
    str_stadium: Option<String>,
    #[serde(rename = "strStadiumThumb")]
    str_stadium_thumb: Option<String>,
    #[serde(rename = "intFormedYear")]
    int_formed_year: Option<String>,
    #[serde(rename = "strFanart1")]
    str_fanart1: Option<String>,
    #[serde(rename = "strFanart2")]
    str_fanart2: Option<String>,
    #[serde(rename = "strFanart3")]
    str_fanart3: Option<String>,
    #[serde(rename = "strFanart4")]
    str_fanart4: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SportsDbLeague {
    #[serde(rename = "idLeague")]
    id_league: String,
    #[serde(rename = "strLeague")]
    str_league: String,
    #[serde(rename = "strSport")]
    str_sport: String,
    #[serde(rename = "strCountry")]
    str_country: Option<String>,
    #[serde(rename = "strBadge")]
    str_badge: Option<String>,
    #[serde(rename = "strLogo")]
    str_logo: Option<String>,
    #[serde(rename = "strBanner")]
    str_banner: Option<String>,
    #[serde(rename = "strPoster")]
    str_poster: Option<String>,
    #[serde(rename = "strTrophy")]
    str_trophy: Option<String>,
    #[serde(rename = "strFanart1")]
    str_fanart1: Option<String>,
    #[serde(rename = "strFanart2")]
    str_fanart2: Option<String>,
    #[serde(rename = "strFanart3")]
    str_fanart3: Option<String>,
    #[serde(rename = "strFanart4")]
    str_fanart4: Option<String>,
    #[serde(rename = "intFormedYear")]
    int_formed_year: Option<String>,
}

pub struct SportsDbApi;

impl SportsDbApi {
    fn get_api_key(custom_key: Option<&str>) -> &str {
        custom_key.unwrap_or(SPORTSDB_FREE_KEY)
    }

    /// Search for teams by name
    pub async fn search_teams(
        client: &ApiClient,
        query: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<SportsTeamSearchResult>, ApiError> {
        let key = Self::get_api_key(api_key);
        let url = format!(
            "{}/{}/searchteams.php?t={}",
            SPORTSDB_BASE_URL, key, urlencoding::encode(query)
        );

        let response = client.get("sports", &url).await?;
        let data: TeamsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let teams = data.teams.unwrap_or_default()
            .into_iter()
            .map(|team| SportsTeamSearchResult {
                id: team.id_team,
                name: team.str_team,
                short_name: team.str_team_short,
                sport: team.str_sport,
                league: team.str_league,
                league_id: team.id_league,
                country: team.str_country,
                badge_url: team.str_badge,
                logo_url: team.str_logo,
                stadium: team.str_stadium,
                formed_year: team.int_formed_year,
            })
            .collect();

        Ok(teams)
    }

    /// Get teams in a league
    pub async fn get_teams_in_league(
        client: &ApiClient,
        league_name: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<SportsTeamSearchResult>, ApiError> {
        let key = Self::get_api_key(api_key);
        let url = format!(
            "{}/{}/search_all_teams.php?l={}",
            SPORTSDB_BASE_URL, key, urlencoding::encode(league_name)
        );

        let response = client.get("sports", &url).await?;
        let data: TeamsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let teams = data.teams.unwrap_or_default()
            .into_iter()
            .map(|team| SportsTeamSearchResult {
                id: team.id_team,
                name: team.str_team,
                short_name: team.str_team_short,
                sport: team.str_sport,
                league: team.str_league,
                league_id: team.id_league,
                country: team.str_country,
                badge_url: team.str_badge,
                logo_url: team.str_logo,
                stadium: team.str_stadium,
                formed_year: team.int_formed_year,
            })
            .collect();

        Ok(teams)
    }

    /// Get leagues by country
    pub async fn get_leagues_by_country(
        client: &ApiClient,
        country: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<SportsLeagueSearchResult>, ApiError> {
        let key = Self::get_api_key(api_key);
        let url = format!(
            "{}/{}/search_all_leagues.php?c={}",
            SPORTSDB_BASE_URL, key, urlencoding::encode(country)
        );

        let response = client.get("sports", &url).await?;
        let data: LeaguesResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let leagues = data.countries.unwrap_or_default()
            .into_iter()
            .map(|league| SportsLeagueSearchResult {
                id: league.id_league,
                name: league.str_league,
                sport: league.str_sport,
                country: league.str_country,
                badge_url: league.str_badge,
                logo_url: league.str_logo,
                banner_url: league.str_banner,
                formed_year: league.int_formed_year,
            })
            .collect();

        Ok(leagues)
    }

    /// Get all images for a team
    pub async fn get_team_images(
        client: &ApiClient,
        team_id: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let key = Self::get_api_key(api_key);
        let url = format!(
            "{}/{}/lookupteam.php?id={}",
            SPORTSDB_BASE_URL, key, team_id
        );

        let response = client.get("sports", &url).await?;
        let data: TeamsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let team = data.teams.and_then(|t| t.into_iter().next())
            .ok_or_else(|| ApiError::NotFound)?;

        let mut images = Vec::new();

        if let Some(badge) = team.str_badge {
            images.push(ImageItem {
                url: badge.clone(),
                thumb_url: badge,
                image_type: "badge".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(logo) = team.str_logo {
            images.push(ImageItem {
                url: logo.clone(),
                thumb_url: logo,
                image_type: "logo".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(banner) = team.str_banner {
            images.push(ImageItem {
                url: banner.clone(),
                thumb_url: banner,
                image_type: "banner".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(jersey) = team.str_jersey {
            images.push(ImageItem {
                url: jersey.clone(),
                thumb_url: jersey,
                image_type: "jersey".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(stadium) = team.str_stadium_thumb {
            images.push(ImageItem {
                url: stadium.clone(),
                thumb_url: stadium,
                image_type: "stadium".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        // Add fanart images
        for (fanart, idx) in [team.str_fanart1, team.str_fanart2, team.str_fanart3, team.str_fanart4]
            .into_iter()
            .zip(1..)
        {
            if let Some(url) = fanart {
                images.push(ImageItem {
                    url: url.clone(),
                    thumb_url: url,
                    image_type: format!("fanart{}", idx),
                    source: "thesportsdb".to_string(),
                    width: None,
                    height: None,
                    vote_average: None,
                    likes: None,
                    language: None,
                });
            }
        }

        Ok(images)
    }

    /// Get all images for a league
    pub async fn get_league_images(
        client: &ApiClient,
        league_id: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let key = Self::get_api_key(api_key);
        let url = format!(
            "{}/{}/lookupleague.php?id={}",
            SPORTSDB_BASE_URL, key, league_id
        );

        let response = client.get("sports", &url).await?;

        #[derive(Debug, Deserialize)]
        struct LeagueLookupResponse {
            leagues: Option<Vec<SportsDbLeague>>,
        }

        let data: LeagueLookupResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let league = data.leagues.and_then(|l| l.into_iter().next())
            .ok_or_else(|| ApiError::NotFound)?;

        let mut images = Vec::new();

        if let Some(badge) = league.str_badge {
            images.push(ImageItem {
                url: badge.clone(),
                thumb_url: badge,
                image_type: "badge".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(logo) = league.str_logo {
            images.push(ImageItem {
                url: logo.clone(),
                thumb_url: logo,
                image_type: "logo".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(banner) = league.str_banner {
            images.push(ImageItem {
                url: banner.clone(),
                thumb_url: banner,
                image_type: "banner".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(poster) = league.str_poster {
            images.push(ImageItem {
                url: poster.clone(),
                thumb_url: poster,
                image_type: "poster".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        if let Some(trophy) = league.str_trophy {
            images.push(ImageItem {
                url: trophy.clone(),
                thumb_url: trophy,
                image_type: "trophy".to_string(),
                source: "thesportsdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        // Add fanart images
        for (fanart, idx) in [league.str_fanart1, league.str_fanart2, league.str_fanart3, league.str_fanart4]
            .into_iter()
            .zip(1..)
        {
            if let Some(url) = fanart {
                images.push(ImageItem {
                    url: url.clone(),
                    thumb_url: url,
                    image_type: format!("fanart{}", idx),
                    source: "thesportsdb".to_string(),
                    width: None,
                    height: None,
                    vote_average: None,
                    likes: None,
                    language: None,
                });
            }
        }

        Ok(images)
    }
}
