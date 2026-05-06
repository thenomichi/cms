"use client";

import { useEffect, useRef, useState } from "react";

interface PreviewFrameProps {
  websiteUrl: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeReady: boolean;
  viewport: "desktop" | "mobile";
  previewMode: "card" | "detail";
}

export function PreviewFrame({
  websiteUrl,
  iframeRef,
  iframeReady,
  viewport,
  previewMode,
}: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (iframeReady) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!iframeReady) setTimedOut(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [iframeReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      setContainerWidth(el!.clientWidth);
      setContainerHeight(el!.clientHeight);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const iframeSrc = `${websiteUrl}/preview/trip`;
  const useDesktopScaling = previewMode === "detail" && viewport === "desktop";
  const useMobile = viewport === "mobile";
  const scale = containerWidth > 0 ? Math.min(containerWidth / 1280, 1) : 0.5;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-surface2"
    >
      {!iframeReady && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface2">
          {timedOut ? (
            <p className="max-w-[240px] text-center text-sm text-mid">
              Preview unavailable — make sure the website is running
            </p>
          ) : (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-rust border-t-transparent" />
              <p className="text-xs text-mid">Loading preview...</p>
            </>
          )}
        </div>
      )}

      {useDesktopScaling ? (
        /*
         * Desktop detail: iframe is 1280px, scaled down via CSS transform.
         * CSS transform doesn't shrink the layout box, so we wrap in a div
         * sized to the container's actual dimensions with overflow:hidden.
         * This clips the 1280px layout box to the visible scaled area.
         */
        <div
          style={{
            width: containerWidth,
            height: containerHeight,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Trip Preview"
            style={{
              border: "none",
              position: "absolute",
              top: 0,
              left: 0,
              width: 1280,
              height: containerHeight > 0 ? containerHeight / scale : 2000,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      ) : useMobile ? (
        <div className="flex h-full items-start justify-center overflow-y-auto pt-4 pb-4">
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Trip Preview"
            style={{
              border: "none",
              width: 375,
              height: "100%",
              minHeight: 667,
              borderRadius: 12,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            }}
          />
        </div>
      ) : (
        /* Card mode: iframe at panel's natural width */
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Trip Preview"
          style={{
            border: "none",
            width: "100%",
            height: "100%",
          }}
        />
      )}
    </div>
  );
}
