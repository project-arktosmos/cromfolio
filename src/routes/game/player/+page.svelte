<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { playerService, setPlayerName, addExperience, resetPlayer } from '$services/player.service';
	import { getLevelInfo, formatXp } from '$utils/leveling';
	import type { Player, LevelInfo } from '$types/player.type';

	let player = $state<Player | null>(null);
	let levelInfo = $state<LevelInfo | null>(null);
	let isEditingName = $state(false);
	let editNameValue = $state('');
	let showResetConfirm = $state(false);

	// Debug XP amount for testing
	let debugXpAmount = $state(100);

	onMount(() => {
		const unsubscribe = playerService.store.subscribe((p) => {
			player = p;
			levelInfo = getLevelInfo(p.experience);
		});

		return () => unsubscribe();
	});

	function startEditingName() {
		if (player) {
			editNameValue = player.name;
			isEditingName = true;
		}
	}

	function saveName() {
		if (editNameValue.trim()) {
			setPlayerName(editNameValue.trim());
		}
		isEditingName = false;
	}

	function cancelEditName() {
		isEditingName = false;
		editNameValue = '';
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveName();
		} else if (e.key === 'Escape') {
			cancelEditName();
		}
	}

	function confirmReset() {
		resetPlayer();
		showResetConfirm = false;
	}

	function handleDebugAddXp() {
		addExperience(debugXpAmount);
	}

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDateTime(isoString: string): string {
		return new Date(isoString).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Player Profile</h1>
			<p class="text-base-content/70 mt-1">View your progress and stats</p>
		</div>
	</div>

	{#if player && levelInfo}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Player Card -->
			<div class="lg:col-span-1">
				<div class="card bg-base-200">
					<div class="card-body items-center text-center">
						<!-- Avatar -->
						<div class="avatar placeholder mb-4">
							<div class="bg-primary text-primary-content rounded-full w-24">
								<span class="text-3xl">{player.name.charAt(0).toUpperCase()}</span>
							</div>
						</div>

						<!-- Name -->
						{#if isEditingName}
							<div class="flex items-center gap-2 w-full max-w-xs">
								<input
									type="text"
									class="input input-bordered input-sm flex-1"
									bind:value={editNameValue}
									onkeydown={handleNameKeydown}
									autofocus
								/>
								<button class="btn btn-sm btn-primary" onclick={saveName}>
									Save
								</button>
								<button class="btn btn-sm btn-ghost" onclick={cancelEditName}>
									Cancel
								</button>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<h2 class="text-2xl font-bold">{player.name}</h2>
								<button
									class="btn btn-ghost btn-xs"
									onclick={startEditingName}
									title="Edit name"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</button>
							</div>
						{/if}

						<!-- Level Badge -->
						<div class="badge badge-primary badge-lg text-lg px-4 py-3 mt-2">
							Level {levelInfo.level}
						</div>

						<!-- Join Date -->
						<div class="text-sm text-base-content/60 mt-4">
							<p>Joined: {formatDate(player.createdAt)}</p>
							<p>Last played: {formatDateTime(player.lastPlayedAt)}</p>
						</div>
					</div>
				</div>
			</div>

			<!-- XP & Level Progress -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Level Progress Card -->
				<div class="card bg-base-200">
					<div class="card-body">
						<h3 class="card-title">Experience Progress</h3>

						<!-- Current Level Display -->
						<div class="flex items-center justify-between mb-4">
							<div class="flex items-center gap-4">
								<div class="radial-progress text-primary" style="--value:{levelInfo.progressPercent}; --size:5rem; --thickness:0.5rem;" role="progressbar">
									<span class="text-lg font-bold">{levelInfo.level}</span>
								</div>
								<div>
									<p class="text-2xl font-bold">{formatXp(levelInfo.currentXp)} XP</p>
									<p class="text-base-content/60">Total Experience</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-xl font-semibold text-primary">Level {levelInfo.level + 1}</p>
								<p class="text-base-content/60">Next level</p>
							</div>
						</div>

						<!-- XP Progress Bar -->
						<div class="space-y-2">
							<div class="flex justify-between text-sm">
								<span>{formatXp(levelInfo.xpForCurrentLevel)} XP</span>
								<span>{formatXp(levelInfo.xpForNextLevel)} XP</span>
							</div>
							<progress
								class="progress progress-primary w-full h-4"
								value={levelInfo.xpIntoLevel}
								max={levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel}
							></progress>
							<div class="flex justify-between text-sm text-base-content/60">
								<span>{formatXp(levelInfo.xpIntoLevel)} XP into level</span>
								<span>{formatXp(levelInfo.xpToNextLevel)} XP to next level</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Stats Cards -->
				<div class="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-200">
					<div class="stat">
						<div class="stat-figure text-primary">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
						<div class="stat-title">Current Level</div>
						<div class="stat-value text-primary">{levelInfo.level}</div>
						<div class="stat-desc">{levelInfo.progressPercent.toFixed(1)}% to next</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
							</svg>
						</div>
						<div class="stat-title">Total XP</div>
						<div class="stat-value text-secondary">{formatXp(levelInfo.currentXp)}</div>
						<div class="stat-desc">Lifetime earned</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-accent">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
							</svg>
						</div>
						<div class="stat-title">XP to Next Level</div>
						<div class="stat-value text-accent">{formatXp(levelInfo.xpToNextLevel)}</div>
						<div class="stat-desc">Keep going!</div>
					</div>
				</div>

				<!-- Debug Controls (for testing) -->
				<div class="card bg-base-300 border border-warning/30">
					<div class="card-body">
						<h3 class="card-title text-warning">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							Debug Controls
						</h3>
						<p class="text-sm text-base-content/60 mb-4">Use these controls to test the leveling system</p>

						<div class="flex flex-wrap gap-4 items-end">
							<div class="form-control">
								<label class="label" for="debug-xp-amount">
									<span class="label-text">XP Amount</span>
								</label>
								<input
									id="debug-xp-amount"
									type="number"
									class="input input-bordered input-sm w-32"
									bind:value={debugXpAmount}
									min="1"
								/>
							</div>
							<button class="btn btn-primary btn-sm" onclick={handleDebugAddXp}>
								Add XP
							</button>
							<button class="btn btn-sm btn-outline" onclick={() => addExperience(1000)}>
								+1,000 XP
							</button>
							<button class="btn btn-sm btn-outline" onclick={() => addExperience(10000)}>
								+10,000 XP
							</button>
							<button class="btn btn-sm btn-outline" onclick={() => addExperience(100000)}>
								+100,000 XP
							</button>
						</div>

						<div class="divider"></div>

						<div class="flex items-center justify-between">
							<div>
								<p class="font-medium text-error">Danger Zone</p>
								<p class="text-sm text-base-content/60">Reset all player progress</p>
							</div>
							{#if showResetConfirm}
								<div class="flex gap-2">
									<button class="btn btn-error btn-sm" onclick={confirmReset}>
										Confirm Reset
									</button>
									<button class="btn btn-ghost btn-sm" onclick={() => showResetConfirm = false}>
										Cancel
									</button>
								</div>
							{:else}
								<button class="btn btn-error btn-sm btn-outline" onclick={() => showResetConfirm = true}>
									Reset Player
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/if}
</div>
