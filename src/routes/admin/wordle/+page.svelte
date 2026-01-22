<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Word list - common 5-letter words
	const WORD_LIST = [
		'about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt', 'adult', 'after', 'again',
		'agent', 'agree', 'ahead', 'alarm', 'album', 'alert', 'alien', 'align', 'alike', 'alive',
		'allow', 'alone', 'along', 'alter', 'among', 'angel', 'anger', 'angle', 'angry', 'apart',
		'apple', 'apply', 'arena', 'argue', 'arise', 'armor', 'army', 'array', 'aside', 'asset',
		'avoid', 'award', 'aware', 'awful', 'bacon', 'badge', 'badly', 'baker', 'bases', 'basic',
		'basis', 'beach', 'beast', 'began', 'begin', 'being', 'belly', 'bench', 'berry', 'birth',
		'black', 'blade', 'blame', 'blank', 'blast', 'blaze', 'bleed', 'blend', 'bless', 'blind',
		'block', 'blood', 'bloom', 'blown', 'board', 'boost', 'booth', 'bound', 'brain', 'brand',
		'brass', 'brave', 'bread', 'break', 'breed', 'brick', 'bride', 'brief', 'bring', 'broad',
		'broke', 'brook', 'brown', 'brush', 'build', 'built', 'bunch', 'burst', 'buyer', 'cabin',
		'cable', 'camel', 'candy', 'cargo', 'carry', 'carve', 'catch', 'cause', 'cease', 'chain',
		'chair', 'chalk', 'champ', 'chant', 'chaos', 'charm', 'chart', 'chase', 'cheap', 'check',
		'cheek', 'cheer', 'chess', 'chest', 'chick', 'chief', 'child', 'chill', 'china', 'chips',
		'chord', 'chose', 'chunk', 'civil', 'claim', 'clamp', 'clash', 'class', 'clean', 'clear',
		'clerk', 'click', 'cliff', 'climb', 'cling', 'clock', 'close', 'cloth', 'cloud', 'coach',
		'coast', 'color', 'couch', 'cough', 'could', 'count', 'court', 'cover', 'crack', 'craft',
		'crane', 'crash', 'crawl', 'crazy', 'cream', 'creek', 'creep', 'crest', 'crime', 'crisp',
		'cross', 'crowd', 'crown', 'cruel', 'crush', 'curve', 'cycle', 'daily', 'dairy', 'dance',
		'death', 'debut', 'decay', 'delay', 'demon', 'dense', 'depot', 'depth', 'devil', 'diary',
		'dirty', 'disco', 'ditch', 'diver', 'dodge', 'doing', 'doubt', 'dough', 'draft', 'drain',
		'drama', 'drank', 'drawl', 'drawn', 'dread', 'dream', 'dress', 'dried', 'drift', 'drill',
		'drink', 'drive', 'droit', 'drown', 'drunk', 'dryer', 'dwarf', 'dwell', 'dying', 'eager',
		'eagle', 'early', 'earth', 'eight', 'elder', 'elect', 'elite', 'embed', 'empty', 'enemy',
		'enjoy', 'enter', 'entry', 'equal', 'equip', 'erase', 'error', 'essay', 'ethic', 'evade',
		'event', 'every', 'exact', 'exert', 'exile', 'exist', 'extra', 'fable', 'facet', 'facto',
		'faint', 'fairy', 'faith', 'false', 'fancy', 'farce', 'fatal', 'fault', 'favor', 'feast',
		'fence', 'ferry', 'fetch', 'fever', 'fiber', 'field', 'fiery', 'fifth', 'fifty', 'fight',
		'final', 'first', 'fixed', 'flame', 'flash', 'flask', 'fleet', 'flesh', 'flick', 'float',
		'flock', 'flood', 'floor', 'flora', 'flour', 'fluid', 'flush', 'focal', 'focus', 'force',
		'forge', 'forth', 'forty', 'forum', 'found', 'frame', 'frank', 'fraud', 'freak', 'fresh',
		'fried', 'front', 'frost', 'fruit', 'fully', 'funny', 'ghost', 'giant', 'given', 'gives',
		'gland', 'glass', 'gleam', 'glide', 'globe', 'gloom', 'glory', 'glove', 'grace', 'grade',
		'grain', 'grand', 'grant', 'grape', 'graph', 'grasp', 'grass', 'grave', 'greed', 'greek',
		'green', 'greet', 'grief', 'grill', 'grind', 'groan', 'groom', 'gross', 'group', 'grove',
		'growl', 'grown', 'guard', 'guess', 'guest', 'guide', 'guild', 'guilt', 'guise', 'habit',
		'hairy', 'happy', 'harsh', 'haste', 'haven', 'heart', 'heavy', 'hedge', 'heist', 'hello',
		'hence', 'herbs', 'hinge', 'hobby', 'holds', 'honey', 'honor', 'horse', 'hotel', 'hound',
		'house', 'human', 'humid', 'humor', 'hurry', 'hydro', 'ideal', 'image', 'imply', 'index',
		'inner', 'input', 'irony', 'issue', 'ivory', 'jelly', 'jewel', 'joint', 'joker', 'jolly',
		'judge', 'juice', 'juicy', 'jumbo', 'jumps', 'kebab', 'keeps', 'kicks', 'kills', 'kinda',
		'kings', 'knife', 'knock', 'known', 'label', 'labor', 'lacks', 'lager', 'lance', 'lands',
		'large', 'laser', 'latch', 'later', 'laugh', 'layer', 'leads', 'learn', 'lease', 'least',
		'leave', 'ledge', 'legal', 'lemon', 'level', 'lever', 'light', 'limit', 'lined', 'linen',
		'liner', 'links', 'lions', 'lists', 'lived', 'lively', 'liver', 'lives', 'loads', 'loans',
		'lobby', 'local', 'lodge', 'logic', 'login', 'loner', 'loose', 'lorry', 'loser', 'loved',
		'lover', 'lower', 'loyal', 'lucky', 'lunar', 'lunch', 'lying', 'lyric', 'macro', 'magic',
		'magma', 'major', 'maker', 'manga', 'mango', 'manor', 'maple', 'march', 'marry', 'marsh',
		'match', 'maybe', 'mayor', 'meals', 'means', 'meant', 'medal', 'media', 'melon', 'mercy',
		'merge', 'merit', 'merry', 'messy', 'metal', 'meter', 'micro', 'might', 'miner', 'minor',
		'minus', 'mixed', 'mixer', 'model', 'modem', 'moist', 'money', 'month', 'moral', 'motel',
		'motor', 'motto', 'mould', 'mount', 'mouse', 'mouth', 'moved', 'mover', 'movie', 'muddy',
		'multi', 'mummy', 'mural', 'music', 'myths', 'naive', 'naked', 'named', 'names', 'nanny',
		'nasty', 'naval', 'nerve', 'never', 'newly', 'night', 'ninja', 'ninth', 'noble', 'noise',
		'noisy', 'north', 'notch', 'noted', 'notes', 'novel', 'nurse', 'nylon', 'occur', 'ocean',
		'offer', 'often', 'olive', 'omega', 'onion', 'onset', 'opens', 'opera', 'orbit', 'order',
		'organ', 'other', 'ought', 'outer', 'owned', 'owner', 'oxide', 'ozone', 'padre', 'pagan',
		'pages', 'paint', 'pairs', 'panel', 'panic', 'paper', 'party', 'pasta', 'paste', 'patch',
		'paths', 'patio', 'pause', 'peace', 'peach', 'pearl', 'penny', 'perch', 'peril', 'petty',
		'phase', 'phone', 'photo', 'piano', 'picks', 'piece', 'pilot', 'pinch', 'pitch', 'pixel',
		'pizza', 'place', 'plain', 'plane', 'plank', 'plant', 'plate', 'plaza', 'plead', 'pleat',
		'plots', 'pluck', 'plumb', 'plume', 'plump', 'plunge', 'point', 'poker', 'polar', 'polls',
		'polyp', 'pound', 'power', 'press', 'price', 'pride', 'prime', 'print', 'prior', 'prize',
		'probe', 'prone', 'proof', 'prose', 'proud', 'prove', 'proxy', 'pulse', 'punch', 'pupil',
		'puppy', 'purse', 'queen', 'query', 'quest', 'queue', 'quick', 'quiet', 'quilt', 'quirk',
		'quite', 'quota', 'quote', 'rabbi', 'radar', 'radio', 'rails', 'rainy', 'raise', 'rally',
		'ranch', 'range', 'rapid', 'ratio', 'reach', 'react', 'reads', 'ready', 'realm', 'rebel',
		'recap', 'refer', 'reign', 'relax', 'relay', 'renal', 'renew', 'reply', 'reset', 'resin',
		'rider', 'ridge', 'rifle', 'right', 'rigid', 'rings', 'risen', 'risky', 'ritual', 'rival',
		'river', 'roads', 'roast', 'robot', 'rocky', 'rogue', 'roman', 'rooms', 'roots', 'roses',
		'rough', 'round', 'route', 'royal', 'rugby', 'ruins', 'ruled', 'ruler', 'rural', 'sadly',
		'safer', 'saint', 'salad', 'sales', 'salon', 'sandy', 'sauce', 'saved', 'scale', 'scam',
		'scare', 'scene', 'scent', 'scope', 'score', 'scout', 'scrap', 'screw', 'seals', 'seats',
		'seeks', 'seems', 'seize', 'sense', 'serve', 'setup', 'seven', 'shade', 'shaft', 'shake',
		'shall', 'shame', 'shape', 'share', 'shark', 'sharp', 'shave', 'sheep', 'sheer', 'sheet',
		'shelf', 'shell', 'shift', 'shine', 'shirt', 'shock', 'shoot', 'shore', 'short', 'shout',
		'shown', 'shows', 'sided', 'sides', 'siege', 'sight', 'sigma', 'signs', 'silly', 'since',
		'sixth', 'sixty', 'sized', 'sizes', 'skill', 'skull', 'slabs', 'slang', 'slash', 'slate',
		'slave', 'sleek', 'sleep', 'slept', 'slice', 'slide', 'slope', 'slots', 'small', 'smart',
		'smell', 'smile', 'smoke', 'snake', 'snaps', 'sneak', 'sniff', 'solar', 'solid', 'solve',
		'sorry', 'sound', 'south', 'space', 'spare', 'spark', 'spawn', 'speak', 'speed', 'spell',
		'spend', 'spent', 'spice', 'spicy', 'spike', 'spill', 'spine', 'spoil', 'spoke', 'spoon',
		'sport', 'spots', 'spray', 'squad', 'stack', 'staff', 'stage', 'stain', 'stair', 'stake',
		'stall', 'stamp', 'stand', 'stark', 'start', 'state', 'stays', 'steak', 'steal', 'steam',
		'steel', 'steep', 'steer', 'stems', 'steps', 'stick', 'stiff', 'still', 'sting', 'stock',
		'stoic', 'stole', 'stone', 'stood', 'stool', 'store', 'storm', 'story', 'stove', 'strap',
		'straw', 'stray', 'strip', 'stuck', 'study', 'stuff', 'style', 'suave', 'sucks', 'sugar',
		'suite', 'sunny', 'super', 'surge', 'sushi', 'swamp', 'swaps', 'swarm', 'swear', 'sweat',
		'sweep', 'sweet', 'swept', 'swift', 'swing', 'swiss', 'sword', 'swore', 'sworn', 'table',
		'tacit', 'taken', 'takes', 'tales', 'talks', 'tanks', 'tapes', 'tardy', 'tasks', 'taste',
		'tasty', 'taxes', 'teach', 'teams', 'tears', 'teens', 'teeth', 'tempo', 'tense', 'tenth',
		'terms', 'tests', 'texas', 'texts', 'thank', 'theft', 'their', 'theme', 'there', 'these',
		'thick', 'thief', 'thigh', 'thing', 'think', 'third', 'those', 'three', 'threw', 'throw',
		'thumb', 'tiger', 'tight', 'tiles', 'timer', 'times', 'timid', 'tired', 'title', 'toast',
		'today', 'token', 'tonic', 'tools', 'tooth', 'topic', 'torch', 'total', 'touch', 'tough',
		'towel', 'tower', 'towns', 'toxic', 'trace', 'track', 'trade', 'trail', 'train', 'trait',
		'trans', 'traps', 'trash', 'treat', 'trees', 'trend', 'trial', 'tribe', 'trick', 'tried',
		'tries', 'trips', 'troop', 'truck', 'truly', 'trump', 'trunk', 'trust', 'truth', 'tubes',
		'tulip', 'tumor', 'tuned', 'tuner', 'tunes', 'turbo', 'turns', 'tutor', 'tweak', 'twice',
		'twins', 'twist', 'ultra', 'uncle', 'under', 'unify', 'union', 'unite', 'unity', 'until',
		'upper', 'upset', 'urban', 'usage', 'users', 'usual', 'utter', 'vague', 'valid', 'value',
		'valve', 'vault', 'vegan', 'vegas', 'venom', 'venue', 'verge', 'verse', 'video', 'views',
		'vigil', 'vinyl', 'viral', 'virus', 'visit', 'vista', 'vital', 'vivid', 'vocal', 'vogue',
		'voice', 'voter', 'votes', 'wages', 'wagon', 'waist', 'walks', 'walls', 'wanna', 'wants',
		'waste', 'watch', 'water', 'waves', 'weary', 'weave', 'wedge', 'weeds', 'weeks', 'weigh',
		'weird', 'wells', 'welsh', 'whale', 'wheat', 'wheel', 'where', 'which', 'while', 'whine',
		'white', 'whole', 'whose', 'widen', 'wider', 'widow', 'width', 'wills', 'winds', 'wines',
		'wings', 'wiper', 'wired', 'wires', 'witch', 'wives', 'woken', 'woman', 'women', 'woods',
		'words', 'works', 'world', 'worms', 'worry', 'worse', 'worst', 'worth', 'would', 'wound',
		'wrath', 'wreck', 'wrist', 'write', 'wrong', 'wrote', 'yacht', 'yards', 'years', 'yeast',
		'yield', 'young', 'yours', 'youth', 'zebra', 'zones'
	];

	// Game configuration
	const WORD_LENGTH = 5;
	const MAX_GUESSES = 6;

	// Letter status types
	type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

	interface LetterTile {
		letter: string;
		status: LetterStatus;
	}

	// Game state
	let targetWord = $state('');
	let currentGuess = $state('');
	let guesses = $state<LetterTile[][]>([]);
	let currentRow = $state(0);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let isInvalidWord = $state(false);
	let invalidWordTimeout: ReturnType<typeof setTimeout> | null = null;

	// Keyboard state
	let keyboardStatus = $state<Record<string, LetterStatus>>({});

	// Debug logs
	let debugLogs = $state<string[]>([]);

	function addLog(message: string) {
		debugLogs = [...debugLogs, `[${new Date().toLocaleTimeString()}] ${message}`];
	}

	// Statistics
	let gamesPlayed = $state(0);
	let gamesWon = $state(0);
	let currentStreak = $state(0);
	let maxStreak = $state(0);
	let guessDistribution = $state<number[]>([0, 0, 0, 0, 0, 0]);

	// Keyboard layout
	const KEYBOARD_ROWS = [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace']
	];

	onMount(() => {
		if (!browser) return;
		loadStats();
		startNewGame();
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('keydown', handleKeyDown);
		if (invalidWordTimeout) {
			clearTimeout(invalidWordTimeout);
		}
	});

	function loadStats() {
		if (!browser) return;
		const saved = localStorage.getItem('wordle-stats');
		if (saved) {
			const stats = JSON.parse(saved);
			gamesPlayed = stats.gamesPlayed || 0;
			gamesWon = stats.gamesWon || 0;
			currentStreak = stats.currentStreak || 0;
			maxStreak = stats.maxStreak || 0;
			guessDistribution = stats.guessDistribution || [0, 0, 0, 0, 0, 0];
		}
	}

	function saveStats() {
		if (!browser) return;
		localStorage.setItem(
			'wordle-stats',
			JSON.stringify({
				gamesPlayed,
				gamesWon,
				currentStreak,
				maxStreak,
				guessDistribution
			})
		);
	}

	function startNewGame() {
		// Pick a random word
		targetWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)].toUpperCase();

		// Reset game state
		currentGuess = '';
		currentRow = 0;
		gameOver = false;
		gameWon = false;
		isInvalidWord = false;
		keyboardStatus = {};
		debugLogs = [];

		// Initialize empty board
		const newGuesses: LetterTile[][] = [];
		for (let i = 0; i < MAX_GUESSES; i++) {
			const row: LetterTile[] = [];
			for (let j = 0; j < WORD_LENGTH; j++) {
				row.push({ letter: '', status: 'empty' });
			}
			newGuesses.push(row);
		}
		guesses = newGuesses;

		addLog(`New game started. Target word: ${targetWord}`);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (gameOver) return;

		const key = e.key.toLowerCase();

		if (key === 'enter') {
			e.preventDefault();
			submitGuess();
		} else if (key === 'backspace') {
			e.preventDefault();
			deleteLetter();
		} else if (/^[a-z]$/.test(key)) {
			e.preventDefault();
			addLetter(key.toUpperCase());
		}
	}

	function handleVirtualKeyClick(key: string) {
		if (gameOver) return;

		if (key === 'enter') {
			submitGuess();
		} else if (key === 'backspace') {
			deleteLetter();
		} else {
			addLetter(key.toUpperCase());
		}
	}

	function addLetter(letter: string) {
		if (currentGuess.length >= WORD_LENGTH) return;

		currentGuess += letter;
		const newRow = [...guesses[currentRow]];
		newRow[currentGuess.length - 1] = { ...newRow[currentGuess.length - 1], letter };
		guesses = guesses.map((row, i) => (i === currentRow ? newRow : row));
		addLog(`Added letter: ${letter}, currentGuess: ${currentGuess}, row: ${currentRow}`);
	}

	function deleteLetter() {
		if (currentGuess.length === 0) return;

		const newRow = [...guesses[currentRow]];
		newRow[currentGuess.length - 1] = { ...newRow[currentGuess.length - 1], letter: '' };
		guesses = guesses.map((row, i) => (i === currentRow ? newRow : row));
		currentGuess = currentGuess.slice(0, -1);
	}

	function submitGuess() {
		addLog(`submitGuess called. currentGuess: ${currentGuess}, length: ${currentGuess.length}`);

		if (currentGuess.length !== WORD_LENGTH) {
			addLog(`Rejected: guess length ${currentGuess.length} !== ${WORD_LENGTH}`);
			return;
		}

		// Check if word is valid
		if (!WORD_LIST.includes(currentGuess.toLowerCase())) {
			addLog(`Invalid word: ${currentGuess}`);
			isInvalidWord = true;
			if (invalidWordTimeout) clearTimeout(invalidWordTimeout);
			invalidWordTimeout = setTimeout(() => {
				isInvalidWord = false;
			}, 600);
			return;
		}

		addLog(`Valid word: ${currentGuess}, comparing to target: ${targetWord}`);

		// Evaluate the guess
		const result = evaluateGuess(currentGuess);
		addLog(`Evaluation result: ${JSON.stringify(result)}`);

		// Update the row with results
		const newRow = guesses[currentRow].map((tile, i) => ({
			...tile,
			status: result[i]
		}));
		addLog(`New row statuses: ${JSON.stringify(newRow.map(t => t.status))}`);

		// Update keyboard status
		const newKeyboardStatus = { ...keyboardStatus };
		for (let i = 0; i < WORD_LENGTH; i++) {
			const letter = currentGuess[i].toLowerCase();
			const currentKeyStatus = newKeyboardStatus[letter];
			const newStatus = result[i];

			// Only upgrade status: absent -> present -> correct
			if (
				!currentKeyStatus ||
				newStatus === 'correct' ||
				(newStatus === 'present' && currentKeyStatus === 'absent')
			) {
				newKeyboardStatus[letter] = newStatus;
			}
		}

		guesses = guesses.map((row, i) => (i === currentRow ? newRow : row));
		keyboardStatus = newKeyboardStatus;

		addLog(`After update - currentRow: ${currentRow}, guesses[${currentRow}] statuses: ${JSON.stringify(guesses[currentRow].map(t => t.status))}`);

		// Check for win
		if (currentGuess === targetWord) {
			addLog(`WIN! Word was: ${targetWord}`);
			gameWon = true;
			gameOver = true;
			gamesPlayed++;
			gamesWon++;
			currentStreak++;
			if (currentStreak > maxStreak) maxStreak = currentStreak;
			guessDistribution = guessDistribution.map((count, i) => (i === currentRow ? count + 1 : count));
			saveStats();
			return;
		}

		// Move to next row
		currentRow++;
		addLog(`Moving to row ${currentRow}`);
		currentGuess = '';

		// Check for loss
		if (currentRow >= MAX_GUESSES) {
			gameOver = true;
			gamesPlayed++;
			currentStreak = 0;
			saveStats();
		}
	}

	function evaluateGuess(guess: string): LetterStatus[] {
		const result: LetterStatus[] = new Array(WORD_LENGTH).fill('absent');
		const targetLetters = targetWord.split('');
		const guessLetters = guess.split('');
		const used = new Array(WORD_LENGTH).fill(false);

		// First pass: mark correct letters
		for (let i = 0; i < WORD_LENGTH; i++) {
			if (guessLetters[i] === targetLetters[i]) {
				result[i] = 'correct';
				used[i] = true;
			}
		}

		// Second pass: mark present letters
		for (let i = 0; i < WORD_LENGTH; i++) {
			if (result[i] === 'correct') continue;

			for (let j = 0; j < WORD_LENGTH; j++) {
				if (!used[j] && guessLetters[i] === targetLetters[j]) {
					result[i] = 'present';
					used[j] = true;
					break;
				}
			}
		}

		return result;
	}

	function getTileClasses(tile: LetterTile, rowIndex: number, tileIndex: number): string {
		const isCurrentRow = rowIndex === currentRow;
		const hasLetter = tile.letter !== '';
		const isRevealed = rowIndex < currentRow || gameOver;

		return classNames(
			'w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl font-bold uppercase border-2 transition-all duration-300',
			{
				// Empty state
				'border-base-content/20 bg-base-100': !hasLetter && tile.status === 'empty',
				// Has letter but not evaluated
				'border-base-content/50 bg-base-100':
					hasLetter && tile.status === 'empty' && !isRevealed,
				// Correct (green)
				'border-success bg-success text-success-content': tile.status === 'correct' && isRevealed,
				// Present (yellow)
				'border-warning bg-warning text-warning-content': tile.status === 'present' && isRevealed,
				// Absent (gray)
				'border-neutral bg-neutral text-neutral-content': tile.status === 'absent' && isRevealed,
				// Invalid word shake
				'animate-shake': isCurrentRow && isInvalidWord
			}
		);
	}

	function getKeyClasses(key: string): string {
		const status = keyboardStatus[key];

		return classNames(
			'h-14 flex items-center justify-center font-semibold uppercase rounded-md transition-colors cursor-pointer select-none',
			{
				// Size based on key
				'min-w-[2.5rem] sm:min-w-[2.75rem] text-sm sm:text-base': key.length === 1,
				'min-w-[4rem] sm:min-w-[4.5rem] text-xs sm:text-sm': key === 'enter' || key === 'backspace',
				// Status colors
				'bg-base-300 hover:bg-base-content/30 text-base-content': !status,
				'bg-success text-success-content hover:bg-success/80': status === 'correct',
				'bg-warning text-warning-content hover:bg-warning/80': status === 'present',
				'bg-neutral text-neutral-content/50 hover:bg-neutral/80': status === 'absent'
			}
		);
	}

	function getWinPercentage(): number {
		if (gamesPlayed === 0) return 0;
		return Math.round((gamesWon / gamesPlayed) * 100);
	}

	function getMaxDistribution(): number {
		return Math.max(...guessDistribution, 1);
	}

	// Check if a word shares at least one letter with the target
	function hasCommonLetter(word: string): boolean {
		const targetLetters = new Set(targetWord.toLowerCase().split(''));
		return word.toLowerCase().split('').some((letter) => targetLetters.has(letter));
	}

	// Get all letters known to be absent (not in the word)
	function getAbsentLetters(): Set<string> {
		const absent = new Set<string>();
		for (const [letter, status] of Object.entries(keyboardStatus)) {
			if (status === 'absent') {
				absent.add(letter.toLowerCase());
			}
		}
		return absent;
	}

	// Check if a word contains any absent letters
	function containsAbsentLetter(word: string, absentLetters: Set<string>): boolean {
		return word.toLowerCase().split('').some((letter) => absentLetters.has(letter));
	}

	// Get all submitted words
	function getSubmittedWords(): Set<string> {
		const submitted = new Set<string>();
		for (let i = 0; i < currentRow; i++) {
			const word = guesses[i].map((t) => t.letter).join('');
			if (word.length === WORD_LENGTH) {
				submitted.add(word.toLowerCase());
			}
		}
		return submitted;
	}

	// Get filtered word list (words that share at least one letter with target and don't contain absent letters)
	function getFilteredWordList(): string[] {
		const absentLetters = getAbsentLetters();
		const submittedWords = getSubmittedWords();
		return WORD_LIST.filter(
			(w) =>
				w.toUpperCase() !== targetWord &&
				hasCommonLetter(w) &&
				!containsAbsentLetter(w, absentLetters) &&
				!submittedWords.has(w.toLowerCase())
		);
	}
