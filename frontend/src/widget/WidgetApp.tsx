import { useCallback, useEffect } from "react";
import { ChatWidget } from "@/pages/BlueCrossStaticPage";

// Message channel to the parent loader (public/widget.js). The loader resizes the
// iframe between "bubble" (collapsed) and "overlay" (expanded) based on these.
const SOURCE = "bcb-widget";

function post(type: "ready" | "open" | "close" | "hover" | "unhover") {
    try {
        // targetOrigin '*' is fine — these are non-sensitive UI resize signals and
        // the host page's origin is unknown at build time.
        window.parent?.postMessage({ source: SOURCE, type }, "*");
    } catch {
        /* not embedded / cross-origin restricted — ignore */
    }
}

/**
 * Standalone host for the embeddable widget: renders the SAME `ChatWidget` the
 * `/blue_cross/chat` page uses (so behaviour/UI are identical), with no marketing
 * landing page or router — just the floating bubble + chat overlay. It relays the
 * open/close state to the parent iframe loader so the iframe can grow and shrink.
 */
export default function WidgetApp() {
    useEffect(() => {
        post("ready");
    }, []);

    const handleOpenChange = useCallback((open: boolean) => {
        post(open ? "open" : "close");
    }, []);

    const handleLauncherHover = useCallback((hovering: boolean) => {
        post(hovering ? "hover" : "unhover");
    }, []);

    return (
        <ChatWidget onOpenChange={handleOpenChange} onLauncherHover={handleLauncherHover} />
    );
}
