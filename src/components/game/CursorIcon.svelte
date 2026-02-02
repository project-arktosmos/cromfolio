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
	class="fixed z-[100] pointer-events-none"
	style="left: {mousePosition.x - size / 2}px; top: {mousePosition.y - size / 2}px; width: {size}px; height: {size}px;"
>
	<div
		class="w-full h-full opacity-80 drop-shadow-lg"
		style="
			background-color: {color};
			-webkit-mask: url('{iconPath}') center/contain no-repeat;
			mask: url('{iconPath}') center/contain no-repeat;
		"
	></div>
	<div class="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-base-content/70 whitespace-nowrap bg-base-200/80 px-2 py-0.5 rounded">
		Click to place • Scroll to resize • ESC to cancel
	</div>
</div>
