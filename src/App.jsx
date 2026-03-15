import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `You are OkBoomer, a patient but slightly amused translator for Baby Boomers who encounter confusing internet content, memes, Gen-Z slang, Millennial phrases, or internet culture they don't understand.

Your job: explain what something means in a way that's CLEAR and FUNNY — like a witty grandkid who genuinely loves their grandparent and wants them to get the joke.

Guidelines:
- Always start with a plain-English "What it means:" explanation (1-3 sentences, no jargon)
- Then add "The backstory:" — where it came from or why people say/share it
- Then "Use it in a sentence:" — give a relatable example for a boomer (reference things like golf, casseroles, the news, grandkids, etc.)
- End with a "Boomer Rating:" — rate how alarmed they should be on a scale from 😴 (totally harmless) to 😱 (call your grandkid immediately), using 1-5 of those emojis
- Keep the tone warm, a little cheeky, never condescending
- If it's an image/meme, describe what you see first, then explain the joke or cultural reference
- If it's a URL, explain what kind of content it likely links to based on context clues
- If the content is totally wholesome and fine, reassure them warmly
- If something is edgy or adult, explain it tastefully without being graphic
- Max response length: ~200 words. Be punchy.

Format your response with these exact section headers (use the emoji + bold label):
📖 **What it means:**
🕰️ **The backstory:**
💬 **Use it in a sentence:**
📊 **Boomer Rating:**`;

