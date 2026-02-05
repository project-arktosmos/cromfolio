# Cromfolio

A digital collectible sticker game where players collect cards organized into themed albums spanning movies, TV shows, anime, video games, sports, and more. Progress by playing trivia games and earn booster packs to expand your collection.

## Features

### Collections & Stickers
- Browse themed collections (Pokémon generations, TV shows, movies, anime, etc.)
- Each collection contains stickers with varying rarity levels
- Track completion percentage based on rarity scores
- View collections in a paginated grid layout

### Trivia Games
- Answer trivia questions to earn booster packs
- Two difficulty modes: Easy (3 lives, 10s timer) and Hard (1 life, 5s timer)
- Questions generated dynamically from collection-specific templates
- Track your stats: games played, best score, best streak, accuracy

### Booster Pack System
- Earn packs through trivia games and timed rewards
- Each pack contains 5 random stickers with weighted rarity
- Interactive drag-and-drop pack opening experience
- Stickers have color-coded rarity levels

### Timed Rewards
- Earn 1 booster pack every 10 minutes per active collection
- Real-time countdown timers show when rewards are ready
- Rewards scale with collection completion percentage

### Album Customization
- Place decorative stamps and icons on album pages
- Drag-and-drop positioning with scale and rotation
- Decorations persist across sessions

## Tech Stack

- **Frontend**: SvelteKit, TailwindCSS v4, DaisyUI v5
- **Desktop**: Tauri v2 (Rust)
- **Database**: SQLite for persistent storage
- **State**: Svelte stores with localStorage for game state

## Development

### Prerequisites
- Node.js 18+
- pnpm
- Rust toolchain (for Tauri)

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run Tauri desktop app
pnpm tauri dev
```

### Testing

```bash
pnpm test           # Run all tests
pnpm test:ui        # Interactive test UI
pnpm test:coverage  # Coverage report
```

## Project Structure

```
src/
├── routes/           # SvelteKit pages
├── components/       # Reusable UI components
├── services/         # Business logic and state management
├── adapters/         # Data transformation
├── types/            # TypeScript definitions
└── utils/            # Pure utility functions

src-tauri/
├── src/commands/     # Rust commands exposed to frontend
└── src/db/           # SQLite database operations
```

## Data Sources

Collections pull metadata from various APIs:

| Theme      | Album API  | Card API               |
|:----------:|:----------:|:----------------------:|
| Movies     | OMDB       | TMDB / TVMaze          |
| TV Shows   | OMDB       | TMDB / TVMaze          |
| Anime      | AniList    | Jikan                  |
| Videogames | IGDB       | StreamGridDB           |
| Animals    | WikiData   | Wikimedia, iNaturalist |
| Sports     | TheSportsDB| TheSportsDB            |
