import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import emailjs from "@emailjs/browser";
import "./App.css";

const MOVIE_DATA = [
  {
    id: "cards-on-the-table",
    name: "Cards on the Table",
    price: 250,
    description:
      "An ex-couple team up to rob the gate collections at a Christmas event in 1992 Nairobi, but their layers of unresolved issues land them in police custody.",
    cast: [
      {
        name: "Nyakundi Isaboke",
        link: "https://www.instagram.com/nyakundi_isaboke/",
      },
      {
        name: "Shirleen Wangari",
        link: "https://www.facebook.com/shirleenwangarikiura",
      },
      { name: "Mufasa Poet", link: "https://www.instagram.com/mufasapoet" },
      {
        name: "Murunyu Duncan",
        link: "https://www.facebook.com/SirRunyu/?locale=de_DE",
      },
    ],
    director: {
      name: "Victor Gatonye",
      link: "https://www.linkedin.com/in/victor-gatonye-14a7433a/?originalSubdomain=ke",
    },
    genre: "Romantic Drama, Comedy",
    runtime: "80 mins",
    rating: "PG",
    year: "2025",
    trailerLink: "https://www.youtube.com/embed/Wjmm1p9h-TA",
    movieFile:
      "https://player.vimeo.com/video/1145911659?autoplay=1&badge=0&autopause=0",
    image: "/COTTposter1.jpg",
    imdbLink: "https://www.imdb.com/title/tt38939205/",
    isFeatured: true,
    type: "movie",
  },
];

const HERO_IMAGES = [
  "/beth&jackso.jpg",
  "/kip.jpg",
  "/ndocha.jpg",
  "/beth.jpg",
];

