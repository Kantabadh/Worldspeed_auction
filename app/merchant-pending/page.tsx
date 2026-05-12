"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SignupReceipt = {
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
};

type ApprovalStatus = "pending" | "approved" | "rejected" | "unknown";

export default function MerchantPendingPage() {
  const [receipt, setReceipt] = useState<SignupReceipt | null>(null);
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("unknown");
  const [statusMessage, setStatusMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function checkApprovalStatus(receiptData?: SignupReceipt) {
    const currentReceipt = receiptData || receipt;

    if (!currentReceipt) return;

    setIsChecking(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("approval_status, active")
      .eq("phone", currentReceipt.phone)
      .eq("merchant_code", currentReceipt.merchantCode)
      .limit(1);

    if (error) {
      setApprovalStatus("unknown");
      setStatusMessage(error.message);
      setIsChecking(false);
      return;
    }

    if (!data || data.length === 0) {
      setApprovalStatus("unknown");
      setStatusMessage("ไม่พบข้อมูลสมัคร กรุณาติดต่อผู้ดูแลระบบ");
      setIsChecking(false);
      return;
    }

    const account = data[0];

    if (account.approval_status === "approved" && account.active) {
      setApprovalStatus("approved");
      setStatusMessage("อนุมัติแล้ว สามารถเข้าสู่ระบบได้");
      setIsChecking(false);
      return;
    }

    if (account.approval_status === "rejected") {
      setApprovalStatus("rejected");
      setStatusMessage("คำขอนี้ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ");
      setIsChecking(false);
      return;
    }

    setApprovalStatus("pending");
    setStatusMessage("ยังรออนุมัติ กรุณารอผู้ดูแลระบบตรวจสอบ");
    setIsChecking(false);
  }

  useEffect(() => {
    const savedReceipt = localStorage.getItem("merchantSignupReceipt");

    if (savedReceipt) {
      const parsedReceipt = JSON.parse(savedReceipt) as SignupReceipt;
      setReceipt(parsedReceipt);
      checkApprovalStatus(parsedReceipt);
    }
  }, []);

  if (!receipt) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
          <div className="w-full rounded-[32px] bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <h1 className="text-2xl font-bold text-gray-900">
              ไม่พบข้อมูลสมัคร
            </h1>

            <p className="mt-3 text-sm text-gray-600">
              กรุณาสมัครร้านค้าก่อน
            </p>

            <Link
              href="/merchant-signup"
              className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              ไปหน้าสมัครร้านค้า
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const topStatusBoxClass =
    approvalStatus === "approved"
      ? "rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800"
      : approvalStatus === "rejected"
      ? "rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
      : "rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800";

  const statusCardClass =
    approvalStatus === "approved"
      ? "mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
      : approvalStatus === "rejected"
      ? "mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      : "mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700";

  const topTitle =
    approvalStatus === "approved"
      ? "อนุมัติแล้ว"
      : approvalStatus === "rejected"
      ? "ไม่อนุมัติ"
      : "รออนุมัติ";

  const topDescription =
    approvalStatus === "approved"
      ? "บัญชีร้านค้าได้รับการอนุมัติแล้ว สามารถเข้าสู่ระบบได้"
      : approvalStatus === "rejected"
      ? "คำขอสมัครนี้ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ"
      : "ส่งคำขอสมัครแล้ว กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าสู่ระบบ";

  const boxTitle =
    approvalStatus === "approved"
      ? "พร้อมเข้าสู่ระบบ"
      : approvalStatus === "rejected"
      ? "ไม่ได้รับการอนุมัติ"
      : "กำลังรออนุมัติ";

  const boxDescription =
    approvalStatus === "approved"
      ? "ใช้เบอร์โทรและรหัสร้านค้าด้านล่างเพื่อเข้าสู่ระบบ"
      : approvalStatus === "rejected"
      ? "บัญชีนี้ยังไม่สามารถใช้งานได้ กรุณาติดต่อผู้ดูแลระบบ"
      : "หลังจากอนุมัติแล้ว ให้ใช้ข้อมูลด้านล่างเข้าสู่ระบบ";

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              สถานะการสมัคร
            </p>

            <h1 className="mt-3 text-3xl font-bold">{topTitle}</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              {topDescription}
            </p>
          </div>

          <div className="p-6">
            <div className={topStatusBoxClass}>
              <p className="font-semibold">{boxTitle}</p>
              <p className="mt-1 text-sm">{boxDescription}</p>
            </div>

            <section className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                ข้อมูลร้านค้า
              </p>

              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">ชื่อร้าน</p>
                  <p className="font-bold text-gray-900">{receipt.shopName}</p>
                </div>

                <div>
                  <p className="text-gray-500">ผู้ติดต่อ</p>
                  <p className="font-bold text-gray-900">
                    {receipt.merchantName}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">
                ข้อมูลเข้าสู่ระบบ
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    เบอร์โทร
                  </p>
                  <p className="mt-1 rounded-xl bg-gray-100 p-3 font-mono text-lg font-bold text-gray-900">
                    {receipt.phone}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    รหัสร้านค้า
                  </p>
                  <p className="mt-1 rounded-xl bg-gray-100 p-3 font-mono text-lg font-bold text-gray-900">
                    {receipt.merchantCode}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                กรุณาเก็บข้อมูลนี้ไว้ ใช้สำหรับเข้าสู่ระบบหลังได้รับอนุมัติ
              </p>
            </section>

            {statusMessage && (
              <div className={statusCardClass}>{statusMessage}</div>
            )}

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => checkApprovalStatus()}
                disabled={isChecking}
                className="rounded-2xl border px-4 py-3 font-semibold hover:bg-gray-100 disabled:bg-gray-100"
              >
                {isChecking ? "กำลังตรวจสอบ..." : "ตรวจสอบสถานะ"}
              </button>

              {approvalStatus === "approved" && (
                <Link
                  href="/merchant-login"
                  className="rounded-2xl bg-black px-4 py-3 text-center font-semibold text-white"
                >
                  ไปหน้าเข้าสู่ระบบ
                </Link>
              )}

              <Link
                href="/"
                className="text-center text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                กลับหน้าแรก
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}