<script lang="ts">
	import { stampsModalService } from '$services/stamps-modal.service';

	function openStampsModal() {
		stampsModalService.open();
	}
</script>

<div class="flex h-full flex-col items-center justify-center">
	<h1 class="mb-6 text-2xl font-bold">Stamps</h1>
	<button class="btn btn-primary btn-lg" onclick={openStampsModal}>
		Open Stamp Collections
	</button>
</div>