const LEGAL_TEXT = {
  terms: `TERMS OF SERVICE\n\n1. ACCEPTANCE OF TERMS\nBy accessing and using the Blackwell Films platform, you agree to be bound by these Terms of Service.\n\n2. DIGITAL CONTENT LICENSE\nWhen you purchase a ticket or access code, Blackwell Films grants you a non-exclusive, non-transferable, limited license to view the specific content for personal, non-commercial use. This license is valid for 90 days from the date of purchase.\n\n3. DEVICE LIMITATIONS\nYour access code is valid for use on up to three (3) unique devices. Sharing your code publicly will result in termination of access.\n\n4. REFUND POLICY\nAll sales are final once access is granted.\n\n5. INTELLECTUAL PROPERTY\nAll content is property of Blackwell Films.`,
  privacy: `PRIVACY POLICY\n\n1. INFORMATION COLLECTION\nWe collect your email address for ticket delivery. We do not store credit card information.\n\n2. USE OF DATA\nYour email is used to send your access code. We do not sell your data.\n\n3. DEVICE TRACKING\nWe log IP addresses to enforce the single-user license.\n\n4. CONTACT\nblackwellfilmsafrica@gmail.com`,
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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("home");
  const [previousView, setPreviousView] = useState("home"); // Track history
  const [accessCodes, setAccessCodes] = useState(
    () => JSON.parse(localStorage.getItem("blackwell_tickets")) || {}
  );
  const [showGatekeeper, setShowGatekeeper] = useState(false);
  const [gatekeeperMode, setGatekeeperMode] = useState("buy");

  const [email, setEmail] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [legalView, setLegalView] = useState(null);
  const [showContact, setShowContact] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [existingTicketCode, setExistingTicketCode] = useState(null);

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [userRating, setUserRating] = useState(null);
  const [userComment, setUserComment] = useState("");
  const [ratingCounts, setRatingCounts] = useState({ up: 0, down: 0 });

  const movies = useMemo(() => MOVIE_DATA, []);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5555/api";

  // --- SPLASH SCREEN TIMER ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const showFeedback = (type, msg) => {
    setStatus({ type, message: msg });
    setTimeout(() => setStatus({ type: "", message: "" }), 8000);
  };

  // Slideshow - Starts ONLY after loading to prevent glitch
  useEffect(() => {
    if (!loading && view === "home") {
      const interval = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [loading, view]);

  const fetchRatings = useCallback(
    async (movieName) => {
      try {
        const res = await axios.get(
          `${API_BASE}/ratings/${encodeURIComponent(movieName)}`
        );
        setRatingCounts(res.data);
      } catch (err) {
        console.error("Failed to fetch ratings", err);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    const tickets = JSON.parse(localStorage.getItem("blackwell_tickets")) || {};
    setAccessCodes(tickets);
    fetchRatings(MOVIE_DATA[0].name);
  }, [fetchRatings]);

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
      setExistingTicketCode(null);
      setEmail("");
    }
  };

  const handleViewInfo = (movie) => {
    setPreviousView(view); // Save where we came from
    setSelectedMovie(movie);
    setView("movie-details");
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setView(previousView);
  };

  const handlePreCheckPurchase = async () => {
    if (!email) return showFeedback("error", "Please enter your email.");
    setIsProcessing(true);

    try {
      const res = await axios.post(`${API_BASE}/check-ticket-status`, {
        email: email.trim(),
        movieName: selectedMovie.name,
      });

      if (res.data.exists) {
        setExistingTicketCode(res.data.code);
        showFeedback("error", "This email already has an active ticket.");
      } else {
        handlePaystack();
      }
    } catch (err) {
      showFeedback("error", "Connection error checking status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaystack = () => {
    if (!window.PaystackPop)
      return showFeedback("error", "Payment system loading...");

    const handler = window.PaystackPop.setup({
      key: "pk_test_8196b2b3d7ad464e3e647c4d23a1e092a40b8da8",
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
    const recipientEmail = email.trim();

    try {
      const res = await axios.post(`${API_BASE}/purchase-guest`, {
        email: recipientEmail,
        reference,
        movieName: selectedMovie.name,
      });

      if (res.data.success) {
        saveTicket(selectedMovie.name, res.data.code);
        sendEmail(recipientEmail, res.data.code);
        setShowGatekeeper(false);
        setIsPlaying(true);
      } else {
        showFeedback("error", res.data.message || "Failed.");
      }
    } catch (err) {
      console.error("Purchase Error:", err);
      showFeedback("error", "Connection error. Contact support.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendCode = () => {
    if (!existingTicketCode || !email) return;
    setIsProcessing(true);
    // Send email then switch tab
    const SERVICE_ID = "service_9qvnylt";
    const TEMPLATE_ID = "template_f43l5cc";
    const PUBLIC_KEY = "RpZwEJtbEPw4skmFZ";

    const emailParams = {
      movie_name: selectedMovie.name,
      code: existingTicketCode,
      to_email: email,
      to_name: email,
      message: `HERE IS YOUR ACCESS CODE!\n\nMovie: ${selectedMovie.name}\nAccess Code: ${existingTicketCode}\n\nWatch here: https://blackwell-films.vercel.app`,
    };

    emailjs
      .send(SERVICE_ID, TEMPLATE_ID, emailParams, PUBLIC_KEY)
      .then(() => {
        showFeedback("success", "Code sent to " + email);
        setGatekeeperMode("code");
      })
      .catch((err) => {
        console.error("Email Failed", err);
        showFeedback("error", "Email Failed: " + (err.text || "Check Address"));
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  const sendEmail = (toEmail, code) => {
    const SERVICE_ID = "service_9qvnylt";
    const TEMPLATE_ID = "template_f43l5cc";
    const PUBLIC_KEY = "RpZwEJtbEPw4skmFZ";

    const emailParams = {
      movie_name: selectedMovie.name,
      code: code,
      to_email: toEmail,
      to_name: toEmail,
      message: `HERE IS YOUR ACCESS CODE!\n\nMovie: ${selectedMovie.name}\nAccess Code: ${code}\n\nWatch here: https://blackwell-films.onrender.com`,
    };

    emailjs
      .send(SERVICE_ID, TEMPLATE_ID, emailParams, PUBLIC_KEY)
      .then(() => {
        showFeedback("success", "Code sent to " + toEmail);
      })
      .catch((err) => {
        console.error("Email Failed", err);
        showFeedback("error", "Email Failed: " + (err.text || "Check Address"));
      });
  };

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
        showFeedback("success", "Access Granted!");
      }
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Invalid Code");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleThumbClick = async (type) => {
    setUserRating(type);
    try {
      await axios.post(`${API_BASE}/rate-movie`, {
        movieName: selectedMovie.name,
        rating: type,
        comment: "",
      });
      fetchRatings(selectedMovie.name);
    } catch (err) {
      console.error("Vote failed");
    }
  };

  const handleSubmitComment = async () => {
    if (!userComment) return;
    setIsProcessing(true);
    try {
      await axios.post(`${API_BASE}/rate-movie`, {
        movieName: selectedMovie.name,
        rating: "none",
        comment: userComment,
      });
      showFeedback("success", "Comment sent!");
      setUserComment("");
    } catch (err) {
      showFeedback("error", "Could not save comment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTicket = (movie, code) => {
    const newTickets = { ...accessCodes, [movie]: code };
    setAccessCodes(newTickets);
    localStorage.setItem("blackwell_tickets", JSON.stringify(newTickets));
  };

  const filteredResults = movies.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- SPLASH SCREEN RENDER ---
  if (loading) {
    return (
      <div className="splash-screen">
        <img src="/logo13.png" alt="Loading..." className="splash-logo" />
      </div>
    );
  }

  // --- MAIN APP RENDER ---
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
          <img
            src="/logo12.png"
            alt="BLACKWELL"
            className="nav-logo-img"
            onClick={() => setView("home")}
          />
          <div className="nav-links">
            <span
              className={`nav-link ${view === "home" ? "active" : ""}`}
              onClick={() => setView("home")}
            >
              Home
            </span>
            <span
              className={`nav-link ${
                view === "movies" || view === "movie-details" ? "active" : ""
              }`}
              onClick={() => setView("movies")}
            >
              Movies
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
          {/* SEARCH ICON TOGGLE */}
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search..."
              className={`search-input ${searchOpen ? "open" : ""}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="search-icon-btn"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              🔍
            </button>
          </div>
        </div>
      </nav>

      {/* --- CONTENT --- */}
      <div className="main-content">
        {searchQuery ? (
          <div className="centered-container">
            <h2 style={{ marginBottom: "30px", fontWeight: "300" }}>RESULTS</h2>
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
                  {/* FLUID SLIDESHOW */}
                  {HERO_IMAGES.map((imgSrc, index) => (
                    <img
                      key={index}
                      src={imgSrc}
                      alt="Hero Slide"
                      className="hero-slide"
                      style={{ opacity: index === currentHeroIndex ? 1 : 0 }}
                    />
                  ))}
                </div>

                <div className="centered-container-lg">
                  <div className="hero-content">
                    <div>
                      <h2 className="hero-title">{MOVIE_DATA[0].name}</h2>
                    </div>
                    <span
                      className={`badge ${
                        hasAccess(MOVIE_DATA[0].name) ? "badge-owned" : ""
                      }`}
                      style={{ marginTop: "15px" }}
                    >
                      {hasAccess(MOVIE_DATA[0].name)
                        ? "You Have Access"
                        : `KES ${MOVIE_DATA[0].price}`}
                    </span>
                  </div>

                  <div className="hero-actions">
                    <button
                      onClick={() =>
                        setActiveTrailer(MOVIE_DATA[0].trailerLink)
                      }
                      className="btn btn-secondary"
                      style={{ maxWidth: "180px" }}
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
                      style={{ maxWidth: "180px" }}
                    >
                      {hasAccess(MOVIE_DATA[0].name)
                        ? "▶ WATCH NOW"
                        : "BUY ACCESS"}
                    </button>
                    <button
                      onClick={() => handleViewInfo(MOVIE_DATA[0])}
                      className="btn btn-ghost"
                      style={{ maxWidth: "180px" }}
                    >
                      VIEW INFO
                    </button>
                    <a
                      href={MOVIE_DATA[0].imdbLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-imdb"
                      style={{
                        maxWidth: "180px",
                        textDecoration: "none",
                        textAlign: "center",
                        padding: "16px",
                      }}
                    >
                      IMDb
                    </a>
                  </div>

                  <div className="home-movie-info glossy-card">
                    <div className="detail-grid">
                      <div className="detail-poster">
                        <ProgressiveImage
                          src={MOVIE_DATA[0].image}
                          alt="poster"
                        />
                      </div>
                      <div className="info-font">
                        <h3
                          style={{
                            color: "var(--accent-color)",
                            fontSize: "2rem",
                            fontFamily: "Montserrat, sans-serif",
                          }}
                        >
                          SYNOPSIS
                        </h3>
                        <p
                          className="detail-desc"
                          style={{ fontSize: "1.1rem" }}
                        >
                          {MOVIE_DATA[0].description}
                        </p>
                        <div className="detail-meta">
                          <div className="meta-row">
                            <span className="meta-label">RUNTIME:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].runtime}
                            </span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">RATING:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].rating}
                            </span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">YEAR:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].year}
                            </span>
                          </div>
                          {/* DIRECTOR MOVED ABOVE GENRE */}
                          <div className="meta-row">
                            <span className="meta-label">DIRECTOR:</span>
                            <span className="meta-value">
                              <a
                                href={MOVIE_DATA[0].director.link}
                                target="_blank"
                                rel="noreferrer"
                                className="cast-link"
                              >
                                {MOVIE_DATA[0].director.name}
                              </a>
                            </span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">GENRE:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].genre}
                            </span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">CAST:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].cast.map((member, index) => (
                                <React.Fragment key={index}>
                                  <a
                                    href={member.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cast-link"
                                  >
                                    {member.name}
                                  </a>
                                  {index < MOVIE_DATA[0].cast.length - 1
                                    ? ", "
                                    : ""}
                                </React.Fragment>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RATING CARD */}
                  <div
                    className="centered-container-lg"
                    style={{
                      maxWidth: "500px",
                      marginTop: "80px",
                      marginBottom: "40px",
                    }}
                  >
                    <div className="rating-card-home glossy-card">
                      <h6
                        style={{
                          marginTop: 0,
                          marginBottom: "10px",
                          color: "var(--accent-color)",
                          textAlign: "center",
                          fontSize: "14px",
                          letterSpacing: "1px",
                        }}
                      >
                        SEEN THIS MOVIE? RATE IT
                      </h6>
                      <div
                        style={{
                          display: "flex",
                          gap: "20px",
                          marginBottom: "10px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => handleThumbClick("up")}
                          className={`rating-btn ${
                            userRating === "up" ? "active" : ""
                          }`}
                        >
                          👍{" "}
                          <span className="rating-count">
                            {ratingCounts.up}
                          </span>
                        </button>
                        <button
                          onClick={() => handleThumbClick("down")}
                          className={`rating-btn ${
                            userRating === "down" ? "active" : ""
                          }`}
                        >
                          👎{" "}
                          <span className="rating-count">
                            {ratingCounts.down}
                          </span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Leave a comment"
                        className="auth-input"
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        style={{
                          width: "100%",
                          marginBottom: "8px",
                          fontSize: "12px",
                          padding: "8px",
                        }}
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={isProcessing}
                        className="btn btn-primary btn-sm"
                        style={{ width: "100%" }}
                      >
                        SUBMIT
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "movies" && (
              <div className="centered-container-lg">
                <h1
                  style={{
                    textAlign: "center",
                    marginBottom: "40px",
                    fontWeight: "300",
                    letterSpacing: "2px",
                    fontFamily: "Playfair Display, serif",
                    color: "var(--accent-color)",
                  }}
                >
                  MOVIES
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
                        <h3 style={{ fontFamily: "Playfair Display, serif" }}>
                          {movie.name}
                        </h3>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            onClick={() => handlePlayRequest(movie)}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                          >
                            WATCH
                          </button>
                          <button
                            onClick={() => handleViewInfo(movie)}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1 }}
                          >
                            VIEW INFO
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- MOVIE INFO PAGE --- */}
            {view === "movie-details" && selectedMovie && (
              <div
                className="centered-container-lg"
                style={{ marginTop: "40px" }}
              >
                <button
                  onClick={handleBack}
                  className="btn-back"
                  style={{
                    width: "auto",
                    padding: "10px 20px",
                    marginBottom: "30px",
                  }}
                >
                  ← BACK
                </button>

                <div className="detail-grid">
                  <div className="detail-poster">
                    <ProgressiveImage src={selectedMovie.image} alt="poster" />
                  </div>
                  <div className="info-font">
                    <h1
                      style={{
                        fontSize: "3rem",
                        margin: "0 0 10px 0",
                        color: "var(--accent-color)",
                        fontFamily: "Playfair Display, serif",
                      }}
                    >
                      {selectedMovie.name}
                    </h1>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginBottom: "20px",
                      }}
                    >
                      <span
                        className={`badge ${
                          hasAccess(selectedMovie.name) ? "badge-owned" : ""
                        }`}
                      >
                        {hasAccess(selectedMovie.name)
                          ? "You Have Access"
                          : `KES ${selectedMovie.price}`}
                      </span>
                      <span className="badge" style={{ background: "#333" }}>
                        {selectedMovie.genre}
                      </span>
                      <span className="badge" style={{ background: "#333" }}>
                        {selectedMovie.rating}
                      </span>
                    </div>

                    <p className="detail-desc" style={{ fontSize: "1.1rem" }}>
                      {selectedMovie.description}
                    </p>

                    <div className="detail-meta">
                      <div className="meta-row">
                        <span className="meta-label">RUNTIME:</span>
                        <span className="meta-value">
                          {selectedMovie.runtime}
                        </span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">YEAR:</span>
                        <span className="meta-value">{selectedMovie.year}</span>
                      </div>
                      {/* DIRECTOR MOVED ABOVE GENRE */}
                      <div className="meta-row">
                        <span className="meta-label">DIRECTOR:</span>
                        <span className="meta-value">
                          <a
                            href={selectedMovie.director.link}
                            target="_blank"
                            rel="noreferrer"
                            className="cast-link"
                          >
                            {selectedMovie.director.name}
                          </a>
                        </span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">GENRE:</span>
                        <span className="meta-value">
                          {selectedMovie.genre}
                        </span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">CAST:</span>
                        <span className="meta-value">
                          {selectedMovie.cast.map((member, index) => (
                            <React.Fragment key={index}>
                              <a
                                href={member.link}
                                target="_blank"
                                rel="noreferrer"
                                className="cast-link"
                              >
                                {member.name}
                              </a>
                              {index < selectedMovie.cast.length - 1
                                ? ", "
                                : ""}
                            </React.Fragment>
                          ))}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "30px",
                        display: "flex",
                        gap: "15px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => handlePlayRequest(selectedMovie)}
                        className="btn btn-primary"
                        style={{ maxWidth: "200px" }}
                      >
                        {hasAccess(selectedMovie.name)
                          ? "WATCH NOW"
                          : "BUY ACCESS"}
                      </button>
                      {selectedMovie.trailerLink && (
                        <button
                          onClick={() =>
                            setActiveTrailer(selectedMovie.trailerLink)
                          }
                          className="btn btn-secondary"
                          style={{ maxWidth: "200px" }}
                        >
                          TRAILER
                        </button>
                      )}
                      {selectedMovie.imdbLink && (
                        <a
                          href={selectedMovie.imdbLink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-imdb"
                          style={{
                            maxWidth: "180px",
                            textDecoration: "none",
                            textAlign: "center",
                            padding: "16px",
                          }}
                        >
                          IMDb
                        </a>
                      )}
                    </div>

                    <div
                      className="rating-section glossy-card"
                      style={{
                        marginTop: "30px",
                        padding: "20px",
                        borderRadius: "8px",
                      }}
                    >
                      <h4
                        style={{ marginTop: 0, color: "var(--accent-color)" }}
                      >
                        RATE THIS MOVIE
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          gap: "15px",
                          marginBottom: "15px",
                        }}
                      >
                        <button
                          onClick={() => handleThumbClick("up")}
                          className={`rating-btn ${
                            userRating === "up" ? "active" : ""
                          }`}
                        >
                          👍{" "}
                          <span className="rating-count">
                            {ratingCounts.up}
                          </span>
                        </button>
                        <button
                          onClick={() => handleThumbClick("down")}
                          className={`rating-btn ${
                            userRating === "down" ? "active" : ""
                          }`}
                        >
                          👎{" "}
                          <span className="rating-count">
                            {ratingCounts.down}
                          </span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Leave a comment"
                        className="auth-input"
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        style={{ width: "100%", marginBottom: "10px" }}
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={isProcessing}
                        className="btn btn-primary btn-sm"
                        style={{ width: "auto" }}
                      >
                        SUBMIT
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "shows" && (
              <div
                className="centered-container-lg"
                style={{ textAlign: "center", padding: "100px 0" }}
              >
                <h1
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "3rem",
                    fontWeight: "300",
                    letterSpacing: "5px",
                    fontFamily: "Playfair Display, serif",
                  }}
                >
                  COMING SOON
                </h1>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="app-footer">
        <div className="footer-grid">
          <div>
            <img
              src="/logo13.png"
              alt="BLACKWELL"
              className="footer-logo-img"
            />
            <p style={{ color: "#666", fontSize: "12px", marginTop: "10px" }}>
              © 2025 Blackwell Films.
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <h5 className="footer-head">Socials</h5>
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
          <div style={{ textAlign: "right" }}>
            <h5 className="footer-head">Support</h5>
            <button
              className="footer-link"
              onClick={() => setLegalView("terms")}
              style={{ marginLeft: "auto" }}
            >
              Terms of Service
            </button>
            <button
              className="footer-link"
              onClick={() => setLegalView("privacy")}
              style={{ marginLeft: "auto" }}
            >
              Privacy Policy
            </button>
            <button
              className="footer-link"
              onClick={() => setShowContact(true)}
              style={{ marginLeft: "auto" }}
            >
              Contact Us
            </button>
          </div>
        </div>
      </footer>

      {showGatekeeper && (
        <div className="modal-overlay">
          <div className="auth-card">
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
                fontFamily: "Playfair Display, serif",
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
                BUY ACCESS
              </button>
              <button
                className={`tab-btn ${
                  gatekeeperMode === "code" ? "active" : ""
                }`}
                onClick={() => setGatekeeperMode("code")}
              >
                HAVE A CODE?
              </button>
            </div>

            <div className="gatekeeper-content">
              {gatekeeperMode === "buy" && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#ccc", marginBottom: "20px" }}>
                    Get 90-day access on up to 3 devices.
                    <br />
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

                  {existingTicketCode ? (
                    <div
                      style={{
                        background: "rgba(231, 76, 60, 0.2)",
                        padding: "15px",
                        borderRadius: "8px",
                        border: "1px solid #e74c3c",
                      }}
                    >
                      <p
                        style={{
                          color: "#fff",
                          fontSize: "14px",
                          marginBottom: "10px",
                        }}
                      >
                        ⚠ You already have an active ticket for this email.
                      </p>
                      <button
                        onClick={handleResendCode}
                        disabled={isProcessing}
                        className="btn btn-warning"
                      >
                        {isProcessing ? "SENDING..." : "RESEND CODE TO EMAIL"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePreCheckPurchase}
                      disabled={isProcessing}
                      className="btn btn-primary"
                    >
                      {isProcessing
                        ? "PROCESSING..."
                        : `PAY KES ${selectedMovie?.price}`}
                    </button>
                  )}
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
            </div>
          </div>
        </div>
      )}

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
              allow="autoplay; fullscreen; picture-in-picture"
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
            <h2
              style={{
                textAlign: "center",
                color: "var(--accent-color)",
                fontFamily: "Playfair Display, serif",
              }}
            >
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
            <h2 style={{ fontFamily: "Playfair Display, serif" }}>CONTACT</h2>
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