export default function OkBoomer() {
  const [inputMode, setInputMode] = useState("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

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
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      setResponse(text);
    } catch (err) {
      setError("Something went sideways. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (loading) return false;
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
      if (line.includes("**What it means:**") || line.includes("What it means:")) {
        if (current) sections.push(current);
        current = { icon: "📖", label: "What it means", body: "" };
      } else if (line.includes("**The backstory:**") || line.includes("The backstory:")) {
        if (current) sections.push(current);
        current = { icon: "🕰️", label: "The backstory", body: "" };
      } else if (line.includes("**Use it in a sentence:**") || line.includes("Use it in a sentence:")) {
        if (current) sections.push(current);
        current = { icon: "💬", label: "Use it in a sentence", body: "" };
      } else if (line.includes("**Boomer Rating:**") || line.includes("Boomer Rating:")) {
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f9f9f9",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');
        .ok-boomer-logo {
          font-family: 'Abril Fatface', 'Times New Roman', serif;
          font-size: clamp(64px, 13vw, 108px);
          line-height: 1;
          letter-spacing: 2px;
          display: inline-block;
          filter: drop-shadow(3px 3px 0px rgba(0,0,0,0.18));
        }
        .ok-boomer-logo span { display: inline-block; }
        .l1 { color: #4285F4; }
        .l2 { color: #EA4335; }
        .l3 { color: #FBBC05; }
        .l4 { color: #4285F4; }
        .l5 { color: #34A853; }
        .l6 { color: #EA4335; }
        .l7 { color: #FBBC05; }
        .l8 { color: #34A853; }
      `}</style>

      <header style={{
        background: "#fff",
        borderBottom: "3px solid #e8e8e8",
        padding: "28px 24px 20px",
        textAlign: "center",
      }}>
        <div className="ok-boomer-logo">
          <span className="l1">O</span><span className="l2">k</span><span style={{color:"#ccc",margin:"0 4px",fontSize:"0.6em"}}>·</span><span className="l3">B</span><span className="l4">o</span><span className="l5">o</span><span className="l6">m</span><span className="l7">e</span><span className="l8">r</span>
        </div>
        <div style={{
          color: "#777",
          fontSize: "14px",
          marginTop: "6px",
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          letterSpacing: "0.3px",
        }}>
          "No, Grandpa, it's not a virus. Let us explain."
        </div>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "10px",
          fontSize: "11px",
          color: "#aaa",
          letterSpacing: "1px",
          fontFamily: "'Georgia', serif",
        }}>
          <span>✦ MEMES DECODED</span>
          <span>✦ SLANG TRANSLATED</span>
          <span>✦ VIBES EXPLAINED</span>
        </div>
      </header>

      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 60px" }}>

        <div style={{
          display: "flex",
          marginBottom: "28px",
          border: "2px solid #1a1a2e",
          overflow: "hidden",
          borderRadius: "2px",
        }}>
          {[
            { id: "text", label: "📝 Type Slang" },
            { id: "url", label: "🔗 Paste a Link" },
            { id: "image", label: "🖼️ Upload a Meme" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => { setInputMode(m.id); setResponse(null); setError(null); }}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                borderRight: "2px solid #1a1a2e",
                background: inputMode === m.id ? "#1a1a2e" : "#FFF8EE",
                color: inputMode === m.id ? "#fff" : "#1a1a2e",
                fontFamily: "'Georgia', serif",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.5px",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{
          background: "#fff",
          border: "2px solid #1a1a2e",
          borderRadius: "2px",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: "4px 4px 0 #1a1a2e",
        }}>
          {inputMode === "text" && (
            <div>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "2px",
                color: "#e63946",
                marginBottom: "10px",
                textTransform: "uppercase",
              }}>
                What confusing thing did you encounter?
              </label>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={`Type or paste anything confusing here...\n\nExamples: "no cap fr fr", "he's lowkey salty rn", "it's giving main character energy", "that slaps", "I'm dead 💀"`}
                style={{
                  width: "100%",
                  minHeight: "120px",
                  border: "2px solid #ddd",
                  borderRadius: "2px",
                  padding: "12px",
                  fontFamily: "'Georgia', serif",
                  fontSize: "16px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#FFFDF9",
                  lineHeight: "1.6",
                }}
                onFocus={e => e.target.style.borderColor = "#e63946"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
              />
            </div>
          )}

          {inputMode === "url" && (
            <div>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "2px",
                color: "#e63946",
                marginBottom: "10px",
                textTransform: "uppercase",
              }}>
                Paste a link your grandkid sent you
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://... or just paste whatever link is confusing you"
                style={{
                  width: "100%",
                  border: "2px solid #ddd",
                  borderRadius: "2px",
                  padding: "14px 12px",
                  fontFamily: "'Georgia', serif",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#FFFDF9",
                }}
                onFocus={e => e.target.style.borderColor = "#e63946"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
              />
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px", fontStyle: "italic" }}>
                Note: We'll explain what the link appears to be about based on its context.
              </p>
            </div>
          )}

          {inputMode === "image" && (
            <div>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "2px",
                color: "#e63946",
                marginBottom: "10px",
                textTransform: "uppercase",
              }}>
                Upload the meme (or confusing image)
              </label>
              {!imagePreview ? (
                <div
                  ref={dragRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `3px dashed ${dragOver ? "#e63946" : "#ccc"}`,
                    borderRadius: "2px",
                    padding: "40px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragOver ? "#fff5f5" : "#FFFDF9",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🖼️</div>
                  <div style={{ fontFamily: "'Georgia', serif", color: "#555", fontSize: "15px" }}>
                    Drag & drop your meme here, or click to browse
                  </div>
                  <div style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
                    JPG, PNG, GIF, WEBP supported
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => handleImageFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <img
                    src={imagePreview}
                    alt="Uploaded meme"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "320px",
                      display: "block",
                      border: "2px solid #1a1a2e",
                      borderRadius: "2px",
                    }}
                  />
                  <button
                    onClick={resetImage}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: "#e63946",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "28px",
                      height: "28px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit()}
          style={{
            width: "100%",
            padding: "18px",
            background: canSubmit() ? "#e63946" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "2px",
            fontSize: "18px",
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            cursor: canSubmit() ? "pointer" : "not-allowed",
            letterSpacing: "2px",
            textTransform: "uppercase",
            boxShadow: canSubmit() ? "4px 4px 0 #1a1a2e" : "none",
            transition: "all 0.1s",
            marginBottom: "32px",
          }}
          onMouseEnter={e => { if (canSubmit()) e.target.style.transform = "translate(-2px, -2px)"; }}
          onMouseLeave={e => { e.target.style.transform = "none"; }}
        >
          {loading ? "🤔 Asking a Young Person..." : "🔍 Explain This To Me"}
        </button>

        {loading && (
          <div style={{
            background: "#fff",
            border: "2px solid #1a1a2e",
            borderRadius: "2px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "4px 4px 0 #1a1a2e",
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>
              📰
            </div>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#1a1a2e" }}>
              Consulting our intern who is 23 years old...
            </div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "8px", fontStyle: "italic" }}>
              (She sighed, but she's explaining it)
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            background: "#fff5f5",
            border: "2px solid #e63946",
            borderRadius: "2px",
            padding: "20px",
            color: "#e63946",
            fontFamily: "'Georgia', serif",
            fontSize: "15px",
          }}>
            ⚠️ {error}
          </div>
        )}

        {response && !loading && (() => {
          const sections = parseResponse(response);
          return (
            <div style={{
              background: "#fff",
              border: "2px solid #1a1a2e",
              borderRadius: "2px",
              overflow: "hidden",
              boxShadow: "4px 4px 0 #1a1a2e",
              animation: "fadeIn 0.4s ease",
            }}>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
              <div style={{
                background: "#1a1a2e",
                padding: "14px 24px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}>
                <span style={{ fontSize: "20px" }}>📰</span>
                <span style={{
                  color: "#fff",
                  fontFamily: "'Georgia', serif",
                  fontWeight: "bold",
                  fontSize: "14px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}>
                  Translation Complete
                </span>
                <span style={{
                  marginLeft: "auto",
                  background: "#e63946",
                  color: "#fff",
                  fontSize: "10px",
                  letterSpacing: "2px",
                  padding: "3px 8px",
                  fontFamily: "'Georgia', serif",
                }}>
                  BOOMER EDITION
                </span>
              </div>

              {sections.length > 0 ? (
                <div>
                  {sections.map((section, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "20px 24px",
                        borderBottom: i < sections.length - 1 ? "1px solid #e8ddd0" : "none",
                        background: i % 2 === 0 ? "#fff" : "#FFFDF9",
                      }}
                    >
                      <div style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        letterSpacing: "2px",
                        color: "#e63946",
                        textTransform: "uppercase",
                        marginBottom: "8px",
                        fontFamily: "'Georgia', serif",
                      }}>
                        {section.icon} {section.label}
                      </div>
                      <div style={{
                        fontFamily: "'Georgia', serif",
                        fontSize: "16px",
                        lineHeight: "1.7",
                        color: "#1a1a2e",
                      }}>
                        {section.body}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "24px", fontFamily: "'Georgia', serif", fontSize: "16px", lineHeight: "1.7", color: "#1a1a2e" }}>
                  {response}
                </div>
              )}

              <div style={{
                background: "#f5f0e8",
                padding: "14px 24px",
                borderTop: "2px solid #1a1a2e",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "11px", color: "#888", fontStyle: "italic", fontFamily: "'Georgia', serif" }}>
                  OkBoomer™ — Bridging the generational divide, one meme at a time
                </span>
                <button
                  onClick={() => { setResponse(null); setTextInput(""); setUrlInput(""); resetImage(); }}
                  style={{
                    background: "none",
                    border: "1px solid #ccc",
                    padding: "6px 14px",
                    fontFamily: "'Georgia', serif",
                    fontSize: "12px",
                    cursor: "pointer",
                    color: "#555",
                    borderRadius: "2px",
                  }}
                >
                  Try Another
                </button>
              </div>
            </div>
          );
        })()}

        {!response && !loading && (
          <div style={{
            marginTop: "40px",
            borderTop: "2px solid #e8ddd0",
            paddingTop: "24px",
          }}>
            <div style={{
              fontSize: "11px",
              fontWeight: "bold",
              letterSpacing: "2px",
              color: "#aaa",
              textTransform: "uppercase",
              marginBottom: "16px",
              fontFamily: "'Georgia', serif",
            }}>
              Try These Examples
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                "no cap fr fr",
                "he really said 'bet'",
                "that's giving",
                "it's the vibe for me",
                "slay bestie",
                "main character energy",
                "touch grass",
                "rent free",
                "it's lowkey bussin",
                "understood the assignment",
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => { setInputMode("text"); setTextInput(ex); setResponse(null); }}
                  style={{
                    background: "#FFF8EE",
                    border: "1px solid #ccc",
                    borderRadius: "2px",
                    padding: "7px 14px",
                    fontFamily: "'Georgia', serif",
                    fontSize: "13px",
                    cursor: "pointer",
                    color: "#555",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.target.style.background = "#1a1a2e"; e.target.style.color = "#fff"; e.target.style.borderColor = "#1a1a2e"; }}
                  onMouseLeave={e => { e.target.style.background = "#FFF8EE"; e.target.style.color = "#555"; e.target.style.borderColor = "#ccc"; }}
                >
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
