const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5555;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "Blackwell2026"; // Fallback if not set

app.use(cors());
app.use(express.json());

// Helper: Generate Code
const generateCode = () => {
  return "BW-" + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// --- ROUTES ---

// 1. PURCHASE & GENERATE TICKET
app.post("/api/purchase-guest", async (req, res) => {
  const { email, reference, movieName } = req.body;
  console.log(`[Purchase Request] Ref: ${reference}, Email: ${email}`);

  if (!reference || !email) {
    return res.status(400).json({ success: false, message: "Missing details" });
  }

  try {
    // A. Verify Payment with Paystack
    try {
      const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
      await axios.get(paystackUrl, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000,
      });
    } catch (paystackError) {
      console.error("Paystack Verification Error:", paystackError.message);
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Please contact support.",
      });
    }

    // B. Generate Code
    const code = generateCode();
    // Expiry: 90 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    // C. Save to DB
    const newTicket = await pool.query(
      "INSERT INTO tickets (email, code, movie_name, expiry_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [email, code, movieName, expiryDate]
    );

    res.json({ success: true, code: newTicket.rows[0].code });
  } catch (err) {
    console.error("Server Error:", err.message);
    if (err.code === "23505") {
      // Unique violation (if you enforced unique emails)
      return res.json({
        success: false,
        message: "Ticket already exists for this email.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server encountered an error processing ticket.",
    });
  }
});

// 2. CHECK TICKET STATUS (New Endpoint for Pre-Check)
app.post("/api/check-ticket-status", async (req, res) => {
  const { email, movieName } = req.body;

  try {
    // Find a ticket that matches email/movie AND is NOT expired
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE email = $1 AND movie_name = $2 AND expiry_date > NOW()",
      [email, movieName]
    );

    if (ticket.rows.length > 0) {
      // Ticket exists and is valid
      return res.json({
        exists: true,
        code: ticket.rows[0].code, // Send code back so frontend can email it
        message: "Active ticket found.",
      });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error("Check Status Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 3. VERIFY TICKET (Updated to include Affiliate Codes)
app.post("/api/verify-ticket", async (req, res) => {
  const { code, movieName } = req.body;
  const userIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    // STEP A: Check Standard Tickets
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE code = $1 AND movie_name = $2",
      [code, movieName]
    );

    if (ticket.rows.length > 0) {
      const data = ticket.rows[0];

      // Check Expiry
      if (new Date() > new Date(data.expiry_date)) {
        return res.status(403).json({
          valid: false,
          message: "Access Denied: Your ticket has expired.",
        });
      }

      // Check Device Limit
      let currentDevices = data.device_ips || [];
      if (!currentDevices.includes(userIp)) {
        if (currentDevices.length >= 3) {
          return res.status(403).json({
            valid: false,
            message: "Device limit reached (Max 3 unique devices).",
          });
        }
        await pool.query(
          "UPDATE tickets SET device_ips = array_append(device_ips, $1) WHERE id = $2",
          [userIp, data.id]
        );
      }
      return res.json({ valid: true, message: "Access Granted" });
    }

    // STEP B: Check Affiliate/Master Codes (If not found in standard tickets)
    const affiliate = await pool.query(
      "SELECT * FROM affiliate_codes WHERE code = $1",
      [code]
    );

    if (affiliate.rows.length > 0) {
      const affiliateData = affiliate.rows[0];

      if (!affiliateData.is_active) {
        return res.status(403).json({
          valid: false,
          message: "This code has been deactivated.",
        });
      }

      // Increment Usage Count
      await pool.query(
        "UPDATE affiliate_codes SET uses = uses + 1 WHERE id = $1",
        [affiliateData.id]
      );

      return res.json({ valid: true, message: "VIP Access Granted" });
    }

    // If neither found:
    return res.status(404).json({
      valid: false,
      message: "Invalid Code. Please check and try again.",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Verification failed due to server error." });
  }
});

// 4. RATE MOVIE
app.post("/api/rate-movie", async (req, res) => {
  const { movieName, rating, comment } = req.body;
  try {
    await pool.query(
      "INSERT INTO movie_ratings (movie_name, rating, comment) VALUES ($1, $2, $3)",
      [movieName, rating, comment]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save rating" });
  }
});

// 5. GET RATING STATS
app.get("/api/ratings/:movieName", async (req, res) => {
  const { movieName } = req.params;
  try {
    const upCount = await pool.query(
      "SELECT COUNT(*) FROM movie_ratings WHERE movie_name = $1 AND rating = 'up'",
      [movieName]
    );
    const downCount = await pool.query(
      "SELECT COUNT(*) FROM movie_ratings WHERE movie_name = $1 AND rating = 'down'",
      [movieName]
    );

    res.json({
      up: parseInt(upCount.rows[0].count) || 0,
      down: parseInt(downCount.rows[0].count) || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- ADMIN DASHBOARD ROUTES ---

// Middleware to check Admin PIN
const verifyAdmin = (req, res, next) => {
  const pin = req.headers["x-admin-pin"];
  if (pin !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
};

app.post("/api/admin/login", (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_SECRET) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid PIN" });
  }
});

app.get("/api/admin/dashboard", verifyAdmin, async (req, res) => {
  try {
    // 1. Total Sales (Count of tickets)
    const tickets = await pool.query("SELECT COUNT(*) FROM tickets");
    const totalTickets = parseInt(tickets.rows[0].count) || 0;
    const revenue = totalTickets * 250; // Hardcoded price multiplier

    // 2. Recent Transactions (Last 50)
    const recent = await pool.query(
      "SELECT * FROM tickets ORDER BY id DESC LIMIT 50"
    );

    // 3. Ratings & Comments
    const ratings = await pool.query(
      "SELECT * FROM movie_ratings ORDER BY created_at DESC"
    );

    // 4. Affiliate Codes
    const affiliates = await pool.query(
      "SELECT * FROM affiliate_codes ORDER BY created_at DESC"
    );

    res.json({
      revenue,
      totalTickets,
      recent: recent.rows,
      ratings: ratings.rows,
      affiliates: affiliates.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Admin data fetch failed" });
  }
});

// Create Affiliate Code
app.post("/api/admin/affiliate", verifyAdmin, async (req, res) => {
  const { code, owner } = req.body;
  try {
    const newCode = await pool.query(
      "INSERT INTO affiliate_codes (code, owner) VALUES ($1, $2) RETURNING *",
      [code.toUpperCase(), owner]
    );
    res.json({ success: true, data: newCode.rows[0] });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create code. Code might already exist." });
  }
});

// Toggle Affiliate Code Status
app.patch("/api/admin/affiliate/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    await pool.query(
      "UPDATE affiliate_codes SET is_active = $1 WHERE id = $2",
      [is_active, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
