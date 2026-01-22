<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import { evmService } from '$services/evm.service';
	import { evmP2PService, type EvmP2PState } from '$services/evm-p2p.service';
	import type { ChainState, WalletInfo } from '$types/evm.type';

	let chainState: ChainState | null = $state(null);
	let wallets: WalletInfo[] = $state([]);
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
	let newWalletName = $state('');
	let selectedWallet = $state<string | null>(null);
	let faucetAmount = $state('1000000000000000000'); // 1 ETH in wei

	onMount(() => {
		loadData();

		const unsubscribe = evmP2PService.store.subscribe((state) => {
			p2pState = state;
		});

		return unsubscribe;
	});

	async function loadData() {
		try {
			chainState = await evmService.getChainState();
			wallets = await evmService.listWallets();
		} catch (err) {
			console.error('Failed to load EVM data:', err);
		}
	}

	async function handleJoinNetwork() {
		if (!networkIdInput.trim()) return;
		await evmP2PService.joinNetwork(networkIdInput.trim());
	}

	function handleLeaveNetwork() {
		evmP2PService.leaveNetwork();
	}

	async function handleCreateWallet() {
		try {
			const address = await evmService.createWallet(newWalletName || undefined);
			newWalletName = '';
			wallets = await evmService.listWallets();
			selectedWallet = address;
		} catch (err) {
			console.error('Failed to create wallet:', err);
		}
	}

	async function handleFaucet() {
		if (!selectedWallet) return;
		try {
			await evmService.setBalance(selectedWallet, faucetAmount);
			await loadData();
		} catch (err) {
			console.error('Failed to faucet:', err);
		}
	}

	async function getWalletBalance(address: string): Promise<string> {
		try {
			const balance = await evmService.getBalance(address);
			// Convert from wei to ETH (divide by 10^18)
			const ethBalance = Number(balance) / 1e18;
			return ethBalance.toFixed(4);
		} catch {
			return '0';
		}
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between flex-wrap gap-4">
		<h1 class="text-2xl font-bold">EVM Network</h1>
		<div class="flex gap-2">
			<a href="/admin/evm/contracts" class="btn btn-outline btn-sm">Contracts</a>
			<a href="/admin/evm/explorer" class="btn btn-outline btn-sm">Explorer</a>
			<a href="/admin/evm/network" class="btn btn-outline btn-sm">P2P Network</a>
		</div>
	</div>

	<!-- Network Status -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Network Status</h2>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
					<div class="stat-title">Latest Block</div>
					<div class="stat-value text-lg">#{p2pState.latestBlock}</div>
				</div>

				<div class="stat bg-base-100 rounded-lg">
					<div class="stat-title">Pending Txs</div>
					<div class="stat-value text-lg">{p2pState.pendingTxCount}</div>
				</div>
			</div>

			{#if p2pState.isConnected}
				<div class="mt-4 space-y-2 text-sm">
					<p><strong>Network ID:</strong> {p2pState.networkId}</p>
					<p><strong>Your ID:</strong> <code class="text-xs">{p2pState.selfId?.slice(0, 16)}...</code></p>
					<p>
						<strong>Leader:</strong>
						{#if p2pState.isLeader}
							<span class="badge badge-primary">You</span>
						{:else}
							<code class="text-xs">{p2pState.currentLeader?.slice(0, 16)}...</code>
						{/if}
					</p>
					<p><strong>Relays:</strong> {p2pState.relayCount} connected</p>
				</div>
			{/if}

			<div class="card-actions mt-4">
				{#if p2pState.isConnected}
					<button class="btn btn-error" onclick={handleLeaveNetwork}>
						Leave Network
					</button>
				{:else}
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
				{/if}
			</div>
		</div>
	</div>

	<!-- Chain State -->
	{#if chainState}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Chain State</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="stat bg-base-100 rounded-lg">
						<div class="stat-title">Total Accounts</div>
						<div class="stat-value text-lg">{chainState.totalAccounts}</div>
					</div>
					<div class="stat bg-base-100 rounded-lg">
						<div class="stat-title">Total Contracts</div>
						<div class="stat-value text-lg">{chainState.totalContracts}</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Wallets -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Wallets</h2>

			<div class="flex gap-2 mb-4">
				<input
					type="text"
					class="input input-bordered flex-1"
					placeholder="Wallet name (optional)"
					bind:value={newWalletName}
				/>
				<button class="btn btn-primary" onclick={handleCreateWallet}>
					Create Wallet
				</button>
			</div>

			{#if wallets.length === 0}
				<p class="text-base-content/60">No wallets yet. Create one to get started.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Address</th>
								<th>Balance</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each wallets as wallet}
								<tr class={classNames({ 'bg-primary/10': selectedWallet === wallet.address })}>
									<td>{wallet.name || '(unnamed)'}</td>
									<td>
										<code class="text-xs">{wallet.address}</code>
									</td>
									<td>
										{#await getWalletBalance(wallet.address)}
											<span class="loading loading-spinner loading-xs"></span>
										{:then balance}
											{balance} ETH
										{/await}
									</td>
									<td>
										<button
											class="btn btn-xs btn-ghost"
											onclick={() => (selectedWallet = wallet.address)}
										>
											Select
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if selectedWallet}
				<div class="divider"></div>
				<h3 class="font-semibold">Faucet</h3>
				<div class="flex gap-2">
					<input
						type="text"
						class="input input-bordered flex-1"
						placeholder="Amount in wei"
						bind:value={faucetAmount}
					/>
					<button class="btn btn-secondary" onclick={handleFaucet}>
						Fund Wallet
					</button>
				</div>
				<p class="text-xs text-base-content/60 mt-1">
					Selected: <code>{selectedWallet}</code>
				</p>
			{/if}
		</div>
	</div>

	<!-- Connected Peers -->
	{#if p2pState.peers.length > 0}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Connected Peers</h2>
				<div class="space-y-2">
					{#each p2pState.peers as peer}
						<div class="flex items-center gap-2 p-2 bg-base-100 rounded-lg">
							<div class="w-2 h-2 rounded-full bg-success"></div>
							<code class="text-sm">{peer}</code>
							{#if peer === p2pState.currentLeader}
								<span class="badge badge-primary badge-sm">Leader</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
