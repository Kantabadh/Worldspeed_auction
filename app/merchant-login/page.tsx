"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type MerchantAccount = {
  id: number;
  merchant_code: string;
  merchant_name: string;
  shop_name: string;
  phone: string;
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
};

const MERCHANT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

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

export default function MerchantLoginPage() {
  const [phone, setPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [rememberPhone, setRememberPhone] = useState(true);

  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem("rememberedMerchantPhone");

    if (savedPhone) {
      setPhone(savedPhone);
      setRememberPhone(true);
    }

    const savedPolicy = localStorage.getItem("merchantAcceptedPolicy");

    if (savedPolicy === "yes") {
      setAcceptedPolicy(true);
    }
  }, []);

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isLoading) return;

    const cleanPhoneNumber = cleanPhone(phone);
    const cleanCode = merchantCode.trim();

    if (!cleanPhoneNumber || !cleanCode) {
      setErrorMessage("กรุณากรอกเบอร์โทรและรหัสผ่าน");
      return;
    }

    if (!isValidPhone(cleanPhoneNumber)) {
      setErrorMessage("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    if (!acceptedPolicy) {
      setErrorMessage("กรุณายอมรับเงื่อนไขก่อนเข้าสู่ระบบ");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("*")
      .eq("phone", cleanPhoneNumber)
      .eq("merchant_code", cleanCode)
      .limit(1);

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setErrorMessage("เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง");
      setIsLoading(false);
      return;
    }

    const merchant = data[0] as MerchantAccount;

    if (merchant.approval_status === "pending") {
      setErrorMessage("บัญชีร้านค้านี้ยังรออนุมัติ กรุณารอผู้ดูแลระบบอนุมัติ");
      setIsLoading(false);
      return;
    }

    if (merchant.approval_status === "rejected") {
      setErrorMessage("บัญชีร้านค้านี้ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแล");
      setIsLoading(false);
      return;
    }

    if (!merchant.active || merchant.approval_status !== "approved") {
      setErrorMessage("บัญชีร้านค้านี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล");
      setIsLoading(false);
      return;
    }

    if (rememberPhone) {
      localStorage.setItem("rememberedMerchantPhone", cleanPhoneNumber);
    } else {
      localStorage.removeItem("rememberedMerchantPhone");
    }

    localStorage.setItem("merchantAcceptedPolicy", "yes");

    localStorage.setItem(
      "merchantSession",
      JSON.stringify({
        merchantAccountId: merchant.id,
        merchantName: merchant.merchant_name,
        shopName: merchant.shop_name,
        phone: merchant.phone,
        merchantCode: merchant.merchant_code,
        expiresAt: Date.now() + MERCHANT_TIMEOUT_MS,
      })
    );

    localStorage.removeItem("merchantOfferPrices");
    localStorage.removeItem("draftSubmission");

    window.location.href = "/merchant";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              ร้านค้า
            </p>

            <h1 className="mt-3 text-3xl font-bold">เข้าสู่ระบบ</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              ใช้เบอร์โทรและรหัสผ่านเพื่อเสนอราคา
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

              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={rememberPhone}
                  onChange={(event) => setRememberPhone(event.target.checked)}
                  className="h-4 w-4"
                />
                จำเบอร์โทรไว้
              </label>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                รหัสผ่าน
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-2xl border px-4 py-3 pr-14 text-lg outline-none focus:ring-2 focus:ring-black"
                  placeholder="กรอกรหัสผ่าน"
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
            </div>

            <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={(event) => setAcceptedPolicy(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />

                <span className="text-sm leading-6 text-gray-700">
                  ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
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
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/merchant-signup"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                สมัครร้านค้า
              </Link>

              <Link
                href="/"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                กลับหน้าแรก
              </Link>
            </div>
          </form>
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
                  กรุณาอ่านก่อนเข้าสู่ระบบ
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
                1. ผู้ใช้งานต้องใช้บัญชีของตนเอง และรักษารหัสผ่านไม่ให้ผู้อื่นใช้งานแทน
              </p>

              <p>
                2. ระบบจะบันทึกชื่อร้านค้า ชื่อผู้ติดต่อ เบอร์โทร รายการรถ และราคาที่เสนอ
                เพื่อใช้ในการจัดการเสนอราคาและการติดต่อกลับ
              </p>

              <p>
                3. ก่อนส่งราคา ผู้ใช้งานต้องตรวจสอบรายการรถและราคาให้ถูกต้อง
              </p>

              <p>
                4. เมื่อกดยืนยันส่งราคา ระบบจะถือว่าราคานั้นเป็นราคาที่ร้านค้าส่งผ่านระบบ
              </p>

              <p>
                5. บริษัทมีสิทธิ์ตรวจสอบ ยกเลิก หรือปฏิเสธราคา หากพบข้อผิดพลาด
                การใช้งานผิดปกติ หรือเหตุจำเป็นทางธุรกิจ
              </p>

              <p>
                6. หากมีผู้เสนอราคาสูงสุดเท่ากัน บริษัทจะเป็นผู้พิจารณาขั้นตอนต่อไป
              </p>

              <p>
                7. ข้อมูลรถ รูปภาพ และรายละเอียดในระบบใช้เพื่อประกอบการเสนอราคา
                ผู้ใช้งานควรตรวจสอบข้อมูลกับบริษัทอีกครั้งก่อนตัดสินใจซื้อ
              </p>

              <p>
                8. บริษัทจะดูแลข้อมูลตามความเหมาะสม แต่ระบบออนไลน์อาจมีเหตุขัดข้อง
                หรือปัญหาทางเทคนิคได้
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setAcceptedPolicy(true);
                  localStorage.setItem("merchantAcceptedPolicy", "yes");
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