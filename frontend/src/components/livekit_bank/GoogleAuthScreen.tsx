import React, { useEffect, useRef, useState } from "react";

const getSiteFlag = (): "vyom" | "vilok" => {
  const host = window.location.hostname;
  if (host.includes("demo.vilok.ai")) return "vilok";
  return "vyom";
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  name: string;
  email: string;
  picture: string;
  googleId: string;
  sessionExpiresAt?: string;
}

interface GoogleAuthScreenProps {
  onUnlock: (user: AuthUser) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function decodeJwt(token: string): Record<string, string> {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(json);
  } catch { return {}; }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// ─── Component ────────────────────────────────────────────────────────────────

export const GoogleAuthScreen: React.FC<GoogleAuthScreenProps> = ({ onUnlock }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");

  // ── Login mode toggle ──
  const [mode, setMode] = useState<"google" | "password">("google");

  // ── Password form state ──
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // ── Google init ──
  const initGoogle = () => {
    if (!window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    if (buttonRef.current) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline", size: "large", width: 320,
        text: "signin_with", shape: "rectangular", logo_alignment: "left",
      });
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("auth_user");
    if (saved) {
      try { onUnlock(JSON.parse(saved)); return; }
      catch { sessionStorage.removeItem("auth_user"); }
    }
    if (window.google) { initGoogle(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, []);

  // Re-render Google button when switching back to Google mode
  useEffect(() => {
    if (mode === "google" && window.google && buttonRef.current) {
      setTimeout(initGoogle, 50);
    }
  }, [mode]);

  // ── Google credential handler ──
  const handleCredentialResponse = async (response: { credential: string }) => {
    setError("");
    const payload = decodeJwt(response.credential);
    const email = payload.email || "";
    const name = payload.name || "";
    const picture = payload.picture || "";
    const sub = payload.sub || "";

    const user: AuthUser = { name, email, picture, googleId: sub };
    sessionStorage.setItem("auth_user", JSON.stringify(user));
    sessionStorage.setItem("authenticated", "true");

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, picture, googleId: sub }),
      });
      if (!res.ok) throw new Error(`Backend save failed: ${res.status}`);
      const saved = await res.json().catch(() => null);
      if (!saved?.success) throw new Error("Backend did not confirm success.");
      onUnlock(user);
    } catch (err: any) {
      console.error("Failed to upsert user:", err);
      setError(`Login failed. ${err?.message || "Server did not accept user data."}`);
    }
  };

  // ── Email + password handler ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!emailInput.trim() || !passwordInput) {
      setError("Please enter your email and password.");
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), password: passwordInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message || "Invalid email or password.");
        return;
      }
      const { user } = json;
      const authUser: AuthUser = {
        name: user.name,
        email: user.email,
        picture: user.picture || "",
        googleId: user.googleId || "",
        sessionExpiresAt: user.sessionExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Example: session valid for 7 days
      };
      sessionStorage.setItem("auth_user", JSON.stringify(authUser));
      sessionStorage.setItem("authenticated", "true");
      onUnlock(authUser);
    } catch (err: any) {
      setError("Could not reach server. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  // ── Shared styles ──
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px", borderRadius: "10px",
    border: "1px solid #e2e8f0", fontSize: "14px",
    color: "#0f172a", background: "#f8fafc",
    outline: "none", transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #e8f0fe 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>

      {/* Background blobs */}
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "500px", height: "500px", background: "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: "400px", height: "400px", background: "radial-gradient(ellipse at center, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 10, width: "100%", maxWidth: "420px",
        background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px",
        padding: "44px 40px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(59,130,246,0.08)",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white" />
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1 }}>
                {getSiteFlag() === "vyom" ? "VYOM" : "Vilok"} <span style={{ color: "#3b82f6" }}>AI</span>
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>by INT Global</p>
            </div>
          </div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.3px" }}>Welcome back</h2>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#64748b" }}>Sign in to access the Voice AI platform</p>
        </div>

        {/* ── Mode Toggle ── */}
        <div style={{
          display: "flex", background: "#f1f5f9", borderRadius: "10px",
          padding: "4px", marginBottom: "24px", gap: "4px",
        }}>
          {(["google", "password"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: "7px", border: "none",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
                background: mode === m ? "#ffffff" : "transparent",
                color: mode === m ? "#1e40af" : "#64748b",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {m === "google" ? "🔵  Google" : "🔑  Email & Password"}
            </button>
          ))}
        </div>

        {/* ── Google Sign-In ── */}
        {mode === "google" && (
          <div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: error ? "16px" : "0" }}>
              {!GOOGLE_CLIENT_ID ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 20px", fontSize: "13px", color: "#dc2626", textAlign: "center" }}>
                  ⚠️ Set <code style={{ background: "#fee2e2", padding: "2px 6px", borderRadius: "4px" }}>VITE_GOOGLE_CLIENT_ID</code> in your .env file
                </div>
              ) : (
                <div ref={buttonRef} />
              )}
            </div>
          </div>
        )}

        {/* ── Email + Password Form ── */}
        {mode === "password" && (
          <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@intglobal.com"
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0,
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                background: loggingIn ? "#93c5fd" : "linear-gradient(135deg, #1e40af, #3b82f6)",
                color: "#ffffff", fontSize: "14px", fontWeight: 700,
                border: "none", cursor: loggingIn ? "not-allowed" : "pointer",
                boxShadow: loggingIn ? "none" : "0 4px 14px rgba(59,130,246,0.35)",
                transition: "all 0.15s", letterSpacing: "0.2px",
              }}
            >
              {loggingIn ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px",
            padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px",
            marginTop: "16px", animation: "fadeIn 0.2s ease",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" />
              <path d="M12 8v5M12 16h.01" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#dc2626", lineHeight: 1.5 }}>{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ position: "relative", zIndex: 10, marginTop: "24px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
        © {new Date().getFullYear()} INT Global · Secure · End-to-end encrypted
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
};