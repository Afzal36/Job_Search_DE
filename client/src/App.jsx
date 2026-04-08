import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = "https://job-search-de.onrender.com";

const TYPE_COLORS = {
  "Full-time": { bg: "#EEF2FF", text: "#1a56db" },
  Remote:      { bg: "#ECFDF5", text: "#059669" },
  Contract:    { bg: "#FFFBEB", text: "#d97706" },
};

const SORT_OPTIONS = [
  { value: "date_posted", label: "Newest first" },
  { value: "salary",      label: "Highest salary" },
  { value: "relevance",   label: "Most relevant" },
];

const EXP_OPTIONS = ["0-1", "1-3", "2-4", "3-5", "3-6", "4-7", "5-8", "7-12"];

const SEARCH_MODES = [
  { id: "standard",  label: "Standard",   icon: "🔍", desc: "Keyword + filters" },
  { id: "semantic",  label: "AI Search",  icon: "🤖", desc: "Natural language" },
  { id: "boolean",   label: "Boolean",    icon: "⚙️", desc: "AND / OR / NOT" },
  { id: "recent",    label: "Recent",     icon: "🕐", desc: "By date posted" },
  { id: "skills",    label: "By Skills",  icon: "🎯", desc: "Skill match %" },
  { id: "multi-loc", label: "Multi-City", icon: "🗺️", desc: "Several locations" },
  { id: "exclude",   label: "Exclude",    icon: "🚫", desc: "Filter out terms" },
  { id: "saved",     label: "Saved",      icon: "🔖", desc: "Your saved searches" },
];

/* ─── Micro components ──────────────────────────────────────────────────── */

function Badge({ type }) {
  const c = TYPE_COLORS[type] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span style={{
      background: c.bg, color: c.text, fontSize: 10, fontWeight: 600,
      padding: "2px 8px", borderRadius: 99, letterSpacing: "0.04em",
      textTransform: "uppercase", border: `0.5px solid ${c.text}30`,
    }}>{type}</span>
  );
}

function SkillTag({ s, highlight }) {
  return (
    <span style={{
      background: highlight ? "#FFFBEB" : "var(--skill-bg, #f1f5f9)",
      color: highlight ? "#d97706" : "#64748b",
      fontSize: 10, fontWeight: 500, padding: "2px 7px",
      borderRadius: 4,
      border: `0.5px solid ${highlight ? "#fde68a" : "#e2e8f0"}`,
    }}>{s}{highlight ? " ✓" : ""}</span>
  );
}

function Salary({ s }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: "#059669", display: "flex", alignItems: "center", gap: 3 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
      {s}
    </span>
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
        background: selected ? "#f0f9ff" : "#fff",
        border: selected ? "1.5px solid #1a56db" : "0.5px solid #e2e8f0",
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        boxShadow: selected ? "0 0 0 3px rgba(26,86,219,0.1)" : "none",
        marginBottom: 8, transition: "border-color 0.15s",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "#cbd5e1"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "#e2e8f0"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{job.company} · {job.location}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          <Badge type={job.type || "Full-time"} />
          {job.matchCount !== undefined && (
            <span style={{ fontSize: 9, color: "#7c3aed", fontWeight: 700, background: "#F5F3FF", padding: "2px 6px", borderRadius: 99, border: "0.5px solid #ddd6fe" }}>
              {job.matchCount} skill match
            </span>
          )}
        </div>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {job.skills?.slice(0, 5).map((s, i) => (
          <SkillTag key={i} s={s} highlight={highlightSkills.some(h => s.toLowerCase().includes(h.toLowerCase()))} />
        ))}
        {job.skills?.length > 5 && <span style={{ fontSize: 10, color: "#94a3b8", alignSelf: "center" }}>+{job.skills.length - 5}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Salary s={job.salary} />
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{dateStr}</span>
      </div>
    </div>
  );
}

/* ─── Detail Pane ───────────────────────────────────────────────────────── */

