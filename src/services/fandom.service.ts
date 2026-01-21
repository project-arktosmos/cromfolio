/**
 * Fandom Wiki Service
 * Provides functions for discovering and exploring Fandom wikis for TV shows
 */

import type {
	FandomWiki,
	FandomArticle,
	FandomArticleSection,
	FandomCategory
} from '$types/fandom.type';

/**
 * Known TV show wiki mappings
 * Maps show titles to their Fandom wiki subdomains
 */
export const TV_SHOW_WIKI_MAPPINGS: Record<string, string[]> = {
	'Breaking Bad': ['breakingbad'],
	'Better Call Saul': ['breakingbad', 'bettercallsaul'],
	'Game of Thrones': ['gameofthrones'],
	'House of the Dragon': ['gameofthrones', 'houseofthedragon'],
	'The Walking Dead': ['walkingdead'],
	Stranger: ['strangerthings'],
	'Stranger Things': ['strangerthings'],
	'The Office': ['theoffice'],
	Friends: ['friends'],
	'How I Met Your Mother': ['himym', 'howimetyourmother'],
	'The Big Bang Theory': ['bigbangtheory'],
	Lost: ['lostpedia'],
	'The Simpsons': ['simpsons'],
	'Family Guy': ['familyguy'],
	'South Park': ['southpark'],
	Futurama: ['futurama'],
	'Rick and Morty': ['rickandmorty'],
	Dexter: ['dexter'],
	'True Detective': ['truedetective'],
	Sherlock: ['bakerstreet', 'sherlock'],
	'Doctor Who': ['tardis'],
	Supernatural: ['supernatural'],
	'The Vampire Diaries': ['vampirediaries'],
	'Teen Wolf': ['teenwolf'],
	Arrow: ['arrow'],
	Flash: ['arrow', 'theflash'],
	'The Flash': ['arrow', 'theflash'],
	Gotham: ['gotham'],
	'Peaky Blinders': ['peakyblinders'],
	Westworld: ['westworld'],
	'The Mandalorian': ['starwars'],
	'Star Wars': ['starwars'],
	'Star Trek': ['memory-alpha', 'startrek'],
	'The Witcher': ['witcher'],
	'The Boys': ['the-boys'],
	Succession: ['succession'],
	Euphoria: ['euphoria'],
	Yellowstone: ['yellowstone'],
	'Squid Game': ['squid-game'],
	'Money Heist': ['lacasadepapel'],
	'La Casa de Papel': ['lacasadepapel'],
	'Cobra Kai': ['cobrakai'],
	'Ozark': ['ozark'],
	'Bridgerton': ['bridgerton'],
	'The Crown': ['the-crown'],
	'Black Mirror': ['blackmirror'],
	'Downton Abbey': ['downtonabbey'],
	'Vikings': ['vikings'],
	'The Expanse': ['expanse'],
	'Lucifer': ['lucifer'],
	'Brooklyn Nine-Nine': ['brooklyn-nine-nine'],
	'Parks and Recreation': ['parksandrecreation'],
	'Schitt\'s Creek': ['schittscreek'],
	'The Good Place': ['thegoodplace'],
	'Community': ['community-sitcom'],
	'It\'s Always Sunny in Philadelphia': ['itsalwayssunny'],
	'Arrested Development': ['arresteddevelopment'],
	'Curb Your Enthusiasm': ['curbyourenthusiasm'],
	'Seinfeld': ['seinfeld'],
	'Frasier': ['frasier'],
	'Cheers': ['cheers'],
	'M*A*S*H': ['mash'],
	'The Wire': ['thewire'],
	'The Sopranos': ['sopranos'],
	'Mad Men': ['madmen'],
	'Boardwalk Empire': ['boardwalkempire'],
	'Homeland': ['homeland'],
	'24': ['24'],
	'Prison Break': ['prisonbreak'],
	'Heroes': ['heroeswiki'],
	'Fringe': ['fringe'],
	'The X-Files': ['x-files'],
	'Buffy the Vampire Slayer': ['buffy'],
	'Angel': ['buffy', 'angel'],
	'Firefly': ['firefly'],
	'Battlestar Galactica': ['battlestar-wiki', 'battlestargalactica'],
	'Stargate': ['stargate'],
	'Babylon 5': ['babylon5'],
	'Twin Peaks': ['twinpeaks'],
	'The Twilight Zone': ['twilightzone'],
	'American Horror Story': ['americanhorrorstory'],
	'Hannibal': ['hannibal'],
	'Penny Dreadful': ['pennydreadful'],
	'The Haunting': ['thehaunting'],
	'Bates Motel': ['batesmotel'],
	'Mr. Robot': ['mrrobot'],
	'Severance': ['severance-tv'],
	'The Last of Us': ['thelastofus'],
	'Andor': ['starwars'],
	'House': ['house'],
	'Grey\'s Anatomy': ['greysanatomy'],
	'ER': ['er'],
	'Scrubs': ['scrubs'],
	'The Good Doctor': ['thegooddoctor'],
	'Chicago Fire': ['chicagofire'],
	'Law & Order': ['lawandorder'],
	'NCIS': ['ncis'],
	'Criminal Minds': ['criminalminds'],
	'CSI': ['csi'],
	'Bones': ['bones'],
	'Castle': ['castle'],
	'Psych': ['psych'],
	'Monk': ['monk'],
	'White Collar': ['whitecollar'],
	'Suits': ['suits'],
	'The Blacklist': ['theblacklist'],
	'Person of Interest': ['personofinterest'],
	'Elementary': ['elementary'],
	'Mindhunter': ['mindhunter']
};

