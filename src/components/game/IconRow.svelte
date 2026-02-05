<script lang="ts">
	import classNames from 'classnames';

	interface Props {
		classes?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let { classes = '', onclick }: Props = $props();

	let computedClasses = $derived(classNames('flex gap-2 py-2 px-1', classes));
</script>

<div class={computedClasses}>
	<button
		class="bg-base-200 hover:ring-primary flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all hover:scale-105 hover:ring-2"
		{onclick}
		title="Place Icons"
		aria-label="Open icon picker"
	>
		<div
			class="h-8 w-8"
			style="
				background-color: currentColor;
				-webkit-mask: url('/stamp/lorc/rune-sword.svg') center/contain no-repeat;
				mask: url('/stamp/lorc/rune-sword.svg') center/contain no-repeat;
			"
		></div>
	</button>
</div>
