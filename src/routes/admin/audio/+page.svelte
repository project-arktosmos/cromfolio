<script lang="ts">
	import classNames from 'classnames';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type AudioMotionAnalyzer from 'audiomotion-analyzer';

	let audioElement: HTMLAudioElement;
	let containerElement: HTMLDivElement;
	let audioMotion: AudioMotionAnalyzer | null = null;
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(0.8);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;

		const AudioMotionAnalyzerClass = (await import('audiomotion-analyzer')).default;

		audioMotion = new AudioMotionAnalyzerClass(containerElement, {
			source: audioElement,
			height: 400,
			ansiBands: false,
			showScaleX: true,
			showBgColor: true,
			mode: 3,
			frequencyScale: 'log',
			showPeaks: true,
			peakLine: true,
			smoothing: 0.7,
			gradient: 'prism',
			reflexRatio: 0.3,
			reflexAlpha: 0.25,
			reflexBright: 1,
			overlay: true,
			lineWidth: 2,
			fillAlpha: 0.6,
			barSpace: 0.2,
			lumiBars: false,
			radial: false,
			spinSpeed: 0,
			stereo: true,
			splitGradient: false,
			mirror: 0,
			showFPS: false
		});

		// Register a custom dark gradient for the background
		audioMotion.registerGradient('dark', {
			bgColor: '#0d1117',
			colorStops: [
				{ color: '#6366f1', pos: 0 },
				{ color: '#8b5cf6', pos: 0.3 },
				{ color: '#ec4899', pos: 0.6 },
				{ color: '#f43f5e', pos: 1 }
			]
		});

		isLoading = false;
	});

	onDestroy(() => {
		if (audioMotion) {
			audioMotion.destroy();
		}
	});

	function togglePlay() {
		if (audioElement.paused) {
			audioElement.play();
		} else {
			audioElement.pause();
		}
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

	function handleSeek(e: Event) {
		const target = e.target as HTMLInputElement;
		audioElement.currentTime = parseFloat(target.value);
	}

	function handleVolumeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		volume = parseFloat(target.value);
		audioElement.volume = volume;
	}

	function formatTime(seconds: number): string {
		if (isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function setVisualizationMode(mode: number) {
		if (audioMotion) {
			audioMotion.mode = mode;
		}
	}

	function toggleRadial() {
		if (audioMotion) {
			audioMotion.radial = !audioMotion.radial;
		}
	}

	function setGradient(gradient: string) {
		if (audioMotion) {
			audioMotion.gradient = gradient;
		}
	}
</script>

<div class="flex min-h-screen flex-col bg-base-300 p-6">
	<h1 class="mb-6 text-center text-3xl font-bold text-base-content">Audio Visualizer</h1>

	<div class="mx-auto w-full max-w-5xl">
		<!-- Visualization Container -->
		<div
			bind:this={containerElement}
			class={classNames(
				'relative mb-6 overflow-hidden rounded-xl border border-base-content/20',
				'shadow-2xl',
				{ 'animate-pulse bg-base-200': isLoading }
			)}
		>
			{#if isLoading}
				<div class="flex h-[400px] items-center justify-center">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			{/if}
		</div>

		<!-- Audio Element -->
		<audio
			bind:this={audioElement}
			src="/music/dbgt.mp3"
			ontimeupdate={handleTimeUpdate}
			onloadedmetadata={handleLoadedMetadata}
			onplay={handlePlay}
			onpause={handlePause}
			preload="metadata"
			crossorigin="anonymous"
		></audio>

		<!-- Controls Card -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<!-- Progress Bar -->
				<div class="mb-4 flex items-center gap-4">
					<span class="min-w-12 text-sm text-base-content/70">{formatTime(currentTime)}</span>
					<input
						type="range"
						min="0"
						max={duration || 100}
						value={currentTime}
						oninput={handleSeek}
						class="range range-primary range-sm flex-1"
					/>
					<span class="min-w-12 text-right text-sm text-base-content/70">{formatTime(duration)}</span
					>
				</div>

				<!-- Playback Controls -->
				<div class="mb-6 flex items-center justify-center gap-4">
					<button onclick={togglePlay} class="btn btn-primary btn-lg btn-circle">
						{#if isPlaying}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-8 w-8"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-8 w-8"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>
				</div>

				<!-- Volume Control -->
				<div class="mb-6 flex items-center gap-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-base-content/70"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
						/>
					</svg>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={volume}
						oninput={handleVolumeChange}
						class="range range-secondary range-sm w-32"
					/>
				</div>

				<!-- Visualization Controls -->
				<div class="divider">Visualization Settings</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<!-- Mode Selection -->
					<fieldset>
						<legend class="mb-2 font-semibold text-base-content">Display Mode</legend>
						<div class="flex flex-wrap gap-2">
							<button onclick={() => setVisualizationMode(0)} class="btn btn-outline btn-sm">
								Discrete
							</button>
							<button onclick={() => setVisualizationMode(2)} class="btn btn-outline btn-sm">
								1/12 Octave
							</button>
							<button onclick={() => setVisualizationMode(3)} class="btn btn-outline btn-sm">
								1/8 Octave
							</button>
							<button onclick={() => setVisualizationMode(4)} class="btn btn-outline btn-sm">
								1/6 Octave
							</button>
							<button onclick={() => setVisualizationMode(5)} class="btn btn-outline btn-sm">
								1/4 Octave
							</button>
							<button onclick={() => setVisualizationMode(6)} class="btn btn-outline btn-sm">
								1/3 Octave
							</button>
							<button onclick={() => setVisualizationMode(10)} class="btn btn-outline btn-sm">
								Line
							</button>
						</div>
					</fieldset>

					<!-- Gradient Selection -->
					<fieldset>
						<legend class="mb-2 font-semibold text-base-content">Color Gradient</legend>
						<div class="flex flex-wrap gap-2">
							<button onclick={() => setGradient('classic')} class="btn btn-outline btn-sm">
								Classic
							</button>
							<button onclick={() => setGradient('prism')} class="btn btn-outline btn-sm">
								Prism
							</button>
							<button onclick={() => setGradient('rainbow')} class="btn btn-outline btn-sm">
								Rainbow
							</button>
							<button onclick={() => setGradient('orangered')} class="btn btn-outline btn-sm">
								Orange Red
							</button>
							<button onclick={() => setGradient('steelblue')} class="btn btn-outline btn-sm">
								Steel Blue
							</button>
							<button onclick={() => setGradient('dark')} class="btn btn-outline btn-sm">
								Dark
							</button>
						</div>
					</fieldset>
				</div>

				<!-- Toggle Options -->
				<div class="mt-4 flex flex-wrap gap-4">
					<button onclick={toggleRadial} class="btn btn-accent btn-sm"> Toggle Radial Mode </button>
				</div>
			</div>
		</div>
	</div>
</div>
