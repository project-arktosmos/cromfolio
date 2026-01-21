<script lang="ts">
	import { onMount } from 'svelte';
	import { tauriApiService } from '$services/tauri-api.service';
	import type { Settings } from '$types/admin.type';

	let settings = $state<Settings | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);

	// Form state
	let appName = $state('');
	let theme = $state('light');

	onMount(async () => {
		await fetchSettings();
	});

	async function fetchSettings() {
		isLoading = true;
		const data = await tauriApiService.getObject<Settings>('settings');
		if (data) {
			settings = data;
			appName = data.appName;
			theme = data.theme;
		}
		isLoading = false;
	}

	async function handleSave() {
		if (!settings) return;

		isSaving = true;
		const updated = await tauriApiService.updateObject<Settings>('settings', {
			...settings,
			appName,
			theme
		});

		if (updated) {
			settings = updated;
		}
		isSaving = false;
	}
</script>

<div class="prose max-w-none mb-6">
	<h1>Settings</h1>
	<p class="text-base-content/70">Configure application settings.</p>
</div>

{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if settings}
	<div class="card bg-base-200 max-w-xl">
		<div class="card-body">
			<div class="form-control">
				<label class="label" for="appName">
					<span class="label-text">Application Name</span>
				</label>
				<input
					id="appName"
					type="text"
					class="input input-bordered"
					bind:value={appName}
					placeholder="Enter app name"
				/>
			</div>

			<div class="form-control mt-4">
				<label class="label" for="theme">
					<span class="label-text">Theme</span>
				</label>
				<select id="theme" class="select select-bordered" bind:value={theme}>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
					<option value="system">System</option>
				</select>
			</div>

			<div class="card-actions justify-end mt-6">
				<button class="btn btn-primary" onclick={handleSave} disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save Settings
				</button>
			</div>
		</div>
	</div>
{:else}
	<div class="alert alert-error">
		<span>Failed to load settings.</span>
	</div>
{/if}
