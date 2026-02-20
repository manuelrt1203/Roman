import { useState, useEffect, useRef, useCallback } from "react";
import * as mammoth from "mammoth";

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  parchemin: {
    name: "Parchemin",
    emoji: "📜",
    vars: {
      "--ink": "#1a1209", "--paper": "#f5f0e8", "--paper2": "#ede7d6",
      "--sepia": "#8b6914", "--gold": "#c9962a", "--accent": "#8b3a1c",
      "--muted": "#6b5c3e", "--border": "#d4c4a0", "--shadow": "rgba(26,18,9,0.18)",
      "--ai": "#1e3a2f", "--ai-light": "#e8f2ed", "--ai-text": "#1a2e22",
      "--header-bg": "#1a1209", "--header-text": "#f5f0e8",
      "--tab-bg": "#1a1209", "--input-bg": "#ede7d6",
    }
  },
  nuit: {
    name: "Nuit de l'Écrivain",
    emoji: "🌙",
    vars: {
      "--ink": "#e8dfc8", "--paper": "#12100e", "--paper2": "#1c1916",
      "--sepia": "#d4a853", "--gold": "#e8c070", "--accent": "#c0504a",
      "--muted": "#8a7d65", "--border": "#2e2920", "--shadow": "rgba(0,0,0,0.5)",
      "--ai": "#1a3028", "--ai-light": "#111e18", "--ai-text": "#9dcfb0",
      "--header-bg": "#0a0908", "--header-text": "#e8dfc8",
      "--tab-bg": "#0a0908", "--input-bg": "#1c1916",
    }
  },
  manuscrit: {
    name: "Manuscrit",
    emoji: "📖",
    vars: {
      "--ink": "#2c2416", "--paper": "#fdfaf5", "--paper2": "#f4f0e8",
      "--sepia": "#5c4a2a", "--gold": "#a07840", "--accent": "#6b3020",
      "--muted": "#7a6d58", "--border": "#e0d8c8", "--shadow": "rgba(44,36,22,0.12)",
      "--ai": "#1c3040", "--ai-light": "#eef4f8", "--ai-text": "#1c3040",
      "--header-bg": "#2c2416", "--header-text": "#fdfaf5",
      "--tab-bg": "#2c2416", "--input-bg": "#f4f0e8",
    }
  },
  foret: {
    name: "Forêt Mystique",
    emoji: "🌿",
    vars: {
      "--ink": "#e8f0e0", "--paper": "#0e1a12", "--paper2": "#152019",
      "--sepia": "#7ab870", "--gold": "#a0d898", "--accent": "#d4a060",
      "--muted": "#608860", "--border": "#1e3020", "--shadow": "rgba(0,0,0,0.45)",
      "--ai": "#0a1e28", "--ai-light": "#0e1e18", "--ai-text": "#88c8b0",
      "--header-bg": "#080e0a", "--header-text": "#e8f0e0",
      "--tab-bg": "#080e0a", "--input-bg": "#152019",
    }
  }
};

const FONT_PAIRS = [
  { id: "classique", name: "Classique", display: "Playfair Display", body: "Lora", google: "Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400" },
  { id: "garamond", name: "Garamond", display: "Cormorant Garamond", body: "EB Garamond", google: "Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400" },
  { id: "baskerville", name: "Baskerville", display: "Libre Baskerville", body: "Crimson Text", google: "Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400" },
  { id: "moderne", name: "Moderne", display: "DM Serif Display", body: "DM Serif Text", google: "DM+Serif+Display:ital@0;1&family=DM+Serif+Text:ital@0;1" },
  { id: "spectral", name: "Spectral", display: "Abril Fatface", body: "Spectral", google: "Abril+Fatface&family=Spectral:ital,wght@0,400;0,500;1,400" },
];

// ─── Claude API ───────────────────────────────────────────────────────────────
async function callClaude(messages, system = "Tu es un assistant créatif spécialisé dans l'aide à l'écriture de romans. Réponds toujours en français.") {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  const d = await r.json();
  return d.content?.[0]?.text || "Erreur : réponse vide.";
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = "roman-v2";
const load = () => { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = (d) => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} };

const defaultData = {
  novel: { title: "", genre: "", synopsis: "", cover: null },
  characters: [],
  arcs: { exposition: "", incitingIncident: "", risingAction: "", climax: "", fallingAction: "", resolution: "" },
  chapters: [],
  playlist: [],
  appearance: { theme: "parchemin", fontId: "classique", writingMode: "normal", fontSize: 16 },
  worldbuilding: { locations: [], factions: [], timelineEvents: [], glossary: [], freeNotes: "" },
  goals: { dailyTarget: 500, wordGoal: 80000, sessions: [] },
};

