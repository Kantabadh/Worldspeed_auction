"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError || !loginData.user) {
      setErrorMessage(loginError?.message || "Invalid email or password.");
      setIsLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active")
      .eq("id", loginData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profileData || profileData.length === 0) {
      await supabase.auth.signOut();
      setErrorMessage(
        profileError?.message ||
          "This account is not registered as an active admin or owner."
      );
      setIsLoading(false);
      return;
    }

    const profile = profileData[0];

    localStorage.setItem(
      "staffProfile",
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        active: profile.active,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })
    );

    setIsLoading(false);
    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Staff Access
            </p>

            <h1 className="mt-3 text-3xl font-bold">Admin / Owner Login</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Use your assigned email and password. Owner and admin access are
              separated automatically by account role.
            </p>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="font-semibold">Login failed</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                Email
              </label>

              <input
                type="email"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>

              <input
                type="password"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isLoading ? "Checking account..." : "Login"}
            </button>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Account role
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Owner accounts can access Owner Settings. Admin accounts can
                access normal auction management pages only.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                Back to home
              </Link>

              <p className="text-xs text-gray-400">10-minute idle timeout</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}