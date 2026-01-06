import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react"; // Make sure to npm install qrcode.react
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
    movieFile: "https://player.vimeo.com/video/1145911659?autoplay=1&badge=0&autopause=0",
    image: "/COTTposter1.jpg",
    landscapeImage: "/COTTP2.jpg",
    isFeatured: true,
    type: "movie",
  },
];

const LEGAL_TEXT = {
  terms: `TERMS OF SERVICE: 1. TICKETS GRANT 90 DAYS ACCESS. 2. VALID ON UP TO 3 DEVICES. 3. NO REFUNDS ONCE CODE IS USED.`,
  privacy: `PRIVACY: WE ONLY STORE YOUR EMAIL TO SEND YOUR TICKET. WE DO NOT SELL DATA.`,
};

function ProgressiveImage({ src, alt, className, style, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`progressive-image-container ${className || ""}`} style={style} onClick={onClick}>
      {!loaded && <div className="shimmer" />}
      <img
        src={src}
        alt={alt}
        className="progressive-img"
        style={{ opacity: loaded ? 1 : 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onLoad={() => setLoaded(true)}
        onError={(e) => { e.target.src = "https://via.placeholder.com/400x600?text=Poster+Not+Found"; setLoaded(true); }}
      />
    </div>
  );
}

function App() {
  // State
  const [view, setView] = useState("home");
  const [accessCodes, setAccessCodes] = useState(() => JSON.parse(localStorage.getItem("blackwell_tickets")) || {});
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

  // Check access on load
  useEffect(() => {
    // We trust local storage for UI speed, but you could verify with server here if strict
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
    if (!email) return showFeedback("error", "Please enter your email to receive the ticket.");
    
    const handler = window.PaystackPop.setup({
      key: "pk_test_8196b2b3d7ad464e3e647c4d23a1e092a40b8da8", // Use your public key
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
        movieName: selectedMovie.name
      });
      
      if (res.data.success) {
        saveTicket(selectedMovie.name, res.data.code);
        setShowGatekeeper(false);
        setIsPlaying(true);
        showFeedback("success", "Ticket confirmed! Code sent to email.");
      }
    } catch (err) {
      showFeedback("error", "Verification failed. Contact support.");
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
        movieName: selectedMovie.name
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

  const scrollToInfo = () => infoSectionRef.current?.scrollIntoView({ behavior: "smooth" });

  const filteredResults = movies.filter(
    (item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      {status.message && (
        <div className={`status-toast ${status.type === "success" ? "status-success" : "status-error"}`}>
          {status.type === "success" ? "✓ " : "✕ "} {status.message}
        </div>
      )}

      {/* --- NAV --- */}
      <nav className="nav-bar">
        <div className="nav-left">
          <h2 className="nav-logo" onClick={() => setView("home")}>BLACKWELL</h2>
          <div className="nav-links">
            <span className={`nav-link ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>Home</span>
            <span className={`nav-link ${view === "movies" ? "active" : ""}`} onClick={() => setView("movies")}>Movies</span>
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
            {searchQuery && <span className="search-clear" onClick={() => setSearchQuery("")}>✕</span>}
          </div>
          {/* QR Code / Access Button */}
          <button 
             onClick={() => { setShowGatekeeper(true); setGatekeeperMode("code"); }} 
             className="btn btn-ghost btn-sm"
          >
            ENTER CODE
          </button>
        </div>
      </nav>

      {/* --- CONTENT --- */}
      <div className="main-content">
        {searchQuery ? (
          <div className="centered-container">
             <h2 style={{ marginBottom: "30px", fontWeight: "300" }}>RESULTS FOR "{searchQuery.toUpperCase()}"</h2>
             {filteredResults.map(item => (
                <div key={item.id} className="movie-card" style={{ display: "flex", padding: "15px", gap: "20px" }}>
                   <ProgressiveImage src={item.image} alt={item.name} style={{ width: "80px", borderRadius: "4px" }} />
                   <div style={{ flex: 1 }}>
                      <h4>{item.name}</h4>
                      <button onClick={() => handlePlayRequest(item)} className="btn btn-primary btn-sm">WATCH</button>
                   </div>
                </div>
             ))}
          </div>
        ) : (
          <>
            {view === "home" && (
              <div>
                <div className="hero-wrapper">
                  <div className="play-overlay-btn" onClick={() => handlePlayRequest(MOVIE_DATA[0])}>
                    <span className="play-icon">▶</span>
                  </div>
                  <ProgressiveImage src={MOVIE_DATA[0].landscapeImage} alt={MOVIE_DATA[0].name} className="hero-image" />
                </div>

                <div className="centered-container-lg">
                  <div className="hero-content">
                    <div>
                      <h2 style={{ color: "var(--accent-color)", margin: 0 }}>{MOVIE_DATA[0].name}</h2>
                      {/* ADDED FEATURED TEXT */}
                      <p style={{ marginTop: "10px", fontSize: "14px", fontWeight: "bold", color: "#fff", letterSpacing: "1px" }}>
                        FEATURED FILM: CARDS ON THE TABLE
                      </p>
                    </div>
                    <span className={`badge ${hasAccess(MOVIE_DATA[0].name) ? "badge-owned" : ""}`}>
                      {hasAccess(MOVIE_DATA[0].name) ? "TICKET ACTIVE" : `KES ${MOVIE_DATA[0].price}`}
                    </span>
                  </div>

                  <div className="hero-actions">
                    <button onClick={() => setActiveTrailer(MOVIE_DATA[0].trailerLink)} className="btn btn-secondary">
                      VIEW TRAILER
                    </button>
                    <button onClick={() => handlePlayRequest(MOVIE_DATA[0])} className={hasAccess(MOVIE_DATA[0].name) ? "btn btn-success" : "btn btn-primary"}>
                      {hasAccess(MOVIE_DATA[0].name) ? "▶ WATCH NOW" : "GET TICKET"}
                    </button>
                    <button onClick={scrollToInfo} className="btn btn-ghost">INFO</button>
                  </div>
                  
                  {/* Reuse Info Section logic from original... */}
                  <div className="home-movie-info" ref={infoSectionRef}>
                     <div className="detail-grid">
                        <div className="detail-poster"><ProgressiveImage src={MOVIE_DATA[0].image} alt="poster" /></div>
                        <div>
                           <h3 style={{ color: "var(--accent-color)" }}>SYNOPSIS</h3>
                           <p className="detail-desc">{MOVIE_DATA[0].description}</p>
                           <div className="detail-meta">
                              <div className="meta-row"><span className="meta-label">DIRECTOR:</span> {MOVIE_DATA[0].director}</div>
                              <div className="meta-row"><span className="meta-label">CAST:</span> {MOVIE_DATA[0].cast.join(", ")}</div>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            )}
            
            {view === "movies" && (
               <div className="centered-container">
                  <h1 style={{ textAlign: "center", marginBottom: "40px", fontWeight: "300" }}>MOVIES</h1>
                  <div className="movie-grid">
                     {movies.map(movie => (
                        <div key={movie.id} className="movie-card">
                           <ProgressiveImage src={movie.image} alt={movie.name} />
                           <div className="card-content">
                              <h3>{movie.name}</h3>
                              <button onClick={() => handlePlayRequest(movie)} className="btn btn-primary btn-sm">WATCH</button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
          </>
        )}
      </div>

      {/* --- FOOTER --- */}
      <footer className="app-footer">
        <div className="footer-grid">
          <div><h4 className="footer-brand">BLACKWELL</h4></div>
          <div>
            <h5 className="footer-head">Support</h5>
            <button className="footer-link" onClick={() => setLegalView("terms")}>Terms</button>
            <button className="footer-link" onClick={() => setLegalView("privacy")}>Privacy</button>
            <button className="footer-link" onClick={() => setShowContact(true)}>Contact</button>
          </div>
          <div><h5 className="footer-head">Connect</h5><p className="footer-link">Socials...</p></div>
        </div>
      </footer>

      {/* --- GATEKEEPER MODAL (Replaces Auth/Payment Modal) --- */}
      {showGatekeeper && (
        <div className="modal-overlay">
          <div className="auth-card" style={{ width: "600px", maxWidth: "95%" }}>
            <button onClick={() => setShowGatekeeper(false)} className="btn-close-modal">✕</button>
            
            <h2 style={{ textAlign: "center", color: "var(--accent-color)", marginBottom: "30px" }}>
              {selectedMovie.name.toUpperCase()}
            </h2>

            <div className="gatekeeper-tabs">
              <button 
                className={`tab-btn ${gatekeeperMode === "buy" ? "active" : ""}`}
                onClick={() => setGatekeeperMode("buy")}
              >
                BUY TICKET
              </button>
              <button 
                className={`tab-btn ${gatekeeperMode === "code" ? "active" : ""}`}
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
                    Get 90 days access on up to 3 devices. <br/>
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
                  <button onClick={handlePaystack} disabled={isProcessing} className="btn btn-primary">
                    {isProcessing ? "PROCESSING..." : `PAY KES ${selectedMovie.price}`}
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
                    style={{ marginBottom: "15px", textAlign: "center", letterSpacing: "3px", fontWeight: "bold" }}
                  />
                  <button type="submit" disabled={isProcessing} className="btn btn-success">
                    {isProcessing ? "VERIFYING..." : "WATCH MOVIE"}
                  </button>
                </form>
              )}

              {gatekeeperMode === "qr" && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <p style={{ color: "#ccc", marginBottom: "20px" }}>
                    Scan to buy or check access on mobile.
                  </p>
                  <div style={{ background: "white", padding: "10px", display: "inline-block", borderRadius: "8px" }}>
                     <QRCodeCanvas value={`https://blackwellfilms.com/pay?movie=${selectedMovie.id}`} size={150} />
                  </div>
                  <p style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>Use your camera</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- VIDEO PLAYER --- */}
      {isPlaying && (
        <div className="theater-overlay">
          <button onClick={() => setIsPlaying(false)} className="btn-close-theater">✕ CLOSE</button>
          <div style={{ width: "85%", aspectRatio: "16/9", position: "relative" }}>
            <iframe
              src={`${selectedMovie.movieFile}&title=0&byline=0&portrait=0`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "12px", border: "none" }}
              allow="autoplay; fullscreen"
              allowFullScreen
              title={selectedMovie.name}
            ></iframe>
          </div>
        </div>
      )}
      
      {/* --- TRAILER OVERLAY --- */}
      {activeTrailer && (
         <div className="theater-overlay">
            <button onClick={() => setActiveTrailer(null)} className="btn-close-theater">✕ CLOSE</button>
            <div style={{ width: "80%", maxWidth: "1000px", aspectRatio: "16/9", position: "relative" }}>
               <iframe src={`${activeTrailer}?autoplay=1`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "12px", border: "none" }} allowFullScreen title="Trailer"></iframe>
            </div>
         </div>
      )}

      {/* --- LEGAL / CONTACT MODALS REMAIN SAME --- */}
      {legalView && (
         <div className="modal-overlay">
            <div className="auth-card" style={{ width: "500px" }}>
               <h2>{legalView === "terms" ? "TERMS" : "PRIVACY"}</h2>
               <p style={{ color: "#bbb", fontSize: "13px" }}>{legalView === "terms" ? LEGAL_TEXT.terms : LEGAL_TEXT.privacy}</p>
               <button onClick={() => setLegalView(null)} className="btn btn-primary">CLOSE</button>
            </div>
         </div>
      )}
      {showContact && (
         <div className="modal-overlay">
            <div className="auth-card">
               <h2>CONTACT</h2>
               <p>blackwellfilmsafrica@gmail.com</p>
               <button onClick={() => setShowContact(false)} className="btn btn-primary">CLOSE</button>
            </div>
         </div>
      )}
    </div>
  );
}

export default App;