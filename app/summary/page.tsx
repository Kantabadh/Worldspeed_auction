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
};

export default function SummaryPage() {
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedDraft = localStorage.getItem("draftSubmission");

    if (savedDraft) {
      setDraft(JSON.parse(savedDraft));
    }
  }, []);

  async function confirmSubmit() {
    if (!draft) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const { data: merchantData, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        name: draft.merchantName,
        shop_name: draft.shopName,
        phone: draft.phone,
      })
      .select()
      .single();

    if (merchantError) {
      setErrorMessage(merchantError.message);
      setIsSubmitting(false);
      return;
    }

    const offersToInsert = draft.offers.map((offer) => ({
      merchant_id: merchantData.id,
      motorcycle_id: offer.motorcycle_id,
      offer_price: Number(offer.price),
    }));

    const { error: offersError } = await supabase
      .from("offers")
      .insert(offersToInsert);

    if (offersError) {
      setErrorMessage(offersError.message);
      setIsSubmitting(false);
      return;
    }

    const finalSubmission = {
      ...draft,
      submittedAt: new Date().toLocaleString(),
      receiptNo: "S-" + Date.now(),
    };

    localStorage.setItem("latestSubmission", JSON.stringify(finalSubmission));

    localStorage.removeItem("draftSubmission");
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");

    window.location.href = "/success";
  }

  if (!draft) {
    return (
      <main className="min-h-screen p-8">
        <BackButton />

        <h1 className="text-2xl font-bold">Summary Page</h1>

        <p className="mt-4">
          No offer data found. Please go back to the merchant page.
        </p>

        <a
          href="/merchant"
          className="mt-6 inline-block rounded bg-black px-4 py-2 text-white"
        >
          Back to Merchant Page
        </a>
      </main>
    );
  }

  const total = draft.offers.reduce((sum, offer) => {
    return sum + Number(offer.price || 0);
  }, 0);

  return (
    <main className="min-h-screen p-8">
      <BackButton />

      <h1 className="text-2xl font-bold">Review Your Offers</h1>

      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      <section className="mt-6 rounded border p-4">
        <p>
          <strong>Merchant:</strong> {draft.merchantName}
        </p>

        <p>
          <strong>Shop:</strong> {draft.shopName}
        </p>

        <p>
          <strong>Phone:</strong> {draft.phone}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Your Offers</h2>

        <table className="mt-3 w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Lot</th>
              <th className="border p-2">Motorcycle</th>
              <th className="border p-2">Offer Price</th>
            </tr>
          </thead>

          <tbody>
            {draft.offers.map((offer) => (
              <tr key={offer.motorcycle_id}>
                <td className="border p-2">{offer.lot}</td>
                <td className="border p-2">{offer.motorcycle}</td>
                <td className="border p-2">
                  {Number(offer.price).toLocaleString()} baht
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-lg font-bold">
          Total: {total.toLocaleString()} baht
        </p>
      </section>

      <div className="mt-6 flex gap-4">
        <a href="/merchant" className="rounded border px-4 py-2">
          Back to Edit
        </a>

        <button
          onClick={confirmSubmit}
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
        >
          {isSubmitting ? "Submitting..." : "Confirm Submit"}
        </button>
      </div>
    </main>
  );
}