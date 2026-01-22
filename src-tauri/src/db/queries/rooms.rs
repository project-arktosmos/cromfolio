use rusqlite::{params, Connection};
use crate::models::{Room, RoomDimensions, RoomBounds, RoomColors, RoomCameraSpawn, RoomFurniture, Position3D};

pub fn get_all(conn: &Connection) -> Result<Vec<Room>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description,
                    dim_width, dim_height, dim_depth,
                    bounds_min_x, bounds_max_x, bounds_min_z, bounds_max_z,
                    color_floor, color_ceiling, color_walls,
                    camera_x, camera_y, camera_z, camera_pitch,
                    furniture_json, thumbnail,
                    created_at, updated_at
             FROM rooms
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_room(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Room>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description,
                    dim_width, dim_height, dim_depth,
                    bounds_min_x, bounds_max_x, bounds_min_z, bounds_max_z,
                    color_floor, color_ceiling, color_walls,
                    camera_x, camera_y, camera_z, camera_pitch,
                    furniture_json, thumbnail,
                    created_at, updated_at
             FROM rooms
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_room(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, room: &Room) -> Result<Room, String> {
    let id = if room.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        room.id.clone()
    };

    let now = chrono_now();
    let furniture_json = serde_json::to_string(&room.furniture)
        .map_err(|e| format!("Failed to serialize furniture: {}", e))?;

    conn.execute(
        "INSERT INTO rooms (
            id, name, description,
            dim_width, dim_height, dim_depth,
            bounds_min_x, bounds_max_x, bounds_min_z, bounds_max_z,
            color_floor, color_ceiling, color_walls,
            camera_x, camera_y, camera_z, camera_pitch,
            furniture_json, thumbnail,
            created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
        params![
            id,
            room.name,
            room.description,
            room.dimensions.width,
            room.dimensions.height,
            room.dimensions.depth,
            room.bounds.min_x,
            room.bounds.max_x,
            room.bounds.min_z,
            room.bounds.max_z,
            room.colors.floor,
            room.colors.ceiling,
            room.colors.walls,
            room.camera_spawn.position.x,
            room.camera_spawn.position.y,
            room.camera_spawn.position.z,
            room.camera_spawn.pitch,
            furniture_json,
            room.thumbnail,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Room {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..room.clone()
    })
}

pub fn update(conn: &Connection, room: &Room) -> Result<Room, String> {
    let now = chrono_now();
    let furniture_json = serde_json::to_string(&room.furniture)
        .map_err(|e| format!("Failed to serialize furniture: {}", e))?;

    conn.execute(
        "UPDATE rooms SET
            name = ?2, description = ?3,
            dim_width = ?4, dim_height = ?5, dim_depth = ?6,
            bounds_min_x = ?7, bounds_max_x = ?8, bounds_min_z = ?9, bounds_max_z = ?10,
            color_floor = ?11, color_ceiling = ?12, color_walls = ?13,
            camera_x = ?14, camera_y = ?15, camera_z = ?16, camera_pitch = ?17,
            furniture_json = ?18, thumbnail = ?19,
            updated_at = ?20
         WHERE id = ?1",
        params![
            room.id,
            room.name,
            room.description,
            room.dimensions.width,
            room.dimensions.height,
            room.dimensions.depth,
            room.bounds.min_x,
            room.bounds.max_x,
            room.bounds.min_z,
            room.bounds.max_z,
            room.colors.floor,
            room.colors.ceiling,
            room.colors.walls,
            room.camera_spawn.position.x,
            room.camera_spawn.position.y,
            room.camera_spawn.position.z,
            room.camera_spawn.pitch,
            furniture_json,
            room.thumbnail,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Room {
        updated_at: now,
        ..room.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM rooms WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_room(row: &rusqlite::Row) -> Room {
    let furniture_json: String = row.get(17).unwrap_or_default();
    let furniture: Vec<RoomFurniture> = serde_json::from_str(&furniture_json).unwrap_or_default();

    Room {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        description: row.get(2).unwrap_or(None),
        dimensions: RoomDimensions {
            width: row.get(3).unwrap_or(8.0),
            height: row.get(4).unwrap_or(4.0),
            depth: row.get(5).unwrap_or(10.0),
        },
        bounds: RoomBounds {
            min_x: row.get(6).unwrap_or(-3.5),
            max_x: row.get(7).unwrap_or(3.5),
            min_z: row.get(8).unwrap_or(-4.0),
            max_z: row.get(9).unwrap_or(4.5),
        },
        colors: RoomColors {
            floor: row.get(10).unwrap_or_else(|_| "#8b7355".to_string()),
            ceiling: row.get(11).unwrap_or_else(|_| "#f5f5f5".to_string()),
            walls: row.get(12).unwrap_or_else(|_| "#e8e4de".to_string()),
        },
        camera_spawn: RoomCameraSpawn {
            position: Position3D {
                x: row.get(13).unwrap_or(0.0),
                y: row.get(14).unwrap_or(1.4),
                z: row.get(15).unwrap_or(-0.8),
            },
            pitch: row.get(16).unwrap_or(-0.35),
        },
        furniture,
        thumbnail: row.get(18).unwrap_or(None),
        created_at: row.get(19).unwrap_or_default(),
        updated_at: row.get(20).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
