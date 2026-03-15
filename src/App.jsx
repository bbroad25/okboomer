import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useUsageLimit, PaywallMessage, UsageCounter, SupportButtons } from "./usage.jsx";

const DAILY_MEMES = [
  { label: "NPC", text: "NPC" },
  { label: "Rizz", text: "rizz" },
  { label: "Caught in 4K", text: "caught in 4K" },
  { label: "It's giving...", text: "it's giving" },
  { label: "Understood the assignment", text: "understood the assignment" },
  { label: "Rent free", text: "living in my head rent free" },
  { label: "Slay", text: "slay" },
  { label: "No cap", text: "no cap fr fr" },
  { label: "Bussin", text: "it's lowkey bussin no cap" },
  { label: "Touch grass", text: "touch grass" },
  { label: "Main character", text: "main character energy" },
  { label: "Delulu", text: "she's so delulu" },
  { label: "Situationship", text: "situationship" },
  { label: "Ick", text: "that gives me the ick" },
  { label: "Era", text: "I'm in my villain era" },
  { label: "Ate and left no crumbs", text: "she ate and left no crumbs" },
  { label: "Sneaky link", text: "sneaky link" },
  { label: "Roman Empire", text: "my Roman Empire" },
  { label: "Brain rot", text: "this is peak brain rot content" },
  { label: "Skibidi", text: "skibidi" },
  { label: "Sigma", text: "sigma grindset" },
  { label: "Mid", text: "that movie was mid" },
  { label: "Lowkey / Highkey", text: "I'm lowkey highkey obsessed" },
  { label: "Gaslight Gatekeep Girlboss", text: "gaslight gatekeep girlboss" },
  { label: "Sending me", text: "this is sending me" },
  { label: "FR FR", text: "fr fr no printer" },
  { label: "Hits different", text: "this hits different at 2am" },
  { label: "Go off", text: "go off I guess" },
];

function getDailyMeme() {
  const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_MEMES.length;
  return DAILY_MEMES[dayIndex];
}

function buildSystemPrompt(elderMode) {
  const base = `You are OkBoomer — a wisecracking but genuinely helpful translator for Baby Boomers who are lost in the internet. Think: the cool grandkid who actually explains things instead of rolling their eyes. You have mild attitude. You make jokes. You are not a robot.

Your job: decode internet slang, memes, Gen-Z/Millennial phrases, and viral culture so a 68-year-old can finally understand what their grandkids are laughing about.

Guidelines:
- For IMAGES/MEMES: First identify exactly what's in the image — if there's a recognizable person, celebrity, actor, or character, NAME THEM and briefly say who they are (e.g. "That's Willem Dafoe, the actor best known for Platoon and Spider-Man — he has a famously unhinged facial expression that the internet loves"). Then explain the meme format, the joke, and why it's funny. Don't be vague — boomers can't fill in the gaps.
- READ THE ROOM on subtext and innuendo. If a meme has an obvious double meaning or adult joke hiding behind an innocent surface (e.g. a caption that sounds crude next to an image), acknowledge the real joke — that's usually WHY it's funny. Don't pretend the subtext isn't there. You can be tasteful about HOW you explain it without pretending it doesn't exist. A boomer who doesn't get the real joke is more confused, not less.
- If the joke is clearly sexual innuendo or adult humor, say so plainly and explain it like a worldly adult — brief, matter-of-fact, not prudish. e.g. "Yes, this is a [type] joke. Here's why the internet found it funny." IMPORTANT: When a caption like "it can't be that good" or similar appears next to any image, ask yourself if a 25-year-old would read this as a sex joke before anything else. If yes, that's the joke. Lead with it. The fact that the image is a cartoon or family-friendly character is often PART of the joke — the absurd contrast is intentional. Don't let a recognizable character distract you from the obvious adult punchline.
- For TEXT/SLANG: Give the plain-English meaning immediately, no throat-clearing.
- For URLs: Explain what kind of content it links to based on context clues.
- Be funny. Throw in a light joke or a witty aside. A little sarcasm is fine — but you're never mean to the person asking.
- If the content is totally wholesome, reassure them warmly (maybe tease them a little for being worried).
- If something is edgy, explain it tastefully without being graphic.
- Max response length: ~220 words. Be punchy. No padding.

Format your response with EXACTLY these section headers:
📖 **What it means:**
🕰️ **The backstory:**
💬 **Use it in a sentence:**
📊 **Boomer Rating:**

The Boomer Rating is 1–5 of these emojis: 😴 (totally harmless, go back to sleep) to 😱 (call your grandkid immediately). Always add a one-liner after the rating emojis explaining the rating — keep it funny.`;

  if (elderMode) {
    return base + `

IMPORTANT — ELDER MODE IS ON: The user has requested maximum simplicity. Write as if explaining to someone who is 80 years old and has never used a smartphone. Use VERY simple words. No jargon whatsoever. Short sentences. Use analogies from everyday life from the 1960s–1980s (TV shows, household items, common experiences). Be extra warm and patient. Imagine you are sitting next to them at the kitchen table.`;
  }
  return base;
}

