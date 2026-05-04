"use client";

import { useState } from "react";
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

export default function MerchantLoginPage() {
  const [phone, setPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    const cleanPhone = phone.trim();
    const cleanCode = merchantCode.trim().toUpperCase();

    if (!cleanPhone || !cleanCode) {
      setErrorMessage("Please enter phone number and merchant code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("merchant_code", cleanCode)
      .limit(1);

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setErrorMessage("Invalid phone number or merchant code.");
      setIsLoading(false);
      return;
    }

    const merchant = data[0] as MerchantAccount;

    if (merchant.approval_status === "pending") {
      setErrorMessage(
        "Your registration is still pending approval. Please wait for auction staff."
      );
      setIsLoading(false);
      return;
    }

    if (merchant.approval_status === "rejected") {
      setErrorMessage(
        "Your registration was not approved. Please contact auction staff."
      );
      setIsLoading(false);
      return;
    }

    if (!merchant.active || merchant.approval_status !== "approved") {
      setErrorMessage("This merchant account is not active.");
      setIsLoading(false);
      return;
    }

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

    setIsLoading(false);
    window.location.href = "/merchant";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Merchant Access
            </p>

            <h1 className="mt-3 text-3xl font-bold">Merchant Login</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Enter your approved phone number and merchant code to submit or
              view your offers.
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
              <label className="text-sm font-medium text-gray-700">
                Phone Number
              </label>

              <input
                inputMode="tel"
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="Example: 0812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Merchant Code
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg uppercase outline-none focus:ring-2 focus:ring-black"
                placeholder="Example: SHOP001"
                value={merchantCode}
                onChange={(e) => setMerchantCode(e.target.value.toUpperCase())}
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

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/merchant-signup"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                Register merchant
              </Link>

              <Link
                href="/"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
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