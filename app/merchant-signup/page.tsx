"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidPhone(value: string) {
  return /^\d{9,10}$/.test(value);
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4.5 10 8a11.2 11.2 0 01-2.1 3.7M6.1 6.1C4.1 7.4 2.7 9.5 2 12c1 3.5 5 8 10 8a9.7 9.7 0 004.1-.9"
      />
    </svg>
  );
}

export default function MerchantSignupPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");

  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignup() {
    const cleanMerchantName = merchantName.trim();
    const cleanShopName = shopName.trim();
    const cleanPhoneNumber = cleanPhone(phone);
    const cleanPassword = merchantCode.trim();

    if (
      !cleanMerchantName ||
      !cleanShopName ||
      !cleanPhoneNumber ||
      !cleanPassword
    ) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (!isValidPhone(cleanPhoneNumber)) {
      setErrorMessage("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    if (cleanPassword.length < 4) {
      setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร");
      return;
    }

    if (!acceptedPolicy) {
      setErrorMessage("กรุณายอมรับเงื่อนไขก่อนสมัครร้านค้า");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const { data: existingAccounts, error: existingError } = await supabase
      .from("merchant_accounts")
      .select("id, phone")
      .eq("phone", cleanPhoneNumber)
      .limit(1);

    if (existingError) {
      setErrorMessage(existingError.message);
      setIsSubmitting(false);
      return;
    }

    if (existingAccounts && existingAccounts.length > 0) {
      setErrorMessage("เบอร์โทรนี้ถูกใช้แล้ว กรุณาติดต่อผู้ดูแล");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("merchant_accounts").insert({
      merchant_code: cleanPassword,
      merchant_name: cleanMerchantName,
      shop_name: cleanShopName,
      phone: cleanPhoneNumber,
      active: false,
      approval_status: "pending",
      can_edit_submission: false,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    localStorage.setItem(
      "merchantSignupReceipt",
      JSON.stringify({
        merchantName: cleanMerchantName,
        shopName: cleanShopName,
        phone: cleanPhoneNumber,
        merchantCode: cleanPassword,
      })
    );

    setIsSubmitting(false);
    window.location.href = "/merchant-pending";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              สมัครร้านค้า
            </p>

            <h1 className="mt-3 text-3xl font-bold">ลงทะเบียนร้านค้า</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              กรอกข้อมูล แล้วรอผู้ดูแลอนุมัติ
            </p>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="font-semibold">สมัครไม่ได้</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                ชื่อผู้ติดต่อ
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="เช่น สมชาย"
                value={merchantName}
                onChange={(event) => setMerchantName(event.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                ชื่อร้าน
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="เช่น สมชายมอเตอร์"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                เบอร์โทร
              </label>

              <input
                inputMode="numeric"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="9 หรือ 10 หลัก"
                value={phone}
                onChange={(event) => setPhone(cleanPhone(event.target.value))}
              />

              <p className="mt-1 text-xs text-gray-500">
                ใช้ได้ทั้งเบอร์บ้าน 9 หลัก และเบอร์มือถือ 10 หลัก
              </p>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                รหัสผ่าน
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-2xl border px-4 py-3 pr-14 text-lg outline-none focus:ring-2 focus:ring-black"
                  placeholder="ตั้งรหัสผ่าน"
                  value={merchantCode}
                  onChange={(event) => setMerchantCode(event.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                ใช้รหัสผ่านนี้สำหรับเข้าสู่ระบบ รหัสผ่านสามารถซ้ำกับร้านค้าอื่นได้
              </p>
            </div>

            <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={(event) =>
                    setAcceptedPolicy(event.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <span className="text-sm leading-6 text-gray-700">
                  ข้าพเจ้ายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowPolicy(true)}
                className="mt-3 text-sm font-semibold text-gray-900 underline underline-offset-4"
              >
                อ่านเงื่อนไข
              </button>
            </div>

            <button
              onClick={handleSignup}
              disabled={isSubmitting}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isSubmitting ? "กำลังส่ง..." : "ส่งคำขอสมัคร"}
            </button>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/merchant-login"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                มีบัญชีแล้ว
              </Link>

              <Link
                href="/"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                กลับหน้าแรก
              </Link>
            </div>
          </div>
        </div>
      </section>

      {showPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  เงื่อนไขการใช้งาน
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  กรุณาอ่านก่อนสมัครใช้งาน
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPolicy(false)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xl font-bold text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-7 text-gray-700">
              <p>
                1. ผู้สมัครต้องกรอกข้อมูลจริง และใช้เบอร์โทรที่สามารถติดต่อได้
              </p>

              <p>
                2. ระบบจะบันทึกชื่อร้านค้า ชื่อผู้ติดต่อ เบอร์โทร และรหัสผ่าน
                เพื่อใช้สำหรับเข้าสู่ระบบเสนอราคา
              </p>

              <p>
                3. หลังสมัครแล้ว บัญชีจะยังไม่สามารถใช้งานได้ทันที
                ต้องรอผู้ดูแลระบบตรวจสอบและอนุมัติก่อน
              </p>

              <p>
                4. ผู้ใช้งานต้องรักษารหัสผ่านของตนเอง
                และไม่ควรให้ผู้อื่นใช้งานบัญชีแทน
              </p>

              <p>
                5. เมื่อบัญชีได้รับอนุมัติ ร้านค้าสามารถเข้าสู่ระบบเพื่อดูรายการรถ
                และส่งราคาผ่านระบบได้
              </p>

              <p>
                6. บริษัทมีสิทธิ์ปฏิเสธ ระงับ หรือปิดการใช้งานบัญชี
                หากพบข้อมูลไม่ถูกต้องหรือมีการใช้งานผิดปกติ
              </p>

              <p>
                7. ข้อมูลที่กรอกในระบบจะถูกใช้เพื่อการจัดการเสนอราคา
                การติดต่อกลับ และการตรวจสอบภายในบริษัท
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setAcceptedPolicy(true);
                  setShowPolicy(false);
                }}
                className="rounded-2xl bg-black px-5 py-3 font-semibold text-white"
              >
                ยอมรับ
              </button>

              <button
                type="button"
                onClick={() => setShowPolicy(false)}
                className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}