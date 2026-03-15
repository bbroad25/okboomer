import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useUsageLimit, PaywallMessage, UsageCounter, SupportButtons } from "./usage.jsx";

const SMELL_LEVELS = [
  { max: 1,  emoji: "😌", label: "Squeaky Clean",       color: "#34A853", desc: "Totally legit. You can relax." },
  { max: 2,  emoji: "🙂", label: "Probably Fine",        color: "#34A853", desc: "Very likely real. No red flags." },
  { max: 3,  emoji: "🤔", label: "Mildly Suspicious",    color: "#FBBC05", desc: "Something feels a little off." },
  { max: 4,  emoji: "👃", label: "Smells Funny",         color: "#FBBC05", desc: "Your nose is right to twitch." },
  { max: 5,  emoji: "😬", label: "Proceed With Caution", color: "#FBBC05", desc: "Don't share this at dinner." },
  { max: 6,  emoji: "🚩", label: "Multiple Red Flags",   color: "#EA4335", desc: "This has the hallmarks of nonsense." },
  { max: 7,  emoji: "🤥", label: "Likely Fabricated",    color: "#EA4335", desc: "Someone made this up. Probably." },
  { max: 8,  emoji: "🗑️", label: "Grade-A Baloney",      color: "#EA4335", desc: "This is, with high confidence, garbage." },
  { max: 9,  emoji: "☣️", label: "Certified Nonsense",   color: "#c0303c", desc: "Do not forward. Do not discuss. Delete." },
  { max: 10, emoji: "🚨", label: "FULL SCAM ALERT",      color: "#c0303c", desc: "Change your passwords. Call your bank. Hug someone." },
];

function getLevel(score) {
  return SMELL_LEVELS.find(l => score <= l.max) || SMELL_LEVELS[SMELL_LEVELS.length - 1];
}

const SYSTEM_PROMPT = `You are the OkBoomer Sniff Test — a sharp-eyed, sarcastic-but-caring BS detector built specifically for Baby Boomers who forward things on Facebook without checking if they're real.

Your job: analyze screenshots, images, texts, headlines, or links and tell the user whether it's real, fake, AI-generated, a scam, misinformation, or clickbait.

You detect:
- Fake news and misinformation (fabricated quotes, doctored headlines, false statistics)
- AI-generated images (telltale signs: weird hands, too-smooth skin, garbled text, uncanny symmetry)
- Scam texts and phishing attempts (urgency, suspicious links, impersonation, prize claims)
- Clickbait headlines (exaggerated, missing context, designed to outrage)
- Manipulated or out-of-context images

Tone: You are helpful, direct, and equal parts warm and sarcastic. Think: a sharp friend who worked in journalism for 30 years and has seen everything. You're not mean — but you don't sugarcoat either. Light jokes are encouraged.

ALWAYS structure your response EXACTLY like this:

🔢 **Smell Test Score: X/10**
(X is a number 1–10. 1 = totally real and fine. 10 = complete fabricated scam.)

🔎 **What I'm looking at:**
(Describe what's in the image/text — 1-2 sentences)

⚠️ **Red flags:**
(List specific suspicious things. If nothing is wrong, say so warmly.)

✅ **What's actually true (if anything):**
(Confirm truth, explain fabrication, or validate if real.)

💡 **What to do:**
(Concrete next step: "safe to share", "do not forward", "delete and block", "call your bank", etc.)

Rules:
- Never be condescending — curiosity is healthy
- If it's real and fine, say so warmly and maybe poke fun at how cautious they are
- If it's a scam, be very clear and direct
- Max ~250 words total`;

