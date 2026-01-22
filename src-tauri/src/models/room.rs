use serde::{Deserialize, Serialize};

/// 3D position
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Position3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// 3D rotation (Euler angles in radians)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Rotation3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Furniture placement within a room
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoomFurniture {
    /// Reference to furniture.id
    pub furniture_id: String,
    /// Position in 3D space
    pub position: Position3D,
    /// Rotation in radians (Euler angles)
    pub rotation: Rotation3D,
    /// Scale multiplier (applied on top of furniture's base scale)
    #[serde(default = "default_scale")]
    pub scale: f64,
}

/// Room dimensions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RoomDimensions {
    pub width: f64,
    pub height: f64,
    pub depth: f64,
}

impl Default for RoomDimensions {
    fn default() -> Self {
        Self {
            width: 8.0,
            height: 4.0,
            depth: 10.0,
        }
    }
}

/// Player movement bounds within the room
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoomBounds {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

impl Default for RoomBounds {
    fn default() -> Self {
        Self {
            min_x: -3.5,
            max_x: 3.5,
            min_z: -4.0,
            max_z: 4.5,
        }
    }
}

/// Room wall/floor/ceiling colors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RoomColors {
    pub floor: String,
    pub ceiling: String,
    pub walls: String,
}

impl Default for RoomColors {
    fn default() -> Self {
        Self {
            floor: "#8b7355".to_string(),
            ceiling: "#f5f5f5".to_string(),
            walls: "#e8e4de".to_string(),
        }
    }
}

/// Camera spawn configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RoomCameraSpawn {
    pub position: Position3D,
    /// Initial camera pitch in radians
    pub pitch: f64,
}

impl Default for RoomCameraSpawn {
    fn default() -> Self {
        Self {
            position: Position3D {
                x: 0.0,
                y: 1.4,
                z: -0.8,
            },
            pitch: -0.35,
        }
    }
}

/// Room entity - defines a 3D room template
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Room dimensions
    #[serde(default)]
    pub dimensions: RoomDimensions,
    /// Player movement bounds
    #[serde(default)]
    pub bounds: RoomBounds,
    /// Room surface colors (hex)
    #[serde(default)]
    pub colors: RoomColors,
    /// Camera spawn point and orientation
    #[serde(default)]
    pub camera_spawn: RoomCameraSpawn,
    /// Furniture placements in this room (stored as JSON)
    #[serde(default)]
    pub furniture: Vec<RoomFurniture>,
    /// Optional thumbnail image
    #[serde(default)]
    pub thumbnail: Option<String>,
    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_scale() -> f64 {
    1.0
}
