const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5555;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "Blackwell2026";
const BASE_PRICE = 250; // Centralized price

app.use(cors());
app.use(express.json());

const generateCode = () => {
  return "BW-" + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// --- ROUTES ---

// 1. CHECK COUPON (Case Insensitive)
app.post("/api/check-coupon", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ valid: false, message: "No code provided" });

  try {
    const normalizedCode = code.toUpperCase().trim();
    const coupon = await pool.query("SELECT * FROM coupons WHERE code = $1", [
      normalizedCode,
    ]);

    if (coupon.rows.length > 0) {
      const data = coupon.rows[0];
      if (!data.is_active) {
        return res.json({ valid: false, message: "This coupon is inactive." });
      }
      return res.json({
        valid: true,
        discount: data.discount_percent,
        message: `Coupon Applied: ${data.discount_percent}% OFF`,
      });
    } else {
      return res.json({ valid: false, message: "Invalid Coupon Code" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 2. PURCHASE & GENERATE TICKET (Handles Paid & Free)
app.post("/api/purchase-guest", async (req, res) => {
  const { email, reference, movieName, couponCode } = req.body;

  if (!email)
    return res.status(400).json({ success: false, message: "Missing email" });

  try {
    let finalPrice = BASE_PRICE;
    let couponId = null;
    let normalizedCoupon = null;

    // A. Validate Coupon Logic (Server Side Calculation)
    if (couponCode) {
      normalizedCoupon = couponCode.toUpperCase().trim();
      const couponRes = await pool.query(
        "SELECT * FROM coupons WHERE code = $1",
        [normalizedCoupon]
      );
      if (couponRes.rows.length > 0) {
        const coupon = couponRes.rows[0];
        if (coupon.is_active) {
          const discountDecimal = coupon.discount_percent / 100;
          finalPrice = BASE_PRICE - BASE_PRICE * discountDecimal;
          couponId = coupon.id;
        }
      }
    }

    // B. Payment Verification
    if (finalPrice > 0) {
      // Must have a payment reference
      if (!reference)
        return res
          .status(400)
          .json({ success: false, message: "Payment required." });

      try {
        const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
        const paystackRes = await axios.get(paystackUrl, {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
          timeout: 10000,
        });

        // Verify Amount (Paystack returns amount in kobo/cents)
        const paidAmount = paystackRes.data.data.amount / 100;
        // Allow small floating point difference (epsilon check usually better, but < comparison works here)
        if (paidAmount < finalPrice) {
          return res
            .status(400)
            .json({ success: false, message: "Payment amount mismatch." });
        }
      } catch (paystackError) {
        return res
          .status(400)
          .json({ success: false, message: "Payment verification failed." });
      }
    }

    // C. Generate & Save Ticket
    const code = generateCode();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    const newTicket = await pool.query(
      "INSERT INTO tickets (email, code, movie_name, expiry_date, coupon_used) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [email, code, movieName, expiryDate, normalizedCoupon || null]
    );

    // D. Update Coupon Usage
    if (couponId) {
      await pool.query("UPDATE coupons SET uses = uses + 1 WHERE id = $1", [
        couponId,
      ]);
    }

    res.json({ success: true, code: newTicket.rows[0].code });
  } catch (err) {
    if (err.code === "23505") {
      return res.json({
        success: false,
        message: "Ticket already exists for this email.",
      });
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 3. CHECK TICKET STATUS
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

// 4. VERIFY TICKET (Login)
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
    return res.status(404).json({ valid: false, message: "Invalid Code." });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// 5. RATE MOVIE
app.post("/api/rate-movie", async (req, res) => {
  const { movieName, rating, comment, ticketCode } = req.body;
  let userEmail = "Anonymous";
  try {
    if (ticketCode) {
      const ticketRes = await pool.query(
        "SELECT email FROM tickets WHERE code = $1",
        [ticketCode]
      );
      if (ticketRes.rows.length > 0) userEmail = ticketRes.rows[0].email;
    }
    await pool.query(
      "INSERT INTO movie_ratings (movie_name, rating, comment, email) VALUES ($1, $2, $3, $4)",
      [movieName, rating, comment, userEmail]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to save rating" });
  }
});

// 6. GET RATING STATS
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
    const allTickets = await pool.query("SELECT * FROM tickets");
    const coupons = await pool.query(
      "SELECT * FROM coupons ORDER BY created_at DESC"
    );

    let totalRevenue = 0;
    const couponMap = {};
    coupons.rows.forEach((c) => (couponMap[c.code] = c.discount_percent));

    allTickets.rows.forEach((ticket) => {
      let price = BASE_PRICE;
      // ticket.coupon_used might be mixed case in DB, ensure we match correctly
      const usedCoupon = ticket.coupon_used
        ? ticket.coupon_used.toUpperCase()
        : null;
      if (usedCoupon && couponMap[usedCoupon] !== undefined) {
        const discount = couponMap[usedCoupon];
        price = BASE_PRICE - (BASE_PRICE * discount) / 100;
      }
      totalRevenue += price;
    });

    const recent = await pool.query(
      "SELECT * FROM tickets ORDER BY id DESC LIMIT 1000"
    );
    const ratings = await pool.query(
      "SELECT * FROM movie_ratings ORDER BY created_at DESC LIMIT 1000"
    );

    res.json({
      revenue: totalRevenue,
      totalTickets: allTickets.rows.length,
      recent: recent.rows,
      ratings: ratings.rows,
      coupons: coupons.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Admin fetch failed" });
  }
});

app.post("/api/admin/coupon", verifyAdmin, async (req, res) => {
  try {
    const { code, discount_percent } = req.body;
    // FORCE UPPERCASE ON CREATION
    const normalizedCode = code.toUpperCase().trim();
    const newCode = await pool.query(
      "INSERT INTO coupons (code, discount_percent) VALUES ($1, $2) RETURNING *",
      [normalizedCode, discount_percent]
    );
    res.json({ success: true, data: newCode.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.patch("/api/admin/coupon/:id", verifyAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE coupons SET is_active = $1 WHERE id = $2", [
      req.body.is_active,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// NEW: DELETE COUPON
app.delete("/api/admin/coupon/:id", verifyAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM coupons WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
