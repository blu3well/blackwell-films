import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import "./App.css";

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
    movieFile: "https://player.vimeo.com/video/1145911659?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479",
    image: "/COTTposter1.jpg",
    landscapeImage: "/COTTP2.jpg",
    isFeatured: true,
    type: "movie",
  },
];

const LEGAL_TEXT = {
  terms: `BY ACCESSING BLACKWELL FILMS, YOU AGREE TO THESE TERMS: 
  1. ACCESS: PURCHASES GRANT A 3-MONTH (90 DAYS) VIEWING PERIOD. 
  2. REFUNDS: DUE TO THE DIGITAL NATURE OF OUR CONTENT, ALL SALES ARE FINAL ONCE ACCESS IS GRANTED. 
  3. USAGE: CONTENT IS FOR PERSONAL, NON-COMMERCIAL USE ONLY. SHARING ACCOUNTS IS PROHIBITED. 
  4. AVAILABILITY: WE AIM FOR 99% UPTIME BUT ARE NOT LIABLE FOR TEMPORARY TECHNICAL INTERRUPTIONS.`,
  privacy: `YOUR PRIVACY MATTERS TO US:
  1. DATA COLLECTION: WE COLLECT YOUR NAME AND EMAIL ADDRESS TO MANAGE YOUR ACCOUNT AND PURCHASES.
  2. PAYMENT SECURITY: WE DO NOT STORE CREDIT CARD DETAILS; ALL PAYMENTS ARE PROCESSED SECURELY VIA PAYSTACK.
  3. THIRD PARTIES: WE NEVER SELL YOUR DATA. WE ONLY SHARE NECESSARY INFO WITH OUR PAYMENT PROCESSOR TO VERIFY YOUR TRANSACTION.
  4. COOKIES: WE USE ESSENTIAL COOKIES TO KEEP YOU LOGGED IN.`,
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
            "https://via.placeholder.com/400x600?text=Poster+Not+Found";
          setLoaded(true);
        }}
      />
    </div>
  );
}

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
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState("");
  const [hasAccess, setHasAccess] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [watchlist, setWatchlist] = useState(
    () => JSON.parse(localStorage.getItem("watchlist")) || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [legalView, setLegalView] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const infoSectionRef = useRef(null);

  const movies = useMemo(() => MOVIE_DATA, []);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);

  const filteredResults = movies.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.cast.some((actor) =>
        actor.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5555/api";

  const showFeedback = (type, msg) => {
    setStatus({ type, message: msg });
    setTimeout(() => setStatus({ type: "", message: "" }), 5000);
  };

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const checkAllAccess = async () => {
      if (!token) return;
      const accessStatus = {};
      for (let movie of movies) {
        try {
          const res = await axios.post(
            `${API_BASE}/check-access`,
            { movieName: movie.name },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          accessStatus[movie.name] = res.data.hasAccess;
        } catch (err) {
          accessStatus[movie.name] = false;
        }
      }
      setHasAccess(accessStatus);
    };
    checkAllAccess();
  }, [token, movies, API_BASE]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage("");
    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const res = await axios.post(`${API_BASE}/${endpoint}`, formData);
      if (authMode === "login") {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("token", res.data.token);
        storage.setItem("userEmail", formData.email);
        setToken(res.data.token);
        setUserEmail(formData.email);
        setShowAuthModal(false);
        showFeedback("success", "Logged in successfully");
      } else {
        showFeedback("success", "Account created! Please log in.");
        setAuthMode("login");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || "Authentication failed";
      setMessage(errMsg);
      showFeedback("error", errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHeroPlay = () => {
    if (!token) {
      setAuthMode("login");
      setShowAuthModal(true);
      return;
    }
    if (hasAccess[selectedMovie.name]) {
      setIsPlaying(true);
    } else {
      setShowPaymentModal(true);
    }
  };

  const scrollToInfo = () => {
    infoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const payWithPaystack = () => {
    const handler = window.PaystackPop.setup({
      key: "pk_test_8196b2b3d7ad464e3e647c4d23a1e092a40b8da8",
      email: userEmail,
      amount: selectedMovie.price * 100,
      currency: "KES",
      callback: (response) => completePurchase(response.reference),
      onClose: () => showFeedback("error", "Transaction cancelled."),
    });
    handler.openIframe();
  };

  const completePurchase = async (reference) => {
    setIsProcessing(true);
    try {
      await axios.post(
        `${API_BASE}/purchase-movie`,
        { movieName: selectedMovie.name, reference: reference },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowPaymentModal(false);
      setHasAccess((prev) => ({ ...prev, [selectedMovie.name]: true }));
      showFeedback(
        "success",
        `Success! Access granted to ${selectedMovie.name}`
      );
    } catch (err) {
      showFeedback(
        "error",
        "Purchase verification failed. Please contact support."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleWatchlist = (movieName) => {
    setWatchlist((prev) =>
      prev.includes(movieName)
        ? prev.filter((i) => i !== movieName)
        : [...prev, movieName]
    );
  };

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

      <nav className="nav-bar">
        <div className="nav-left">
          <h2
            className="nav-logo"
            onClick={() => {
              setView("home");
              setSearchQuery("");
            }}
          >
            BLACKWELL
          </h2>
          {token && (
            <div className="nav-links">
              {["home", "movies", "shows", "watchlist"].map((page) => (
                <span
                  key={page}
                  className={`nav-link ${
                    view === page && !searchQuery ? "active" : ""
                  }`}
                  onClick={() => {
                    setView(page);
                    setSearchQuery("");
                  }}
                >
                  {page.charAt(0).toUpperCase() + page.slice(1)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="nav-right">
          {token ? (
            <>
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Search..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span
                    className="search-clear"
                    onClick={() => setSearchQuery("")}
                  >
                    ✕
                  </span>
                )}
              </div>
              <span
                className={`nav-link ${view === "profile" ? "active" : ""}`}
                onClick={() => {
                  setView("profile");
                  setSearchQuery("");
                }}
                style={{ marginRight: "20px" }}
              >
                Profile
              </span>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  setToken(null);
                  setView("home");
                }}
                className="btn-logout"
              >
                Logout
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ border: "none" }}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setShowAuthModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="main-content">
        {searchQuery && (
          <div className="centered-container">
            <h2
              style={{
                marginBottom: "30px",
                fontWeight: "300",
                letterSpacing: "1px",
              }}
            >
              RESULTS FOR "{searchQuery.toUpperCase()}"
            </h2>
            {filteredResults.length > 0 ? (
              <div className="movie-grid">
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    className="movie-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "15px",
                      gap: "20px",
                    }}
                  >
                    <div style={{ width: "80px" }}>
                      <ProgressiveImage
                        src={item.image}
                        alt={item.name}
                        style={{ borderRadius: "4px" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 5px 0" }}>{item.name}</h4>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--accent-color)",
                          letterSpacing: "1px",
                        }}
                      >
                        {item.type.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMovie(item);
                        setView("movie-detail");
                        setSearchQuery("");
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      VIEW
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p
                style={{
                  color: "#555",
                  textAlign: "center",
                  marginTop: "40px",
                }}
              >
                No content found matching your search.
              </p>
            )}
          </div>
        )}

        {!searchQuery && (
          <>
            {view === "home" && (
              <div>
                <div className="hero-wrapper">
                  <div className="play-overlay-btn" onClick={handleHeroPlay}>
                    <span className="play-icon">▶</span>
                  </div>
                  <ProgressiveImage
                    src={MOVIE_DATA[0].landscapeImage || MOVIE_DATA[0].image}
                    alt={MOVIE_DATA[0].name}
                    className="hero-image"
                  />
                </div>

                <div className="centered-container-lg">
                  <div className="hero-content">
                    <h2 style={{ color: "var(--accent-color)", margin: 0 }}>
                      {MOVIE_DATA[0].name}
                    </h2>
                    <span
                      className={`badge ${
                        hasAccess[MOVIE_DATA[0].name] ? "badge-owned" : ""
                      }`}
                    >
                      {hasAccess[MOVIE_DATA[0].name]
                        ? "OWNED"
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

                    {hasAccess[MOVIE_DATA[0].name] ? (
                      <button
                        onClick={() => {
                          setSelectedMovie(MOVIE_DATA[0]);
                          setIsPlaying(true);
                        }}
                        className="btn btn-success"
                      >
                        ▶ WATCH NOW
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedMovie(MOVIE_DATA[0]);
                          if (!token) {
                            setAuthMode("login");
                            setShowAuthModal(true);
                          } else {
                            setShowPaymentModal(true);
                          }
                        }}
                        className="btn btn-primary"
                      >
                        BUY 3-MONTH ACCESS
                      </button>
                    )}

                    <button onClick={scrollToInfo} className="btn btn-ghost">
                      VIEW INFO
                    </button>
                  </div>

                  <div className="home-movie-info" ref={infoSectionRef}>
                    <div className="detail-grid">
                      <div className="detail-poster">
                        <ProgressiveImage
                          src={MOVIE_DATA[0].image}
                          alt={MOVIE_DATA[0].name}
                        />
                      </div>
                      <div>
                        <h3
                          style={{ color: "var(--accent-color)", marginTop: 0 }}
                        >
                          SYNOPSIS
                        </h3>
                        <p
                          className="detail-desc"
                          style={{ marginBottom: "30px" }}
                        >
                          {MOVIE_DATA[0].description}
                        </p>
                        <div className="detail-meta">
                          <div className="meta-row">
                            <span className="meta-label">GENRE:</span>{" "}
                            {MOVIE_DATA[0].genre}
                          </div>
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

            {view === "movie-detail" && (
              <div className="detail-container">
                <button onClick={() => setView("home")} className="btn-back">
                  ← BACK TO MOVIES
                </button>
                <div className="detail-grid">
                  <div className="detail-poster">
                    <ProgressiveImage
                      src={selectedMovie.image}
                      alt={selectedMovie.name}
                    />
                  </div>
                  <div>
                    <h1 className="detail-title">{selectedMovie.name}</h1>
                    <p className="detail-desc">{selectedMovie.description}</p>

                    <div className="detail-meta">
                      <div className="meta-row">
                        <span className="meta-label">GENRE:</span>{" "}
                        {selectedMovie.genre}
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">DIRECTOR:</span>{" "}
                        {selectedMovie.director}
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">CAST:</span>{" "}
                        {selectedMovie.cast.join(", ")}
                      </div>
                    </div>

                    <div className="detail-actions">
                      {hasAccess[selectedMovie.name] ? (
                        <button
                          onClick={() => setIsPlaying(true)}
                          className="btn btn-success"
                        >
                          WATCH NOW
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          className="btn btn-primary"
                        >
                          BUY ACCESS
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setActiveTrailer(selectedMovie.trailerLink)
                        }
                        className="btn btn-secondary"
                      >
                        VIEW TRAILER
                      </button>
                      <button
                        onClick={() => toggleWatchlist(selectedMovie.name)}
                        className="btn btn-ghost"
                      >
                        {watchlist.includes(selectedMovie.name)
                          ? "✓ IN WATCHLIST"
                          : "+ WATCHLIST"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "movies" && (
              <div className="centered-container">
                <h1
                  style={{
                    textAlign: "center",
                    marginBottom: "40px",
                    fontWeight: "300",
                    letterSpacing: "2px",
                  }}
                >
                  MOVIES
                </h1>
                <div className="movie-grid">
                  {movies.map((movie) => (
                    <div key={movie.id} className="movie-card">
                      <ProgressiveImage src={movie.image} alt={movie.name} />
                      <div className="card-content">
                        <h3 style={{ margin: 0 }}>{movie.name}</h3>
                        <button
                          onClick={() => {
                            setSelectedMovie(movie);
                            setView("movie-detail");
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          VIEW INFO
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === "shows" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "60vh",
                }}
              >
                <h1
                  style={{
                    color: "var(--accent-color)",
                    fontSize: "4rem",
                    fontWeight: "900",
                    letterSpacing: "5px",
                  }}
                >
                  COMING SOON
                </h1>
              </div>
            )}

            {view === "watchlist" && (
              <div className="centered-container">
                <h1
                  style={{
                    textAlign: "center",
                    marginBottom: "40px",
                    fontWeight: "300",
                    letterSpacing: "2px",
                  }}
                >
                  MY WATCHLIST
                </h1>
                {watchlist.length > 0 ? (
                  watchlist.map((movieName) => (
                    <div
                      key={movieName}
                      className="movie-card"
                      style={{
                        padding: "20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "15px",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>{movieName}</h3>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => {
                            const m = movies.find((x) => x.name === movieName);
                            if (m) setSelectedMovie(m);
                            setView("movie-detail");
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          VIEW
                        </button>
                        <button
                          onClick={() => toggleWatchlist(movieName)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ff6b6b",
                            cursor: "pointer",
                            fontSize: "18px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: "center", color: "#555" }}>
                    Your list is empty.
                  </p>
                )}
              </div>
            )}

            {view === "profile" && (
              <div className="profile-container">
                <h1 style={{ marginBottom: "40px", fontWeight: "300" }}>
                  Account Dashboard
                </h1>
                <div className="profile-grid">
                  <div className="profile-card profile-card-center">
                    <div className="avatar-circle">
                      {userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <h4 style={{ margin: "0 0 5px 0" }}>Member</h4>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "20px",
                      }}
                    >
                      {userEmail}
                    </p>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        setToken(null);
                      }}
                      className="btn-logout"
                    >
                      Logout Session
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    <div className="profile-card">
                      <h3
                        style={{
                          fontSize: "14px",
                          color: "var(--accent-color)",
                          marginTop: 0,
                          textTransform: "uppercase",
                        }}
                      >
                        Purchased Content
                      </h3>
                      <div style={{ marginTop: "20px" }}>
                        {Object.keys(hasAccess).some(
                          (key) => hasAccess[key]
                        ) ? (
                          movies
                            .filter((m) => hasAccess[m.name])
                            .map((m) => (
                              <div key={m.id} className="purchased-item">
                                <span style={{ fontWeight: "bold" }}>
                                  {m.name}
                                </span>
                                <span className="badge-full-access">
                                  FULL ACCESS
                                </span>
                              </div>
                            ))
                        ) : (
                          <p style={{ color: "#555", fontSize: "14px" }}>
                            No active movie passes found.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="app-footer">
        <div className="footer-grid">
          <div>
            <h4 className="footer-brand">BLACKWELL</h4>
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
          <div>
            <h5 className="footer-head">Connect</h5>
            <a
              href="https://www.tiktok.com/@blackwellfilms?lang=en"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              TikTok
            </a>
            <a
              href="https://www.instagram.com/blackwell_films/"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/Blackwellfilms"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              Facebook
            </a>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <div className="modal-overlay">
          <div className="auth-wrapper">
            <div className="auth-card" style={{ position: "relative" }}>
              <button
                onClick={() => setShowAuthModal(false)}
                style={{
                  position: "absolute",
                  top: "15px",
                  right: "15px",
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ✕
              </button>
              <h1
                className="auth-logo"
                style={{ fontSize: "28px", marginBottom: "20px" }}
              >
                BLACKWELL
              </h1>
              <h2
                style={{
                  textAlign: "center",
                  color: "var(--accent-color)",
                  marginTop: 0,
                }}
              >
                {authMode === "login" ? "Login" : "Sign Up"}
              </h2>
              <form onSubmit={handleSubmit} className="auth-form">
                {authMode === "signup" && (
                  <input
                    name="full_name"
                    placeholder="Full Name"
                    onChange={handleChange}
                    className="auth-input"
                    required
                  />
                )}
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  onChange={handleChange}
                  className="auth-input"
                  required
                />
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  onChange={handleChange}
                  className="auth-input"
                  required
                />

                {authMode === "login" && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember Me
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn btn-primary"
                >
                  {isProcessing
                    ? "PROCESSING..."
                    : authMode === "login"
                    ? "Login"
                    : "Create Account"}
                </button>
              </form>
              {message && (
                <p
                  style={{
                    color: "var(--accent-color)",
                    textAlign: "center",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  {message}
                </p>
              )}
              <p
                onClick={() =>
                  setAuthMode(authMode === "login" ? "signup" : "login")
                }
                className="auth-toggle"
              >
                {authMode === "login"
                  ? "Need an account? Sign Up"
                  : "Have an account? Login"}
              </p>
            </div>
          </div>
        </div>
      )}

      {showContact && (
        <div className="modal-overlay">
          <div
            className="auth-card"
            style={{ width: "400px", textAlign: "center" }}
          >
            <h2 style={{ color: "var(--accent-color)", marginBottom: "20px" }}>
              CONTACT US
            </h2>
            <div style={{ marginBottom: "25px" }}>
              <p
                style={{ fontSize: "12px", color: "#888", marginBottom: "5px" }}
              >
                PHONE
              </p>
              <p style={{ fontSize: "18px", fontWeight: "bold" }}>
                +254 726 924 537
              </p>
            </div>
            <div style={{ marginBottom: "30px" }}>
              <p
                style={{ fontSize: "12px", color: "#888", marginBottom: "5px" }}
              >
                EMAIL
              </p>
              <p style={{ fontSize: "15px", fontWeight: "bold" }}>
                blackwellfilmsafrica@gmail.com
              </p>
            </div>
            <button
              onClick={() => setShowContact(false)}
              className="btn btn-primary"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {isPlaying && (
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
              src={`${selectedMovie.movieFile}?autoplay=1&title=0&byline=0&portrait=0`}
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
            ✕ CLOSE TRAILER
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
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Movie Trailer"
            ></iframe>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="auth-card">
            <h2 style={{ color: "var(--accent-color)", textAlign: "center" }}>
              Checkout
            </h2>
            <p style={{ textAlign: "center", marginBottom: "20px" }}>
              {selectedMovie.name}
            </p>
            <button
              onClick={payWithPaystack}
              disabled={isProcessing}
              className="btn btn-primary"
            >
              {isProcessing ? "VERIFYING..." : `PAY KES ${selectedMovie.price}`}
            </button>
            <button
              onClick={() => setShowPaymentModal(false)}
              style={{
                background: "none",
                border: "none",
                color: "#888",
                cursor: "pointer",
                width: "100%",
                marginTop: "15px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {legalView && (
        <div className="modal-overlay">
          <div
            className="auth-card"
            style={{ width: "500px", maxHeight: "80vh", overflowY: "auto" }}
          >
            <h2
              style={{
                color: "var(--accent-color)",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {legalView === "terms" ? "Terms of Service" : "Privacy Policy"}
            </h2>
            <div
              style={{
                color: "#bbb",
                lineHeight: "1.6",
                fontSize: "14px",
                margin: "20px 0",
                whiteSpace: "pre-line",
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
    </div>
  );
}

export default App;
