// Entry point for the embeddable widget (loaded inside the iframe injected by
// public/widget.js). It resolves the partner's backend URL from the query string
// BEFORE any chat code runs, so BlueCrossStaticPage's `API_BASE` (which prefers
// `window.__BCB_API_BASE__`) points at the right backend, then mounts the chat.
import { createRoot } from "react-dom/client";
import WidgetApp from "./WidgetApp";
import "../index.css";

// The loader passes ?apiBase=<encoded backend base url>. Fall back to the
// build-time VITE_API_URL / localhost if it's absent (e.g. opened directly).
const params = new URLSearchParams(window.location.search);
const apiBase = params.get("apiBase");
if (apiBase) {
  (window as unknown as { __BCB_API_BASE__?: string }).__BCB_API_BASE__ = apiBase;
}

createRoot(document.getElementById("widget-root")!).render(<WidgetApp />);
