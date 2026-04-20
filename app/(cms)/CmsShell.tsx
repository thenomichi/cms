"use client";

import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { TopBar } from "@/components/ui/TopBar";
import { logoutAction } from "@/app/(auth)/login/actions";

interface Props {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Welcome back — here's what's happening" },
  "/trips": { title: "Trips", subtitle: "Manage all trip listings" },
  "/destinations": { title: "Destinations", subtitle: "Locations & regions" },
  "/announcements": { title: "Announcements", subtitle: "Homepage banners & promos" },
  "/reviews": { title: "Reviews", subtitle: "Manage traveller testimonials" },
  "/media": { title: "Media Library", subtitle: "Images & gallery management" },
  "/suggestions": { title: "Suggestions", subtitle: "Trip requests & inquiries" },
  "/faqs": { title: "FAQs", subtitle: "Frequently asked questions" },
  "/team": { title: "Team", subtitle: "Manage team members" },
  "/careers": { title: "Careers", subtitle: "Job listings & openings" },
  "/settings": { title: "Website Config", subtitle: "Hero, contact, branding & footer" },
};

export function CmsShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const activePage = pathname.split("/")[1] || "dashboard";
  const pageInfo = PAGE_TITLES[`/${activePage}`] || { title: activePage };

  const handleNavigate = (page: string) => {
    router.push(`/${page}`);
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        user={user}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 flex-col" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
