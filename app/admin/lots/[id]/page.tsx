"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  active: boolean;
  motorcycle_photos: MotorcyclePhoto[];
};

type LotOffer = {
  id: number;
  offer_price: number;
  submitted_at: string;
  merchants: {
    name: string;
    shop_name: string;
    phone: string;
  } | null;
};

export default function LotResultPage() {
  const params = useParams();
  const lotId = Number(params.id);

  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [offers, setOffers] = useState<LotOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadLotResult() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: motorcycleData, error: motorcycleError } = await supabase
      .from("motorcycles")
      .select(`
        id,
        lot_number,
        motorcycle_name,
        active,
        motorcycle_photos (
          id,
          image_url
        )
      `)
      .eq("id", lotId)
      .limit(1);

    if (motorcycleError) {
      setErrorMessage(motorcycleError.message);
      setIsLoading(false);
      return;
    }

    if (!motorcycleData || motorcycleData.length === 0) {
      setErrorMessage("Motorcycle lot not found.");
      setIsLoading(false);
      return;
    }

    setMotorcycle(motorcycleData[0] as Motorcycle);

    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .select(`
        id,
        offer_price,
        submitted_at,
        merchants (
          name,
          shop_name,
          phone
        )
      `)
      .eq("motorcycle_id", lotId)
      .order("offer_price", { ascending: false });

    if (offerError) {
      setErrorMessage(offerError.message);
      setIsLoading(false);
      return;
    }

    setOffers((offerData as unknown as LotOffer[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!Number.isNaN(lotId)) {
      loadLotResult();
    }
  }, [lotId]);

  const highestOffer = offers[0];

  function exportLotOffersCsv() {
  if (!motorcycle) return;

  const headers = [
    "Rank",
    "Lot",
    "Motorcycle",
    "Offer Price",
    "Merchant",
    "Shop",
    "Phone",
    "Submitted At",
  ];

  const rows = offers.map((offer, index) => [
    index + 1,
    motorcycle.lot_number,
    motorcycle.motorcycle_name,
    offer.offer_price,
    offer.merchants?.name || "",
    offer.merchants?.shop_name || "",
    offer.merchants?.phone || "",
    new Date(offer.submitted_at).toLocaleString(),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `lot-${motorcycle.lot_number}-offers.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-5xl px-4 py-6">
          <BackButton />

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {isLoading && (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <p className="text-gray-600">Loading lot result...</p>
            </div>
          )}

          {!isLoading && motorcycle && (
            <>
              <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                      Lot Result
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-gray-900">
                      Lot {motorcycle.lot_number}
                    </h1>

                    <p className="mt-1 text-lg text-gray-700">
                      {motorcycle.motorcycle_name}
                    </p>
                  </div>

                  {motorcycle.active ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                      Hidden
                    </span>
                  )}
                </div>

                {motorcycle.motorcycle_photos?.length > 0 && (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {motorcycle.motorcycle_photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.image_url}
                        alt={motorcycle.motorcycle_name}
                        className="h-32 w-full rounded-2xl object-cover"
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">
                    Total Offers
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {offers.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">
                    Highest Offer
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-700">
                    {highestOffer
                      ? `${Number(highestOffer.offer_price).toLocaleString()}`
                      : "No offer"}
                  </p>
                  {highestOffer && <p className="text-sm text-gray-500">baht</p>}
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <p className="text-sm font-medium text-gray-500">
                    Current Winner
                  </p>
                  <p className="mt-2 font-bold text-gray-900">
                    {highestOffer?.merchants?.shop_name || "No winner yet"}
                  </p>
                  {highestOffer?.merchants?.phone && (
                    <p className="text-sm text-gray-500">
                      {highestOffer.merchants.phone}
                    </p>
                  )}
                </div>
              </section>

              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Offers for Lot {motorcycle.lot_number}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      Ordered from highest offer to lowest offer.
                    </p>
                  </div>

           <div className="flex flex-wrap gap-3">
  <button
    onClick={loadLotResult}
    className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
  >
    Refresh
  </button>

  {offers.length > 0 && (
    <button
      onClick={exportLotOffersCsv}
      className="rounded-xl bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
    >
      Export Lot Offers CSV
    </button>
  )}
</div>
                </div>

                {offers.length === 0 ? (
                  <div className="mt-5 rounded-2xl bg-gray-50 p-5">
                    <p className="text-gray-600">
                      No offers submitted for this lot yet.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b bg-gray-100 text-gray-700">
                          <th className="p-3">Rank</th>
                          <th className="p-3">Offer Price</th>
                          <th className="p-3">Merchant</th>
                          <th className="p-3">Shop</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Submitted At</th>
                        </tr>
                      </thead>

                      <tbody>
                        {offers.map((offer, index) => (
                          <tr
                            key={offer.id}
                            className={
                              index === 0 ? "border-b bg-green-50" : "border-b"
                            }
                          >
                            <td className="p-3 font-bold">
                              {index === 0 ? "1 🏆" : index + 1}
                            </td>

                            <td className="p-3 font-bold text-green-700">
                              {Number(offer.offer_price).toLocaleString()} baht
                            </td>

                            <td className="p-3">
                              {offer.merchants?.name || "-"}
                            </td>

                            <td className="p-3">
                              {offer.merchants?.shop_name || "-"}
                            </td>

                            <td className="p-3">
                              {offer.merchants?.phone || "-"}
                            </td>

                            <td className="p-3">
                              {new Date(offer.submitted_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </main>
    </StaffGuard>
  );
}