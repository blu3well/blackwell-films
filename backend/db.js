const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// This helps us see in the terminal if the connection actually happens
pool.on("connect", () => {
  console.log("--- Database Pool Connected ---");
});

module.exports = pool;