function DetailPane({ job, onClose, onFindSimilar }) {
  if (!job) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: 10 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
      <p style={{ margin: 0, fontSize: 13 }}>Select a job to view details</p>
    </div>
  );
  const daysAgo = Math.floor((Date.now() - new Date(job.date_posted)) / 86400000);
  const dateStr = daysAgo === 0 ? "Today" : `${daysAgo}d ago`;
  return (
    <div style={{ padding: "20px 22px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ marginBottom: 5 }}><Badge type={job.type || "Full-time"} /></div>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{job.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{job.company}</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Location", val: `📍 ${job.location}` },
          { label: "Salary",   val: `💰 ${job.salary}`,  color: "#059669" },
          { label: "Posted",   val: `📅 ${dateStr}` },
          { label: "Experience", val: `💼 ${job.experience || "Open"}` },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "0.5px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 2px", fontSize: 9, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: color || "#1e293b" }}>{val}</p>
          </div>
        ))}
      </div>

      <p style={{ margin: "0 0 6px", fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Description</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{job.description}</p>

      <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Required skills</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 20 }}>
        {job.skills?.map((s, i) => (
          <span key={i} style={{ background: "#EEF2FF", color: "#1a56db", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "0.5px solid rgba(26,86,219,0.25)" }}>{s}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onFindSimilar(job)} style={{
          flex: 1, background: "#f8fafc", color: "#475569",
          border: "0.5px solid #e2e8f0", borderRadius: 8,
          padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Similar →</button>
        <button style={{
          flex: 2, background: "#1a56db", color: "#fff",
          border: "none", borderRadius: 8, padding: "10px 0",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>Apply Now →</button>
      </div>
    </div>
  );
}

/* ─── Search Mode Panels ────────────────────────────────────────────────── */

function StandardSearch({ query, setQuery, filters, setFilters, locations, companies, suggestions, setSuggestions, onPickSuggest }) {
  const [showFilters, setShowFilters] = useState(false);

  const sel = {
    display: "block", width: "100%", marginTop: 4,
    border: "0.5px solid #e2e8f0", borderRadius: 7,
    padding: "7px 9px", fontSize: 12, color: "#1e293b",
    background: "#f8fafc", outline: "none",
  };
  const inp = {
    border: "0.5px solid #e2e8f0", borderRadius: 7,
    padding: "7px 9px", fontSize: 12, color: "#1e293b",
    background: "#f8fafc", outline: "none", width: "100%",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "0.5px solid #e2e8f0", borderRadius: 8, padding: "0 12px", height: 38 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              type="text"
              placeholder="Search by title, skill, company…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#1e293b", background: "transparent" }}
              autoComplete="off"
            />
          </div>
          {suggestions && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 9,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 100, overflow: "hidden",
            }}>
              {[...suggestions.titles.map(t => ({ type: "title", val: t })),
                ...suggestions.companies.map(c => ({ type: "company", val: c })),
                ...suggestions.skills.map(s => ({ type: "skill", val: s })),
              ].slice(0, 8).map((item, i) => (
                <div
                  key={i}
                  onClick={() => onPickSuggest(item.val)}
                  style={{ padding: "8px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", borderBottom: "0.5px solid #f1f5f9" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", width: 44, flexShrink: 0 }}>{item.type}</span>
                  <span style={{ fontSize: 13, color: "#0f172a" }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowFilters(p => !p)}
          style={{
            height: 38, padding: "0 14px",
            background: showFilters ? "#EEF2FF" : "#f8fafc",
            border: "0.5px solid #e2e8f0", borderRadius: 8,
            fontSize: 12, fontWeight: 600, color: showFilters ? "#1a56db" : "#64748b",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filters
        </button>
      </div>

      {showFilters && (
        <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 10, border: "0.5px solid #e2e8f0", padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { key: "location", label: "Location", opts: locations },
              { key: "company",  label: "Company",  opts: companies },
            ].map(({ key, label, opts }) => (
              <label key={key} style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
                <select value={filters[key]} onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))} style={sel}>
                  <option value="">All</option>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Job type
              <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))} style={sel}>
                <option value="">All</option>
                <option>Full-time</option><option>Remote</option><option>Contract</option>
              </select>
            </label>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Experience
              <select value={filters.experience} onChange={e => setFilters(p => ({ ...p, experience: e.target.value }))} style={sel}>
                <option value="">Any</option>
                {EXP_OPTIONS.map(e => <option key={e}>{e} years</option>)}
              </select>
            </label>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Min salary (LPA)
              <input type="number" placeholder="e.g. 10" value={filters.minSalary} onChange={e => setFilters(p => ({ ...p, minSalary: e.target.value }))} style={inp} />
            </label>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Max salary (LPA)
              <input type="number" placeholder="e.g. 40" value={filters.maxSalary} onChange={e => setFilters(p => ({ ...p, maxSalary: e.target.value }))} style={inp} />
            </label>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", gridColumn: "span 2" }}>
              Skills (comma-separated)
              <input type="text" placeholder="React, Node.js, Python…" value={filters.skills} onChange={e => setFilters(p => ({ ...p, skills: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sort by
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

function SemanticSearch({ value, onChange, parsedIntent }) {
  const examples = [
    "Senior backend engineer in Hyderabad with 20+ LPA",
    "Remote React developer with AWS experience",
    "Junior Python data analyst full-time",
  ];
  return (
    <div>
      <textarea
        rows={2}
        placeholder="Describe the job you're looking for in plain English…"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", border: "0.5px solid #e2e8f0", borderRadius: 8,
          padding: "9px 12px", fontSize: 14, color: "#1e293b",
          background: "#f8fafc", fontFamily: "inherit", lineHeight: 1.5,
          resize: "none", outline: "none",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
        {examples.map((ex, i) => (
          <button key={i} onClick={() => onChange(ex)} style={{
            background: "#EEF2FF", color: "#1a56db",
            border: "0.5px solid rgba(26,86,219,0.25)",
            borderRadius: 99, padding: "3px 11px", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}>"{ex}"</button>
        ))}
      </div>
      {parsedIntent && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", alignSelf: "center", letterSpacing: "0.06em" }}>Detected:</span>
          {parsedIntent.location && <span style={{ background: "#ECFDF5", color: "#059669", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>📍 {parsedIntent.location}</span>}
          {parsedIntent.type     && <span style={{ background: "#FFFBEB", color: "#d97706", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>💼 {parsedIntent.type}</span>}
          {parsedIntent.minSalary && <span style={{ background: "#ECFDF5", color: "#059669", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>💰 {parsedIntent.minSalary}+ LPA</span>}
          {parsedIntent.skills.map(s => <span key={s} style={{ background: "#F5F3FF", color: "#7c3aed", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>🎯 {s}</span>)}
          {parsedIntent.keywords.map(k => <span key={k} style={{ background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>🔍 {k}</span>)}
        </div>
      )}
    </div>
  );
}

function BooleanSearch({ must, setMust, should, setShould, not, setNot }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {[
        { label: "Must include (AND)", value: must, set: setMust, color: "#059669", bg: "#ECFDF5", border: "#6ee7b7", placeholder: "React, TypeScript" },
        { label: "Should include (OR)", value: should, set: setShould, color: "#1a56db", bg: "#EEF2FF", border: "#93c5fd", placeholder: "AWS, GCP, Azure" },
        { label: "Must NOT include", value: not, set: setNot, color: "#dc2626", bg: "#FEF2F2", border: "#fca5a5", placeholder: "PHP, Intern" },
      ].map(({ label, value, set, color, bg, border, placeholder }) => (
        <div key={label} style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>{label}</label>
          <input
            placeholder={placeholder}
            value={value}
            onChange={e => set(e.target.value)}
            style={{ width: "100%", border: `0.5px solid ${border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none", background: bg, color: "#1e293b" }}
          />
        </div>
      ))}
    </div>
  );
}

function RecentSearch({ days, setDays }) {
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Posted in the last</span>
      {[7, 14, 30, 90].map(d => (
        <button key={d} onClick={() => setDays(d)} style={{
          background: days === d ? "#1a56db" : "#f8fafc",
          color: days === d ? "#fff" : "#475569",
          border: days === d ? "none" : "0.5px solid #e2e8f0",
          borderRadius: 99, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>{d} days</button>
      ))}
    </div>
  );
}

function SkillsSearch({ skills, setSkills, matchPercent, setMatchPercent }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: 2 }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Your skills (comma-separated)</label>
        <input
          placeholder="React, Node.js, Python, AWS…"
          value={skills}
          onChange={e => setSkills(e.target.value)}
          style={{ width: "100%", border: "0.5px solid #ddd6fe", borderRadius: 7, padding: "7px 12px", fontSize: 13, outline: "none", background: "#faf5ff", color: "#1e293b" }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Min match: {matchPercent}%</label>
        <input type="range" min="10" max="100" step="10" value={matchPercent} onChange={e => setMatchPercent(e.target.value)} style={{ width: "100%", accentColor: "#7c3aed" }} />
      </div>
    </div>
  );
}

function MultiLocSearch({ locs, setLocs, allLocations }) {
  const toggle = loc => setLocs(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  return (
    <div>
      <label style={{ fontSize: 9, fontWeight: 700, color: "#1a56db", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>Select multiple cities</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {allLocations.map(loc => (
          <button key={loc} onClick={() => toggle(loc)} style={{
            background: locs.includes(loc) ? "#1a56db" : "#f8fafc",
            color: locs.includes(loc) ? "#fff" : "#475569",
            border: locs.includes(loc) ? "none" : "0.5px solid #e2e8f0",
            borderRadius: 99, padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}>{loc}</button>
        ))}
      </div>
      {locs.length > 0 && <p style={{ margin: "7px 0 0", fontSize: 11, color: "#94a3b8" }}>Selected: {locs.join(", ")}</p>}
    </div>
  );
}

function ExcludeSearch({ include, setInclude, exclude, setExclude }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 2 }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: "#1a56db", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Search for</label>
        <input placeholder="e.g. React developer" value={include} onChange={e => setInclude(e.target.value)}
          style={{ width: "100%", border: "0.5px solid #93c5fd", borderRadius: 7, padding: "7px 12px", fontSize: 13, outline: "none", background: "#EEF2FF", color: "#1e293b" }} />
      </div>
      <div style={{ flex: 2 }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Exclude words (comma-separated)</label>
        <input placeholder="e.g. Senior, Manager, Lead" value={exclude} onChange={e => setExclude(e.target.value)}
          style={{ width: "100%", border: "0.5px solid #fca5a5", borderRadius: 7, padding: "7px 12px", fontSize: 13, outline: "none", background: "#FEF2F2", color: "#1e293b" }} />
      </div>
    </div>
  );
}

function SavedSearchesPanel({ savedSearches, onLoad, onDelete, onSaveCurrent }) {
  const [name, setName] = useState("");
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Name this search to save it…"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ flex: 1, border: "0.5px solid #e2e8f0", borderRadius: 7, padding: "7px 12px", fontSize: 12, outline: "none", background: "#f8fafc", color: "#1e293b" }}
        />
        <button onClick={() => { onSaveCurrent(name); setName(""); }} disabled={!name.trim()} style={{
          background: name.trim() ? "#1a56db" : "#e2e8f0",
          color: name.trim() ? "#fff" : "#94a3b8",
          border: "none", borderRadius: 7, padding: "7px 16px",
          fontSize: 12, fontWeight: 700, cursor: name.trim() ? "pointer" : "default",
        }}>Save</button>
      </div>
      {savedSearches.length === 0
        ? <p style={{ color: "#94a3b8", fontSize: 13 }}>No saved searches yet. Run a search and save it.</p>
        : savedSearches.map(s => (
          <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 9, border: "0.5px solid #e2e8f0", marginBottom: 7 }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{new Date(s.createdAt).toLocaleDateString()}</p>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => onLoad(s)} style={{ background: "#EEF2FF", color: "#1a56db", border: "none", borderRadius: 7, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Load</button>
              <button onClick={() => onDelete(s._id)} style={{ background: "#FEF2F2", color: "#dc2626", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────────────────────────── */

const DEFAULT_FILTERS = {
  location: "", company: "", type: "", experience: "",
  minSalary: "", maxSalary: "", skills: "", sortBy: "date_posted",
};
const USER_ID = "demo_user_001";

export default function App() {
  const [mode, setMode]                 = useState("standard");
  const [query, setQuery]               = useState("");
  const [filters, setFilters]           = useState(DEFAULT_FILTERS);
  const [bMust, setBMust]               = useState("");
  const [bShould, setBShould]           = useState("");
  const [bNot, setBNot]                 = useState("");
  const [nlQuery, setNlQuery]           = useState("");
  const [parsedIntent, setParsedIntent] = useState(null);
  const [recentDays, setRecentDays]     = useState(7);
  const [skillsInput, setSkillsInput]   = useState("");
  const [matchPct, setMatchPct]         = useState(50);
  const [selLocs, setSelLocs]           = useState([]);
  const [exInclude, setExInclude]       = useState("");
  const [exExclude, setExExclude]       = useState("");
  const [savedSearches, setSavedSearches] = useState([]);
  const [jobs, setJobs]                 = useState([]);
  const [total, setTotal]               = useState(0);
  const [pages, setPages]               = useState(1);
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(false);
  const [selected, setSelected]         = useState(null);
  const [locations, setLocations]       = useState([]);
  const [companies, setCompanies]       = useState([]);
  const [highlightSkills, setHighlightSkills] = useState([]);
  const [suggestions, setSuggestions]   = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/meta/locations`).then(r => setLocations(r.data)).catch(() => {});
    axios.get(`${API}/meta/companies`).then(r => setCompanies(r.data)).catch(() => {});
    axios.get(`${API}/saved-searches/${USER_ID}`).then(r => setSavedSearches(r.data)).catch(() => {});
  }, []);

  // Autocomplete debounce
  useEffect(() => {
    if (mode !== "standard" || query.length < 2) { setSuggestions(null); return; }
    const t = setTimeout(() =>
      axios.get(`${API}/suggest`, { params: { q: query } })
        .then(r => setSuggestions(r.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  const search = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      let res;
      setHighlightSkills([]);
      setParsedIntent(null);

      if (mode === "standard") {
        const params = {
          page: p, limit: 12,
          sortBy: filters.sortBy, order: "desc",
          ...(query.trim()         && { query: query.trim() }),
          ...(filters.location     && { location: filters.location }),
          ...(filters.company      && { company: filters.company }),
          ...(filters.type         && { type: filters.type }),
          ...(filters.experience   && { experience: filters.experience.split(" ")[0] }),
          ...(filters.minSalary    && { minSalary: filters.minSalary }),
          ...(filters.maxSalary    && { maxSalary: filters.maxSalary }),
          ...(filters.skills       && { skills: filters.skills }),
        };
        res = await axios.get(`${API}/search`, { params });

      } else if (mode === "semantic") {
        res = await axios.post(`${API}/search/semantic`, { naturalQuery: nlQuery, page: p, limit: 12 });
        if (res.data.parsedIntent) {
          setParsedIntent(res.data.parsedIntent);
          setHighlightSkills(res.data.parsedIntent.skills || []);
        }

      } else if (mode === "boolean") {
        res = await axios.get(`${API}/search/boolean`, {
          params: {
            ...(bMust   && { must: bMust }),
            ...(bShould && { should: bShould }),
            ...(bNot    && { not: bNot }),
            page: p, limit: 12,
          },
        });

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
        res = await axios.get(`${API}/search/exclude`, {
          params: {
            ...(exInclude && { query: exInclude }),
            ...(exExclude && { excludeTerms: exExclude }),
            page: p, limit: 12,
          },
        });
      }

      if (res) {
        setJobs(res.data.jobs || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
        setPage(p);
        setSelected(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
      setJobs(res.data.jobs || []);
      setTotal(res.data.jobs?.length || 0);
      setPages(1); setPage(1); setSelected(null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveSearch = async (name) => {
    if (!name?.trim()) return;
    const params = mode === "standard"  ? { mode, query, filters }
      : mode === "boolean"  ? { mode, must: bMust, should: bShould, not: bNot }
      : mode === "skills"   ? { mode, skills: skillsInput, matchPercent: matchPct }
      : { mode };
    try {
      const res = await axios.post(`${API}/saved-searches`, { userId: USER_ID, name, params });
      setSavedSearches(prev => [res.data, ...prev]);
    } catch (e) { console.error(e); }
  };

  const handleLoadSaved = (s) => {
    const p = s.params;
    setMode(p.mode || "standard");
    if (p.query)        setQuery(p.query);
    if (p.filters)      setFilters(p.filters);
    if (p.must)         setBMust(p.must);
    if (p.should)       setBShould(p.should);
    if (p.not)          setBNot(p.not);
    if (p.skills)       setSkillsInput(p.skills);
    if (p.matchPercent) setMatchPct(p.matchPercent);
  };

  const handleDeleteSaved = async (id) => {
    try { await axios.delete(`${API}/saved-searches/${id}`); } catch {}
    setSavedSearches(prev => prev.filter(s => s._id !== id));
  };

  const currentMode = SEARCH_MODES.find(m => m.id === mode);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: "100vh", background: "#f8fafc" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={{ background: "#fff", borderBottom: "0.5px solid #e2e8f0", padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>JobSphere</span>
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>MongoDB Full-Text Search</span>
          </div>
        </div>
        <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "4px 10px", borderRadius: 99, border: "0.5px solid #e2e8f0" }}>{total} jobs found</span>
      </nav>

      {/* ── Hero + Tabs ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e2e8f0", padding: "24px 28px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Find your next role</h1>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>
            Search across thousands of listings using MongoDB full-text indexing with real-time relevance scoring
          </p>
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {SEARCH_MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                padding: "8px 15px", border: "none",
                background: mode === m.id ? "#fff" : "transparent",
                borderBottom: mode === m.id ? "2px solid #1a56db" : "2px solid transparent",
                color: mode === m.id ? "#1a56db" : "#64748b",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap", transition: "color 0.15s",
              }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Search input area ───────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e2e8f0", padding: "14px 28px", position: "sticky", top: 52, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            {mode === "standard"  && (
              <StandardSearch
                query={query} setQuery={setQuery}
                filters={filters} setFilters={setFilters}
                locations={locations} companies={companies}
                suggestions={suggestions} setSuggestions={setSuggestions}
                onPickSuggest={val => { setQuery(val); setSuggestions(null); search(1); }}
              />
            )}
            {mode === "semantic"  && <SemanticSearch value={nlQuery} onChange={setNlQuery} parsedIntent={parsedIntent} />}
            {mode === "boolean"   && <BooleanSearch must={bMust} setMust={setBMust} should={bShould} setShould={setBShould} not={bNot} setNot={setBNot} />}
            {mode === "recent"    && <RecentSearch days={recentDays} setDays={setRecentDays} />}
            {mode === "skills"    && <SkillsSearch skills={skillsInput} setSkills={setSkillsInput} matchPercent={matchPct} setMatchPercent={setMatchPct} />}
            {mode === "multi-loc" && <MultiLocSearch locs={selLocs} setLocs={setSelLocs} allLocations={locations} />}
            {mode === "exclude"   && <ExcludeSearch include={exInclude} setInclude={setExInclude} exclude={exExclude} setExclude={setExExclude} />}
            {mode === "saved"     && (
              <SavedSearchesPanel
                savedSearches={savedSearches}
                onLoad={handleLoadSaved}
                onDelete={handleDeleteSaved}
                onSaveCurrent={handleSaveSearch}
              />
            )}
          </div>
          {mode !== "saved" && (
            <button
              onClick={() => search(1)}
              style={{
                height: 38, padding: "0 20px", background: "#1a56db", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: "pointer", flexShrink: 0, alignSelf: "flex-start",
              }}
            >
              Search
            </button>
          )}
        </div>
      </div>

      {/* ── Save search bar ─────────────────────────────────────────────── */}
      {mode !== "saved" && jobs.length > 0 && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 28px 0" }}>
          <button
            onClick={() => {
              const name = prompt("Name for this saved search:");
              if (name) handleSaveSearch(name);
            }}
            style={{ background: "none", border: "0.5px dashed #cbd5e1", borderRadius: 7, padding: "4px 13px", fontSize: 11, color: "#64748b", fontWeight: 600, cursor: "pointer" }}
          >
            🔖 Save this search
          </button>
        </div>
      )}

      {/* ── Main body ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 28px", display: "grid", gridTemplateColumns: mode === "saved" ? "1fr" : "1fr 360px", gap: 18 }}>

        {mode === "saved" ? (
          <SavedSearchesPanel
            savedSearches={savedSearches}
            onLoad={handleLoadSaved}
            onDelete={handleDeleteSaved}
            onSaveCurrent={handleSaveSearch}
          />
        ) : (
          <>
            {/* Results column */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                  {loading ? "Searching…" : `${total} result${total !== 1 ? "s" : ""}`}
                  {mode !== "standard" && (
                    <span style={{ background: "#EEF2FF", color: "#1a56db", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                      {currentMode?.icon} {currentMode?.label}
                    </span>
                  )}
                </p>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "0.5px solid #f1f5f9" }}>
                      <div style={{ height: 13, background: "#f1f5f9", borderRadius: 5, width: "55%", marginBottom: 7, animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ height: 11, background: "#f1f5f9", borderRadius: 5, width: "38%", marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ height: 11, background: "#f1f5f9", borderRadius: 5, width: "90%", marginBottom: 5, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "44px 24px", textAlign: "center", color: "#94a3b8" }}>
                  <p style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 600, color: "#475569" }}>No jobs found</p>
                  <p style={{ margin: 0, fontSize: 13 }}>Try adjusting your search criteria</p>
                </div>
              ) : (
                <>
                  {jobs.map(job => (
                    <JobCard
                      key={job._id}
                      job={job}
                      onClick={j => setSelected(j)}
                      selected={selected?._id === job._id}
                      highlightSkills={highlightSkills}
                    />
                  ))}
                  {pages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 18 }}>
                      {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => search(p)} style={{
                          width: 32, height: 32, borderRadius: 7,
                          border: p === page ? "none" : "0.5px solid #e2e8f0",
                          background: p === page ? "#1a56db" : "#fff",
                          color: p === page ? "#fff" : "#475569",
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>{p}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail pane */}
            <div style={{
              background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 14,
              overflow: "hidden", position: "sticky", top: 110,
              height: "calc(100vh - 130px)", maxHeight: 780,
            }}>
              <DetailPane
                job={selected}
                onClose={() => setSelected(null)}
                onFindSimilar={handleFindSimilar}
              />
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        select:focus, input:focus, textarea:focus {
          box-shadow: 0 0 0 2px rgba(26,86,219,0.15);
          border-color: #1a56db !important;
          outline: none;
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}