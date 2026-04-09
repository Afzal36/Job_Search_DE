import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = "https://job-search-de-dbpw.vercel.app";

/* ─── Design Tokens ─────────────────────────────────────────────────────── */
const T = {
  bg:        "#F7F6F2",
  surface:   "#FFFFFF",
  border:    "#E8E4DC",
  borderMid: "#D4CFC4",
  text:      "#1C1A17",
  textMid:   "#6B6560",
  textSub:   "#A09890",
  accent:    "#2D5BE3",
  accentBg:  "#EEF2FF",
  accentMid: "rgba(45,91,227,0.12)",
  green:     "#0D9167",
  greenBg:   "rgba(13,145,103,0.1)",
  amber:     "#C4760A",
  amberBg:   "rgba(196,118,10,0.1)",
  blue:      "#2D5BE3",
  blueBg:    "rgba(45,91,227,0.1)",
  red:       "#C0392B",
  redBg:     "rgba(192,57,43,0.08)",
  shadow:    "0 1px 3px rgba(28,26,23,0.06), 0 4px 16px rgba(28,26,23,0.04)",
  shadowMd:  "0 4px 12px rgba(28,26,23,0.08), 0 16px 48px rgba(28,26,23,0.06)",
  shadowLg:  "0 8px 24px rgba(28,26,23,0.1), 0 32px 64px rgba(28,26,23,0.08)",
};

const TYPE_META = {
  "Full-time": { color: T.accent, bg: T.accentBg },
  Remote:      { color: T.green,  bg: T.greenBg  },
  Contract:    { color: T.amber,  bg: T.amberBg  },
};

const SORT_OPTIONS = [
  { value: "date_posted", label: "Newest first" },
  { value: "salary",      label: "Highest salary" },
  { value: "relevance",   label: "Most relevant" },
];
const EXP_OPTIONS = ["0-1", "1-3", "2-4", "3-5", "3-6", "4-7", "5-8", "7-12"];

const SEARCH_MODES = [
  { id: "standard",  label: "Standard",   icon: "⌕" },
  { id: "semantic",  label: "AI Search",  icon: "✦" },
  { id: "boolean",   label: "Boolean",    icon: "±" },
  { id: "recent",    label: "Recent",     icon: "◷" },
  { id: "skills",    label: "By Skills",  icon: "◎" },
  { id: "multi-loc", label: "Multi-City", icon: "◉" },
  { id: "exclude",   label: "Exclude",    icon: "⊘" },
  { id: "saved",     label: "Saved",      icon: "◈" },
];

const USER_ID = "demo_user_001";
const DEFAULT_FILTERS = {
  location: "", company: "", type: "", experience: "",
  minSalary: "", maxSalary: "", skills: "", sortBy: "date_posted",
};

/* ─── Shared Styles ─────────────────────────────────────────────────────── */
const inp = {
  width: "100%", background: T.surface,
  border: `1.5px solid ${T.border}`, borderRadius: 8,
  padding: "9px 12px", fontSize: 13, color: T.text,
  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};
const lbl = {
  fontSize: 10, fontWeight: 700, color: T.textSub,
  textTransform: "uppercase", letterSpacing: "0.08em",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};
const sel = { ...inp, cursor: "pointer" };

