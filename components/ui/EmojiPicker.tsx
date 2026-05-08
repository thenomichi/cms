"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// Curated emoji categories for the Nomichi CMS. Picked from the 47-chip
// inclusion seed + the website's brand palette (community trips, expert
// hosts, motorcycle trips, Ladakh / Spiti / Meghalaya / Bali / Vietnam /
// Morocco). Emojis can repeat across categories — admins find what they
// need by context, not by uniqueness.
const EMOJI_CATEGORIES = [
  {
    label: "Destinations",
    emojis: [
      "🏔️", "⛰️", "🏝️", "🏖️", "🏜️", "🌊", "🏞️", "🌋", "🗻", "🏕️",
      "🌿", "🌴", "🌺", "🍃", "🌾", "🏛️", "🏯", "⛩️", "🕌", "🏰",
      "🗼", "🗽", "⛪", "🕍", "🛕",
      // additions: scenic + heritage + market staples
      "🌅", "🌄", "🌉", "🛣️", "🛤️", "⛲", "🏟️", "🏪", "🏞️",
    ],
  },
  {
    label: "Transport",
    emojis: [
      "✈️", "🚗", "🚐", "🚌", "🚂", "🚆", "🛳️", "⛵", "🚁", "🛶",
      "🚴", "🏍️", "🛺", "🚕", "🚀", "🛩️", "🚣", "🚢",
      // additions: SUV (backup support), scooter, high-speed rail (Japan),
      // mountain railway (Spiti/Kalka), monorail (Bangkok), pickup truck,
      // tempo traveller stand-in (minibus-ish)
      "🚙", "🛵", "🚄", "🚞", "🚝", "🛻",
    ],
  },
  {
    label: "Activities",
    emojis: [
      "🎯", "🧗", "🏄", "🤿", "🎿", "🪂", "🏊", "🚣", "🏇", "🎣",
      "⛷️", "🛷", "🏋️", "🧘", "🎭", "🎨", "📸", "🎶", "🎪", "🏸",
      // additions: trekking, kayak, live music, festivals/rituals,
      // fireworks (festival nights), shopping/bazaars, cooking class
      // (Vietnam/Thailand), forest bath (Meghalaya), bird watching (Anini)
      "🥾", "🛶", "🎤", "🪔", "🎆", "🛍️", "🍳", "🌳", "🦅",
    ],
  },
  {
    label: "Food & Dining",
    emojis: [
      "🍽️", "🥐", "🥗", "🍿", "☕", "🍵", "🥘", "🍜", "🍱", "🧁",
      "🍕", "🌮", "🍷", "🍹", "🧃",
      // additions: Indian curry / local cuisine, evening drinks,
      // BBQ/grills (Ladakh / Mongolian style), street food (SE Asia),
      // dumplings (East Asia), champagne (invite-only)
      "🍛", "🍻", "🥩", "🍢", "🥟", "🥂",
    ],
  },
  {
    label: "Accommodation",
    emojis: [
      "🏨", "🏩", "🏠", "⛺", "🛖", "🏡", "🏗️", "🏘️", "🛏️", "🏕️",
      // additions: boutique sleep, eco-lodge / treehouse, heritage stays
      // (ryokan / haveli)
      "🛌", "🌳", "🏯",
    ],
  },
  {
    label: "Services & Utilities",
    emojis: [
      "🧭", "🗺️", "📜", "🎒", "🧳", "💼", "🔮", "📱", "💳", "🏥",
      "🧴", "🚻", "⛽", "🔑", "📋", "🎫", "🎟️", "💡", "🔒", "📦",
      // additions matching the master inclusion pool:
      // Trip Captain (🧑‍✈️), Marshall (🚩), Mechanic Support (🛠️),
      // 24/7 Helpline (📞), Travel/Health Insurance (🛡️), Medical Kit
      // (🩹), Oxygen Cylinder (🫁 — Ladakh altitude), Emergencies (🧯),
      // Sat-comms for remote treks (📡), Visa fees (🪪)
      "🧑‍✈️", "🚩", "🛠️", "📞", "🛡️", "🩹", "🫁", "🧯", "📡", "🪪",
    ],
  },
  {
    label: "Adventure & Gear",
    emojis: [
      // Brand-new section — your master pool's Gear & Equipment chips
      // (Riding Gear, Team Gear, Ropes, Camp Equipment, Camera/Drone,
      // Adventure Gear Rental, Photography Equipment) needed a home.
      "🪖", "🎽", "🪢", "🔦", "🎒", "🥾", "🧗", "⛺", "🪜", "🧰",
      "📷", "🪂", "🎿", "🛷", "🛶",
    ],
  },
  {
    label: "Nature & Weather",
    emojis: [
      "🌅", "🌄", "🌠", "🌈", "❄️", "☀️", "🌙", "⭐", "🌸", "🦋",
      "🐘", "🦁", "🐪", "🐬", "🦜", "🌻", "🍂", "🌊",
      // additions: alpine forest (Spiti/Ladakh), monsoon (Meghalaya),
      // overcast (Northeast), wildlife (deer/yak), windy mountain pass
      "🌲", "🌧️", "⛅", "🦌", "🐃", "🌬️",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "✅", "❌", "⚡", "🔥", "💎", "🏆", "🎯", "❤️", "✨", "🌟",
      "💪", "🙌", "👍", "🎉", "🎊", "🏅", "🥇", "🪪", "🧭", "🗝️",
      // additions: welcome kit (🎁 — your seed), schedule cues, pins
      "🎁", "⏰", "📍", "🏷️",
    ],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      {/* Trigger button — shows current emoji or placeholder */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm transition-colors hover:border-rust focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust/20"
      >
        {value ? (
          <>
            <span className="text-lg">{value}</span>
            <span className="text-ink">{value}</span>
          </>
        ) : (
          <span className="text-fog">Click to choose an icon...</span>
        )}
        <svg
          className="ml-auto h-4 w-4 text-mid"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-line bg-surface shadow-lg">
          {/* Category tabs */}
          <div className="flex gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={cn(
                  "whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  activeCategory === i
                    ? "bg-rust/10 text-rust"
                    : "text-mid hover:text-ink hover:bg-surface3",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="max-h-48 overflow-y-auto p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-surface3",
                    value === emoji && "bg-rust/10 ring-1 ring-rust",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Clear button */}
          {value && (
            <div className="border-t border-line px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-mid hover:text-sem-red"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
