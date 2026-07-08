/*!
 * Blue Cross "Pratiksha" chat — embeddable widget loader.
 *
 * A partner site embeds the chatbot with ONE line:
 *
 *   <script src="https://YOUR-FRONTEND-HOST/widget.js"
 *           data-api-url="https://YOUR-PUBLIC-BACKEND-HOST"></script>
 *
 * This script injects a floating, fully style-isolated <iframe> that loads
 * `widget.html` from the same origin it was served from. The iframe is tiny (just
 * the launcher bubble) while the chat is closed — so the rest of the host page
 * stays clickable — and expands to fill the viewport while the chat is open, so
 * the chat modal renders exactly as it does on the Blue Cross site.
 *
 * Optional attributes:
 *   data-api-url   Public backend base URL (e.g. https://api.example.com). REQUIRED
 *                  for real embeds — the chat calls <api-url>/api/v1/chat. If omitted,
 *                  the widget falls back to its build-time VITE_API_URL.
 *   data-position  "bottom-right" (default) | "bottom-left".
 *   data-z-index   Stacking order of the iframe (default 2147483000).
 */
(function () {
  "use strict";

  if (window.__bcbWidgetLoaded) return;
  window.__bcbWidgetLoaded = true;

  // --- Locate our own <script> tag (to read data-* and derive the origin) ---
  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf("widget.js") !== -1) return all[i];
      }
      return null;
    })();

  if (!script) {
    console.error("[bcb-widget] Could not locate the widget <script> tag; aborting.");
    return;
  }

  // Origin the widget assets are served from (same host as this script).
  var widgetOrigin;
  try {
    widgetOrigin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    console.error("[bcb-widget] Invalid script src; aborting.", e);
    return;
  }

  var apiUrl = script.getAttribute("data-api-url") || "";
  var position = (script.getAttribute("data-position") || "bottom-right").toLowerCase();
  var zIndex = script.getAttribute("data-z-index") || "2147483000";
  var isLeft = position === "bottom-left";

  // --- Build the widget.html URL, forwarding the backend base as a query param ---
  var src = widgetOrigin + "/widget.html";
  if (apiUrl) src += "?apiBase=" + encodeURIComponent(apiUrl);

  // --- Collapsed (bubble) geometry. Large enough for the launcher + its glow/ping,
  //     small enough that the rest of the host page stays interactive. ---
  var BUBBLE = "150px";
  // While the user hovers the bubble, the iframe widens leftward so the full
  // "Chat with Pratiksha" label is visible (it sits to the left of the bubble and
  // would otherwise be clipped by the narrow collapsed iframe). Reverts on unhover.
  var HOVER_WIDTH = "340px";

  var iframe = document.createElement("iframe");
  iframe.title = "Pratiksha Chat";
  iframe.setAttribute("allow", "microphone; clipboard-write");
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");

  var s = iframe.style;
  s.position = "fixed";
  s.bottom = "0";
  s[isLeft ? "left" : "right"] = "0";
  s.width = BUBBLE;
  s.height = BUBBLE;
  s.maxWidth = "100vw";
  s.maxHeight = "100vh";
  s.border = "0";
  s.background = "transparent";
  s.colorScheme = "normal"; // avoid host dark-mode forcing a bg on the iframe
  s.zIndex = String(zIndex);
  s.overflow = "hidden";
  // Only transition size (not position) so open/close feels smooth without jank.
  s.transition = "width 0.25s ease, height 0.25s ease";
  iframe.src = src;

  function setCollapsed() {
    s.width = BUBBLE;
    s.height = BUBBLE;
    s.top = "";
    s.left = isLeft ? "0" : "";
    s.right = isLeft ? "" : "0";
    s.bottom = "0";
  }

  function setExpanded() {
    // Fill the viewport so the centered chat modal + dim backdrop render exactly
    // like the native page. Works for desktop and mobile alike.
    s.top = "0";
    s.left = "0";
    s.right = "0";
    s.bottom = "0";
    s.width = "100%";
    s.height = "100%";
  }

  // Set the collapsed width WITHOUT animating. Animating the hover reveal caused a
  // feedback loop: the transitioning width perturbed the pointer/hover state inside
  // the iframe, which toggled the reveal off/on → flicker. Applying the width in a
  // single frame (transition disabled) keeps the bubble perfectly static.
  function setBubbleWidthInstant(width) {
    if (expanded) return;
    var restore = s.transition;
    s.transition = "none";
    s.width = width;
    void iframe.offsetWidth; // force reflow so the change lands before we re-enable
    s.transition = restore;
  }

  function mount() {
    if (!document.body) {
      // <head>-loaded script with no body yet — retry once DOM is ready.
      document.addEventListener("DOMContentLoaded", mount, { once: true });
      return;
    }
    document.body.appendChild(iframe);
  }

  // --- Listen for open/close/hover signals from the widget (inside the iframe) ---
  // Collapse is debounced: while switching from the disclaimer modal to the chat
  // overlay the widget briefly reports "closed", and we don't want the iframe to
  // shrink-then-grow (a flicker). A follow-up "open" cancels the pending collapse.
  var collapseTimer = null;
  var expanded = false; // true while the chat/disclaimer overlay is open (full-screen)

  function expandNow() {
    expanded = true;
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    setExpanded();
  }
  function collapseSoon() {
    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = setTimeout(function () {
      collapseTimer = null;
      expanded = false;
      setCollapsed();
    }, 180);
  }

  // Hover-intent hysteresis: grow immediately on hover, but delay the shrink and
  // cancel it if hover re-fires. This latches the revealed width so any residual
  // enter/leave jitter never oscillates the iframe (which is what caused flicker).
  var hoverShrinkTimer = null;
  function revealLabel() {
    if (hoverShrinkTimer) {
      clearTimeout(hoverShrinkTimer);
      hoverShrinkTimer = null;
    }
    setBubbleWidthInstant(HOVER_WIDTH);
  }
  function hideLabelSoon() {
    if (hoverShrinkTimer) clearTimeout(hoverShrinkTimer);
    hoverShrinkTimer = setTimeout(function () {
      hoverShrinkTimer = null;
      setBubbleWidthInstant(BUBBLE);
    }, 260);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== widgetOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== "bcb-widget") return;

    if (data.type === "open") {
      expandNow();
    } else if (data.type === "close" || data.type === "ready") {
      collapseSoon();
    } else if (data.type === "hover") {
      revealLabel();
    } else if (data.type === "unhover") {
      hideLabelSoon();
    }
  });

  mount();
})();
