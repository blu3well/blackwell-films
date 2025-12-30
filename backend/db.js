const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Ensure this matches Render key
  ssl: {
    rejectUnauthorized: false 
  }
});

module.exports = pool;