const { getPool } = require('../db/pool');

async function checkDatabaseHealth() {
  const startedAt = Date.now();

  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT
      DB_NAME() AS DatabaseName,
      SYSUTCDATETIME() AS DatabaseUtcTime
  `);

  return {
    status: 'ok',
    databaseName: result.recordset[0].DatabaseName,
    responseTimeMs: Date.now() - startedAt,
  };
}

module.exports = {
  checkDatabaseHealth,
};
