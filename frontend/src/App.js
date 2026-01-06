import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import "./App.css";

// --- DATA ---
const MOVIE_DATA = [
  {
    id: "cards-on-the-table",
    name: "Cards on the Table",
    price: 250,
    description:
      "An ex-couple team up to rob the gate collections at a Christmas event in 1992 Nairobi, but their layers of unresolved issues land them in police custody.",
    cast: ["Nyakundi Isaboke, Shirleen Wangari, Mufasa Poet, Murunyu Duncan"],
    director: "Victor Gatonye",
    genre: "Romantic Drama, Comedy",
    trailerLink: "https://www.youtube.com/embed/Wjmm1p9h-TA",
    movieFile:
      "https://player.vimeo.com/video/1145911659?autoplay=1&badge=0&autopause=0",
    image: "/COTTposter1.jpg",
    landscapeImage: "/COTTP2.jpg",
    isFeatured: true,
    type: "movie",
  },
  // Add more placeholders for "Shows" page if needed
  {
    id: "coming-soon-1",
    name: "Nairobi Nights",
    price: 0,
    description: "Coming Soon",
    cast: [],
    director: "TBA",
    genre: "Drama",
    trailerLink: "",
    movieFile: "",
    image: "https://via.placeholder.com/300x450?text=Coming+Soon",
    landscapeImage: "",
    isFeatured: false,
    type: "show",
  },
];

const LEGAL_TEXT = {
  terms: `TERMS OF SERVICE\n\n1. ACCEPTANCE OF TERMS\nBy accessing and using the Blackwell Films platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.\n\n2. DIGITAL CONTENT LICENSE\nWhen you purchase a ticket or access code, Blackwell Films grants you a non-exclusive, non-transferable, limited license to view the specific content for personal, non-commercial use. This license is valid for 90 days from the date of purchase.\n\n3. DEVICE LIMITATIONS\nYour access code is valid for use on up to three (3) unique devices (e.g., one mobile phone, one laptop, one tablet). Sharing your code publicly or attempting to bypass this limit will result in immediate termination of access without refund.\n\n4. REFUND POLICY\nDue to the nature of digital streaming content, all sales are final. Refunds are only issued in the event of a proven technical failure on our end that prevents access to the content for the duration of your license.\n\n5. INTELLECTUAL PROPERTY\nAll content, including films, trailers, images, and logos, are the property of Blackwell Films or its licensors and are protected by copyright laws. Unauthorized recording, copying, or redistribution is strictly prohibited.`,
  privacy: `PRIVACY POLICY\n\n1. INFORMATION COLLECTION\nWe collect only the information necessary to facilitate your viewing experience. This includes your email address (for ticket delivery) and payment confirmation details. We do not store your full credit card information; payments are processed securely via Paystack.\n\n2. HOW WE USE YOUR DATA\nYour email is used solely to send you your access code and receipt. We may occasionally send important updates regarding the platform or your specific purchase. We do not sell, rent, or trade your personal information to third parties.\n\n3. DEVICE TRACKING\nTo enforce our single-user license, we log the IP address of the devices used to access our content. This data is used strictly for security and license enforcement purposes.\n\n4. DATA SECURITY\nWe implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.\n\n5. CONTACT US\nIf you have questions regarding your data or these policies, please contact us at blackwellfilmsafrica@gmail.com.`,
};

function ProgressiveImage({ src, alt, className, style, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`progressive-image-container ${className || ""}`}
      style={style}
      onClick={onClick}
    >
      {!loaded && <div className="shimmer" />}
      <img
        src={src}
        alt={alt}
        className="progressive-img"
        style={{
          opacity: loaded ? 1 : 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          e.target.src =
            "https://via.placeholder.com/400x600?text=Image+Not+Found";
          setLoaded(true);
        }}
      />
    </div>
  );
}

