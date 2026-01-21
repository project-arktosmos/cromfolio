<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Game configuration
	const LANES = 4;
	const LANE_KEYS = ['d', 'f', 'j', 'k'];
	const LANE_COLORS = ['bg-error', 'bg-warning', 'bg-success', 'bg-info'];
	const LANE_GLOW = ['shadow-error', 'shadow-warning', 'shadow-success', 'shadow-info'];
	const NOTE_FALL_TIME = 2000; // ms for note to fall from top to hit zone
	const HIT_ZONE_TOLERANCE = 100; // ms tolerance for hit detection
	const ANALYSIS_INTERVAL = 50; // ms between audio analysis checks

	// Audio analysis thresholds for beat detection
	const BASS_THRESHOLD = 0.6; // Low frequency threshold (bass/kick)
	const MID_THRESHOLD = 0.5; // Mid frequency threshold (snare/vocals)
	const HIGH_THRESHOLD = 0.4; // High frequency threshold (hi-hats/cymbals)

	// Game state
	let audioElement: HTMLAudioElement;
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let dataArray: Uint8Array | null = null;

	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(0.8);
	let isLoading = $state(true);
	let gameStarted = $state(false);

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

	// Key press visual feedback
	let lanePressed = $state<boolean[]>([false, false, false, false]);
	let laneFlash = $state<boolean[]>([false, false, false, false]);

	// Beat detection state
	let lastBeatTime: number[] = [0, 0, 0, 0];
	let beatCooldown = 150; // ms between beats per lane

	// Animation frame
	let animationFrameId: number;
	let analysisIntervalId: NodeJS.Timeout;

	onMount(async () => {
		if (!browser) return;

		// Set up audio context and analyser
		audioContext = new AudioContext();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.3;

		const bufferLength = analyser.frequencyBinCount;
		dataArray = new Uint8Array(bufferLength);

		isLoading = false;
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		if (analysisIntervalId) {
			clearInterval(analysisIntervalId);
		}
		if (audioContext) {
			audioContext.close();
		}
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
	});

	function connectAudio() {
		if (!audioContext || !analyser || !audioElement) return;

		const source = audioContext.createMediaElementSource(audioElement);
		source.connect(analyser);
		analyser.connect(audioContext.destination);
	}

	function startGame() {
		if (!audioElement || !audioContext) return;

		// Resume audio context if suspended
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}

		// Connect audio only once
		if (!analyser?.numberOfInputs) {
			connectAudio();
		}

		// Reset game state
		score = 0;
		combo = 0;
		maxCombo = 0;
		hitCount = 0;
		missCount = 0;
		notes = [];
		noteIdCounter = 0;
		lastBeatTime = [0, 0, 0, 0];

		gameStarted = true;
		audioElement.currentTime = 0;
		audioElement.play();

		// Start game loop
		startGameLoop();

		// Start beat detection
		startBeatDetection();

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
		if (analysisIntervalId) {
			clearInterval(analysisIntervalId);
		}

		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
	}

	function startGameLoop() {
		function gameLoop() {
			if (!gameStarted) return;

			const now = audioElement.currentTime * 1000;

			// Update notes - mark missed notes
			notes = notes.map((note) => {
				if (!note.hit && !note.missed && now > note.hitTime + HIT_ZONE_TOLERANCE) {
					combo = 0;
					missCount++;
					return { ...note, missed: true };
				}
				return note;
			});

			// Remove old notes (fallen past the screen)
			notes = notes.filter((note) => {
				const timeSinceHit = now - note.hitTime;
				return timeSinceHit < 500; // Keep for 500ms after hit time for animation
			});

			animationFrameId = requestAnimationFrame(gameLoop);
		}

		animationFrameId = requestAnimationFrame(gameLoop);
	}

	function startBeatDetection() {
		analysisIntervalId = setInterval(() => {
			if (!analyser || !dataArray || !gameStarted || audioElement.paused) return;

			analyser.getByteFrequencyData(dataArray);

			const now = audioElement.currentTime * 1000;
			const bufferLength = dataArray.length;

			// Divide frequency bins into ranges for different lanes
			// Lane 0: Bass (20-150 Hz) - bins 0-5
			// Lane 1: Low-mid (150-500 Hz) - bins 6-20
			// Lane 2: Mid (500-2000 Hz) - bins 21-50
			// Lane 3: High (2000-8000 Hz) - bins 51-100

			const bassAvg = getAverageVolume(dataArray, 0, 5);
			const lowMidAvg = getAverageVolume(dataArray, 6, 20);
			const midAvg = getAverageVolume(dataArray, 21, 50);
			const highAvg = getAverageVolume(dataArray, 51, Math.min(100, bufferLength - 1));

			const levels = [bassAvg, lowMidAvg, midAvg, highAvg];
			const thresholds = [BASS_THRESHOLD, MID_THRESHOLD, MID_THRESHOLD, HIGH_THRESHOLD];

			// Check each lane for beat detection
			levels.forEach((level, lane) => {
				if (level > thresholds[lane] && now - lastBeatTime[lane] > beatCooldown) {
					// Spawn a note
					spawnNote(lane, now);
					lastBeatTime[lane] = now;
				}
			});
		}, ANALYSIS_INTERVAL);
	}

	function getAverageVolume(dataArray: Uint8Array, startBin: number, endBin: number): number {
		let sum = 0;
		for (let i = startBin; i <= endBin; i++) {
			sum += dataArray[i];
		}
		return sum / (endBin - startBin + 1) / 255;
	}

	function spawnNote(lane: number, currentTimeMs: number) {
		const note: Note = {
			id: noteIdCounter++,
			lane,
			spawnTime: currentTimeMs,
			hitTime: currentTimeMs + NOTE_FALL_TIME,
			hit: false,
			missed: false
		};
		notes = [...notes, note];
	}

	function handleKeyDown(e: KeyboardEvent) {
		const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
		if (laneIndex === -1 || e.repeat) return;

		lanePressed[laneIndex] = true;

		// Check for note hit
		const now = audioElement.currentTime * 1000;

		// Find the closest unhit note in this lane within tolerance
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
			// Hit!
			notes = notes.map((n) => (n.id === closestNote!.id ? { ...n, hit: true } : n));

			// Calculate score based on timing
			let points = 100;
			if (closestDistance < 30) {
				points = 300; // Perfect
			} else if (closestDistance < 60) {
				points = 200; // Great
			}

			score += points * (1 + Math.floor(combo / 10) * 0.1);
			combo++;
			hitCount++;
			if (combo > maxCombo) maxCombo = combo;

			// Visual feedback
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

	// Calculate note position based on current time
	function getNotePosition(note: Note): number {
		const now = audioElement?.currentTime * 1000 || 0;
		const progress = (now - note.spawnTime) / NOTE_FALL_TIME;
		return Math.min(progress * 100, 100);
	}

	// Get accuracy percentage
	function getAccuracy(): string {
		const total = hitCount + missCount;
		if (total === 0) return '100.0';
		return ((hitCount / total) * 100).toFixed(1);
	}
</script>

<div class="flex min-h-screen flex-col bg-base-300 p-6">
	<h1 class="mb-4 text-center text-3xl font-bold text-base-content">Rhythm Tapper</h1>

	<!-- Audio Element -->
	<audio
		bind:this={audioElement}
		src="/music/dbgt.mp3"
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleLoadedMetadata}
		onplay={handlePlay}
		onpause={handlePause}
		onended={handleEnded}
		preload="metadata"
		crossorigin="anonymous"
	></audio>

	{#if !gameStarted}
		<!-- Start Screen -->
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

					<p class="text-sm text-base-content/50">
						Notes are auto-generated based on the music's rhythm and frequencies.
					</p>

					<div class="card-actions mt-4">
						<button onclick={startGame} class="btn btn-primary btn-lg" disabled={isLoading}>
							{#if isLoading}
								<span class="loading loading-spinner"></span>
								Loading...
							{:else}
								Start Game
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Game Screen -->
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
										'absolute left-1/2 h-8 w-16 -translate-x-1/2 rounded-lg transition-opacity',
										LANE_COLORS[i],
										note.hit ? 'scale-150 opacity-0' : note.missed ? 'opacity-30' : 'opacity-100'
									)}
									style="top: {getNotePosition(note)}%;"
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

	<!-- Results Modal (shown when game ends) -->
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
