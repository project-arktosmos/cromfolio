# Action Plan: Embedded EVM Network with WebRTC P2P

## Overview

Build a private EVM network embedded in the Tauri app where:
- Users run smart contracts without gas costs
- Peers validate transactions transparently via WebRTC
- State syncs across connected peers using Trystero/Nostr signaling

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Tauri App                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  SvelteKit Frontend                                                      │
│    ├── P2P Service (Trystero/WebRTC)                                    │
│    │     ├── Transaction broadcast                                       │
│    │     ├── Block propagation                                          │
│    │     └── State sync requests                                        │
│    └── EVM UI (invoke Tauri commands)                                   │
│          ├── Deploy contract                                            │
│          ├── Call contract                                              │
│          └── View state                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Rust Backend (src-tauri/)                                              │
│    ├── evm/                                                             │
│    │     ├── executor.rs      ← revm execution engine                   │
│    │     ├── state.rs         ← SQLite state adapter for revm           │
│    │     ├── chain.rs         ← Block production & chain management     │
│    │     └── types.rs         ← Transaction, Block, Receipt types       │
│    ├── commands/evm.rs        ← Tauri commands                          │
│    └── db/queries/evm.rs      ← Persistence layer                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                              WebRTC Data Channel
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│  Nostr Relays (Signaling)                                               │
│    wss://relay.damus.io, wss://nos.lol, wss://relay.nostr.band, etc.   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                              Other Peers
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| EVM Execution | `revm` | Execute smart contracts |
| Ethereum Types | `alloy-primitives`, `alloy-sol-types` | Address, U256, ABI encoding |
| State Storage | SQLite (existing) | Persist accounts, contracts, blocks |
| P2P Transport | Trystero + WebRTC | Peer-to-peer communication |
| Signaling | Nostr relays | Decentralized peer discovery |
| Consensus | Simple PoA | Leader proposes, peers validate |

---

## Phase 1: Rust EVM Core (Backend)

### 1.1 Add Dependencies

**File:** `src-tauri/Cargo.toml`

```toml
[dependencies]
# EVM execution
revm = { version = "19", default-features = false, features = ["std", "serde"] }

# Ethereum primitives
alloy-primitives = { version = "0.8", features = ["serde"] }
alloy-sol-types = "0.8"
alloy-rlp = "0.3"

# Crypto for signing
k256 = { version = "0.13", features = ["ecdsa"] }
```

### 1.2 Create EVM Module Structure

```
src-tauri/src/evm/
├── mod.rs              # Module exports
├── executor.rs         # revm wrapper, tx execution
├── state.rs            # SQLite <-> revm state adapter
├── chain.rs            # Block production, chain state
├── types.rs            # Transaction, Block, Account types
└── errors.rs           # Custom error types
```

### 1.3 Database Schema

**File:** `src-tauri/src/db/connection.rs` (add to migrations)