// ─── Global Styles ────────────────────────────────────────────────────────────
function GlobalStyle({ fontPair, theme }) {
  const vars = Object.entries(THEMES[theme]?.vars || THEMES.parchemin.vars)
    .map(([k, v]) => `${k}: ${v};`).join("\n");
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=${fontPair.google}&family=Source+Code+Pro:wght@400;500&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :root { ${vars} }
      body { background: var(--paper); font-family: '${fontPair.body}', Georgia, serif; color: var(--ink); transition: background 0.3s, color 0.3s; }

      .app { min-height: 100vh; display: flex; flex-direction: column; background: var(--paper); }
      .app.nuit, .app.foret { background-image: url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"); }
      .app.parchemin, .app.manuscrit { background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(139,105,20,0.06) 28px); }

      .header { background: var(--header-bg); color: var(--header-text); padding: 14px 28px; display: flex; align-items: center; gap: 14px; border-bottom: 3px solid var(--gold); position: sticky; top: 0; z-index: 200; }
      .header-cover { width: 38px; height: 52px; object-fit: cover; border-radius: 2px; box-shadow: 2px 2px 8px rgba(0,0,0,0.4); flex-shrink: 0; border: 1px solid var(--gold); }
      .header-cover-placeholder { width: 38px; height: 52px; background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.25); border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
      .header-title { font-family: '${fontPair.display}', serif; font-size: 1.5rem; letter-spacing: 0.03em; }
      .header-subtitle { font-size: 0.72rem; color: rgba(255,255,255,0.45); font-style: italic; margin-top: 2px; }

      .tabs { background: var(--tab-bg); display: flex; gap: 1px; padding: 0 28px; border-bottom: 2px solid var(--gold); overflow-x: auto; scrollbar-width: none; }
      .tabs::-webkit-scrollbar { display: none; }
      .tab { padding: 10px 16px; font-family: '${fontPair.display}', serif; font-size: 0.78rem; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); cursor: pointer; border: none; border-bottom: 3px solid transparent; transition: all 0.2s; background: none; white-space: nowrap; text-transform: uppercase; }
      .tab:hover { color: rgba(255,255,255,0.75); }
      .tab.active { color: var(--gold); border-bottom-color: var(--gold); }

      .content { flex: 1; padding: 24px 28px; max-width: 1140px; margin: 0 auto; width: 100%; }

      /* Cards */
      .card { background: var(--paper); border: 1px solid var(--border); border-radius: 4px; padding: 18px 22px; box-shadow: 0 2px 10px var(--shadow); margin-bottom: 14px; transition: background 0.3s, border 0.3s; }
      .card-title { font-family: '${fontPair.display}', serif; font-size: 1rem; color: var(--sepia); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

      /* Forms */
      input, textarea, select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 3px; background: var(--input-bg); font-family: '${fontPair.body}', serif; font-size: 0.9rem; color: var(--ink); transition: border 0.2s, background 0.3s; }
      input:focus, textarea:focus, select:focus { outline: none; border-color: var(--gold); }
      label { font-size: 0.78rem; color: var(--muted); margin-bottom: 4px; display: block; font-style: italic; }

      /* Buttons */
      .btn { padding: 8px 16px; border-radius: 3px; font-family: '${fontPair.body}', serif; font-size: 0.85rem; cursor: pointer; transition: all 0.18s; border: none; }
      .btn-primary { background: var(--sepia); color: var(--paper); }
      .btn-primary:hover { background: var(--gold); }
      .btn-danger { background: var(--accent); color: #fff; }
      .btn-danger:hover { opacity: 0.85; }
      .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--muted); }
      .btn-outline:hover { border-color: var(--sepia); color: var(--sepia); }
      .btn-ai { background: var(--ai); color: var(--ai-text); display: flex; align-items: center; gap: 6px; }
      .btn-ai:hover { opacity: 0.85; }
      .btn-ai:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn-sm { padding: 4px 10px; font-size: 0.78rem; }
      .btn-ghost { background: transparent; border: 1px dashed var(--border); color: var(--muted); }
      .btn-ghost:hover { border-color: var(--gold); color: var(--gold); }

      /* Layout helpers */
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
      .flex { display: flex; }
      .flex-between { display: flex; justify-content: space-between; align-items: center; }
      .flex-end { display: flex; justify-content: flex-end; gap: 8px; }
      .flex-center { display: flex; justify-content: center; align-items: center; }
      .gap-8 { gap: 8px; }
      .gap-12 { gap: 12px; }
      .mt-8 { margin-top: 8px; }
      .mt-12 { margin-top: 12px; }
      .mt-16 { margin-top: 16px; }
      .field { margin-bottom: 12px; }

      /* Tags */
      .tag { display: inline-block; padding: 2px 9px; border-radius: 12px; font-size: 0.7rem; font-style: italic; }
      .tag-draft { background: rgba(139,105,20,0.15); color: var(--muted); }
      .tag-writing { background: rgba(201,150,42,0.2); color: var(--gold); }
      .tag-done { background: rgba(80,160,100,0.2); color: #50a064; }

      /* Chapter items */
      .chapter-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: 3px; background: var(--paper2); margin-bottom: 7px; cursor: pointer; transition: all 0.15s; }
      .chapter-item:hover { border-color: var(--gold); }
      .chapter-item.selected { border-color: var(--sepia); }
      .chapter-num { font-family: '${fontPair.display}', serif; font-size: 1rem; color: var(--gold); min-width: 24px; }
      .chapter-info { flex: 1; min-width: 0; }
      .chapter-name { font-weight: 500; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chapter-meta { font-size: 0.72rem; color: var(--muted); font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* Char cards */
      .char-card { border: 1px solid var(--border); border-radius: 4px; padding: 12px 16px; background: var(--paper2); margin-bottom: 10px; transition: background 0.3s; }
      .char-name { font-family: '${fontPair.display}', serif; font-size: 1rem; color: var(--ink); }
      .char-role { font-size: 0.72rem; color: var(--sepia); font-style: italic; margin-bottom: 5px; }
      .char-desc { font-size: 0.8rem; color: var(--muted); line-height: 1.5; }

      /* AI output */
      .ai-output { background: var(--ai-light); border: 1px solid rgba(168,213,184,0.3); border-left: 4px solid var(--ai); border-radius: 3px; padding: 14px 16px; font-size: 0.88rem; line-height: 1.8; color: var(--ai-text); white-space: pre-wrap; font-family: '${fontPair.body}', serif; margin-top: 12px; }
      .ai-thinking { display: flex; align-items: center; gap: 10px; color: var(--sepia); font-style: italic; font-size: 0.82rem; margin-top: 8px; }
      .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--gold); border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Arc steps */
      .arc-step { display: flex; gap: 12px; padding: 9px 12px; border-left: 3px solid var(--border); margin-bottom: 8px; background: var(--paper2); border-radius: 0 3px 3px 0; transition: background 0.3s; }
      .arc-step.filled { border-left-color: var(--gold); }
      .arc-label { min-width: 140px; font-size: 0.78rem; color: var(--muted); font-style: italic; padding-top: 5px; }

      /* Progress */
      .progress-bar { height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top: 5px; }
      .progress-fill { height: 100%; background: var(--gold); border-radius: 3px; transition: width 0.4s; }

      .divider { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
      .empty { text-align: center; color: var(--muted); font-style: italic; padding: 28px; }
      .scrollable { max-height: 420px; overflow-y: auto; padding-right: 3px; }
      .scrollable::-webkit-scrollbar { width: 5px; }
      .scrollable::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

      .section-header { font-family: '${fontPair.display}', serif; font-size: 1.35rem; color: var(--ink); margin-bottom: 18px; padding-bottom: 9px; border-bottom: 2px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
      .ta-sm { height: 75px; resize: vertical; }
      .ta-md { height: 120px; resize: vertical; }
      .ta-xl { resize: vertical; }

      /* Cover */
      .cover-upload-zone { width: 140px; height: 196px; border: 2px dashed var(--border); border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: var(--muted); font-size: 0.75rem; text-align: center; gap: 8px; flex-shrink: 0; }
      .cover-upload-zone:hover { border-color: var(--gold); color: var(--gold); }
      .cover-img { width: 140px; height: 196px; object-fit: cover; border-radius: 4px; box-shadow: 3px 3px 16px var(--shadow); border: 1px solid var(--border); flex-shrink: 0; }

      /* Playlist */
      .playlist-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: 3px; background: var(--paper2); margin-bottom: 7px; transition: background 0.2s; }
      .playlist-item:hover { border-color: var(--gold); }
      .playlist-item.playing { border-color: var(--sepia); background: var(--paper); }
      .playlist-thumb { width: 56px; height: 40px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
      .playlist-thumb-ph { width: 56px; height: 40px; background: var(--border); border-radius: 2px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
      .playlist-title { flex: 1; font-size: 0.88rem; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .playlist-artist { font-size: 0.72rem; color: var(--muted); font-style: italic; }
      .yt-player { width: 100%; aspect-ratio: 16/9; border-radius: 4px; border: 1px solid var(--border); }

      /* Writing modes */
      .writing-focused { position: fixed; inset: 0; z-index: 300; background: var(--paper); display: flex; flex-direction: column; }
      .writing-focused .writing-inner { flex: 1; overflow-y: auto; padding: 48px; max-width: 700px; margin: 0 auto; width: 100%; }
      .writing-focused textarea { background: transparent; border: none; box-shadow: none; font-size: var(--fs); line-height: 1.9; height: 100%; min-height: 70vh; color: var(--ink); resize: none; width: 100%; }
      .writing-focused textarea:focus { outline: none; border: none; }
      .focused-header { padding: 12px 28px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--paper); font-family: '${fontPair.display}', serif; }
      .focused-wc { font-size: 0.75rem; color: var(--muted); font-style: italic; }

      /* Appearance */
      .theme-card { border: 2px solid var(--border); border-radius: 6px; padding: 14px; cursor: pointer; transition: all 0.2s; text-align: center; }
      .theme-card:hover { border-color: var(--sepia); }
      .theme-card.selected { border-color: var(--gold); }
      .font-card { border: 2px solid var(--border); border-radius: 4px; padding: 12px 16px; cursor: pointer; transition: all 0.2s; }
      .font-card:hover { border-color: var(--sepia); }
      .font-card.selected { border-color: var(--gold); }
      .font-sample { font-size: 1.3rem; line-height: 1.4; margin-bottom: 4px; }
      .font-name { font-size: 0.72rem; color: var(--muted); }

      /* Upload zone */
      .upload-zone { border: 2px dashed var(--border); border-radius: 6px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; color: var(--muted); }
      .upload-zone:hover, .upload-zone.drag { border-color: var(--gold); color: var(--gold); background: rgba(201,150,42,0.04); }
      .upload-zone-icon { font-size: 2rem; margin-bottom: 8px; }

      @media(max-width:700px) {
        .grid-2, .grid-3 { grid-template-columns: 1fr; }
        .content { padding: 14px; }
        .arc-label { min-width: 90px; }
      }
    `}</style>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wc(text) { return (text || "").split(/\s+/).filter(Boolean).length; }
function ytId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (url.length === 11 ? url : null);
}

// ─── TAB: Projet ──────────────────────────────────────────────────────────────
function TabProjet({ data, setData }) {
  const [novel, setNovel] = useState(data.novel);
  const [synIdea, setSynIdea] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [loading, setLoading] = useState(false);
  const coverRef = useRef();

  useEffect(() => setNovel(data.novel), [data.novel]);

  function saveNovel() { setData(d => ({ ...d, novel })); }

  function onCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const cover = ev.target.result;
      setNovel(n => ({ ...n, cover }));
      setData(d => ({ ...d, novel: { ...d.novel, cover } }));
    };
    reader.readAsDataURL(file);
  }

  async function genSynopsis() {
    setLoading(true); setAiOut("");
    try {
      const txt = await callClaude([{ role: "user", content: `Genre : ${novel.genre || "non précisé"}\nIdée : ${synIdea || "à toi de proposer"}\n\nGénère un synopsis accrocheur (4-6 phrases).` }]);
      setAiOut(txt);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="section-header"><span>✦ Mon Roman</span></div>
      <div className="card">
        <div style={{ display: "flex", gap: "22px", alignItems: "flex-start" }}>
          <div>
            <div className="cover-upload-zone" onClick={() => coverRef.current.click()} style={novel.cover ? { display: "none" } : {}}>
              <span style={{ fontSize: "2rem" }}>📚</span>
              <span>Couverture</span>
              <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>JPG, PNG, WEBP</span>
            </div>
            {novel.cover && (
              <div style={{ position: "relative" }}>
                <img src={novel.cover} className="cover-img" alt="Couverture" />
                <button className="btn btn-sm btn-danger" style={{ position: "absolute", top: 4, right: 4, padding: "2px 6px" }}
                  onClick={() => { setNovel(n => ({ ...n, cover: null })); setData(d => ({ ...d, novel: { ...d.novel, cover: null } })); }}>✕</button>
              </div>
            )}
            <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onCoverChange} />
            {!novel.cover && <button className="btn btn-sm btn-ghost" style={{ width: 140, marginTop: 6, fontSize: "0.7rem" }} onClick={() => coverRef.current.click()}>+ Ajouter couverture</button>}
          </div>
          <div style={{ flex: 1 }}>
            <div className="grid-2">
              <div className="field"><label>Titre du roman</label><input value={novel.title} onChange={e => setNovel(n => ({ ...n, title: e.target.value }))} placeholder="Les Ombres de Velours…" /></div>
              <div className="field"><label>Genre</label>
                <select value={novel.genre} onChange={e => setNovel(n => ({ ...n, genre: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {["Roman contemporain","Fantasy","Science-fiction","Thriller","Romance","Historique","Horreur","Policier","Littérature blanche","Autre"].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Synopsis</label><textarea className="ta-md" value={novel.synopsis} onChange={e => setNovel(n => ({ ...n, synopsis: e.target.value }))} placeholder="Résumé de votre histoire…" /></div>
            <div className="flex-end"><button className="btn btn-primary" onClick={saveNovel}>Sauvegarder</button></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">✦ Générer un synopsis avec l'IA</div>
        <div className="field"><label>Votre idée de départ</label><textarea className="ta-sm" value={synIdea} onChange={e => setSynIdea(e.target.value)} placeholder="Un détective qui découvre qu'il est lui-même suspect…" /></div>
        <button className="btn btn-ai" onClick={genSynopsis} disabled={loading}><span>✦</span>{loading ? "Génération…" : "Générer un synopsis"}</button>
        {loading && <div className="ai-thinking"><div className="spinner" />L'IA écrit…</div>}
        {aiOut && <div className="ai-output">{aiOut}
          <div className="flex-end mt-8">
            <button className="btn btn-sm btn-outline" onClick={() => { setNovel(n => ({ ...n, synopsis: aiOut })); setData(d => ({ ...d, novel: { ...d.novel, synopsis: aiOut } })); setAiOut(""); }}>← Utiliser</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ─── TAB: Personnages ─────────────────────────────────────────────────────────
function TabPersonnages({ data, setData }) {
  const [form, setForm] = useState({ name: "", role: "", age: "", description: "", traits: "", arc: "" });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState("");
  const [detected, setDetected] = useState(null); // pending preview: [{name,role,age,description,traits,arc,_selected}]
  const [aiOut, setAiOut] = useState("");
  const [genName, setGenName] = useState("");

  function save() {
    if (!form.name.trim()) return;
    if (editing !== null) {
      setData(d => ({ ...d, characters: d.characters.map((c, i) => i === editing ? form : c) }));
      setEditing(null);
    } else {
      setData(d => ({ ...d, characters: [...d.characters, { ...form, id: Date.now() }] }));
    }
    setForm({ name: "", role: "", age: "", description: "", traits: "", arc: "" });
  }

  async function genChar() {
    setLoading(true); setAiOut("");
    try {
      const txt = await callClaude([{ role: "user", content: `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}).\nCrée une fiche complète pour : "${genName||'un personnage secondaire'}". Inclus rôle, âge, description physique, traits, arc narratif.` }]);
      setAiOut(txt);
    } finally { setLoading(false); }
  }

  // ── Auto-detect characters from chapter texts ──
  async function detectFromChapters() {
    const allText = data.chapters.map((c, i) => `=== Chapitre ${i+1} : ${c.title} ===\n${c.content || c.summary || ""}`).join("\n\n");
    if (!allText.trim()) {
      setDetectStatus("⚠ Aucun texte trouvé dans vos chapitres. Écrivez ou importez du contenu d'abord."); return;
    }
    setDetecting(true); setDetectStatus("L'IA lit vos chapitres et identifie les personnages…"); setDetected(null);

    // Existing character names to avoid duplicates
    const existing = data.characters.map(c => c.name.toLowerCase());

    // Send up to 7000 chars of chapter text
    const excerpt = allText.slice(0, 7000);

    try {
      const aiRes = await callClaude([{ role: "user", content:
        `Voici des extraits du roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}) :\n\n"""\n${excerpt}\n"""\n\n` +
        `Analyse attentivement ce texte et identifie TOUS les personnages mentionnés ou présents, même brièvement.\n` +
        `Pour chaque personnage, déduis à partir du texte uniquement : nom, rôle narratif, âge (si mentionné), description physique ou sociale, traits de caractère observés, évolution/arc narratif apparent.\n` +
        (existing.length ? `Personnages déjà enregistrés à ignorer : ${existing.join(", ")}\n` : "") +
        `\nRéponds UNIQUEMENT en JSON valide sans markdown, tableau de personnages :\n` +
        `[{"name":"...","role":"Protagoniste|Antagoniste|Personnage secondaire|Mentor|Faire-valoir|Soutien","age":"...","description":"...","traits":"...","arc":"..."}]`
      }], "Tu es un analyste littéraire expert. Tu extrais des fiches de personnages précises à partir de textes de roman. Réponds uniquement en JSON valide, sans balises markdown ni commentaire.");

      let chars = [];
      try {
        const clean = aiRes.replace(/```json|```/g, "").trim();
        chars = JSON.parse(clean);
        if (!Array.isArray(chars)) chars = [];
      } catch { setDetectStatus("L'IA n'a pas pu analyser le texte. Réessayez."); setDetecting(false); return; }

      // Filter out already existing
      chars = chars.filter(c => !existing.includes(c.name?.toLowerCase()));

      if (chars.length === 0) {
        setDetectStatus("✓ Aucun nouveau personnage trouvé (tous déjà enregistrés ou texte insuffisant).");
        setDetecting(false); return;
      }

      // Add _selected flag for preview
      setDetected(chars.map(c => ({ ...c, _selected: true })));
      setDetectStatus("");
    } catch (err) {
      console.error(err); setDetectStatus("Erreur lors de la détection.");
    } finally { setDetecting(false); }
  }

  function confirmDetected() {
    const toAdd = detected.filter(c => c._selected).map(({ _selected, ...c }) => ({ ...c, id: Date.now() + Math.random() }));
    setData(d => ({ ...d, characters: [...d.characters, ...toAdd] }));
    setDetected(null);
  }

  const hasChapterText = data.chapters.some(c => c.content?.trim().length > 50);

  return (
    <div>
      <div className="section-header">
        <span>✦ Personnages</span>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.82rem", color:"var(--muted)", fontStyle:"italic" }}>{data.characters.length} personnage{data.characters.length!==1?"s":""}</span>
          {hasChapterText && (
            <button className="btn btn-sm btn-ai" onClick={detectFromChapters} disabled={detecting}
              title="L'IA lit vos chapitres et crée automatiquement les fiches personnages">
              <span>🔍</span>{detecting ? "Analyse…" : "Détecter depuis mes chapitres"}
            </button>
          )}
        </div>
      </div>

      {/* Detection status */}
      {detectStatus && (
        <div style={{ padding:"10px 14px", background:"var(--ai-light)", border:"1px solid var(--border)", borderLeft:"4px solid var(--ai)", borderRadius:3, marginBottom:14, fontSize:"0.82rem", color:"var(--ai-text)", display:"flex", alignItems:"center", gap:10 }}>
          {detecting && <div className="spinner"/>}{detectStatus}
        </div>
      )}

      {/* Detected characters preview */}
      {detected && (
        <div className="card" style={{ borderColor:"var(--gold)", marginBottom:18 }}>
          <div className="card-title" style={{ fontSize:"1.05rem" }}>
            🔍 {detected.length} personnage{detected.length>1?"s":""} détecté{detected.length>1?"s":""} dans vos chapitres
          </div>
          <p style={{ fontSize:"0.78rem", color:"var(--muted)", fontStyle:"italic", marginBottom:14 }}>
            Cochez ceux que vous souhaitez ajouter. Vous pourrez les modifier après l'import.
          </p>
          <div style={{ maxHeight:380, overflowY:"auto", marginBottom:14 }}>
            {detected.map((c, i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"10px 14px", border:`1px solid ${c._selected?"var(--gold)":"var(--border)"}`, borderRadius:4, marginBottom:8, background:"var(--paper2)", transition:"border 0.2s", cursor:"pointer" }}
                onClick={() => setDetected(d => d.map((x,j) => j===i ? {...x,_selected:!x._selected} : x))}>
                <div style={{ paddingTop:2 }}>
                  <div style={{ width:18, height:18, border:`2px solid ${c._selected?"var(--gold)":"var(--border)"}`, borderRadius:3, background:c._selected?"var(--gold)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}>
                    {c._selected && <span style={{ color:"var(--paper)", fontSize:"0.7rem", lineHeight:1 }}>✓</span>}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                    <input value={c.name} onClick={e=>e.stopPropagation()}
                      onChange={e => setDetected(d => d.map((x,j) => j===i ? {...x,name:e.target.value} : x))}
                      style={{ fontFamily:"var(--display-font,serif)", fontSize:"1rem", fontWeight:"bold", border:"none", background:"transparent", padding:0, width:"auto", flex:1, minWidth:120 }} />
                    {c.role && <span className="tag tag-draft">{c.role}</span>}
                    {c.age && <span style={{ fontSize:"0.72rem", color:"var(--muted)" }}>{c.age}</span>}
                  </div>
                  {c.description && <div style={{ fontSize:"0.8rem", color:"var(--muted)", marginBottom:3 }}>{c.description}</div>}
                  {c.traits && <div style={{ fontSize:"0.78rem", color:"var(--sepia)", fontStyle:"italic", marginBottom:3 }}>Traits : {c.traits}</div>}
                  {c.arc && <div style={{ fontSize:"0.78rem", fontStyle:"italic", color:"var(--muted)" }}>Arc : {c.arc}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex-end">
            <button className="btn btn-outline" onClick={() => setDetected(null)}>Annuler</button>
            <button className="btn btn-outline btn-sm" onClick={() => setDetected(d => d.map(x => ({...x,_selected:true})))}>Tout sélectionner</button>
            <button className="btn btn-primary" onClick={confirmDetected}
              disabled={!detected.some(c=>c._selected)}>
              ✓ Ajouter {detected.filter(c=>c._selected).length} personnage{detected.filter(c=>c._selected).length>1?"s":""}
            </button>
          </div>
        </div>
      )}

      {!hasChapterText && data.characters.length === 0 && (
        <div style={{ padding:"12px 16px", background:"var(--paper2)", border:"1px dashed var(--border)", borderRadius:4, marginBottom:14, fontSize:"0.82rem", color:"var(--muted)", fontStyle:"italic" }}>
          💡 Astuce : une fois que vous aurez écrit ou importé du texte dans vos chapitres, l'IA pourra détecter et créer automatiquement les fiches de vos personnages.
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-title">{editing !== null ? "✦ Modifier" : "✦ Nouveau personnage"}</div>
          <div className="field"><label>Nom *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Élise Moreau…" /></div>
          <div className="grid-2">
            <div className="field"><label>Rôle</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="">—</option>
                {["Protagoniste","Antagoniste","Personnage secondaire","Mentor","Faire-valoir","Soutien"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field"><label>Âge</label><input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="34 ans" /></div>
          </div>
          <div className="field"><label>Description</label><textarea className="ta-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Apparence, origine…" /></div>
          <div className="field"><label>Traits</label><input value={form.traits} onChange={e => setForm(f => ({ ...f, traits: e.target.value }))} placeholder="Impulsif, loyal…" /></div>
          <div className="field"><label>Arc narratif</label><textarea className="ta-sm" value={form.arc} onChange={e => setForm(f => ({ ...f, arc: e.target.value }))} placeholder="Évolution du personnage…" /></div>
          <div className="flex-end">
            {editing !== null && <button className="btn btn-outline" onClick={() => { setEditing(null); setForm({ name:"",role:"",age:"",description:"",traits:"",arc:"" }); }}>Annuler</button>}
            <button className="btn btn-primary" onClick={save}>{editing !== null ? "Mettre à jour" : "Ajouter"}</button>
          </div>
          <hr className="divider" />
          <div className="card-title">✦ Créer avec l'IA</div>
          <div className="field"><label>Quel personnage ?</label><input value={genName} onChange={e => setGenName(e.target.value)} placeholder="Un vieux libraire aux secrets inavouables…" /></div>
          <button className="btn btn-ai" onClick={genChar} disabled={loading}><span>✦</span>{loading ? "Génération…" : "Générer"}</button>
          {loading && <div className="ai-thinking"><div className="spinner" />L'IA imagine…</div>}
          {aiOut && <div className="ai-output" style={{ fontSize: "0.8rem" }}>{aiOut}</div>}
        </div>

        <div>
          {data.characters.length === 0
            ? <div className="empty">Aucun personnage encore.<br />{hasChapterText ? <>Cliquez <strong>« Détecter depuis mes chapitres »</strong> pour que l'IA les trouve automatiquement.</> : "Créez-en un à gauche."}</div>
            : data.characters.map((c, i) => (
              <div className="char-card" key={c.id || i}>
                <div className="flex-between">
                  <div><div className="char-name">{c.name}</div>{c.role && <div className="char-role">{c.role}{c.age ? ` · ${c.age}` : ""}</div>}</div>
                  <div className="flex gap-8">
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditing(i); setForm(c); }}>✏</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setData(d => ({ ...d, characters: d.characters.filter((_, j) => j !== i) }))}>✕</button>
                  </div>
                </div>
                {c.description && <div className="char-desc mt-8">{c.description}</div>}
                {c.traits && <div className="char-desc" style={{ color:"var(--sepia)", marginTop:4 }}>Traits : {c.traits}</div>}
                {c.arc && <div className="char-desc" style={{ fontStyle:"italic", marginTop:4 }}>Arc : {c.arc}</div>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Structure ───────────────────────────────────────────────────────────
function TabStructure({ data, setData }) {
  const [arcs, setArcs] = useState(data.arcs);
  const [loading, setLoading] = useState(false);
  const [aiOut, setAiOut] = useState("");
  useEffect(() => setArcs(data.arcs), [data.arcs]);

  const steps = [
    { key: "exposition", label: "1 · Exposition" },
    { key: "incitingIncident", label: "2 · Élément déclencheur" },
    { key: "risingAction", label: "3 · Montée de l'action" },
    { key: "climax", label: "4 · Climax" },
    { key: "fallingAction", label: "5 · Retombée" },
    { key: "resolution", label: "6 · Résolution" },
  ];
  const filled = steps.filter(s => arcs[s.key]?.trim()).length;

  async function genStructure() {
    setLoading(true); setAiOut("");
    try {
      const chars = data.characters.map(c => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
      const txt = await callClaude([{ role: "user", content: `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'})\nSynopsis : ${data.novel.synopsis||'non fourni'}\nPersonnages : ${chars||'non définis'}\n\nPropose une structure narrative en 6 actes détaillés.` }]);
      setAiOut(txt);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="section-header"><span>✦ Structure Narrative</span><span style={{ fontSize: "0.82rem", color: "var(--muted)", fontStyle: "italic" }}>{filled}/{steps.length} actes</span></div>
      <div className="progress-bar" style={{ marginBottom: "18px" }}><div className="progress-fill" style={{ width: `${filled/steps.length*100}%` }} /></div>
      <div className="card">
        {steps.map(s => (
          <div key={s.key} className={`arc-step ${arcs[s.key]?.trim() ? "filled" : ""}`}>
            <div className="arc-label">{s.label}</div>
            <textarea className="ta-sm" style={{ flex: 1, height: 58 }} value={arcs[s.key]} onChange={e => setArcs(a => ({ ...a, [s.key]: e.target.value }))} placeholder={`Décrivez ${s.label.toLowerCase()}…`} />
          </div>
        ))}
        <div className="flex-end mt-12"><button className="btn btn-primary" onClick={() => setData(d => ({ ...d, arcs }))}>Sauvegarder</button></div>
      </div>
      <div className="card">
        <div className="card-title">✦ Générer avec l'IA</div>
        <button className="btn btn-ai" onClick={genStructure} disabled={loading}><span>✦</span>{loading ? "Génération…" : "Générer la structure"}</button>
        {loading && <div className="ai-thinking"><div className="spinner" />L'IA structure votre récit…</div>}
        {aiOut && <div className="ai-output">{aiOut}</div>}
      </div>
    </div>
  );
}

