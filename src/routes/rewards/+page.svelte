<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		getEligibleRewardCollections,
		claimCollectionReward,
		REWARD_COOLDOWN_MINUTES
	} from '$services/user-collection-rewards.service';
	import { boosterPackModalService } from '$services/booster-pack-modal.service';
	import { countUnopenedUserBoosterPacksByCollection } from '$services/user-booster-packs.service';
	import type { EligibleRewardCollection } from '$types/user-collection-reward.type';

	let eligibleCollections = $state<EligibleRewardCollection[]>([]);
	let isLoading = $state(true);
	let claimingId = $state<string | null>(null);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	// Track seconds elapsed since last DB fetch for smooth countdown
	let secondsSinceRefresh = $state(0);

	onMount(async () => {
		await loadEligibleCollections();
		isLoading = false;

		// Refresh data from DB every 30 seconds to update eligibility
		refreshInterval = setInterval(async () => {
			await loadEligibleCollections();
			secondsSinceRefresh = 0;
		}, 30000);

		// Update countdown every second for smooth progress
		countdownInterval = setInterval(() => {
			secondsSinceRefresh += 1;
		}, 1000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
		if (countdownInterval) clearInterval(countdownInterval);
	});

	async function loadEligibleCollections() {
		try {
			eligibleCollections = await getEligibleRewardCollections();
			secondsSinceRefresh = 0;
		} catch (error) {
			console.error('Failed to load eligible collections:', error);
		}
	}

	async function handleClaimReward(collection: EligibleRewardCollection) {
		if (claimingId) return;

		claimingId = String(collection.collectionId);
		try {
			await claimCollectionReward(collection.collectionId);

			// Get the updated unopened count for this collection
			const unopenedCount = await countUnopenedUserBoosterPacksByCollection(
				collection.collectionId
			);

			// Open the booster pack modal to reveal the packs
			boosterPackModalService.open(
				collection.collectionId,
				unopenedCount,
				'timed-reward',
				async () => {
					// Refresh the collections list after closing the modal
					await loadEligibleCollections();
				}
			);

			// Refresh the list immediately to update the claim status
			await loadEligibleCollections();
		} catch (error) {
			console.error('Failed to claim reward:', error);
		} finally {
			claimingId = null;
		}
	}

	// Get completion percentage
	function getCompletionPercent(collection: EligibleRewardCollection): number {
		if (collection.totalStickers === 0) return 0;
		return Math.round((collection.stickersOwned / collection.totalStickers) * 100);
	}

	// Calculate adjusted minutes until next (accounting for time since last refresh)
	function getAdjustedMinutesUntilNext(collection: EligibleRewardCollection): number {
		const minutesElapsed = Math.floor(secondsSinceRefresh / 60);
		return Math.max(0, collection.minutesUntilNext - minutesElapsed);
	}

	// Calculate progress percentage toward next reward (0-100)
	function getProgressPercent(collection: EligibleRewardCollection): number {
		const adjustedMinutes = getAdjustedMinutesUntilNext(collection);
		const secondsIntoCurrentMinute = secondsSinceRefresh % 60;

		// Total seconds until next = adjustedMinutes * 60 - secondsIntoCurrentMinute
		const totalSecondsUntilNext = Math.max(0, adjustedMinutes * 60 - secondsIntoCurrentMinute);
		const totalCooldownSeconds = REWARD_COOLDOWN_MINUTES * 60;

		// Progress is inverse of time remaining
		const progress = ((totalCooldownSeconds - totalSecondsUntilNext) / totalCooldownSeconds) * 100;
		return Math.min(100, Math.max(0, progress));
	}

	// Format countdown display
	function formatCountdown(collection: EligibleRewardCollection): string {
		const adjustedMinutes = getAdjustedMinutesUntilNext(collection);
		const secondsIntoCurrentMinute = secondsSinceRefresh % 60;
		const remainingSeconds = 60 - secondsIntoCurrentMinute;

		if (adjustedMinutes <= 0) {
			if (remainingSeconds < 60) {
				return `${remainingSeconds}s`;
			}
			return 'Ready!';
		}

		if (adjustedMinutes === 1 && remainingSeconds < 60) {
			return `1m ${remainingSeconds}s`;
		}

		return `${adjustedMinutes}m`;
	}

	// Total claimable packs across all collections
	let totalClaimablePacks = $derived(
		eligibleCollections.reduce((sum, c) => sum + c.claimableCount, 0)
	);

	// Collections with packs ready to claim
	let collectionsWithPacks = $derived(eligibleCollections.filter((c) => c.claimableCount > 0));

	// Collections waiting for next pack
	let collectionsWaiting = $derived(eligibleCollections.filter((c) => c.claimableCount === 0));
</script>

<div class="container mx-auto p-4">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Timed Rewards</h1>
		<p class="text-base-content/70 mt-1">
			Earn 1 booster pack every {REWARD_COOLDOWN_MINUTES} minutes for each collection you've started
		</p>
	</div>

	{#if isLoading}
		<div class="flex h-64 items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if eligibleCollections.length === 0}
		<div class="flex h-64 flex-col items-center justify-center gap-4">
			<div class="alert alert-info max-w-md">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="h-6 w-6 shrink-0 stroke-current"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
				<span>No collections to earn rewards from yet. Start collecting stickers first!</span>
			</div>
			<a href="/" class="btn btn-primary">Browse Collections</a>
		</div>
	{:else}
		<!-- Summary Stats -->
		<div class="stats bg-base-200 mb-6 shadow">
			<div class="stat">
				<div class="stat-figure text-primary">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-8 w-8 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
						></path>
					</svg>
				</div>
				<div class="stat-title">Collections Started</div>
				<div class="stat-value text-primary">{eligibleCollections.length}</div>
			</div>
			<div class="stat">
				<div class="stat-figure text-success">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-8 w-8 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
						></path>
					</svg>
				</div>
				<div class="stat-title">Packs Ready</div>
				<div class="stat-value text-success">{totalClaimablePacks}</div>
			</div>
			<div class="stat">
				<div class="stat-figure text-warning">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-8 w-8 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
				<div class="stat-title">Generating</div>
				<div class="stat-value text-warning">{collectionsWaiting.length}</div>
			</div>
		</div>

		<!-- Collections with Packs Ready -->
		{#if collectionsWithPacks.length > 0}
			<div class="mb-8">
				<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold">
					<span class="badge badge-success badge-lg gap-1">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="h-4 w-4 stroke-current"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						Ready to Claim
					</span>
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each collectionsWithPacks as collection (collection.collectionId)}
						{@const progressPercent = getProgressPercent(collection)}
						{@const countdown = formatCountdown(collection)}
						<div class="card bg-base-100 ring-success/50 shadow-lg ring-2">
							<figure class="relative h-32 overflow-hidden">
								{#if collection.collectionCoverImage}
									<img
										src={collection.collectionCoverImage}
										alt={collection.collectionTitle}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div
										class="from-primary to-secondary flex h-full w-full items-center justify-center bg-gradient-to-br"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-12 w-12 text-white/30"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
											/>
										</svg>
									</div>
								{/if}
								<!-- Pack count badge -->
								<div class="badge badge-success absolute right-2 top-2 gap-1 text-lg font-bold">
									{collection.claimableCount}x
								</div>
							</figure>
							<div class="card-body p-4">
								<h3 class="card-title line-clamp-1 text-base">{collection.collectionTitle}</h3>
								<div class="text-base-content/70 text-sm">
									{collection.stickersOwned} / {collection.totalStickers} stickers ({getCompletionPercent(
										collection
									)}%)
								</div>
								<!-- Progress to next pack -->
								<div class="mt-2">
									<div class="text-base-content/50 mb-1 flex justify-between text-xs">
										<span>Next pack in:</span>
										<span>{countdown}</span>
									</div>
									<progress
										class="progress progress-info h-2 w-full"
										value={progressPercent}
										max={100}
									></progress>
								</div>
								<div class="card-actions mt-2 justify-end">
									<button
										class="btn btn-success btn-sm w-full"
										onclick={() => handleClaimReward(collection)}
										disabled={claimingId !== null}
									>
										{#if claimingId === String(collection.collectionId)}
											<span class="loading loading-spinner loading-xs"></span>
											Claiming...
										{:else}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												class="h-4 w-4 stroke-current"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
												/>
											</svg>
											Claim {collection.claimableCount} Pack{collection.claimableCount > 1
												? 's'
												: ''}
										{/if}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Collections Generating Next Pack -->
		{#if collectionsWaiting.length > 0}
			<div>
				<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold">
					<span class="badge badge-warning badge-lg gap-1">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="h-4 w-4 stroke-current"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						Generating
					</span>
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each collectionsWaiting as collection (collection.collectionId)}
						{@const progressPercent = getProgressPercent(collection)}
						{@const countdown = formatCountdown(collection)}
						<div class="card bg-base-100 shadow">
							<figure class="relative h-32 overflow-hidden">
								{#if collection.collectionCoverImage}
									<img
										src={collection.collectionCoverImage}
										alt={collection.collectionTitle}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div
										class="from-primary to-secondary flex h-full w-full items-center justify-center bg-gradient-to-br"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-12 w-12 text-white/30"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
											/>
										</svg>
									</div>
								{/if}
								<!-- Countdown badge -->
								<div class="badge badge-warning absolute right-2 top-2 gap-1">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										class="h-3 w-3 stroke-current"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									{countdown}
								</div>
							</figure>
							<div class="card-body p-4">
								<h3 class="card-title line-clamp-1 text-base">{collection.collectionTitle}</h3>
								<div class="text-base-content/70 text-sm">
									{collection.stickersOwned} / {collection.totalStickers} stickers ({getCompletionPercent(
										collection
									)}%)
								</div>
								<!-- Progress to next pack -->
								<div class="mt-2">
									<div class="text-base-content/50 mb-1 flex justify-between text-xs">
										<span>Next pack:</span>
										<span class="font-mono">{countdown}</span>
									</div>
									<progress
										class="progress progress-warning h-3 w-full"
										value={progressPercent}
										max={100}
									></progress>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
