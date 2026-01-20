import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { WORDS } from "./words";

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

export default function App() {
  const dateStr = useMemo(() => todayKey(), []);
  const today = useMemo(() => pickWordForDate(dateStr), [dateStr]);

  const [history, setHistory] = useState([]);

  // load history once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  // add today's word once (no duplicate for same date)
  useEffect(() => {
    setHistory((prev) => {
      const exists = prev.some((x) => x.date === dateStr);
      if (exists) return prev;

      const next = [{ date: dateStr, word: today.word, meaning: today.meaning }, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [dateStr, today.word, today.meaning]);

  const clearHistory = () => {
    const ok = confirm("Clear all word history?");
    if (!ok) return;
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="app">
      <div className="shell">
        <section className="panel main">
          <div className="kicker">daily vocabulary</div>
          <h1 className="title">Word of the Day</h1>

          <div className="word">{today.word}</div>
          <p className="meaning">{today.meaning}</p>

          <div className="metaRow">
            <span className="pill">
              <span className="dot" />
              <span>{dateStr}</span>
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
            <button className="btn" onClick={clearHistory}>Clear</button>
          </div>

          <ul className="list">
            {history.length === 0 ? (
              <li className="item">
                <div className="itemMeaning">No history yet. Refresh tomorrow for a new word.</div>
              </li>
            ) : (
              history.map((h) => (
                <li className="item" key={h.date}>
                  <div className="itemTop">
                    <div className="itemWord">{h.word}</div>
                    <div className="itemDate">{h.date}</div>
                  </div>
                  <div className="itemMeaning">{h.meaning}</div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
