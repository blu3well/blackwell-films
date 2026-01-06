const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const sgMail = require("@sendgrid/mail"); // Switched from Nodemailer to SendGrid
require("dotenv").config();

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Helper to generate a 6-character code
const generateCode = () => {
  return "BW-" + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// --- ROUTES ---

// 1. PURCHASE & GENERATE TICKET
app.post("/api/purchase-guest", async (req, res) => {
  const { email, reference, movieName } = req.body;

  if (!reference || !email) {
    return res.status(400).json({ message: "Missing details" });
  }

  try {
    // A. Verify Payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    if (response.data.data.status !== "success") {
      return res.status(400).json({ message: "Payment failed." });
    }

    // B. Generate Ticket
    const code = generateCode();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90); // 90 Days Access

    // C. Save to DB
    await pool.query(
      "INSERT INTO tickets (code, email, movie_name, expiry_date) VALUES ($1, $2, $3, $4)",
      [code, email, movieName, expiryDate]
    );

    // D. Send Email via SendGrid
    const msg = {
      to: email,
      from: "tickets@blackwellfilms.com", // MUST match the Sender you verified in SendGrid
      subject: `Your Ticket for ${movieName}`,
      text: `Your Access Code is: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #d4a373;">Blackwell Films</h2>
          <p>Thank you for purchasing access to <strong>${movieName}</strong>.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #555;">YOUR ACCESS CODE:</p>
            <h1 style="margin: 10px 0; letter-spacing: 5px; color: #000;">${code}</h1>
          </div>
          <p>You can use this code to watch the movie on up to <strong>3 devices</strong>.</p>
          <p>Keep this code safe!</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">If you have trouble, reply to this email.</p>
        </div>
      `,
    };

    await sgMail.send(msg);

    res.json({ success: true, code: code, message: "Access Granted!" });

  } catch (error) {
    console.error("Transaction Error:", error);
    // Even if email fails, we return success so user sees the code on screen immediately
    res.json({ success: true, code: code, message: "Access Granted (Email might be delayed)" });
  }
});

// 2. VERIFY TICKET & DEVICE LIMIT
app.post("/api/verify-ticket", async (req, res) => {
  const { code, movieName } = req.body;
  // Get IP address (handles proxies like Render/Vercel)
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // A. Find Ticket
    const ticket = await pool.query(
      "SELECT * FROM tickets WHERE code = $1 AND movie_name = $2",
      [code, movieName]
    );

    if (ticket.rows.length === 0) {
      return res.status(404).json({ valid: false, message: "Invalid Code" });
    }

    const data = ticket.rows[0];

    // B. Check Expiry
    if (new Date() > new Date(data.expiry_date)) {
      return res.status(403).json({ valid: false, message: "Ticket Expired" });
    }

    // C. Check Device Limit (Max 3 Unique IPs)
    let currentDevices = data.device_ips || [];
    
    // If this IP is not in the list
    if (!currentDevices.includes(userIp)) {
      if (currentDevices.length >= 3) {
        return res.status(403).json({ valid: false, message: "Device limit reached (Max 3)." });
      }
      
      // Add new device IP
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

app.listen(PORT, () => console.log(`🚀 ACTIVE ON PORT ${PORT}`));