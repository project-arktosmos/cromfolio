<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import classNames from 'classnames';
	import { evmP2PService, type EvmP2PState } from '$services/evm-p2p.service';

	let p2pState: EvmP2PState = $state({
		isConnected: false,
		isConnecting: false,
		networkId: null,
		selfId: null,
		peers: [],
		pendingTxCount: 0,
		latestBlock: 0,
		relayCount: 0,
		error: null,
		isLeader: false,
		currentLeader: null
	});

	let networkIdInput = $state('synaxis-main');
	let unsubscribe: (() => void) | null = null;

	// Relay status (hardcoded list from the service)
	const relays = [
		'wss://relay.damus.io',
		'wss://nos.lol',
		'wss://relay.nostr.band',
		'wss://nostr.wine',
		'wss://relay.primal.net',
		'wss://purplepag.es'
	];

	onMount(() => {
		unsubscribe = evmP2PService.store.subscribe((state) => {
			p2pState = state;
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	async function handleJoinNetwork() {
		if (!networkIdInput.trim()) return;
		await evmP2PService.joinNetwork(networkIdInput.trim());
	}

	function handleLeaveNetwork() {
		evmP2PService.leaveNetwork();
	}

	function formatPeerId(id: string): string {
		if (!id) return '-';
		if (id.length <= 20) return id;
		return `${id.slice(0, 8)}...${id.slice(-8)}`;
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">P2P Network</h1>
		<a href="/admin/evm" class="btn btn-ghost btn-sm">&larr; Back to Dashboard</a>
	</div>

	<!-- Connection Status Card -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Connection Status</h2>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
				<div class="stat bg-base-100 rounded-lg">
					<div class="stat-title">Status</div>
					<div class="stat-value text-lg">
						{#if p2pState.isConnecting}
							<span class="text-warning">Connecting...</span>
						{:else if p2pState.isConnected}
							<span class="text-success">Connected</span>
						{:else}
							<span class="text-error">Disconnected</span>
						{/if}
					</div>
				</div>

				<div class="stat bg-base-100 rounded-lg">
					<div class="stat-title">Peers</div>
					<div class="stat-value text-lg">{p2pState.peers.length}</div>
				</div>

				<div class="stat bg-base-100 rounded-lg">
					<div class="stat-title">Relays</div>
					<div class="stat-value text-lg">{p2pState.relayCount}</div>
				</div>

				<div class="stat bg-base-100 rounded-lg">
					<div class="stat-title">Role</div>
					<div class="stat-value text-lg">
						{#if p2pState.isLeader}
							<span class="badge badge-primary">Leader</span>
						{:else if p2pState.isConnected}
							<span class="badge badge-ghost">Validator</span>
						{:else}
							<span class="text-base-content/50">-</span>
						{/if}
					</div>
				</div>
			</div>

			{#if p2pState.error}
				<div class="alert alert-error mt-4">
					<span>{p2pState.error}</span>
				</div>
			{/if}

			{#if !p2pState.isConnected}
				<div class="card-actions mt-4">
					<div class="join">
						<input
							type="text"
							class="input input-bordered join-item"
							placeholder="Network ID"
							bind:value={networkIdInput}
						/>
						<button
							class="btn btn-primary join-item"
							onclick={handleJoinNetwork}
							disabled={p2pState.isConnecting}
						>
							{p2pState.isConnecting ? 'Connecting...' : 'Join Network'}
						</button>
					</div>
				</div>
			{:else}
				<div class="card-actions mt-4">
					<button class="btn btn-error" onclick={handleLeaveNetwork}>Leave Network</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Network Info -->
	{#if p2pState.isConnected}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Network Information</h2>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
					<div>
						<p class="text-sm text-base-content/60">Network ID</p>
						<p class="font-mono">{p2pState.networkId}</p>
					</div>
					<div>
						<p class="text-sm text-base-content/60">Your Peer ID</p>
						<div class="flex items-center gap-2">
							<code class="text-sm">{p2pState.selfId}</code>
							<button
								class="btn btn-ghost btn-xs"
								onclick={() => copyToClipboard(p2pState.selfId || '')}
							>
								Copy
							</button>
						</div>
					</div>
					<div>
						<p class="text-sm text-base-content/60">Current Leader</p>
						{#if p2pState.isLeader}
							<span class="badge badge-primary">You</span>
						{:else if p2pState.currentLeader}
							<code class="text-sm">{formatPeerId(p2pState.currentLeader)}</code>
						{:else}
							<span class="text-base-content/50">Electing...</span>
						{/if}
					</div>
					<div>
						<p class="text-sm text-base-content/60">Latest Block</p>
						<p class="font-semibold">#{p2pState.latestBlock}</p>
					</div>
					<div>
						<p class="text-sm text-base-content/60">Pending Transactions</p>
						<p class="font-semibold">{p2pState.pendingTxCount}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Connected Peers -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Connected Peers ({p2pState.peers.length})</h2>

				{#if p2pState.peers.length === 0}
					<p class="text-base-content/60">
						No other peers connected yet. Share the network ID with others to connect.
					</p>
				{:else}
					<div class="space-y-2 mt-4">
						{#each p2pState.peers as peer}
							<div class="flex items-center gap-3 p-3 bg-base-100 rounded-lg">
								<div class="w-3 h-3 rounded-full bg-success"></div>
								<code class="flex-1 text-sm">{peer}</code>
								{#if peer === p2pState.currentLeader}
									<span class="badge badge-primary badge-sm">Leader</span>
								{/if}
								<button class="btn btn-ghost btn-xs" onclick={() => copyToClipboard(peer)}>
									Copy ID
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Relay Status -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Nostr Relays (Signaling)</h2>
			<p class="text-sm text-base-content/60">
				These relays are used for peer discovery and WebRTC signaling.
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
				{#each relays as relay}
					<div class="flex items-center gap-2 p-2 bg-base-100 rounded">
						<div
							class={classNames('w-2 h-2 rounded-full', {
								'bg-success': p2pState.isConnected,
								'bg-base-content/30': !p2pState.isConnected
							})}
						></div>
						<code class="text-xs flex-1">{relay}</code>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- How It Works -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">How P2P Consensus Works</h2>

			<div class="prose prose-sm max-w-none mt-4">
				<ol class="space-y-2">
					<li>
						<strong>Join a Network:</strong> Enter a network ID to join. Peers with the same ID connect
						via WebRTC using Nostr relays for signaling.
					</li>
					<li>
						<strong>Leader Election:</strong> The peer with the lowest ID becomes the leader. Leadership
						is re-elected when peers join or leave.
					</li>
					<li>
						<strong>Transaction Broadcast:</strong> When you send a transaction, it's broadcast to all
						connected peers and added to the pending pool.
					</li>
					<li>
						<strong>Block Production:</strong> The leader produces blocks every 5 seconds (if there are
						pending transactions) and broadcasts them.
					</li>
					<li>
						<strong>Validation:</strong> Peers validate incoming blocks by checking the signature and
						transaction validity before applying state changes.
					</li>
				</ol>
			</div>
		</div>
	</div>
</div>