```sql
-- EVM Accounts (EOA + Contracts)
CREATE TABLE IF NOT EXISTS evm_accounts (
    address TEXT PRIMARY KEY,           -- 0x-prefixed hex
    balance TEXT NOT NULL DEFAULT '0',  -- U256 as decimal string
    nonce INTEGER NOT NULL DEFAULT 0,
    code_hash TEXT,                      -- NULL for EOA, hash for contracts
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Contract Bytecode (separate for efficiency)
CREATE TABLE IF NOT EXISTS evm_code (
    code_hash TEXT PRIMARY KEY,
    bytecode BLOB NOT NULL
);

-- Contract Storage (key-value per contract)
CREATE TABLE IF NOT EXISTS evm_storage (
    address TEXT NOT NULL,
    slot TEXT NOT NULL,                  -- U256 as hex
    value TEXT NOT NULL,                 -- U256 as hex
    PRIMARY KEY (address, slot)
);

-- Blocks
CREATE TABLE IF NOT EXISTS evm_blocks (
    number INTEGER PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    parent_hash TEXT NOT NULL,
    state_root TEXT NOT NULL,
    transactions_root TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    proposer TEXT NOT NULL,              -- Peer ID who proposed
    signature TEXT                        -- Proposer's signature
);

-- Transactions
CREATE TABLE IF NOT EXISTS evm_transactions (
    hash TEXT PRIMARY KEY,
    block_number INTEGER,
    from_address TEXT NOT NULL,
    to_address TEXT,                     -- NULL for contract creation
    value TEXT NOT NULL,
    input BLOB,
    nonce INTEGER NOT NULL,
    signature TEXT NOT NULL,
    status INTEGER,                      -- 0=pending, 1=success, 2=failed
    gas_used INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (block_number) REFERENCES evm_blocks(number)
);

-- Transaction Receipts
CREATE TABLE IF NOT EXISTS evm_receipts (
    tx_hash TEXT PRIMARY KEY,
    block_number INTEGER NOT NULL,
    contract_address TEXT,               -- If contract creation
    logs BLOB,                           -- JSON array of logs
    status INTEGER NOT NULL,
    gas_used INTEGER NOT NULL,
    FOREIGN KEY (tx_hash) REFERENCES evm_transactions(hash)
);

-- Local Wallets (encrypted private keys)
CREATE TABLE IF NOT EXISTS evm_wallets (
    address TEXT PRIMARY KEY,
    encrypted_key BLOB NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL
);
```

### 1.4 Core Types

**File:** `src-tauri/src/evm/types.rs`

```rust
use alloy_primitives::{Address, B256, U256, Bytes};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub hash: B256,
    pub from: Address,
    pub to: Option<Address>,
    pub value: U256,
    pub input: Bytes,
    pub nonce: u64,
    pub signature: Bytes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    pub number: u64,
    pub hash: B256,
    pub parent_hash: B256,
    pub state_root: B256,
    pub transactions: Vec<B256>,
    pub timestamp: u64,
    pub proposer: String,  // Peer ID
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub address: Address,
    pub balance: U256,
    pub nonce: u64,
    pub code_hash: Option<B256>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionReceipt {
    pub tx_hash: B256,
    pub block_number: u64,
    pub contract_address: Option<Address>,
    pub status: bool,
    pub gas_used: u64,
    pub logs: Vec<Log>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Log {
    pub address: Address,
    pub topics: Vec<B256>,
    pub data: Bytes,
}
```

### 1.5 EVM Executor

**File:** `src-tauri/src/evm/executor.rs`

```rust
use revm::{
    Evm,
    db::{CacheDB, EmptyDB},
    primitives::{
        AccountInfo, Bytecode, ExecutionResult, Output,
        TransactTo, TxEnv, CfgEnv, BlockEnv, SpecId,
    },
};
use alloy_primitives::{Address, U256, Bytes, B256};
use crate::evm::state::SqliteState;

pub struct EvmExecutor {
    state: SqliteState,
}

impl EvmExecutor {
    pub fn new(state: SqliteState) -> Self {
        Self { state }
    }

    /// Execute a transaction with zero gas
    pub fn execute_tx(
        &mut self,
        from: Address,
        to: Option<Address>,
        value: U256,
        input: Bytes,
    ) -> Result<ExecutionResult, String> {
        let mut cache_db = CacheDB::new(&self.state);

        let mut evm = Evm::builder()
            .with_db(&mut cache_db)
            .modify_cfg_env(|cfg| {
                cfg.spec_id = SpecId::CANCUN;
                cfg.disable_base_fee = true;
                cfg.disable_block_gas_limit = true;
            })
            .modify_block_env(|block| {
                block.basefee = U256::ZERO;
            })
            .modify_tx_env(|tx| {
                tx.caller = from;
                tx.transact_to = match to {
                    Some(addr) => TransactTo::Call(addr),
                    None => TransactTo::Create,
                };
                tx.value = value;
                tx.data = input;
                tx.gas_limit = u64::MAX;
                tx.gas_price = U256::ZERO;
            })
            .build();

        let result = evm.transact_commit().map_err(|e| e.to_string())?;

        // Persist state changes to SQLite
        self.state.commit_changes(cache_db.accounts)?;

        Ok(result)
    }

    /// Call a contract (read-only, no state changes)
    pub fn call(
        &self,
        from: Address,
        to: Address,
        input: Bytes,
    ) -> Result<Bytes, String> {
        let mut cache_db = CacheDB::new(&self.state);

        let mut evm = Evm::builder()
            .with_db(&mut cache_db)
            .modify_cfg_env(|cfg| {
                cfg.spec_id = SpecId::CANCUN;
                cfg.disable_base_fee = true;
            })
            .modify_tx_env(|tx| {
                tx.caller = from;
                tx.transact_to = TransactTo::Call(to);
                tx.data = input;
                tx.gas_limit = u64::MAX;
                tx.gas_price = U256::ZERO;
            })
            .build();

        let result = evm.transact().map_err(|e| e.to_string())?;

        match result.result {
            ExecutionResult::Success { output, .. } => {
                match output {
                    Output::Call(data) => Ok(data),
                    Output::Create(data, _) => Ok(data),
                }
            }
            ExecutionResult::Revert { output, .. } => {
                Err(format!("Reverted: {}", hex::encode(output)))
            }
            ExecutionResult::Halt { reason, .. } => {
                Err(format!("Halted: {:?}", reason))
            }
        }
    }
}
```

