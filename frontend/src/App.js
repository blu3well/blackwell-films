import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
      { name: "Nyakundi Isaboke", link: "https://www.instagram.com/nyakundi_isaboke/" },
      { name: "Shirleen Wangari", link: "https://www.facebook.com/shirleenwangarikiura" },
      { name: "Mufasa Poet", link: "https://www.instagram.com/mufasapoet" },
      { name: "Murunyu Duncan", link: "https://www.facebook.com/SirRunyu/?locale=de_DE" },
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
  const [previousView, setPreviousView] = useState("home");
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [existingTicketCode, setExistingTicketCode] = useState(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const [userRating, setUserRating] = useState(null);
  const [userComment, setUserComment] = useState("");
  const [ratingCounts, setRatingCounts] = useState({ up: 0, down: 0 });

  const [adminPin, setAdminPin] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [newCoupon, setNewCoupon] = useState({ code: "", discount: 0 });

  const [salesPage, setSalesPage] = useState(1);
  const [ratingsPage, setRatingsPage] = useState(1);
  const ROWS_PER_PAGE = 10;

  // MUTE STATE
  const [isMuted, setIsMuted] = useState(true);
  const vimeoRef = useRef(null);

  const movies = useMemo(() => MOVIE_DATA, []);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5555/api";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "admin") {
      setView("admin-login");
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const changeView = (newView) => {
    setView(newView);
    setSearchQuery("");
    window.scrollTo(0, 0);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (vimeoRef.current && vimeoRef.current.contentWindow) {
      vimeoRef.current.contentWindow.postMessage(
        JSON.stringify({ method: "setVolume", value: nextMuted ? 0 : 1 }),
        "*"
      );
    }
  };

  const showFeedback = (type, msg) => {
    setStatus({ type, message: msg });
    setTimeout(() => setStatus({ type: "", message: "" }), 8000);
  };

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
      setCouponInput("");
      setAppliedCoupon(null);
    }
  };

  const handleViewInfo = (movie) => {
    setPreviousView(view);
    setSelectedMovie(movie);
    setView("movie-details");
    setSearchQuery("");
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setView(previousView);
  };

  const handleCheckCoupon = async () => {
    if (!couponInput) {
      showFeedback("error", "Please enter a coupon code.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/check-coupon`, {
        code: couponInput,
      });
      if (res.data.valid) {
        setAppliedCoupon({
          code: couponInput.toUpperCase(),
          discount: res.data.discount,
        });
        showFeedback("success", res.data.message);
      } else {
        setAppliedCoupon(null);
        showFeedback("error", res.data.message);
      }
    } catch (err) {
      showFeedback("error", "Failed to check coupon");
    }
  };

  const calculateFinalPrice = () => {
    if (!appliedCoupon) return selectedMovie.price;
    const discountAmount = selectedMovie.price * (appliedCoupon.discount / 100);
    return Math.max(0, selectedMovie.price - discountAmount);
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
        setIsProcessing(false);
      } else {
        const finalPrice = calculateFinalPrice();
        if (finalPrice === 0) {
          processPurchase("FREE_COUPON");
        } else {
          handlePaystack(finalPrice);
        }
      }
    } catch (err) {
      showFeedback("error", "Connection error checking status.");
      setIsProcessing(false);
    }
  };

  const handlePaystack = (amountToPay) => {
    if (!window.PaystackPop) {
      setIsProcessing(false);
      return showFeedback("error", "Payment system loading...");
    }

    const uniqueRef = "BW_" + new Date().getTime().toString();

    const handler = window.PaystackPop.setup({
      key: "pk_live_36e3a37b7428b85df3f32582e043ffb49e0e1ed3",
      email: email,
      amount: amountToPay * 100,
      currency: "KES",
      ref: uniqueRef,
      callback: (response) => processPurchase(response.reference),
      onClose: () => {
        showFeedback("error", "Payment cancelled.");
        setIsProcessing(false);
      },
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
        couponCode: appliedCoupon ? appliedCoupon.code : null,
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

    const SERVICE_ID = "service_9qvnylt";
    const TEMPLATE_ID = "template_f43l5cc";
    const PUBLIC_KEY = "RpZwEJtbEPw4skmFZ";

    const emailParams = {
      movie_name: selectedMovie.name,
      code: existingTicketCode,
      to_email: email,
      to_name: email,
      message: `HERE IS YOUR ACCESS CODE!\n\nMovie: ${selectedMovie.name}\nAccess Code: ${existingTicketCode}\n\nWatch here: https://blackwellmovies.com`,
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
      message: `HERE IS YOUR ACCESS CODE!\n\nMovie: ${selectedMovie.name}\nAccess Code: ${code}\n\nWatch here: https://blackwellmovies.com`,
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
        showFeedback("success", res.data.message || "Access Granted!");
      }
    } catch (err) {
      showFeedback("error", err.response?.data?.message || "Invalid Code");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleThumbClick = async (type) => {
    const myTicket = accessCodes[selectedMovie.name] || null;
    if (!myTicket) {
      showFeedback("error", "You must buy access to rate this movie");
      return;
    }

    setUserRating(type);
    try {
      await axios.post(`${API_BASE}/rate-movie`, {
        movieName: selectedMovie.name,
        rating: type,
        comment: "",
        ticketCode: myTicket,
      });
      fetchRatings(selectedMovie.name);
    } catch (err) {
      console.error("Vote failed");
    }
  };

  const handleSubmitComment = async () => {
    if (!userComment) return;
    const myTicket = accessCodes[selectedMovie.name] || null;
    if (!myTicket) {
      showFeedback("error", "You must own the movie to comment.");
      return;
    }

    setIsProcessing(true);

    try {
      await axios.post(`${API_BASE}/rate-movie`, {
        movieName: selectedMovie.name,
        rating: "none",
        comment: userComment,
        ticketCode: myTicket,
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

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/admin/login`, {
        pin: adminPin,
      });
      if (res.data.success) {
        setView("admin-dashboard");
        fetchAdminData();
      }
    } catch (err) {
      showFeedback("error", "Invalid PIN");
    }
  };

  const fetchAdminData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/dashboard`, {
        headers: { "x-admin-pin": adminPin },
      });
      setAdminData(res.data);
    } catch (err) {
      showFeedback("error", "Failed to load data");
    }
  };

  const createCoupon = async () => {
    if (!newCoupon.code) return;
    try {
      await axios.post(
        `${API_BASE}/admin/coupon`,
        { code: newCoupon.code, discount_percent: newCoupon.discount },
        { headers: { "x-admin-pin": adminPin } }
      );
      setNewCoupon({ code: "", discount: 0 });
      fetchAdminData();
      showFeedback("success", "Coupon Created");
    } catch (err) {
      showFeedback("error", "Failed. Code might exist.");
    }
  };

  const toggleCoupon = async (id, currentStatus) => {
    try {
      await axios.patch(
        `${API_BASE}/admin/coupon/${id}`,
        { is_active: !currentStatus },
        { headers: { "x-admin-pin": adminPin } }
      );
      fetchAdminData();
    } catch (err) {
      showFeedback("error", "Update failed");
    }
  };

  const deleteCoupon = async (id) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await axios.delete(`${API_BASE}/admin/coupon/${id}`, {
        headers: { "x-admin-pin": adminPin },
      });
      fetchAdminData();
      showFeedback("success", "Coupon Deleted");
    } catch (err) {
      showFeedback("error", "Delete failed");
    }
  };

  const filteredResults = movies.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="splash-screen">
        <img src="/logo15.png" alt="Loading..." className="splash-logo" />
      </div>
    );
  }

  const paginate = (data, page) => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return data.slice(start, start + ROWS_PER_PAGE);
  };

  if (view === "admin-login") {
    return (
      <div className="admin-login-container">
        <h2 style={{ color: "#fff", marginBottom: "20px" }}>COMMAND ACCESS</h2>
        <form onSubmit={handleAdminLogin}>
          <input
            type="password"
            placeholder="ENTER PIN"
            className="auth-input"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            style={{ textAlign: "center", letterSpacing: "5px" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            UNLOCK
          </button>
        </form>
        <button
          onClick={() => changeView("home")}
          className="btn btn-ghost"
          style={{ marginTop: "20px" }}
        >
          EXIT
        </button>
      </div>
    );
  }

  if (view === "admin-dashboard" && adminData) {
    const paginatedSales = paginate(adminData.recent, salesPage);
    const paginatedRatings = paginate(adminData.ratings, ratingsPage);
    const couponList = adminData.coupons || [];

    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1 className="section-title">BLACKWELL COMMAND</h1>
          <button onClick={() => changeView("home")} className="btn btn-ghost">
            LOGOUT
          </button>
        </div>

        <div className="stat-grid">
          <div className="stat-card gold">
            <span style={{ fontSize: "12px", letterSpacing: "1px" }}>
              TOTAL REVENUE
            </span>
            <span className="stat-value">
              KES {Math.round(adminData.revenue).toLocaleString()}
            </span>
          </div>
          <div className="stat-card white">
            <span style={{ fontSize: "12px", letterSpacing: "1px" }}>
              TOTAL TICKETS
            </span>
            <span className="stat-value">{adminData.totalTickets}</span>
          </div>
          <div className="stat-card dark">
            <span style={{ fontSize: "12px", letterSpacing: "1px" }}>
              ACTIVE COUPONS
            </span>
            <span className="stat-value">
              {couponList.filter((c) => c.is_active).length}
            </span>
          </div>
        </div>

        <h3 className="section-title">COUPON MANAGER</h3>
        <div className="admin-input-group" style={{ alignItems: "center" }}>
          <input
            type="text"
            placeholder="COUPON NAME (e.g. DAVID)"
            className="auth-input"
            value={newCoupon.code}
            onChange={(e) =>
              setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })
            }
          />
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "#aaa", fontSize: "12px" }}>DISCOUNT %:</span>
            <input
              type="number"
              placeholder="0-100"
              className="auth-input"
              style={{ width: "80px" }}
              value={newCoupon.discount}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  discount: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <button onClick={createCoupon} className="btn btn-success">
            + CREATE
          </button>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>CODE</th>
                <th>DISCOUNT</th>
                <th>USES</th>
                <th>REVENUE GEN (EST)</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {couponList.map((c) => {
                const pricePaid = 250 - (250 * c.discount_percent) / 100;
                const estRev = c.uses * pricePaid;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: "bold", color: "#fff" }}>
                      {c.code}
                    </td>
                    <td>{c.discount_percent}%</td>
                    <td>{c.uses}</td>
                    <td>KES {Math.round(estRev).toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          c.is_active ? "status-active" : "status-inactive"
                        }`}
                      >
                        {c.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`toggle-btn ${
                          c.is_active ? "active" : "inactive"
                        }`}
                        onClick={() => toggleCoupon(c.id, c.is_active)}
                        style={{ marginRight: "10px" }}
                      >
                        {c.is_active ? "DEACTIVATE" : "ACTIVATE"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          color: "#e74c3c",
                          border: "1px solid #e74c3c",
                        }}
                        onClick={() => deleteCoupon(c.id)}
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="section-title">RECENT SALES</h3>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>EMAIL</th>
                <th>COUPON USED</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map((t) => {
                const isExpired = new Date() > new Date(t.expiry_date);
                return (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>{t.email}</td>
                    <td style={{ color: "var(--accent-color)" }}>
                      {t.coupon_used || "-"}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          isExpired ? "status-inactive" : "status-active"
                        }`}
                      >
                        {isExpired ? "EXPIRED" : "ACTIVE"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={salesPage === 1}
              onClick={() => setSalesPage((p) => p - 1)}
            >
              PREV
            </button>
            <span style={{ color: "#666", alignSelf: "center" }}>
              Page {salesPage}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={salesPage * ROWS_PER_PAGE >= adminData.recent.length}
              onClick={() => setSalesPage((p) => p + 1)}
            >
              NEXT
            </button>
          </div>
        </div>

        <h3 className="section-title">FEEDBACK & RATINGS</h3>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>EMAIL</th>
                <th>RATING</th>
                <th>COMMENT</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRatings.map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ fontSize: "12px", color: "#aaa" }}>
                    {r.email || "Anonymous"}
                  </td>
                  <td>
                    {r.rating === "up" ? "👍" : r.rating === "down" ? "👎" : "-"}
                  </td>
                  <td style={{ fontStyle: "italic" }}>
                    {r.comment || "No comment"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={ratingsPage === 1}
              onClick={() => setRatingsPage((p) => p - 1)}
            >
              PREV
            </button>
            <span style={{ color: "#666", alignSelf: "center" }}>
              Page {ratingsPage}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={ratingsPage * ROWS_PER_PAGE >= adminData.ratings.length}
              onClick={() => setRatingsPage((p) => p + 1)}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <img
            src="/logo12.png"
            alt="BLACKWELL"
            className="nav-logo-img"
            onClick={() => changeView("home")}
          />
          <div className="nav-links">
            <span
              className={`nav-link ${view === "home" ? "active" : ""}`}
              onClick={() => changeView("home")}
            >
              Home
            </span>
            <span
              className={`nav-link ${
                view === "movies" || view === "movie-details" ? "active" : ""
              }`}
              onClick={() => changeView("movies")}
            >
              Movies
            </span>
            <span
              className={`nav-link ${view === "shows" ? "active" : ""}`}
              onClick={() => changeView("shows")}
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
              className={`search-input ${searchOpen ? "open" : ""}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="search-icon-btn"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-color)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className="main-content">
        {searchQuery ? (
          <div
            className="centered-container-lg fade-in-view"
            style={{ paddingTop: "40px" }}
          >
            <h2 style={{ marginBottom: "30px", fontWeight: "300" }}>RESULTS</h2>
            <div className="movie-grid">
              {filteredResults.map((item) => (
                <div
                  key={item.id}
                  className="movie-card"
                  style={{ display: "flex", padding: "15px", gap: "20px" }}
                >
                  <ProgressiveImage
                    src={item.image}
                    alt={item.name}
                    style={{ width: "200px", borderRadius: "4px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginTop: "0", fontSize: "1.5rem" }}>{item.name}</h3>
                    <button
                      onClick={() => handlePlayRequest(item)}
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: "10px", maxWidth: "150px" }}
                    >
                      WATCH
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div key={view} className="fade-in-view">
            {view === "home" && (
              <div>
                <div className="hero-wrapper">
                  <div className="hero-video-bg">
                    <iframe
                      ref={vimeoRef}
                      src="https://player.vimeo.com/video/1144441206?background=1&autoplay=1&loop=1&byline=0&title=0&api=1"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      title="Cards on The Table Christmas Movie Trailer"
                    ></iframe>
                  </div>

                  <div className="hero-content">
                    <div className="hero-text-wrapper">
                      <h4 className="featured-tag">FEATURED FILM:</h4>
                      <h1
                        className="hero-title"
                        style={{ color: "var(--accent-color)" }}
                      >
                        {MOVIE_DATA[0].name}
                      </h1>

                      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
                        <span
                          className={`badge ${
                            hasAccess(MOVIE_DATA[0].name) ? "badge-owned" : ""
                          }`}
                          style={{
                            display: "inline-block",
                            width: "fit-content",
                          }}
                        >
                          {hasAccess(MOVIE_DATA[0].name)
                            ? "You Have Access"
                            : `KES ${MOVIE_DATA[0].price}`}
                        </span>
                      </div>

                      <div className="hero-actions">
                        <button
                          onClick={() => handlePlayRequest(MOVIE_DATA[0])}
                          className={
                            hasAccess(MOVIE_DATA[0].name)
                              ? "btn btn-success"
                              : "btn btn-primary"
                          }
                          style={{ width: "220px" }}
                        >
                          {hasAccess(MOVIE_DATA[0].name)
                            ? "▶ WATCH NOW"
                            : "WATCH NOW"}
                        </button>

                        <button
                          onClick={() => handleViewInfo(MOVIE_DATA[0])}
                          className="btn btn-ghost"
                          style={{
                            width: "220px",
                            border: "1px solid rgba(255,255,255,0.5)",
                          }}
                        >
                          VIEW INFO
                        </button>
                      </div>
                    </div>
                  </div>

                  <button className="mute-toggle-btn" onClick={toggleMute}>
                    {isMuted ? "🔇" : "🔊"}
                  </button>
                </div>

                <div className="centered-container-lg">
                  <div
                    className="home-movie-info glossy-card"
                    style={{
                      padding: "30px", // REDUCED FROM 50px
                      borderRadius: "12px",
                      marginTop: "80px",
                    }}
                  >
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

                        {/* ADDED BADGES ROW FOR HOME CARD */}
                        <div
                          className="detail-flex-row"
                          style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "20px",
                          }}
                        >
                          <span
                            className={`badge ${
                              hasAccess(MOVIE_DATA[0].name) ? "badge-owned" : ""
                            }`}
                          >
                            {hasAccess(MOVIE_DATA[0].name)
                              ? "You Have Access"
                              : `KES ${MOVIE_DATA[0].price}`}
                          </span>
                          <span className="badge" style={{ background: "#333" }}>
                            {MOVIE_DATA[0].genre}
                          </span>
                          <span className="badge" style={{ background: "#333" }}>
                            {MOVIE_DATA[0].rating}
                          </span>
                        </div>

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
                          <div className="meta-row">
                            <span className="meta-label">GENRE:</span>
                            <span className="meta-value">
                              {MOVIE_DATA[0].genre}
                            </span>
                          </div>
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
              <div
                className="centered-container-lg"
                style={{ paddingTop: "40px" }}
              >
                {/* REMOVED TITLE HERE */}
                <div className="movie-grid" style={{ justifyContent: "center" }}>
                  {movies.map((movie) => (
                    <div key={movie.id} className="movie-card" style={{ maxWidth: "350px", margin: "0 auto" }}>
                      <ProgressiveImage
                        src={movie.image}
                        alt={movie.name}
                        style={{
                          width: "100%",
                          aspectRatio: "2/3",
                          objectFit: "cover",
                        }}
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

            {view === "movie-details" && selectedMovie && (
              <div
                className="centered-container-lg"
                style={{ marginTop: "40px" }}
              >
                <button
                  onClick={handleBack}
                  className="btn btn-ghost btn-back"
                  style={{
                    width: "auto",
                    padding: "16px 32px",
                    marginBottom: "30px",
                    border: "1px solid #333",
                  }}
                >
                  ← BACK
                </button>

                <div className="detail-grid">
                  <div className="detail-poster">
                    <ProgressiveImage src={selectedMovie.image} alt="poster" />
                  </div>
                  <div className="info-font">
                    <h1 className="detail-title">{selectedMovie.name}</h1>

                    <div
                      className="detail-flex-row"
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
                        <span className="meta-label">RATING:</span>
                        <span className="meta-value">
                          {selectedMovie.rating}
                        </span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">YEAR:</span>
                        <span className="meta-value">{selectedMovie.year}</span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">GENRE:</span>
                        <span className="meta-value">
                          {selectedMovie.genre}
                        </span>
                      </div>
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
                      className="detail-flex-row"
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
          </div>
        )}
      </div>

      <footer className="app-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <img
              src="/logo13.png"
              alt="BLACKWELL"
              className="footer-logo-img"
            />
            <p style={{ color: "#666", fontSize: "12px", marginTop: "10px", marginLeft: "15px" }}>
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
              {selectedMovie?.name}
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
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      marginBottom: "15px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Have a Coupon?"
                      className="auth-input"
                      style={{
                        flex: 1,
                        marginBottom: 0,
                        textTransform: "uppercase",
                      }}
                      value={couponInput}
                      onChange={(e) =>
                        setCouponInput(e.target.value.toUpperCase())
                      }
                    />
                    <button
                      onClick={handleCheckCoupon}
                      className="btn btn-secondary btn-sm"
                      style={{ width: "auto", padding: "0 15px" }}
                    >
                      APPLY
                    </button>
                  </div>
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
                      className={
                        calculateFinalPrice() === 0
                          ? "btn btn-success"
                          : "btn btn-primary"
                      }
                    >
                      {isProcessing
                        ? "PROCESSING..."
                        : calculateFinalPrice() === 0
                        ? "GET TICKET (FREE)"
                        : `PAY KES ${calculateFinalPrice()}`}
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