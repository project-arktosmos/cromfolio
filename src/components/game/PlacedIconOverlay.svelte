<script lang="ts">
	import type { UserPlacedIcon } from '$types/user-placed-icon.type';
	import PlacedOverlay from '$components/game/PlacedOverlay.svelte';

	interface Props {
		placedIcons: UserPlacedIcon[];
		editable?: boolean;
		classes?: string;
		oniconclick?: (placedIcon: UserPlacedIcon) => void;
		oniconremove?: (placedIcon: UserPlacedIcon) => void;
	}

	let { placedIcons, editable = false, classes = '', oniconclick, oniconremove }: Props = $props();
</script>

<PlacedOverlay
	items={placedIcons}
	{editable}
	{classes}
	onitemclick={oniconclick}
	onitemremove={oniconremove}
>
	{#snippet children(placedIcon)}
		<div
			class="h-full w-full drop-shadow-md"
			style="
				background-color: {placedIcon.color};
				-webkit-mask: url('{placedIcon.iconPath}') center/contain no-repeat;
				mask: url('{placedIcon.iconPath}') center/contain no-repeat;
			"
		></div>
	{/snippet}
</PlacedOverlay>
