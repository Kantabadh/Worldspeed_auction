"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function MerchantSignupPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [merchantCode, setMerchantCode] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSignup() {
    const cleanMerchantName = merchantName.trim();
    const cleanShopName = shopName.trim();
    const cleanPhone = phone.trim();
    const cleanCode = merchantCode.trim().toUpperCase();

    if (!cleanMerchantName || !cleanShopName || !cleanPhone || !cleanCode) {
      setErrorMessage("Please fill all fields.");
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage("Merchant code should be at least 4 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data: existingAccounts, error: existingError } = await supabase
      .from("merchant_accounts")
      .select("id, merchant_code, phone")
      .or(`phone.eq.${cleanPhone},merchant_code.eq.${cleanCode}`)
      .limit(1);

    if (existingError) {
      setErrorMessage(existingError.message);
      setIsSubmitting(false);
      return;
    }

    if (existingAccounts && existingAccounts.length > 0) {
      setErrorMessage(
        "This phone number or merchant code is already registered. Please contact auction staff."
      );
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("merchant_accounts").insert({
      merchant_code: cleanCode,
      merchant_name: cleanMerchantName,
      shop_name: cleanShopName,
      phone: cleanPhone,
      active: false,
      approval_status: "pending",
      can_edit_submission: false,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(
      "Registration submitted. Please wait for auction staff to approve your account."
    );

    setMerchantName("");
    setShopName("");
    setPhone("");
    setMerchantCode("");
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="bg-black px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Merchant Registration
            </p>

            <h1 className="mt-3 text-3xl font-bold">Create Merchant Account</h1>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Register your merchant details. Your account must be approved by
              auction staff before you can submit offers.
            </p>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="font-semibold">Registration failed</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                <p className="font-semibold">Registration submitted</p>
                <p className="text-sm">{successMessage}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                Merchant Name
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="Example: Somchai"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Shop Name
              </label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
                placeholder="Example: ABC Motor"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>

            <div className="mt-4">
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
              />

              <p className="mt-2 text-xs text-gray-500">
                This code will be used like your password when logging in.
              </p>
            </div>

            <button
              onClick={handleSignup}
              disabled={isSubmitting}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isSubmitting ? "Submitting..." : "Submit Registration"}
            </button>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Link
                href="/merchant-login"
                className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-black"
              >
                Already approved? Login
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