### 1.6 SQLite State Adapter

**File:** `src-tauri/src/evm/state.rs`

```rust
use revm::Database;
use revm::primitives::{AccountInfo, Bytecode, B256, U256, Address};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub struct SqliteState {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteState {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    pub fn commit_changes(
        &self,
        accounts: impl IntoIterator<Item = (Address, revm::db::AccountState)>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        for (address, state) in accounts {
            // Update account balance, nonce, code
            // Update storage slots
            // Persist to SQLite tables
        }

        Ok(())
    }
}

impl Database for SqliteState {
    type Error = String;

    fn basic(&mut self, address: Address) -> Result<Option<AccountInfo>, Self::Error> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Query evm_accounts table
        // Return AccountInfo { balance, nonce, code_hash, code }

        Ok(None) // Default: account doesn't exist
    }

    fn code_by_hash(&mut self, code_hash: B256) -> Result<Bytecode, Self::Error> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Query evm_code table by code_hash
        // Return Bytecode

        Ok(Bytecode::default())
    }

    fn storage(&mut self, address: Address, index: U256) -> Result<U256, Self::Error> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Query evm_storage table
        // Return storage value at slot

        Ok(U256::ZERO)
    }

    fn block_hash(&mut self, number: u64) -> Result<B256, Self::Error> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Query evm_blocks table
        // Return block hash

        Ok(B256::ZERO)
    }
}
```

### 1.7 Tauri Commands

**File:** `src-tauri/src/commands/evm.rs`