/**
 * Generate wiki name variations from a show title
 */
export function generateWikiVariations(title: string): string[] {
	const variations: string[] = [];
	const normalized = title.toLowerCase();

	// Check known mappings first
	for (const [showTitle, wikis] of Object.entries(TV_SHOW_WIKI_MAPPINGS)) {
		if (showTitle.toLowerCase() === normalized) {
			variations.push(...wikis);
		}
	}

	// Generate common variations
	const cleaned = normalized.replace(/[^a-z0-9\s]/g, '');
	variations.push(cleaned.replace(/\s+/g, '')); // nospaces
	variations.push(cleaned.replace(/\s+/g, '-')); // dashes
	variations.push(cleaned.replace(/\s+/g, '_')); // underscores

	// First word only
	const firstWord = cleaned.split(/\s+/)[0];
	if (firstWord && firstWord.length > 3) {
		variations.push(firstWord);
	}

	// Remove "The" prefix
	if (cleaned.startsWith('the ')) {
		const withoutThe = cleaned.slice(4);
		variations.push(withoutThe.replace(/\s+/g, ''));
		variations.push(withoutThe.replace(/\s+/g, '-'));
	}

	// Remove duplicates
	return [...new Set(variations)];
}

/**
 * Check if a Fandom wiki exists
 */
export async function checkWikiExists(wikiName: string): Promise<FandomWiki | null> {
	try {
		const url = `https://${wikiName}.fandom.com/api.php?action=query&meta=siteinfo&siprop=general|statistics&format=json&origin=*`;
		const response = await fetch(url);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		if (!data.query?.general) {
			return null;
		}

		const general = data.query.general;
		const stats = data.query.statistics;

		return {
			id: general.wikiid || 0,
			name: wikiName,
			title: general.sitename || wikiName,
			url: `https://${wikiName}.fandom.com`,
			hub: 'Entertainment',
			language: general.lang || 'en',
			description: general.tagline || '',
			image: general.logo,
			stats: stats
				? {
						articles: stats.articles || 0,
						pages: stats.pages || 0,
						images: stats.images || 0,
						users: stats.users || 0,
						activeUsers: stats.activeusers || 0,
						admins: stats.admins || 0
					}
				: undefined
		};
	} catch {
		return null;
	}
}

/**
 * Search for wikis matching a TV show title
 */
export async function searchWikis(query: string, limit: number = 10): Promise<FandomWiki[]> {
	const variations = generateWikiVariations(query);
	const wikis: FandomWiki[] = [];
	const checkedNames = new Set<string>();

	// Check all variations in parallel
	const checks = variations.slice(0, limit).map(async (variation) => {
		if (checkedNames.has(variation)) return null;
		checkedNames.add(variation);
		return checkWikiExists(variation);
	});

	const results = await Promise.all(checks);
	for (const wiki of results) {
		if (wiki) {
			wikis.push(wiki);
		}
	}

	return wikis;
}

/**
 * Search articles within a wiki
 */
