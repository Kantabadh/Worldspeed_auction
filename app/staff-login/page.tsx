"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isLoading) return;

    if (!email.trim() || !password) {
      setErrorMessage("กรุณากรอกอีเมลและรหัสผ่าน");
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
      setErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
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
          "บัญชีนี้ยังไม่ได้รับสิทธิ์แอดมินหรือ Owner"
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

    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              ผู้ดูแลระบบ
            </p>

            <h1 className="mt-3 text-3xl font-bold">เข้าสู่ระบบ</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              สำหรับ Admin และ Owner เท่านั้น
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6">
            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="font-semibold">เข้าสู่ระบบไม่ได้</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                อีเมล
              </label>

              <input
                type="email"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                รหัสผ่าน
              </label>

              <input
                type="password"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isLoading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>

           

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                กลับหน้าแรก
              </Link>

              <p className="text-xs text-gray-400">หมดเวลาเมื่อไม่ใช้งาน 10 นาที</p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}