import { useState } from "react";

export const BMAC_URL = "https://buymeacoffee.com/YOUR_USERNAME";
export const USDC_ADDRESS = "0xDd31dB93082a3A71b98D37ba26230f8734Bd63C3";
export const USDC_NETWORK = "Base";
export const DAILY_LIMIT = 5;

export function useUsageLimit() {
  const getStore = () => {
    try {
      const raw = localStorage.getItem("okboomer_usage");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const today = new Date().toDateString();
  const getUsesLeft = () => {
    const store = getStore();
    if (!store || store.date !== today) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - (store.count || 0));
  };
  const recordUse = () => {
    const store = getStore();
    if (!store || store.date !== today) {
      localStorage.setItem("okboomer_usage", JSON.stringify({ date: today, count: 1 }));
    } else {
      localStorage.setItem("okboomer_usage", JSON.stringify({ date: today, count: (store.count || 0) + 1 }));
    }
  };
  const usesLeft = getUsesLeft();
  const isLimited = usesLeft <= 0;
  return { usesLeft, recordUse, isLimited };
}

export function PaywallMessage() {
  const [copied, setCopied] = useState(false);
  const copyAddress = () => {
    navigator.clipboard.writeText(USDC_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ background: "#fff", border: "2px solid #1a1a2e", borderRadius: "2px", boxShadow: "4px 4px 0 #e63946", textAlign: "center", padding: "28px 24px" }}>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>☕</div>
      <div style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: "20px", color: "#1a1a2e", marginBottom: "8px" }}>
        You've hit your 5 free uses today!
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "#666", lineHeight: "1.6", marginBottom: "20px", fontStyle: "italic" }}>
        Come back tomorrow for 5 more free explanations,
        or keep the lights on with a coffee or some USDC.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
        <a href={BMAC_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", background: "#FBBC05", color: "#1a1a2e", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: "14px", padding: "10px 24px", borderRadius: "2px", textDecoration: "none", border: "2px solid #1a1a2e", boxShadow: "3px 3px 0 #1a1a2e", width: "200px", boxSizing: "border-box" }}>
          ☕ Buy Me a Coffee
        </a>
        <button onClick={copyAddress}
          style={{ background: copied ? "#34A853" : "#2775CA", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: "14px", padding: "10px 24px", borderRadius: "2px", border: "2px solid #1a1a2e", boxShadow: "3px 3px 0 #1a1a2e", cursor: "pointer", width: "200px", transition: "background 0.2s" }}>
          {copied ? "✓ Copied!" : "💵 Send USDC (" + USDC_NETWORK + ")"}
        </button>
        {!copied && (
          <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#aaa", wordBreak: "break-all", maxWidth: "260px" }}>
            {USDC_ADDRESS}
          </div>
        )}
        <div style={{ fontSize: "11px", color: "#bbb", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          or come back tomorrow — free again!
        </div>
      </div>
    </div>
  );
}

export function UsageCounter({ usesLeft }) {
  if (usesLeft >= DAILY_LIMIT) return null;
  const color = usesLeft <= 1 ? "#e63946" : usesLeft <= 2 ? "#FBBC05" : "#888";
  return (
    <div style={{ textAlign: "center", fontFamily: "Georgia, serif", fontSize: "12px", color: color, fontStyle: "italic", marginBottom: "8px" }}>
      {usesLeft === 1 ? "⚠️ Last free use today!" : usesLeft + " free uses left today"}
    </div>
  );
}

export function SupportButtons() {
  const [copied, setCopied] = useState(false);
  const copyAddress = () => {
    navigator.clipboard.writeText(USDC_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <a href={BMAC_URL} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic", fontFamily: "Georgia, serif", textDecoration: "none" }}>
        ☕ Coffee
      </a>
      <span style={{ color: "#ddd", fontSize: "11px" }}>·</span>
      <button onClick={copyAddress}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: copied ? "#34A853" : "#aaa", fontStyle: "italic", fontFamily: "Georgia, serif", padding: 0 }}>
        {copied ? "✓ Copied!" : "💵 USDC"}
      </button>
    </div>
  );
}
