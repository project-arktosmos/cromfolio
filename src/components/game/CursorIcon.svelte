<script lang="ts">
	import CursorPlacement from '$components/game/CursorPlacement.svelte';

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

<CursorPlacement {mousePosition} {size}>
	<div
		class="h-full w-full opacity-80 drop-shadow-lg"
		style="
			background-color: {color};
			-webkit-mask: url('{iconPath}') center/contain no-repeat;
			mask: url('{iconPath}') center/contain no-repeat;
		"
	></div>
</CursorPlacement>
