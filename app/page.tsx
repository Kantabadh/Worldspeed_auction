"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function HomePage() {
  const [selectedTab, setSelectedTab] = useState<"merchant" | "admin">(
    "merchant"
  );
  const [merchantPhone, setMerchantPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [rememberPhone, setRememberPhone] = useState(true);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showConsentPolicy, setShowConsentPolicy] = useState(false);
  const [merchantErrorMessage, setMerchantErrorMessage] = useState("");
  const [isMerchantLoading, setIsMerchantLoading] = useState(false);

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffErrorMessage, setStaffErrorMessage] = useState("");
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem("rememberedMerchantPhone");
    const savedPolicy = localStorage.getItem("merchantAcceptedPolicy");

    if (savedPhone) {
      setMerchantPhone(savedPhone);
      setRememberPhone(true);
    }

    if (savedPolicy === "yes") {
      setAcceptedPolicy(true);
    }
  }, []);

  async function handleMerchantLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isMerchantLoading) return;

    const cleanPhoneNumber = cleanPhone(merchantPhone);
    const cleanCode = merchantCode.trim();

    if (!cleanPhoneNumber || !cleanCode) {
      setMerchantErrorMessage("กรุณากรอกเบอร์โทรและรหัสร้านค้า");
      return;
    }

    if (!isValidPhone(cleanPhoneNumber)) {
      setMerchantErrorMessage("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    if (!acceptedPolicy) {
      setMerchantErrorMessage("กรุณายอมรับเงื่อนไขก่อนเข้าสู่ระบบ");
      return;
    }

    setIsMerchantLoading(true);
    setMerchantErrorMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("id, merchant_code, merchant_name, shop_name, phone, active, approval_status")
      .eq("phone", cleanPhoneNumber)
      .eq("merchant_code", cleanCode)
      .limit(1);

    if (error) {
      setMerchantErrorMessage(error.message);
      setIsMerchantLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setMerchantErrorMessage("เบอร์โทรหรือรหัสร้านค้าไม่ถูกต้อง");
      setIsMerchantLoading(false);
      return;
    }

    const merchant = data[0] as MerchantAccount;

    if (merchant.approval_status === "pending") {
      setMerchantErrorMessage(
        "บัญชีร้านค้านี้ยังรออนุมัติ กรุณารอผู้ดูแลระบบอนุมัติ"
      );
      setIsMerchantLoading(false);
      return;
    }

    if (merchant.approval_status === "rejected") {
      setMerchantErrorMessage("บัญชีร้านค้านี้ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแล");
      setIsMerchantLoading(false);
      return;
    }

    if (!merchant.active || merchant.approval_status !== "approved") {
      setMerchantErrorMessage("บัญชีร้านค้านี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล");
      setIsMerchantLoading(false);
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

  async function handleStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isStaffLoading) return;

    if (!staffEmail.trim() || !staffPassword) {
      setStaffErrorMessage("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    setIsStaffLoading(true);
    setStaffErrorMessage("");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: staffEmail.trim(),
        password: staffPassword,
      });

    if (loginError || !loginData.user) {
      setStaffErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setIsStaffLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active, branch_code, branch_name")
      .eq("id", loginData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profileData || profileData.length === 0) {
      await supabase.auth.signOut();
      setStaffErrorMessage(
        profileError?.message || "บัญชีนี้ยังไม่ได้รับสิทธิ์แอดมินหรือ Owner"
      );
      setIsStaffLoading(false);
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
        branch_code: profile.branch_code,
        branch_name: profile.branch_name,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })
    );

    window.location.href =
      profile.role === "stock_staff" ? "/admin/stock" : "/admin";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#eef5ff_48%,#f6f7fb_100%)] px-4 py-5 sm:px-6 sm:py-7">
      <section className="w-full max-w-xl -translate-y-3 sm:-translate-y-4">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex w-full max-w-[440px] items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm sm:px-7 sm:py-4">
            <img
              src="/worldspeed-logo.png"
              alt="เวิลด์สปีด"
              width={440}
              height={80}
              decoding="async"
              className="h-auto max-h-[4.5rem] w-full object-contain sm:max-h-20"
            />
          </div>

          <h1 className="mt-3 text-xl font-semibold text-gray-950 sm:text-2xl">
            ระบบเสนอราคารถจักรยานยนต์
          </h1>
        </div>

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-xl shadow-slate-200/80 sm:p-7">
          <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setSelectedTab("merchant")}
              className={
                selectedTab === "merchant"
                  ? "rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-950 shadow-sm sm:text-base"
                  : "rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:text-gray-900 sm:text-base"
              }
            >
              ร้านค้า
            </button>

            <button
              type="button"
              onClick={() => setSelectedTab("admin")}
              className={
                selectedTab === "admin"
                  ? "rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-950 shadow-sm sm:text-base"
                  : "rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:text-gray-900 sm:text-base"
              }
            >
              ผู้ดูแลระบบ
            </button>
          </div>

          <div className="mt-6">
            {selectedTab === "merchant" ? (
              <form onSubmit={handleMerchantLogin}>
                {merchantErrorMessage && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                    <p className="font-semibold">เข้าสู่ระบบไม่ได้</p>
                    <p className="text-sm">{merchantErrorMessage}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    เบอร์โทร
                  </label>

                  <input
                    inputMode="numeric"
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-black"
                    placeholder="9 หรือ 10 หลัก"
                    value={merchantPhone}
                    onChange={(event) =>
                      setMerchantPhone(cleanPhone(event.target.value))
                    }
                    disabled={isMerchantLoading}
                  />

                  <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={rememberPhone}
                      onChange={(event) =>
                        setRememberPhone(event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    จำเบอร์โทรไว้
                  </label>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">
                    รหัสร้านค้า
                  </label>

                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-black"
                    placeholder="กรอกรหัสร้านค้า"
                    value={merchantCode}
                    onChange={(event) => setMerchantCode(event.target.value)}
                    disabled={isMerchantLoading}
                  />
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
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
                  onClick={() => setShowConsentPolicy(true)}
                  className="mt-3 text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-600"
                >
                  อ่านเงื่อนไขการใช้งาน
                </button>

                <button
                  type="submit"
                  disabled={isMerchantLoading}
                  className="mt-6 flex w-full items-center justify-center rounded-2xl bg-black px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:bg-gray-400 sm:text-lg"
                >
                  {isMerchantLoading
                    ? "กำลังเข้าสู่ระบบ..."
                    : "เข้าสู่ระบบร้านค้า"}
                </button>

                <a
                  href="/merchant-signup"
                  className="mt-3 flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-4 text-base font-bold text-gray-900 transition hover:bg-gray-100 sm:text-lg"
                >
                  สมัครร้านค้าใหม่
                </a>
              </form>
            ) : (
              <form onSubmit={handleStaffLogin}>
                {staffErrorMessage && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                    <p className="font-semibold">เข้าสู่ระบบไม่ได้</p>
                    <p className="text-sm">{staffErrorMessage}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    อีเมล
                  </label>

                  <input
                    type="email"
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-black"
                    placeholder="admin@example.com"
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    disabled={isStaffLoading}
                  />
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">
                    รหัสผ่าน
                  </label>

                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-black"
                    placeholder="รหัสผ่าน"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    disabled={isStaffLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isStaffLoading}
                  className="mt-6 flex w-full items-center justify-center rounded-2xl bg-black px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:bg-gray-400 sm:text-lg"
                >
                  {isStaffLoading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบผู้ดูแล"}
                </button>
              </form>
            )}
          </div>
        </section>
      </section>

      {showConsentPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900">
              เงื่อนไขการใช้งาน
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-7 text-gray-700">
              <p>
                การเสนอราคานี้เป็นการเสนอราคาแบบปิด ร้านค้าต้องตรวจสอบข้อมูลรถและราคาที่เสนอให้ถูกต้องก่อนส่งราคา เมื่อส่งราคาแล้ว ระบบจะบันทึกราคาไว้สำหรับรอบประมูลปัจจุบัน และเจ้าหน้าที่จะใช้ข้อมูลนี้ในการจัดทำใบเสนอราคาและตรวจสอบผลการเสนอราคา
              </p>

              <p>
                ข้อมูลร้านค้า เบอร์โทร และรายการเสนอราคาจะถูกใช้เพื่อดำเนินการภายในบริษัทเท่านั้น
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowConsentPolicy(false)}
              className="mt-6 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
