<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		mousePosition: { x: number; y: number };
		size: number;
		children: Snippet;
	}

	let { mousePosition, size, children }: Props = $props();
</script>

<div
	class="pointer-events-none fixed z-[100]"
	style="left: {mousePosition.x - size / 2}px; top: {mousePosition.y -
		size / 2}px; width: {size}px; height: {size}px;"
>
	{@render children()}
	<div
		class="text-base-content/70 bg-base-200/80 absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs"
	>
		Click to place • Scroll to resize • ESC to cancel
	</div>
</div>
