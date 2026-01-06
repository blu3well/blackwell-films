const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5555;

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
    }

    // B. Generate Ticket
    const code = generateCode();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    // C. Save to DB
    await pool.query(
      "INSERT INTO tickets (code, email, movie_name, expiry_date) VALUES ($1, $2, $3, $4)",
      [code, email, movieName, expiryDate]
    );

    // D. Respond to Client IMMEDIATELY (Frontend will handle email)
    res.json({ success: true, code: code, message: "Access Granted!" });
  } catch (error) {
    console.error("Server Logic Error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server encountered an error processing ticket.",
        });
    }
  }
});

// 2. VERIFY TICKET & DEVICE LIMIT
app.post("/api/verify-ticket", async (req, res) => {
  const { code, movieName } = req.body;
  const userIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE code = $1 AND movie_name = $2",
      [code, movieName]
    );

    if (ticket.rows.length === 0) {
      return res.status(404).json({ valid: false, message: "Invalid Code" });
    }

    const data = ticket.rows[0];

    if (new Date() > new Date(data.expiry_date)) {
      return res.status(403).json({ valid: false, message: "Ticket Expired" });
    }

    let currentDevices = data.device_ips || [];
    if (!currentDevices.includes(userIp)) {
      if (currentDevices.length >= 3) {
        return res
          .status(403)
          .json({ valid: false, message: "Device limit reached (Max 3)." });
      }
      await pool.query(
        "UPDATE tickets SET device_ips = array_append(device_ips, $1) WHERE id = $2",
        [userIp, data.id]
      );
    }

    res.json({ valid: true, message: "Access Granted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Verification failed" });
  }
});

// 3. RATE MOVIE
app.post("/api/rate-movie", async (req, res) => {
  const { movieName, rating, comment } = req.body;
  try {
    await pool.query(
      "INSERT INTO movie_ratings (movie_name, rating, comment) VALUES ($1, $2, $3)",
      [movieName, rating, comment]
    );
    res.json({ success: true, message: "Rating saved!" });
  } catch (error) {
    console.error("Rating Error:", error);
    res.status(500).json({ success: false, message: "Failed to save rating." });
  }
});

app.listen(PORT, () => console.log(`🚀 SERVER RUNNING ON ${PORT}`));