function App() {
  // State
  const [view, setView] = useState("home");
  const [accessCodes, setAccessCodes] = useState(
    () => JSON.parse(localStorage.getItem("blackwell_tickets")) || {}
  );
  const [showGatekeeper, setShowGatekeeper] = useState(false);
  const [gatekeeperMode, setGatekeeperMode] = useState("buy"); // 'buy' or 'code'

  // Forms & UI
  const [email, setEmail] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [legalView, setLegalView] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const movies = useMemo(() => MOVIE_DATA, []);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const infoSectionRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5555/api";

  // --- HELPERS ---
  const showFeedback = (type, msg) => {
    setStatus({ type, message: msg });
    setTimeout(() => setStatus({ type: "", message: "" }), 5000);
  };

  useEffect(() => {
    const tickets = JSON.parse(localStorage.getItem("blackwell_tickets")) || {};
    setAccessCodes(tickets);
  }, []);

  const hasAccess = (movieName) => {
    return !!accessCodes[movieName];
  };

  const handlePlayRequest = (movie) => {
    setSelectedMovie(movie);
    if (hasAccess(movie.name)) {
      setIsPlaying(true);
    } else {
      setShowGatekeeper(true);
      setGatekeeperMode("buy");
    }
  };

  // --- PAYSTACK LOGIC ---
  const handlePaystack = () => {
    if (!email)
      return showFeedback(
        "error",
        "Please enter your email to receive the ticket."
      );

    // Check if Paystack script is loaded
    if (!window.PaystackPop) {
      return showFeedback(
        "error",
        "Payment system loading... please try again in a moment."
      );
    }

    const handler = window.PaystackPop.setup({
      key: "pk_test_8196b2b3d7ad464e3e647c4d23a1e092a40b8da8", // Replace with your Public Key
      email: email,
      amount: selectedMovie.price * 100,
      currency: "KES",
      callback: (response) => processPurchase(response.reference),
      onClose: () => showFeedback("error", "Payment cancelled."),
    });
    handler.openIframe();
  };

  const processPurchase = async (reference) => {
    setIsProcessing(true);
    try {
      const res = await axios.post(`${API_BASE}/purchase-guest`, {
        email,
        reference,
        movieName: selectedMovie.name,
      });

      if (res.data.success) {
        saveTicket(selectedMovie.name, res.data.code);
        setShowGatekeeper(false);
        setIsPlaying(true);
        showFeedback("success", "Ticket confirmed! Code sent to email.");
      } else {
        showFeedback(
          "error",
          res.data.message || "Authentication failed on the site."
        );
      }
    } catch (err) {
      console.error("Purchase Error:", err);
      // More specific error message for user
      const msg =
        err.response?.data?.message ||
        "Connection error. Please contact support.";
      showFeedback("error", msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CODE VERIFICATION LOGIC ---
  const verifyCode = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-ticket`, {
        code: inputCode,
        movieName: selectedMovie.name,
      });

      if (res.data.valid) {
        saveTicket(selectedMovie.name, inputCode);
        setShowGatekeeper(false);
        setIsPlaying(true);
        showFeedback("success", "Code Accepted! Enjoy.");
      }
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Invalid Code");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTicket = (movie, code) => {
    const newTickets = { ...accessCodes, [movie]: code };
    setAccessCodes(newTickets);
    localStorage.setItem("blackwell_tickets", JSON.stringify(newTickets));
  };

  const scrollToInfo = () =>
    infoSectionRef.current?.scrollIntoView({ behavior: "smooth" });

  const filteredResults = movies.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      {status.message && (
        <div
          className={`status-toast ${
            status.type === "success" ? "status-success" : "status-error"
          }`}
        >
          {status.type === "success" ? "✓ " : "✕ "} {status.message}
        </div>
      )}

      {/* --- NAV --- */}
      <nav className="nav-bar">
        <div className="nav-left">
          <h2 className="nav-logo" onClick={() => setView("home")}>
            BLACKWELL
          </h2>
          <div className="nav-links">
            <span
              className={`nav-link ${view === "home" ? "active" : ""}`}
              onClick={() => setView("home")}
            >
              Home
            </span>
            <span
              className={`nav-link ${view === "shows" ? "active" : ""}`}
              onClick={() => setView("shows")}
            >
              Shows
            </span>
          </div>
        </div>
        <div className="nav-right">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <span className="search-clear" onClick={() => setSearchQuery("")}>
                ✕
              </span>
            )}
          </div>
          {/* REMOVED ENTER CODE BUTTON AS REQUESTED */}
        </div>
      </nav>

      {/* --- CONTENT --- */}
      <div className="main-content">
        {searchQuery ? (
          <div className="centered-container">
            <h2 style={{ marginBottom: "30px", fontWeight: "300" }}>
              RESULTS FOR "{searchQuery.toUpperCase()}"
            </h2>
            {filteredResults.map((item) => (
              <div
                key={item.id}
                className="movie-card"
                style={{ display: "flex", padding: "15px", gap: "20px" }}
              >
                <ProgressiveImage
                  src={item.image}
                  alt={item.name}
                  style={{ width: "80px", borderRadius: "4px" }}
                />
                <div style={{ flex: 1 }}>
                  <h4>{item.name}</h4>
                  <button
                    onClick={() => handlePlayRequest(item)}
                    className="btn btn-primary btn-sm"
                  >
                    WATCH
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {view === "home" && (
              <div>
                <div className="hero-wrapper">
                  <div
                    className="play-overlay-btn"
                    onClick={() => handlePlayRequest(MOVIE_DATA[0])}
                  >
                    <span className="play-icon">▶</span>
                  </div>
                  <ProgressiveImage
                    src={MOVIE_DATA[0].landscapeImage}
                    alt={MOVIE_DATA[0].name}
                    className="hero-image"
                  />
                </div>

                <div className="centered-container-lg">
                  <div className="hero-content">
                    <div>
                      <h2 style={{ color: "var(--accent-color)", margin: 0 }}>
                        {MOVIE_DATA[0].name}
                      </h2>
                      <p
                        style={{
                          marginTop: "10px",
                          fontSize: "14px",
                          fontWeight: "bold",
                          color: "#fff",
                          letterSpacing: "1px",
                        }}
                      >
                        FEATURED FILM: CARDS ON THE TABLE
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        hasAccess(MOVIE_DATA[0].name) ? "badge-owned" : ""
                      }`}
                    >
                      {hasAccess(MOVIE_DATA[0].name)
                        ? "TICKET ACTIVE"
                        : `KES ${MOVIE_DATA[0].price}`}
                    </span>
                  </div>

                  <div className="hero-actions">
                    <button
                      onClick={() =>
                        setActiveTrailer(MOVIE_DATA[0].trailerLink)
                      }
                      className="btn btn-secondary"
                    >
                      VIEW TRAILER
                    </button>
                    <button
                      onClick={() => handlePlayRequest(MOVIE_DATA[0])}
                      className={
                        hasAccess(MOVIE_DATA[0].name)
                          ? "btn btn-success"
                          : "btn btn-primary"
                      }
                    >
                      {hasAccess(MOVIE_DATA[0].name)
                        ? "▶ WATCH NOW"
                        : "GET TICKET"}
                    </button>
                    <button onClick={scrollToInfo} className="btn btn-ghost">
                      INFO
                    </button>
                  </div>

                  <div className="home-movie-info" ref={infoSectionRef}>
                    <div className="detail-grid">
                      <div className="detail-poster">
                        <ProgressiveImage
                          src={MOVIE_DATA[0].image}
                          alt="poster"
                        />
                      </div>
                      <div>
                        <h3 style={{ color: "var(--accent-color)" }}>
                          SYNOPSIS
                        </h3>
                        <p className="detail-desc">
                          {MOVIE_DATA[0].description}
                        </p>
                        <div className="detail-meta">
                          <div className="meta-row">
                            <span className="meta-label">DIRECTOR:</span>{" "}
                            {MOVIE_DATA[0].director}
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">CAST:</span>{" "}
                            {MOVIE_DATA[0].cast.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "shows" && (
              <div className="centered-container-lg">
                <h1
                  style={{
                    textAlign: "center",
                    marginBottom: "40px",
                    fontWeight: "300",
                    letterSpacing: "2px",
                  }}
                >
                  SHOWS (COMING SOON)
                </h1>
                <div className="movie-grid">
                  {movies.map((movie) => (
                    <div key={movie.id} className="movie-card">
                      <ProgressiveImage
                        src={movie.image}
                        alt={movie.name}
                        style={{ height: "400px" }}
                      />
                      <div className="card-content">
                        <h3>{movie.name}</h3>
                        {movie.price > 0 ? (
                          <button
                            onClick={() => handlePlayRequest(movie)}
                            className="btn btn-primary btn-sm"
                          >
                            WATCH
                          </button>
                        ) : (
                          <span className="badge">COMING SOON</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- FOOTER (Restored Socials & Layout) --- */}
      <footer className="app-footer">
        <div className="footer-grid">
          <div>
            <h4
              className="nav-logo"
              style={{ margin: "0 0 10px 0", fontSize: "24px" }}
            >
              BLACKWELL
            </h4>
            <p style={{ color: "#666", fontSize: "12px" }}>
              © 2025 Blackwell Films.
            </p>
          </div>

          <div>
            <h5 className="footer-head">Socials</h5>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              TikTok
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              Instagram
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              Facebook
            </a>
          </div>

          <div>
            <h5 className="footer-head">Support</h5>
            <button
              className="footer-link"
              onClick={() => setLegalView("terms")}
            >
              Terms of Service
            </button>
            <button
              className="footer-link"
              onClick={() => setLegalView("privacy")}
            >
              Privacy Policy
            </button>
            <button
              className="footer-link"
              onClick={() => setShowContact(true)}
            >
              Contact Us
            </button>
          </div>
        </div>
      </footer>

      {/* --- GATEKEEPER MODAL --- */}
      {showGatekeeper && (
        <div className="modal-overlay">
          <div
            className="auth-card"
            style={{ width: "600px", maxWidth: "95%" }}
          >
            <button
              onClick={() => setShowGatekeeper(false)}
              className="btn-close-modal"
            >
              ✕
            </button>

            <h2
              style={{
                textAlign: "center",
                color: "var(--accent-color)",
                marginBottom: "30px",
              }}
            >
              {selectedMovie?.name.toUpperCase()}
            </h2>

            <div className="gatekeeper-tabs">
              <button
                className={`tab-btn ${
                  gatekeeperMode === "buy" ? "active" : ""
                }`}
                onClick={() => setGatekeeperMode("buy")}
              >
                BUY TICKET
              </button>
              <button
                className={`tab-btn ${
                  gatekeeperMode === "code" ? "active" : ""
                }`}
                onClick={() => setGatekeeperMode("code")}
              >
                HAVE A CODE?
              </button>
              <button
                className={`tab-btn ${gatekeeperMode === "qr" ? "active" : ""}`}
                onClick={() => setGatekeeperMode("qr")}
              >
                SCAN QR
              </button>
            </div>

            <div className="gatekeeper-content">
              {gatekeeperMode === "buy" && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#ccc", marginBottom: "20px" }}>
                    Get 90 days access on up to 3 devices. <br />
                    We'll email you a unique access code.
                  </p>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ marginBottom: "15px", textAlign: "center" }}
                  />
                  <button
                    onClick={handlePaystack}
                    disabled={isProcessing}
                    className="btn btn-primary"
                  >
                    {isProcessing
                      ? "PROCESSING..."
                      : `PAY KES ${selectedMovie?.price}`}
                  </button>
                </div>
              )}

              {gatekeeperMode === "code" && (
                <form onSubmit={verifyCode} style={{ textAlign: "center" }}>
                  <p style={{ color: "#ccc", marginBottom: "20px" }}>
                    Enter the code sent to your email.
                  </p>
                  <input
                    type="text"
                    placeholder="BW-XXXXXX"
                    className="auth-input"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    style={{
                      marginBottom: "15px",
                      textAlign: "center",
                      letterSpacing: "3px",
                      fontWeight: "bold",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="btn btn-success"
                  >
                    {isProcessing ? "VERIFYING..." : "WATCH MOVIE"}
                  </button>
                </form>
              )}

              {/* QR CRASH FIX: Added safety check for selectedMovie and QRCode value */}
              {gatekeeperMode === "qr" && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <p style={{ color: "#ccc", marginBottom: "20px" }}>
                    Scan to buy or check access on mobile.
                  </p>
                  <div
                    style={{
                      background: "white",
                      padding: "10px",
                      display: "inline-block",
                      borderRadius: "8px",
                    }}
                  >
                    {selectedMovie && (
                      <QRCodeCanvas
                        value={`https://blackwellfilms.com/pay?movie=${selectedMovie.id}`}
                        size={150}
                      />
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      marginTop: "10px",
                    }}
                  >
                    Use your camera
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- VIDEO PLAYER --- */}
      {isPlaying && selectedMovie && (
        <div className="theater-overlay">
          <button
            onClick={() => setIsPlaying(false)}
            className="btn-close-theater"
          >
            ✕ CLOSE
          </button>
          <div
            style={{ width: "85%", aspectRatio: "16/9", position: "relative" }}
          >
            <iframe
              src={`${selectedMovie.movieFile}&title=0&byline=0&portrait=0`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                borderRadius: "12px",
                border: "none",
              }}
              allow="autoplay; fullscreen"
              allowFullScreen
              title={selectedMovie.name}
            ></iframe>
          </div>
        </div>
      )}

      {activeTrailer && (
        <div className="theater-overlay">
          <button
            onClick={() => setActiveTrailer(null)}
            className="btn-close-theater"
          >
            ✕ CLOSE
          </button>
          <div
            style={{
              width: "80%",
              maxWidth: "1000px",
              aspectRatio: "16/9",
              position: "relative",
            }}
          >
            <iframe
              src={`${activeTrailer}?autoplay=1`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                borderRadius: "12px",
                border: "none",
              }}
              allowFullScreen
              title="Trailer"
            ></iframe>
          </div>
        </div>
      )}

      {legalView && (
        <div className="modal-overlay">
          <div
            className="auth-card"
            style={{ width: "600px", maxHeight: "80vh", overflowY: "auto" }}
          >
            <h2 style={{ textAlign: "center", color: "var(--accent-color)" }}>
              {legalView === "terms" ? "TERMS OF SERVICE" : "PRIVACY POLICY"}
            </h2>
            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                color: "#ccc",
                fontSize: "14px",
                margin: "20px 0",
              }}
            >
              {legalView === "terms" ? LEGAL_TEXT.terms : LEGAL_TEXT.privacy}
            </div>
            <button
              onClick={() => setLegalView(null)}
              className="btn btn-primary"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
      {showContact && (
        <div className="modal-overlay">
          <div className="auth-card">
            <h2>CONTACT</h2>
            <p>blackwellfilmsafrica@gmail.com</p>
            <button
              onClick={() => setShowContact(false)}
              className="btn btn-primary"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
