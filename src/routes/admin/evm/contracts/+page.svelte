<script lang="ts">
	import { onMount } from 'svelte';
	import { evmService } from '$services/evm.service';
	import { evmP2PService, type EvmP2PState } from '$services/evm-p2p.service';
	import type { WalletInfo, ExecutionResult } from '$types/evm.type';

	let wallets: WalletInfo[] = $state([]);
	let selectedWallet = $state<string | null>(null);
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

	// Deploy contract
	let bytecodeInput = $state('');
	let deployResult: ExecutionResult | null = $state(null);
	let isDeploying = $state(false);

	// Call contract
	let contractAddress = $state('');
	let callData = $state('');
	let callResult: string | null = $state(null);
	let isCalling = $state(false);

	// Send transaction
	let txTo = $state('');
	let txValue = $state('0');
	let txData = $state('');
	let txResult: ExecutionResult | null = $state(null);
	let isSending = $state(false);

	onMount(() => {
		loadWallets();

		const unsubscribe = evmP2PService.store.subscribe((state) => {
			p2pState = state;
		});

		return unsubscribe;
	});

	async function loadWallets() {
		try {
			wallets = await evmService.listWallets();
			if (wallets.length > 0 && !selectedWallet) {
				selectedWallet = wallets[0].address;
			}
		} catch (err) {
			console.error('Failed to load wallets:', err);
		}
	}

	async function handleDeploy() {
		if (!selectedWallet || !bytecodeInput.trim()) return;

		isDeploying = true;
		deployResult = null;

		try {
			deployResult = await evmService.deployContract(selectedWallet, bytecodeInput.trim());
		} catch (err) {
			console.error('Deploy failed:', err);
			deployResult = {
				success: false,
				output: null,
				contractAddress: null,
				gasUsed: 0,
				logs: [],
				error: err instanceof Error ? err.message : 'Unknown error'
			};
		} finally {
			isDeploying = false;
		}
	}

	async function handleCall() {
		if (!selectedWallet || !contractAddress.trim() || !callData.trim()) return;

		isCalling = true;
		callResult = null;

		try {
			callResult = await evmService.call(selectedWallet, contractAddress.trim(), callData.trim());
		} catch (err) {
			console.error('Call failed:', err);
			callResult = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isCalling = false;
		}
	}

	async function handleSendTransaction() {
		if (!selectedWallet) return;

		isSending = true;
		txResult = null;

		try {
			txResult = await evmService.sendTransaction(
				selectedWallet,
				txTo.trim() || null,
				txValue,
				txData.trim() || undefined
			);
		} catch (err) {
			console.error('Transaction failed:', err);
			txResult = {
				success: false,
				output: null,
				contractAddress: null,
				gasUsed: 0,
				logs: [],
				error: err instanceof Error ? err.message : 'Unknown error'
			};
		} finally {
			isSending = false;
		}
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Smart Contracts</h1>
		<a href="/admin/evm" class="btn btn-ghost btn-sm">← Back to Dashboard</a>
	</div>

	<!-- Wallet Selector -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Active Wallet</h2>

			{#if wallets.length === 0}
				<p class="text-base-content/60">
					No wallets available. <a href="/admin/evm" class="link link-primary">Create one first</a>.
				</p>
			{:else}
				<select class="select select-bordered w-full max-w-md" bind:value={selectedWallet}>
					{#each wallets as wallet}
						<option value={wallet.address}>
							{wallet.name || '(unnamed)'} - {wallet.address.slice(0, 10)}...
						</option>
					{/each}
				</select>
			{/if}
		</div>
	</div>

	<!-- Deploy Contract -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Deploy Contract</h2>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Contract Bytecode (hex)</span>
				</label>
				<textarea
					class="textarea textarea-bordered h-32 font-mono text-sm"
					placeholder="0x608060405234801561001057600080fd5b50..."
					bind:value={bytecodeInput}
				></textarea>
			</div>

			<div class="card-actions mt-4">
				<button
					class="btn btn-primary"
					onclick={handleDeploy}
					disabled={isDeploying || !selectedWallet || !bytecodeInput.trim()}
				>
					{isDeploying ? 'Deploying...' : 'Deploy Contract'}
				</button>
			</div>

			{#if deployResult}
				<div class="mt-4 p-4 rounded-lg {deployResult.success ? 'bg-success/20' : 'bg-error/20'}">
					{#if deployResult.success}
						<p class="font-semibold text-success">Contract Deployed!</p>
						<p class="text-sm mt-2">
							<strong>Address:</strong>
							<code class="break-all">{deployResult.contractAddress}</code>
						</p>
						<p class="text-sm">
							<strong>Gas Used:</strong> {deployResult.gasUsed}
						</p>
					{:else}
						<p class="font-semibold text-error">Deployment Failed</p>
						<p class="text-sm mt-2">{deployResult.error}</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Call Contract -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Call Contract (Read-Only)</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Contract Address</span>
					</label>
					<input
						type="text"
						class="input input-bordered font-mono text-sm"
						placeholder="0x..."
						bind:value={contractAddress}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Call Data (hex)</span>
					</label>
					<input
						type="text"
						class="input input-bordered font-mono text-sm"
						placeholder="0x..."
						bind:value={callData}
					/>
				</div>
			</div>

			<div class="card-actions mt-4">
				<button
					class="btn btn-secondary"
					onclick={handleCall}
					disabled={isCalling || !selectedWallet || !contractAddress.trim() || !callData.trim()}
				>
					{isCalling ? 'Calling...' : 'Call Contract'}
				</button>
			</div>

			{#if callResult}
				<div class="mt-4 p-4 rounded-lg bg-base-100">
					<p class="font-semibold">Result:</p>
					<code class="text-sm break-all">{callResult}</code>
				</div>
			{/if}
		</div>
	</div>

	<!-- Send Transaction -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h2 class="card-title">Send Transaction</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">To Address (empty for contract creation)</span>
					</label>
					<input
						type="text"
						class="input input-bordered font-mono text-sm"
						placeholder="0x... or leave empty"
						bind:value={txTo}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Value (wei)</span>
					</label>
					<input
						type="text"
						class="input input-bordered font-mono text-sm"
						placeholder="0"
						bind:value={txValue}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Data (hex, optional)</span>
					</label>
					<input
						type="text"
						class="input input-bordered font-mono text-sm"
						placeholder="0x..."
						bind:value={txData}
					/>
				</div>
			</div>

			<div class="card-actions mt-4">
				<button
					class="btn btn-primary"
					onclick={handleSendTransaction}
					disabled={isSending || !selectedWallet}
				>
					{isSending ? 'Sending...' : 'Send Transaction'}
				</button>
			</div>

			{#if txResult}
				<div class="mt-4 p-4 rounded-lg {txResult.success ? 'bg-success/20' : 'bg-error/20'}">
					{#if txResult.success}
						<p class="font-semibold text-success">Transaction Successful!</p>
						{#if txResult.contractAddress}
							<p class="text-sm mt-2">
								<strong>Contract Created:</strong>
								<code class="break-all">{txResult.contractAddress}</code>
							</p>
						{/if}
						<p class="text-sm">
							<strong>Gas Used:</strong> {txResult.gasUsed}
						</p>
						{#if txResult.logs.length > 0}
							<p class="text-sm">
								<strong>Logs:</strong> {txResult.logs.length} events emitted
							</p>
						{/if}
					{:else}
						<p class="font-semibold text-error">Transaction Failed</p>
						<p class="text-sm mt-2">{txResult.error}</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
