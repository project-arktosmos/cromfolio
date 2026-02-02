# Untitled Collections Project

## What this is
- A very very pirate fangame of collectible cards and albums spanning multiple themes
- The way to progress is via involvement in a franchise, ie, via guitar hero tap games on the franchise's music, or by answering trivia questions

## Album Families 

### API Coverage

| Theme | Album API | Card API |
|:--:|:--:|:--:|:--:|:--:
| Movies | OMDB | TMDB / TVMaze |
| TV Shows| OMDB | TMDB / TVMaze |
| Anime | AniList | Jikan
| Videogames | IGDB | StreamGridDB
| Animals | WikiData | Wikimedia, iNaturalist
| Sports | TheSportsDB | TheSportsDB

| Cartoons (non-anime)
| Geography
| Vehicles
| Minerals
| Plants
| Astronomy
| Classic Art
| Mythology
| Cuisine
| Fashion

### Available Metadata
All albums contain the following, common metadata:
- Title
- Cover
- Category (Movie, TV Show, Animal Genus,...)

And all cards, regardless of the album they are in, have the following shared metadata:
- Title
- Image(s)
- 

| Album | Album Fields | Card Element |Metadata Fields (Cards)
|:--:|:--:|:--:|:--:|
| Movies | Year, Authors, Country | Character | Actor
| TV Shows| Year, Authors, Country |Character | Season, Actor
| Music | Year, Authors, Country | Album | Year, Author
| Anime | Year, Authors |Character | Year, Actor
| Videogames |  Year, Authors | Character |  Actor
| Books | Year, Authors, Country  | Individual Books | Year
| Animals |
| Sports | Country | Players | Year

## Minigames
The game is mostly flavored trivia questions, as generic in their formatting and data-sourcing as possible, to ease inclusion and expansion.


Universal minigames (work with all albums and card types):
- Odd One Out: 2 cards belong to that collection, one doesn't. All cards start fully blurred, and a timer unblurs them, and the quicker the response, if right, the highest the score
- Memory flip: Time-driven memory flip game
- Hanging Man: A blurred card is shown. Each subsequent letter picked right reveals the image further, and each miss is penalized. Not timed, but scored based off wrong hits

| Minigame | Mechanics
|:--:|:--:
| Historigram | Get 3 year-tagged events from the album, and place them in order. Requires each card to include a year
| Odd One Out | 3 images shown, 2 belong to this album, and 1 to an adjacent album
| Hanging Man | Get a blurry card image, not yet owned. Each correctly guessed letter makes the image less blurry
| Memory Flip | Flip cards and pair them
| Wordle | given X-length words, player can guess, and get which letters they got right. Can use any term related to the album
| Who Said What | Match a quote with 3 possible cards who said that. Requires cards to be characters
| Guess the Author | Presents a card and 3 possible authors. Requires authors in cards



## Albums & Cards
There are several types of album families for each album category
### Movies
Album
- Individual Movies (Fight Club Album)
- Movies from a decade (90s Movies Album)
- Movies with an author/actor in them

### TV Shows
Album
- Individual TV Shows
- movies from a decade


## Albert @ Ilustrum call
4k collections when they closed

private collections
- history, flags, politics

- new colletions are important
- they release sunday night, multiples, via moderation
- 

## Collection Types

### Movie & TV Prize
- use the award list collection api to produce an album for each year's nominees and winners
    - assemble a single page per movie, using 4 of its images
        - poster
        - backdrop
        - director?
        - protagonist?
        - nominee?

### Anime
- each anime gets their own album
    - has anime posters
    - has character imagery

### Sport Leagues
- similar to the awards one
- need to find a proper way to fetch the team and players data
- make one for each sport, competition and year

### Music Awards
- collect artist image and album cover for nominees and winners to grammys and the such


### Launch Collections
- Movie and TV awards, 1 per decade
    - movie posters
- Billboard albums
    - collect album covers and artist images
- pokemon
    - 1 per gen
    - pokemon and gym leader art
    - trivia is by pokemon gen and types, as well as who evolves into who, or from whom
- digimon
    - split by anime series
    - digimon, digidestined and appearing, from wikias maybe
    - digidestined kids
    - questions are about gen and evo lines, as well as who trained who in which series
- dragon ball
    - one for series (original, z, gt, super, movies)
    - characters and manga covers