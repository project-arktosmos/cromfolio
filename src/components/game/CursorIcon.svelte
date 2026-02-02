<script lang="ts">
	interface Props {
		iconPath: string;
		color: string;
		mousePosition: { x: number; y: number };
		scale?: number;
	}

	let { iconPath, color, mousePosition, scale = 1.0 }: Props = $props();

	const BASE_SIZE = 48;
	let size = $derived(BASE_SIZE * scale);
</script>

<div
	class="pointer-events-none fixed z-[100]"
	style="left: {mousePosition.x - size / 2}px; top: {mousePosition.y -
		size / 2}px; width: {size}px; height: {size}px;"
>
	<div
		class="h-full w-full opacity-80 drop-shadow-lg"
		style="
			background-color: {color};
			-webkit-mask: url('{iconPath}') center/contain no-repeat;
			mask: url('{iconPath}') center/contain no-repeat;
		"
	></div>
	<div
		class="text-base-content/70 bg-base-200/80 absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs"
	>
		Click to place • Scroll to resize • ESC to cancel
	</div>
</div>
