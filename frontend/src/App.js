import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const MOVIE_DATA = [
  {
    id: "cards-on-the-table",
    name: "Cards on the Table",
    price: 250,
    description: "An ex-couple team up to rob the gate collections at a Christmas event in 1992 Nairobi, but their layers of unresolved issues land them in police custody.",
    cast: ["Nyakundi Isaboke, Shirleen Wangari, Mufasa Poet, Murunyu Duncan"],
    director: "Victor Gatonye",
    genre: "Romantic Drama, Comedy",
    trailerLink: "https://www.youtube.com/embed/Wjmm1p9h-TA",
    movieFile: "https://player.vimeo.com/video/1145911659",
    image: "/COTTposter1.jpg", // This remains the Portrait one
    landscapeImage: "/COTTP2.jpg", // Add this for the Featured section
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

function ProgressiveImage({ src, alt, style }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        backgroundColor: "#1a1816",
        overflow: "hidden",
      }}
    >
      {!loaded && (
        <div
          className="shimmer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        style={{
          ...style,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.8s ease-in-out",
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
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [view, setView] = useState("home");
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });
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

  const theme = {
    background: "#0d0c0b",
    surface: "#1a1816",
    accent: "#d4a373",
    text: "#e6e1dd",
    success: "#2ecc71",
    error: "#e74c3c",
    border: "#2b2824",
  };

  const movies = useMemo(() => MOVIE_DATA, []);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);

  // FIX: Restore filteredResults logic
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
          // It was using API_BASE here, so it must be in the array below
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
  }, [token, movies, API_BASE]); // <--- Added API_BASE here
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage("");
    try {
      const endpoint = isLogin ? "login" : "register";
      const res = await axios.post(`${API_BASE}/${endpoint}`, formData);
      if (isLogin) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userEmail", formData.email);
        setToken(res.data.token);
        showFeedback("success", "Logged in successfully");
      } else {
        showFeedback("success", "Account created! Please log in.");
        setIsLogin(true);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || "Authentication failed";
      setMessage(errMsg);
      showFeedback("error", errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const payWithPaystack = () => {
    const userEmail = localStorage.getItem("userEmail");
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

  const buttonStyle = (theme, type) => {
    const base = {
      padding: "16px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "bold",
      width: "100%",
      border: "none",
      fontSize: "13px",
      transition: "0.3s",
      letterSpacing: "1px",
    };
    if (type === "primary")
      return { ...base, backgroundColor: theme.accent, color: "#2b2118" };
    if (type === "secondary")
      return {
        ...base,
        backgroundColor: "transparent",
        color: theme.accent,
        border: `1px solid ${theme.accent}`,
      };
    if (type === "success")
      return { ...base, backgroundColor: theme.success, color: "white" };
    if (type === "ghost")
      return {
        ...base,
        backgroundColor: "rgba(255,255,255,0.05)",
        color: "#fff",
        border: "1px solid #333",
      };
    return base;
  };

  return (
    <div
      style={{
        backgroundColor: theme.background,
        minHeight: "100vh",
        color: theme.text,
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        body, html { margin: 0 !important; padding: 0 !important; background-color: #0d0c0b !important; }
        * { box-sizing: border-box; }
        .nav-link { color: #888; text-decoration: none; font-size: 14px; cursor: pointer; transition: 0.2s; padding-bottom: 5px; border-bottom: 2px solid transparent; }
        .nav-link:hover { color: #d4a373; }
        .nav-link.active { color: #d4a373; border-bottom: 2px solid #d4a373; }
        
        footer a, footer .legal-btn { 
          color: #666; 
          text-decoration: none; 
          font-size: 13px; 
          transition: 0.2s; 
          display: block; 
          margin-bottom: 5px; 
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
        }
        footer a:hover, footer .legal-btn:hover { color: #d4a373; }

        .search-input { background: #0d0c0b; border: 1px solid #333; color: white; padding: 8px 35px 8px 15px; border-radius: 20px; outline: none; transition: 0.3s; width: 200px; font-size: 13px; }
        .search-input:focus { border-color: #d4a373; width: 280px; }
        .shimmer { background: linear-gradient(90deg, #1a1816 25%, #2b2824 50%, #1a1816 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
        @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {status.message && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "15px 25px",
            borderRadius: "8px",
            backgroundColor:
              status.type === "success" ? theme.success : theme.error,
            color: "white",
            zIndex: 3000,
            boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            fontWeight: "bold",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          {status.type === "success" ? "✓ " : "✕ "} {status.message}
        </div>
      )}

      {token ? (
        <>
          <nav style={navStyle(theme)}>
            <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
              <h2
                onClick={() => {
                  setView("home");
                  setSearchQuery("");
                }}
                style={{
                  color: theme.accent,
                  margin: 0,
                  fontSize: "24px",
                  letterSpacing: "2px",
                  cursor: "pointer",
                }}
              >
                BLACKWELL
              </h2>
              <div style={{ display: "flex", gap: "25px" }}>
                <span
                  className={`nav-link ${
                    view === "home" && !searchQuery ? "active" : ""
                  }`}
                  onClick={() => {
                    setView("home");
                    setSearchQuery("");
                  }}
                >
                  Home
                </span>
                <span
                  className={`nav-link ${view === "movies" ? "active" : ""}`}
                  onClick={() => {
                    setView("movies");
                    setSearchQuery("");
                  }}
                >
                  Movies
                </span>
                <span
                  className={`nav-link ${view === "shows" ? "active" : ""}`}
                  onClick={() => {
                    setView("shows");
                    setSearchQuery("");
                  }}
                >
                  Shows
                </span>
                <span
                  className={`nav-link ${view === "watchlist" ? "active" : ""}`}
                  onClick={() => {
                    setView("watchlist");
                    setSearchQuery("");
                  }}
                >
                  Watchlist
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search titles, actors..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      cursor: "pointer",
                      color: "#666",
                      fontSize: "12px",
                    }}
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
              >
                Profile
              </span>
              <button
                onClick={() => {
                  localStorage.clear();
                  setToken(null);
                }}
                style={logoutButtonStyle}
              >
                Logout
              </button>
            </div>
          </nav>

          <div style={{ flex: 1, padding: "60px 5%" }}>
            {searchQuery && (
              <div style={centeredContainer}>
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    {filteredResults.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          ...cardStyle(theme),
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
                            style={{ width: "100%", borderRadius: "4px" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 5px 0" }}>{item.name}</h4>
                          <span
                            style={{
                              fontSize: "11px",
                              color: theme.accent,
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
                          style={{
                            ...buttonStyle(theme, "primary"),
                            width: "auto",
                            padding: "8px 15px",
                          }}
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
                  <div style={centeredContainer}>
                    <header
                      style={{ marginBottom: "50px", textAlign: "center" }}
                    >
                      <h1
                        style={{
                          fontSize: "1.8rem",
                          letterSpacing: "4px",
                          color: "#fff",
                          fontWeight: "300",
                        }}
                      >
                        FEATURED FILM
                      </h1>
                    </header>
                    <div style={{ width: "100%", position: "relative", overflow: "visible" }}>
                      {/* --- Change this section in your Featured Film code --- */}
                      <ProgressiveImage
                        src={movies[0].landscapeImage || movies[0].image}
                        alt={movies[0].name}
                        style={{
                          width: "100vw",
                          position: "relative",
                          left: "50%",
                          right: "50%",
                          marginLeft: "-50vw",
                          marginRight: "-50vw",
                          height: "500px",
                          objectFit: "cover",
                          display: "block",
                          borderRadius: "0px"
                        }}
                      />
                      <div style={{ padding: "30px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "20px",
                          }}
                        >
                          <h2 style={{ color: theme.accent, margin: 0 }}>
                            {movies[0].name}
                          </h2>
                          <span
                            style={badgeStyle(theme, hasAccess[movies[0].name])}
                          >
                            {hasAccess[movies[0].name]
                              ? "OWNED"
                              : `KES ${movies[0].price}`}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          <button
                            onClick={() =>
                              setActiveTrailer(movies[0].trailerLink)
                            }
                            style={buttonStyle(theme, "secondary")}
                          >
                            VIEW TRAILER
                          </button>
                          {hasAccess[movies[0].name] ? (
                            <button
                              onClick={() => {
                                setSelectedMovie(movies[0]);
                                setIsPlaying(true);
                              }}
                              style={buttonStyle(theme, "success")}
                            >
                              ▶ WATCH NOW
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedMovie(movies[0]);
                                setShowPaymentModal(true);
                              }}
                              style={buttonStyle(theme, "primary")}
                            >
                              BUY 3-MONTH ACCESS
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedMovie(movies[0]);
                              setView("movie-detail");
                            }}
                            style={buttonStyle(theme, "ghost")}
                          >
                            VIEW INFO
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {view === "movie-detail" && (
                  <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    <button
                      onClick={() => setView("movies")}
                      style={{
                        color: theme.accent,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: "20px",
                        fontSize: "12px",
                        letterSpacing: "1px",
                      }}
                    >
                      ← BACK TO MOVIES
                    </button>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.5fr",
                        gap: "40px",
                      }}
                    >
                      <div style={{ borderRadius: "12px", overflow: "hidden" }}>
                        <ProgressiveImage
                          src={selectedMovie.image}
                          alt={selectedMovie.name}
                          style={{ width: "100%", height: "auto" }}
                        />
                      </div>
                      <div>
                        <h1 style={{ fontSize: "3rem", margin: "0 0 10px 0" }}>
                          {selectedMovie.name}
                        </h1>
                        <p style={{ lineHeight: "1.8", color: "#bbb" }}>
                          {selectedMovie.description}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            marginTop: "30px",
                          }}
                        >
                          {hasAccess[selectedMovie.name] ? (
                            <button
                              onClick={() => setIsPlaying(true)}
                              style={buttonStyle(theme, "success")}
                            >
                              WATCH NOW
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowPaymentModal(true)}
                              style={buttonStyle(theme, "primary")}
                            >
                              BUY ACCESS
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setActiveTrailer(selectedMovie.trailerLink)
                            }
                            style={buttonStyle(theme, "secondary")}
                          >
                            VIEW TRAILER
                          </button>
                          <button
                            onClick={() => toggleWatchlist(selectedMovie.name)}
                            style={buttonStyle(theme, "ghost")}
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
                  <div style={centeredContainer}>
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
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "30px",
                      }}
                    >
                      {movies.map((movie) => (
                        <div key={movie.id} style={cardStyle(theme)}>
                          <ProgressiveImage
                            src={movie.image}
                            alt={movie.name}
                            style={{ width: "100%", height: "auto" }}
                          />
                          <div
                            style={{
                              padding: "20px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <h3 style={{ margin: 0 }}>{movie.name}</h3>
                            <button
                              onClick={() => {
                                setSelectedMovie(movie);
                                setView("movie-detail");
                              }}
                              style={{
                                ...buttonStyle(theme, "primary"),
                                width: "auto",
                                padding: "10px 20px",
                              }}
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
                        color: theme.accent,
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
                  <div style={centeredContainer}>
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
                          style={{
                            ...cardStyle(theme),
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
                                const m = movies.find(
                                  (x) => x.name === movieName
                                );
                                if (m) setSelectedMovie(m);
                                setView("movie-detail");
                              }}
                              style={{
                                ...buttonStyle(theme, "primary"),
                                width: "auto",
                                padding: "10px 20px",
                              }}
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
                  <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h1 style={{ marginBottom: "40px", fontWeight: "300" }}>
                      Account Dashboard
                    </h1>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "260px 1fr",
                        gap: "30px",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: theme.surface,
                          borderRadius: "12px",
                          padding: "30px",
                          height: "fit-content",
                          border: `1px solid ${theme.border}`,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "70px",
                            height: "70px",
                            backgroundColor: theme.accent,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            color: "#2b2118",
                            margin: "0 auto 20px auto",
                            fontWeight: "bold",
                          }}
                        >
                          {localStorage
                            .getItem("userEmail")
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>
                        <h4 style={{ margin: "0 0 5px 0" }}>Member</h4>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginBottom: "20px",
                          }}
                        >
                          {localStorage.getItem("userEmail")}
                        </p>
                        <button
                          onClick={() => {
                            localStorage.clear();
                            setToken(null);
                          }}
                          style={{
                            ...buttonStyle(theme, "ghost"),
                            color: "#ff6b6b",
                          }}
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
                        <div
                          style={{
                            backgroundColor: theme.surface,
                            padding: "30px",
                            borderRadius: "12px",
                            border: `1px solid ${theme.border}`,
                          }}
                        >
                          <h3
                            style={{
                              fontSize: "14px",
                              color: theme.accent,
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
                                  <div
                                    key={m.id}
                                    style={{
                                      padding: "15px",
                                      backgroundColor: "#0d0c0b",
                                      borderRadius: "8px",
                                      marginBottom: "10px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      border: "1px solid #222",
                                    }}
                                  >
                                    <span style={{ fontWeight: "bold" }}>
                                      {m.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: theme.success,
                                        fontWeight: "bold",
                                        border: `1px solid ${theme.success}`,
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                      }}
                                    >
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

          <footer style={footerStyle(theme)}>
            <div style={footerGrid}>
              <div>
                <h4
                  style={{
                    color: theme.accent,
                    margin: "0 0 10px 0",
                    fontSize: "18px",
                  }}
                >
                  BLACKWELL FILMS
                </h4>
              </div>
              <div>
                <h5 style={footerHead}>Support</h5>
                <span
                  className="legal-btn"
                  onClick={() => setLegalView("terms")}
                >
                  Terms of Service
                </span>
                <span
                  className="legal-btn"
                  onClick={() => setLegalView("privacy")}
                >
                  Privacy Policy
                </span>
                <span
                  className="legal-btn"
                  onClick={() => setShowContact(true)}
                >
                  Contact Us
                </span>
              </div>
              <div>
                <h5 style={footerHead}>Connect</h5>
                <a href="https://www.tiktok.com/@blackwellfilms?lang=en" target="_blank" rel="noreferrer">TikTok</a>
                <a href="https://www.instagram.com/blackwell_films/" target="_blank" rel="noreferrer">Instagram</a>
                <a href="https://www.facebook.com/Blackwellfilms" target="_blank" rel="noreferrer">Facebook</a>
              </div>
            </div>
          </footer>
        </>
      ) : (
        <div style={authContainer}>
          <div style={authCard(theme)}>
            <h1 style={{ textAlign: "center", color: theme.accent }}>
              {isLogin ? "Login" : "Sign Up"}
            </h1>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {!isLogin && (
                <input
                  name="full_name"
                  placeholder="Full Name"
                  onChange={handleChange}
                  style={inputStyle(theme)}
                />
              )}
              <input
                name="email"
                placeholder="Email"
                onChange={handleChange}
                style={inputStyle(theme)}
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                onChange={handleChange}
                style={inputStyle(theme)}
                required
              />
              <button
                type="submit"
                disabled={isProcessing}
                style={{
                  ...buttonStyle(theme, "primary"),
                  opacity: isProcessing ? 0.6 : 1,
                }}
              >
                {isProcessing
                  ? "PROCESSING..."
                  : isLogin
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>
            {message && (
              <p
                style={{
                  color: theme.accent,
                  textAlign: "center",
                  fontSize: "14px",
                  marginTop: "10px",
                }}
              >
                {message}
              </p>
            )}
            <p
              onClick={() => setIsLogin(!isLogin)}
              style={{
                textAlign: "center",
                cursor: "pointer",
                color: theme.accent,
                fontSize: "14px",
                marginTop: "15px",
              }}
            >
              {isLogin ? "Sign Up" : "Back to Login"}
            </p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showContact && (
        <div style={modalOverlayStyle}>
          <div
            style={{ ...authCard(theme), width: "400px", textAlign: "center" }}
          >
            <h2 style={{ color: theme.accent, marginBottom: "20px" }}>
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
              style={buttonStyle(theme, "primary")}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {isPlaying && (
        <div style={theaterOverlayStyle}>
          <button onClick={() => setIsPlaying(false)} style={closeTheaterStyle}>
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
        <div style={theaterOverlayStyle}>
          <button
            onClick={() => setActiveTrailer(null)}
            style={closeTheaterStyle}
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
        <div style={modalOverlayStyle}>
          <div style={authCard(theme)}>
            <h2 style={{ color: theme.accent, textAlign: "center" }}>
              Checkout
            </h2>
            <p style={{ textAlign: "center", marginBottom: "20px" }}>
              {selectedMovie.name}
            </p>
            <button
              onClick={payWithPaystack}
              disabled={isProcessing}
              style={{
                ...buttonStyle(theme, "primary"),
                opacity: isProcessing ? 0.6 : 1,
              }}
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
        <div style={modalOverlayStyle}>
          <div
            style={{
              ...authCard(theme),
              width: "500px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                color: theme.accent,
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
              style={buttonStyle(theme, "primary")}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const navStyle = (theme) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 5%",
  backgroundColor: theme.surface,
  borderBottom: `1px solid ${theme.border}`,
  position: "sticky",
  top: 0,
  zIndex: 100,
});
const centeredContainer = { maxWidth: "480px", margin: "0 auto" };
const cardStyle = (theme) => ({
  backgroundColor: theme.surface,
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${theme.border}`,
});
const badgeStyle = (theme, active) => ({
  padding: "6px 12px",
  borderRadius: "4px",
  fontSize: "11px",
  fontWeight: "bold",
  backgroundColor: active ? theme.success : "#333",
  color: "white",
});
const authContainer = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
};
const authCard = (theme) => ({
  backgroundColor: theme.surface,
  padding: "40px",
  borderRadius: "12px",
  width: "380px",
  border: `1px solid ${theme.border}`,
});
const inputStyle = (theme) => ({
  padding: "14px",
  backgroundColor: "#0d0c0b",
  border: "1px solid #333",
  borderRadius: "8px",
  color: "#fff",
  width: "100%",
});
const logoutButtonStyle = {
  background: "transparent",
  color: "#ff6b6b",
  border: "1px solid #422",
  padding: "6px 15px",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px",
};
const footerStyle = (theme) => ({
  backgroundColor: theme.surface,
  padding: "60px 5% 40px 5%",
  borderTop: `1px solid ${theme.border}`,
  marginTop: "auto",
});
const footerGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "30px",
  maxWidth: "1200px",
  margin: "0 auto",
};
const footerHead = { margin: "0 0 10px 0", fontSize: "14px", color: "#888" };
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.9)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};
const theaterOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0,0,0,0.95)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};
const closeTheaterStyle = {
  position: "absolute",
  top: "20px",
  right: "30px",
  color: "#fff",
  border: "none",
  background: "rgba(255,255,255,0.1)",
  padding: "10px 20px",
  borderRadius: "5px",
  cursor: "pointer",
};

export default App;
