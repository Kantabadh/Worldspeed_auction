"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  photos?: {
    id: number;
    image_url: string;
  }[];
  price: string;
};

type DraftSubmission = {
  merchantName: string;
  shopName: string;
  phone: string;
  offers: Offer[];
  isEditingSubmission?: boolean;
  submittedMerchantId?: number | null;
  merchantAccountId?: number | null;
};

type MerchantSession = {
  merchantAccountId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
  expiresAt?: number;
};

export default function SummaryPage() {
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [merchantSession, setMerchantSession] =
    useState<MerchantSession | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedDraft = localStorage.getItem("draftSubmission");
    const savedSession = localStorage.getItem("merchantSession");

    if (savedDraft) {
      setDraft(JSON.parse(savedDraft));
    }

    if (savedSession) {
      setMerchantSession(JSON.parse(savedSession));
    }
  }, []);

  async function confirmSubmit() {
    if (!draft) return;

    const accountId =
      draft.merchantAccountId || merchantSession?.merchantAccountId;

    if (!accountId) {
      setErrorMessage("Merchant login session not found. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const offersToInsert = draft.offers.map((offer) => ({
      motorcycle_id: offer.motorcycle_id,
      offer_price: Number(offer.price),
    }));

    if (draft.isEditingSubmission && draft.submittedMerchantId) {
      const { data: merchantRows, error: merchantCheckError } = await supabase
        .from("merchants")
        .select("id, merchant_account_id")
        .eq("id", draft.submittedMerchantId)
        .eq("merchant_account_id", accountId)
        .limit(1);

      if (merchantCheckError) {
        setErrorMessage(merchantCheckError.message);
        setIsSubmitting(false);
        return;
      }

      if (!merchantRows || merchantRows.length === 0) {
        setErrorMessage(
          "Could not verify your existing submission. Please log in again."
        );
        setIsSubmitting(false);
        return;
      }

      const { error: deleteOldOffersError } = await supabase
        .from("offers")
        .delete()
        .eq("merchant_id", draft.submittedMerchantId);

      if (deleteOldOffersError) {
        setErrorMessage(deleteOldOffersError.message);
        setIsSubmitting(false);
        return;
      }

      const updatedOffersToInsert = offersToInsert.map((offer) => ({
        ...offer,
        merchant_id: draft.submittedMerchantId,
      }));

      const { error: insertUpdatedOffersError } = await supabase
        .from("offers")
        .insert(updatedOffersToInsert);

      if (insertUpdatedOffersError) {
        setErrorMessage(insertUpdatedOffersError.message);
        setIsSubmitting(false);
        return;
      }

      const { error: lockEditError } = await supabase
        .from("merchant_accounts")
        .update({
          can_edit_submission: false,
        })
        .eq("id", accountId);

      if (lockEditError) {
        setErrorMessage(lockEditError.message);
        setIsSubmitting(false);
        return;
      }

      const finalSubmission = {
        ...draft,
        submittedAt: new Date().toLocaleString(),
        receiptNo: "S-" + Date.now(),
        isUpdatedSubmission: true,
      };

      localStorage.setItem(
        "latestSubmission",
        JSON.stringify(finalSubmission)
      );

      localStorage.removeItem("draftSubmission");
      localStorage.removeItem("merchantPageDraft");
      localStorage.removeItem("merchantOfferPrices");

      window.location.href = "/success";
      return;
    }

    const { data: existingMerchant, error: existingMerchantError } =
      await supabase
        .from("merchants")
        .select("id")
        .eq("merchant_account_id", accountId)
        .limit(1);

    if (existingMerchantError) {
      setErrorMessage(existingMerchantError.message);
      setIsSubmitting(false);
      return;
    }

    if (existingMerchant && existingMerchant.length > 0) {
      setErrorMessage(
        "This merchant account has already submitted offers for this auction. Please contact auction staff if you need changes."
      );
      setIsSubmitting(false);
      return;
    }

    const { data: merchantData, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        name: draft.merchantName,
        shop_name: draft.shopName,
        phone: draft.phone,
        merchant_account_id: accountId,
      })
      .select()
      .limit(1);

    if (merchantError) {
      setErrorMessage(merchantError.message);
      setIsSubmitting(false);
      return;
    }

    if (!merchantData || merchantData.length === 0) {
      setErrorMessage("Could not create merchant submission record.");
      setIsSubmitting(false);
      return;
    }

    const newMerchantId = merchantData[0].id;

    const newOffersToInsert = offersToInsert.map((offer) => ({
      ...offer,
      merchant_id: newMerchantId,
    }));

    const { error: offersError } = await supabase
      .from("offers")
      .insert(newOffersToInsert);

    if (offersError) {
      setErrorMessage(offersError.message);
      setIsSubmitting(false);
      return;
    }

    const finalSubmission = {
      ...draft,
      submittedAt: new Date().toLocaleString(),
      receiptNo: "S-" + Date.now(),
      isUpdatedSubmission: false,
    };

    localStorage.setItem("latestSubmission", JSON.stringify(finalSubmission));

    localStorage.removeItem("draftSubmission");
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");

    window.location.href = "/success";
  }

  if (!draft) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6">
        <section className="mx-auto max-w-3xl">
          <BackButton />

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">No Offer Found</h1>

            <p className="mt-3 text-gray-600">
              No offer data was found. Please return to the merchant page and
              enter your offers again.
            </p>

            <a
              href="/merchant"
              className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              Back to Merchant Page
            </a>
          </div>
        </section>
      </main>
    );
  }

  const total = draft.offers.reduce((sum, offer) => {
    return sum + Number(offer.price || 0);
  }, 0);

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <section className="mx-auto max-w-4xl px-4 py-6">
        <BackButton />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Final Review
          </p>

          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {draft.isEditingSubmission
              ? "Review Updated Offers"
              : "Review Your Offers"}
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {draft.isEditingSubmission
              ? "Please check your updated offers carefully. After submitting, editing will be locked again."
              : "Please check carefully before final submission. After submitting, your offers will be saved to the auction system."}
          </p>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Submission Blocked</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {draft.isEditingSubmission && (
          <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
            <p className="font-semibold">Editing Existing Submission</p>
            <p className="text-sm">
              This will replace your previous submitted offers. After
              confirmation, editing will be locked again.
            </p>
          </div>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Merchant</p>
            <p className="mt-2 font-bold text-gray-900">
              {draft.merchantName}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Shop</p>
            <p className="mt-2 font-bold text-gray-900">{draft.shopName}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Phone</p>
            <p className="mt-2 font-bold text-gray-900">{draft.phone}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {draft.isEditingSubmission ? "Updated Offers" : "Your Offers"}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                {draft.offers.length} offer(s) ready to submit.
              </p>
            </div>

            <div className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Total {total.toLocaleString()} baht
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {draft.offers.map((offer) => (
              <div
                key={offer.motorcycle_id}
                className="rounded-2xl border bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Lot {offer.lot}
                    </p>

                    <h3 className="mt-1 font-bold text-gray-900">
                      {offer.motorcycle}
                    </h3>
                  </div>

                  <p className="text-lg font-bold text-green-700">
                    {Number(offer.price).toLocaleString()} baht
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <a
            href="/merchant"
            className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
          >
            Back to Edit
          </a>

          <button
            onClick={confirmSubmit}
            disabled={isSubmitting}
            className="rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
          >
            {isSubmitting
              ? "Submitting..."
              : draft.isEditingSubmission
              ? "Confirm Updated Offers"
              : "Confirm Submit"}
          </button>
        </div>
      </div>
    </main>
  );
}