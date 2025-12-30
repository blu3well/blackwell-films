const pool = require('./db');

const fixQuery = `
  ALTER TABLE purchases 
  ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;
`;

const runFix = async () => {
  try {
    console.log("--- Attempting to add 'reference' column ---");
    await pool.query(fixQuery);
    console.log("✅ Success: 'reference' column is now in the database!");
    process.exit();
  } catch (err) {
    console.error("❌ Error adding column:", err.message);
    process.exit(1);
  }
};

runFix();