"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type MerchantAccount = {
  id: number;
  merchant_code: string;
  merchant_name: string;
  shop_name: string;
  phone: string;
  active: boolean;
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
      .eq("active", true)
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-gray-200">
        <div className="bg-black px-6 py-6 text-white">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Motorcycle Offer System
          </p>

          <h1 className="mt-2 text-2xl font-bold">Merchant Login</h1>

          <p className="mt-2 text-sm text-gray-300">
            Enter your assigned phone number and merchant code to submit offers.
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
              placeholder="Example: M001"
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

          <p className="mt-4 text-center text-xs text-gray-500">
            Ask the auction staff if you do not know your merchant code.
          </p>
        </div>
      </section>
    </main>
  );
}