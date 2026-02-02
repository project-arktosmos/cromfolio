<script lang="ts">
	import classNames from 'classnames';

	interface Props {
		classes?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let { classes = '', onclick }: Props = $props();

	let computedClasses = $derived(
		classNames('flex gap-2 py-2 px-1', classes)
	);
</script>

<div class={computedClasses}>
	<button
		class="w-14 h-14 rounded-lg cursor-pointer transition-all shrink-0 bg-base-200 hover:ring-2 hover:ring-primary hover:scale-105 flex items-center justify-center"
		onclick={onclick}
		title="Place Icons"
	>
		<div
			class="w-8 h-8"
			style="
				background-color: currentColor;
				-webkit-mask: url('/stamp/lorc/rune-sword.svg') center/contain no-repeat;
				mask: url('/stamp/lorc/rune-sword.svg') center/contain no-repeat;
			"
		></div>
	</button>
</div>
