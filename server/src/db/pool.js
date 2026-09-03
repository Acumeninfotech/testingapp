const sql = require('mssql');
const { getDatabaseConfig } = require('../config/database');

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(getDatabaseConfig());

    pool.on('error', (error) => {
      console.error('MSSQL pool error:', error);
    });

    poolPromise = pool.connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

async function closePool() {
  if (!poolPromise) {
    return;
  }

  try {
    const pool = await poolPromise;
    await pool.close();
  } finally {
    poolPromise = null;
  }
}

module.exports = {
  sql,
  getPool,
  closePool,
};
