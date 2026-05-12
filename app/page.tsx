"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <div className="w-full rounded-[32px] bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-black text-2xl font-bold text-white">
              รถ
            </div>

            <h1 className="mt-5 text-3xl font-bold text-gray-900">
              ระบบเสนอราคา
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              รถจักรยานยนต์
            </p>
          </div>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border bg-gray-50 p-5">
              <h2 className="text-xl font-bold text-gray-900">ร้านค้า</h2>

              <div className="mt-5 grid gap-3">
                <Link
                  href="/merchant-login"
                  className="rounded-2xl bg-black px-5 py-4 text-center font-semibold text-white shadow hover:bg-gray-800"
                >
                  เข้าสู่ระบบ
                </Link>

                <Link
                  href="/merchant-signup"
                  className="rounded-2xl border bg-white px-5 py-4 text-center font-semibold hover:bg-gray-100"
                >
                  สมัครร้านค้า
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-gray-50 p-5">
              <h2 className="text-xl font-bold text-gray-900">ผู้ดูแล</h2>

              <div className="mt-5 grid gap-3">
                <Link
                  href="/staff-login"
                  className="rounded-2xl bg-white px-5 py-4 text-center font-semibold ring-1 ring-gray-300 hover:bg-gray-100"
                >
                  เข้าสู่ระบบผู้ดูแล
                </Link>
              </div>
            </div>
          </section>

          <p className="mt-8 text-center text-xs text-gray-400">
            เลือกเมนูที่ต้องการ
          </p>
        </div>
      </section>
    </main>
  );
}