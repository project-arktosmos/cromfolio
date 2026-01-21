<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { guess } from 'web-audio-beat-detector';

	// Game configuration
	const LANES = 4;
	const LANE_KEYS = ['d', 'f', 'j', 'k'];
	const LANE_COLORS = ['bg-error', 'bg-warning', 'bg-success', 'bg-info'];
	const LANE_GLOW = ['shadow-error', 'shadow-warning', 'shadow-success', 'shadow-info'];
	const NOTE_FALL_TIME = 2000; // ms for note to fall from top to hit zone
	const HIT_ZONE_TOLERANCE = 150; // ms tolerance for hit detection

	// Game state
	let audioElement: HTMLAudioElement;
	let audioContext: AudioContext | null = null;

	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let isLoading = $state(true);
	let isAnalyzing = $state(false);
	let gameStarted = $state(false);

	// BPM detection results
	let detectedBpm = $state(0);
	let beatOffset = $state(0);
	let beatInterval = $state(0); // ms between beats

	// Scoring
	let score = $state(0);
	let combo = $state(0);
	let maxCombo = $state(0);
	let hitCount = $state(0);
	let missCount = $state(0);

	// Notes state
	interface Note {
		id: number;
		lane: number;
		spawnTime: number;
		hitTime: number;
		hit: boolean;
		missed: boolean;
	}

	let notes = $state<Note[]>([]);
	let noteIdCounter = 0;
	let scheduledBeats = $state(0);

	// Key press visual feedback
	let lanePressed = $state<boolean[]>([false, false, false, false]);
	let laneFlash = $state<boolean[]>([false, false, false, false]);

	// Animation frame
	let animationFrameId: number;

	// Reactive timestamp for note positions
	let gameTime = $state(0);

	// Pattern generation - seeded random for consistent patterns
	let patternSeed = 0;

	onMount(async () => {
		if (!browser) return;
		isLoading = false;
	});

	onDestroy(() => {
		stopGame();
		if (audioContext) {
			audioContext.close();
		}
	});

	// Simple seeded random number generator
	function seededRandom() {
		patternSeed = (patternSeed * 1103515245 + 12345) & 0x7fffffff;
		return patternSeed / 0x7fffffff;
	}

	async function analyzeAudio() {
		if (!audioElement) return;

		isAnalyzing = true;

		try {
			// Create audio context for analysis
			const tempContext = new AudioContext();

			// Fetch and decode the audio file
			const response = await fetch(audioElement.src);
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);

			// Detect BPM using web-audio-beat-detector
			const result = await guess(audioBuffer);

			detectedBpm = result.bpm;
			beatOffset = result.offset * 1000; // Convert to ms
			beatInterval = (60 / detectedBpm) * 1000; // ms per beat

			tempContext.close();
		} catch (error) {
			console.error('BPM detection failed:', error);
			// Fallback to default BPM
			detectedBpm = 120;
			beatOffset = 0;
			beatInterval = 500;
		}

		isAnalyzing = false;
	}

	function generateNotePattern(beatNumber: number): number[] {
		// Generate a pattern of lanes to hit for this beat
		// Use beat number as seed for consistent patterns
		patternSeed = beatNumber * 12345;

		const lanes: number[] = [];

		// Vary pattern complexity based on beat position
		const isDownbeat = beatNumber % 4 === 0;
		const isHalfBeat = beatNumber % 2 === 0;

		if (isDownbeat) {
			// Downbeats: 1-2 notes, favor bass lanes (0, 1)
			const noteCount = seededRandom() > 0.6 ? 2 : 1;
			for (let i = 0; i < noteCount; i++) {
				const lane = seededRandom() > 0.5 ? 0 : Math.floor(seededRandom() * 2);
				if (!lanes.includes(lane)) lanes.push(lane);
			}
		} else if (isHalfBeat) {
			// Half beats: 1 note, any lane
			lanes.push(Math.floor(seededRandom() * LANES));
		} else {
			// Off beats: 0-1 note, favor higher lanes (2, 3) for hi-hats
			if (seededRandom() > 0.4) {
				lanes.push(Math.floor(seededRandom() * 2) + 2);
			}
		}

		return lanes;
	}

	function scheduleNotesAhead() {
		if (!gameStarted) return;

		const now = audioElement.currentTime * 1000;
		const lookAheadTime = NOTE_FALL_TIME + 500; // Schedule notes this far ahead

		// Calculate which beats we need to schedule
		const currentBeat = Math.floor((now - beatOffset) / beatInterval);
		const futureBeat = Math.floor((now + lookAheadTime - beatOffset) / beatInterval);

		for (let beat = Math.max(0, scheduledBeats); beat <= futureBeat; beat++) {
			if (beat <= scheduledBeats - 1) continue; // Already scheduled

			const beatTime = beatOffset + beat * beatInterval;
			if (beatTime < now) continue; // Beat already passed

			// Generate pattern for this beat
			const lanes = generateNotePattern(beat);

			// Spawn notes for each lane in the pattern
			for (const lane of lanes) {
				spawnNote(lane, beatTime - NOTE_FALL_TIME, beatTime);
			}

			scheduledBeats = beat + 1;
		}
	}

	async function startGame() {
		if (!audioElement) return;

		// Analyze audio if not already done
		if (detectedBpm === 0) {
			await analyzeAudio();
		}

		// Create audio context if needed
		if (!audioContext) {
			audioContext = new AudioContext();
		}

		// Resume audio context if suspended
		if (audioContext.state === 'suspended') {
			await audioContext.resume();
		}

		// Reset game state
		score = 0;
		combo = 0;
		maxCombo = 0;
		hitCount = 0;
		missCount = 0;
		notes = [];
		noteIdCounter = 0;
		scheduledBeats = 0;
		patternSeed = Date.now();

		gameStarted = true;
		audioElement.currentTime = 0;
		audioElement.play();

		// Start game loop
		startGameLoop();

		// Add keyboard listeners
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
	}

	function stopGame() {
		gameStarted = false;
		audioElement?.pause();

		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}

		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
	}

	function startGameLoop() {
		function gameLoop() {
			if (!gameStarted) return;

			const now = audioElement.currentTime * 1000;
			gameTime = now;

			// Schedule notes ahead of time
			scheduleNotesAhead();

			// Mark missed notes
			let hasChanges = false;
			const updatedNotes = notes.map((note) => {
				if (!note.hit && !note.missed && now > note.hitTime + HIT_ZONE_TOLERANCE) {
					combo = 0;
					missCount++;
					hasChanges = true;
					return { ...note, missed: true };
				}
				return note;
			});

			// Remove old notes
			const filteredNotes = updatedNotes.filter((note) => {
				const timeSinceHit = now - note.hitTime;
				return timeSinceHit < 500;
			});

			if (hasChanges || filteredNotes.length !== notes.length) {
				notes = filteredNotes;
			}

			animationFrameId = requestAnimationFrame(gameLoop);
		}

		animationFrameId = requestAnimationFrame(gameLoop);
	}

	function spawnNote(lane: number, spawnTime: number, hitTime: number) {
		const note: Note = {
			id: noteIdCounter++,
			lane,
			spawnTime,
			hitTime,
			hit: false,
			missed: false
		};
		notes = [...notes, note];
	}

	function handleKeyDown(e: KeyboardEvent) {
		const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
		if (laneIndex === -1 || e.repeat) return;

		lanePressed[laneIndex] = true;

		const now = audioElement.currentTime * 1000;

		// Find closest unhit note in this lane
		let closestNote: Note | null = null;
		let closestDistance = Infinity;

		for (const note of notes) {
			if (note.lane === laneIndex && !note.hit && !note.missed) {
				const distance = Math.abs(now - note.hitTime);
				if (distance < HIT_ZONE_TOLERANCE && distance < closestDistance) {
					closestNote = note;
					closestDistance = distance;
				}
			}
		}

		if (closestNote) {
			notes = notes.map((n) => (n.id === closestNote!.id ? { ...n, hit: true } : n));

			let points = 100;
			if (closestDistance < 30) {
				points = 300;
			} else if (closestDistance < 60) {
				points = 200;
			}

			score += points * (1 + Math.floor(combo / 10) * 0.1);
			combo++;
			hitCount++;
			if (combo > maxCombo) maxCombo = combo;

			triggerLaneFlash(laneIndex);
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
		if (laneIndex === -1) return;
		lanePressed[laneIndex] = false;
	}

	function triggerLaneFlash(lane: number) {
		laneFlash[lane] = true;
		setTimeout(() => {
			laneFlash[lane] = false;
		}, 100);
	}

	function handleTimeUpdate() {
		currentTime = audioElement.currentTime;
	}

	function handleLoadedMetadata() {
		duration = audioElement.duration;
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleEnded() {
		stopGame();
	}

	function formatTime(seconds: number): string {
		if (isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function getNotePosition(note: Note, currentGameTime: number): number {
		const totalFallTime = note.hitTime - note.spawnTime;
		const elapsed = currentGameTime - note.spawnTime;
		const progress = elapsed / totalFallTime;
		return Math.min(Math.max(progress * 85, 0), 100);
	}

	function getAccuracy(): string {
		const total = hitCount + missCount;
		if (total === 0) return '100.0';
		return ((hitCount / total) * 100).toFixed(1);
	}
</script>

<div class="flex min-h-screen flex-col bg-base-300 p-6">
	<h1 class="mb-4 text-center text-3xl font-bold text-base-content">Rhythm Tapper</h1>

	<audio
		bind:this={audioElement}
		src="/music/dbgt.mp3"
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleLoadedMetadata}
		onplay={handlePlay}
		onpause={handlePause}
		onended={handleEnded}
		preload="auto"
		crossorigin="anonymous"
	></audio>

	{#if !gameStarted}
		<div class="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6">
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body items-center text-center">
					<h2 class="card-title text-2xl">How to Play</h2>
					<p class="text-base-content/70">
						Press the keys when notes reach the hit zone at the bottom.
					</p>

					<div class="my-4 flex gap-4">
						{#each LANE_KEYS as key, i}
							<div
								class={classNames(
									'flex h-16 w-16 items-center justify-center rounded-lg text-2xl font-bold text-white',
									LANE_COLORS[i]
								)}
							>
								{key.toUpperCase()}
							</div>
						{/each}
					</div>

					{#if detectedBpm > 0}
						<div class="badge badge-primary badge-lg">Detected: {detectedBpm} BPM</div>
					{/if}

					<p class="text-sm text-base-content/50">
						Notes are generated based on detected BPM and beat patterns.
					</p>

					<div class="card-actions mt-4">
						<button
							onclick={startGame}
							class="btn btn-primary btn-lg"
							disabled={isLoading || isAnalyzing}
						>
							{#if isLoading}
								<span class="loading loading-spinner"></span>
								Loading...
							{:else if isAnalyzing}
								<span class="loading loading-spinner"></span>
								Analyzing BPM...
							{:else}
								Start Game
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="mx-auto flex w-full max-w-4xl flex-col gap-4">
			<!-- Stats Bar -->
			<div class="flex items-center justify-between rounded-lg bg-base-100 p-4 shadow-lg">
				<div class="flex gap-6">
					<div class="text-center">
						<div class="text-2xl font-bold text-primary">{Math.floor(score)}</div>
						<div class="text-xs text-base-content/50">Score</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-secondary">{combo}x</div>
						<div class="text-xs text-base-content/50">Combo</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-accent">{getAccuracy()}%</div>
						<div class="text-xs text-base-content/50">Accuracy</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-mono text-base-content/70">{detectedBpm}</div>
						<div class="text-xs text-base-content/50">BPM</div>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<span class="text-base-content/70">
						{formatTime(currentTime)} / {formatTime(duration)}
					</span>
					<button onclick={stopGame} class="btn btn-error btn-sm">Stop</button>
				</div>
			</div>

			<!-- Game Area -->
			<div class="relative h-[500px] overflow-hidden rounded-xl bg-base-200 shadow-2xl">
				<!-- Lane Dividers -->
				<div class="absolute inset-0 flex">
					{#each Array(LANES) as _, i}
						<div
							class={classNames(
								'relative flex-1 border-x border-base-content/10',
								lanePressed[i] ? 'bg-base-content/5' : ''
							)}
						>
							<!-- Falling Notes -->
							{#each notes.filter((n) => n.lane === i) as note (note.id)}
								<div
									class={classNames(
										'absolute left-1/2 h-12 w-12 -translate-x-1/2 rounded-full transition-opacity',
										LANE_COLORS[i],
										note.hit ? 'scale-150 opacity-0' : note.missed ? 'opacity-30' : 'opacity-100'
									)}
									style="top: {getNotePosition(note, gameTime)}%;"
								></div>
							{/each}
						</div>
					{/each}
				</div>

				<!-- Hit Zone -->
				<div class="absolute bottom-16 left-0 right-0 flex h-2 bg-white/20">
					<div class="absolute -top-1 bottom-0 left-0 right-0 border-y-2 border-white/30"></div>
				</div>

				<!-- Key Indicators -->
				<div class="absolute bottom-4 left-0 right-0 flex">
					{#each LANE_KEYS as key, i}
						<div class="flex flex-1 justify-center">
							<div
								class={classNames(
									'flex h-12 w-12 items-center justify-center rounded-full border-4 text-xl font-bold transition-all',
									lanePressed[i]
										? `${LANE_COLORS[i]} border-white text-white scale-110 shadow-lg ${LANE_GLOW[i]}`
										: 'border-base-content/30 bg-base-300 text-base-content/50',
									laneFlash[i] ? 'ring-4 ring-white' : ''
								)}
							>
								{key.toUpperCase()}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Progress Bar -->
			<div class="h-2 w-full overflow-hidden rounded-full bg-base-100">
				<div
					class="h-full bg-primary transition-all"
					style="width: {(currentTime / duration) * 100}%"
				></div>
			</div>
		</div>
	{/if}

	<!-- Results -->
	{#if !gameStarted && maxCombo > 0}
		<div class="mx-auto mt-6 max-w-md">
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body items-center text-center">
					<h2 class="card-title text-2xl">Results</h2>
					<div class="stats stats-vertical w-full shadow lg:stats-horizontal">
						<div class="stat">
							<div class="stat-title">Final Score</div>
							<div class="stat-value text-primary">{Math.floor(score)}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Max Combo</div>
							<div class="stat-value text-secondary">{maxCombo}x</div>
						</div>
						<div class="stat">
							<div class="stat-title">Accuracy</div>
							<div class="stat-value text-accent">{getAccuracy()}%</div>
						</div>
					</div>
					<div class="mt-2 text-sm text-base-content/70">
						Hits: {hitCount} | Misses: {missCount}
					</div>
					<button onclick={startGame} class="btn btn-primary mt-4">Play Again</button>
				</div>
			</div>
		</div>
	{/if}
</div>
