"use client";

import { Monitor, Smartphone, LayoutList, FileText, Sun, Moon } from "lucide-react";

interface PreviewControlsProps {
  previewMode: "card" | "detail";
  onModeChange: (mode: "card" | "detail") => void;
  viewport: "desktop" | "mobile";
  onViewportChange: (vp: "desktop" | "mobile") => void;
  iframeReady: boolean;
  darkMode: boolean;
  onDarkModeChange: (dark: boolean) => void;
}

function SegmentButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-rust text-white"
          : "bg-surface2 text-mid hover:bg-surface3"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

export function PreviewControls({
  previewMode,
  onModeChange,
  viewport,
  onViewportChange,
  iframeReady,
  darkMode,
  onDarkModeChange,
}: PreviewControlsProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 border-b border-line bg-surface">
      <div className="flex items-center gap-1">
        <SegmentButton
          active={previewMode === "card"}
          onClick={() => onModeChange("card")}
          disabled={!iframeReady}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Card
        </SegmentButton>
        <SegmentButton
          active={previewMode === "detail"}
          onClick={() => onModeChange("detail")}
          disabled={!iframeReady}
        >
          <FileText className="h-3.5 w-3.5" />
          Detail
        </SegmentButton>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onDarkModeChange(!darkMode)}
          disabled={!iframeReady}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-mid hover:bg-surface3 transition-colors disabled:opacity-50"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <div className="flex items-center gap-1">
          <SegmentButton
            active={viewport === "desktop"}
            onClick={() => onViewportChange("desktop")}
            disabled={!iframeReady}
          >
            <Monitor className="h-3.5 w-3.5" />
          </SegmentButton>
          <SegmentButton
            active={viewport === "mobile"}
            onClick={() => onViewportChange("mobile")}
            disabled={!iframeReady}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </SegmentButton>
        </div>
      </div>
    </div>
  );
}
