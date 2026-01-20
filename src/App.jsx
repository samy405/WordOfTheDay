import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { WORDS } from "./words";

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromKey(key) {
  const [yyyy, mm, dd] = key.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

// Simple deterministic hash from a string → integer
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWordForDate(dateStr) {
  const idx = hashString(dateStr) % WORDS.length;
  return WORDS[idx];
}

const STORAGE_KEY = "wotd_history_v2";
const FAVORITES_KEY = "wotd_favorites_v1";

export default function App() {
  const todayDateStr = useMemo(() => todayKey(), []);
  const [viewingDate, setViewingDate] = useState(todayDateStr);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const currentWord = useMemo(() => pickWordForDate(viewingDate), [viewingDate]);

  // Load history and favorites
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
      
      const favs = localStorage.getItem(FAVORITES_KEY);
      if (favs) setFavorites(new Set(JSON.parse(favs)));
    } catch {
      setHistory([]);
      setFavorites(new Set());
    }
  }, []);

  // Add today's word once (no duplicate for same date)
  useEffect(() => {
    setHistory((prev) => {
      const exists = prev.some((x) => x.date === todayDateStr);
      if (exists) return prev;

      const next = [{ date: todayDateStr, word: currentWord.word, meaning: currentWord.meaning }, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [todayDateStr, currentWord.word, currentWord.meaning]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const navigateDate = (days) => {
    const currentDate = dateFromKey(viewingDate);
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setViewingDate(dateKey(newDate));
  };

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Visual feedback could be added here
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const toggleFavorite = (date) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const clearHistory = () => {
    const ok = confirm("Clear all word history?");
    if (!ok) return;
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `word-of-the-day-history-${todayDateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    let filtered = history;
    
    if (showFavoritesOnly) {
      filtered = filtered.filter((h) => favorites.has(h.date));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.word.toLowerCase().includes(query) ||
          h.meaning.toLowerCase().includes(query) ||
          h.date.includes(query)
      );
    }
    
    return filtered;
  }, [history, searchQuery, showFavoritesOnly, favorites]);

  // Statistics
  const stats = useMemo(() => {
    const totalWords = history.length;
    const favoriteCount = favorites.size;
    
    // Calculate streak
    let streak = 0;
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
      const today = new Date();
      let checkDate = new Date(today);
      
      for (const entry of sorted) {
        const entryDate = dateFromKey(entry.date);
        if (dateKey(checkDate) === entry.date) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (dateKey(checkDate) < entry.date) {
          break;
        }
      }
    }
    
    return { totalWords, favoriteCount, streak };
  }, [history, favorites]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        copyToClipboard(`${currentWord.word}\n${currentWord.meaning}`);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateDate(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateDate(1);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentWord, copyToClipboard]);

  const isFavorite = favorites.has(viewingDate);
  const isToday = viewingDate === todayDateStr;

  return (
    <div className="app">
      <div className="shell">
        <section className="panel main">
          <div className="kicker">daily vocabulary</div>
          <h1 className="title">Word of the Day</h1>

          {/* Date Navigation */}
          <div className="dateNav">
            <button
              className="navBtn"
              onClick={() => navigateDate(-1)}
              aria-label="Previous day"
              title="Previous day (←)"
            >
              ←
            </button>
            <span className="dateDisplay">{viewingDate}</span>
            <button
              className="navBtn"
              onClick={() => navigateDate(1)}
              aria-label="Next day"
              title="Next day (→)"
              disabled={!isToday && viewingDate >= todayDateStr}
            >
              →
            </button>
            {!isToday && (
              <button
                className="navBtn todayBtn"
                onClick={() => setViewingDate(todayDateStr)}
                title="Go to today"
              >
                Today
              </button>
            )}
          </div>

          <div className="word">{currentWord.word}</div>
          <p className="meaning">{currentWord.meaning}</p>

          {/* Action buttons */}
          <div className="actionRow">
            <button
              className="actionBtn"
              onClick={() => copyToClipboard(currentWord.word)}
              title="Copy word (C)"
            >
              Copy Word
            </button>
            <button
              className="actionBtn"
              onClick={() => copyToClipboard(`${currentWord.word}\n${currentWord.meaning}`)}
              title="Copy word and meaning"
            >
              Copy All
            </button>
            <button
              className={`actionBtn favoriteBtn ${isFavorite ? "active" : ""}`}
              onClick={() => toggleFavorite(viewingDate)}
              title="Add to favorites"
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>

          {/* Statistics */}
          <div className="statsRow">
            <div className="stat">
              <span className="statLabel">Words:</span>
              <span className="statValue">{stats.totalWords}</span>
            </div>
            <div className="stat">
              <span className="statLabel">Streak:</span>
              <span className="statValue">{stats.streak}</span>
            </div>
            <div className="stat">
              <span className="statLabel">Favorites:</span>
              <span className="statValue">{stats.favoriteCount}</span>
            </div>
          </div>

          <div className="metaRow">
            <span className="pill">
              <span className="dot" />
              <span>{viewingDate}</span>
            </span>
            <span className="pill">
              <span style={{ color: "rgba(255,255,255,.7)" }}>set:</span>
              <span>{WORDS.length} words</span>
            </span>
          </div>
        </section>

        <aside className="panel side">
          <div className="sideHeader">
            <h2 className="sideTitle">History</h2>
            <div className="headerActions">
              <button
                className={`filterBtn ${showFavoritesOnly ? "active" : ""}`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                title="Show favorites only"
              >
                {showFavoritesOnly ? "★" : "☆"}
              </button>
              <button className="btn" onClick={exportHistory} title="Export history">
                Export
              </button>
              <button className="btn" onClick={clearHistory}>
                Clear
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="searchContainer">
            <input
              type="text"
              className="searchInput"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ul className="list">
            {filteredHistory.length === 0 ? (
              <li className="item">
                <div className="itemMeaning">
                  {searchQuery || showFavoritesOnly
                    ? "No matching words found."
                    : "No history yet. Refresh tomorrow for a new word."}
                </div>
              </li>
            ) : (
              filteredHistory.map((h) => {
                const isFav = favorites.has(h.date);
                return (
                  <li className="item" key={h.date}>
                    <div className="itemTop">
                      <div className="itemWord">{h.word}</div>
                      <div className="itemRight">
                        <button
                          className={`itemFavorite ${isFav ? "active" : ""}`}
                          onClick={() => toggleFavorite(h.date)}
                          title={isFav ? "Remove from favorites" : "Add to favorites"}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <div className="itemDate">{h.date}</div>
                      </div>
                    </div>
                    <div className="itemMeaning">{h.meaning}</div>
                    <div className="itemActions">
                      <button
                        className="itemActionBtn"
                        onClick={() => copyToClipboard(h.word)}
                        title="Copy word"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
