// EVM Types for frontend

export interface WalletInfo {
	address: string;
	name: string | null;
	createdAt: string;
}

export interface ExecutionResult {
	success: boolean;
	output: string | null;
	contractAddress: string | null;
	gasUsed: number;
	logs: Log[];
	error: string | null;
}

export interface Log {
	address: string;
	topics: string[];
	data: string;
	logIndex: number;
}

export interface ChainState {
	latestBlock: number;
	pendingTxCount: number;
	totalAccounts: number;
	totalContracts: number;
}

export interface Transaction {
	hash: string;
	from: string;
	to: string | null;
	value: string;
	input: string;
	nonce: number;
	blockNumber: number | null;
	status: 'pending' | 'success' | 'failed';
}

export interface Block {
	number: number;
	hash: string;
	parentHash: string;
	stateRoot: string;
	transactionsRoot: string;
	timestamp: number;
	proposer: string;
	signature: string | null;
}

export interface TransactionReceipt {
	txHash: string;
	blockNumber: number;
	contractAddress: string | null;
	status: boolean;
	gasUsed: number;
	logs: Log[];
}

// P2P Message Types
export interface P2PTransaction {
	type: 'transaction';
	tx: SignedTransaction;
	timestamp: number;
}

export interface SignedTransaction {
	hash: string;
	from: string;
	to: string | null;
	value: string;
	input: string;
	nonce: number;
	signature: string;
}

export interface P2PBlock {
	type: 'block';
	block: Block;
	signature: string;
}

export interface P2PStateRequest {
	type: 'state_request';
	fromBlock: number;
}

export interface P2PStateResponse {
	type: 'state_response';
	blocks: Block[];
}

export type P2PMessage = P2PTransaction | P2PBlock | P2PStateRequest | P2PStateResponse;
