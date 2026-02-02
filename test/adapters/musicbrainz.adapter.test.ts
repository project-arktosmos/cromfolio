import { describe, it, expect } from 'vitest';
import {
	musicbrainzAdapter,
	type MBArtistResult,
	type MBReleaseResult,
	type MBRecordingResult,
	type MBLabelResult,
	type MBReleaseGroupResult
} from '$adapters/classes/musicbrainz.adapter';

describe('musicbrainz.adapter', () => {
	describe('fromApi (artist)', () => {
		it('should transform MusicBrainz artist to Artist', () => {
			const apiData: MBArtistResult = {
				id: '8bfac288-ccc5-448d-9573-c33ea2aa5c30',
				name: 'Red Hot Chili Peppers',
				'sort-name': 'Red Hot Chili Peppers',
				type: 'Group',
				country: 'US',
				area: {
					id: '489ce91b-6658-3307-9877-795b68554c98',
					name: 'United States',
					'iso-3166-1-codes': ['US']
				},
				'begin-area': {
					id: '1f40c6e1-47ba-4e35-996f-fe6ee5840e62',
					name: 'Los Angeles'
				},
				'life-span': {
					begin: '1983',
					ended: false
				},
				tags: [
					{ name: 'rock', count: 100 },
					{ name: 'funk rock', count: 80 }
				],
				genres: [
					{ name: 'alternative rock', count: 50 },
					{ name: 'funk rock', count: 40 }
				]
			};

			const artist = musicbrainzAdapter.fromApi(apiData);

			expect(artist.id).toBe('8bfac288-ccc5-448d-9573-c33ea2aa5c30');
			expect(artist.name).toBe('Red Hot Chili Peppers');
			expect(artist.sortName).toBe('Red Hot Chili Peppers');
			expect(artist.type).toBe('Group');
			expect(artist.country).toBe('US');
			expect(artist.area).toBe('United States');
			expect(artist.beginDate).toBe('1983');
			expect(artist.endDate).toBeUndefined();
			expect(artist.genres).toEqual(['alternative rock', 'funk rock']);
			expect(artist.tags).toEqual(['rock', 'funk rock']);
			expect(artist.mbid).toBe('8bfac288-ccc5-448d-9573-c33ea2aa5c30');
		});

		it('should normalize artist types', () => {
			const types = ['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other', 'Unknown'];
			const expected = ['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other', 'Other'];

			types.forEach((type, i) => {
				const apiData: MBArtistResult = { id: '1', name: 'Test', type };
				const artist = musicbrainzAdapter.fromApi(apiData);
				expect(artist.type).toBe(expected[i]);
			});
		});

		it('should handle missing optional fields', () => {
			const apiData: MBArtistResult = {
				id: '123',
				name: 'Minimal Artist'
			};

			const artist = musicbrainzAdapter.fromApi(apiData);

			expect(artist.id).toBe('123');
			expect(artist.name).toBe('Minimal Artist');
			expect(artist.type).toBe('Other');
			expect(artist.country).toBeUndefined();
			expect(artist.genres).toEqual([]);
		});

		it('should fallback to area ISO code for country', () => {
			const apiData: MBArtistResult = {
				id: '123',
				name: 'Artist',
				area: {
					id: '1',
					name: 'Germany',
					'iso-3166-1-codes': ['DE']
				}
			};

			const artist = musicbrainzAdapter.fromApi(apiData);

			expect(artist.country).toBe('DE');
		});
	});

	describe('fromRelease (album)', () => {
		it('should transform MusicBrainz release to Album', () => {
			const apiData: MBReleaseResult = {
				id: 'abc123',
				title: 'Californication',
				status: 'Official',
				date: '1999-06-08',
				country: 'US',
				barcode: '093624731429',
				'artist-credit': [
					{
						artist: { id: 'a1', name: 'Red Hot Chili Peppers' }
					}
				],
				'label-info': [
					{
						'catalog-number': 'W2 47386',
						label: { id: 'l1', name: 'Warner Bros. Records' }
					}
				],
				'track-count': 15,
				'release-group': {
					id: 'rg1',
					title: 'Californication',
					'primary-type': 'Album'
				},
				'cover-art-archive': {
					artwork: true,
					count: 3,
					front: true,
					back: true
				}
			};

			const album = musicbrainzAdapter.fromRelease(apiData);

			expect(album.id).toBe('abc123');
			expect(album.title).toBe('Californication');
			expect(album.artistCredit).toBe('Red Hot Chili Peppers');
			expect(album.artistIds).toEqual(['a1']);
			expect(album.releaseDate).toBe('1999-06-08');
			expect(album.releaseType).toBe('album');
			expect(album.status).toBe('official');
			expect(album.country).toBe('US');
			expect(album.label).toBe('Warner Bros. Records');
			expect(album.catalogNumber).toBe('W2 47386');
			expect(album.barcode).toBe('093624731429');
			expect(album.coverArtUrl).toBe('https://coverartarchive.org/release/abc123/front');
			expect(album.trackCount).toBe(15);
			expect(album.mbid).toBe('abc123');
		});

		it('should normalize release types', () => {
			const types = [
				{ input: 'Album', expected: 'album' },
				{ input: 'Single', expected: 'single' },
				{ input: 'EP', expected: 'ep' },
				{ input: 'Compilation', expected: 'compilation' },
				{ input: 'Soundtrack', expected: 'soundtrack' },
				{ input: 'Live', expected: 'live' },
				{ input: 'Remix', expected: 'remix' },
				{ input: 'Unknown', expected: 'other' }
			];

			types.forEach(({ input, expected }) => {
				const apiData: MBReleaseResult = {
					id: '1',
					title: 'Test',
					'release-group': { id: 'rg', title: 'Test', 'primary-type': input }
				};
				const album = musicbrainzAdapter.fromRelease(apiData);
				expect(album.releaseType).toBe(expected);
			});
		});

		it('should normalize release status', () => {
			const statuses = [
				{ input: 'Official', expected: 'official' },
				{ input: 'Promotion', expected: 'promotion' },
				{ input: 'Bootleg', expected: 'bootleg' },
				{ input: 'Pseudo-Release', expected: 'pseudo-release' }
			];

			statuses.forEach(({ input, expected }) => {
				const apiData: MBReleaseResult = { id: '1', title: 'Test', status: input };
				const album = musicbrainzAdapter.fromRelease(apiData);
				expect(album.status).toBe(expected);
			});
		});

		it('should handle artist credit with join phrase', () => {
			const apiData: MBReleaseResult = {
				id: '1',
				title: 'Collaboration Album',
				'artist-credit': [
					{ artist: { id: 'a1', name: 'Artist A' }, joinphrase: ' & ' },
					{ artist: { id: 'a2', name: 'Artist B' } }
				]
			};

			const album = musicbrainzAdapter.fromRelease(apiData);

			expect(album.artistCredit).toBe('Artist A & Artist B');
		});

		it('should not include cover URL if front is false', () => {
			const apiData: MBReleaseResult = {
				id: '1',
				title: 'No Cover',
				'cover-art-archive': {
					artwork: true,
					count: 1,
					front: false,
					back: true
				}
			};

			const album = musicbrainzAdapter.fromRelease(apiData);

			expect(album.coverArtUrl).toBeUndefined();
		});
	});

	describe('fromRecording', () => {
		it('should transform MusicBrainz recording to Recording', () => {
			const apiData: MBRecordingResult = {
				id: 'rec123',
				title: 'Scar Tissue',
				length: 217000, // 3:37 in milliseconds
				isrcs: ['USWA19900001'],
				'first-release-date': '1999-05-25',
				'artist-credit': [
					{ artist: { id: 'a1', name: 'Red Hot Chili Peppers' } }
				],
				tags: [{ name: 'rock', count: 10 }],
				genres: [{ name: 'alternative rock', count: 5 }]
			};

			const recording = musicbrainzAdapter.fromRecording(apiData);

			expect(recording.id).toBe('rec123');
			expect(recording.title).toBe('Scar Tissue');
			expect(recording.artistCredit).toBe('Red Hot Chili Peppers');
			expect(recording.artistIds).toEqual(['a1']);
			expect(recording.lengthMs).toBe(217000);
			expect(recording.isrc).toBe('USWA19900001');
			expect(recording.firstReleaseDate).toBe('1999-05-25');
			expect(recording.genres).toEqual(['alternative rock']);
			expect(recording.mbid).toBe('rec123');
		});
	});

	describe('fromLabel', () => {
		it('should transform MusicBrainz label to RecordLabel', () => {
			const apiData: MBLabelResult = {
				id: 'label123',
				name: 'Warner Bros. Records',
				'sort-name': 'Warner Bros. Records',
				type: 'Production',
				country: 'US',
				area: {
					id: 'a1',
					name: 'United States',
					'iso-3166-1-codes': ['US']
				},
				'life-span': {
					begin: '1958',
					ended: false
				},
				'label-code': 121
			};

			const label = musicbrainzAdapter.fromLabel(apiData);

			expect(label.id).toBe('label123');
			expect(label.name).toBe('Warner Bros. Records');
			expect(label.sortName).toBe('Warner Bros. Records');
			expect(label.type).toBe('production');
			expect(label.country).toBe('US');
			expect(label.beginDate).toBe('1958');
			expect(label.mbid).toBe('label123');
		});

		it('should normalize label types', () => {
			const types = [
				{ input: 'Distributor', expected: 'distributor' },
				{ input: 'Holding', expected: 'holding' },
				{ input: 'Production', expected: 'production' },
				{ input: 'Original Production', expected: 'original_production' },
				{ input: 'Bootleg Production', expected: 'bootleg_production' },
				{ input: 'Reissue Production', expected: 'reissue_production' },
				{ input: 'Publisher', expected: 'publisher' }
			];

			types.forEach(({ input, expected }) => {
				const apiData: MBLabelResult = { id: '1', name: 'Test', type: input };
				const label = musicbrainzAdapter.fromLabel(apiData);
				expect(label.type).toBe(expected);
			});
		});
	});

	describe('fromReleaseGroup', () => {
		it('should transform MusicBrainz release group to ReleaseGroup', () => {
			const apiData: MBReleaseGroupResult = {
				id: 'rg123',
				title: 'Californication',
				'primary-type': 'Album',
				'secondary-types': ['Compilation'],
				'artist-credit': [
					{ artist: { id: 'a1', name: 'Red Hot Chili Peppers' } }
				],
				'first-release-date': '1999-06-08',
				releases: [
					{ id: 'r1', title: 'Californication' },
					{ id: 'r2', title: 'Californication (Deluxe)' }
				]
			};

			const rg = musicbrainzAdapter.fromReleaseGroup(apiData);

			expect(rg.id).toBe('rg123');
			expect(rg.title).toBe('Californication');
			expect(rg.primaryType).toBe('Album');
			expect(rg.secondaryTypes).toEqual(['Compilation']);
			expect(rg.artistCredit).toBe('Red Hot Chili Peppers');
			expect(rg.firstReleaseDate).toBe('1999-06-08');
			expect(rg.releaseCount).toBe(2);
			expect(rg.mbid).toBe('rg123');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of releases', () => {
			const apiArray: MBReleaseResult[] = [
				{ id: 'r1', title: 'Album 1' },
				{ id: 'r2', title: 'Album 2' }
			];

			const albums = musicbrainzAdapter.fromReleaseMany(apiArray);

			expect(albums).toHaveLength(2);
			expect(albums[0].title).toBe('Album 1');
		});

		it('should transform array of recordings', () => {
			const apiArray: MBRecordingResult[] = [
				{ id: 'rec1', title: 'Track 1' },
				{ id: 'rec2', title: 'Track 2' }
			];

			const recordings = musicbrainzAdapter.fromRecordingMany(apiArray);

			expect(recordings).toHaveLength(2);
		});

		it('should transform array of labels', () => {
			const apiArray: MBLabelResult[] = [
				{ id: 'l1', name: 'Label 1' },
				{ id: 'l2', name: 'Label 2' }
			];

			const labels = musicbrainzAdapter.fromLabelMany(apiArray);

			expect(labels).toHaveLength(2);
		});

		it('should transform array of release groups', () => {
			const apiArray: MBReleaseGroupResult[] = [
				{ id: 'rg1', title: 'RG 1' },
				{ id: 'rg2', title: 'RG 2' }
			];

			const rgs = musicbrainzAdapter.fromReleaseGroupMany(apiArray);

			expect(rgs).toHaveLength(2);
		});
	});

	describe('toDisplayFormat', () => {
		it('should format artist with type', () => {
			const artist = {
				id: '1',
				name: 'The Beatles',
				type: 'Group' as const,
				mbid: '1'
			};

			const display = musicbrainzAdapter.toDisplayFormat(artist);

			expect(display).toBe('The Beatles (Group)');
		});

		it('should format artist without type', () => {
			const artist = {
				id: '1',
				name: 'Unknown Artist',
				mbid: '1'
			};

			const display = musicbrainzAdapter.toDisplayFormat(artist);

			expect(display).toBe('Unknown Artist');
		});
	});

	describe('tag extraction', () => {
		it('should sort tags by count', () => {
			const apiData: MBArtistResult = {
				id: '1',
				name: 'Artist',
				tags: [
					{ name: 'low', count: 5 },
					{ name: 'high', count: 100 },
					{ name: 'medium', count: 50 }
				]
			};

			const artist = musicbrainzAdapter.fromApi(apiData);

			expect(artist.tags).toEqual(['high', 'medium', 'low']);
		});
	});
});
