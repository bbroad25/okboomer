import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

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

IMPORTANT — ELDER MODE IS ON: The user has requested maximum simplicity. Write as if explaining to someone who is 80 years old and has never used a smartphone. Use VERY simple words. No jargon whatsoever. Short sentences. Use analogies from everyday life from the 1960s–1980s (TV shows, household items, common experiences). Be extra warm and patient. Imagine you are sitting next to them at the kitchen table. Also increase font friendliness — keep it cozy.`;
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

  const dailyMeme = getDailyMeme();

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
    const file = e.dataTransfer.files[0];
    handleImageFile(file);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const buildMessages = () => {
    if (inputMode === "text") {
      return [{ role: "user", content: `Please explain this to me: "${textInput}"` }];
    }
    if (inputMode === "url") {
      return [{ role: "user", content: `Please explain this internet link/content to me: ${urlInput}` }];
    }
    if (inputMode === "image" && imageBase64) {
      return [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageFile.type, data: imageBase64 } },
          { type: "text", text: "Please explain this meme or image to me. What's going on here?" }
        ]
      }];
    }
    return null;
  };

  const handleSubmit = async () => {
    const messages = buildMessages();
    if (!messages) return;

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
        const lines = chunk.split("\n");
        for (const line of lines) {
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
    if (loading || streaming) return false;
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
      if (line.includes("What it means:")) {
        if (current) sections.push(current);
        current = { icon: "📖", label: "What it means", body: "" };
      } else if (line.includes("The backstory:")) {
        if (current) sections.push(current);
        current = { icon: "🕰️", label: "The backstory", body: "" };
      } else if (line.includes("Use it in a sentence:")) {
        if (current) sections.push(current);
        current = { icon: "💬", label: "Use it in a sentence", body: "" };
      } else if (line.includes("Boomer Rating:")) {
        if (current) sections.push(current);
        current = { icon: "📊", label: "Boomer Rating", body: "" };
      } else if (current) {
        const cleaned = line.replace(/^\*\*.*?\*\*\s*/, "").trim();
        if (cleaned) current.body += (current.body ? " " : "") + cleaned;
      }
    }
    if (current) sections.push(current);
    return sections.filter(s => s.body);
  };

  const resetImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetAll = () => {
    setResponse(null);
    setTextInput("");
    setUrlInput("");
    resetImage();
    setError(null);
  };

  const hasResponse = response !== null && response.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
        .ok-boomer-logo {
          font-family: 'Abril Fatface', 'Times New Roman', serif;
          font-size: clamp(36px, 10vw, 108px);
          line-height: 1; letter-spacing: 1px; display: inline-block;
          filter: drop-shadow(3px 3px 0px rgba(0,0,0,0.18));
          white-space: nowrap;
        }
        .ok-boomer-logo span { display: inline-block; }
        .l1 { color: #4285F4; } .l2 { color: #EA4335; } .l3 { color: #FBBC05; }
        .l4 { color: #4285F4; } .l5 { color: #34A853; } .l6 { color: #EA4335; }
        .l7 { color: #FBBC05; } .l8 { color: #34A853; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .streaming-cursor::after { content: '▍'; animation: blink 0.7s infinite; font-size: 0.85em; margin-left: 2px; }
        .elder-toggle { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
        .elder-toggle input { opacity: 0; width: 0; height: 0; }
        .elder-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 26px; transition: .3s; }
        .elder-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
        input:checked + .elder-slider { background: #e63946; }
        input:checked + .elder-slider:before { transform: translateX(22px); }
        .example-chip { transition: all 0.15s; }
        .example-chip:hover { background: #1a1a2e !important; color: #fff !important; border-color: #1a1a2e !important; }
        .daily-meme-btn:hover { background: #c0303c !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "3px solid #e8e8e8", padding: "20px 16px 16px", textAlign: "center" }}>
        <div className="ok-boomer-logo">
          <span className="l1">O</span><span className="l2">k</span>
          <span style={{color:"#ccc",margin:"0 4px",fontSize:"0.6em"}}>·</span>
          <span className="l3">B</span><span className="l4">o</span><span className="l5">o</span><span className="l6">m</span><span className="l7">e</span><span className="l8">r</span>
        </div>
        <div style={{ color: "#777", fontSize: "14px", marginTop: "6px", fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
          "No, Grandpa, it's not a virus. Let us explain."
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "10px", fontSize: "10px", color: "#aaa", letterSpacing: "1px", fontFamily: "'Georgia', serif", flexWrap: "wrap" }}>
          <span>✦ MEMES DECODED</span><span>✦ SLANG TRANSLATED</span><span>✦ VIBES EXPLAINED</span>
        </div>
        <div style={{ marginTop: "14px" }}>
          <Link to="/sniff" style={{
            display: "inline-block",
            background: "#1a1a2e", color: "#fff",
            fontFamily: "'Georgia', serif", fontSize: "12px",
            fontWeight: "bold", letterSpacing: "1.5px",
            padding: "7px 18px", borderRadius: "2px",
            textDecoration: "none", textTransform: "uppercase",
            border: "2px solid #1a1a2e",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.target.style.background = "#e63946"; e.target.style.borderColor = "#e63946"; }}
          onMouseLeave={e => { e.target.style.background = "#1a1a2e"; e.target.style.borderColor = "#1a1a2e"; }}
          >
            🔍 Does This Smell Funny? →
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Daily Meme Banner */}
        <div style={{
          background: "#1a1a2e", border: "2px solid #1a1a2e", borderRadius: "2px",
          padding: "10px 14px", marginBottom: "16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "10px", boxShadow: "3px 3px 0 #e63946",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span style={{ fontSize: "14px", flexShrink: 0 }}>📅</span>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: "10px", letterSpacing: "1px", color: "#aaa", fontFamily: "'Georgia', serif", textTransform: "uppercase" }}>Today: </span>
              <span style={{ color: "#fff", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "13px" }}>"{dailyMeme.label}"</span>
            </div>
          </div>
          <button
            className="daily-meme-btn"
            onClick={() => { setInputMode("text"); setTextInput(dailyMeme.text); setResponse(null); setError(null); }}
            style={{ background: "#e63946", color: "#fff", border: "none", borderRadius: "2px", padding: "6px 12px", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "11px", cursor: "pointer", letterSpacing: "1px", whiteSpace: "nowrap", transition: "background 0.15s", flexShrink: 0 }}
          >
            Explain →
          </button>
        </div>

        {/* Elder Mode Toggle */}
        <div style={{
          background: elderMode ? "#fff5f5" : "#fff",
          border: `2px solid ${elderMode ? "#e63946" : "#e8e8e8"}`,
          borderRadius: "2px", padding: "10px 14px", marginBottom: "16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>👴</span>
            <div>
              <div style={{ fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "14px", color: "#1a1a2e" }}>Explain it like I'm 80</div>
              <div style={{ fontFamily: "'Georgia', serif", fontSize: "12px", color: "#888", fontStyle: "italic" }}>
                {elderMode ? "Extra simple mode ON — kitchen table language only" : "Turn on for maximum simplicity. No jargon. No mercy."}
              </div>
            </div>
          </div>
          <label className="elder-toggle">
            <input type="checkbox" checked={elderMode} onChange={e => setElderMode(e.target.checked)} />
            <span className="elder-slider"></span>
          </label>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: "flex", marginBottom: "16px", border: "2px solid #1a1a2e", overflow: "hidden", borderRadius: "2px" }}>
          {[
            { id: "text", label: "📝 Type Slang" },
            { id: "url", label: "🔗 Paste a Link" },
            { id: "image", label: "🖼️ Upload a Meme" },
          ].map((m) => (
            <button key={m.id}
              onClick={() => { setInputMode(m.id); setResponse(null); setError(null); }}
              style={{
                flex: 1, padding: "12px 8px", border: "none", borderRight: "2px solid #1a1a2e",
                background: inputMode === m.id ? "#1a1a2e" : "#FFF8EE",
                color: inputMode === m.id ? "#fff" : "#1a1a2e",
                fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "13px",
                cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.5px",
              }}
            >{m.label}</button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "24px", marginBottom: "20px", boxShadow: "4px 4px 0 #1a1a2e" }}>
          {inputMode === "text" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "10px", textTransform: "uppercase" }}>
                What confusing thing did you encounter?
              </label>
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                placeholder={`Type or paste anything confusing here...\n\nExamples: "no cap fr fr", "he's lowkey salty rn", "it's giving main character energy"`}
                style={{ width: "100%", minHeight: "120px", border: "2px solid #ddd", borderRadius: "2px", padding: "12px", fontFamily: "'Georgia', serif", fontSize: "16px", resize: "vertical", outline: "none", boxSizing: "border-box", background: "#FFFDF9", lineHeight: "1.6" }}
                onFocus={e => e.target.style.borderColor = "#e63946"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
              />
            </div>
          )}
          {inputMode === "url" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "10px", textTransform: "uppercase" }}>
                Paste a link your grandkid sent you
              </label>
              <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="https://... or just paste whatever link is confusing you"
                style={{ width: "100%", border: "2px solid #ddd", borderRadius: "2px", padding: "14px 12px", fontFamily: "'Georgia', serif", fontSize: "15px", outline: "none", boxSizing: "border-box", background: "#FFFDF9" }}
                onFocus={e => e.target.style.borderColor = "#e63946"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
              />
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px", fontStyle: "italic" }}>We'll explain what the link appears to be about based on context.</p>
            </div>
          )}
          {inputMode === "image" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "10px", textTransform: "uppercase" }}>
                Upload the meme (or confusing image)
              </label>
              {!imagePreview ? (
                <div ref={dragRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `3px dashed ${dragOver ? "#e63946" : "#ccc"}`, borderRadius: "2px", padding: "40px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? "#fff5f5" : "#FFFDF9", transition: "all 0.2s" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🖼️</div>
                  <div style={{ fontFamily: "'Georgia', serif", color: "#555", fontSize: "15px" }}>Drag & drop your meme here, or click to browse</div>
                  <div style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>JPG, PNG, GIF, WEBP supported</div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <img src={imagePreview} alt="Uploaded meme" style={{ maxWidth: "100%", maxHeight: "320px", display: "block", border: "2px solid #1a1a2e", borderRadius: "2px" }} />
                  <button onClick={resetImage} style={{ position: "absolute", top: "8px", right: "8px", background: "#e63946", color: "#fff", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={!canSubmit()}
          style={{
            width: "100%", padding: "18px", background: canSubmit() ? "#e63946" : "#ccc",
            color: "#fff", border: "none", borderRadius: "2px", fontSize: "18px",
            fontFamily: "'Georgia', serif", fontWeight: "bold",
            cursor: canSubmit() ? "pointer" : "not-allowed",
            letterSpacing: "2px", textTransform: "uppercase",
            boxShadow: canSubmit() ? "4px 4px 0 #1a1a2e" : "none",
            transition: "all 0.1s", marginBottom: "32px",
          }}
          onMouseEnter={e => { if (canSubmit()) e.target.style.transform = "translate(-2px, -2px)"; }}
          onMouseLeave={e => { e.target.style.transform = "none"; }}
        >
          {loading ? "🤔 Asking a Young Person..." : "🔍 Explain This To Me"}
        </button>

        {/* Loading (before first token) */}
        {loading && (
          <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "32px", textAlign: "center", boxShadow: "4px 4px 0 #1a1a2e", marginBottom: "24px" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>📰</div>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#1a1a2e" }}>Consulting our intern who is 23 years old...</div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "8px", fontStyle: "italic" }}>(She sighed, but she's explaining it)</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#fff5f5", border: "2px solid #e63946", borderRadius: "2px", padding: "20px", color: "#e63946", fontFamily: "'Georgia', serif", fontSize: "15px", marginBottom: "24px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Response (streams in) */}
        {hasResponse && (() => {
          const sections = parseResponse(response);
          return (
            <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", overflow: "hidden", boxShadow: "4px 4px 0 #1a1a2e", animation: "fadeIn 0.3s ease" }}>
              <div style={{ background: "#1a1a2e", padding: "14px 24px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "20px" }}>📰</span>
                <span style={{ color: "#fff", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "14px", letterSpacing: "2px", textTransform: "uppercase" }}>Translation Complete</span>
                {elderMode && (
                  <span style={{ background: "#FBBC05", color: "#1a1a2e", fontSize: "10px", letterSpacing: "1px", padding: "3px 8px", fontFamily: "'Georgia', serif", fontWeight: "bold", borderRadius: "2px" }}>👴 ELDER MODE</span>
                )}
                <span style={{ marginLeft: "auto", background: "#e63946", color: "#fff", fontSize: "10px", letterSpacing: "2px", padding: "3px 8px", fontFamily: "'Georgia', serif" }}>BOOMER EDITION</span>
              </div>

              {sections.length > 0 ? (
                <div>
                  {sections.map((section, i) => (
                    <div key={i} style={{ padding: "20px 24px", borderBottom: i < sections.length - 1 ? "1px solid #e8ddd0" : "none", background: i % 2 === 0 ? "#fff" : "#FFFDF9" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'Georgia', serif" }}>
                        {section.icon} {section.label}
                      </div>
                      <div
                        className={streaming && i === sections.length - 1 ? "streaming-cursor" : ""}
                        style={{ fontFamily: "'Georgia', serif", fontSize: elderMode ? "18px" : "16px", lineHeight: "1.7", color: "#1a1a2e" }}
                      >
                        {section.body}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={streaming ? "streaming-cursor" : ""}
                  style={{ padding: "24px", fontFamily: "'Georgia', serif", fontSize: elderMode ? "18px" : "16px", lineHeight: "1.7", color: "#1a1a2e" }}>
                  {response}
                </div>
              )}

              {!streaming && (
                <div style={{ background: "#f5f0e8", padding: "14px 24px", borderTop: "2px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#888", fontStyle: "italic", fontFamily: "'Georgia', serif" }}>OkBoomer™ — Bridging the generational divide, one meme at a time</span>
                  <button onClick={resetAll} style={{ background: "none", border: "1px solid #ccc", padding: "6px 14px", fontFamily: "'Georgia', serif", fontSize: "12px", cursor: "pointer", color: "#555", borderRadius: "2px" }}>
                    Try Another
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Example chips */}
        {!hasResponse && !loading && !streaming && (
          <div style={{ marginTop: "40px", borderTop: "2px solid #e8ddd0", paddingTop: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#aaa", textTransform: "uppercase", marginBottom: "16px", fontFamily: "'Georgia', serif" }}>
              Try These Examples
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {["no cap fr fr","he really said 'bet'","that's giving","it's the vibe for me","slay bestie","main character energy","touch grass","rent free","it's lowkey bussin","understood the assignment"].map(ex => (
                <button key={ex} className="example-chip"
                  onClick={() => { setInputMode("text"); setTextInput(ex); setResponse(null); }}
                  style={{ background: "#FFF8EE", border: "1px solid #ccc", borderRadius: "2px", padding: "7px 14px", fontFamily: "'Georgia', serif", fontSize: "13px", cursor: "pointer", color: "#555" }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
