import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./App.css";

const MOVIE_DATA = [
  {
    id: "cards-on-the-table",
    name: "Cards on the Table",
    price: 250,
    description:
      "An ex-couple team up to rob the gate collections at a Christmas event in 1992 Nairobi, but their layers of unresolved issues land them in police custody.",
    cast: "Nyakundi Isaboke, Shirleen Wangari, Mufasa Poet, Murunyu Duncan",
    director: "Victor Gatonye",
    genre: "Romantic Drama, Comedy",
    trailerLink: "https://www.youtube.com/embed/Wjmm1p9h-TA",
    movieFile: "https://player.vimeo.com/video/1145911659",
    image: "/COTTposter1.jpg",
    landscapeImage: "/COTTP2.jpg",
    isFeatured: true,
    type: "movie",
  },
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [userEmail, setUserEmail] = useState(() =>
    localStorage.getItem("userEmail")
  );
  const [view, setView] = useState("home");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [hasAccess, setHasAccess] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const movies = useMemo(() => MOVIE_DATA, []);
  const selectedMovie = movies[0];
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5555/api";

  const showFeedback = (type, msg) => {
    setStatus({ type, message: msg });
    setTimeout(() => setStatus({ type: "", message: "" }), 5000);
  };

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) return;
      try {
        const res = await axios.post(
          `${API_BASE}/check-access`,
          { movieName: selectedMovie.name },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setHasAccess({ [selectedMovie.name]: res.data.hasAccess });
      } catch (err) {
        console.error("Access check failed");
      }
    };
    checkAccess();
  }, [token, API_BASE, selectedMovie.name]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const res = await axios.post(`${API_BASE}/${endpoint}`, formData);
      if (authMode === "login") {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userEmail", formData.email);
        setToken(res.data.token);
        setUserEmail(formData.email);
        setShowAuthModal(false);
        showFeedback("success", "Welcome back!");
      } else {
        setAuthMode("login");
        showFeedback("success", "Account created! Please login.");
      }
    } catch (err) {
      showFeedback("error", "Authentication failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayClick = () => {
    if (!token) {
      setAuthMode("login");
      setShowAuthModal(true);
    } else if (!hasAccess[selectedMovie.name]) {
      setShowPaymentModal(true);
    } else {
      setIsPlaying(true);
    }
  };

  const payWithPaystack = () => {
    const handler = window.PaystackPop.setup({
      key: "pk_test_8196b2b3d7ad464e3e647c4d23a1e092a40b8da8",
      email: userEmail,
      amount: selectedMovie.price * 100,
      currency: "KES",
      callback: async (response) => {
        try {
          await axios.post(
            `${API_BASE}/purchase-movie`,
            { movieName: selectedMovie.name, reference: response.reference },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setHasAccess({ [selectedMovie.name]: true });
          setShowPaymentModal(false);
          showFeedback("success", "Purchase successful!");
        } catch (err) {
          showFeedback("error", "Verification failed");
        }
      },
    });
    handler.openIframe();
  };

  return (
    <div className="app-container">
      {status.message && (
        <div className={`status-toast ${status.type}`}>{status.message}</div>
      )}

      <nav className="nav-bar">
        <h2 className="nav-logo" onClick={() => setView("home")}>
          BLACKWELL
        </h2>

        {/* RESTORED NAVIGATION LINKS */}
        <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
          <span className="nav-link" onClick={() => setView("home")}>
            Movies
          </span>
          <span className="nav-link">Shows</span>
          <span className="nav-link">Watchlist</span>
          {token && <span className="nav-link">Profile</span>}

          {token ? (
            <button
              className="btn-logout"
              onClick={() => {
                localStorage.clear();
                setToken(null);
                setView("home");
              }}
            >
              Logout
            </button>
          ) : (
            <>
              <span
                className="nav-link"
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
              >
                Login
              </span>
              <button
                className="btn btn-primary"
                style={{ padding: "10px 20px" }}
                onClick={() => {
                  setAuthMode("signup");
                  setShowAuthModal(true);
                }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        {view === "home" && (
          <div>
            <div className="hero-wrapper">
              <div className="play-overlay-btn" onClick={handlePlayClick}>
                <span
                  style={{
                    color: "white",
                    fontSize: "30px",
                    marginLeft: "5px",
                  }}
                >
                  ▶
                </span>
              </div>
              <img
                src={selectedMovie.landscapeImage}
                alt="Featured"
                className="hero-image"
              />
            </div>

            <div style={{ padding: "60px 5% 80px 5%", textAlign: "center" }}>
              <h1 style={{ fontSize: "3rem", marginBottom: "20px" }}>
                {selectedMovie.name}
              </h1>
              <p
                style={{
                  maxWidth: "800px",
                  margin: "0 auto",
                  color: "#bbb",
                  fontSize: "1.1rem",
                  lineHeight: "1.8",
                }}
              >
                {selectedMovie.description}
              </p>

              <div className="action-stack">
                <button
                  onClick={() => setActiveTrailer(selectedMovie.trailerLink)}
                  className="btn btn-secondary"
                >
                  VIEW TRAILER
                </button>

                {hasAccess[selectedMovie.name] ? (
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="btn btn-success"
                  >
                    ▶ WATCH NOW
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      token ? setShowPaymentModal(true) : setShowAuthModal(true)
                    }
                    className="btn btn-primary"
                  >
                    BUY 3-MONTH ACCESS (KES 250)
                  </button>
                )}

                <button
                  onClick={() => setView("movie-detail")}
                  className="btn btn-ghost"
                >
                  VIEW INFO
                </button>
              </div>
            </div>

            <section className="home-info-section">
              <div className="info-grid">
                <img
                  src={selectedMovie.image}
                  alt="Portrait"
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  }}
                />
                <div style={{ paddingTop: "20px" }}>
                  <h2
                    style={{
                      color: "var(--accent-color)",
                      fontSize: "2rem",
                      marginBottom: "40px",
                      borderBottom: "2px solid var(--accent-color)",
                      display: "inline-block",
                    }}
                  >
                    STORY & CAST
                  </h2>
                  <div className="meta-row">
                    <span className="meta-label">SYNOPSIS</span>{" "}
                    <span style={{ color: "#ccc" }}>
                      {selectedMovie.description}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">GENRE</span>{" "}
                    {selectedMovie.genre}
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">DIRECTOR</span>{" "}
                    {selectedMovie.director}
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">CAST</span>{" "}
                    {selectedMovie.cast}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {view === "movie-detail" && (
          <div
            style={{ padding: "80px 5%", maxWidth: "1100px", margin: "0 auto" }}
          >
            <button
              className="nav-link"
              onClick={() => setView("home")}
              style={{
                marginBottom: "40px",
                display: "block",
                background: "none",
                border: "none",
                fontSize: "16px",
              }}
            >
              ← BACK TO HOME
            </button>
            <div className="info-grid">
              <img
                src={selectedMovie.image}
                alt="Poster"
                style={{ width: "100%", borderRadius: "12px" }}
              />
              <div>
                <h1 style={{ fontSize: "4rem", margin: "0 0 20px 0" }}>
                  {selectedMovie.name}
                </h1>
                <p
                  style={{
                    fontSize: "1.2rem",
                    lineHeight: "1.8",
                    color: "#ccc",
                    marginBottom: "40px",
                  }}
                >
                  {selectedMovie.description}
                </p>
                <div className="meta-row">
                  <span className="meta-label">GENRE</span>{" "}
                  {selectedMovie.genre}
                </div>
                <div className="meta-row">
                  <span className="meta-label">DIRECTOR</span>{" "}
                  {selectedMovie.director}
                </div>
                <div className="meta-row">
                  <span className="meta-label">CAST</span> {selectedMovie.cast}
                </div>
                <div className="action-stack" style={{ margin: "40px 0 0 0" }}>
                  <button onClick={handlePlayClick} className="btn btn-primary">
                    {hasAccess[selectedMovie.name]
                      ? "PLAY NOW"
                      : "GET ACCESS - KES 250"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* RESTORED FULL FOOTER */}
      <footer className="app-footer">
        <div
          style={{
            textAlign: "center",
            borderBottom: "1px solid #222",
            paddingBottom: "40px",
            marginBottom: "40px",
          }}
        >
          <h2 className="nav-logo" style={{ fontSize: "20px" }}>
            BLACKWELL
          </h2>
        </div>
        <div className="footer-grid">
          <div>
            <h5 className="meta-label" style={{ minWidth: "auto" }}>
              LEGAL
            </h5>
            <span
              className="nav-link"
              style={{ display: "block", marginBottom: "10px" }}
            >
              Terms of Service
            </span>
            <span className="nav-link" style={{ display: "block" }}>
              Privacy Policy
            </span>
          </div>
          <div>
            <h5 className="meta-label" style={{ minWidth: "auto" }}>
              SOCIAL
            </h5>
            <span
              className="nav-link"
              style={{ display: "block", marginBottom: "10px" }}
            >
              Instagram
            </span>
            <span className="nav-link" style={{ display: "block" }}>
              TikTok
            </span>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <div className="theater-overlay">
          <div className="auth-card" style={{ position: "relative" }}>
            <button
              onClick={() => setShowAuthModal(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <h2 style={{ textAlign: "center", color: "var(--accent-color)" }}>
              {authMode === "login" ? "Login" : "Sign Up"}
            </h2>
            <form
              onSubmit={handleAuth}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {authMode === "signup" && (
                <input
                  style={{
                    padding: "12px",
                    background: "#000",
                    border: "1px solid #333",
                    color: "white",
                    borderRadius: "5px",
                  }}
                  name="full_name"
                  placeholder="Full Name"
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              )}
              <input
                style={{
                  padding: "12px",
                  background: "#000",
                  border: "1px solid #333",
                  color: "white",
                  borderRadius: "5px",
                }}
                name="email"
                type="email"
                placeholder="Email"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
              <input
                style={{
                  padding: "12px",
                  background: "#000",
                  border: "1px solid #333",
                  color: "white",
                  borderRadius: "5px",
                }}
                name="password"
                type="password"
                placeholder="Password"
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Processing..."
                  : authMode === "login"
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>
            <p
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              style={{
                textAlign: "center",
                marginTop: "20px",
                fontSize: "14px",
                cursor: "pointer",
                color: "var(--accent-color)",
              }}
            >
              {authMode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Login"}
            </p>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="theater-overlay">
          <div className="auth-card">
            <h2 style={{ textAlign: "center" }}>Checkout</h2>
            <p style={{ textAlign: "center", marginBottom: "30px" }}>
              Access Cards on the Table for 90 days.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={payWithPaystack}
            >
              PAY KES 250
            </button>
            <button
              className="nav-link"
              style={{
                width: "100%",
                marginTop: "20px",
                textAlign: "center",
                background: "none",
                border: "none",
              }}
              onClick={() => setShowPaymentModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isPlaying && (
        <div className="theater-overlay">
          <button
            className="btn-ghost"
            style={{
              position: "absolute",
              top: "20px",
              right: "40px",
              padding: "10px 20px",
            }}
            onClick={() => setIsPlaying(false)}
          >
            ✕ CLOSE
          </button>
          <iframe
            title={selectedMovie.name}
            src={`${selectedMovie.movieFile}?autoplay=1`}
            style={{ width: "85%", aspectRatio: "16/9", border: "none" }}
            allowFullScreen
          />
        </div>
      )}

      {activeTrailer && (
        <div className="theater-overlay">
          <button
            className="btn-ghost"
            style={{
              position: "absolute",
              top: "20px",
              right: "40px",
              padding: "10px 20px",
            }}
            onClick={() => setActiveTrailer(null)}
          >
            ✕ CLOSE TRAILER
          </button>
          <iframe
            title="Movie Trailer"
            src={`${activeTrailer}?autoplay=1`}
            style={{ width: "80%", aspectRatio: "16/9", border: "none" }}
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

export default App;
