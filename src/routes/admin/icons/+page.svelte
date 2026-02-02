<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';

	interface IconInfo {
		path: string;
		filename: string;
		subdir: string;
	}

	// State
	let icons: IconInfo[] = $state([]);
	let filterText = $state('');
	let selectedColor = $state('#000000');
	let isLoading = $state(true);
	let visibleCount = $state(100);
	let selectedIcon: IconInfo | null = $state(null);

	// All subdirectories in static/stamp
	const subdirs = [
		'andymeneely',
		'aussiesim',
		'carl-olsen',
		'caro-asercion',
		'cathelineau',
		'catsu',
		'darkzaitzev',
		'delapouite',
		'faithtoken',
		'felbrigg',
		'generalace135',
		'guard13007',
		'heavenly-dog',
		'irongamer',
		'john-colburn',
		'john-redman',
		'kier-heyl',
		'lorc',
		'lord-berandas',
		'lucasms',
		'pepijn-poolman',
		'pierre-leducq',
		'priorblue',
		'quoting',
		'rihlsul',
		'sbed',
		'seregacthtuf',
		'skoll',
		'sparker',
		'spencerdub',
		'starseeker',
		'various-artists',
		'viscious-speed',
		'willdabeast',
		'zajkonur',
		'zeromancer'
	];

	// Preset colors
	const presetColors = [
		'#000000',
		'#ffffff',
		'#ef4444',
		'#f97316',
		'#eab308',
		'#22c55e',
		'#14b8a6',
		'#3b82f6',
		'#8b5cf6',
		'#ec4899'
	];

	onMount(async () => {
		// Fetch the icon list from the server endpoint
		try {
			const response = await fetch('/api/icons');
			if (response.ok) {
				icons = await response.json();
			} else {
				// Fallback: scan known subdirectories
				await loadIconsFallback();
			}
		} catch {
			await loadIconsFallback();
		}
		isLoading = false;
	});

	async function loadIconsFallback() {
		// For each subdir, we'll attempt to load icons via a static manifest
		// Since we can't scan filesystem from client, use a static list approach
		const allIcons: IconInfo[] = [];

		// Try to fetch a manifest file if it exists
		try {
			const manifestResponse = await fetch('/stamp/manifest.json');
			if (manifestResponse.ok) {
				const manifest = await manifestResponse.json();
				icons = manifest;
				return;
			}
		} catch {
			// No manifest, continue with empty
		}

		// As a final fallback, we'll just show an empty state with instructions
		icons = allIcons;
	}

	// Filtered icons based on search text
	let filteredIcons = $derived.by(() => {
		if (!filterText.trim()) return icons;
		const search = filterText.toLowerCase();
		return icons.filter(
			(icon) =>
				icon.filename.toLowerCase().includes(search) || icon.subdir.toLowerCase().includes(search)
		);
	});

	// Paginated icons
	let displayedIcons = $derived(filteredIcons.slice(0, visibleCount));

	function loadMore() {
		visibleCount += 100;
	}

	function copyPath(icon: IconInfo) {
		navigator.clipboard.writeText(`/stamp/${icon.subdir}/${icon.filename}`);
	}

	function selectIcon(icon: IconInfo) {
		selectedIcon = icon;
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold">Icon Browser</h1>
		<p class="text-base-content/70 mt-1">
			Browse and preview {icons.length.toLocaleString()} SVG icons from static/stamp
		</p>
	</div>

	<!-- Controls -->
	<div class="card bg-base-200">
		<div class="card-body">
			<div class="flex flex-wrap gap-4 items-end">
				<!-- Search filter -->
				<div class="form-control flex-1 min-w-64">
					<label class="label" for="filter-input">
						<span class="label-text font-medium">Filter by filename or author</span>
					</label>
					<input
						id="filter-input"
						type="text"
						placeholder="Search icons..."
						class="input input-bordered w-full"
						bind:value={filterText}
					/>
				</div>

				<!-- Color picker -->
				<div class="form-control">
					<label class="label" for="color-picker">
						<span class="label-text font-medium">Icon Color</span>
					</label>
					<div class="flex items-center gap-2">
						<input
							id="color-picker"
							type="color"
							class="w-12 h-10 cursor-pointer rounded border border-base-300"
							bind:value={selectedColor}
						/>
						<input
							type="text"
							class="input input-bordered input-sm w-24 font-mono"
							bind:value={selectedColor}
						/>
					</div>
				</div>

				<!-- Preset colors -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Presets</span>
					</label>
					<div class="flex gap-1">
						{#each presetColors as color (color)}
							<button
								class={classNames(
									'w-8 h-8 rounded border-2 transition-all',
									selectedColor === color
										? 'border-primary scale-110'
										: 'border-base-300 hover:border-base-content/30'
								)}
								style="background-color: {color}"
								onclick={() => (selectedColor = color)}
								title={color}
							></button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="mt-4 flex gap-4 text-sm text-base-content/70">
				<span>Total: {icons.length.toLocaleString()} icons</span>
				<span>Filtered: {filteredIcons.length.toLocaleString()} icons</span>
				<span>Showing: {displayedIcons.length.toLocaleString()} icons</span>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="flex justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if icons.length === 0}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">No Icons Found</h2>
				<p class="text-base-content/70">
					The icon manifest file could not be loaded. Ensure <code>static/stamp/manifest.json</code> exists.
				</p>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Icon grid -->
			<div class="lg:col-span-3">
				<div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
					{#each displayedIcons as icon (icon.path)}
						<button
							class={classNames(
								'aspect-square rounded-lg p-2 transition-all cursor-pointer',
								'hover:bg-base-200 hover:scale-105',
								selectedIcon?.path === icon.path ? 'bg-primary/20 ring-2 ring-primary' : 'bg-base-100'
							)}
							onclick={() => selectIcon(icon)}
							title="{icon.subdir}/{icon.filename}"
						>
							<div
								class="w-full h-full"
								style="
									background-color: {selectedColor};
									-webkit-mask: url('{icon.path}') center/contain no-repeat;
									mask: url('{icon.path}') center/contain no-repeat;
								"
							></div>
						</button>
					{/each}
				</div>

				<!-- Load more button -->
				{#if displayedIcons.length < filteredIcons.length}
					<div class="flex justify-center mt-6">
						<button class="btn btn-outline" onclick={loadMore}>
							Load More ({filteredIcons.length - displayedIcons.length} remaining)
						</button>
					</div>
				{/if}
			</div>

			<!-- Selected icon details -->
			<div class="lg:col-span-1">
				<div class="card bg-base-200 sticky top-4">
					<div class="card-body">
						<h2 class="card-title text-lg">Icon Details</h2>

						{#if selectedIcon}
							<!-- Large preview -->
							<div class="flex justify-center p-4 bg-base-100 rounded-lg">
								<div
									class="w-24 h-24"
									style="
										background-color: {selectedColor};
										-webkit-mask: url('{selectedIcon.path}') center/contain no-repeat;
										mask: url('{selectedIcon.path}') center/contain no-repeat;
									"
								></div>
							</div>

							<!-- Info -->
							<div class="space-y-2 text-sm">
								<div>
									<span class="text-base-content/60">Filename:</span>
									<div class="font-mono text-xs break-all">{selectedIcon.filename}</div>
								</div>
								<div>
									<span class="text-base-content/60">Author:</span>
									<div class="font-medium">{selectedIcon.subdir}</div>
								</div>
								<div>
									<span class="text-base-content/60">Path:</span>
									<div class="font-mono text-xs break-all">{selectedIcon.path}</div>
								</div>
							</div>

							<!-- Actions -->
							<div class="space-y-2 mt-4">
								<button class="btn btn-sm btn-outline w-full" onclick={() => copyPath(selectedIcon!)}>
									Copy Path
								</button>
								<a
									href={selectedIcon.path}
									target="_blank"
									rel="noopener noreferrer"
									class="btn btn-sm btn-outline w-full"
								>
									Open SVG
								</a>
							</div>

							<!-- Color preview sizes -->
							<div class="mt-4">
								<span class="text-xs text-base-content/60">Size Preview</span>
								<div class="flex items-end gap-2 mt-2">
									{#each [16, 24, 32, 48] as size (size)}
										<div class="flex flex-col items-center gap-1">
											<div
												style="
													width: {size}px;
													height: {size}px;
													background-color: {selectedColor};
													-webkit-mask: url('{selectedIcon.path}') center/contain no-repeat;
													mask: url('{selectedIcon.path}') center/contain no-repeat;
												"
											></div>
											<span class="text-xs text-base-content/50">{size}</span>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<p class="text-sm text-base-content/60">
								Click an icon to see details
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
