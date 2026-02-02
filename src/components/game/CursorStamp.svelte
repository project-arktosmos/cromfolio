<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';
	import type { Stamp } from '$types/stamp-pack.type';

	interface Props {
		stamp: Stamp;
		stampsDataDir: string;
		mousePosition: { x: number; y: number };
		scale?: number;
	}

	let { stamp, stampsDataDir, mousePosition, scale = 1.0 }: Props = $props();

	const BASE_SIZE = 64;
	let size = $derived(BASE_SIZE * scale);

	// Fallback image
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="4"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="20">?</text></svg>';

	function getStampImagePath(): string {
		if (!stamp.imagePath) return fallbackImage;
		// Skip animated TGS files for now (they need lottie)
		if (stamp.imagePath.endsWith('.tgs')) return fallbackImage;
		const filePath = `${stampsDataDir}/${stamp.imagePath}`;
		return convertFileSrc(filePath);
	}

	function isVideoStamp(): boolean {
		return stamp.imagePath?.endsWith('.webm') ?? false;
	}

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}
</script>

<div
	class="pointer-events-none fixed z-[100]"
	style="left: {mousePosition.x - size / 2}px; top: {mousePosition.y -
		size / 2}px; width: {size}px; height: {size}px;"
>
	{#if isVideoStamp()}
		<video
			src={getStampImagePath()}
			class="h-full w-full object-contain opacity-80 drop-shadow-lg"
			autoplay
			loop
			muted
			playsinline
		></video>
	{:else}
		<img
			src={getStampImagePath()}
			alt="Placing stamp"
			class="h-full w-full object-contain opacity-80 drop-shadow-lg"
			onerror={handleImageError}
		/>
	{/if}
	<div
		class="text-base-content/70 bg-base-200/80 absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs"
	>
		Click to place • Scroll to resize • ESC to cancel
	</div>
</div>