// ─── TAB: Chapitres ───────────────────────────────────────────────────────────
function TabChapitres({ data, setData, appearance }) {
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [chForm, setChForm] = useState({ title: "", summary: "", status: "Brouillon" });
  const [prompt, setPrompt] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiMode, setAiMode] = useState("write"); // "write" | "continue" | "surprise"
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [importPreview, setImportPreview] = useState(null); // { chapters: [...] } pending confirmation
  const fileRef = useRef();
  const bulkRef = useRef();

  const statuses = ["Brouillon", "En cours", "Terminé"];
  const stag = { "Brouillon": "tag-draft", "En cours": "tag-writing", "Terminé": "tag-done" };

  function addCh() {
    if (!chForm.title.trim()) return;
    setData(d => ({ ...d, chapters: [...d.chapters, { ...chForm, id: Date.now(), content: "" }] }));
    setChForm({ title: "", summary: "", status: "Brouillon" });
    setShowForm(false);
  }

  function updateStatus(i, status) { setData(d => ({ ...d, chapters: d.chapters.map((c, j) => j === i ? { ...c, status } : c) })); }
  function saveContent(i, content) { setData(d => ({ ...d, chapters: d.chapters.map((c, j) => j === i ? { ...c, content } : c) })); }
  function delCh(i) { setData(d => ({ ...d, chapters: d.chapters.filter((_, j) => j !== i) })); if (selected === i) setSelected(null); }
  function moveCh(i, dir) {
    const chs = [...data.chapters]; const ni = i + dir;
    if (ni < 0 || ni >= chs.length) return;
    [chs[i], chs[ni]] = [chs[ni], chs[i]];
    setData(d => ({ ...d, chapters: chs })); setSelected(ni);
  }

  // ── Context builder for AI ──
  function buildContext() {
    const chars = data.characters.map(c => `- ${c.name} (${c.role||"personnage"}): ${c.description||""} ${c.traits ? `Traits: ${c.traits}` : ""}`).join("\n");
    const prevChaps = data.chapters.slice(0, selected).map((c,i) => `[Chapitre ${i+1} — ${c.title}]: ${c.summary || c.content?.slice(0,200)}`).join("\n");
    return { chars, prevChaps };
  }

  // ── Write from scratch ──
  async function writeChapter() {
    const ch = data.chapters[selected]; if (!ch) return;
    setAiLoading(true); setAiText(""); setAiStatus("L'IA rédige votre chapitre…");
    const { chars, prevChaps } = buildContext();
    try {
      const txt = await callClaude([{ role: "user", content:
        `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}).
${chars ? `Personnages :\n${chars}` : ""}
${prevChaps ? `\nChapitres précédents :\n${prevChaps}` : ""}

Chapitre ${selected+1} : "${ch.title}"
Résumé : ${ch.summary||"non fourni"}

Instruction de l'auteur : ${prompt||"Écris ce chapitre de manière captivante."}`
      }], "Tu es un romancier talentueux. Écris en français avec un style littéraire soigné et vivant. Produis uniquement le texte du chapitre, sans titre ni commentaire.");
      setAiText(txt);
    } finally { setAiLoading(false); setAiStatus(""); }
  }

  // ── Continue what's already written ──
  async function continueChapter() {
    const ch = data.chapters[selected]; if (!ch) return;
    if (!ch.content?.trim()) { setAiText("⚠ Le chapitre est vide. Écrivez quelques lignes pour que l'IA puisse continuer."); return; }
    setAiLoading(true); setAiText(""); setAiStatus("L'IA analyse votre texte et imagine la suite…");
    const { chars } = buildContext();
    const tail = ch.content.slice(-1200); // last ~1200 chars for context
    try {
      const txt = await callClaude([{ role: "user", content:
        `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}).
${chars ? `Personnages :\n${chars}\n` : ""}
Chapitre "${ch.title}" — voici la fin du texte déjà écrit :

"""
${tail}
"""

${prompt ? `Indication de l'auteur pour la suite : ${prompt}\n` : ""}
Continue ce chapitre de façon naturelle et cohérente, en respectant exactement le style, le ton et le rythme déjà établis. Ne répète pas ce qui est déjà écrit.`
      }], "Tu es un romancier talentueux. Tu analyses le style d'un texte et tu le continues avec une précision stylistique remarquable. Écris en français. Produis uniquement la suite du texte, sans titre ni commentaire.");
      setAiText(txt);
    } finally { setAiLoading(false); setAiStatus(""); }
  }

  // ── Surprise ending / original direction ──
  async function surpriseContinuation() {
    const ch = data.chapters[selected]; if (!ch) return;
    setAiLoading(true); setAiText(""); setAiStatus("L'IA imagine une tournure inattendue…");
    const { chars, prevChaps } = buildContext();
    const tail = ch.content ? ch.content.slice(-800) : "";
    try {
      const txt = await callClaude([{ role: "user", content:
        `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}).
${chars ? `Personnages :\n${chars}\n` : ""}
${prevChaps ? `Chapitres précédents :\n${prevChaps}\n` : ""}
Chapitre actuel "${ch.title}"${tail ? ` — fin du texte :\n"""\n${tail}\n"""` : " — résumé : " + (ch.summary||"non fourni")}

${prompt ? `Piste de l'auteur : ${prompt}\n` : ""}
Propose une SUITE ORIGINALE et surprenante : introduis un retournement de situation, une révélation inattendue, ou une nouvelle tension narrative que l'auteur n'aurait peut-être pas envisagée. Sois audacieux, créatif, imprévisible — tout en restant cohérent avec l'univers du roman.`
      }], "Tu es un romancier visionnaire spécialisé dans les rebondissements narratifs. Tu proposes des continuations originales, inattendues, qui surprennent l'auteur lui-même. Écris en français avec un style littéraire élaboré. Produis uniquement le texte narratif.");
      setAiText(txt);
    } finally { setAiLoading(false); setAiStatus(""); }
  }

  function runAI() {
    if (aiMode === "write") writeChapter();
    else if (aiMode === "continue") continueChapter();
    else surpriseContinuation();
  }

  // ── Single chapter file upload ──
  async function handleFile(file) {
    if (!file) return;
    setUploadLoading(true); setUploadStatus("Lecture du fichier…");
    try {
      let text = "";
      if (file.name.endsWith(".txt")) { text = await file.text(); }
      else if (file.name.endsWith(".docx")) {
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        text = res.value;
      } else { alert("Format non supporté. Utilisez .txt ou .docx"); return; }

      setUploadStatus("L'IA analyse le fichier…");
      const preview = text.slice(0, 3000);
      const aiRes = await callClaude([{ role: "user", content:
        `Voici le début d'un texte de roman :\n\n"${preview}"\n\nRéponds UNIQUEMENT en JSON valide (sans markdown) : {"title": "titre du chapitre ou 'Chapitre X'", "summary": "résumé en 1-2 phrases"}`
      }], "Tu extrais des métadonnées de textes littéraires. Réponds uniquement en JSON valide, sans balises markdown ni commentaire.");
      let title = file.name.replace(/\.[^.]+$/, ""), summary = "";
      try { const p = JSON.parse(aiRes.replace(/```json|```/g, "").trim()); title = p.title||title; summary = p.summary||""; } catch {}
      setData(d => ({ ...d, chapters: [...d.chapters, { id: Date.now(), title, summary, status: "Brouillon", content: text }] }));
      setSelected(data.chapters.length);
      setUploadStatus("✓ Chapitre importé !");
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err) { console.error(err); setUploadStatus("Erreur lors de l'import."); }
    finally { setUploadLoading(false); }
  }

  // ── BULK import: whole manuscript with multiple chapters ──
  async function handleBulkFile(file) {
    if (!file) return;
    setUploadLoading(true); setUploadStatus("Lecture du manuscrit…");
    try {
      let text = "";
      if (file.name.endsWith(".txt")) { text = await file.text(); }
      else if (file.name.endsWith(".docx")) {
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        text = res.value;
      } else { alert("Format non supporté. Utilisez .txt ou .docx"); return; }

      setUploadStatus("L'IA découpe et analyse chaque chapitre… (peut prendre quelques secondes)");

      // Send first 6000 chars for structure detection, then we'll split ourselves
      const snippet = text.slice(0, 8000);
      const aiRes = await callClaude([{ role: "user", content:
        `Voici le début d'un manuscrit complet contenant plusieurs chapitres :\n\n"""\n${snippet}\n"""\n\nAnalyse la structure et identifie comment les chapitres sont séparés (ex: "Chapitre 1", "CHAPITRE I", "— 1 —", ligne vide + titre en majuscules, etc.).\n\nRéponds UNIQUEMENT en JSON valide sans markdown :\n{"separator_pattern": "description du séparateur détecté", "chapters": [{"title": "...", "summary": "résumé 1-2 phrases"}, ...]}\n\nListe tous les chapitres que tu peux identifier dans l'extrait fourni (max 20).`
      }], "Tu analyses la structure de manuscrits littéraires. Réponds uniquement en JSON valide sans markdown.");

      let detectedChapters = [];
      let separatorHint = "";
      try {
        const clean = aiRes.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        detectedChapters = parsed.chapters || [];
        separatorHint = parsed.separator_pattern || "";
      } catch { /* fallback below */ }

      // Now actually split the full text using common patterns
      const splitPatterns = [
        /(?=\n(?:Chapitre|CHAPITRE|Chapter|CHAPTER)\s+(?:\d+|[IVXLCDMivxlcdm]+))/g,
        /(?=\n(?:\d+\.?\s*\n|#{1,3}\s))/g,
        /(?=\n[—–-]{3,}\s*\n)/g,
      ];

      let parts = null;
      for (const pat of splitPatterns) {
        const arr = text.split(pat).filter(s => s.trim().length > 100);
        if (arr.length > 1) { parts = arr; break; }
      }

      // If no pattern worked, split on double newlines as fallback
      if (!parts || parts.length <= 1) {
        parts = text.split(/\n{3,}/).filter(s => s.trim().length > 200);
      }

      // Merge AI-detected titles/summaries with split text
      const merged = parts.map((content, i) => {
        const aiMeta = detectedChapters[i];
        // Try to extract title from first non-empty line of the part
        const firstLine = content.trim().split("\n").find(l => l.trim().length > 0) || "";
        const looksLikeTitle = /^(Chapitre|CHAPITRE|Chapter|[IVX]+\.|[0-9]+[.)—\s])/.test(firstLine.trim()) || firstLine.length < 60;
        const title = aiMeta?.title || (looksLikeTitle ? firstLine.trim().slice(0, 80) : `Chapitre ${i + 1}`);
        const summary = aiMeta?.summary || "";
        return { title, summary, content: content.trim(), wordCount: wc(content) };
      });

      setImportPreview({ chapters: merged, separatorHint });
      setUploadStatus("");
    } catch (err) { console.error(err); setUploadStatus("Erreur lors de l'import du manuscrit."); }
    finally { setUploadLoading(false); }
  }

  function confirmBulkImport() {
    if (!importPreview) return;
    const newChapters = importPreview.chapters.map(c => ({ id: Date.now() + Math.random(), title: c.title, summary: c.summary, status: "Brouillon", content: c.content }));
    setData(d => ({ ...d, chapters: [...d.chapters, ...newChapters] }));
    setImportPreview(null);
    setSelected(data.chapters.length);
  }

  const ch = selected !== null ? data.chapters[selected] : null;
  const done = data.chapters.filter(c => c.status === "Terminé").length;
  const fs = appearance.fontSize || 16;

  const aiModeConfig = {
    write:    { label: "Écrire ce chapitre",        icon: "✍️", hint: "L'IA rédige le chapitre depuis votre résumé et vos personnages." },
    continue: { label: "Continuer mon texte",       icon: "➡️", hint: "L'IA reprend exactement là où vous vous êtes arrêté, dans votre style." },
    surprise: { label: "Surprise ! (tournure inattendue)", icon: "✨", hint: "L'IA propose un rebondissement original que vous n'attendiez pas." },
  };

  // ── Focused writing mode ──
  if (focusMode && ch) return (
    <div className="writing-focused">
      <div className="focused-header">
        <span style={{ fontFamily: "var(--display-font, serif)" }}>Chapitre {selected+1} — {ch.title}</span>
        <div className="flex gap-8" style={{ alignItems: "center" }}>
          <span className="focused-wc">{wc(ch.content)} mots</span>
          <select value={ch.status} onChange={e => updateStatus(selected, e.target.value)} style={{ width: 120, fontSize: "0.8rem" }}>
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-sm btn-outline" onClick={() => setFocusMode(false)}>✕ Quitter</button>
        </div>
      </div>
      <div className="writing-inner">
        <textarea style={{ fontSize: `${fs}px`, lineHeight: 1.9, background: "transparent", border: "none", resize: "none", width: "100%", minHeight: "70vh", color: "var(--ink)", fontFamily: "inherit" }}
          value={ch.content || ""} onChange={e => saveContent(selected, e.target.value)} placeholder="Écrivez librement…" autoFocus />
      </div>
    </div>
  );

  // ── Bulk import preview modal ──
  if (importPreview) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, padding: 28, maxWidth: 700, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <div className="section-header" style={{ marginBottom: 14 }}>
          <span>📚 Import du manuscrit</span>
        </div>
        {importPreview.separatorHint && <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic", marginBottom: 14 }}>Structure détectée : {importPreview.separatorHint}</p>}
        <p style={{ fontSize: "0.85rem", marginBottom: 16 }}>L'IA a identifié <strong>{importPreview.chapters.length} chapitre{importPreview.chapters.length>1?"s":""}</strong>. Vérifiez les titres et résumés avant de confirmer l'import.</p>

        <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 18 }}>
          {importPreview.chapters.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "10px 14px", marginBottom: 8, background: "var(--paper2)" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <span style={{ color: "var(--gold)", fontFamily: "serif", minWidth: 22 }}>{i+1}</span>
                <input value={c.title} onChange={e => setImportPreview(p => ({ ...p, chapters: p.chapters.map((ch2,j) => j===i ? {...ch2,title:e.target.value} : ch2) }))}
                  style={{ flex: 1, fontWeight: 500 }} />
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", alignSelf: "center", whiteSpace: "nowrap" }}>{c.wordCount} mots</span>
                <button className="btn btn-sm btn-danger" onClick={() => setImportPreview(p => ({ ...p, chapters: p.chapters.filter((_,j)=>j!==i) }))}>✕</button>
              </div>
              <textarea value={c.summary} onChange={e => setImportPreview(p => ({ ...p, chapters: p.chapters.map((ch2,j) => j===i ? {...ch2,summary:e.target.value} : ch2) }))}
                style={{ width: "100%", height: 50, fontSize: "0.8rem", fontStyle: "italic" }} placeholder="Résumé du chapitre…" />
            </div>
          ))}
        </div>

        <div className="flex-end">
          <button className="btn btn-outline" onClick={() => setImportPreview(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={confirmBulkImport}>✓ Importer {importPreview.chapters.length} chapitre{importPreview.chapters.length>1?"s":""}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <span>✦ Chapitres</span>
        <div className="flex gap-8">
          <button className="btn btn-sm btn-outline" title="Importer un chapitre seul" onClick={() => fileRef.current.click()}>📄 Un chapitre</button>
          <button className="btn btn-sm btn-outline" title="Importer un manuscrit complet (plusieurs chapitres)" onClick={() => bulkRef.current.click()} style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>📚 Manuscrit complet</button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm(s => !s)}>+ Nouveau</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".txt,.docx" style={{ display: "none" }} onChange={e => { handleFile(e.target.files?.[0]); e.target.value=""; }} />
      <input ref={bulkRef} type="file" accept=".txt,.docx" style={{ display: "none" }} onChange={e => { handleBulkFile(e.target.files?.[0]); e.target.value=""; }} />

      {/* Upload drop zone — smart detection */}
      <div className={`upload-zone ${drag ? "drag" : ""}`} style={{ marginBottom: 14 }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          // Ask user which mode
          const choice = window.confirm("Ce fichier contient-il PLUSIEURS chapitres ?\n\nOK = Manuscrit complet (l'IA découpera automatiquement)\nAnnuler = Un seul chapitre");
          if (choice) handleBulkFile(file); else handleFile(file);
        }}>
        <div className="upload-zone-icon">📄</div>
        {uploadLoading
          ? <><div className="spinner" style={{ margin: "0 auto" }} /><div style={{ fontSize: "0.82rem", marginTop: 6 }}>{uploadStatus}</div></>
          : <>
            <div style={{ fontSize: "0.88rem" }}>Glissez un fichier <strong>.txt</strong> ou <strong>.docx</strong> ici</div>
            <div style={{ fontSize: "0.72rem", marginTop: 4, color: "var(--muted)" }}>Un seul chapitre <em>ou</em> manuscrit complet — l'IA s'occupe du reste</div>
          </>
        }
        {uploadStatus && !uploadLoading && <div style={{ fontSize: "0.8rem", color: "var(--sepia)", marginTop: 6 }}>{uploadStatus}</div>}
      </div>

      {data.chapters.length > 0 && <>
        <div className="progress-bar" style={{ marginBottom: 5 }}><div className="progress-fill" style={{ width: `${done/data.chapters.length*100}%` }} /></div>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic", marginBottom: 14 }}>{data.chapters.length} chapitre{data.chapters.length>1?"s":""} · {done} terminé{done>1?"s":""} · {data.chapters.reduce((acc,c)=>acc+wc(c.content),0).toLocaleString()} mots au total</p>
      </>}

      {showForm && <div className="card">
        <div className="card-title">✦ Nouveau chapitre</div>
        <div className="grid-2">
          <div className="field"><label>Titre *</label><input value={chForm.title} onChange={e => setChForm(f => ({ ...f, title: e.target.value }))} placeholder="Le Bal de Minuit…" /></div>
          <div className="field"><label>Statut</label><select value={chForm.status} onChange={e => setChForm(f => ({ ...f, status: e.target.value }))}>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="field"><label>Résumé</label><textarea className="ta-sm" value={chForm.summary} onChange={e => setChForm(f => ({ ...f, summary: e.target.value }))} placeholder="Ce qui se passe…" /></div>
        <div className="flex-end"><button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button><button className="btn btn-primary" onClick={addCh}>Ajouter</button></div>
      </div>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* Chapter list */}
        <div className="scrollable">
          {data.chapters.length === 0
            ? <div className="empty">Aucun chapitre.<br />Créez-en un ou importez un fichier.</div>
            : data.chapters.map((c, i) => (
              <div key={c.id||i} className={`chapter-item ${selected===i?"selected":""}`} onClick={() => { setSelected(i); setAiText(""); setPrompt(""); }}>
                <div className="chapter-num">{i+1}</div>
                <div className="chapter-info">
                  <div className="chapter-name">{c.title}</div>
                  <div className="chapter-meta">{wc(c.content).toLocaleString()} mots · {c.summary?.slice(0,45)}{c.summary?.length>45?"…":""}</div>
                </div>
                <span className={`tag ${stag[c.status]}`}>{c.status}</span>
                <div className="flex gap-8" onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-sm btn-outline" onClick={()=>moveCh(i,-1)}>↑</button>
                  <button className="btn btn-sm btn-outline" onClick={()=>moveCh(i,1)}>↓</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>delCh(i)}>✕</button>
                </div>
              </div>
            ))
          }
        </div>

        {/* Chapter detail */}
        {ch ? (
          <div>
            <div className="card">
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "var(--display-font,serif)", fontSize: "1.1rem" }}>Chapitre {selected+1} — {ch.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic", marginTop: 2 }}>{ch.summary}</div>
                </div>
                <div className="flex gap-8" style={{ alignItems: "center" }}>
                  <select value={ch.status} onChange={e=>updateStatus(selected,e.target.value)} style={{ width: 110, fontSize: "0.8rem" }}>{statuses.map(s=><option key={s}>{s}</option>)}</select>
                  <button className="btn btn-sm btn-outline" title="Mode concentration" onClick={()=>setFocusMode(true)}>⛶</button>
                </div>
              </div>
              <textarea style={{ width:"100%", height:260, resize:"vertical", fontSize:`${fs}px`, lineHeight:1.8 }}
                value={ch.content||""} onChange={e=>saveContent(selected,e.target.value)} placeholder="Écrivez ici ou laissez l'IA vous aider…" />
              <div style={{ fontSize:"0.72rem", color:"var(--muted)", textAlign:"right", fontStyle:"italic", marginTop:4 }}>{wc(ch.content).toLocaleString()} mots</div>
            </div>

            {/* AI Panel */}
            <div className="card">
              <div className="card-title">✦ Assistance IA</div>

              {/* Mode selector */}
              <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                {Object.entries(aiModeConfig).map(([key, cfg]) => (
                  <button key={key} className={`btn btn-sm ${aiMode===key?"btn-primary":"btn-outline"}`}
                    onClick={()=>{ setAiMode(key); setAiText(""); }}
                    style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span>{cfg.icon}</span>{cfg.label}
                  </button>
                ))}
              </div>

              {/* Mode hint */}
              <p style={{ fontSize:"0.75rem", color:"var(--muted)", fontStyle:"italic", marginBottom:10, padding:"6px 10px", background:"var(--paper2)", borderRadius:3, borderLeft:"3px solid var(--border)" }}>
                {aiModeConfig[aiMode].hint}
              </p>

              {/* Optional instruction */}
              <div className="field">
                <label>
                  {aiMode==="write" ? "Instruction / description de scène" :
                   aiMode==="continue" ? "Indication (optionnel) — vers où aller ?" :
                   "Piste créative (optionnel) — un thème, une émotion…"}
                </label>
                <textarea className="ta-sm" value={prompt} onChange={e=>setPrompt(e.target.value)}
                  placeholder={
                    aiMode==="write" ? "Scène d'ouverture dans une gare, tension entre les personnages…" :
                    aiMode==="continue" ? "La tension monte, on approche du secret…" :
                    "Quelque chose de sombre, une trahison inattendue…"
                  } />
              </div>

              <button className="btn btn-ai" onClick={runAI} disabled={aiLoading} style={{ fontSize:"0.9rem" }}>
                <span>{aiModeConfig[aiMode].icon}</span>
                {aiLoading ? aiStatus : aiModeConfig[aiMode].label}
              </button>
              {aiLoading && <div className="ai-thinking mt-8"><div className="spinner"/>{aiStatus}</div>}

              {aiText && (
                <div className="ai-output">{aiText}
                  <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <button className="btn btn-sm btn-outline" onClick={()=>{ saveContent(selected,(ch.content?ch.content+"\n\n":"")+aiText); setAiText(""); }}>
                      ← Ajouter à la suite
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={()=>{ saveContent(selected,aiText); setAiText(""); }}>
                      ↺ Remplacer le chapitre
                    </button>
                    <button className="btn btn-sm btn-ai" onClick={runAI} disabled={aiLoading}>
                      ↻ Regénérer
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={()=>setAiText("")}>✕</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : <div className="empty card">Sélectionnez un chapitre pour l'éditer.</div>}
      </div>
    </div>
  );
}

// ─── TAB: Playlist ────────────────────────────────────────────────────────────
function TabPlaylist({ data, setData }) {
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [playing, setPlaying] = useState(null);

  function addTrack() {
    const id = ytId(urlInput.trim());
    if (!id) { alert("URL YouTube non reconnue."); return; }
    const track = { id: Date.now(), ytId: id, title: titleInput.trim() || "Sans titre", thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg` };
    setData(d => ({ ...d, playlist: [...d.playlist, track] }));
    setUrlInput(""); setTitleInput("");
  }

  function delTrack(i) {
    setData(d => ({ ...d, playlist: d.playlist.filter((_, j) => j !== i) }));
    if (playing === i) setPlaying(null);
  }

  const moods = [
    { label: "Ambiance mystérieuse", q: "mystery atmospheric writing music" },
    { label: "Romance", q: "romantic piano writing music" },
    { label: "Épique / Fantasy", q: "epic fantasy orchestral writing" },
    { label: "Thriller tension", q: "thriller suspense background music" },
    { label: "Méditatif", q: "meditative ambient writing music" },
  ];

  return (
    <div>
      <div className="section-header"><span>🎵 Playlist d'Écriture</span></div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <div className="card">
            <div className="card-title">✦ Ajouter une musique YouTube</div>
            <div className="field"><label>URL YouTube</label><input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></div>
            <div className="field"><label>Titre (optionnel)</label><input value={titleInput} onChange={e=>setTitleInput(e.target.value)} placeholder="Piano nocturne…" /></div>
            <button className="btn btn-primary" onClick={addTrack}>+ Ajouter à la playlist</button>
          </div>

          <div className="card">
            <div className="card-title">✦ Suggestions par ambiance</div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic", marginBottom: 12 }}>Recherchez ces termes sur YouTube pour trouver de la musique adaptée à votre roman.</p>
            {moods.map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.85rem" }}>{m.label}</span>
                <code style={{ fontSize: "0.72rem", color: "var(--muted)", background: "var(--paper2)", padding: "2px 6px", borderRadius: 2 }}>{m.q}</code>
              </div>
            ))}
          </div>
        </div>

        <div>
          {data.playlist.length === 0
            ? <div className="empty">Votre playlist est vide.<br />Ajoutez des liens YouTube.</div>
            : <>
              {playing !== null && data.playlist[playing] && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <iframe className="yt-player" src={`https://www.youtube.com/embed/${data.playlist[playing].ytId}?autoplay=1`}
                    allow="autoplay; encrypted-media" allowFullScreen title="Lecture" />
                  <div style={{ fontFamily: "var(--display-font,serif)", fontSize: "0.95rem", marginTop: 8 }}>{data.playlist[playing].title}</div>
                </div>
              )}
              <div className="scrollable">
                {data.playlist.map((t, i) => (
                  <div key={t.id} className={`playlist-item ${playing===i?"playing":""}`}>
                    <img src={t.thumb} className="playlist-thumb" alt="" onError={e => e.target.style.display="none"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="playlist-title">{t.title}</div>
                      {playing===i && <div className="playlist-artist">▶ En cours…</div>}
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => setPlaying(playing===i?null:i)}>{playing===i?"⏸":"▶"}</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>delTrack(i)}>✕</button>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Apparence ───────────────────────────────────────────────────────────
function TabApparence({ data, setData }) {
  const ap = data.appearance;
  function setAp(patch) { setData(d => ({ ...d, appearance: { ...d.appearance, ...patch } })); }

  const themeEntries = Object.entries(THEMES);

  return (
    <div>
      <div className="section-header"><span>🎨 Apparence & Style</span></div>

      <div className="card">
        <div className="card-title">✦ Thème de couleurs</div>
        <div className="grid-2">
          {themeEntries.map(([key, th]) => {
            const vars = th.vars;
            return (
              <div key={key} className={`theme-card ${ap.theme===key?"selected":""}`}
                style={{ background: vars["--paper"], borderColor: ap.theme===key ? vars["--gold"] : vars["--border"], color: vars["--ink"] }}
                onClick={() => setAp({ theme: key })}>
                <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>{th.emoji}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "0.9rem", fontWeight: "bold" }}>{th.name}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>
                  {[vars["--paper"], vars["--sepia"], vars["--gold"], vars["--ink"]].map((c, i) => (
                    <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "1px solid rgba(128,128,128,0.3)" }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">✦ Typographie</div>
        <div className="grid-2">
          {FONT_PAIRS.map(fp => (
            <div key={fp.id} className={`font-card ${ap.fontId===fp.id?"selected":""}`} onClick={() => setAp({ fontId: fp.id })}>
              <div className="font-sample" style={{ fontFamily: `'${fp.display}', serif` }}>Aa — {fp.name}</div>
              <div className="font-name">Titre : {fp.display} · Corps : {fp.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">✦ Taille du texte d'écriture</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input type="range" min="13" max="22" step="1" value={ap.fontSize||16} onChange={e=>setAp({fontSize:+e.target.value})} style={{ width: 200, accentColor: "var(--gold)" }} />
          <span style={{ fontSize: `${ap.fontSize||16}px`, fontStyle: "italic", color: "var(--muted)" }}>Taille : {ap.fontSize||16}px — Il était une fois…</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">✦ Mode d'écriture</div>
        <div className="grid-2">
          <div className={`theme-card ${ap.writingMode==="normal"?"selected":""}`} onClick={()=>setAp({writingMode:"normal"})}>
            <div style={{ fontSize: "1.4rem", marginBottom: 5 }}>📐</div>
            <div style={{ fontSize: "0.88rem", fontWeight: "bold" }}>Normal</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>Vue classique avec panneau latéral</div>
          </div>
          <div className={`theme-card ${ap.writingMode==="focused"?"selected":""}`} onClick={()=>setAp({writingMode:"focused"})}>
            <div style={{ fontSize: "1.4rem", marginBottom: 5 }}>🕯️</div>
            <div style={{ fontSize: "0.88rem", fontWeight: "bold" }}>Concentration</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>Plein écran sans distraction (via ⛶ dans le chapitre)</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor: "var(--gold)", borderStyle: "dashed" }}>
        <div className="card-title">✦ Aperçu</div>
        <div style={{ padding: "18px 22px", background: "var(--paper2)", borderRadius: 3, fontFamily: "inherit" }}>
          <div style={{ fontFamily: "inherit", fontSize: "1.3rem", marginBottom: 8, color: "var(--sepia)" }}>{data.novel.title || "Titre de votre roman"}</div>
          <div style={{ fontSize: `${ap.fontSize||16}px`, lineHeight: 1.85, color: "var(--ink)" }}>
            {data.novel.synopsis?.slice(0,200) || "Le texte de votre roman apparaîtra avec cette typographie et ces couleurs. Chaque mot prend vie sur cette page unique, façonné par vos choix esthétiques."}
            {data.novel.synopsis?.length > 200 ? "…" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Tableau de Bord ─────────────────────────────────────────────────────
function TabDashboard({ data, setData }) {
  const goals = data.goals || { dailyTarget: 500, wordGoal: 80000, sessions: [] };
  const [editGoals, setEditGoals] = useState(false);
  const [gForm, setGForm] = useState({ dailyTarget: goals.dailyTarget, wordGoal: goals.wordGoal });
  const [todayWords, setTodayWords] = useState(0);
  const [sessionInput, setSessionInput] = useState("");

  const totalWords = data.chapters.reduce((a, c) => a + wc(c.content), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = (goals.sessions || []).filter(s => s.date === today);
  const todayTotal = todaySessions.reduce((a, s) => a + s.words, 0);
  const pctTotal = Math.min(100, Math.round((totalWords / (goals.wordGoal || 80000)) * 100));

  // Last 7 days writing history
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const dayWords = (goals.sessions || []).filter(s => s.date === dateStr).reduce((a, s) => a + s.words, 0);
    return { date: dateStr, label: d.toLocaleDateString("fr-FR", { weekday: "short" }), words: dayWords };
  });
  const maxDay = Math.max(...last7.map(d => d.words), goals.dailyTarget, 1);

  function logSession() {
    const n = parseInt(sessionInput);
    if (!n || n <= 0) return;
    const session = { date: today, words: n, id: Date.now() };
    setData(d => ({ ...d, goals: { ...d.goals, sessions: [...(d.goals?.sessions || []), session] } }));
    setSessionInput("");
  }

  function saveGoals() {
    setData(d => ({ ...d, goals: { ...d.goals, dailyTarget: +gForm.dailyTarget, wordGoal: +gForm.wordGoal } }));
    setEditGoals(false);
  }

  const doneCh = data.chapters.filter(c => c.status === "Terminé").length;

  // Character × Chapter matrix
  const charNames = data.characters.map(c => c.name);

  return (
    <div>
      <div className="section-header"><span>📊 Tableau de Bord</span></div>

      {/* Top stats */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[
          { label: "Mots au total", value: totalWords.toLocaleString(), sub: `objectif : ${(goals.wordGoal||80000).toLocaleString()}`, color: "var(--gold)" },
          { label: "Chapitres terminés", value: `${doneCh} / ${data.chapters.length}`, sub: data.chapters.length > 0 ? `${Math.round(doneCh/data.chapters.length*100)}% accompli` : "Aucun chapitre", color: "var(--sepia)" },
          { label: "Écrits aujourd'hui", value: todayTotal.toLocaleString(), sub: `objectif : ${(goals.dailyTarget||500).toLocaleString()} mots/jour`, color: todayTotal >= (goals.dailyTarget||500) ? "#50a064" : "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: "20px 14px" }}>
            <div style={{ fontSize: "2rem", fontFamily: "var(--display-font,serif)", color: s.color, fontWeight: "bold" }}>{s.value}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontStyle: "italic", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Global progress */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Progression du manuscrit</div>
          <button className="btn btn-sm btn-outline" onClick={() => { setEditGoals(e => !e); setGForm({ dailyTarget: goals.dailyTarget, wordGoal: goals.wordGoal }); }}>⚙ Objectifs</button>
        </div>
        {editGoals && (
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field"><label>Objectif total (mots)</label><input type="number" value={gForm.wordGoal} onChange={e => setGForm(f => ({ ...f, wordGoal: e.target.value }))} /></div>
            <div className="field"><label>Objectif quotidien (mots)</label><input type="number" value={gForm.dailyTarget} onChange={e => setGForm(f => ({ ...f, dailyTarget: e.target.value }))} /></div>
            <div className="flex-end" style={{ gridColumn: "1/-1" }}><button className="btn btn-primary btn-sm" onClick={saveGoals}>Sauvegarder</button></div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginBottom: 4 }}>
          <span>{totalWords.toLocaleString()} mots</span><span>{pctTotal}%</span><span>{(goals.wordGoal||80000).toLocaleString()} mots</span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}><div className="progress-fill" style={{ width: `${pctTotal}%` }} /></div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontStyle: "italic", marginTop: 6 }}>
          {Math.max(0, (goals.wordGoal||80000) - totalWords).toLocaleString()} mots restants
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* Daily writing tracker */}
        <div className="card">
          <div className="card-title">📅 Suivi quotidien</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input type="number" value={sessionInput} onChange={e => setSessionInput(e.target.value)} placeholder="Mots écrits aujourd'hui…" style={{ flex: 1 }}
              onKeyDown={e => e.key === "Enter" && logSession()} />
            <button className="btn btn-primary btn-sm" onClick={logSession} style={{ whiteSpace: "nowrap" }}>+ Ajouter</button>
          </div>
          {todayTotal >= (goals.dailyTarget||500) && (
            <div style={{ padding: "8px 12px", background: "rgba(80,160,100,0.15)", borderRadius: 3, fontSize: "0.82rem", color: "#50a064", marginBottom: 12, textAlign: "center" }}>
              🎉 Objectif du jour atteint ! Bravo !
            </div>
          )}
          {/* 7-day bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {last7.map(d => (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: `${Math.round((d.words / maxDay) * 60)}px`, minHeight: d.words > 0 ? 4 : 0, background: d.date === today ? "var(--gold)" : "var(--sepia)", borderRadius: "2px 2px 0 0", opacity: d.words > 0 ? 1 : 0.25, transition: "height 0.3s" }} />
                <div style={{ fontSize: "0.62rem", color: "var(--muted)", textAlign: "center" }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <div style={{ width: 10, height: 10, background: "var(--border)", position: "relative" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.round((goals.dailyTarget||500)/maxDay*100)}%`, background: "rgba(201,150,42,0.3)", borderTop: "1px dashed var(--gold)" }} />
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--muted)", fontStyle: "italic" }}>Ligne d'objectif : {(goals.dailyTarget||500)} mots/jour</span>
          </div>
        </div>

        {/* Chapter word counts */}
        <div className="card">
          <div className="card-title">📝 Mots par chapitre</div>
          {data.chapters.length === 0
            ? <div className="empty" style={{ padding: 16 }}>Aucun chapitre encore.</div>
            : <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {data.chapters.map((c, i) => {
                const w = wc(c.content);
                const avg = totalWords / data.chapters.length || 1;
                const pct = Math.min(100, Math.round((w / (avg * 2)) * 100));
                return (
                  <div key={c.id || i} style={{ marginBottom: 10 }}>
                    <div className="flex-between" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: "0.8rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--gold)", marginRight: 6 }}>{i + 1}.</span>{c.title}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{w.toLocaleString()} mots</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: c.status === "Terminé" ? "#50a064" : c.status === "En cours" ? "var(--gold)" : "var(--border)" }} /></div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      </div>

      {/* Character × Chapter matrix */}
      {data.characters.length > 0 && data.chapters.length > 0 && (
        <div className="card">
          <div className="card-title">👥 Présence des personnages par chapitre</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--muted)", fontWeight: "normal", fontStyle: "italic", minWidth: 120 }}>Personnage</th>
                  {data.chapters.map((c, i) => (
                    <th key={i} style={{ padding: "4px 6px", color: "var(--muted)", fontWeight: "normal", textAlign: "center", minWidth: 36, maxWidth: 60 }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "0.68rem", maxHeight: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.characters.map((char, ci) => (
                  <tr key={ci} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "5px 8px", color: "var(--ink)", fontStyle: "italic" }}>{char.name}</td>
                    {data.chapters.map((ch, chi) => {
                      const present = ch.content?.toLowerCase().includes(char.name.toLowerCase()) || ch.summary?.toLowerCase().includes(char.name.toLowerCase());
                      return (
                        <td key={chi} style={{ textAlign: "center", padding: "5px 6px" }}>
                          {present ? <span style={{ color: "var(--gold)", fontSize: "0.9rem" }}>●</span> : <span style={{ color: "var(--border)" }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>● = personnage mentionné dans le texte ou résumé du chapitre</div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Worldbuilding ───────────────────────────────────────────────────────
function TabWorldbuilding({ data, setData }) {
  const wb = data.worldbuilding || { locations: [], factions: [], timelineEvents: [], glossary: [], freeNotes: "" };
  const [section, setSection] = useState("locations");
  const [form, setForm] = useState({ name: "", description: "", extra: "" });
  const [freeNotes, setFreeNotes] = useState(wb.freeNotes || "");
  const [loading, setLoading] = useState(false);
  const [aiOut, setAiOut] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  function setWb(patch) { setData(d => ({ ...d, worldbuilding: { ...(d.worldbuilding || {}), ...patch } })); }

  function addItem() {
    if (!form.name.trim()) return;
    const item = { id: Date.now(), ...form };
    setWb({ [section]: [...(wb[section] || []), item] });
    setForm({ name: "", description: "", extra: "" });
  }

  function delItem(id) { setWb({ [section]: (wb[section] || []).filter(x => x.id !== id) }); }

  async function genWorldElement() {
    setLoading(true); setAiOut("");
    try {
      const context = `Roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}). Synopsis : ${data.novel.synopsis||'non fourni'}.`;
      const labels = { locations: "lieu", factions: "faction/organisation", timelineEvents: "événement chronologique", glossary: "terme du glossaire" };
      const txt = await callClaude([{ role: "user", content: `${context}\n\nCrée un ${labels[section]} original pour ce roman : "${aiPrompt||'quelque chose d\'intéressant'}". Fournis un nom et une description détaillée.` }]);
      setAiOut(txt);
    } finally { setLoading(false); }
  }

  const sections = [
    { key: "locations", label: "🗺 Lieux", namePh: "La Forêt de Méliandre…", descPh: "Forêt enchantée à l'ouest du royaume…", extraLabel: "Détails spéciaux", extraPh: "Habitants, dangers, histoire…" },
    { key: "factions", label: "⚔ Factions", namePh: "L'Ordre du Soleil Noir…", descPh: "Organisation secrète fondée en…", extraLabel: "Objectifs & membres clés", extraPh: "Veulent renverser le roi…" },
    { key: "timelineEvents", label: "📅 Chronologie", namePh: "La Chute de l'Empire…", descPh: "Il y a 400 ans, l'empire s'effondra…", extraLabel: "Date / Époque", extraPh: "An 432 du calendrier lunaire…" },
    { key: "glossary", label: "📖 Glossaire", namePh: "La Magie du Vide…", descPh: "Forme de magie rare qui…", extraLabel: "Usage dans le roman", extraPh: "Utilisée par le protagoniste…" },
  ];
  const currentSection = sections.find(s => s.key === section);
  const items = wb[section] || [];

  return (
    <div>
      <div className="section-header"><span>🌍 Worldbuilding</span></div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {sections.map(s => (
          <button key={s.key} className={`btn btn-sm ${section === s.key ? "btn-primary" : "btn-outline"}`} onClick={() => { setSection(s.key); setForm({ name:"",description:"",extra:"" }); setAiOut(""); }}>
            {s.label}
          </button>
        ))}
        <button className={`btn btn-sm ${section === "notes" ? "btn-primary" : "btn-outline"}`} onClick={() => setSection("notes")}>📓 Notes libres</button>
      </div>

      {section === "notes" ? (
        <div className="card">
          <div className="card-title">📓 Notes libres & idées</div>
          <textarea style={{ width: "100%", height: 480, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.75 }}
            value={freeNotes} onChange={e => setFreeNotes(e.target.value)}
            placeholder="Notez ici tout ce qui ne rentre pas ailleurs : règles de magie, langues inventées, prophéties, notes de recherche historique, inspirations visuelles, idées de scènes futures…" />
          <div className="flex-end mt-8"><button className="btn btn-primary" onClick={() => setWb({ freeNotes })}>Sauvegarder les notes</button></div>
        </div>
      ) : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div>
            <div className="card">
              <div className="card-title">✦ Ajouter {currentSection?.label}</div>
              <div className="field"><label>Nom *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={currentSection?.namePh} /></div>
              <div className="field"><label>Description</label><textarea className="ta-md" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={currentSection?.descPh} /></div>
              <div className="field"><label>{currentSection?.extraLabel}</label><textarea className="ta-sm" value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} placeholder={currentSection?.extraPh} /></div>
              <div className="flex-end"><button className="btn btn-primary" onClick={addItem}>Ajouter</button></div>
              <hr className="divider" />
              <div className="card-title">✦ Créer avec l'IA</div>
              <div className="field"><label>Décrivez votre idée</label><input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder={currentSection?.namePh} /></div>
              <button className="btn btn-ai" onClick={genWorldElement} disabled={loading}><span>✦</span>{loading ? "Génération…" : "Générer"}</button>
              {loading && <div className="ai-thinking mt-8"><div className="spinner"/>L'IA construit votre monde…</div>}
              {aiOut && <div className="ai-output" style={{ fontSize: "0.8rem" }}>{aiOut}</div>}
            </div>
          </div>

          <div>
            {items.length === 0
              ? <div className="empty">Aucun élément dans {currentSection?.label}.<br />Ajoutez-en un à gauche.</div>
              : items.map(item => (
                <div key={item.id} className="char-card" style={{ marginBottom: 10 }}>
                  <div className="flex-between">
                    <div className="char-name">{item.name}</div>
                    <button className="btn btn-sm btn-danger" onClick={() => delItem(item.id)}>✕</button>
                  </div>
                  {item.description && <div className="char-desc mt-8">{item.description}</div>}
                  {item.extra && <div className="char-desc" style={{ color: "var(--sepia)", marginTop: 4, fontStyle: "italic" }}>{item.extra}</div>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Révision ────────────────────────────────────────────────────────────
function TabRevision({ data }) {
  const [mode, setMode] = useState("chapitre"); // "chapitre" | "coherence"
  const [selectedCh, setSelectedCh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [focus, setFocus] = useState("general"); // general | rythme | dialogues | style | show

  const focusOptions = [
    { key: "general", label: "Analyse générale", icon: "🔎" },
    { key: "rythme", label: "Rythme & structure", icon: "⏱" },
    { key: "dialogues", label: "Dialogues", icon: "💬" },
    { key: "style", label: "Style & langue", icon: "✒" },
    { key: "show", label: "Show don't tell", icon: "🎭" },
  ];

  async function analyzeChapter() {
    const ch = data.chapters[selectedCh];
    if (!ch?.content?.trim()) { setResult("⚠ Ce chapitre n'a pas encore de texte."); return; }
    setLoading(true); setResult("");
    const chars = data.characters.map(c => `${c.name} (${c.role||"personnage"})`).join(", ");
    const focusPrompts = {
      general: "Fais une analyse complète : points forts, points à améliorer, rythme, dialogues, style, cohérence.",
      rythme: "Analyse spécifiquement le rythme narratif : longueur des scènes, transitions, équilibre action/description/dialogue, gestion du temps.",
      dialogues: "Analyse les dialogues : naturel, caractérisation des voix, attributions, utilisation des sous-entendus et non-dits.",
      style: "Analyse le style d'écriture : richesse du vocabulaire, variété des structures de phrases, figures de style, fluidité.",
      show: "Analyse le principe 'show don't tell' : où l'auteur montre au lieu de raconter (bravo), où il devrait montrer davantage (conseils concrets).",
    };
    try {
      const txt = await callClaude([{ role: "user", content:
        `Tu analyses ce chapitre du roman "${data.novel.title||'sans titre'}" (${data.novel.genre||'non précisé'}).\nPersonnages : ${chars||'non définis'}\n\nChapitre "${ch.title}" :\n"""\n${ch.content.slice(0, 5000)}\n"""\n\n${focusPrompts[focus]}\n\nSois constructif, précis, cite des passages du texte. Structure ta réponse avec des sections claires.`
      }], "Tu es un éditeur littéraire expérimenté. Tu donnes des retours constructifs, bienveillants et précis sur des textes de roman. Réponds en français.");
      setResult(txt);
    } finally { setLoading(false); }
  }

  async function checkCoherence() {
    const allText = data.chapters.map((c, i) => `[Chapitre ${i+1}: ${c.title}]\n${c.content||c.summary||""}`).join("\n\n---\n\n");
    if (!allText.trim()) { setResult("⚠ Aucun texte à analyser."); return; }
    const chars = data.characters.map(c => `- ${c.name}: ${c.description||""} ${c.traits||""}`).join("\n");
    setLoading(true); setResult("");
    try {
      const txt = await callClaude([{ role: "user", content:
        `Analyse la cohérence du roman "${data.novel.title||'sans titre'}".\n\nFiches personnages :\n${chars||"non définies"}\n\nTexte des chapitres :\n"""\n${allText.slice(0, 7000)}\n"""\n\nIdentifie :\n1. Les contradictions (descriptions contradictoires d'un personnage, incohérences de dates/lieux, personnages qui changent de caractère sans raison)\n2. Les trous narratifs (événements évoqués sans explication, personnages qui disparaissent)\n3. Les répétitions excessives (mots, phrases, scènes similaires)\n4. Les points positifs de cohérence\n\nSois précis et cite les chapitres concernés.`
      }], "Tu es un éditeur littéraire expert en cohérence narrative. Tu analyses des manuscrits et identifies les incohérences avec précision. Réponds en français.");
      setResult(txt);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="section-header"><span>✏ Révision & Analyse</span></div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button className={`btn ${mode==="chapitre"?"btn-primary":"btn-outline"}`} onClick={() => { setMode("chapitre"); setResult(""); }}>
          📝 Réviser un chapitre
        </button>
        <button className={`btn ${mode==="coherence"?"btn-primary":"btn-outline"}`} onClick={() => { setMode("coherence"); setResult(""); }}>
          🔍 Vérifier la cohérence globale
        </button>
      </div>

      {mode === "chapitre" ? (
        <div className="card">
          <div className="card-title">✦ Analyse d'un chapitre par l'IA</div>

          <div className="grid-2">
            <div className="field">
              <label>Choisir le chapitre</label>
              <select value={selectedCh ?? ""} onChange={e => setSelectedCh(+e.target.value)}>
                <option value="">— Sélectionner —</option>
                {data.chapters.map((c, i) => <option key={i} value={i}>Chap. {i+1} — {c.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Type d'analyse</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                {focusOptions.map(f => (
                  <button key={f.key} className={`btn btn-sm ${focus===f.key?"btn-primary":"btn-outline"}`} onClick={() => { setFocus(f.key); setResult(""); }}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedCh !== null && data.chapters[selectedCh] && (
            <div style={{ padding: "8px 12px", background: "var(--paper2)", borderRadius: 3, marginBottom: 12, fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
              Chapitre sélectionné : « {data.chapters[selectedCh].title} » — {wc(data.chapters[selectedCh].content).toLocaleString()} mots
            </div>
          )}

          <button className="btn btn-ai" onClick={analyzeChapter} disabled={loading || selectedCh === null} style={{ fontSize: "0.9rem" }}>
            <span>✦</span>{loading ? "Analyse en cours…" : "Analyser ce chapitre"}
          </button>
          {loading && <div className="ai-thinking mt-8"><div className="spinner"/>L'IA lit attentivement votre texte…</div>}
          {result && <div className="ai-output" style={{ marginTop: 14, maxHeight: 500, overflowY: "auto" }}>{result}</div>}
        </div>
      ) : (
        <div className="card">
          <div className="card-title">✦ Vérification de cohérence globale</div>
          <p style={{ fontSize: "0.83rem", color: "var(--muted)", fontStyle: "italic", marginBottom: 14, lineHeight: 1.6 }}>
            L'IA parcourt tous vos chapitres et fiches personnages pour détecter les contradictions, incohérences, répétitions et trous narratifs.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { icon: "📚", label: `${data.chapters.length} chapitre${data.chapters.length>1?"s":""}` },
              { icon: "👤", label: `${data.characters.length} personnage${data.characters.length>1?"s":""}` },
              { icon: "📝", label: `${data.chapters.reduce((a,c)=>a+wc(c.content),0).toLocaleString()} mots analysés` },
            ].map(s => (
              <div key={s.label} style={{ padding: "6px 12px", background: "var(--paper2)", borderRadius: 3, fontSize: "0.8rem", color: "var(--muted)" }}>{s.icon} {s.label}</div>
            ))}
          </div>
          <button className="btn btn-ai" onClick={checkCoherence} disabled={loading} style={{ fontSize: "0.9rem" }}>
            <span>🔍</span>{loading ? "Analyse du manuscrit…" : "Lancer la vérification"}
          </button>
          {loading && <div className="ai-thinking mt-8"><div className="spinner"/>L'IA analyse l'ensemble de votre manuscrit…</div>}
          {result && <div className="ai-output" style={{ marginTop: 14, maxHeight: 540, overflowY: "auto" }}>{result}</div>}
        </div>
      )}
    </div>
  );
}

// ─── TAB: Export ─────────────────────────────────────────────────────────────
function TabExport({ data }) {
  const [selectedChapters, setSelectedChapters] = useState(new Set(data.chapters.map((_, i) => i)));
  const [includeChars, setIncludeChars] = useState(false);
  const [includeArcs, setIncludeArcs] = useState(false);
  const [includeSynopsis, setIncludeSynopsis] = useState(true);
  const [separator, setSeparator] = useState("---");
  const [preview, setPreview] = useState(false);

  function toggleCh(i) {
    setSelectedChapters(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function buildText() {
    const lines = [];
    if (data.novel.title) { lines.push(data.novel.title.toUpperCase()); lines.push(""); }
    if (data.novel.genre) { lines.push(`Genre : ${data.novel.genre}`); lines.push(""); }
    if (includeSynopsis && data.novel.synopsis) { lines.push("SYNOPSIS"); lines.push(""); lines.push(data.novel.synopsis); lines.push(""); lines.push(separator); lines.push(""); }

    if (includeArcs) {
      const arcLabels = { exposition: "Exposition", incitingIncident: "Élément déclencheur", risingAction: "Montée de l'action", climax: "Climax", fallingAction: "Retombée", resolution: "Résolution" };
      const hasArcs = Object.values(data.arcs || {}).some(v => v?.trim());
      if (hasArcs) {
        lines.push("STRUCTURE NARRATIVE"); lines.push("");
        Object.entries(data.arcs || {}).forEach(([k, v]) => { if (v?.trim()) { lines.push(`${arcLabels[k]} :`); lines.push(v); lines.push(""); } });
        lines.push(separator); lines.push("");
      }
    }

    if (includeChars && data.characters.length > 0) {
      lines.push("PERSONNAGES"); lines.push("");
      data.characters.forEach(c => {
        lines.push(`${c.name}${c.role ? ` (${c.role})` : ""}${c.age ? ` — ${c.age}` : ""}`);
        if (c.description) lines.push(c.description);
        if (c.traits) lines.push(`Traits : ${c.traits}`);
        if (c.arc) lines.push(`Arc : ${c.arc}`);
        lines.push("");
      });
      lines.push(separator); lines.push("");
    }

    data.chapters.forEach((c, i) => {
      if (!selectedChapters.has(i)) return;
      lines.push(`Chapitre ${i + 1} — ${c.title}`);
      lines.push("");
      if (c.content?.trim()) lines.push(c.content.trim());
      else if (c.summary) lines.push(`[Résumé : ${c.summary}]`);
      lines.push(""); lines.push(separator); lines.push("");
    });

    return lines.join("\n");
  }

  function downloadTxt() {
    const text = buildText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${data.novel.title || "roman"}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    const lines = [];
    if (data.novel.title) { lines.push(`# ${data.novel.title}`); lines.push(""); }
    if (data.novel.genre) { lines.push(`*Genre : ${data.novel.genre}*`); lines.push(""); }
    if (includeSynopsis && data.novel.synopsis) { lines.push("## Synopsis"); lines.push(""); lines.push(data.novel.synopsis); lines.push(""); lines.push("---"); lines.push(""); }
    data.chapters.forEach((c, i) => {
      if (!selectedChapters.has(i)) return;
      lines.push(`## Chapitre ${i + 1} — ${c.title}`);
      if (c.summary) lines.push(`*${c.summary}*`);
      lines.push("");
      if (c.content?.trim()) lines.push(c.content.trim());
      lines.push(""); lines.push("---"); lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${data.novel.title || "roman"}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalSelected = [...selectedChapters].reduce((a, i) => a + wc(data.chapters[i]?.content), 0);

  return (
    <div>
      <div className="section-header"><span>📤 Exporter le Manuscrit</span></div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <div className="card">
            <div className="card-title">✦ Chapitres à inclure</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedChapters(new Set(data.chapters.map((_,i)=>i)))}>Tous</button>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedChapters(new Set())}>Aucun</button>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedChapters(new Set(data.chapters.map((_,i)=>i).filter(i=>data.chapters[i].status==="Terminé")))}>Terminés uniquement</button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {data.chapters.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => toggleCh(i)}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${selectedChapters.has(i)?"var(--gold)":"var(--border)"}`, borderRadius: 3, background: selectedChapters.has(i)?"var(--gold)":"transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selectedChapters.has(i) && <span style={{ color: "var(--paper)", fontSize: "0.65rem" }}>✓</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: "0.85rem" }}><span style={{ color: "var(--gold)" }}>{i+1}.</span> {c.title}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{wc(c.content).toLocaleString()} mots</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">✦ Options</div>
            {[
              { key: "includeSynopsis", label: "Inclure le synopsis", val: includeSynopsis, set: setIncludeSynopsis },
              { key: "includeChars", label: "Inclure les fiches personnages", val: includeChars, set: setIncludeChars },
              { key: "includeArcs", label: "Inclure la structure narrative", val: includeArcs, set: setIncludeArcs },
            ].map(o => (
              <div key={o.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: "pointer" }} onClick={() => o.set(v => !v)}>
                <div style={{ width: 16, height: 16, border: `2px solid ${o.val?"var(--gold)":"var(--border)"}`, borderRadius: 3, background: o.val?"var(--gold)":"transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {o.val && <span style={{ color: "var(--paper)", fontSize: "0.65rem" }}>✓</span>}
                </div>
                <span style={{ fontSize: "0.85rem" }}>{o.label}</span>
              </div>
            ))}
            <div className="field" style={{ marginTop: 10 }}>
              <label>Séparateur entre chapitres</label>
              <select value={separator} onChange={e => setSeparator(e.target.value)}>
                <option value="---">--- (tirets)</option>
                <option value="* * *">* * * (astérisques)</option>
                <option value="~ ~ ~">~ ~ ~ (tildes)</option>
                <option value="">(aucun)</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">✦ Exporter</div>
            <div style={{ padding: "12px 16px", background: "var(--paper2)", borderRadius: 4, marginBottom: 16, fontSize: "0.82rem" }}>
              <div style={{ marginBottom: 4 }}>📄 <strong>{selectedChapters.size}</strong> chapitre{selectedChapters.size>1?"s":""} sélectionné{selectedChapters.size>1?"s":""}</div>
              <div style={{ color: "var(--muted)" }}>✍ <strong>{totalSelected.toLocaleString()}</strong> mots au total</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn btn-primary" onClick={downloadTxt} style={{ justifyContent: "center" }}>
                📄 Télécharger en .txt
              </button>
              <button className="btn btn-outline" onClick={downloadMarkdown}>
                📝 Télécharger en .md (Markdown)
              </button>
              <button className="btn btn-outline" onClick={() => setPreview(p => !p)}>
                {preview ? "🙈 Masquer l'aperçu" : "👁 Aperçu du texte"}
              </button>
            </div>

            {preview && (
              <div style={{ marginTop: 14, background: "var(--paper2)", border: "1px solid var(--border)", borderRadius: 3, padding: 16, maxHeight: 400, overflowY: "auto", fontFamily: "inherit", fontSize: "0.82rem", lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--ink)" }}>
                {buildText().slice(0, 3000)}{buildText().length > 3000 ? "\n\n[… aperçu tronqué à 3000 caractères]" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const TABS = [
  { label: "Tableau de bord", icon: "📊" },
  { label: "Projet", icon: "📚" },
  { label: "Personnages", icon: "👤" },
  { label: "Structure", icon: "🗺" },
  { label: "Chapitres", icon: "📝" },
  { label: "Worldbuilding", icon: "🌍" },
  { label: "Révision", icon: "✏" },
  { label: "Export", icon: "📤" },
  { label: "Playlist", icon: "🎵" },
  { label: "Apparence", icon: "🎨" },
];

export default function App() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(() => {
    const loaded = load() || defaultData;
    // Migrate old saves that lack new fields
    return {
      ...defaultData,
      ...loaded,
      worldbuilding: loaded.worldbuilding || defaultData.worldbuilding,
      goals: loaded.goals || defaultData.goals,
    };
  });

  useEffect(() => { save(data); }, [data]);

  const ap = data.appearance;
  const fontPair = FONT_PAIRS.find(f => f.id === ap.fontId) || FONT_PAIRS[0];
  const theme = ap.theme || "parchemin";

  return (
    <>
      <GlobalStyle fontPair={fontPair} theme={theme} />
      <div className={`app ${theme}`}>
        <header className="header">
          {data.novel.cover
            ? <img src={data.novel.cover} className="header-cover" alt="Couverture" />
            : <div className="header-cover-placeholder">📚</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="header-title" style={{ fontFamily: `'${fontPair.display}', serif` }}>
              {data.novel.title || "Mon Roman"}
            </div>
            <div className="header-subtitle">
              {data.novel.genre ? `${data.novel.genre} · ` : ""}
              {data.chapters.reduce((a,c)=>a+wc(c.content),0).toLocaleString()} mots · {data.characters.length} personnage{data.characters.length!==1?"s":""} · {data.chapters.length} chapitre{data.chapters.length!==1?"s":""}
            </div>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map((t, i) => (
            <button key={t.label} className={`tab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        <main className="content">
          {tab === 0 && <TabDashboard data={data} setData={setData} />}
          {tab === 1 && <TabProjet data={data} setData={setData} />}
          {tab === 2 && <TabPersonnages data={data} setData={setData} />}
          {tab === 3 && <TabStructure data={data} setData={setData} />}
          {tab === 4 && <TabChapitres data={data} setData={setData} appearance={ap} />}
          {tab === 5 && <TabWorldbuilding data={data} setData={setData} />}
          {tab === 6 && <TabRevision data={data} />}
          {tab === 7 && <TabExport data={data} />}
          {tab === 8 && <TabPlaylist data={data} setData={setData} />}
          {tab === 9 && <TabApparence data={data} setData={setData} />}
        </main>
      </div>
    </>
  );
}