```rust
use tauri::{command, State, AppHandle};
use crate::db::Database;
use crate::evm::{EvmExecutor, types::*};

#[command]
pub fn evm_get_balance(
    db: State<'_, Database>,
    address: String,
) -> Result<String, String> {
    // Return balance as decimal string
}

#[command]
pub fn evm_get_nonce(
    db: State<'_, Database>,
    address: String,
) -> Result<u64, String> {
    // Return account nonce
}

#[command]
pub async fn evm_send_transaction(
    app: AppHandle,
    db: State<'_, Database>,
    from: String,
    to: Option<String>,
    value: String,
    data: Option<String>,
) -> Result<String, String> {
    // 1. Build transaction
    // 2. Execute locally via revm
    // 3. Emit event for P2P broadcast
    // 4. Return tx hash

    app.emit("evm_tx_pending", &tx_hash)?;
    Ok(tx_hash)
}

#[command]
pub fn evm_call(
    db: State<'_, Database>,
    from: String,
    to: String,
    data: String,
) -> Result<String, String> {
    // Read-only call, return hex output
}

#[command]
pub fn evm_deploy_contract(
    app: AppHandle,
    db: State<'_, Database>,
    from: String,
    bytecode: String,
) -> Result<String, String> {
    // Deploy contract, return contract address
}

#[command]
pub fn evm_get_code(
    db: State<'_, Database>,
    address: String,
) -> Result<Option<String>, String> {
    // Return contract bytecode as hex
}

#[command]
pub fn evm_get_block(
    db: State<'_, Database>,
    number: u64,
) -> Result<Option<Block>, String> {
    // Return block by number
}

#[command]
pub fn evm_get_transaction(
    db: State<'_, Database>,
    hash: String,
) -> Result<Option<Transaction>, String> {
    // Return transaction by hash
}

#[command]
pub fn evm_get_receipt(
    db: State<'_, Database>,
    hash: String,
) -> Result<Option<TransactionReceipt>, String> {
    // Return receipt by tx hash
}

// Wallet management
#[command]
pub fn evm_create_wallet(
    db: State<'_, Database>,
    name: Option<String>,
) -> Result<String, String> {
    // Generate keypair, store encrypted, return address
}

#[command]
pub fn evm_list_wallets(
    db: State<'_, Database>,
) -> Result<Vec<WalletInfo>, String> {
    // Return list of wallets (address + name, no keys)
}

#[command]
pub fn evm_sign_transaction(
    db: State<'_, Database>,
    from: String,
    tx: UnsignedTransaction,
) -> Result<String, String> {
    // Sign tx with wallet's private key
}
```

---

## Phase 2: Frontend P2P Layer

### 2.1 Copy Trystero Setup

Copy from `../writing-tool.git`:
- `src/services/p2p.service.ts` → Adapt for EVM messages

### 2.2 Create EVM P2P Service

**File:** `src/services/evm-p2p.service.ts`

```typescript
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Message types for P2P
export interface P2PTransaction {
  type: 'transaction';
  tx: SignedTransaction;
  timestamp: number;
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
  latestState: AccountState[];
}

export type P2PMessage = P2PTransaction | P2PBlock | P2PStateRequest | P2PStateResponse;

// Nostr relays for signaling
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://purplepag.es'
];

// ICE servers for NAT traversal
const ICE_SERVERS = [
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
  networkId: string | null;
  selfId: string | null;
  peers: string[];
  pendingTxCount: number;
  latestBlock: number;
}

class EvmP2PService {
  public store: Writable<EvmP2PState>;
  private room: any = null;
  private sendTransaction: ((data: P2PTransaction) => void) | null = null;
  private sendBlock: ((data: P2PBlock) => void) | null = null;
  private sendStateRequest: ((data: P2PStateRequest) => void) | null = null;
  private sendStateResponse: ((data: P2PStateResponse, peerId: string) => void) | null = null;

  constructor() {
    this.store = writable({
      isConnected: false,
      networkId: null,
      selfId: null,
      peers: [],
      pendingTxCount: 0,
      latestBlock: 0
    });
  }

  async joinNetwork(networkId: string): Promise<void> {
    if (!browser) return;

    const { joinRoom, selfId } = await import('trystero/nostr');

    const config = {
      appId: `synaxis-evm-${networkId}`,
      relayUrls: NOSTR_RELAYS,
      rtcConfig: { iceServers: ICE_SERVERS }
    };

    this.room = joinRoom(config, networkId);

    // Set up peer events
    this.room.onPeerJoin((peerId: string) => {
      this.store.update(s => ({
        ...s,
        peers: [...s.peers, peerId]
      }));
      // Request state sync from new peer
      this.requestStateSync();
    });

    this.room.onPeerLeave((peerId: string) => {
      this.store.update(s => ({
        ...s,
        peers: s.peers.filter(p => p !== peerId)
      }));
    });

    // Set up message channels
    const [sendTx, receiveTx] = this.room.makeAction('transaction');
    const [sendBlock, receiveBlock] = this.room.makeAction('block');
    const [sendStateReq, receiveStateReq] = this.room.makeAction('state_request');
    const [sendStateRes, receiveStateRes] = this.room.makeAction('state_response');

    this.sendTransaction = sendTx;
    this.sendBlock = sendBlock;
    this.sendStateRequest = sendStateReq;
    this.sendStateResponse = sendStateRes;

    // Handle incoming messages
    receiveTx(this.handleTransaction.bind(this));
    receiveBlock(this.handleBlock.bind(this));
    receiveStateReq(this.handleStateRequest.bind(this));
    receiveStateRes(this.handleStateResponse.bind(this));

    this.store.update(s => ({
      ...s,
      isConnected: true,
      networkId,
      selfId: selfId
    }));
  }

  // Broadcast a new transaction to all peers
  async broadcastTransaction(tx: SignedTransaction): Promise<void> {
    if (!this.sendTransaction) return;

    const message: P2PTransaction = {
      type: 'transaction',
      tx,
      timestamp: Date.now()
    };

    this.sendTransaction(message);
  }

  // Broadcast a new block (when this peer is the proposer)
  async broadcastBlock(block: Block, signature: string): Promise<void> {
    if (!this.sendBlock) return;

    const message: P2PBlock = {
      type: 'block',
      block,
      signature
    };

    this.sendBlock(message);
  }

  private async handleTransaction(data: P2PTransaction, peerId: string): Promise<void> {
    // 1. Validate transaction signature
    // 2. Add to local mempool
    // 3. If we're the next block proposer, include in block
    console.log(`Received tx from ${peerId}:`, data.tx.hash);
  }

  private async handleBlock(data: P2PBlock, peerId: string): Promise<void> {
    // 1. Validate block (proposer signature, tx validity)
    // 2. Execute all transactions via revm
    // 3. Update local state
    // 4. Update latest block number
    console.log(`Received block from ${peerId}:`, data.block.number);
  }

  private async handleStateRequest(data: P2PStateRequest, peerId: string): Promise<void> {
    // Send blocks and state to requesting peer
  }

  private async handleStateResponse(data: P2PStateResponse, peerId: string): Promise<void> {
    // Sync local state with received data
  }

  private requestStateSync(): void {
    // Request state from peers when joining
  }

  leaveNetwork(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.store.set({
      isConnected: false,
      networkId: null,
      selfId: null,
      peers: [],
      pendingTxCount: 0,
      latestBlock: 0
    });
  }
}

export const evmP2PService = new EvmP2PService();
```

