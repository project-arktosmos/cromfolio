use alloy_primitives::{Address, Bytes, B256, U256};
use revm::{
    db::DatabaseRef,
    primitives::{AccountInfo, Bytecode, KECCAK_EMPTY},
};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

use crate::evm::errors::EvmError;

/// SQLite-backed state database for revm
pub struct SqliteState {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteState {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// Get account info from database
    pub fn get_account(&self, address: &Address) -> Result<Option<AccountInfo>, EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        let addr_hex = format!("{:?}", address);

        let mut stmt = conn
            .prepare(
                "SELECT balance, nonce, code_hash FROM evm_accounts WHERE address = ?1",
            )
            .map_err(EvmError::from)?;

        let result = stmt.query_row([&addr_hex], |row| {
            let balance_str: String = row.get(0)?;
            let nonce: u64 = row.get::<_, i64>(1)? as u64;
            let code_hash: Option<String> = row.get(2)?;
            Ok((balance_str, nonce, code_hash))
        });

        match result {
            Ok((balance_str, nonce, code_hash_opt)) => {
                let balance = U256::from_str_radix(&balance_str, 10)
                    .unwrap_or(U256::ZERO);

                let code_hash = code_hash_opt
                    .and_then(|h| h.parse::<B256>().ok())
                    .unwrap_or(KECCAK_EMPTY);

                // Load bytecode if this is a contract
                let code = if code_hash != KECCAK_EMPTY {
                    self.get_code_by_hash_internal(&conn, &code_hash)?
                } else {
                    Bytecode::default()
                };

                Ok(Some(AccountInfo {
                    balance,
                    nonce,
                    code_hash,
                    code: Some(code),
                }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(EvmError::from(e)),
        }
    }

    fn get_code_by_hash_internal(
        &self,
        conn: &Connection,
        code_hash: &B256,
    ) -> Result<Bytecode, EvmError> {
        let hash_hex = format!("{:?}", code_hash);

        let mut stmt = conn
            .prepare("SELECT bytecode FROM evm_code WHERE code_hash = ?1")
            .map_err(EvmError::from)?;

        let result = stmt.query_row([&hash_hex], |row| {
            let bytecode: Vec<u8> = row.get(0)?;
            Ok(bytecode)
        });

        match result {
            Ok(bytecode) => Ok(Bytecode::new_raw(Bytes::from(bytecode))),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(Bytecode::default()),
            Err(e) => Err(EvmError::from(e)),
        }
    }

    /// Get storage value at slot
    pub fn get_storage(&self, address: &Address, slot: &U256) -> Result<U256, EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        let addr_hex = format!("{:?}", address);
        let slot_hex = format!("{:?}", slot);

        let mut stmt = conn
            .prepare("SELECT value FROM evm_storage WHERE address = ?1 AND slot = ?2")
            .map_err(EvmError::from)?;

        let result = stmt.query_row([&addr_hex, &slot_hex], |row| {
            let value_hex: String = row.get(0)?;
            Ok(value_hex)
        });

        match result {
            Ok(value_hex) => {
                let value = value_hex.parse::<U256>().unwrap_or(U256::ZERO);
                Ok(value)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(U256::ZERO),
            Err(e) => Err(EvmError::from(e)),
        }
    }

    /// Get block hash by number
    pub fn get_block_hash(&self, number: u64) -> Result<B256, EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;

        let mut stmt = conn
            .prepare("SELECT hash FROM evm_blocks WHERE number = ?1")
            .map_err(EvmError::from)?;

        let result = stmt.query_row([number as i64], |row| {
            let hash_hex: String = row.get(0)?;
            Ok(hash_hex)
        });

        match result {
            Ok(hash_hex) => {
                let hash = hash_hex.parse::<B256>().unwrap_or(B256::ZERO);
                Ok(hash)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(B256::ZERO),
            Err(e) => Err(EvmError::from(e)),
        }
    }

    /// Save account to database
    pub fn save_account(&self, address: &Address, info: &AccountInfo) -> Result<(), EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        let addr_hex = format!("{:?}", address);
        let balance_str = info.balance.to_string();
        let code_hash_hex = if info.code_hash != KECCAK_EMPTY {
            Some(format!("{:?}", info.code_hash))
        } else {
            None
        };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO evm_accounts (address, balance, nonce, code_hash, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT(address) DO UPDATE SET
                balance = excluded.balance,
                nonce = excluded.nonce,
                code_hash = excluded.code_hash,
                updated_at = excluded.updated_at",
            rusqlite::params![addr_hex, balance_str, info.nonce as i64, code_hash_hex, now],
        )
        .map_err(EvmError::from)?;

        Ok(())
    }

    /// Save contract bytecode
    pub fn save_code(&self, code_hash: &B256, bytecode: &[u8]) -> Result<(), EvmError> {
        if *code_hash == KECCAK_EMPTY {
            return Ok(());
        }

        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        let hash_hex = format!("{:?}", code_hash);

        conn.execute(
            "INSERT OR IGNORE INTO evm_code (code_hash, bytecode) VALUES (?1, ?2)",
            rusqlite::params![hash_hex, bytecode],
        )
        .map_err(EvmError::from)?;

        Ok(())
    }

    /// Save storage slot
    pub fn save_storage(
        &self,
        address: &Address,
        slot: &U256,
        value: &U256,
    ) -> Result<(), EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        let addr_hex = format!("{:?}", address);
        let slot_hex = format!("{:?}", slot);
        let value_hex = format!("{:?}", value);

        if *value == U256::ZERO {
            // Delete zero values to save space
            conn.execute(
                "DELETE FROM evm_storage WHERE address = ?1 AND slot = ?2",
                rusqlite::params![addr_hex, slot_hex],
            )
            .map_err(EvmError::from)?;
        } else {
            conn.execute(
                "INSERT INTO evm_storage (address, slot, value)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(address, slot) DO UPDATE SET value = excluded.value",
                rusqlite::params![addr_hex, slot_hex, value_hex],
            )
            .map_err(EvmError::from)?;
        }

        Ok(())
    }

    /// Get latest block number
    pub fn get_latest_block_number(&self) -> Result<u64, EvmError> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;

        let result: Result<i64, _> = conn.query_row(
            "SELECT COALESCE(MAX(number), 0) FROM evm_blocks",
            [],
            |row| row.get(0),
        );

        match result {
            Ok(n) => Ok(n as u64),
            Err(e) => Err(EvmError::from(e)),
        }
    }
}

/// Implement DatabaseRef for read-only access (used in calls)
impl DatabaseRef for SqliteState {
    type Error = EvmError;

    fn basic_ref(&self, address: Address) -> Result<Option<AccountInfo>, Self::Error> {
        self.get_account(&address)
    }

    fn code_by_hash_ref(&self, code_hash: B256) -> Result<Bytecode, Self::Error> {
        let conn = self.conn.lock().map_err(|e| EvmError::Database(e.to_string()))?;
        self.get_code_by_hash_internal(&conn, &code_hash)
    }

    fn storage_ref(&self, address: Address, index: U256) -> Result<U256, Self::Error> {
        self.get_storage(&address, &index)
    }

    fn block_hash_ref(&self, number: u64) -> Result<B256, Self::Error> {
        self.get_block_hash(number)
    }
}
