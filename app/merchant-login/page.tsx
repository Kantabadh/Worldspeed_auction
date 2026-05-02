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
    if (!phone || !merchantCode) {
      alert("Please enter phone number and merchant code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("*")
      .eq("phone", phone)
      .eq("merchant_code", merchantCode)
      .eq("active", true)
      .single();

    if (error || !data) {
      setErrorMessage("Invalid phone number or merchant code.");
      setIsLoading(false);
      return;
    }

    const merchant = data as MerchantAccount;

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

    setIsLoading(false);
    window.location.href = "/merchant";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Merchant Login</h1>

        <p className="mt-2 text-gray-600">
          Enter your phone number and merchant code to submit offers.
        </p>

        {errorMessage && (
          <p className="mt-4 rounded border border-red-500 bg-red-50 p-3 text-red-600">
            {errorMessage}
          </p>
        )}

        <input
          className="mt-6 w-full rounded border p-3"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className="mt-3 w-full rounded border p-3"
          placeholder="Merchant code, example: M001"
          value={merchantCode}
          onChange={(e) => setMerchantCode(e.target.value)}
        />

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="mt-5 w-full rounded bg-black px-4 py-3 text-white disabled:bg-gray-400"
        >
          {isLoading ? "Checking..." : "Login"}
        </button>
      </section>
    </main>
  );
}