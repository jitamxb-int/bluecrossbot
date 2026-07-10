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

  // Positioning of the idle (collapsed) bubble. All apply ONLY while collapsed;
  // the expanded chat always fills the whole viewport. Lengths accept a bare
  // number (px) or any CSS length ("90px", "5vh", "env(safe-area-inset-bottom)").
  //   data-consent-selector : CSS selector of the host's cookie/consent banner.
  //                           When that element is present AND anchored to the
  //                           bottom of the screen, the bubble auto-lifts to sit
  //                           just above it (by its measured height), and drops
  //                           back down the moment the banner is hidden/removed.
  //                           This is the ONLY thing that lifts the bubble by
  //                           default — no banner ⇒ normal bottom position.
  //   data-offset-gap       : gap between the bubble and the banner top (default 12px)
  //   data-offset-bottom    : base gap from the bottom edge, always applied (default 0)
  //   data-offset-x         : gap from the left/right edge per data-position (default 0)
  function toLen(v) {
    v = (v || "").trim();
    if (v === "") return "0px"; // MUST carry a unit — used inside calc() (bottomValue)
    return /^\d+(\.\d+)?$/.test(v) ? v + "px" : v;
  }
  var baseBottom = toLen(script.getAttribute("data-offset-bottom"));
  var offsetX = toLen(script.getAttribute("data-offset-x"));
  var gap = toLen(script.getAttribute("data-offset-gap") || "12");
  var selector = (script.getAttribute("data-consent-selector") || "").trim();
  // Zero-config detection of a bottom-pinned consent/cookie bar is ON by default
  // (set data-consent-auto="off" to disable). An explicit data-consent-selector,
  // when given, overrides the detection and targets that element instead.
  var autoDetect = (script.getAttribute("data-consent-auto") || "on").toLowerCase() !== "off";
  var debug = (script.getAttribute("data-consent-debug") || "").toLowerCase() === "on";
  // Extra bottom lift (px) currently needed to clear a detected consent banner.
  var autoLift = 0;

  // Well-known consent-management-platform banner selectors, tried before the
  // generic geometric scan. Each is still validated by the bottom-bar geometry
  // test, so a match that isn't actually a bottom bar is ignored.
  var KNOWN_CONSENT_SELECTORS = [
    "#CybotCookiebotDialog",            // Cookiebot
    "#onetrust-banner-sdk",             // OneTrust
    "#onetrust-consent-sdk",            // OneTrust (wrapper)
    ".cky-consent-bar",                 // CookieYes
    ".osano-cm-window",                 // Osano
    "#termly-code-snippet-support",     // Termly
    "#cookie-notice",                   // Cookie Notice (WP)
    ".cmplz-cookiebanner",              // Complianz
    "#cookie-law-info-bar",             // CookieYes / GDPR Cookie Consent (WP)
    "[aria-label*='cookie' i]",
    "[class*='cookie'][class*='consent']",
    "[id*='cookie'][id*='consent']"
  ];

  // Bottom position for the collapsed bubble: the base offset, plus the measured
  // banner clearance (+ gap) when a consent banner is detected below the bubble.
  // Every calc() term MUST carry a unit — `calc(0 + 68px)` is invalid CSS and the
  // browser silently drops it (baseBottom/gap come from toLen(), which is unit-safe).
  function bottomValue() {
    return autoLift > 0
      ? "calc(" + baseBottom + " + " + autoLift + "px + " + gap + ")"
      : baseBottom;
  }

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
  iframe.title = "Need help? Ask Luna!";
  iframe.setAttribute("allow", "microphone; clipboard-write");
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");

  var s = iframe.style;
  s.position = "fixed";
  s.bottom = bottomValue();
  s[isLeft ? "left" : "right"] = offsetX;
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
    s.left = isLeft ? offsetX : "";
    s.right = isLeft ? "" : offsetX;
    s.bottom = bottomValue();
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

  // --- Consent-banner auto-lift ---------------------------------------------
  // widget.js runs in the HOST page, so it can see the host DOM and lift the idle
  // bubble just above a cookie/consent bar pinned to the bottom of the screen —
  // ONLY while such a bar is actually present. Reverts the moment it's dismissed.
  // Zero-config by default (autoDetect); data-consent-selector targets a specific
  // element instead.
  function isBannerVisible(el) {
    if (!el) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") === 0) {
      return false;
    }
    return el.getBoundingClientRect().height > 0;
  }

  // How far a bottom-anchored element intrudes from the bottom edge, or 0 if it
  // doesn't qualify as a bottom "bar": it must be fixed/sticky, reach the bottom
  // edge, live in the bottom half, and be full-width-ish (≥60% wide OR touching
  // both side edges). Filters out unrelated fixed widgets/corner elements. Capped
  // at 40% vh so a full-screen consent modal can't shove the bubble off the top.
  function barIntrusion(el, vw, vh) {
    if (!isBannerVisible(el)) return 0;
    var cs = window.getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") return 0;
    var r = el.getBoundingClientRect();
    if (r.bottom < vh - 4) return 0;                       // must reach the bottom edge
    if (r.top < vh * 0.5) return 0;                        // bottom half only → a bar
    var wideEnough = r.width >= vw * 0.6 || (r.left <= 4 && r.right >= vw - 4);
    if (!wideEnough) return 0;                             // spans the width → a bar
    return Math.min(Math.max(0, vh - r.top), Math.round(vh * 0.4));
  }

  // Given a hit element, look at it and up to a few ancestors for a qualifying
  // bottom bar (the banner may be a child of the fixed wrapper, or vice versa).
  function barFrom(node, vw, vh) {
    var steps = 0;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement && steps < 8) {
      if (node === iframe) break;
      var intr = barIntrusion(node, vw, vh);
      if (intr > 0) return intr;
      node = node.parentElement;
      steps++;
    }
    return 0;
  }

  // Zero-config: sample a few points along the very bottom edge. elementsFromPoint
  // returns the full front-to-back stack (incl. elements BEHIND our bubble), so a
  // bottom bar is found even where the bubble overlaps it.
  function detectBottomBarHeight(vw, vh) {
    if (!document.elementsFromPoint) return 0;
    var xs = [Math.round(vw * 0.5), Math.round(vw * 0.15), Math.round(vw * 0.85)];
    var best = 0;
    for (var i = 0; i < xs.length; i++) {
      var stack = document.elementsFromPoint(xs[i], vh - 2) || [];
      for (var j = 0; j < stack.length; j++) {
        var intr = barFrom(stack[j], vw, vh);
        if (intr > best) best = intr;
      }
    }
    return best;
  }

  // Try known consent-management-platform banners (still geometry-validated).
  function detectKnownBanner(vw, vh) {
    for (var i = 0; i < KNOWN_CONSENT_SELECTORS.length; i++) {
      var el = null;
      try { el = document.querySelector(KNOWN_CONSENT_SELECTORS[i]); } catch (e) { el = null; }
      if (el) {
        var intr = barFrom(el, vw, vh);
        if (intr > 0) {
          if (debug) console.debug("[bcb-widget] consent bar via known selector", KNOWN_CONSENT_SELECTORS[i], intr + "px");
          return intr;
        }
      }
    }
    return 0;
  }

  function recompute() {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var lift = 0;
    var how = "none";
    if (selector) {
      var el = null;
      try { el = document.querySelector(selector); } catch (e) { el = null; }
      if (el) { lift = barFrom(el, vw, vh); how = "selector"; }
    } else if (autoDetect) {
      lift = detectKnownBanner(vw, vh);
      how = "known";
      if (lift === 0) { lift = detectBottomBarHeight(vw, vh); how = "auto"; }
    }
    if (debug) console.debug("[bcb-widget] recompute lift=" + lift + "px via " + how);
    if (lift === autoLift) return;
    autoLift = lift;
    if (!expanded) s.bottom = bottomValue();
  }

  if (selector || autoDetect) {
    var raf =
      window.requestAnimationFrame ||
      function (f) { return setTimeout(f, 16); };
    var scheduled = false;
    function scheduleRecompute() {
      if (scheduled) return;
      scheduled = true;
      raf(function () { scheduled = false; recompute(); });
    }
    window.addEventListener("resize", scheduleRecompute);
    window.addEventListener("orientationchange", scheduleRecompute);
    window.addEventListener("scroll", scheduleRecompute, { passive: true });
    document.addEventListener("DOMContentLoaded", scheduleRecompute);
    window.addEventListener("load", scheduleRecompute);
    try {
      var mo = new MutationObserver(scheduleRecompute);
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden"],
      });
    } catch (e) { /* MutationObserver unsupported — resize + delayed checks still run */ }
    // Catch banners injected asynchronously after initial load.
    [0, 300, 1000, 2500].forEach(function (d) { setTimeout(recompute, d); });
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
