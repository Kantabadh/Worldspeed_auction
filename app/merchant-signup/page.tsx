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

export default function MerchantSignupPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");

  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignup() {
    const cleanMerchantName = merchantName.trim();
    const cleanShopName = shopName.trim();
    const cleanPhoneNumber = cleanPhone(phone);
    const cleanCode = merchantCode.trim().toUpperCase();

    if (!cleanMerchantName || !cleanShopName || !cleanPhoneNumber || !cleanCode) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (!isValidPhone(cleanPhoneNumber)) {
      setErrorMessage("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage("รหัสร้านค้าต้องมีอย่างน้อย 4 ตัวอักษร");
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
      .select("id, merchant_code, phone")
      .or(`phone.eq.${cleanPhoneNumber},merchant_code.eq.${cleanCode}`)
      .limit(1);

    if (existingError) {
      setErrorMessage(existingError.message);
      setIsSubmitting(false);
      return;
    }

    if (existingAccounts && existingAccounts.length > 0) {
      setErrorMessage(
        "เบอร์โทรหรือรหัสร้านค้านี้ถูกใช้แล้ว กรุณาติดต่อผู้ดูแล"
      );
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("merchant_accounts").insert({
      merchant_code: cleanCode,
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
        merchantCode: cleanCode,
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
                onChange={(e) => setMerchantName(e.target.value)}
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
                onChange={(e) => setShopName(e.target.value)}
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
                onChange={(e) => setPhone(cleanPhone(e.target.value))}
              />

              <p className="mt-1 text-xs text-gray-500">
                ใช้ได้ทั้งเบอร์บ้าน 9 หลัก และเบอร์มือถือ 10 หลัก
              </p>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                รหัสร้านค้า
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg uppercase outline-none focus:ring-2 focus:ring-black"
                placeholder="เช่น M001"
                value={merchantCode}
                onChange={(e) => setMerchantCode(e.target.value.toUpperCase())}
              />

              <p className="mt-2 text-xs text-gray-500">
                ใช้รหัสนี้สำหรับเข้าสู่ระบบ
              </p>
            </div>

            <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={(e) => setAcceptedPolicy(e.target.checked)}
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
                  กรุณาอ่านก่อนสมัครร้านค้า
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
                1. ผู้สมัครต้องกรอกข้อมูลจริงและถูกต้อง เช่น ชื่อร้าน
                ชื่อผู้ติดต่อ และเบอร์โทร
              </p>

              <p>
                2. ระบบจะบันทึกข้อมูลร้านค้า เบอร์โทร รายการรถ และราคาที่เสนอ
                เพื่อใช้ในการจัดการเสนอราคาและติดต่อกลับ
              </p>

              <p>
                3. ผู้ใช้งานต้องรักษารหัสร้านค้าของตนเอง
                หากมีผู้อื่นใช้รหัสร้านค้า ระบบอาจถือว่าเป็นการใช้งานจากร้านค้านั้น
              </p>

              <p>
                4. ก่อนส่งราคา ผู้ใช้งานต้องตรวจสอบรายการรถและราคาให้ถูกต้อง
                เมื่อกดยืนยัน ระบบจะบันทึกราคาตามที่แสดง
              </p>

              <p>
                5. บริษัทมีสิทธิ์ตรวจสอบ ยกเลิก หรือปฏิเสธราคา
                หากพบข้อผิดพลาด การใช้งานผิดปกติ หรือเหตุจำเป็นทางธุรกิจ
              </p>

              <p>
                6. หากมีผู้เสนอราคาสูงสุดเท่ากัน บริษัทจะเป็นผู้พิจารณาขั้นตอนต่อไป
                และการแสดงราคาสูงสุดไม่ได้หมายความว่าการซื้อขายเสร็จสมบูรณ์ทันที
              </p>

              <p>
                7. ข้อมูลรถ รูปภาพ และรายละเอียดในระบบใช้เพื่อประกอบการเสนอราคา
                ผู้ใช้งานควรตรวจสอบข้อมูลกับบริษัทอีกครั้งก่อนตัดสินใจซื้อ
              </p>

              <p>
                8. บริษัทจะดูแลข้อมูลตามความเหมาะสม
                แต่ระบบออนไลน์อาจมีความเสี่ยงจากเหตุขัดข้องหรือปัญหาทางเทคนิค
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