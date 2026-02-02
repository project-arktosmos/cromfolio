import { describe, it, expect } from 'vitest';
import {
	thesportsdbAdapter,
	type TSDBTeamResult,
	type TSDBPlayerResult,
	type TSDBLeagueResult,
	type TSDBEventResult,
	type TSDBSeasonResult
} from '$adapters/classes/thesportsdb.adapter';

describe('thesportsdb.adapter', () => {
	describe('fromApi (team)', () => {
		it('should transform TheSportsDB team to Team', () => {
			const apiData: TSDBTeamResult = {
				idTeam: '133604',
				strTeam: 'Arsenal',
				strTeamShort: 'ARS',
				strAlternate: 'The Gunners',
				strSport: 'Soccer',
				idLeague: '4328',
				strLeague: 'English Premier League',
				strCountry: 'England',
				strCity: 'London',
				strStadium: 'Emirates Stadium',
				intStadiumCapacity: '60704',
				intFormedYear: '1886',
				strTeamBadge: 'https://example.com/arsenal_badge.png',
				strTeamJersey: 'https://example.com/arsenal_jersey.png',
				strTeamBanner: 'https://example.com/arsenal_banner.png',
				strDescriptionEN: 'Arsenal Football Club is a professional football club.',
				strWebsite: 'arsenal.com',
				strFacebook: 'https://facebook.com/arsenal',
				strTwitter: 'https://twitter.com/arsenal',
				strInstagram: 'https://instagram.com/arsenal',
				strYoutube: 'https://youtube.com/arsenal',
				strColour1: '#EF0107',
				strColour2: '#FFFFFF'
			};

			const team = thesportsdbAdapter.fromApi(apiData);

			expect(team.id).toBe('133604');
			expect(team.name).toBe('Arsenal');
			expect(team.shortName).toBe('ARS');
			expect(team.alternateName).toBe('The Gunners');
			expect(team.sport).toBe('Soccer');
			expect(team.leagueId).toBe('4328');
			expect(team.leagueName).toBe('English Premier League');
			expect(team.country).toBe('England');
			expect(team.city).toBe('London');
			expect(team.stadium).toBe('Emirates Stadium');
			expect(team.stadiumCapacity).toBe(60704);
			expect(team.formedYear).toBe(1886);
			expect(team.badge).toBe('https://example.com/arsenal_badge.png');
			expect(team.jersey).toBe('https://example.com/arsenal_jersey.png');
			expect(team.banner).toBe('https://example.com/arsenal_banner.png');
			expect(team.description).toBe('Arsenal Football Club is a professional football club.');
			expect(team.website).toBe('https://arsenal.com');
			expect(team.primaryColor).toBe('#EF0107');
			expect(team.secondaryColor).toBe('#FFFFFF');
			expect(team.sportsDbId).toBe('133604');
		});

		it('should normalize URL by adding https://', () => {
			const apiData: TSDBTeamResult = {
				idTeam: '1',
				strTeam: 'Test',
				strSport: 'Soccer',
				strWebsite: 'example.com'
			};

			const team = thesportsdbAdapter.fromApi(apiData);

			expect(team.website).toBe('https://example.com');
		});

		it('should not modify URL if already has protocol', () => {
			const apiData: TSDBTeamResult = {
				idTeam: '1',
				strTeam: 'Test',
				strSport: 'Soccer',
				strWebsite: 'http://example.com'
			};

			const team = thesportsdbAdapter.fromApi(apiData);

			expect(team.website).toBe('http://example.com');
		});

		it('should handle missing optional fields', () => {
			const apiData: TSDBTeamResult = {
				idTeam: '1',
				strTeam: 'Minimal Team',
				strSport: 'Soccer'
			};

			const team = thesportsdbAdapter.fromApi(apiData);

			expect(team.id).toBe('1');
			expect(team.name).toBe('Minimal Team');
			expect(team.stadiumCapacity).toBeUndefined();
			expect(team.formedYear).toBeUndefined();
			expect(team.website).toBeUndefined();
		});
	});

	describe('fromPlayer', () => {
		it('should transform TheSportsDB player to Player', () => {
			const apiData: TSDBPlayerResult = {
				idPlayer: '34145937',
				strPlayer: 'Bukayo Saka',
				strNationality: 'England',
				strPosition: 'Right Winger',
				idTeam: '133604',
				strTeam: 'Arsenal',
				dateBorn: '2001-09-05',
				strBirthLocation: 'London, England',
				strHeight: '1.78 m',
				strWeight: '72 kg',
				strThumb: 'https://example.com/saka_thumb.jpg',
				strCutout: 'https://example.com/saka_cutout.png',
				strRender: 'https://example.com/saka_render.png',
				strBanner: 'https://example.com/saka_banner.jpg',
				strDescriptionEN: 'A talented English winger.',
				strGender: 'Male',
				strSport: 'Soccer',
				strTwitter: '@bukayosaka'
			};

			const player = thesportsdbAdapter.fromPlayer(apiData);

			expect(player.id).toBe('34145937');
			expect(player.name).toBe('Bukayo Saka');
			expect(player.nationality).toBe('England');
			expect(player.position).toBe('Right Winger');
			expect(player.teamId).toBe('133604');
			expect(player.teamName).toBe('Arsenal');
			expect(player.birthDate).toBe('2001-09-05');
			expect(player.birthPlace).toBe('London, England');
			expect(player.height).toBe('1.78 m');
			expect(player.weight).toBe('72 kg');
			expect(player.photo).toBe('https://example.com/saka_thumb.jpg');
			expect(player.cutoutUrl).toBe('https://example.com/saka_cutout.png');
			expect(player.gender).toBe('Male');
			expect(player.sport).toBe('Soccer');
			expect(player.sportsDbId).toBe('34145937');
		});

		it('should normalize gender values', () => {
			const genders = [
				{ input: 'Male', expected: 'Male' },
				{ input: 'male', expected: 'Male' },
				{ input: 'm', expected: 'Male' },
				{ input: 'Female', expected: 'Female' },
				{ input: 'female', expected: 'Female' },
				{ input: 'f', expected: 'Female' },
				{ input: 'Other', expected: undefined },
				{ input: undefined, expected: undefined }
			];

			genders.forEach(({ input, expected }) => {
				const apiData: TSDBPlayerResult = {
					idPlayer: '1',
					strPlayer: 'Test',
					strGender: input
				};
				const player = thesportsdbAdapter.fromPlayer(apiData);
				expect(player.gender).toBe(expected);
			});
		});
	});

	describe('fromLeague', () => {
		it('should transform TheSportsDB league to League', () => {
			const apiData: TSDBLeagueResult = {
				idLeague: '4328',
				strLeague: 'English Premier League',
				strLeagueAlternate: 'Premier League, EPL',
				strSport: 'Soccer',
				strCountry: 'England',
				intFormedYear: '1992',
				strCurrentSeason: '2023-2024',
				dateFirstEvent: '1992-08-15',
				strBadge: 'https://example.com/epl_badge.png',
				strLogo: 'https://example.com/epl_logo.png',
				strTrophy: 'https://example.com/epl_trophy.png',
				strBanner: 'https://example.com/epl_banner.jpg',
				strPoster: 'https://example.com/epl_poster.jpg',
				strFanart1: 'https://example.com/fanart1.jpg',
				strFanart2: 'https://example.com/fanart2.jpg',
				strFanart3: 'https://example.com/fanart3.jpg',
				strFanart4: 'https://example.com/fanart4.jpg',
				strDescriptionEN: 'The Premier League is the top tier of English football.',
				strWebsite: 'premierleague.com',
				strFacebook: 'https://facebook.com/premierleague',
				strTwitter: '@premierleague',
				strYoutube: 'https://youtube.com/premierleague'
			};

			const league = thesportsdbAdapter.fromLeague(apiData);

			expect(league.id).toBe('4328');
			expect(league.name).toBe('English Premier League');
			expect(league.alternateName).toBe('Premier League, EPL');
			expect(league.sport).toBe('Soccer');
			expect(league.country).toBe('England');
			expect(league.formedYear).toBe(1992);
			expect(league.currentSeason).toBe('2023-2024');
			expect(league.firstEventDate).toBe('1992-08-15');
			expect(league.badge).toBe('https://example.com/epl_badge.png');
			expect(league.logo).toBe('https://example.com/epl_logo.png');
			expect(league.trophy).toBe('https://example.com/epl_trophy.png');
			expect(league.fanart).toHaveLength(4);
			expect(league.website).toBe('https://premierleague.com');
			expect(league.sportsDbId).toBe('4328');
		});

		it('should filter out null/undefined fanart entries', () => {
			const apiData: TSDBLeagueResult = {
				idLeague: '1',
				strLeague: 'Test League',
				strSport: 'Soccer',
				strFanart1: 'fanart1.jpg',
				strFanart2: undefined,
				strFanart3: 'fanart3.jpg'
			};

			const league = thesportsdbAdapter.fromLeague(apiData);

			expect(league.fanart).toEqual(['fanart1.jpg', 'fanart3.jpg']);
		});

		it('should set fanart to undefined if no fanart available', () => {
			const apiData: TSDBLeagueResult = {
				idLeague: '1',
				strLeague: 'Test League',
				strSport: 'Soccer'
			};

			const league = thesportsdbAdapter.fromLeague(apiData);

			expect(league.fanart).toBeUndefined();
		});
	});

	describe('fromEvent', () => {
		it('should transform TheSportsDB event to SportsEvent', () => {
			const apiData: TSDBEventResult = {
				idEvent: '1234567',
				strEvent: 'Arsenal vs Manchester United',
				strSport: 'Soccer',
				idLeague: '4328',
				strSeason: '2023-2024',
				intRound: '15',
				idHomeTeam: '133604',
				strHomeTeam: 'Arsenal',
				idAwayTeam: '133612',
				strAwayTeam: 'Manchester United',
				intHomeScore: '3',
				intAwayScore: '1',
				dateEvent: '2024-01-15',
				strTime: '20:00:00',
				strVenue: 'Emirates Stadium',
				strCity: 'London',
				strCountry: 'England',
				strThumb: 'https://example.com/match_thumb.jpg',
				strVideo: 'https://youtube.com/watch?v=abc123',
				strStatus: 'Match Finished'
			};

			const event = thesportsdbAdapter.fromEvent(apiData);

			expect(event.id).toBe('1234567');
			expect(event.name).toBe('Arsenal vs Manchester United');
			expect(event.sport).toBe('Soccer');
			expect(event.leagueId).toBe('4328');
			expect(event.season).toBe('2023-2024');
			expect(event.round).toBe('15');
			expect(event.homeTeamId).toBe('133604');
			expect(event.homeTeamName).toBe('Arsenal');
			expect(event.awayTeamId).toBe('133612');
			expect(event.awayTeamName).toBe('Manchester United');
			expect(event.homeScore).toBe(3);
			expect(event.awayScore).toBe(1);
			expect(event.eventDate).toBe('2024-01-15');
			expect(event.eventTime).toBe('20:00:00');
			expect(event.venue).toBe('Emirates Stadium');
			expect(event.city).toBe('London');
			expect(event.country).toBe('England');
			expect(event.status).toBe('Finished');
		});

		it('should normalize event status values', () => {
			const statuses = [
				{ input: 'Match Finished', expected: 'Finished' },
				{ input: 'FT', expected: 'Finished' },
				{ input: 'Scheduled', expected: 'Scheduled' },
				{ input: 'NS', expected: 'Scheduled' },
				{ input: 'Not Started', expected: 'Scheduled' },
				{ input: 'In Progress', expected: 'In Progress' },
				{ input: 'Live', expected: 'In Progress' },
				{ input: 'Postponed', expected: 'Postponed' },
				{ input: 'Cancelled', expected: 'Cancelled' },
				{ input: 'Canceled', expected: 'Cancelled' }
			];

			statuses.forEach(({ input, expected }) => {
				const apiData: TSDBEventResult = {
					idEvent: '1',
					strEvent: 'Test',
					strSport: 'Soccer',
					strStatus: input
				};
				const event = thesportsdbAdapter.fromEvent(apiData);
				expect(event.status).toBe(expected);
			});
		});
	});

	describe('fromSeason', () => {
		it('should transform TheSportsDB season to Season', () => {
			const apiData: TSDBSeasonResult = {
				strSeason: '2023-2024'
			};

			const season = thesportsdbAdapter.fromSeason(apiData, '4328');

			expect(season.id).toBe('4328-2023-2024');
			expect(season.leagueId).toBe('4328');
			expect(season.name).toBe('2023-2024');
			expect(season.year).toBe(2023);
		});

		it('should extract year from single year format', () => {
			const apiData: TSDBSeasonResult = { strSeason: '2023' };
			const season = thesportsdbAdapter.fromSeason(apiData, '1');

			expect(season.year).toBe(2023);
		});

		it('should handle year ranges with slash', () => {
			const apiData: TSDBSeasonResult = { strSeason: '2023/24' };
			const season = thesportsdbAdapter.fromSeason(apiData, '1');

			expect(season.year).toBe(2023);
		});
	});

	describe('batch transformations', () => {
		it('should transform array of players', () => {
			const apiArray: TSDBPlayerResult[] = [
				{ idPlayer: '1', strPlayer: 'Player 1' },
				{ idPlayer: '2', strPlayer: 'Player 2' }
			];

			const players = thesportsdbAdapter.fromPlayerMany(apiArray);

			expect(players).toHaveLength(2);
			expect(players[0].name).toBe('Player 1');
		});

		it('should transform array of leagues', () => {
			const apiArray: TSDBLeagueResult[] = [
				{ idLeague: '1', strLeague: 'League 1', strSport: 'Soccer' },
				{ idLeague: '2', strLeague: 'League 2', strSport: 'Basketball' }
			];

			const leagues = thesportsdbAdapter.fromLeagueMany(apiArray);

			expect(leagues).toHaveLength(2);
		});

		it('should transform array of events', () => {
			const apiArray: TSDBEventResult[] = [
				{ idEvent: '1', strEvent: 'Event 1', strSport: 'Soccer' },
				{ idEvent: '2', strEvent: 'Event 2', strSport: 'Soccer' }
			];

			const events = thesportsdbAdapter.fromEventMany(apiArray);

			expect(events).toHaveLength(2);
		});

		it('should transform array of seasons', () => {
			const apiArray: TSDBSeasonResult[] = [
				{ strSeason: '2022-2023' },
				{ strSeason: '2023-2024' }
			];

			const seasons = thesportsdbAdapter.fromSeasonMany(apiArray, '4328');

			expect(seasons).toHaveLength(2);
			expect(seasons[0].year).toBe(2022);
			expect(seasons[1].year).toBe(2023);
		});
	});

	describe('toDisplayFormat', () => {
		it('should format team with city', () => {
			const team = {
				id: '1',
				name: 'Arsenal',
				city: 'London',
				sport: 'Soccer',
				sportsDbId: '1'
			};

			const display = thesportsdbAdapter.toDisplayFormat(team);

			expect(display).toBe('Arsenal (London)');
		});

		it('should format team without city', () => {
			const team = {
				id: '1',
				name: 'Arsenal',
				sport: 'Soccer',
				sportsDbId: '1'
			};

			const display = thesportsdbAdapter.toDisplayFormat(team);

			expect(display).toBe('Arsenal');
		});
	});
});
