const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5555;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "Blackwell2026";

app.use(cors());
app.use(express.json());

const generateCode = () => {
  return "BW-" + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// --- ROUTES ---

// 1. PURCHASE
app.post("/api/purchase-guest", async (req, res) => {
  const { email, reference, movieName } = req.body;
  if (!reference || !email) {
    return res.status(400).json({ success: false, message: "Missing details" });
  }
  try {
    try {
      const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
      await axios.get(paystackUrl, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000,
      });
    } catch (paystackError) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed." });
    }

    const code = generateCode();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    const newTicket = await pool.query(
      "INSERT INTO tickets (email, code, movie_name, expiry_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [email, code, movieName, expiryDate]
    );

    res.json({ success: true, code: newTicket.rows[0].code });
  } catch (err) {
    if (err.code === "23505") {
      return res.json({ success: false, message: "Ticket already exists." });
    }
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 2. CHECK STATUS
app.post("/api/check-ticket-status", async (req, res) => {
  const { email, movieName } = req.body;
  try {
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE email = $1 AND movie_name = $2 AND expiry_date > NOW()",
      [email, movieName]
    );
    if (ticket.rows.length > 0) {
      return res.json({
        exists: true,
        code: ticket.rows[0].code,
        message: "Active ticket found.",
      });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// 3. VERIFY
app.post("/api/verify-ticket", async (req, res) => {
  const { code, movieName } = req.body;
  const userIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE code = $1 AND movie_name = $2",
      [code, movieName]
    );

    if (ticket.rows.length > 0) {
      const data = ticket.rows[0];
      if (new Date() > new Date(data.expiry_date)) {
        return res
          .status(403)
          .json({ valid: false, message: "Ticket Expired." });
      }

      let currentDevices = data.device_ips || [];
      if (!currentDevices.includes(userIp)) {
        if (currentDevices.length >= 3) {
          return res
            .status(403)
            .json({ valid: false, message: "Device limit reached." });
        }
        await pool.query(
          "UPDATE tickets SET device_ips = array_append(device_ips, $1) WHERE id = $2",
          [userIp, data.id]
        );
      }
      return res.json({ valid: true, message: "Access Granted" });
    }

    const affiliate = await pool.query(
      "SELECT * FROM affiliate_codes WHERE code = $1",
      [code]
    );
    if (affiliate.rows.length > 0) {
      const affData = affiliate.rows[0];
      if (!affData.is_active)
        return res
          .status(403)
          .json({ valid: false, message: "Code Deactivated." });

      await pool.query(
        "UPDATE affiliate_codes SET uses = uses + 1 WHERE id = $1",
        [affData.id]
      );
      return res.json({ valid: true, message: "VIP Access Granted" });
    }

    return res.status(404).json({ valid: false, message: "Invalid Code." });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// 4. RATE MOVIE (UPDATED: Handles Email Lookup)
app.post("/api/rate-movie", async (req, res) => {
  const { movieName, rating, comment, ticketCode } = req.body;

  let userEmail = "Anonymous";

  try {
    // Attempt to find email if ticketCode is provided
    if (ticketCode) {
      const ticketRes = await pool.query(
        "SELECT email FROM tickets WHERE code = $1",
        [ticketCode]
      );
      if (ticketRes.rows.length > 0) {
        userEmail = ticketRes.rows[0].email;
      }
    }

    await pool.query(
      "INSERT INTO movie_ratings (movie_name, rating, comment, email) VALUES ($1, $2, $3, $4)",
      [movieName, rating, comment, userEmail]
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
    const up = await pool.query(
      "SELECT COUNT(*) FROM movie_ratings WHERE movie_name = $1 AND rating = 'up'",
      [movieName]
    );
    const down = await pool.query(
      "SELECT COUNT(*) FROM movie_ratings WHERE movie_name = $1 AND rating = 'down'",
      [movieName]
    );
    res.json({
      up: parseInt(up.rows[0].count) || 0,
      down: parseInt(down.rows[0].count) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- ADMIN ---
const verifyAdmin = (req, res, next) => {
  if (req.headers["x-admin-pin"] !== ADMIN_SECRET)
    return res.status(403).json({ error: "Unauthorized" });
  next();
};

app.post("/api/admin/login", (req, res) => {
  if (req.body.pin === ADMIN_SECRET) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get("/api/admin/dashboard", verifyAdmin, async (req, res) => {
  try {
    const tickets = await pool.query("SELECT COUNT(*) FROM tickets");
    const totalTickets = parseInt(tickets.rows[0].count) || 0;

    // Fetch MORE records (limit 1000) so frontend pagination can handle them
    const recent = await pool.query(
      "SELECT * FROM tickets ORDER BY id DESC LIMIT 1000"
    );
    const ratings = await pool.query(
      "SELECT * FROM movie_ratings ORDER BY created_at DESC LIMIT 1000"
    );
    const affiliates = await pool.query(
      "SELECT * FROM affiliate_codes ORDER BY created_at DESC"
    );

    res.json({
      revenue: totalTickets * 250,
      totalTickets,
      recent: recent.rows,
      ratings: ratings.rows,
      affiliates: affiliates.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Admin fetch failed" });
  }
});

app.post("/api/admin/affiliate", verifyAdmin, async (req, res) => {
  try {
    const newCode = await pool.query(
      "INSERT INTO affiliate_codes (code, owner) VALUES ($1, $2) RETURNING *",
      [req.body.code, req.body.owner]
    );
    res.json({ success: true, data: newCode.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.patch("/api/admin/affiliate/:id", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      "UPDATE affiliate_codes SET is_active = $1 WHERE id = $2",
      [req.body.is_active, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
