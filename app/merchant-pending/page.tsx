"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MerchantSignupReceipt = {
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
};

function maskPassword(value: string) {
  if (!value) return "••••••••";
  return "•".repeat(Math.max(value.length, 6));
}

export default function MerchantPendingPage() {
  const [receipt, setReceipt] = useState<MerchantSignupReceipt | null>(null);

  useEffect(() => {
    const savedReceipt = localStorage.getItem("merchantSignupReceipt");

    if (!savedReceipt) return;

    try {
      setReceipt(JSON.parse(savedReceipt) as MerchantSignupReceipt);
    } catch {
      setReceipt(null);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Pending Approval
            </p>

            <h1 className="mt-3 text-3xl font-bold">
              ส่งคำขอสมัครเรียบร้อยแล้ว
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              บัญชีของคุณกำลังรอผู้ดูแลระบบตรวจสอบและอนุมัติ
            </p>
          </div>

          <div className="p-6">
            <div className="rounded-3xl border bg-gray-50 p-5">
              <h2 className="text-xl font-bold text-gray-900">
                ข้อมูลสำหรับเข้าสู่ระบบ
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                หลังจากได้รับอนุมัติแล้ว ให้ใช้เบอร์โทรและรหัสผ่านที่ตั้งไว้เพื่อเข้าสู่ระบบ
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">
                    ชื่อผู้ติดต่อ
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {receipt?.merchantName || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">ชื่อร้าน</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {receipt?.shopName || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">
                    เบอร์โทร / Username
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {receipt?.phone || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">รหัสผ่าน</p>
                  <p className="mt-1 text-lg font-bold tracking-widest text-gray-900">
                    {maskPassword(receipt?.merchantCode || "")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    เพื่อความปลอดภัย ระบบจะไม่แสดงรหัสผ่านจริง กรุณาจดจำรหัสผ่านที่ตั้งไว้
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
              <p className="font-bold">สถานะ: รออนุมัติ</p>

              <p className="mt-2 text-sm leading-6">
                ตอนนี้ยังไม่สามารถเข้าสู่ระบบได้ กรุณารอผู้ดูแลระบบอนุมัติบัญชีร้านค้าก่อน
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/merchant-login"
                className="flex items-center justify-center rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow hover:bg-gray-800"
              >
                ไปหน้าเข้าสู่ระบบ
              </Link>

              <Link
                href="/"
                className="flex items-center justify-center rounded-2xl border px-5 py-3 font-semibold text-gray-900 hover:bg-gray-100"
              >
                กลับหน้าแรก
              </Link>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-gray-500">
              หากข้อมูลไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขก่อนใช้งาน
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}