</script>

<svelte:head>
	<style>
		@keyframes shake {
			0%,
			100% {
				transform: translateX(0);
			}
			25% {
				transform: translateX(-5px);
			}
			75% {
				transform: translateX(5px);
			}
		}
		.animate-shake {
			animation: shake 0.15s ease-in-out 2;
		}
	</style>
</svelte:head>

<div class="flex min-h-screen flex-col bg-base-300 p-4 sm:p-6">
	<div class="mx-auto flex w-full max-w-4xl gap-4">
		<!-- Word List Panel -->
		<div class="card hidden w-72 flex-shrink-0 bg-base-100 shadow-xl lg:block">
			<div class="card-body p-4">
				<h3 class="card-title text-sm">Similar Words ({getFilteredWordList().length})</h3>
				<p class="text-xs text-base-content/50 mb-2">Words sharing letters with target</p>
				<div class="h-[500px] overflow-y-auto">
					<div class="flex flex-wrap gap-2">
						{#each getFilteredWordList() as word}
							<button
								class="flex cursor-pointer rounded border border-base-300 px-1 py-0.5 font-mono text-base font-bold hover:border-primary hover:bg-base-200"
								onclick={() => {
									// Auto-fill the word
									currentGuess = '';
									const newGuesses = guesses.map((row, i) => {
										if (i === currentRow) {
											return row.map((tile, j) => ({
												...tile,
												letter: word[j]?.toUpperCase() || ''
											}));
										}
										return row;
									});
									guesses = newGuesses;
									currentGuess = word.toUpperCase();
									addLog(`Clicked word: ${word.toUpperCase()}`);
								}}
							>
								{#each word.split('') as letter, idx}
									{@const upperLetter = letter.toUpperCase()}
									{@const targetUpper = targetWord.toUpperCase()}
									{@const isCorrect = targetUpper[idx] === upperLetter}
									{@const isPresent = !isCorrect && targetUpper.includes(upperLetter)}
									{@const isKnown = Object.keys(keyboardStatus).length > 0}
									<span
										class={classNames('w-5 text-center', {
											'text-success': isKnown && isCorrect,
											'text-warning': isKnown && isPresent,
											'text-base-content': !isKnown || (!isCorrect && !isPresent)
										})}
									>
										{upperLetter}
									</span>
								{/each}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Main Game Area -->
		<div class="flex flex-1 flex-col gap-4">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-bold text-base-content sm:text-3xl">Wordle</h1>
				<button onclick={startNewGame} class="btn btn-ghost btn-sm">New Game</button>
			</div>

			<!-- Game Board -->
			<div class="flex flex-col items-center gap-1.5">
				{#each guesses as row, rowIndex}
					<div class="flex gap-1.5">
						{#each row as tile, tileIndex}
							<div class={getTileClasses(tile, rowIndex, tileIndex)}>
								{tile.letter}
							</div>
						{/each}
					</div>
				{/each}
			</div>

		<!-- Game Over Message -->
			{#if gameOver}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body items-center p-4 text-center">
						{#if gameWon}
							<h2 class="card-title text-success">Congratulations!</h2>
							<p class="text-base-content/70">
								You got it in {currentRow + 1} {currentRow === 0 ? 'guess' : 'guesses'}!
							</p>
						{:else}
							<h2 class="card-title text-error">Game Over</h2>
							<p class="text-base-content/70">
								The word was: <span class="font-bold text-primary">{targetWord}</span>
							</p>
						{/if}

						<!-- Statistics -->
						<div class="mt-4 w-full">
							<h3 class="mb-2 text-lg font-semibold">Statistics</h3>
							<div class="flex justify-around">
								<div class="text-center">
									<div class="text-2xl font-bold">{gamesPlayed}</div>
									<div class="text-xs text-base-content/50">Played</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold">{getWinPercentage()}</div>
									<div class="text-xs text-base-content/50">Win %</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold">{currentStreak}</div>
									<div class="text-xs text-base-content/50">Streak</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold">{maxStreak}</div>
									<div class="text-xs text-base-content/50">Max Streak</div>
								</div>
							</div>

							<!-- Guess Distribution -->
							<div class="mt-4">
								<h4 class="mb-2 text-sm font-semibold">Guess Distribution</h4>
								<div class="flex flex-col gap-1">
									{#each guessDistribution as count, index}
										<div class="flex items-center gap-2">
											<span class="w-4 text-sm">{index + 1}</span>
											<div
												class={classNames(
													'flex h-5 items-center justify-end rounded px-2 text-xs font-semibold text-white transition-all',
													{
														'bg-success': gameWon && index === currentRow,
														'bg-neutral': !gameWon || index !== currentRow
													}
												)}
												style="width: {Math.max(8, (count / getMaxDistribution()) * 100)}%;"
											>
												{count}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>

						<button onclick={startNewGame} class="btn btn-primary mt-4">Play Again</button>
					</div>
				</div>
			{/if}

			<!-- Virtual Keyboard -->
			<div class="mt-auto flex flex-col items-center gap-1.5 pt-4">
				{#each KEYBOARD_ROWS as row}
					<div class="flex gap-1.5">
						{#each row as key}
							<button class={getKeyClasses(key)} onclick={() => handleVirtualKeyClick(key)}>
								{#if key === 'backspace'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
										/>
									</svg>
								{:else}
									{key}
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</div>

			<!-- Instructions -->
			{#if !gameOver && currentRow === 0 && currentGuess.length === 0}
				<div class="mt-4 text-center text-sm text-base-content/50">
					<p>Guess the 5-letter word in 6 tries.</p>
					<p class="mt-1">
						<span class="inline-block h-4 w-4 bg-success"></span> Correct &nbsp;
						<span class="inline-block h-4 w-4 bg-warning"></span> Wrong position &nbsp;
						<span class="inline-block h-4 w-4 bg-neutral"></span> Not in word
					</p>
				</div>
			{/if}

		<!-- Debug Logs -->
			<div class="mt-4">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-semibold text-base-content/70">Debug Logs</span>
					<span class="badge badge-sm">Target: {targetWord}</span>
				</div>
				<textarea
					readonly
					class="textarea textarea-bordered h-40 w-full font-mono text-xs"
					value={debugLogs.join('\n')}
				></textarea>
			</div>
		</div>
	</div>
</div>
