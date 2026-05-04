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
      setStatusMessage("Registration not found. Please contact auction staff.");
      setIsChecking(false);
      return;
    }

    const account = data[0];

    if (account.approval_status === "approved" && account.active) {
      setApprovalStatus("approved");
      setStatusMessage("Approved. You can now log in.");
      setIsChecking(false);
      return;
    }

    if (account.approval_status === "rejected") {
      setApprovalStatus("rejected");
      setStatusMessage(
        "Your registration was not approved. Please contact auction staff."
      );
      setIsChecking(false);
      return;
    }

    setApprovalStatus("pending");
    setStatusMessage("Still pending approval. Please wait for auction staff.");
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
              No Registration Found
            </h1>

            <p className="mt-3 text-sm text-gray-600">
              Please register your merchant account first.
            </p>

            <Link
              href="/merchant-signup"
              className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              Go to Registration
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
      ? "Approved"
      : approvalStatus === "rejected"
      ? "Registration Rejected"
      : "Pending Approval";

  const topDescription =
    approvalStatus === "approved"
      ? "Your merchant account has been approved. You can now log in using the details below."
      : approvalStatus === "rejected"
      ? "Your merchant account was not approved. Please contact auction staff for help."
      : "Your merchant account has been submitted. Please wait for auction staff to approve it before logging in.";

  const boxTitle =
    approvalStatus === "approved"
      ? "Approved"
      : approvalStatus === "rejected"
      ? "Registration Rejected"
      : "Waiting for approval";

  const boxDescription =
    approvalStatus === "approved"
      ? "You can now use the login details below to enter the merchant page."
      : approvalStatus === "rejected"
      ? "Your account is not approved yet. Please contact auction staff."
      : "After approval, use the login details below.";

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Registration Status
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
                Merchant Information
              </p>

              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Merchant</p>
                  <p className="font-bold text-gray-900">
                    {receipt.merchantName}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Shop</p>
                  <p className="font-bold text-gray-900">{receipt.shopName}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">
                Your Login Details
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Username / Phone Number
                  </p>
                  <p className="mt-1 rounded-xl bg-gray-100 p-3 font-mono text-lg font-bold text-gray-900">
                    {receipt.phone}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Login Code
                  </p>
                  <p className="mt-1 rounded-xl bg-gray-100 p-3 font-mono text-lg font-bold text-gray-900">
                    {receipt.merchantCode}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                Keep this information. You will use it to log in after approval.
              </p>
            </section>

            {statusMessage && <div className={statusCardClass}>{statusMessage}</div>}

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => checkApprovalStatus()}
                disabled={isChecking}
                className="rounded-2xl border px-4 py-3 font-semibold hover:bg-gray-100 disabled:bg-gray-100"
              >
                {isChecking ? "Checking..." : "Check Approval Status"}
              </button>

              {approvalStatus === "approved" && (
                <Link
                  href="/merchant-login"
                  className="rounded-2xl bg-black px-4 py-3 text-center font-semibold text-white"
                >
                  Go to Merchant Login
                </Link>
              )}

              <Link
                href="/"
                className="text-center text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                Back home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}