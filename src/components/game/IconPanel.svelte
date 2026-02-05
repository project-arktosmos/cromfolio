<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';

	interface IconInfo {
		path: string;
		filename: string;
		subdir: string;
	}

	interface Props {
		position: { x: number };
		classes?: string;
		oniconselect?: (iconPath: string, color: string) => void;
		onpanelenter?: () => void;
		onpanelleave?: () => void;
		onclose?: () => void;
	}

	let {
		position,
		classes = '',
		oniconselect,
		onpanelenter,
		onpanelleave,
		onclose
	}: Props = $props();

	// State
	let icons: IconInfo[] = $state([]);
	let filterText = $state('');
	let selectedColor = $state('#000000');
	let isLoading = $state(true);
	let visibleCount = $state(60);

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
		try {
			const response = await fetch('/api/icons');
			if (response.ok) {
				icons = await response.json();
			} else {
				await loadIconsFallback();
			}
		} catch {
			await loadIconsFallback();
		}
		isLoading = false;
	});

	async function loadIconsFallback() {
		try {
			const manifestResponse = await fetch('/stamp/manifest.json');
			if (manifestResponse.ok) {
				const manifest = await manifestResponse.json();
				icons = manifest;
				return;
			}
		} catch {
			// No manifest
		}
		icons = [];
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

	function handleIconClick(icon: IconInfo) {
		oniconselect?.(icon.path, selectedColor);
	}

	function loadMore() {
		visibleCount += 60;
	}

	let computedClasses = $derived(
		classNames('fixed z-50 bg-base-200 rounded-lg shadow-xl p-3', classes)
	);

	// Clamp position to stay within viewport
	let clampedX = $derived(Math.max(16, Math.min(position.x - 180, window.innerWidth - 380)));
</script>

<div
	class={computedClasses}
	style="left: {clampedX}px; bottom: 100px; width: 360px; max-height: 480px;"
	onmouseenter={() => onpanelenter?.()}
	onmouseleave={() => onpanelleave?.()}
	role="region"
	aria-label="Icon picker panel"
>
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-bold">Place Icons</h3>
		<button class="btn btn-xs btn-ghost btn-circle" onclick={() => onclose?.()} title="Close">
			×
		</button>
	</div>

	<!-- Search and Color -->
	<div class="mb-3 space-y-2">
		<!-- Search -->
		<input
			type="text"
			placeholder="Search icons..."
			class="input input-bordered input-sm w-full"
			bind:value={filterText}
		/>

		<!-- Color controls -->
		<div class="flex items-center gap-2">
			<input
				type="color"
				class="border-base-300 h-8 w-8 shrink-0 cursor-pointer rounded border"
				bind:value={selectedColor}
			/>
			<div class="flex flex-wrap gap-1">
				{#each presetColors as color (color)}
					<button
						class={classNames(
							'h-6 w-6 shrink-0 rounded border transition-all',
							selectedColor === color
								? 'border-primary ring-primary scale-110 ring-1'
								: 'border-base-300 hover:border-base-content/30'
						)}
						style="background-color: {color}"
						onclick={() => (selectedColor = color)}
						title={color}
						aria-label="Select color {color}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Icon count -->
	<div class="text-base-content/60 mb-2 text-xs">
		{filteredIcons.length} icons
	</div>

	{#if isLoading}
		<div class="flex justify-center p-8">
			<span class="loading loading-spinner loading-md"></span>
		</div>
	{:else}
		<!-- Icon grid -->
		<div class="max-h-64 overflow-y-auto">
			<div class="grid grid-cols-6 gap-1.5">
				{#each displayedIcons as icon (icon.path)}
					<button
						class="hover:bg-base-300 bg-base-100 aspect-square cursor-pointer rounded-md p-1.5 transition-all hover:scale-105"
						onclick={() => handleIconClick(icon)}
						title="{icon.subdir}/{icon.filename}"
						aria-label="Place icon {icon.filename}"
					>
						<div
							class="h-full w-full"
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
				<div class="mt-3 flex justify-center">
					<button class="btn btn-xs btn-outline" onclick={loadMore}>
						Load More ({filteredIcons.length - displayedIcons.length} more)
					</button>
				</div>
			{/if}
		</div>

		{#if icons.length === 0}
			<div class="text-base-content/50 py-4 text-center text-sm">No icons available</div>
		{/if}
	{/if}
</div>
