import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type {
	P2PTransaction,
	P2PBlock,
	P2PStateRequest,
	P2PStateResponse,
	SignedTransaction,
	Block
} from '$types/evm.type';
import { evmService } from './evm.service';

// Nostr relays for P2P signaling
const NOSTR_RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.nostr.band',
	'wss://nostr.wine',
	'wss://relay.primal.net',
	'wss://purplepag.es'
];

// ICE servers for WebRTC NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
	{
		urls: 'turn:openrelay.metered.ca:443',
		username: 'openrelayproject',
		credential: 'openrelayproject'
	}
];

export interface EvmP2PState {
	isConnected: boolean;
	isConnecting: boolean;
	networkId: string | null;
	selfId: string | null;
	peers: string[];
	pendingTxCount: number;
	latestBlock: number;
	relayCount: number;
	error: string | null;
	// Consensus state
	isLeader: boolean;
	currentLeader: string | null;
}

// Block production interval (ms)
const BLOCK_INTERVAL = 5000;

const initialState: EvmP2PState = {
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
};

class EvmP2PService {
	public store: Writable<EvmP2PState>;
	private room: any = null;
	private sendTransaction: ((data: P2PTransaction) => void) | null = null;
	private sendBlock: ((data: P2PBlock) => void) | null = null;
	private sendStateRequest: ((data: P2PStateRequest) => void) | null = null;
	private sendStateResponse: ((data: P2PStateResponse, peerId?: string) => void) | null = null;
	private pendingTxs: Map<string, SignedTransaction> = new Map();
	private blockProductionInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		this.store = writable<EvmP2PState>(initialState);
	}

	// ==================== Consensus: Leader Election ====================

	/**
	 * Determine the current leader using lowest peer ID
	 * Simple PoA: the peer with the lexicographically lowest ID is the leader
	 */
	private electLeader(): void {
		let state: EvmP2PState = initialState;
		this.store.subscribe((s) => (state = s))();

		if (!state.selfId) return;

		// All participants: self + peers
		const allPeers = [state.selfId, ...state.peers].sort();
		const leader = allPeers[0];
		const isLeader = leader === state.selfId;

		this.store.update((s) => ({
			...s,
			currentLeader: leader,
			isLeader
		}));

		console.log(`[EVM-P2P] Leader elected: ${leader} (self: ${isLeader})`);

		// Start/stop block production based on leadership
		if (isLeader) {
			this.startBlockProduction();
		} else {
			this.stopBlockProduction();
		}
	}

	/**
	 * Start producing blocks at regular intervals
	 */
	private startBlockProduction(): void {
		if (this.blockProductionInterval) return;

		console.log('[EVM-P2P] Starting block production...');

		this.blockProductionInterval = setInterval(() => {
			this.proposeBlock();
		}, BLOCK_INTERVAL);
	}

	/**
	 * Stop block production
	 */
	private stopBlockProduction(): void {
		if (this.blockProductionInterval) {
			clearInterval(this.blockProductionInterval);
			this.blockProductionInterval = null;
			console.log('[EVM-P2P] Stopped block production');
		}
	}

	/**
	 * Propose a new block with pending transactions
	 */
	private async proposeBlock(): Promise<void> {
		const pendingTxs = this.getPendingTransactions();

		// Only produce block if there are pending transactions
		if (pendingTxs.length === 0) {
			return;
		}

		let state: EvmP2PState = initialState;
		this.store.subscribe((s) => (state = s))();

		if (!state.isLeader || !state.selfId) {
			return;
		}

		const blockNumber = state.latestBlock + 1;
		const timestamp = Math.floor(Date.now() / 1000);

		// Compute simple hashes
		const parentHash = state.latestBlock === 0
			? '0x' + '0'.repeat(64)
			: await this.computeBlockHash(state.latestBlock);

		const txHashes = pendingTxs.map((tx) => tx.hash);
		const txRoot = this.computeMerkleRoot(txHashes);

		const block: Block = {
			number: blockNumber,
			hash: '', // Will be computed
			parentHash,
			stateRoot: '0x' + '0'.repeat(64), // Simplified
			transactionsRoot: txRoot,
			timestamp,
			proposer: state.selfId,
			signature: null
		};

		// Compute block hash
		block.hash = this.computeBlockHashFromBlock(block);

		// Sign the block (simplified - just use proposer ID as signature)
		const signature = `signed-by-${state.selfId}`;

		console.log(`[EVM-P2P] Proposing block #${blockNumber} with ${pendingTxs.length} txs`);

		// Broadcast block
		await this.broadcastBlock(block, signature);
	}

	/**
	 * Compute a simple block hash
	 */
	private computeBlockHashFromBlock(block: Block): string {
		const data = `${block.number}:${block.parentHash}:${block.transactionsRoot}:${block.timestamp}:${block.proposer}`;
		// Simple hash using btoa (in production, use proper keccak256)
		const hash = btoa(data).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64).padEnd(64, '0');
		return '0x' + hash;
	}

	/**
	 * Compute block hash for a block number (placeholder)
	 */
	private async computeBlockHash(blockNumber: number): Promise<string> {
		// In production, query the DB for the actual block hash
		return '0x' + blockNumber.toString(16).padStart(64, '0');
	}

	/**
	 * Compute a simple merkle root from transaction hashes
	 */
	private computeMerkleRoot(hashes: string[]): string {
		if (hashes.length === 0) {
			return '0x' + '0'.repeat(64);
		}
		// Simplified: just concatenate and hash
		const combined = hashes.join('');
		const hash = btoa(combined).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64).padEnd(64, '0');
		return '0x' + hash;
	}

	/**
	 * Validate an incoming block
	 */
	private validateBlock(block: Block, signature: string, peerId: string): boolean {
		let state: EvmP2PState = initialState;
		this.store.subscribe((s) => (state = s))();

		// Check block number is sequential
		if (block.number !== state.latestBlock + 1) {
			console.warn(`[EVM-P2P] Block #${block.number} rejected: expected #${state.latestBlock + 1}`);
			return false;
		}

		// Check proposer is the current leader
		if (block.proposer !== state.currentLeader) {
			console.warn(`[EVM-P2P] Block rejected: proposer ${block.proposer} is not leader ${state.currentLeader}`);
			return false;
		}

		// Verify signature matches proposer (simplified)
		if (signature !== `signed-by-${block.proposer}`) {
			console.warn('[EVM-P2P] Block rejected: invalid signature');
			return false;
		}

		return true;
	}

	/**
	 * Join an EVM network
	 * @param networkId Unique identifier for this EVM network
	 */
	async joinNetwork(networkId: string): Promise<void> {
		if (!browser) return;

		const trimmedId = networkId.trim();
		if (!trimmedId) return;

		if (this.room) {
			this.leaveNetwork();
		}

		this.store.update((s) => ({ ...s, isConnecting: true, error: null }));

		try {
			const { joinRoom, selfId } = await import('trystero/nostr');

			const config = {
				appId: `synaxis-evm-${trimmedId}`,
				relayUrls: NOSTR_RELAYS,
				rtcConfig: { iceServers: ICE_SERVERS }
			};

			this.room = joinRoom(config, trimmedId);

			// Peer events
			this.room.onPeerJoin((peerId: string) => {
				console.log(`[EVM-P2P] Peer joined: ${peerId}`);
				this.store.update((s) => ({
					...s,
					peers: [...s.peers, peerId]
				}));
				// Re-elect leader when peers change
				this.electLeader();
				// Request state sync from new peer
				this.requestStateSync();
			});

			this.room.onPeerLeave((peerId: string) => {
				console.log(`[EVM-P2P] Peer left: ${peerId}`);
				this.store.update((s) => ({
					...s,
					peers: s.peers.filter((p) => p !== peerId)
				}));
				// Re-elect leader when peers change
				this.electLeader();
			});

			// Set up message channels
			const [sendTx, receiveTx] = this.room.makeAction('evm_transaction');
			const [sendBlock, receiveBlock] = this.room.makeAction('evm_block');
			const [sendStateReq, receiveStateReq] = this.room.makeAction('evm_state_request');
			const [sendStateRes, receiveStateRes] = this.room.makeAction('evm_state_response');

			this.sendTransaction = sendTx;
			this.sendBlock = sendBlock;
			this.sendStateRequest = sendStateReq;
			this.sendStateResponse = sendStateRes;

			// Handle incoming messages
			receiveTx((data: P2PTransaction, peerId: string) => {
				this.handleTransaction(data, peerId);
			});

			receiveBlock((data: P2PBlock, peerId: string) => {
				this.handleBlock(data, peerId);
			});

			receiveStateReq((data: P2PStateRequest, peerId: string) => {
				this.handleStateRequest(data, peerId);
			});

			receiveStateRes((data: P2PStateResponse, peerId: string) => {
				this.handleStateResponse(data, peerId);
			});

			// Check relay status
			const { getRelaySockets } = await import('trystero/nostr');
			setTimeout(() => {
				const sockets = getRelaySockets();
				const connectedCount = Object.values(sockets).filter(
					(socket) => socket && (socket as WebSocket).readyState === WebSocket.OPEN
				).length;
				this.store.update((s) => ({ ...s, relayCount: connectedCount }));
			}, 2000);

			// Update chain state from local DB
			const chainState = await evmService.getChainState();

			this.store.update((s) => ({
				...s,
				isConnected: true,
				isConnecting: false,
				networkId: trimmedId,
				selfId: selfId,
				latestBlock: Number(chainState.latestBlock),
				pendingTxCount: Number(chainState.pendingTxCount)
			}));

			// Initial leader election (we're alone until peers join)
			this.electLeader();

			console.log(`[EVM-P2P] Connected to network: ${trimmedId}`);
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			this.store.update((s) => ({
				...s,
				isConnected: false,
				isConnecting: false,
				error: msg
			}));
		}
	}

	/**
	 * Broadcast a transaction to all peers
	 */
	async broadcastTransaction(tx: SignedTransaction): Promise<void> {
		if (!this.sendTransaction) {
			console.warn('[EVM-P2P] Not connected to network');
			return;
		}

		const message: P2PTransaction = {
			type: 'transaction',
			tx,
			timestamp: Date.now()
		};

		// Add to pending pool
		this.pendingTxs.set(tx.hash, tx);
		this.store.update((s) => ({ ...s, pendingTxCount: this.pendingTxs.size }));

		// Broadcast to all peers
		this.sendTransaction(message);
		console.log(`[EVM-P2P] Broadcast tx: ${tx.hash}`);
	}

	/**
	 * Broadcast a new block (when this peer is the proposer)
	 */
	async broadcastBlock(block: Block, signature: string): Promise<void> {
		if (!this.sendBlock) {
			console.warn('[EVM-P2P] Not connected to network');
			return;
		}

		const message: P2PBlock = {
			type: 'block',
			block,
			signature
		};

		this.sendBlock(message);
		console.log(`[EVM-P2P] Broadcast block: ${block.number}`);

		// Clear pending txs that are now in the block
		// (In a real implementation, we'd check which txs are in the block)
		this.pendingTxs.clear();
		this.store.update((s) => ({
			...s,
			latestBlock: block.number,
			pendingTxCount: 0
		}));
	}

	/**
	 * Request state sync from peers
	 */
	private requestStateSync(): void {
		if (!this.sendStateRequest) return;

		let currentBlock = 0;
		this.store.subscribe((s) => {
			currentBlock = s.latestBlock;
		})();

		const request: P2PStateRequest = {
			type: 'state_request',
			fromBlock: currentBlock
		};

		this.sendStateRequest(request);
		console.log(`[EVM-P2P] Requesting state from block ${currentBlock}`);
	}

	/**
	 * Handle incoming transaction
	 */
	private async handleTransaction(data: P2PTransaction, peerId: string): Promise<void> {
		console.log(`[EVM-P2P] Received tx from ${peerId}: ${data.tx.hash}`);

		// Validate transaction signature
		// TODO: Implement signature verification

		// Add to pending pool if not already present
		if (!this.pendingTxs.has(data.tx.hash)) {
			this.pendingTxs.set(data.tx.hash, data.tx);
			this.store.update((s) => ({ ...s, pendingTxCount: this.pendingTxs.size }));

			// Execute transaction locally
			try {
				await evmService.sendTransaction(
					data.tx.from,
					data.tx.to,
					data.tx.value,
					data.tx.input || undefined
				);
				console.log(`[EVM-P2P] Executed tx: ${data.tx.hash}`);
			} catch (err) {
				console.error(`[EVM-P2P] Failed to execute tx: ${err}`);
			}
		}
	}

	/**
	 * Handle incoming block
	 */
	private async handleBlock(data: P2PBlock, peerId: string): Promise<void> {
		console.log(`[EVM-P2P] Received block from ${peerId}: ${data.block.number}`);

		// Validate block
		if (!this.validateBlock(data.block, data.signature, peerId)) {
			console.warn(`[EVM-P2P] Rejected invalid block #${data.block.number}`);
			return;
		}

		console.log(`[EVM-P2P] Accepted block #${data.block.number}`);

		// Update local state
		this.store.update((s) => ({
			...s,
			latestBlock: data.block.number
		}));

		// Clear pending txs that are now in the block
		this.pendingTxs.clear();
		this.store.update((s) => ({ ...s, pendingTxCount: 0 }));
	}

	/**
	 * Handle state sync request
	 */
	private async handleStateRequest(data: P2PStateRequest, peerId: string): Promise<void> {
		console.log(`[EVM-P2P] State request from ${peerId}, from block ${data.fromBlock}`);

		// TODO: Query local DB for blocks since fromBlock
		// For now, just acknowledge
		if (this.sendStateResponse) {
			const response: P2PStateResponse = {
				type: 'state_response',
				blocks: [] // Would populate with actual blocks
			};
			// Note: Trystero doesn't support targeted sends easily,
			// so this broadcasts to all. In production, use a different approach.
			this.sendStateResponse(response);
		}
	}

	/**
	 * Handle state sync response
	 */
	private async handleStateResponse(data: P2PStateResponse, peerId: string): Promise<void> {
		console.log(`[EVM-P2P] State response from ${peerId}: ${data.blocks.length} blocks`);

		// TODO: Apply received blocks to local state
		if (data.blocks.length > 0) {
			const latestBlock = data.blocks[data.blocks.length - 1];
			this.store.update((s) => ({
				...s,
				latestBlock: Math.max(s.latestBlock, latestBlock.number)
			}));
		}
	}

	/**
	 * Leave the network
	 */
	leaveNetwork(): void {
		// Stop block production
		this.stopBlockProduction();

		if (this.room) {
			try {
				this.room.leave();
			} catch {
				// Ignore
			}
			this.room = null;
		}

		this.sendTransaction = null;
		this.sendBlock = null;
		this.sendStateRequest = null;
		this.sendStateResponse = null;
		this.pendingTxs.clear();

		this.store.set(initialState);
		console.log('[EVM-P2P] Disconnected from network');
	}

	/**
	 * Get pending transactions
	 */
	getPendingTransactions(): SignedTransaction[] {
		return Array.from(this.pendingTxs.values());
	}
}

export const evmP2PService = new EvmP2PService();
