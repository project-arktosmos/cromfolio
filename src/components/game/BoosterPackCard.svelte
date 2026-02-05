<script lang="ts">
	import type { Collection } from '$types/collection.type';

	interface Props {
		collection: Collection;
		showTitle?: boolean;
		maxWidth?: string;
	}

	let { collection, showTitle = true, maxWidth = '200px' }: Props = $props();
</script>

<div class="flex flex-col items-center gap-2">
	<!-- Booster pack composite -->
	<div class="relative w-full" style="max-width: {maxWidth};">
		<!-- Collection cover positioned within the transparent window -->
		{#if collection.coverImage}
			<div class="absolute bottom-[8%] left-[12%] right-[12%] top-[6%] z-0 overflow-hidden">
				<img
					src={collection.coverImage}
					alt={collection.title}
					class="h-full w-full object-cover"
				/>
			</div>
		{/if}
		<!-- Booster pack template on top (has transparent center) -->
		<img src="/booster-pack.png" alt="Booster pack frame" class="relative z-10 w-full" />
		<!-- Region text on the booster pack -->
		{#if collection.region}
			<div
				class="absolute inset-x-0 bottom-[10%] z-20 flex flex-col items-center text-lg font-semibold text-white drop-shadow-lg [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]"
			>
				<span>{collection.region}</span>
				<span>Collection</span>
			</div>
		{/if}
	</div>
	<!-- Collection title below -->
	{#if showTitle}
		<span class="text-center text-sm font-medium">{collection.title}</span>
	{/if}
</div>
