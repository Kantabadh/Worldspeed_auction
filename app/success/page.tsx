"use client";

import { useEffect, useState } from "react";

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  price: string;
};

type FinalSubmission = {
  merchantName: string;
  shopName: string;
  phone: string;
  offers: Offer[];
  submittedAt: string;
  receiptNo: string;
};

export default function SuccessPage() {
  const [submission, setSubmission] = useState<FinalSubmission | null>(null);

  useEffect(() => {
    const savedSubmission = localStorage.getItem("latestSubmission");

    if (savedSubmission) {
      setSubmission(JSON.parse(savedSubmission));
    }
  }, []);

  if (!submission) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
            !
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            No Receipt Found
          </h1>

          <p className="mt-3 text-gray-600">
            No latest submission receipt was found on this device.
          </p>

          <a
            href="/merchant"
            className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
          >
            Back to Merchant Page
          </a>
        </section>
      </main>
    );
  }

  const total = submission.offers.reduce((sum, offer) => {
    return sum + Number(offer.price || 0);
  }, 0);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <section className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="bg-green-600 px-6 py-6 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold text-green-600">
              ✓
            </div>

            <h1 className="mt-4 text-2xl font-bold">Offer Submitted</h1>

            <p className="mt-2 text-sm text-green-50">
              Your offers have been saved successfully.
            </p>
          </div>

          <div className="p-6">
            <section className="rounded-2xl border bg-gray-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Receipt No.
                  </p>
                  <p className="mt-1 font-bold text-gray-900">
                    {submission.receiptNo}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Submitted At
                  </p>
                  <p className="mt-1 font-bold text-gray-900">
                    {submission.submittedAt}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Merchant
                  </p>
                  <p className="mt-1 font-bold text-gray-900">
                    {submission.merchantName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Shop</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {submission.shopName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {submission.phone}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Offer Value
                  </p>
                  <p className="mt-1 text-xl font-bold text-green-700">
                    {total.toLocaleString()} baht
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Submitted Offers
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    {submission.offers.length} offer(s) submitted.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {submission.offers.map((offer) => (
                  <div
                    key={offer.motorcycle_id}
                    className="rounded-2xl border bg-white p-4"
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

            <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
              <p className="font-semibold">Important</p>
              <p className="mt-1 text-sm">
                Please keep this page or take a screenshot as proof of your
                submitted offers.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/merchant"
                className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
              >
                Back to Merchant Page
              </a>

              <button
                onClick={() => window.print()}
                className="rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow"
              >
                Print / Save Receipt
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}