import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useUsageLimit, PaywallMessage, UsageCounter, BMAC_URL } from "./usage.jsx";

const SMELL_LEVELS = [
  { max: 1,  emoji: "😌", label: "Squeaky Clean",        color: "#34A853", desc: "Totally legit. You can relax." },
  { max: 2,  emoji: "🙂", label: "Probably Fine",         color: "#34A853", desc: "Very likely real. No red flags." },
  { max: 3,  emoji: "🤔", label: "Mildly Suspicious",     color: "#FBBC05", desc: "Something feels a little off." },
  { max: 4,  emoji: "👃", label: "Smells Funny",          color: "#FBBC05", desc: "Your nose is right to twitch." },
  { max: 5,  emoji: "😬", label: "Proceed With Caution",  color: "#FBBC05", desc: "Don't share this at dinner." },
  { max: 6,  emoji: "🚩", label: "Multiple Red Flags",    color: "#EA4335", desc: "This has the hallmarks of nonsense." },
  { max: 7,  emoji: "🤥", label: "Likely Fabricated",     color: "#EA4335", desc: "Someone made this up. Probably." },
  { max: 8,  emoji: "🗑️", label: "Grade-A Baloney",       color: "#EA4335", desc: "This is, with high confidence, garbage." },
  { max: 9,  emoji: "☣️", label: "Certified Nonsense",    color: "#c0303c", desc: "Do not forward. Do not discuss. Delete." },
  { max: 10, emoji: "🚨", label: "FULL SCAM ALERT",       color: "#c0303c", desc: "Change your passwords. Call your bank. Hug someone." },
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
(X is a number 1–10. 1 = totally real and fine. 10 = complete fabricated scam. Be honest and calibrated.)

🔎 **What I'm looking at:**
(Describe what's in the image/text/screenshot — 1-2 sentences so the user knows you understood it)

⚠️ **Red flags:**
(List the specific things that are suspicious, fake, or off. Be specific. If nothing is wrong, say so and be warm about it. Use plain language — no jargon.)

✅ **What's actually true (if anything):**
(If there's a kernel of truth, explain it. If it's completely fabricated, say so. If it's real, confirm that clearly.)

💡 **What to do:**
(Concrete next step: "safe to share", "do not forward", "delete and block", "call your bank", "check Snopes", etc. Keep it actionable and boomer-friendly.)

Rules:
- Never be condescending about the fact they fell for it or were suspicious — curiosity is healthy
- If it's legitimately real and fine, say so warmly and maybe poke fun at how cautious they are
- If it's a scam, be very clear and direct — their safety matters
- Max ~250 words total
- Be specific about WHY something is fake or real — vague answers help no one`;

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
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetAll = () => {
    setResponse(null);
    setScore(null);
    setTextInput("");
    resetImage();
    setError(null);
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
      return [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageFile.type, data: imageBase64 } },
          { type: "text", text: "Please run the sniff test on this image/screenshot. Is it real, fake, AI-generated, a scam, or misinformation?" }
        ]
      }];
    }
    return [{ role: "user", content: `Please run the sniff test on this: "${textInput}"` }];
  };

  const handleSubmit = async () => {
    const messages = buildMessages();
    if (!messages) return;
    if (isLimited) return;
    recordUse();

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setStreaming(true);
    setError(null);
    setResponse("");
    setScore(null);

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
      if (err.name !== "AbortError") {
        setError("Something went sideways. Try again!");
        setResponse(null);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
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
      const header = headers.find(h => line.includes(h.match));
      if (header) {
        if (current) sections.push(current);
        current = { icon: header.icon, label: header.label, body: "" };
      } else if (line.includes("Smell Test Score:")) {
        // skip — rendered separately
      } else if (current) {
        const cleaned = line.replace(/^\*\*.*?\*\*\s*/, "").trim();
        if (cleaned) current.body += (current.body ? " " : "") + cleaned;
      }
    }
    if (current) sections.push(current);
    return sections.filter(s => s.body);
  };

  const level = score ? getLevel(score) : null;
  const hasResponse = response !== null && response.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes meterFill { from { width: 0%; } to { width: var(--target-width); } }
        .streaming-cursor::after { content: '▍'; animation: blink 0.7s infinite; font-size: 0.85em; margin-left: 2px; }
        .sniff-tab:hover { background: #f0f0f0 !important; }
        .sniff-submit:hover:not(:disabled) { transform: translate(-2px, -2px); }
        .back-link:hover { color: #e63946 !important; }
        .meter-bar { animation: meterFill 0.8s ease-out forwards; }
      `}</style>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "3px solid #e8e8e8", padding: "20px 24px 18px", textAlign: "center" }}>
        <Link to="/" className="back-link" style={{ display: "inline-block", fontSize: "12px", color: "#aaa", textDecoration: "none", fontFamily: "'Georgia', serif", letterSpacing: "1px", marginBottom: "12px", transition: "color 0.15s" }}>
          ← Back to OkBoomer
        </Link>
        <div style={{ fontFamily: "'Abril Fatface', 'Times New Roman', serif", fontSize: "clamp(32px, 8vw, 64px)", lineHeight: 1, letterSpacing: "1px", filter: "drop-shadow(2px 2px 0px rgba(0,0,0,0.15))", whiteSpace: "nowrap" }}>
          <span style={{ color: "#EA4335" }}>S</span>
          <span style={{ color: "#4285F4" }}>n</span>
          <span style={{ color: "#FBBC05" }}>i</span>
          <span style={{ color: "#34A853" }}>f</span>
          <span style={{ color: "#EA4335" }}>f</span>
          <span style={{ color: "#ccc", margin: "0 6px", fontSize: "0.5em" }}>·</span>
          <span style={{ color: "#4285F4" }}>T</span>
          <span style={{ color: "#FBBC05" }}>e</span>
          <span style={{ color: "#34A853" }}>s</span>
          <span style={{ color: "#EA4335" }}>t</span>
        </div>
        <div style={{ color: "#777", fontSize: "14px", marginTop: "6px", fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
          "Does this smell funny to you? Let us check."
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px", fontSize: "10px", color: "#aaa", letterSpacing: "1px", fontFamily: "'Georgia', serif", flexWrap: "wrap" }}>
          <span>🤥 FAKE NEWS</span><span>🤖 AI IMAGES</span><span>🎣 SCAMS</span><span>📢 CLICKBAIT</span>
        </div>
      </header>

      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* What it does */}
        <div style={{ background: "#fff", border: "2px solid #e8e8e8", borderRadius: "2px", padding: "16px 20px", marginBottom: "24px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "28px", flexShrink: 0 }}>👃</span>
          <div>
            <div style={{ fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "14px", color: "#1a1a2e", marginBottom: "4px" }}>How it works</div>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
              Upload a screenshot of something suspicious — a news headline, a text message, a Facebook post, an image that looks a little <em>too</em> perfect. We'll sniff it and give you a straight answer.
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", marginBottom: "24px", border: "2px solid #1a1a2e", overflow: "hidden", borderRadius: "2px" }}>
          {[
            { id: "image", label: "📸 Upload Screenshot" },
            { id: "text",  label: "✏️ Paste Text / URL" },
          ].map(m => (
            <button key={m.id} className="sniff-tab"
              onClick={() => { setInputMode(m.id); setResponse(null); setError(null); setScore(null); }}
              style={{ flex: 1, padding: "12px 8px", border: "none", borderRight: "2px solid #1a1a2e", background: inputMode === m.id ? "#1a1a2e" : "#FFF8EE", color: inputMode === m.id ? "#fff" : "#1a1a2e", fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: "13px", cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.5px" }}
            >{m.label}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "24px", marginBottom: "20px", boxShadow: "4px 4px 0 #1a1a2e" }}>
          {inputMode === "image" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "10px", textTransform: "uppercase" }}>
                Upload the suspicious thing
              </label>
              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `3px dashed ${dragOver ? "#e63946" : "#ccc"}`, borderRadius: "2px", padding: "48px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? "#fff5f5" : "#FFFDF9", transition: "all 0.2s" }}
                >
                  <div style={{ fontSize: "44px", marginBottom: "12px" }}>📸</div>
                  <div style={{ fontFamily: "'Georgia', serif", color: "#555", fontSize: "15px" }}>Drop a screenshot here, or click to browse</div>
                  <div style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>News articles · Facebook posts · Text messages · Suspicious images</div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <img src={imagePreview} alt="Upload preview" style={{ maxWidth: "100%", maxHeight: "360px", display: "block", border: "2px solid #1a1a2e", borderRadius: "2px" }} />
                  <button onClick={resetImage} style={{ position: "absolute", top: "8px", right: "8px", background: "#e63946", color: "#fff", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              )}
            </div>
          )}

          {inputMode === "text" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", marginBottom: "10px", textTransform: "uppercase" }}>
                Paste the suspicious text or URL
              </label>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={`Paste anything suspicious here...\n\nExamples:\n• "BREAKING: Scientists confirm drinking bleach cures everything"\n• A text saying you've won a $1,000 Walmart gift card\n• A forwarded WhatsApp message about 5G towers\n• A news headline that seems a little too wild`}
                style={{ width: "100%", minHeight: "160px", border: "2px solid #ddd", borderRadius: "2px", padding: "12px", fontFamily: "'Georgia', serif", fontSize: "15px", resize: "vertical", outline: "none", boxSizing: "border-box", background: "#FFFDF9", lineHeight: "1.6" }}
                onFocus={e => e.target.style.borderColor = "#e63946"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <UsageCounter usesLeft={usesLeft} />

        {isLimited ? <PaywallMessage /> : (
        <button className="sniff-submit" onClick={handleSubmit} disabled={!canSubmit()}
          style={{ width: "100%", padding: "18px", background: canSubmit() ? "#1a1a2e" : "#ccc", color: "#fff", border: "none", borderRadius: "2px", fontSize: "18px", fontFamily: "'Georgia', serif", fontWeight: "bold", cursor: canSubmit() ? "pointer" : "not-allowed", letterSpacing: "2px", textTransform: "uppercase", boxShadow: canSubmit() ? "4px 4px 0 #e63946" : "none", transition: "all 0.1s", marginBottom: "32px" }}
        >
          {loading ? "🔬 Analyzing..." : "👃 Run the Sniff Test"}
        </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", padding: "32px", textAlign: "center", boxShadow: "4px 4px 0 #1a1a2e", marginBottom: "24px" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>🔬</div>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#1a1a2e" }}>Putting on the reading glasses...</div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "8px", fontStyle: "italic" }}>(Checking for fingerprints, bad grammar, and suspicious vibes)</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#fff5f5", border: "2px solid #e63946", borderRadius: "2px", padding: "20px", color: "#e63946", fontFamily: "'Georgia', serif", fontSize: "15px", marginBottom: "24px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Result */}
        {hasResponse && (() => {
          const sections = parseResponse(response);
          const lvl = level || (score ? getLevel(score) : null);
          return (
            <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", overflow: "hidden", boxShadow: "4px 4px 0 #1a1a2e", animation: "fadeIn 0.3s ease" }}>

              {/* Score header */}
              {lvl && (
                <div style={{ background: "#1a1a2e", padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
                    <span style={{ fontSize: "36px" }}>{lvl.emoji}</span>
                    <div>
                      <div style={{ color: lvl.color, fontFamily: "'Abril Fatface', serif", fontSize: "22px", letterSpacing: "1px" }}>
                        {lvl.label}
                      </div>
                      <div style={{ color: "#aaa", fontFamily: "'Georgia', serif", fontSize: "13px", fontStyle: "italic" }}>
                        {lvl.desc}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Abril Fatface', serif", fontSize: "36px", color: lvl.color, lineHeight: 1 }}>{score}</div>
                      <div style={{ color: "#666", fontSize: "11px", fontFamily: "'Georgia', serif" }}>/10</div>
                    </div>
                  </div>
                  {/* Smell meter */}
                  <div style={{ background: "#2a2a3e", borderRadius: "4px", height: "10px", overflow: "hidden" }}>
                    <div
                      className="meter-bar"
                      style={{
                        height: "100%",
                        background: `linear-gradient(90deg, #34A853, #FBBC05, #EA4335)`,
                        borderRadius: "4px",
                        "--target-width": `${score * 10}%`,
                        width: "0%",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                    <span style={{ color: "#34A853", fontSize: "10px", fontFamily: "'Georgia', serif" }}>Totally Fine</span>
                    <span style={{ color: "#EA4335", fontSize: "10px", fontFamily: "'Georgia', serif" }}>Call Your Bank</span>
                  </div>
                </div>
              )}

              {/* Sections */}
              {sections.length > 0 && (
                <div>
                  {sections.map((section, i) => (
                    <div key={i} style={{ padding: "18px 24px", borderBottom: i < sections.length - 1 ? "1px solid #e8ddd0" : "none", background: i % 2 === 0 ? "#fff" : "#FFFDF9" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#e63946", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'Georgia', serif" }}>
                        {section.icon} {section.label}
                      </div>
                      <div
                        className={streaming && i === sections.length - 1 ? "streaming-cursor" : ""}
                        style={{ fontFamily: "'Georgia', serif", fontSize: "16px", lineHeight: "1.7", color: "#1a1a2e" }}
                      >
                        {section.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback raw streaming before sections parse */}
              {sections.length === 0 && (
                <div className={streaming ? "streaming-cursor" : ""}
                  style={{ padding: "24px", fontFamily: "'Georgia', serif", fontSize: "16px", lineHeight: "1.7", color: "#1a1a2e" }}>
                  {response}
                </div>
              )}

              {!streaming && (
                <div style={{ background: "#f5f0e8", padding: "14px 24px", borderTop: "2px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <a href={BMAC_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic", fontFamily: "'Georgia', serif", textDecoration: "none" }}>
                    ☕ Buy me a coffee
                  </a>
                  <button onClick={resetAll} style={{ background: "none", border: "1px solid #ccc", padding: "6px 14px", fontFamily: "'Georgia', serif", fontSize: "12px", cursor: "pointer", color: "#555", borderRadius: "2px" }}>
                    Sniff Another
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Examples */}
        {!hasResponse && !loading && !streaming && (
          <div style={{ marginTop: "40px", borderTop: "2px solid #e8ddd0", paddingTop: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", color: "#aaa", textTransform: "uppercase", marginBottom: "16px", fontFamily: "'Georgia', serif" }}>
              Common Things to Check
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                "You've been selected for a free iPhone!",
                "BREAKING: Famous celebrity dies",
                "Forward this or bad luck for 7 years",
                "Your account has been compromised, click here",
                "Doctors HATE this one weird trick",
                "The government doesn't want you to know this",
              ].map(ex => (
                <button key={ex}
                  onClick={() => { setInputMode("text"); setTextInput(ex); setResponse(null); setScore(null); }}
                  style={{ background: "#FFF8EE", border: "1px solid #ccc", borderRadius: "2px", padding: "7px 14px", fontFamily: "'Georgia', serif", fontSize: "13px", cursor: "pointer", color: "#555", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.target.style.background = "#1a1a2e"; e.target.style.color = "#fff"; e.target.style.borderColor = "#1a1a2e"; }}
                  onMouseLeave={e => { e.target.style.background = "#FFF8EE"; e.target.style.color = "#555"; e.target.style.borderColor = "#ccc"; }}
                >{ex}</button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
