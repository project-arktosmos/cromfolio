<script lang="ts">
	import '../css/app.css';
	import '$services/i18n';
	import PokemonTriviaModal from '$components/core/PokemonTriviaModal.svelte';
	import BoosterPackRevealModal from '$components/core/BoosterPackRevealModal.svelte';

	let { children } = $props();
</script>

{@render children?.()}
<PokemonTriviaModal />
<BoosterPackRevealModal />
