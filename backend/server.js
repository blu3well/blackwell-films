const axios = require("axios");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db"); // Your PostgreSQL connection

const app = express();
const PORT = 5555; 

app.use(cors());
app.use(express.json());

// --- MIDDLEWARE ---
// We will use ONE consistent middleware for all protected routes
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) return res.status(401).json({ message: "Access Denied" });
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    // This attaches the userId and email to the request
    req.user = verified;
    next();
  } catch (err) { 
    res.status(403).json({ message: "Invalid Token" }); 
  }
};

// --- AUTH ROUTES ---

app.post("/api/register", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3)", 
      [full_name, email, hashedPassword]
    );
    res.json({ message: "User registered!" });
  } catch (error) { 
    console.log("SERVER ERROR:", error); // THIS LINE WILL SHOW IN RENDER LOGS
    res.status(500).send("Server Error");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (user.rows.length === 0) return res.status(401).json({ message: "Wrong email" });
    
    const validPass = await bcrypt.compare(password, user.rows[0].password);
    if (!validPass) return res.status(401).json({ message: "Wrong password" });
    
    // We include the email in the token so we can use it for Paystack later
    const token = jwt.sign(
      { userId: user.rows[0].id, email: user.rows[0].email }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );
    
    res.json({ 
      token: token, 
      user: { id: user.rows[0].id, name: user.rows[0].full_name } 
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// --- MOVIE ROUTES ---

// SECURE PURCHASE ROUTE (PostgreSQL Version)
app.post('/api/purchase-movie', verifyToken, async (req, res) => {
  const { movieName, reference } = req.body;
  const userId = req.user.userId; 

  if (!reference) {
    return res.status(400).json({ message: "No payment reference provided" });
  }

  try {
    // 1. Verify directly with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;

    // 2. Check if transaction was successful
    if (data.status !== 'success') {
      return res.status(400).json({ message: "Transaction failed or was declined." });
    }

    // 3. Grant Access in PostgreSQL
    // 90-day expiry calculation
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    await pool.query(
      "INSERT INTO purchases (user_id, movie_name, reference, expiry_date) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [userId, movieName, reference, expiryDate]
    );

    res.json({ message: "Purchase verified and access granted", success: true });

  } catch (error) {
    console.error("Payment Verification Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

app.post("/api/check-access", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { movieName } = req.body; 
    
    const purchase = await pool.query(
      "SELECT * FROM purchases WHERE user_id = $1 AND movie_name = $2 AND expiry_date > NOW() LIMIT 1", 
      [userId, movieName]
    );
    
    res.json({ hasAccess: purchase.rows.length > 0 });
  } catch (err) { 
    res.status(500).json({ error: "Server error" }); 
  }
});

app.listen(PORT, () => console.log(`🚀 ACTIVE ON PORT ${PORT}`));