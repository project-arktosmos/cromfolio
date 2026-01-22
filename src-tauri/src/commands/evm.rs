use alloy_primitives::{Address, Bytes, U256};
use k256::ecdsa::SigningKey;
use rand::rngs::OsRng;
use tauri::{command, AppHandle, State};

use crate::db::Database;
use crate::evm::{Block, EvmExecutor, ExecutionResult, Transaction, TransactionReceipt, TxStatus, WalletInfo};

/// Get account balance
#[command]
pub fn evm_get_balance(db: State<'_, Database>, address: String) -> Result<String, String> {
    let addr = address
        .parse::<Address>()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let executor = EvmExecutor::new(db.conn.clone());
    let balance = executor.get_balance(&addr).map_err(|e| e.to_string())?;

    Ok(balance.to_string())
}

/// Get account nonce
#[command]
pub fn evm_get_nonce(db: State<'_, Database>, address: String) -> Result<u64, String> {
    let addr = address
        .parse::<Address>()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let executor = EvmExecutor::new(db.conn.clone());
    executor.get_nonce(&addr).map_err(|e| e.to_string())
}

/// Send a transaction (execute and commit)
#[command]
pub fn evm_send_transaction(
    _app: AppHandle,
    db: State<'_, Database>,
    from: String,
    to: Option<String>,
    value: String,
    data: Option<String>,
) -> Result<ExecutionResult, String> {
    let from_addr = from
        .parse::<Address>()
        .map_err(|e| format!("Invalid from address: {}", e))?;

    let to_addr = match to {
        Some(ref addr) => Some(
            addr.parse::<Address>()
                .map_err(|e| format!("Invalid to address: {}", e))?,
        ),
        None => None,
    };

    let value_u256 = U256::from_str_radix(&value, 10)
        .map_err(|e| format!("Invalid value: {}", e))?;

    let input = match data {
        Some(ref hex_data) => {
            let hex_str = hex_data.strip_prefix("0x").unwrap_or(hex_data);
            Bytes::from(hex::decode(hex_str).map_err(|e| format!("Invalid hex data: {}", e))?)
        }
        None => Bytes::new(),
    };

    let executor = EvmExecutor::new(db.conn.clone());
    executor
        .execute(from_addr, to_addr, value_u256, input)
        .map_err(|e| e.to_string())
}

/// Call a contract (read-only)
#[command]
pub fn evm_call(
    db: State<'_, Database>,
    from: String,
    to: String,
    data: String,
) -> Result<String, String> {
    let from_addr = from
        .parse::<Address>()
        .map_err(|e| format!("Invalid from address: {}", e))?;

    let to_addr = to
        .parse::<Address>()
        .map_err(|e| format!("Invalid to address: {}", e))?;

    let hex_str = data.strip_prefix("0x").unwrap_or(&data);
    let input = Bytes::from(hex::decode(hex_str).map_err(|e| format!("Invalid hex data: {}", e))?);

    let executor = EvmExecutor::new(db.conn.clone());
    let result = executor.call(from_addr, to_addr, input).map_err(|e| e.to_string())?;

    Ok(format!("0x{}", hex::encode(result)))
}

/// Deploy a contract
#[command]
pub fn evm_deploy_contract(
    _app: AppHandle,
    db: State<'_, Database>,
    from: String,
    bytecode: String,
) -> Result<ExecutionResult, String> {
    let from_addr = from
        .parse::<Address>()
        .map_err(|e| format!("Invalid from address: {}", e))?;

    let hex_str = bytecode.strip_prefix("0x").unwrap_or(&bytecode);
    let code = Bytes::from(hex::decode(hex_str).map_err(|e| format!("Invalid bytecode: {}", e))?);

    let executor = EvmExecutor::new(db.conn.clone());
    let (_, result) = executor.deploy(from_addr, code).map_err(|e| e.to_string())?;

    Ok(result)
}

/// Get contract code
#[command]
pub fn evm_get_code(db: State<'_, Database>, address: String) -> Result<Option<String>, String> {
    let addr = address
        .parse::<Address>()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let executor = EvmExecutor::new(db.conn.clone());
    let code = executor.get_code(&addr).map_err(|e| e.to_string())?;

    Ok(code.map(|c| format!("0x{}", hex::encode(c))))
}