### 2.3 EVM Frontend Service

**File:** `src/services/evm.service.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';
import { evmP2PService } from './evm-p2p.service';

export interface Wallet {
  address: string;
  name: string | null;
}

export const evmService = {
  // Wallet management
  async createWallet(name?: string): Promise<string> {
    return await invoke('evm_create_wallet', { name });
  },

  async listWallets(): Promise<Wallet[]> {
    return await invoke('evm_list_wallets');
  },

  // Account queries
  async getBalance(address: string): Promise<string> {
    return await invoke('evm_get_balance', { address });
  },

  async getNonce(address: string): Promise<number> {
    return await invoke('evm_get_nonce', { address });
  },

  // Transactions
  async sendTransaction(
    from: string,
    to: string | null,
    value: string,
    data?: string
  ): Promise<string> {
    const txHash = await invoke<string>('evm_send_transaction', {
      from,
      to,
      value,
      data
    });

    // Broadcast to P2P network
    // (The Tauri command should return the signed tx for broadcast)

    return txHash;
  },

  // Contract interaction
  async call(from: string, to: string, data: string): Promise<string> {
    return await invoke('evm_call', { from, to, data });
  },

  async deployContract(from: string, bytecode: string): Promise<string> {
    return await invoke('evm_deploy_contract', { from, bytecode });
  },

  async getCode(address: string): Promise<string | null> {
    return await invoke('evm_get_code', { address });
  },

  // Block & transaction queries
  async getBlock(number: number): Promise<Block | null> {
    return await invoke('evm_get_block', { number });
  },

  async getTransaction(hash: string): Promise<Transaction | null> {
    return await invoke('evm_get_transaction', { hash });
  },

  async getReceipt(hash: string): Promise<TransactionReceipt | null> {
    return await invoke('evm_get_receipt', { hash });
  }
};
```

---

## Phase 3: Consensus Layer

