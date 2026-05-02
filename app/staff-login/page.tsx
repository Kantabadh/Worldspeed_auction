"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

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
      setErrorMessage("Invalid email or password.");
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active")
      .eq("id", loginData.user.id)
      .eq("active", true)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setErrorMessage("This staff account is not active or not allowed.");
      setIsLoading(false);
      return;
    }

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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-gray-200">
        <div className="bg-black px-6 py-6 text-white">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Motorcycle Offer System
          </p>

          <h1 className="mt-2 text-2xl font-bold">Staff Login</h1>

          <p className="mt-2 text-sm text-gray-300">
            Owner and admin access only.
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
            <label className="text-sm font-medium text-gray-700">Email</label>

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
            {isLoading ? "Checking..." : "Login"}
          </button>

          <p className="mt-4 text-center text-xs text-gray-500">
            Staff session expires after 10 minutes of no activity.
          </p>
        </div>
      </section>
    </main>
  );
}