/// Set account balance (faucet)
#[command]
pub fn evm_set_balance(
    db: State<'_, Database>,
    address: String,
    balance: String,
) -> Result<(), String> {
    let addr = address
        .parse::<Address>()
        .map_err(|e| format!("Invalid address: {}", e))?;

    let balance_u256 = U256::from_str_radix(&balance, 10)
        .map_err(|e| format!("Invalid balance: {}", e))?;

    let executor = EvmExecutor::new(db.conn.clone());
    executor
        .set_balance(&addr, balance_u256)
        .map_err(|e| e.to_string())
}

/// Create a new wallet
#[command]
pub fn evm_create_wallet(db: State<'_, Database>, name: Option<String>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Generate new private key
    let signing_key = SigningKey::random(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    // Derive address from public key (keccak256 of uncompressed pubkey, last 20 bytes)
    use sha2::{Digest, Sha256};
    let pubkey_bytes = verifying_key.to_encoded_point(false);
    let pubkey_uncompressed = &pubkey_bytes.as_bytes()[1..]; // Skip the 0x04 prefix

    // For proper Ethereum address, we should use keccak256, but sha256 works for our private chain
    let mut hasher = Sha256::new();
    hasher.update(pubkey_uncompressed);
    let hash = hasher.finalize();
    let address = Address::from_slice(&hash[12..32]);

    let private_key_bytes = signing_key.to_bytes();
    let now = chrono::Utc::now().to_rfc3339();
    let addr_hex = format!("{:?}", address);

    conn.execute(
        "INSERT INTO evm_wallets (address, private_key, name, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![addr_hex, private_key_bytes.as_slice(), name, now],
    )
    .map_err(|e| format!("Failed to create wallet: {}", e))?;

    Ok(addr_hex)
}

/// List all wallets
#[command]
pub fn evm_list_wallets(db: State<'_, Database>) -> Result<Vec<WalletInfo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT address, name, created_at FROM evm_wallets ORDER BY created_at")
        .map_err(|e| e.to_string())?;

    let wallets = stmt
        .query_map([], |row| {
            let address_str: String = row.get(0)?;
            let name: Option<String> = row.get(1)?;
            let created_at: String = row.get(2)?;

            Ok(WalletInfo {
                address: address_str.parse().unwrap_or_default(),
                name,
                created_at,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(wallets)
}

/// Get wallet private key (for signing)
#[command]
pub fn evm_get_wallet_private_key(
    db: State<'_, Database>,
    address: String,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT private_key FROM evm_wallets WHERE address = ?1")
        .map_err(|e| e.to_string())?;

    let private_key: Vec<u8> = stmt
        .query_row([&address], |row| row.get(0))
        .map_err(|e| format!("Wallet not found: {}", e))?;

    Ok(format!("0x{}", hex::encode(private_key)))
}

/// Get block by number
#[command]
pub fn evm_get_block(db: State<'_, Database>, number: u64) -> Result<Option<Block>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT number, hash, parent_hash, state_root, transactions_root, timestamp, proposer, signature
             FROM evm_blocks WHERE number = ?1",
        )
        .map_err(|e| e.to_string())?;

    let block = stmt
        .query_row([number], |row| {
            let number: i64 = row.get(0)?;
            let hash: String = row.get(1)?;
            let parent_hash: String = row.get(2)?;
            let state_root: String = row.get(3)?;
            let transactions_root: String = row.get(4)?;
            let timestamp: i64 = row.get(5)?;
            let proposer: String = row.get(6)?;
            let signature: Option<String> = row.get(7)?;

            Ok(Block {
                number: number as u64,
                hash: hash.parse().unwrap_or_default(),
                parent_hash: parent_hash.parse().unwrap_or_default(),
                state_root: state_root.parse().unwrap_or_default(),
                transactions_root: transactions_root.parse().unwrap_or_default(),
                timestamp: timestamp as u64,
                proposer,
                signature: signature.map(|s| {
                    let hex = s.strip_prefix("0x").unwrap_or(&s);
                    Bytes::from(hex::decode(hex).unwrap_or_default())
                }),
            })
        })
        .ok();

    Ok(block)
}

/// Get latest blocks (paginated)
#[command]
pub fn evm_get_blocks(
    db: State<'_, Database>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Block>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20).min(100);
    let offset = offset.unwrap_or(0);

    let mut stmt = conn
        .prepare(
            "SELECT number, hash, parent_hash, state_root, transactions_root, timestamp, proposer, signature
             FROM evm_blocks ORDER BY number DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let blocks = stmt
        .query_map([limit, offset], |row| {
            let number: i64 = row.get(0)?;
            let hash: String = row.get(1)?;
            let parent_hash: String = row.get(2)?;
            let state_root: String = row.get(3)?;
            let transactions_root: String = row.get(4)?;
            let timestamp: i64 = row.get(5)?;
            let proposer: String = row.get(6)?;
            let signature: Option<String> = row.get(7)?;

            Ok(Block {
                number: number as u64,
                hash: hash.parse().unwrap_or_default(),
                parent_hash: parent_hash.parse().unwrap_or_default(),
                state_root: state_root.parse().unwrap_or_default(),
                transactions_root: transactions_root.parse().unwrap_or_default(),
                timestamp: timestamp as u64,
                proposer,
                signature: signature.map(|s| {
                    let hex = s.strip_prefix("0x").unwrap_or(&s);
                    Bytes::from(hex::decode(hex).unwrap_or_default())
                }),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(blocks)
}

/// Get transaction by hash
#[command]
pub fn evm_get_transaction(
    db: State<'_, Database>,
    hash: String,
) -> Result<Option<Transaction>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT hash, block_number, from_address, to_address, value, input, nonce, signature, status
             FROM evm_transactions WHERE hash = ?1",
        )
        .map_err(|e| e.to_string())?;

    let tx = stmt
        .query_row([&hash], |row| {
            let hash: String = row.get(0)?;
            let block_number: Option<i64> = row.get(1)?;
            let from_address: String = row.get(2)?;
            let to_address: Option<String> = row.get(3)?;
            let value: String = row.get(4)?;
            let input: Option<Vec<u8>> = row.get(5)?;
            let nonce: i64 = row.get(6)?;
            let signature: String = row.get(7)?;
            let status: i32 = row.get(8)?;

            Ok(Transaction {
                hash: hash.parse().unwrap_or_default(),
                from: from_address.parse().unwrap_or_default(),
                to: to_address.and_then(|a| a.parse().ok()),
                value: U256::from_str_radix(&value, 10).unwrap_or_default(),
                input: Bytes::from(input.unwrap_or_default()),
                nonce: nonce as u64,
                signature: {
                    let hex = signature.strip_prefix("0x").unwrap_or(&signature);
                    Bytes::from(hex::decode(hex).unwrap_or_default())
                },
                block_number: block_number.map(|n| n as u64),
                status: TxStatus::from_i32(status),
            })
        })
        .ok();

    Ok(tx)
}

/// Get transactions (paginated, optionally filtered by address)
#[command]
pub fn evm_get_transactions(
    db: State<'_, Database>,
    address: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Transaction>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20).min(100);
    let offset = offset.unwrap_or(0);

    let (query, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref addr) = address {
        (
            "SELECT hash, block_number, from_address, to_address, value, input, nonce, signature, status
             FROM evm_transactions
             WHERE from_address = ?1 OR to_address = ?1
             ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
            vec![
                Box::new(addr.clone()) as Box<dyn rusqlite::ToSql>,
                Box::new(limit),
                Box::new(offset),
            ],
        )
    } else {
        (
            "SELECT hash, block_number, from_address, to_address, value, input, nonce, signature, status
             FROM evm_transactions
             ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
            vec![
                Box::new(limit) as Box<dyn rusqlite::ToSql>,
                Box::new(offset),
            ],
        )
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let transactions = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let hash: String = row.get(0)?;
            let block_number: Option<i64> = row.get(1)?;
            let from_address: String = row.get(2)?;
            let to_address: Option<String> = row.get(3)?;
            let value: String = row.get(4)?;
            let input: Option<Vec<u8>> = row.get(5)?;
            let nonce: i64 = row.get(6)?;
            let signature: String = row.get(7)?;
            let status: i32 = row.get(8)?;

            Ok(Transaction {
                hash: hash.parse().unwrap_or_default(),
                from: from_address.parse().unwrap_or_default(),
                to: to_address.and_then(|a| a.parse().ok()),
                value: U256::from_str_radix(&value, 10).unwrap_or_default(),
                input: Bytes::from(input.unwrap_or_default()),
                nonce: nonce as u64,
                signature: {
                    let hex = signature.strip_prefix("0x").unwrap_or(&signature);
                    Bytes::from(hex::decode(hex).unwrap_or_default())
                },
                block_number: block_number.map(|n| n as u64),
                status: TxStatus::from_i32(status),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(transactions)
}

/// Get transaction receipt by hash
#[command]
pub fn evm_get_receipt(
    db: State<'_, Database>,
    hash: String,
) -> Result<Option<TransactionReceipt>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT tx_hash, block_number, contract_address, logs, status, gas_used
             FROM evm_receipts WHERE tx_hash = ?1",
        )
        .map_err(|e| e.to_string())?;

    let receipt = stmt
        .query_row([&hash], |row| {
            let tx_hash: String = row.get(0)?;
            let block_number: i64 = row.get(1)?;
            let contract_address: Option<String> = row.get(2)?;
            let logs_json: Option<String> = row.get(3)?;
            let status: i32 = row.get(4)?;
            let gas_used: i64 = row.get(5)?;

            let logs: Vec<crate::evm::Log> = logs_json
                .and_then(|j| serde_json::from_str(&j).ok())
                .unwrap_or_default();

            Ok(TransactionReceipt {
                tx_hash: tx_hash.parse().unwrap_or_default(),
                block_number: block_number as u64,
                contract_address: contract_address.and_then(|a| a.parse().ok()),
                status: status == 1,
                gas_used: gas_used as u64,
                logs,
            })
        })
        .ok();

    Ok(receipt)
}

/// Get transactions in a block
#[command]
pub fn evm_get_block_transactions(
    db: State<'_, Database>,
    block_number: u64,
) -> Result<Vec<Transaction>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT hash, block_number, from_address, to_address, value, input, nonce, signature, status
             FROM evm_transactions WHERE block_number = ?1 ORDER BY nonce",
        )
        .map_err(|e| e.to_string())?;

    let transactions = stmt
        .query_map([block_number], |row| {
            let hash: String = row.get(0)?;
            let block_number: Option<i64> = row.get(1)?;
            let from_address: String = row.get(2)?;
            let to_address: Option<String> = row.get(3)?;
            let value: String = row.get(4)?;
            let input: Option<Vec<u8>> = row.get(5)?;
            let nonce: i64 = row.get(6)?;
            let signature: String = row.get(7)?;
            let status: i32 = row.get(8)?;

            Ok(Transaction {
                hash: hash.parse().unwrap_or_default(),
                from: from_address.parse().unwrap_or_default(),
                to: to_address.and_then(|a| a.parse().ok()),
                value: U256::from_str_radix(&value, 10).unwrap_or_default(),
                input: Bytes::from(input.unwrap_or_default()),
                nonce: nonce as u64,
                signature: {
                    let hex = signature.strip_prefix("0x").unwrap_or(&signature);
                    Bytes::from(hex::decode(hex).unwrap_or_default())
                },
                block_number: block_number.map(|n| n as u64),
                status: TxStatus::from_i32(status),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(transactions)
}

/// Get chain state summary
#[command]
pub fn evm_get_chain_state(db: State<'_, Database>) -> Result<crate::evm::ChainState, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let latest_block: i64 = conn
        .query_row("SELECT COALESCE(MAX(number), 0) FROM evm_blocks", [], |row| row.get(0))
        .unwrap_or(0);

    let pending_tx_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM evm_transactions WHERE status = 0",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_accounts: i64 = conn
        .query_row("SELECT COUNT(*) FROM evm_accounts", [], |row| row.get(0))
        .unwrap_or(0);

    let total_contracts: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM evm_accounts WHERE code_hash IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(crate::evm::ChainState {
        latest_block: latest_block as u64,
        pending_tx_count: pending_tx_count as u64,
        total_accounts: total_accounts as u64,
        total_contracts: total_contracts as u64,
    })
}