export async function searchArticles(
	wikiName: string,
	query: string,
	limit: number = 20
): Promise<FandomArticle[]> {
	try {
		const url = `https://${wikiName}.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&srprop=snippet&format=json&origin=*`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to search articles: ${response.status}`);
		}

		const data = await response.json();
		const searchResults = data.query?.search || [];

		return searchResults.map(
			(result: { pageid: number; title: string; snippet?: string; ns: number }) => ({
				id: result.pageid,
				title: result.title,
				url: `https://${wikiName}.fandom.com/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
				ns: result.ns || 0,
				snippet: result.snippet
			})
		);
	} catch (error) {
		console.error('[fandom.service] searchArticles error:', error);
		return [];
	}
}

/**
 * Get article sections (table of contents)
 */
export async function getArticleSections(
	wikiName: string,
	title: string
): Promise<FandomArticleSection[]> {
	try {
		const url = `https://${wikiName}.fandom.com/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to get article sections: ${response.status}`);
		}

		const data = await response.json();
		const sections = data.parse?.sections || [];

		return sections.map(
			(section: {
				index: string;
				toclevel: number;
				level: string;
				line: string;
				number: string;
				anchor: string;
			}) => ({
				index: section.index,
				toclevel: section.toclevel,
				level: section.level,
				line: section.line,
				number: section.number,
				anchor: section.anchor
			})
		);
	} catch (error) {
		console.error('[fandom.service] getArticleSections error:', error);
		return [];
	}
}

/**
 * Get article content (optionally for a specific section)
 */
export async function getArticleContent(
	wikiName: string,
	title: string,
	sectionIndex?: string
): Promise<string | null> {
	try {
		let url = `https://${wikiName}.fandom.com/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`;
		if (sectionIndex !== undefined) {
			url += `&section=${sectionIndex}`;
		}

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to get article content: ${response.status}`);
		}

		const data = await response.json();
		return data.parse?.text?.['*'] || null;
	} catch (error) {
		console.error('[fandom.service] getArticleContent error:', error);
		return null;
	}
}

/**
 * Get wiki categories
 */
export async function getCategories(
	wikiName: string,
	limit: number = 50
): Promise<FandomCategory[]> {
	try {
		const url = `https://${wikiName}.fandom.com/api.php?action=query&list=allcategories&aclimit=${limit}&acprop=size&format=json&origin=*`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to get categories: ${response.status}`);
		}

		const data = await response.json();
		const categories = data.query?.allcategories || [];

		return categories.map(
			(cat: { '*': string; size?: number; pages?: number; files?: number; subcats?: number }) => ({
				title: `Category:${cat['*']}`,
				size: cat.size,
				pages: cat.pages,
				files: cat.files,
				subcats: cat.subcats
			})
		);
	} catch (error) {
		console.error('[fandom.service] getCategories error:', error);
		return [];
	}
}

/**
 * Get category members (articles in a category)
 */
export async function getCategoryMembers(
	wikiName: string,
	categoryTitle: string,
	limit: number = 50
): Promise<FandomArticle[]> {
	try {
		const cleanTitle = categoryTitle.replace(/^Category:/, '');
		const url = `https://${wikiName}.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(cleanTitle)}&cmlimit=${limit}&cmprop=ids|title&format=json&origin=*`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to get category members: ${response.status}`);
		}

		const data = await response.json();
		const members = data.query?.categorymembers || [];

		return members.map((member: { pageid: number; title: string; ns: number }) => ({
			id: member.pageid,
			title: member.title,
			url: `https://${wikiName}.fandom.com/wiki/${encodeURIComponent(member.title.replace(/ /g, '_'))}`,
			ns: member.ns || 0
		}));
	} catch (error) {
		console.error('[fandom.service] getCategoryMembers error:', error);
		return [];
	}
}

/**
 * Check if a section title suggests trivia content
 */
export function isTriviaSection(sectionTitle: string): boolean {
	const triviaKeywords = [
		'trivia',
		'fun fact',
		'behind the scenes',
		'notes',
		'goofs',
		'mistakes',
		'continuity',
		'easter egg',
		'reference',
		'allusion',
		'cultural reference',
		'production notes',
		'did you know'
	];

	const lowerTitle = sectionTitle.toLowerCase();
	return triviaKeywords.some((keyword) => lowerTitle.includes(keyword));
}
