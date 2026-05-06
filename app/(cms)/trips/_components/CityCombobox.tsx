"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DbDepartureCity } from "@/lib/types";
import { COUNTRIES } from "@/lib/constants/countries";
import { addDepartureCityAction } from "@/app/(cms)/departure-cities/actions";

interface CityComboboxProps {
  value: string;
  onChange: (cityName: string) => void;
  cities: DbDepartureCity[];
  placeholder?: string;
}

export function CityCombobox({
  value,
  onChange,
  cities,
  placeholder = "Select departure city",
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...cities].sort((a, b) => {
      if (a.is_popular !== b.is_popular) return a.is_popular ? -1 : 1;
      return 0;
    });
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.city_name.toLowerCase().includes(q) ||
        c.country_name.toLowerCase().includes(q),
    );
  }, [cities, query]);

  const exactMatch = useMemo(
    () =>
      filtered.some(
        (c) => c.city_name.toLowerCase() === query.trim().toLowerCase(),
      ),
    [filtered, query],
  );

  const trimmed = query.trim();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20"
      >
        <span className={value ? "" : "text-fog"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-mid" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 text-mid" />
            <input
              autoFocus
              placeholder="Search cities or countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-fog"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <li
                key={c.departure_city_id}
                role="option"
                aria-selected={value === c.city_name}
                onClick={() => {
                  onChange(c.city_name);
                  setOpen(false);
                  setQuery("");
                }}
                className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-surface3"
              >
                <span className="font-medium">{c.city_name}</span>
                <span className="ml-2 text-xs text-mid">{c.country_name}</span>
                {c.is_popular && (
                  <span className="ml-2 text-[10px] uppercase text-rust">Popular</span>
                )}
              </li>
            ))}
            {trimmed && filtered.length === 0 && !exactMatch && (
              <li
                role="option"
                onClick={() => setShowAddModal(true)}
                className="flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-sm text-rust hover:bg-surface3"
              >
                <Plus className="h-4 w-4" />
                {`Add "${trimmed}" as a new city`}
              </li>
            )}
          </ul>
        </div>
      )}

      {showAddModal && (
        <AddCityModal
          initialName={trimmed}
          onClose={() => setShowAddModal(false)}
          onAdded={(city) => {
            onChange(city.city_name);
            setShowAddModal(false);
            setOpen(false);
            setQuery("");
            toast.success(`Added ${city.city_name}`);
          }}
        />
      )}
    </div>
  );
}

interface AddCityModalProps {
  initialName: string;
  onClose: () => void;
  onAdded: (city: DbDepartureCity) => void;
}

function AddCityModal({ initialName, onClose, onAdded }: AddCityModalProps) {
  const [cityName, setCityName] = useState(initialName);
  const [countryCode, setCountryCode] = useState("IN");
  const [isPopular, setIsPopular] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const country = COUNTRIES.find((c) => c.code === countryCode);
    if (!country) {
      toast.error("Pick a country");
      setSubmitting(false);
      return;
    }
    const res = await addDepartureCityAction({
      city_name: cityName.trim(),
      country_code: country.code,
      country_name: country.name,
      is_popular: isPopular,
    });
    setSubmitting(false);
    if (res.success && res.city) {
      onAdded(res.city);
    } else {
      toast.error(res.error ?? "Failed to add city");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Add a new departure city</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">City name</span>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">Country</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
            />
            Mark as popular
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-mid hover:bg-surface3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || cityName.trim().length < 2}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add city"}
          </button>
        </div>
      </div>
    </div>
  );
}
