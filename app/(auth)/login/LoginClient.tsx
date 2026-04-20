"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";

export function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await loginAction(username, password);

    if (res.success) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(res.error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg2)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <img src="/favicon.ico" alt="Nomichi" className="mx-auto mb-4 h-12 w-12 rounded-lg" />
          <h1 className="text-xl font-semibold text-[var(--ink)]">
            Nomichi CMS
          </h1>
          <p className="mt-1 text-sm text-[var(--mid)]">
            Sign in to manage your website
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-[var(--ink2)] mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--fog)] focus:border-[var(--rust)] focus:outline-none focus:ring-1 focus:ring-[var(--rust)]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--ink2)] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--fog)] focus:border-[var(--rust)] focus:outline-none focus:ring-1 focus:ring-[var(--rust)]"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-[var(--red-bg)] px-3 py-2 text-sm text-[var(--red)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--ink2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
