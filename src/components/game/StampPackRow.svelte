<script lang="ts">
	import classNames from 'classnames';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import type { StampPack } from '$types/stamp-pack.type';

	interface Props {
		stampPacks: StampPack[];
		stampsDataDir: string;
		classes?: string;
		onpackhover?: (pack: StampPack, event: MouseEvent) => void;
		onpackleave?: () => void;
	}

	let { stampPacks, stampsDataDir, classes = '', onpackhover, onpackleave }: Props = $props();

	// Fallback image
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="8"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="24">📦</text></svg>';

	function getTrayImagePath(pack: StampPack): string {
		if (!pack.trayImage) return fallbackImage;
		const filePath = `${stampsDataDir}/${pack.trayImage}`;
		return convertFileSrc(filePath);
	}

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let computedClasses = $derived(
		classNames('flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-base-300', classes)
	);
</script>

<div class={computedClasses}>
	{#each stampPacks as pack (pack.id)}
		<div
			class="w-14 h-14 rounded-lg cursor-pointer transition-all shrink-0 bg-base-200 hover:ring-2 hover:ring-primary hover:scale-105"
			onmouseenter={(e) => onpackhover?.(pack, e)}
			onmouseleave={() => onpackleave?.()}
			title={pack.name}
		>
			<img
				src={getTrayImagePath(pack)}
				alt={pack.name}
				class="w-full h-full object-cover rounded-lg"
				onerror={handleImageError}
			/>
		</div>
	{/each}
	{#if stampPacks.length === 0}
		<div class="text-sm text-base-content/50 py-2">No stamp packs available</div>
	{/if}
</div>