/* ─── Badge ─────────────────────────────────────────────────────────────── */
function Badge({ type }) {
  const m = TYPE_META[type] || { color: T.textMid, bg: T.border };
  return (
    <span style={{
      background: m.bg, color: m.color, fontSize: 9, fontWeight: 800,
      letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 4,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>{type || "Full-time"}</span>
  );
}

/* ─── SkillPill ─────────────────────────────────────────────────────────── */
function SkillPill({ s, highlight }) {
  return (
    <span style={{
      background: highlight ? T.amberBg : "#F2EFE8",
      color: highlight ? T.amber : T.textMid,
      fontSize: 10, fontWeight: 600, padding: "3px 9px",
      borderRadius: 4, fontFamily: "'Plus Jakarta Sans', sans-serif",
      letterSpacing: "0.02em",
      border: `1px solid ${highlight ? "rgba(196,118,10,0.2)" : T.border}`,
    }}>{s}{highlight ? " ✦" : ""}</span>
  );
}

/* ─── Job Card ──────────────────────────────────────────────────────────── */
function JobCard({ job, onClick, selected, highlightSkills = [] }) {
  const daysAgo = Math.floor((Date.now() - new Date(job.date_posted)) / 86400000);
  const dateStr = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
  return (
    <div
      onClick={() => onClick(job)}
      style={{
        background: selected ? "#FEFCF7" : T.surface,
        border: `1.5px solid ${selected ? T.accent : T.border}`,
        borderRadius: 12, padding: "16px 18px", cursor: "pointer",
        marginBottom: 7, transition: "all 0.16s ease",
        boxShadow: selected ? `0 0 0 3px ${T.accentMid}, ${T.shadow}` : T.shadow,
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.boxShadow = T.shadowMd; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.shadow; } }}
    >
      {selected && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: T.accent, borderRadius: "12px 0 0 12px" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Fraunces', serif" }}>
            {job.title}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
            {job.company} <span style={{ margin: "0 2px" }}>·</span> {job.location}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Badge type={job.type || "Full-time"} />
          {job.matchCount !== undefined && (
            <span style={{ fontSize: 9, color: T.green, fontWeight: 800, background: T.greenBg, padding: "2px 7px", borderRadius: 4, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em" }}>
              {job.matchCount} MATCH
            </span>
          )}
        </div>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: T.textMid, lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {job.description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {job.skills?.slice(0, 5).map((s, i) => (
          <SkillPill key={i} s={s} highlight={highlightSkills.some(h => s.toLowerCase().includes(h.toLowerCase()))} />
        ))}
        {job.skills?.length > 5 && <span style={{ fontSize: 10, color: T.textSub, alignSelf: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>+{job.skills.length - 5} more</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>{job.salary}</span>
        <span style={{ fontSize: 10, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{dateStr}</span>
      </div>
    </div>
  );
}

/* ─── Detail Pane ───────────────────────────────────────────────────────── */
function DetailPane({ job, onClose, onFindSimilar }) {
  if (!job) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ width: 56, height: 56, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: T.textMid, fontFamily: "'Fraunces', serif" }}>Select a role to preview</p>
        <p style={{ margin: 0, fontSize: 11, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Click any card to see full details</p>
      </div>
    </div>
  );

  const daysAgo = Math.floor((Date.now() - new Date(job.date_posted)) / 86400000);
  const dateStr = daysAgo === 0 ? "Today" : `${daysAgo}d ago`;

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 8 }}><Badge type={job.type || "Full-time"} /></div>
          <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2, fontFamily: "'Fraunces', serif" }}>{job.title}</h2>
          <p style={{ margin: 0, fontSize: 12, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{job.company}</p>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 8, cursor: "pointer", color: T.textMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
        {[
          { label: "Location",   val: job.location },
          { label: "Salary",     val: job.salary,                color: T.green, italic: true },
          { label: "Posted",     val: dateStr },
          { label: "Experience", val: job.experience || "Open" },
        ].map(({ label, val, color, italic }) => (
          <div key={label} style={{ background: T.bg, borderRadius: 8, padding: "10px 13px", border: `1px solid ${T.border}` }}>
            <p style={{ ...lbl, marginBottom: 2 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: color || T.text, fontFamily: italic ? "'Fraunces', serif" : "'Plus Jakarta Sans', sans-serif", fontStyle: italic ? "italic" : "normal" }}>{val}</p>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginBottom: 16 }}>
        <p style={{ ...lbl, marginBottom: 8 }}>About the Role</p>
        <p style={{ margin: 0, fontSize: 13, color: T.textMid, lineHeight: 1.8, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.description}</p>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginBottom: 24 }}>
        <p style={{ ...lbl, marginBottom: 10 }}>Required Skills</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {job.skills?.map((s, i) => (
            <span key={i} style={{ background: T.accentBg, color: T.accent, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onFindSimilar(job)} style={{ flex: 1, background: T.surface, color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
        >Find Similar</button>
        <button style={{ flex: 2.5, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s", boxShadow: `0 4px 14px rgba(45,91,227,0.35)` }}
          onMouseEnter={e => { e.currentTarget.style.background = "#2347C0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.accent; }}
        >Apply Now →</button>
      </div>
    </div>
  );
}

/* ─── Save Search Modal ─────────────────────────────────────────────────── */
function SaveSearchModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(28,26,23,0.35)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.surface, borderRadius: 18, padding: "32px 28px", width: 440, boxShadow: T.shadowLg, border: `1.5px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, background: T.accentBg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
          </div>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: T.text, fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}>Save this search</h3>
            <p style={{ margin: 0, fontSize: 12, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Name it to find it quickly later</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", width: 30, height: 30, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMid, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <label style={lbl}>Search name</label>
        <input
          ref={ref}
          type="text"
          placeholder="e.g. Senior React roles in Hyderabad"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onSave(name); onClose(); } if (e.key === "Escape") onClose(); }}
          style={{ ...inp, marginBottom: 20, fontSize: 14, padding: "12px 14px" }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: T.bg, color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button
            onClick={() => { if (name.trim()) { onSave(name); onClose(); } }}
            disabled={!name.trim()}
            style={{ flex: 2, background: name.trim() ? T.accent : T.border, color: name.trim() ? "#fff" : T.textSub, border: "none", borderRadius: 9, padding: "12px 0", fontSize: 13, fontWeight: 800, cursor: name.trim() ? "pointer" : "default", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s", boxShadow: name.trim() ? `0 4px 14px rgba(45,91,227,0.3)` : "none" }}
          >Save Search</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Premium Compound Search Bar ─────────────────────────────────────────── */
function PremiumSearchBar({ mode, setMode, children, onSearch }) {
  return (
    <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadowMd, overflow: "visible" }}>
      {/* Tab strip */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.bg, borderRadius: "14px 14px 0 0", overflowX: "auto" }}>
        {SEARCH_MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding: "10px 16px", border: "none",
            borderBottom: mode === m.id ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
            background: mode === m.id ? T.surface : "transparent",
            color: mode === m.id ? T.accent : T.textSub,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.14s",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
          }}
            onMouseEnter={e => { if (mode !== m.id) e.currentTarget.style.color = T.textMid; }}
            onMouseLeave={e => { if (mode !== m.id) e.currentTarget.style.color = T.textSub; }}
          >
            <span style={{ marginRight: 5, opacity: 0.8 }}>{m.icon}</span>{m.label}
          </button>
        ))}
      </div>

      {/* Input + button row */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1, padding: "16px 18px" }}>
          {children}
        </div>
        {mode !== "saved" && (
          <div style={{ padding: "16px 16px 16px 0", flexShrink: 0 }}>
            <button
              onClick={onSearch}
              style={{
                height: 42, padding: "0 24px", background: T.accent, color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: "0.01em", transition: "all 0.15s",
                boxShadow: `0 4px 14px rgba(45,91,227,0.32)`,
                display: "flex", alignItems: "center", gap: 7,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2347C0"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(45,91,227,0.42)`; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.boxShadow = `0 4px 14px rgba(45,91,227,0.32)`; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Standard Search ───────────────────────────────────────────────────── */
function StandardSearch({ query, setQuery, filters, setFilters, locations, companies, suggestions, onPickSuggest }) {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "0 14px", height: 42, transition: "border-color 0.15s, box-shadow 0.15s" }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.accentMid}`; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              type="text"
              placeholder="Search title, skill, company…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: T.text, background: "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSub, padding: 0, lineHeight: 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {suggestions && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: T.shadowLg, zIndex: 200, overflow: "hidden" }}>
              {[...suggestions.titles.map(t => ({ type: "title", val: t })), ...suggestions.companies.map(c => ({ type: "company", val: c })), ...suggestions.skills.map(s => ({ type: "skill", val: s }))].slice(0, 7).map((item, i) => (
                <div key={i} onClick={() => onPickSuggest(item.val)}
                  style={{ padding: "10px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <span style={{ ...lbl, width: 46, flexShrink: 0, marginBottom: 0 }}>{item.type}</span>
                  <span style={{ fontSize: 13, color: T.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowFilters(p => !p)} style={{
          height: 42, padding: "0 14px",
          background: showFilters ? T.accentBg : T.bg,
          border: `1.5px solid ${showFilters ? T.accent : T.border}`,
          borderRadius: 9, fontSize: 12, fontWeight: 700,
          color: showFilters ? T.accent : T.textMid,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
          boxShadow: showFilters ? `0 0 0 3px ${T.accentMid}` : "none",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filters {showFilters ? "▲" : "▼"}
        </button>
      </div>
      {showFilters && (
        <div style={{ marginTop: 10, background: T.bg, borderRadius: 10, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[{ key: "location", label: "Location", opts: locations }, { key: "company", label: "Company", opts: companies }].map(({ key, label, opts }) => (
              <label key={key} style={lbl}>{label}
                <select value={filters[key]} onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))} style={sel}>
                  <option value="">All</option>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label style={lbl}>Job Type
              <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))} style={sel}>
                <option value="">All</option><option>Full-time</option><option>Remote</option><option>Contract</option>
              </select>
            </label>
            <label style={lbl}>Experience
              <select value={filters.experience} onChange={e => setFilters(p => ({ ...p, experience: e.target.value }))} style={sel}>
                <option value="">Any</option>
                {EXP_OPTIONS.map(e => <option key={e}>{e} years</option>)}
              </select>
            </label>
            <label style={lbl}>Min Salary (LPA)
              <input type="number" placeholder="e.g. 10" value={filters.minSalary} onChange={e => setFilters(p => ({ ...p, minSalary: e.target.value }))} style={inp} />
            </label>
            <label style={lbl}>Max Salary (LPA)
              <input type="number" placeholder="e.g. 40" value={filters.maxSalary} onChange={e => setFilters(p => ({ ...p, maxSalary: e.target.value }))} style={inp} />
            </label>
            <label style={{ ...lbl, gridColumn: "span 2" }}>Skills (comma-separated)
              <input type="text" placeholder="React, Node.js, Python…" value={filters.skills} onChange={e => setFilters(p => ({ ...p, skills: e.target.value }))} style={inp} />
            </label>
            <label style={lbl}>Sort By
              <select value={filters.sortBy} onChange={e => setFilters(p => ({ ...p, sortBy: e.target.value }))} style={sel}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Semantic Search ────────────────────────────────────────────────────── */
function SemanticSearch({ value, onChange, parsedIntent }) {
  const examples = ["Senior backend engineer Hyderabad 20+ LPA", "Remote React dev with AWS", "Junior Python data analyst"];
  return (
    <div>
      <textarea rows={2} placeholder="Describe the role you want in plain English…" value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inp, lineHeight: 1.65, resize: "none", fontSize: 13 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        {examples.map((ex, i) => (
          <button key={i} onClick={() => onChange(ex)} style={{ background: T.accentBg, color: T.accent, border: `1px solid rgba(45,91,227,0.2)`, borderRadius: 5, padding: "4px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>"{ex}"</button>
        ))}
      </div>
      {parsedIntent && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10, padding: "10px 12px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
          <span style={{ ...lbl, alignSelf: "center", marginBottom: 0 }}>Parsed →</span>
          {parsedIntent.location && <span style={{ background: T.greenBg, color: T.green, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5 }}>📍 {parsedIntent.location}</span>}
          {parsedIntent.minSalary && <span style={{ background: T.greenBg, color: T.green, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5 }}>₹ {parsedIntent.minSalary}+</span>}
          {parsedIntent.skills?.map(s => <span key={s} style={{ background: T.amberBg, color: T.amber, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5 }}>◎ {s}</span>)}
          {parsedIntent.keywords?.map(k => <span key={k} style={{ background: "#F2EFE8", color: T.textMid, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5 }}>⌕ {k}</span>)}
        </div>
      )}
    </div>
  );
}

/* ─── Boolean Search ─────────────────────────────────────────────────────── */
function BooleanSearch({ must, setMust, should, setShould, not, setNot }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {[
        { label: "Must include (AND)", value: must, set: setMust, color: T.green, borderC: "rgba(13,145,103,0.25)", bg: T.greenBg, ph: "React, TypeScript" },
        { label: "Should include (OR)", value: should, set: setShould, color: T.accent, borderC: "rgba(45,91,227,0.25)", bg: T.accentBg, ph: "AWS, GCP, Azure" },
        { label: "Must NOT include", value: not, set: setNot, color: T.red, borderC: "rgba(192,57,43,0.2)", bg: T.redBg, ph: "PHP, Intern" },
      ].map(({ label, value, set, color, borderC, bg, ph }) => (
        <div key={label} style={{ flex: 1 }}>
          <label style={{ ...lbl, color }}>{label}</label>
          <input placeholder={ph} value={value} onChange={e => set(e.target.value)} style={{ ...inp, borderColor: borderC, background: bg }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Recent Search ─────────────────────────────────────────────────────── */
function RecentSearch({ days, setDays }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: T.textMid, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Posted within</span>
      {[7, 14, 30, 90].map(d => (
        <button key={d} onClick={() => setDays(d)} style={{
          background: days === d ? T.accent : T.bg,
          color: days === d ? "#fff" : T.textMid,
          border: `1.5px solid ${days === d ? T.accent : T.border}`,
          borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
          boxShadow: days === d ? `0 4px 12px rgba(45,91,227,0.3)` : "none",
        }}>{d} days</button>
      ))}
    </div>
  );
}

/* ─── Skills Search ─────────────────────────────────────────────────────── */
function SkillsSearch({ skills, setSkills, matchPercent, setMatchPercent }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: 2 }}>
        <label style={{ ...lbl, color: "#7C3AED" }}>Your skills (comma-separated)</label>
        <input placeholder="React, Node.js, Python, AWS…" value={skills} onChange={e => setSkills(e.target.value)}
          style={{ ...inp, borderColor: "rgba(124,58,237,0.25)", background: "rgba(124,58,237,0.05)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ ...lbl, color: "#7C3AED" }}>Min match: <strong style={{ color: T.text }}>{matchPercent}%</strong></label>
        <input type="range" min="10" max="100" step="10" value={matchPercent} onChange={e => setMatchPercent(e.target.value)} style={{ width: "100%", accentColor: "#7C3AED", marginTop: 8 }} />
      </div>
    </div>
  );
}

/* ─── Multi-Location Search ─────────────────────────────────────────────── */
function MultiLocSearch({ locs, setLocs, allLocations }) {
  const toggle = loc => setLocs(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  return (
    <div>
      <label style={lbl}>Select cities</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {allLocations.map(loc => (
          <button key={loc} onClick={() => toggle(loc)} style={{
            background: locs.includes(loc) ? T.accentBg : T.bg,
            color: locs.includes(loc) ? T.accent : T.textMid,
            border: `1.5px solid ${locs.includes(loc) ? T.accent : T.border}`,
            borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "all 0.14s", fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: locs.includes(loc) ? `0 0 0 3px ${T.accentMid}` : "none",
          }}>{loc}</button>
        ))}
      </div>
      {locs.length > 0 && <p style={{ margin: "8px 0 0", fontSize: 11, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Selected: {locs.join(" · ")}</p>}
    </div>
  );
}

/* ─── Exclude Search ─────────────────────────────────────────────────────── */
function ExcludeSearch({ include, setInclude, exclude, setExclude }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 2 }}>
        <label style={{ ...lbl, color: T.accent }}>Search for</label>
        <input placeholder="e.g. React developer" value={include} onChange={e => setInclude(e.target.value)}
          style={{ ...inp, borderColor: "rgba(45,91,227,0.25)", background: T.accentBg }} />
      </div>
      <div style={{ flex: 2 }}>
        <label style={{ ...lbl, color: T.red }}>Exclude terms (comma-separated)</label>
        <input placeholder="e.g. Senior, Manager, Lead" value={exclude} onChange={e => setExclude(e.target.value)}
          style={{ ...inp, borderColor: "rgba(192,57,43,0.2)", background: T.redBg }} />
      </div>
    </div>
  );
}

/* ─── Saved Searches Panel ─────────────────────────────────────────────── */
function SavedSearchesPanel({ savedSearches, onLoad, onDelete, onSaveCurrent }) {
  const [name, setName] = useState("");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input placeholder="Name a new saved search…" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onSaveCurrent(name); setName(""); } }}
            style={{ ...inp, paddingLeft: 38 }} />
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
        </div>
        <button onClick={() => { if (name.trim()) { onSaveCurrent(name); setName(""); } }} disabled={!name.trim()}
          style={{ background: name.trim() ? T.accent : T.border, color: name.trim() ? "#fff" : T.textSub, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: name.trim() ? "pointer" : "default", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: name.trim() ? `0 4px 12px rgba(45,91,227,0.3)` : "none", transition: "all 0.15s" }}>Save</button>
      </div>
      {savedSearches.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: T.textSub }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 10, display: "block", margin: "0 auto 10px", opacity: 0.4 }}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
          <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: "'Fraunces', serif" }}>No saved searches</p>
          <p style={{ margin: 0, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Run a search and save it for quick access</p>
        </div>
      ) : savedSearches.map(s => (
        <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", background: T.surface, borderRadius: 10, border: `1.5px solid ${T.border}`, marginBottom: 8, boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: T.accentBg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
            </div>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'Fraunces', serif" }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: 10, color: T.textSub, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{new Date(s.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onLoad(s)} style={{ background: T.accentBg, color: T.accent, border: `1px solid rgba(45,91,227,0.2)`, borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Load →</button>
            <button onClick={() => onDelete(s._id)} style={{ background: T.redBg, color: T.red, border: `1px solid rgba(192,57,43,0.2)`, borderRadius: 7, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────────────────────────── */
export default function App() {
  const [mode, setMode]                   = useState("standard");
  const [query, setQuery]                 = useState("");
  const [filters, setFilters]             = useState(DEFAULT_FILTERS);
  const [bMust, setBMust]                 = useState("");
  const [bShould, setBShould]             = useState("");
  const [bNot, setBNot]                   = useState("");
  const [nlQuery, setNlQuery]             = useState("");
  const [parsedIntent, setParsedIntent]   = useState(null);
  const [recentDays, setRecentDays]       = useState(7);
  const [skillsInput, setSkillsInput]     = useState("");
  const [matchPct, setMatchPct]           = useState(50);
  const [selLocs, setSelLocs]             = useState([]);
  const [exInclude, setExInclude]         = useState("");
  const [exExclude, setExExclude]         = useState("");
  const [savedSearches, setSavedSearches] = useState([]);
  const [jobs, setJobs]                   = useState([]);
  const [total, setTotal]                 = useState(0);
  const [pages, setPages]                 = useState(1);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(false);
  const [selected, setSelected]           = useState(null);
  const [locations, setLocations]         = useState([]);
  const [companies, setCompanies]         = useState([]);
  const [highlightSkills, setHighlightSkills] = useState([]);
  const [suggestions, setSuggestions]     = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/meta/locations`).then(r => setLocations(r.data)).catch(() => {});
    axios.get(`${API}/meta/companies`).then(r => setCompanies(r.data)).catch(() => {});
    axios.get(`${API}/saved-searches/${USER_ID}`).then(r => setSavedSearches(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "standard" || query.length < 2) { setSuggestions(null); return; }
    const t = setTimeout(() => axios.get(`${API}/suggest`, { params: { q: query } }).then(r => setSuggestions(r.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  const search = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      let res;
      setHighlightSkills([]);
      setParsedIntent(null);
      if (mode === "standard") {
        const params = { page: p, limit: 12, sortBy: filters.sortBy, order: "desc", ...(query.trim() && { query: query.trim() }), ...(filters.location && { location: filters.location }), ...(filters.company && { company: filters.company }), ...(filters.type && { type: filters.type }), ...(filters.experience && { experience: filters.experience.split(" ")[0] }), ...(filters.minSalary && { minSalary: filters.minSalary }), ...(filters.maxSalary && { maxSalary: filters.maxSalary }), ...(filters.skills && { skills: filters.skills }) };
        res = await axios.get(`${API}/search`, { params });
      } else if (mode === "semantic") {
        res = await axios.post(`${API}/search/semantic`, { naturalQuery: nlQuery, page: p, limit: 12 });
        if (res.data.parsedIntent) { setParsedIntent(res.data.parsedIntent); setHighlightSkills(res.data.parsedIntent.skills || []); }
      } else if (mode === "boolean") {
        res = await axios.get(`${API}/search/boolean`, { params: { ...(bMust && { must: bMust }), ...(bShould && { should: bShould }), ...(bNot && { not: bNot }), page: p, limit: 12 } });
      } else if (mode === "recent") {
        res = await axios.get(`${API}/search/recent`, { params: { days: recentDays, page: p, limit: 12 } });
      } else if (mode === "skills") {
        if (!skillsInput.trim()) { setJobs([]); setTotal(0); setLoading(false); return; }
        res = await axios.get(`${API}/search/by-skills`, { params: { skills: skillsInput, matchPercent: matchPct, page: p, limit: 12 } });
        setHighlightSkills(skillsInput.split(",").map(s => s.trim()));
      } else if (mode === "multi-loc") {
        if (!selLocs.length) { setJobs([]); setTotal(0); setLoading(false); return; }
        res = await axios.get(`${API}/search/multi-location`, { params: { locations: selLocs.join(","), page: p, limit: 12 } });
      } else if (mode === "exclude") {
        res = await axios.get(`${API}/search/exclude`, { params: { ...(exInclude && { query: exInclude }), ...(exExclude && { excludeTerms: exExclude }), page: p, limit: 12 } });
      }
      if (res) { setJobs(res.data.jobs || []); setTotal(res.data.total || 0); setPages(res.data.pages || 1); setPage(p); setSelected(null); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [mode, query, filters, nlQuery, bMust, bShould, bNot, recentDays, skillsInput, matchPct, selLocs, exInclude, exExclude]);

  useEffect(() => {
    if (mode === "saved") return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(1), 450);
  }, [search, mode]);

  const handleFindSimilar = async (job) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/search/similar/${job._id}`, { params: { limit: 12 } });
      setJobs(res.data.jobs || []); setTotal(res.data.jobs?.length || 0); setPages(1); setPage(1); setSelected(null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveSearch = async (name) => {
    if (!name?.trim()) return;
    const params = mode === "standard" ? { mode, query, filters } : mode === "boolean" ? { mode, must: bMust, should: bShould, not: bNot } : mode === "skills" ? { mode, skills: skillsInput, matchPercent: matchPct } : { mode };
    try { const res = await axios.post(`${API}/saved-searches`, { userId: USER_ID, name, params }); setSavedSearches(prev => [res.data, ...prev]); } catch (e) { console.error(e); }
  };

  const handleLoadSaved = (s) => {
    const p = s.params;
    setMode(p.mode || "standard");
    if (p.query) setQuery(p.query);
    if (p.filters) setFilters(p.filters);
    if (p.must) setBMust(p.must);
    if (p.should) setBShould(p.should);
    if (p.not) setBNot(p.not);
    if (p.skills) setSkillsInput(p.skills);
    if (p.matchPercent) setMatchPct(p.matchPercent);
  };

  const handleDeleteSaved = async (id) => {
    try { await axios.delete(`${API}/saved-searches/${id}`); } catch {}
    setSavedSearches(prev => prev.filter(s => s._id !== id));
  };

  const currentMode = SEARCH_MODES.find(m => m.id === mode);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: "100vh", background: T.bg }}>

      {showSaveModal && (
        <SaveSearchModal onSave={name => handleSaveSearch(name)} onClose={() => setShowSaveModal(false)} />
      )}

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav style={{ background: "rgba(247,246,242,0.88)", backdropFilter: "blur(18px)", borderBottom: `1px solid ${T.border}`, padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 300 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px rgba(45,91,227,0.35)` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: "-0.03em", fontFamily: "'Fraunces', serif" }}>JobSphere</span>
          <span style={{ fontSize: 9, color: T.textSub, background: "#F2EFE8", border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Beta</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 8, boxShadow: T.shadow }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
            <span style={{ fontSize: 11, color: T.textMid, fontWeight: 600 }}>{total.toLocaleString()} jobs indexed</span>
          </div>
          <button
            onClick={() => setShowSaveModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: T.textMid, cursor: "pointer", transition: "all 0.15s", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: T.shadow }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.accentMid}`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; e.currentTarget.style.boxShadow = T.shadow; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
            Save Search
          </button>
        </div>
      </nav>

      {/* ── Hero + Search ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 28px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>MongoDB Full-Text Search</p>
          <h1 style={{ margin: "0 0 6px", fontSize: 34, fontWeight: 700, color: T.text, letterSpacing: "-0.03em", lineHeight: 1.08, fontFamily: "'Fraunces', serif" }}>
            Find your <em style={{ fontStyle: "italic", color: T.accent }}>next role.</em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: T.textMid }}>
            Real-time search across {total.toLocaleString()} listings — intelligent, fast, precise.
          </p>
        </div>

        <PremiumSearchBar mode={mode} setMode={setMode} onSearch={() => search(1)}>
          {mode === "standard"  && <StandardSearch query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} locations={locations} companies={companies} suggestions={suggestions} onPickSuggest={val => { setQuery(val); setSuggestions(null); search(1); }} />}
          {mode === "semantic"  && <SemanticSearch value={nlQuery} onChange={setNlQuery} parsedIntent={parsedIntent} />}
          {mode === "boolean"   && <BooleanSearch must={bMust} setMust={setBMust} should={bShould} setShould={setBShould} not={bNot} setNot={setBNot} />}
          {mode === "recent"    && <RecentSearch days={recentDays} setDays={setRecentDays} />}
          {mode === "skills"    && <SkillsSearch skills={skillsInput} setSkills={setSkillsInput} matchPercent={matchPct} setMatchPercent={setMatchPct} />}
          {mode === "multi-loc" && <MultiLocSearch locs={selLocs} setLocs={setSelLocs} allLocations={locations} />}
          {mode === "exclude"   && <ExcludeSearch include={exInclude} setInclude={setExInclude} exclude={exExclude} setExclude={setExExclude} />}
          {mode === "saved"     && <SavedSearchesPanel savedSearches={savedSearches} onLoad={handleLoadSaved} onDelete={handleDeleteSaved} onSaveCurrent={handleSaveSearch} />}
        </PremiumSearchBar>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {mode !== "saved" && (
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px 40px", display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          {/* Results column */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: T.textMid, fontWeight: 600 }}>
                  {loading ? "Searching…" : `${total} result${total !== 1 ? "s" : ""}`}
                </p>
                {mode !== "standard" && (
                  <span style={{ background: T.accentBg, color: T.accent, fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {currentMode?.icon} {currentMode?.label}
                  </span>
                )}
              </div>
              {jobs.length > 0 && (
                <button onClick={() => setShowSaveModal(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1.5px dashed ${T.borderMid}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, color: T.textSub, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.textSub; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                  Save this search
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ background: T.surface, borderRadius: 12, padding: "18px", border: `1.5px solid ${T.border}`, boxShadow: T.shadow }}>
                    <div style={{ height: 13, background: T.bg, borderRadius: 4, width: "52%", marginBottom: 8, animation: "shimmer 1.6s ease-in-out infinite" }} />
                    <div style={{ height: 10, background: T.bg, borderRadius: 4, width: "36%", marginBottom: 14 }} />
                    <div style={{ height: 10, background: T.bg, borderRadius: 4, width: "88%" }} />
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "52px 24px", textAlign: "center", boxShadow: T.shadow }}>
                <div style={{ width: 48, height: 48, background: T.bg, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                </div>
                <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 700, color: T.textMid, fontFamily: "'Fraunces', serif" }}>No results found</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textSub }}>Try adjusting your search criteria or filters</p>
              </div>
            ) : (
              <>
                {jobs.map(job => <JobCard key={job._id} job={job} onClick={j => setSelected(j)} selected={selected?._id === job._id} highlightSkills={highlightSkills} />)}
                {pages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 20 }}>
                    {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => search(p)} style={{
                        width: 34, height: 34, borderRadius: 8,
                        border: `1.5px solid ${p === page ? T.accent : T.border}`,
                        background: p === page ? T.accent : T.surface,
                        color: p === page ? "#fff" : T.textMid,
                        fontSize: 12, fontWeight: 800, cursor: "pointer",
                        boxShadow: p === page ? `0 4px 12px rgba(45,91,227,0.3)` : T.shadow,
                        transition: "all 0.15s",
                      }}>{p}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail pane */}
          <div style={{
            background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14,
            overflow: "hidden", position: "sticky", top: 72,
            height: "calc(100vh - 88px)", maxHeight: 800, boxShadow: T.shadow,
          }}>
            <DetailPane job={selected} onClose={() => setSelected(null)} onFindSimilar={handleFindSimilar} />
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;1,9..144,600;1,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus {
          border-color: ${T.accent} !important;
          box-shadow: 0 0 0 3px ${T.accentMid} !important;
          outline: none;
        }
        select option { background: ${T.surface}; color: ${T.text}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.borderMid}; }
        ::placeholder { color: ${T.textSub} !important; opacity: 1; }
        @keyframes shimmer { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}