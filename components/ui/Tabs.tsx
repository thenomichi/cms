"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-surface3 p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            activeTab === tab.id
              ? "bg-surface text-ink shadow-sm"
              : "text-mid hover:text-ink"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export { Tabs };
export type { TabsProps, Tab };
