const pool = require('./db');

const fixQuery = `
  -- Rename the column if it was named movie_id
  ALTER TABLE purchases RENAME COLUMN movie_id TO movie_name;
`;

const runFix = async () => {
  try {
    await pool.query(fixQuery);
    console.log("✅ Database Column Renamed Successfully!");
    process.exit();
  } catch (err) {
    console.log("❌ Error or column already renamed:", err.message);
    process.exit();
  }
};

runFix();