export default function SniffTest() {
  const [inputMode, setInputMode] = useState("image");
  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [response, setResponse] = useState(null);
  const [score, setScore] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const { usesLeft, recordUse, isLimited } = useUsageLimit();

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

  const resetImage = () => {
    setImageFile(null); setImagePreview(null); setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetAll = () => {
    setResponse(null); setScore(null); setTextInput(""); resetImage(); setError(null);
  };

  const canSubmit = () => {
    if (loading || streaming || isLimited) return false;
    if (inputMode === "image") return !!imageBase64;
    return textInput.trim().length > 0;
  };

  const extractScore = (text) => {
    const match = text.match(/Smell Test Score:\s*(\d+)/i);
    return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : null;
  };

  const buildMessages = () => {
    if (inputMode === "image" && imageBase64) {
      return [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: imageFile.type, data: imageBase64 } },
        { type: "text", text: "Please run the sniff test on this image/screenshot. Is it real, fake, AI-generated, a scam, or misinformation?" }
      ]}];
    }
    return [{ role: "user", content: `Please run the sniff test on this: "${textInput}"` }];
  };

  const handleSubmit = async () => {
    const messages = buildMessages();
    if (!messages || isLimited) return;
    recordUse();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true); setStreaming(true); setError(null); setResponse(""); setScore(null);
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
          max_tokens: 1200,
          stream: true,
          system: SYSTEM_PROMPT,
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
                const s = extractScore(fullText);
                if (s) setScore(s);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") { setError("Something went sideways. Try again!"); setResponse(null); }
    } finally {
      setLoading(false); setStreaming(false);
    }
  };

  const parseResponse = (text) => {
    const sections = [];
    const lines = text.split("\n");
    let current = null;
    const headers = [
      { match: "What I'm looking at:", icon: "🔎", label: "What I'm looking at" },
      { match: "Red flags:",           icon: "⚠️", label: "Red flags" },
      { match: "What's actually true", icon: "✅", label: "What's actually true" },
      { match: "What to do:",          icon: "💡", label: "What to do" },
    ];
    for (const line of lines) {
      if (line.includes("Smell Test Score:")) continue;
      const header = headers.find(h => line.includes(h.match));
      if (header) {
        if (current) sections.push(current);
        current = { icon: header.icon, label: header.label, body: "" };
      } else if (current) {
        const cleaned = line.replace(/^\*\*.*?\*\*\s*/, "").trim();
        if (cleaned) current.body += (current.body ? " " : "") + cleaned;
      }
    }
    if (current) sections.push(current);
    return sections.filter(s => s.body);
  };

  const level = score ? getLevel(score) : null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      background: "#f9f9f9",
      fontFamily: "Georgia, 'Times New Roman', serif",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes flipIn { from{opacity:0;transform:rotateY(90deg) scale(0.95)} to{opacity:1;transform:rotateY(0deg) scale(1)} }
        @keyframes meterFill { from{width:0%} to{width:var(--target-width)} }
        .streaming-cursor::after { content:'▍'; animation:blink 0.7s infinite; font-size:0.85em; margin-left:2px; }
        .flip-panel { animation: flipIn 0.3s ease forwards; transform-origin: center; }
        .result-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .result-scroll::-webkit-scrollbar { width: 4px; }
        .result-scroll::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
        .meter-bar { animation: meterFill 0.8s ease-out forwards; }
        .sniff-logo { font-family: 'Abril Fatface', 'Times New Roman', serif; font-size: clamp(28px, 7vw, 56px); line-height: 1; white-space: nowrap; }
        .example-chip:hover { background: #1a1a2e !important; color: #fff !important; border-color: #1a1a2e !important; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "2px solid #e8e8e8", padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
        <div className="sniff-logo">
          <span style={{ color: "#EA4335" }}>S</span>
          <span style={{ color: "#4285F4" }}>n</span>
          <span style={{ color: "#FBBC05" }}>i</span>
          <span style={{ color: "#34A853" }}>f</span>
          <span style={{ color: "#EA4335" }}>f</span>
          <span style={{ color: "#ccc", margin: "0 4px", fontSize: "0.5em" }}>·</span>
          <span style={{ color: "#4285F4" }}>T</span>
          <span style={{ color: "#FBBC05" }}>e</span>
          <span style={{ color: "#34A853" }}>s</span>
          <span style={{ color: "#EA4335" }}>t</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "10px", color: "#aaa", letterSpacing: "1px" }}>
            <span>🤥 FAKE NEWS</span>
            <span style={{ margin: "0 6px" }}>🤖 AI</span>
            <span>🎣 SCAMS</span>
            <span style={{ margin: "0 6px" }}>📢 CLICKBAIT</span>
          </div>
          <Link to="/" style={{ background: "#1a1a2e", color: "#fff", fontFamily: "Georgia, serif", fontSize: "10px", fontWeight: "bold", letterSpacing: "1px", padding: "4px 10px", borderRadius: "2px", textDecoration: "none", textTransform: "uppercase" }}>
            ← OkBoomer
          </Link>
        </div>
      </header>

      {/* MAIN FLIP CONTAINER */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", padding: "10px 12px 6px" }}>

        {/* INPUT PANEL */}
        {!showResult && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>

            {/* Mode tabs */}
            <div style={{ display: "flex", border: "2px solid #1a1a2e", overflow: "hidden", borderRadius: "2px", flexShrink: 0 }}>
              {[
                { id: "image", label: "📸 Upload Screenshot" },
                { id: "text",  label: "✏️ Paste Text / URL" },
              ].map(m => (
                <button key={m.id}
                  onClick={() => { setInputMode(m.id); setError(null); }}
                  style={{ flex: 1, padding: "10px 4px", border: "none", borderRight: "2px solid #1a1a2e", background: inputMode === m.id ? "#1a1a2e" : "#FFF8EE", color: inputMode === m.id ? "#fff" : "#1a1a2e", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: "12px", cursor: "pointer", transition: "all 0.15s" }}
                >{m.label}</button>
              ))}
            </div>

            {/* Input box */}
            <div style={{ flex: 1, background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "14px", boxShadow: "3px 3px 0 #1a1a2e", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {inputMode === "image" && (
                <>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "8px", textTransform: "uppercase" }}>
                    Upload the suspicious thing
                  </label>
                  {!imagePreview ? (
                    <div onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ flex: 1, border: `3px dashed ${dragOver ? "#e63946" : "#ccc"}`, borderRadius: "2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: dragOver ? "#fff5f5" : "#FFFDF9", transition: "all 0.2s" }}>
                      <div style={{ fontSize: "36px", marginBottom: "8px" }}>📸</div>
                      <div style={{ fontFamily: "Georgia, serif", color: "#555", fontSize: "14px" }}>Tap to upload a screenshot</div>
                      <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>News · Texts · Social posts · Images</div>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={imagePreview} alt="Upload preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", border: "2px solid #1a1a2e", borderRadius: "2px" }} />
                      <button onClick={resetImage} style={{ position: "absolute", top: "6px", right: "6px", background: "#e63946", color: "#fff", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>✕</button>
                    </div>
                  )}
                </>
              )}
              {inputMode === "text" && (
                <>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "8px", textTransform: "uppercase" }}>
                    Paste the suspicious text or URL
                  </label>
                  <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                    placeholder={'Paste anything suspicious...\n\n"You\'ve been selected for a free iPhone!"\n"BREAKING: Famous celebrity dies"\n"Forward this or bad luck for 7 years"'}
                    style={{ flex: 1, border: "2px solid #ddd", borderRadius: "2px", padding: "10px", fontFamily: "Georgia, serif", fontSize: "14px", resize: "none", outline: "none", background: "#FFFDF9", lineHeight: "1.6", width: "100%" }}
                    onFocus={e => e.target.style.borderColor = "#e63946"}
                    onBlur={e => e.target.style.borderColor = "#ddd"}
                  />
                </>
              )}
            </div>

            {/* Example chips — text mode only */}
            {inputMode === "text" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", flexShrink: 0 }}>
                {["Free iPhone selected","BREAKING: Celebrity dies","Forward or bad luck","Account compromised","Doctors HATE this trick","Govt doesn't want you to know"].map(ex => (
                  <button key={ex} className="example-chip"
                    onClick={() => setTextInput(ex)}
                    style={{ background: "#FFF8EE", border: "1px solid #ccc", borderRadius: "2px", padding: "4px 10px", fontFamily: "Georgia, serif", fontSize: "11px", cursor: "pointer", color: "#555", transition: "all 0.15s" }}>
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
                  style={{ width: "100%", padding: "14px", background: canSubmit() ? "#1a1a2e" : "#ccc", color: "#fff", border: "none", borderRadius: "2px", fontSize: "16px", fontFamily: "Georgia, serif", fontWeight: "bold", cursor: canSubmit() ? "pointer" : "not-allowed", letterSpacing: "2px", textTransform: "uppercase", boxShadow: canSubmit() ? "3px 3px 0 #e63946" : "none", transition: "all 0.1s" }}
                  onMouseEnter={e => { if (canSubmit()) e.target.style.transform = "translate(-2px,-2px)"; }}
                  onMouseLeave={e => { e.target.style.transform = "none"; }}
                >
                  👃 Run the Sniff Test
                </button>
              )}
            </div>
          </div>
        )}

        {/* RESULT PANEL */}
        {showResult && (
          <div className="flip-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>

            {/* Loading */}
            {loading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", boxShadow: "3px 3px 0 #1a1a2e" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px", animation: "spin 1s linear infinite" }}>🔬</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "17px", color: "#1a1a2e" }}>Putting on the reading glasses...</div>
                <div style={{ fontSize: "12px", color: "#888", marginTop: "6px", fontStyle: "italic" }}>(Checking for fingerprints, bad grammar, and suspicious vibes)</div>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ background: "#fff5f5", border: "2px solid #e63946", borderRadius: "2px", padding: "20px", color: "#e63946", fontFamily: "Georgia, serif", fontSize: "15px" }}>
                  ⚠️ {error}
                </div>
                <button onClick={resetAll} style={{ background: "none", border: "2px solid #1a1a2e", padding: "10px", fontFamily: "Georgia, serif", fontSize: "13px", cursor: "pointer", color: "#1a1a2e", borderRadius: "2px" }}>
                  ← Try Again
                </button>
              </div>
            )}

            {/* Response */}
            {!loading && !error && response !== null && (() => {
              const sections = parseResponse(response);
              const lvl = level;
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "2px solid #1a1a2e", borderRadius: "2px", overflow: "hidden", boxShadow: "3px 3px 0 #1a1a2e" }}>

                  {/* Score header */}
                  {lvl && (
                    <div style={{ background: "#1a1a2e", padding: "12px 16px", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "28px" }}>{lvl.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: lvl.color, fontFamily: "'Abril Fatface', serif", fontSize: "18px", letterSpacing: "1px" }}>{lvl.label}</div>
                          <div style={{ color: "#aaa", fontFamily: "Georgia, serif", fontSize: "11px", fontStyle: "italic" }}>{lvl.desc}</div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Abril Fatface', serif", fontSize: "30px", color: lvl.color, lineHeight: 1 }}>{score}</div>
                          <div style={{ color: "#666", fontSize: "10px", fontFamily: "Georgia, serif" }}>/10</div>
                        </div>
                      </div>
                      <div style={{ background: "#2a2a3e", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                        <div className="meter-bar" style={{ height: "100%", background: "linear-gradient(90deg, #34A853, #FBBC05, #EA4335)", borderRadius: "4px", "--target-width": `${score * 10}%`, width: "0%" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                        <span style={{ color: "#34A853", fontSize: "9px", fontFamily: "Georgia, serif" }}>Totally Fine</span>
                        <span style={{ color: "#EA4335", fontSize: "9px", fontFamily: "Georgia, serif" }}>Call Your Bank</span>
                      </div>
                    </div>
                  )}

                  {/* Scrollable sections */}
                  <div className="result-scroll" style={{ flex: 1 }}>
                    {sections.length > 0 ? sections.map((section, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: i < sections.length - 1 ? "1px solid #e8ddd0" : "none", background: i % 2 === 0 ? "#fff" : "#FFFDF9" }}>
                        <div style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", textTransform: "uppercase", marginBottom: "5px", fontFamily: "Georgia, serif" }}>
                          {section.icon} {section.label}
                        </div>
                        <div className={streaming && i === sections.length - 1 ? "streaming-cursor" : ""}
                          style={{ fontFamily: "Georgia, serif", fontSize: "14px", lineHeight: "1.65", color: "#1a1a2e" }}>
                          {section.body}
                        </div>
                      </div>
                    )) : (
                      <div className={streaming ? "streaming-cursor" : ""}
                        style={{ padding: "16px", fontFamily: "Georgia, serif", fontSize: "14px", lineHeight: "1.65", color: "#1a1a2e" }}>
                        {response}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {!streaming && (
                    <div style={{ background: "#f5f0e8", padding: "10px 16px", borderTop: "2px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                      <SupportButtons />
                      <button onClick={resetAll} style={{ background: "none", border: "1px solid #ccc", padding: "5px 12px", fontFamily: "Georgia, serif", fontSize: "12px", cursor: "pointer", color: "#555", borderRadius: "2px" }}>
                        ← Sniff Another
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
