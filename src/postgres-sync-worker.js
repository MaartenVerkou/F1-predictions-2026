"use strict";

const fs = require("fs");
const { parentPort, workerData } = require("worker_threads");
const pg = require("pg");

pg.types.setTypeParser(20, (value) => Number(value));

const pool = new pg.Pool({
  connectionString: workerData.connectionString,
  max: 4
});

let transactionClient = null;

function serializeError(err) {
  return {
    name: err?.name || "Error",
    message: err?.message || String(err),
    stack: err?.stack || ""
  };
}

async function activeClient() {
  return transactionClient || pool;
}

async function handleMessage(message) {
  if (message.type === "begin") {
    if (!transactionClient) {
      transactionClient = await pool.connect();
      await transactionClient.query("BEGIN");
    }
    return null;
  }

  if (message.type === "commit") {
    if (transactionClient) {
      const client = transactionClient;
      transactionClient = null;
      try {
        await client.query("COMMIT");
      } finally {
        client.release();
      }
    }
    return null;
  }

  if (message.type === "rollback") {
    if (transactionClient) {
      const client = transactionClient;
      transactionClient = null;
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
    return null;
  }

  if (message.type === "close") {
    if (transactionClient) {
      const client = transactionClient;
      transactionClient = null;
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
    await pool.end();
    return null;
  }

  if (message.type !== "query") {
    throw new Error(`Unsupported PostgreSQL worker message type: ${message.type}`);
  }

  const client = await activeClient();
  const result = await client.query(message.sql, message.params || []);

  if (message.mode === "all") {
    return result.rows;
  }
  if (message.mode === "get") {
    return result.rows[0] || null;
  }
  if (message.mode === "run") {
    return {
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id ?? undefined
    };
  }
  if (message.mode === "exec") {
    return null;
  }

  throw new Error(`Unsupported PostgreSQL query mode: ${message.mode}`);
}

parentPort.on("message", async (message) => {
  const signal = new Int32Array(message.signalBuffer);
  try {
    const value = await handleMessage(message);
    fs.writeFileSync(message.resultPath, JSON.stringify({ ok: true, value }), "utf8");
  } catch (err) {
    fs.writeFileSync(
      message.resultPath,
      JSON.stringify({ ok: false, error: serializeError(err), sql: message.sql || "" }),
      "utf8"
    );
  } finally {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0, 1);
  }
});