### 3.1 Simple Proof of Authority

**Consensus Rules:**
1. Any connected peer can propose a block
2. Block is valid if:
   - All transactions have valid signatures
   - All transactions execute successfully
   - Block number = previous block + 1
   - Proposer is a connected peer
3. First valid block at height N wins (no forks)
4. Peers accept block and update state

**Block Production:**
- When mempool has transactions, any peer can propose
- Simple leader election: peer with lowest ID proposes
- Or: round-robin based on block number % peer count

### 3.2 State Sync Protocol

**When a new peer joins:**
1. Request latest block number from peers
2. If behind, request missing blocks
3. Apply blocks in order
4. Verify final state root matches peers

**Conflict Resolution:**
- If peers disagree on state, majority wins
- Peers with divergent state resync from majority

---

## Phase 4: Integration

### 4.1 Update lib.rs

**File:** `src-tauri/src/lib.rs`

```rust
mod evm;

// In setup:
app.manage(evm::EvmState::new(db.clone()));

// In generate_handler:
tauri::generate_handler![
    // ... existing commands
    commands::evm::evm_get_balance,
    commands::evm::evm_get_nonce,
    commands::evm::evm_send_transaction,
    commands::evm::evm_call,
    commands::evm::evm_deploy_contract,
    commands::evm::evm_get_code,
    commands::evm::evm_get_block,
    commands::evm::evm_get_transaction,
    commands::evm::evm_get_receipt,
    commands::evm::evm_create_wallet,
    commands::evm::evm_list_wallets,
    commands::evm::evm_sign_transaction,
]
```

### 4.2 Frontend Routes

```
src/routes/admin/evm/
├── +page.svelte           # Dashboard: network status, latest blocks
├── accounts/+page.svelte  # Wallet management, balances
├── contracts/+page.svelte # Deploy & interact with contracts
├── explorer/+page.svelte  # Block & transaction explorer
└── network/+page.svelte   # P2P network status, peers
```

---

## Implementation Order

### Week 1: Core EVM
- [ ] Add Cargo dependencies
- [ ] Create `src-tauri/src/evm/` module structure
- [ ] Implement SQLite state adapter
- [ ] Implement basic executor (execute single tx)
- [ ] Add database migrations for EVM tables
- [ ] Basic Tauri commands (get_balance, send_transaction, call)

### Week 2: Transactions & Blocks
- [ ] Wallet creation and signing
- [ ] Transaction validation and execution
- [ ] Block creation and storage
- [ ] Receipt generation
- [ ] Full Tauri command set

### Week 3: P2P Layer
- [ ] Port Trystero setup from writing-tool
- [ ] Implement evm-p2p.service.ts
- [ ] Transaction broadcast
- [ ] Block propagation
- [ ] Basic state sync

### Week 4: Consensus & UI
- [ ] Implement PoA consensus rules
- [ ] Leader election for block proposal
- [ ] State sync on peer join
- [ ] Admin UI pages
- [ ] Testing with multiple instances

---

## Testing Strategy

### Unit Tests
- `revm` execution with zero gas
- SQLite state adapter read/write
- Transaction signing/verification
- Block validation

### Integration Tests
- Full tx flow: sign → execute → persist
- P2P message serialization
- Multi-peer state sync

### E2E Tests
- Deploy contract from UI
- Call contract and verify result
- Multi-instance block propagation

---

## Security Considerations

1. **Private Keys**: Encrypted at rest in SQLite
2. **Transaction Signing**: All txs signed client-side
3. **Peer Verification**: Blocks must be signed by known peer
4. **No Gas Griefing**: Infinite gas means DoS is possible
   - Mitigate with tx size limits
   - Rate limiting per address
5. **State Integrity**: Merkle root verification on sync

---

## Future Enhancements

1. **Persistent Peer Identity**: Use same key for P2P and EVM wallet
2. **Contract Verification**: Store and display source code
3. **Events/Logs**: Real-time event streaming to UI
4. **Multi-Network**: Support multiple independent EVM networks
5. **Offline Mode**: Queue transactions when disconnected
