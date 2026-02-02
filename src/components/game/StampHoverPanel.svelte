<script lang="ts">
	import classNames from 'classnames';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';

	interface Props {
		pack: StampPack;
		stamps: Stamp[];
		stampsDataDir: string;
		position: { x: number };
		classes?: string;
		onstampselect?: (stamp: Stamp) => void;
		onpanelenter?: () => void;
		onpanelleave?: () => void;
	}

	let {
		pack,
		stamps,
		stampsDataDir,
		position,
		classes = '',
		onstampselect,
		onpanelenter,
		onpanelleave
	}: Props = $props();

	// Fallback image
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="4"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="20">?</text></svg>';

	function getStampImagePath(stamp: Stamp): string {
		if (!stamp.imagePath) return fallbackImage;
		// Skip animated TGS files for now (they need lottie)
		if (stamp.imagePath.endsWith('.tgs')) return fallbackImage;
		const filePath = `${stampsDataDir}/${stamp.imagePath}`;
		return convertFileSrc(filePath);
	}

	function isVideoStamp(stamp: Stamp): boolean {
		return stamp.imagePath?.endsWith('.webm') ?? false;
	}

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let computedClasses = $derived(
		classNames('fixed z-50 bg-base-200 rounded-lg shadow-xl p-3 max-w-xs', classes)
	);

	// Clamp position to stay within viewport
	let clampedX = $derived(Math.max(16, Math.min(position.x - 120, window.innerWidth - 280)));
</script>

<div
	class={computedClasses}
	style="left: {clampedX}px; bottom: 100px;"
	onmouseenter={() => onpanelenter?.()}
	onmouseleave={() => onpanelleave?.()}
>
	<h3 class="mb-2 truncate text-sm font-bold" title={pack.name}>{pack.name}</h3>
	<div class="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto">
		{#each stamps as stamp (stamp.id)}
			<button
				class="bg-base-300 h-14 w-14 cursor-pointer overflow-hidden rounded-md transition-transform hover:scale-110"
				onclick={() => onstampselect?.(stamp)}
				title={stamp.emojis || 'Stamp'}
			>
				{#if isVideoStamp(stamp)}
					<video
						src={getStampImagePath(stamp)}
						class="h-full w-full object-contain"
						autoplay
						loop
						muted
						playsinline
					></video>
				{:else}
					<img
						src={getStampImagePath(stamp)}
						alt={stamp.emojis || 'Stamp'}
						class="h-full w-full object-contain"
						onerror={handleImageError}
					/>
				{/if}
			</button>
		{/each}
	</div>
	{#if stamps.length === 0}
		<div class="text-base-content/50 py-2 text-center text-sm">No stamps in this pack</div>
	{/if}
</div>
