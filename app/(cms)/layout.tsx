import { redirect } from "next/navigation";
import { isAuthenticated } from "@/app/(auth)/login/actions";
import { CmsShell } from "./CmsShell";

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated();
  if (!authed) redirect("/login");

  return (
    <CmsShell
      user={{ name: "Admin", email: "", role: "Admin" }}
    >
      {children}
    </CmsShell>
  );
}
