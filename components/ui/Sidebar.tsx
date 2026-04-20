"use client";

import {
  LayoutDashboard,
  MapPin,
  Globe,
  Megaphone,
  Star,
  Image,
  MessageSquare,
  HelpCircle,
  Users,
  Briefcase,
  Settings,
  Activity,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trips", label: "Trips", icon: MapPin },
  { id: "destinations", label: "Destinations", icon: Globe },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "media", label: "Media", icon: Image },
  { id: "suggestions", label: "Suggestions", icon: MessageSquare },
  { id: "faqs", label: "FAQs", icon: HelpCircle },
  { id: "team", label: "Team", icon: Users },
  { id: "careers", label: "Careers", icon: Briefcase },
  { id: "settings", label: "Website Config", icon: Settings },
  { id: "activity", label: "Activity Log", icon: Activity },
];

interface SidebarUser {
  name: string;
  email: string;
  role: string;
}

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  user: SidebarUser;
  onLogout: () => void;
  badges?: Record<string, number>;
}

function Sidebar({ activePage, onNavigate, user, onLogout, badges }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col bg-ink text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/favicon.ico" alt="Nomichi" className="h-8 w-8 rounded-lg" />
        <span className="text-sm font-semibold tracking-wide">Nomichi CMS</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            const badgeCount = badges?.[item.id] ?? item.badge;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-rust/15 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                )}
              >
                {/* Active left border */}
                {isActive && (
                  <span className="absolute -left-3 top-1 h-[calc(100%-8px)] w-[3px] rounded-r-full bg-rust" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badgeCount != null && badgeCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rust/20 px-1.5 text-[10px] font-semibold text-rust-l">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
          <p className="text-xs text-white/40 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export { Sidebar, navItems };
export type { SidebarProps, SidebarUser, NavItem };