export default function OkBoomer() {
  const [inputMode, setInputMode] = useState("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [response, setResponse] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elderMode, setElderMode] = useState(false);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef(null);
  const { usesLeft, recordUse, isLimited } = useUsageLimit();

  const dailyMeme = getDailyMeme();
  const showResult = loading || (response !== null && response.length > 0) || error;

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImageBase64(e.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleImageFile(e.dataTransfer.files[0]);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const buildMessages = () => {
    if (inputMode === "text") return [{ role: "user", content: `Please explain this to me: "${textInput}"` }];
    if (inputMode === "url") return [{ role: "user", content: `Please explain this internet link/content to me: ${urlInput}` }];
    if (inputMode === "image" && imageBase64) {
      return [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: imageFile.type, data: imageBase64 } },
        { type: "text", text: "Please explain this meme or image to me. What's going on here?" }
      ]}];
    }
    return null;
  };

  const handleSubmit = async () => {
    const messages = buildMessages();
    if (!messages || isLimited) return;
    recordUse();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setStreaming(true);
    setError(null);
    setResponse("");
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: abortRef.current.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          stream: true,
          system: buildSystemPrompt(elderMode),
          messages,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setLoading(false);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                fullText += parsed.delta.text;
                setResponse(fullText);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Something went sideways. Try again!");
        setResponse(null);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const canSubmit = () => {
    if (loading || streaming || isLimited) return false;
    if (inputMode === "text") return textInput.trim().length > 0;
    if (inputMode === "url") return urlInput.trim().length > 0;
    if (inputMode === "image") return !!imageBase64;
    return false;
  };

  const parseResponse = (text) => {
    const sections = [];
    const lines = text.split("\n");
    let current = null;
    for (const line of lines) {
      if (line.includes("What it means:")) { if (current) sections.push(current); current = { icon: "📖", label: "What it means", body: "" }; }
      else if (line.includes("The backstory:")) { if (current) sections.push(current); current = { icon: "🕰️", label: "The backstory", body: "" }; }
      else if (line.includes("Use it in a sentence:")) { if (current) sections.push(current); current = { icon: "💬", label: "Use it in a sentence", body: "" }; }
      else if (line.includes("Boomer Rating:")) { if (current) sections.push(current); current = { icon: "📊", label: "Boomer Rating", body: "" }; }
      else if (current) { const cleaned = line.replace(/^\*\*.*?\*\*\s*/, "").trim(); if (cleaned) current.body += (current.body ? " " : "") + cleaned; }
    }
    if (current) sections.push(current);
    return sections.filter(s => s.body);
  };

  const resetImage = () => {
    setImageFile(null); setImagePreview(null); setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetAll = () => {
    setResponse(null); setTextInput(""); setUrlInput(""); resetImage(); setError(null);
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      background: "#f9f9f9",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
        * { box-sizing: border-box; }
        .ok-boomer-logo {
          font-family: 'Abril Fatface', 'Times New Roman', serif;
          font-size: clamp(32px, 8vw, 80px);
          line-height: 1; letter-spacing: 1px; display: inline-block;
          filter: drop-shadow(2px 2px 0px rgba(0,0,0,0.15));
          white-space: nowrap;
        }
        .ok-boomer-logo span { display: inline-block; }
        .l1{color:#4285F4}.l2{color:#EA4335}.l3{color:#FBBC05}
        .l4{color:#4285F4}.l5{color:#34A853}.l6{color:#EA4335}
        .l7{color:#FBBC05}.l8{color:#34A853}
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes flipIn {
          from { opacity: 0; transform: rotateY(90deg) scale(0.95); }
          to   { opacity: 1; transform: rotateY(0deg) scale(1); }
        }
        .streaming-cursor::after { content:'▍'; animation:blink 0.7s infinite; font-size:0.85em; margin-left:2px; }
        .elder-toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
        .elder-toggle input { opacity:0; width:0; height:0; }
        .elder-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#ccc; border-radius:24px; transition:.3s; }
        .elder-slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background:white; border-radius:50%; transition:.3s; }
        input:checked + .elder-slider { background:#e63946; }
        input:checked + .elder-slider:before { transform:translateX(20px); }
        .flip-panel { animation: flipIn 0.3s ease forwards; transform-origin: center; }
        .example-chip:hover { background:#1a1a2e!important; color:#fff!important; border-color:#1a1a2e!important; }
        .daily-btn:hover { background:#c0303c!important; }
        .result-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .result-scroll::-webkit-scrollbar { width: 4px; }
        .result-scroll::-webkit-scrollbar-track { background: transparent; }
        .result-scroll::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
      `}</style>

      {/* ── HEADER (fixed, compact) ── */}
      <header style={{ background: "#fff", borderBottom: "2px solid #e8e8e8", padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
        <div className="ok-boomer-logo">
          <span className="l1">O</span><span className="l2">k</span>
          <span style={{color:"#ccc",margin:"0 3px",fontSize:"0.55em"}}>·</span>
          <span className="l3">B</span><span className="l4">o</span><span className="l5">o</span><span className="l6">m</span><span className="l7">e</span><span className="l8">r</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "10px", color: "#aaa", letterSpacing: "1px", fontFamily: "'Georgia', serif" }}>
            <span>✦ MEMES</span> <span style={{margin:"0 4px"}}>✦ SLANG</span> <span>✦ VIBES</span>
          </div>
          <Link to="/sniff" style={{
            background: "#1a1a2e", color: "#fff", fontFamily: "'Georgia', serif",
            fontSize: "10px", fontWeight: "bold", letterSpacing: "1px",
            padding: "4px 10px", borderRadius: "2px", textDecoration: "none", textTransform: "uppercase",
          }}>
            🔍 Sniff Test →
          </Link>
        </div>
      </header>

      {/* ── TOOLBAR: daily meme + elder toggle ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexShrink: 0 }}>
        {/* Daily meme */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <span style={{ fontSize: "12px", flexShrink: 0 }}>📅</span>
          <span style={{ fontSize: "10px", color: "#aaa", fontFamily: "'Georgia', serif", textTransform: "uppercase", letterSpacing: "1px", flexShrink: 0 }}>Today:</span>
          <span style={{ color: "#1a1a2e", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{dailyMeme.label}"</span>
          <button className="daily-btn"
            onClick={() => { setInputMode("text"); setTextInput(dailyMeme.text); resetAll(); }}
            style={{ background: "#e63946", color: "#fff", border: "none", borderRadius: "2px", padding: "3px 8px", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.15s" }}>
            Go →
          </button>
        </div>
        {/* Elder toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <span style={{ fontSize: "14px" }}>👴</span>
          <span style={{ fontFamily: "'Georgia', serif", fontSize: "11px", color: elderMode ? "#e63946" : "#888", fontWeight: elderMode ? "bold" : "normal" }}>Age 80 mode</span>
          <label className="elder-toggle">
            <input type="checkbox" checked={elderMode} onChange={e => setElderMode(e.target.checked)} />
            <span className="elder-slider"></span>
          </label>
        </div>
      </div>

      {/* ── MAIN FLIP CONTAINER ── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", padding: "10px 12px 6px" }}>

        {/* INPUT PANEL */}
        {!showResult && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>

            {/* Mode tabs */}
            <div style={{ display: "flex", border: "2px solid #1a1a2e", overflow: "hidden", borderRadius: "2px", flexShrink: 0 }}>
              {[
                { id: "text", label: "📝 Type Slang" },
                { id: "url", label: "🔗 Link" },
                { id: "image", label: "🖼️ Meme" },
              ].map((m) => (
                <button key={m.id}
                  onClick={() => { setInputMode(m.id); setError(null); }}
                  style={{
                    flex: 1, padding: "10px 4px", border: "none", borderRight: "2px solid #1a1a2e",
                    background: inputMode === m.id ? "#1a1a2e" : "#FFF8EE",
                    color: inputMode === m.id ? "#fff" : "#1a1a2e",
                    fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "12px",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >{m.label}</button>
              ))}
            </div>

            {/* Input box — grows to fill */}
            <div style={{ flex: 1, background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "14px", boxShadow: "3px 3px 0 #1a1a2e", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {inputMode === "text" && (
                <>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "8px", textTransform: "uppercase" }}>
                    What confusing thing did you encounter?
                  </label>
                  <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                    placeholder={'e.g. "no cap fr fr", "it\'s giving main character energy"'}
                    style={{ flex: 1, border: "2px solid #ddd", borderRadius: "2px", padding: "10px", fontFamily: "'Georgia', serif", fontSize: "15px", resize: "none", outline: "none", background: "#FFFDF9", lineHeight: "1.6", width: "100%" }}
                    onFocus={e => e.target.style.borderColor = "#e63946"}
                    onBlur={e => e.target.style.borderColor = "#ddd"}
                  />
                </>
              )}
              {inputMode === "url" && (
                <>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "8px", textTransform: "uppercase" }}>
                    Paste a link your grandkid sent you
                  </label>
                  <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    style={{ border: "2px solid #ddd", borderRadius: "2px", padding: "12px", fontFamily: "'Georgia', serif", fontSize: "15px", outline: "none", background: "#FFFDF9", width: "100%" }}
                    onFocus={e => e.target.style.borderColor = "#e63946"}
                    onBlur={e => e.target.style.borderColor = "#ddd"}
                  />
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "8px", fontStyle: "italic" }}>We'll explain what the link is about based on context.</p>
                </>
              )}
              {inputMode === "image" && (
                <>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "8px", textTransform: "uppercase" }}>
                    Upload the meme
                  </label>
                  {!imagePreview ? (
                    <div ref={dragRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ flex: 1, border: `3px dashed ${dragOver ? "#e63946" : "#ccc"}`, borderRadius: "2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: dragOver ? "#fff5f5" : "#FFFDF9", transition: "all 0.2s" }}>
                      <div style={{ fontSize: "36px", marginBottom: "8px" }}>🖼️</div>
                      <div style={{ fontFamily: "'Georgia', serif", color: "#555", fontSize: "14px" }}>Tap to upload a meme</div>
                      <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>JPG, PNG, GIF, WEBP</div>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={imagePreview} alt="Uploaded meme" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", border: "2px solid #1a1a2e", borderRadius: "2px" }} />
                      <button onClick={resetImage} style={{ position: "absolute", top: "6px", right: "6px", background: "#e63946", color: "#fff", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>✕</button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Example chips */}
            {inputMode === "text" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", flexShrink: 0 }}>
                {["no cap","slay","bussin","touch grass","main character","rizz","delulu","understood the assignment"].map(ex => (
                  <button key={ex} className="example-chip"
                    onClick={() => setTextInput(ex)}
                    style={{ background: "#FFF8EE", border: "1px solid #ccc", borderRadius: "2px", padding: "4px 10px", fontFamily: "'Georgia', serif", fontSize: "11px", cursor: "pointer", color: "#555", transition: "all 0.15s" }}>
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {/* Usage + submit */}
            <div style={{ flexShrink: 0 }}>
              <UsageCounter usesLeft={usesLeft} />
              {isLimited ? <PaywallMessage /> : (
                <button onClick={handleSubmit} disabled={!canSubmit()}
                  style={{
                    width: "100%", padding: "14px",
                    background: canSubmit() ? "#e63946" : "#ccc",
                    color: "#fff", border: "none", borderRadius: "2px", fontSize: "16px",
                    fontFamily: "'Georgia', serif", fontWeight: "bold",
                    cursor: canSubmit() ? "pointer" : "not-allowed",
                    letterSpacing: "2px", textTransform: "uppercase",
                    boxShadow: canSubmit() ? "3px 3px 0 #1a1a2e" : "none",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={e => { if (canSubmit()) e.target.style.transform = "translate(-2px,-2px)"; }}
                  onMouseLeave={e => { e.target.style.transform = "none"; }}
                >
                  🔍 Explain This To Me
                </button>
              )}
            </div>
          </div>
        )}

        {/* RESULT PANEL — flips in over the input */}
        {showResult && (
          <div className="flip-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>

            {/* Loading state */}
            {loading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", boxShadow: "3px 3px 0 #1a1a2e" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px", animation: "spin 1s linear infinite" }}>📰</div>
                <div style={{ fontFamily: "'Georgia', serif", fontSize: "17px", color: "#1a1a2e" }}>Consulting our 23-year-old intern...</div>
                <div style={{ fontSize: "12px", color: "#888", marginTop: "6px", fontStyle: "italic" }}>(She sighed, but she's explaining it)</div>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ background: "#fff5f5", border: "2px solid #e63946", borderRadius: "2px", padding: "20px", color: "#e63946", fontFamily: "'Georgia', serif", fontSize: "15px", marginBottom: "10px" }}>
                  ⚠️ {error}
                </div>
                <button onClick={resetAll} style={{ background: "none", border: "2px solid #1a1a2e", padding: "10px", fontFamily: "'Georgia', serif", fontSize: "13px", cursor: "pointer", color: "#1a1a2e", borderRadius: "2px" }}>
                  ← Try Again
                </button>
              </div>
            )}

            {/* Response */}
            {!loading && !error && response !== null && (() => {
              const sections = parseResponse(response);
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "2px solid #1a1a2e", borderRadius: "2px", overflow: "hidden", boxShadow: "3px 3px 0 #1a1a2e" }}>
                  {/* Result header */}
                  <div style={{ background: "#1a1a2e", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "16px" }}>📰</span>
                    <span style={{ color: "#fff", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase" }}>Translation Complete</span>
                    {elderMode && <span style={{ background: "#FBBC05", color: "#1a1a2e", fontSize: "9px", letterSpacing: "1px", padding: "2px 6px", fontFamily: "'Georgia', serif", fontWeight: "bold", borderRadius: "2px" }}>👴 ELDER MODE</span>}
                    <span style={{ marginLeft: "auto", background: "#e63946", color: "#fff", fontSize: "9px", letterSpacing: "1px", padding: "2px 6px", fontFamily: "'Georgia', serif" }}>BOOMER EDITION</span>
                  </div>

                  {/* Scrollable sections */}
                  <div className="result-scroll" style={{ flex: 1 }}>
                    {sections.length > 0 ? sections.map((section, i) => (
                      <div key={i} style={{ padding: "14px 16px", borderBottom: i < sections.length - 1 ? "1px solid #e8ddd0" : "none", background: i % 2 === 0 ? "#fff" : "#FFFDF9" }}>
                        <div style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", textTransform: "uppercase", marginBottom: "6px", fontFamily: "'Georgia', serif" }}>
                          {section.icon} {section.label}
                        </div>
                        <div className={streaming && i === sections.length - 1 ? "streaming-cursor" : ""}
                          style={{ fontFamily: "'Georgia', serif", fontSize: elderMode ? "17px" : "14px", lineHeight: "1.65", color: "#1a1a2e" }}>
                          {section.body}
                        </div>
                      </div>
                    )) : (
                      <div className={streaming ? "streaming-cursor" : ""}
                        style={{ padding: "16px", fontFamily: "'Georgia', serif", fontSize: elderMode ? "17px" : "14px", lineHeight: "1.65", color: "#1a1a2e" }}>
                        {response}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {!streaming && (
                    <div style={{ background: "#f5f0e8", padding: "10px 16px", borderTop: "2px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                      <SupportButtons />
                      <button onClick={resetAll} style={{ background: "none", border: "1px solid #ccc", padding: "5px 12px", fontFamily: "'Georgia', serif", fontSize: "12px", cursor: "pointer", color: "#555", borderRadius: "2px" }}>
                        ← Try Another
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
