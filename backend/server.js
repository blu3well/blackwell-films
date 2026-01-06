const axios = require("axios");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Blackwellfilmsafrica@gmail.com
    pass: process.env.EMAIL_PASS, // Your 16-character App Password
  },
});

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
    expiryDate.setDate(expiryDate.getDate() + 90); 

    // C. Save to DB
    await pool.query(
      "INSERT INTO tickets (code, email, movie_name, expiry_date) VALUES ($1, $2, $3, $4)",
      [code, email, movieName, expiryDate]
    );

    // D. Send Email
    const mailOptions = {
      from: `"Blackwell Films" <${process.env.EMAIL_USER}>`, // Shows "Blackwell Films" as sender
      to: email,
      subject: `Your Ticket for ${movieName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #d4a373; text-align: center;">BLACKWELL FILMS</h2>
          <p>Thank you for your purchase! You now have 90 days of access to <strong>${movieName}</strong>.</p>
          <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #d4a373;">YOUR ACCESS CODE</p>
            <h1 style="margin: 10px 0; letter-spacing: 8px; font-size: 32px;">${code}</h1>
          </div>
          <p style="font-size: 13px; color: #666;">This code works on up to <strong>3 devices</strong>. Simply enter it on our website to start watching.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, code: code, message: "Access Granted!" });

  } catch (error) {
    console.error("Purchase Error:", error);
    // Even if email fails, we return success so they get the code on the screen
    res.json({ success: true, code: code, message: "Access Granted (Email failed to send)" });
  }
});

// 2. VERIFY TICKET & DEVICE LIMIT
app.post("/api/verify-ticket", async (req, res) => {
  const { code, movieName } = req.body;
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

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
        return res.status(403).json({ valid: false, message: "Device limit reached." });
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

app.listen(PORT, () => console.log(`🚀 SERVER RUNNING ON ${PORT}`));