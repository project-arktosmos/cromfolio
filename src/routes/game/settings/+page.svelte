<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface ClearUserDataResult {
		userStickersDeleted: number;
		userCollectionsDeleted: number;
		userSourcesDeleted: number;
		placedStampsDeleted: number;
		stickerPlacementsDeleted: number;
	}

	let isClearing = $state(false);
	let showConfirm = $state(false);
	let clearResult = $state<ClearUserDataResult | null>(null);
	let error = $state<string | null>(null);

	async function handleClearData() {
		isClearing = true;
		error = null;
		clearResult = null;

		try {
			const result = await invoke<ClearUserDataResult>('clear_all_user_data');
			clearResult = result;
			showConfirm = false;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isClearing = false;
		}
	}

	function getTotalDeleted(result: ClearUserDataResult): number {
		return (
			result.userStickersDeleted +
			result.userCollectionsDeleted +
			result.userSourcesDeleted +
			result.placedStampsDeleted +
			result.stickerPlacementsDeleted
		);
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="text-base-content/70 mt-1">Manage your game preferences</p>
	</div>

	<!-- Data Management Section -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title text-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				Danger Zone
			</h2>
			<p class="text-base-content/70">
				These actions are irreversible. Please make sure you understand what you're doing.
			</p>

			<div class="divider"></div>

			<div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h3 class="font-semibold">Clear All User Data</h3>
					<p class="text-base-content/60 text-sm">
						Delete all your stickers, collections, sources, and placements from the database.
					</p>
				</div>

				{#if showConfirm}
					<div class="flex gap-2">
						<button class="btn btn-error" onclick={handleClearData} disabled={isClearing}>
							{#if isClearing}
								<span class="loading loading-spinner loading-sm"></span>
								Clearing...
							{:else}
								Confirm Clear
							{/if}
						</button>
						<button
							class="btn btn-ghost"
							onclick={() => (showConfirm = false)}
							disabled={isClearing}
						>
							Cancel
						</button>
					</div>
				{:else}
					<button class="btn btn-error btn-outline" onclick={() => (showConfirm = true)}>
						Clear All Data
					</button>
				{/if}
			</div>

			{#if error}
				<div class="alert alert-error mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			{#if clearResult}
				<div class="alert alert-success mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div>
						<span class="font-semibold">Data cleared successfully!</span>
						<p class="text-sm">
							Deleted {getTotalDeleted(clearResult)} total records:
							{clearResult.userStickersDeleted} stickers,
							{clearResult.userCollectionsDeleted} collections,
							{clearResult.userSourcesDeleted} sources,
							{clearResult.placedStampsDeleted} placed stamps,
							{clearResult.stickerPlacementsDeleted} sticker placements.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
