"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  image_url: string | null;
};

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  image_url: string | null;
  price: string;
};

export default function MerchantPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [auctionStatus, setAuctionStatus] = useState("open");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
const [selectedImageName, setSelectedImageName] = useState("");

  // Load saved merchant information when the page opens.
  useEffect(() => {
    const savedDraft = localStorage.getItem("merchantPageDraft");

    if (savedDraft) {
      const draft = JSON.parse(savedDraft);

      setMerchantName(draft.merchantName || "");
      setShopName(draft.shopName || "");
      setPhone(draft.phone || "");
    }
  }, []);

  // Save merchant information whenever the user types.
  useEffect(() => {
    const draft = {
      merchantName,
      shopName,
      phone,
    };

    localStorage.setItem("merchantPageDraft", JSON.stringify(draft));
  }, [merchantName, shopName, phone]);

  // Load auction status and motorcycles from Supabase when page opens.
  useEffect(() => {
    async function loadAuctionStatus() {
      const { data, error } = await supabase
        .from("auction_settings")
        .select("status")
        .limit(1)
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setAuctionStatus(data.status);
    }

    async function loadMotorcycles() {
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*")
        .eq("active", true)
        .order("lot_number");

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const motorcycleOffers =
  data?.map((bike: Motorcycle) => ({
    motorcycle_id: bike.id,
    lot: bike.lot_number,
    motorcycle: bike.motorcycle_name,
    image_url: bike.image_url,
    price: "",
  })) || [];

      // Load saved offer prices from browser storage.
      const savedPricesText = localStorage.getItem("merchantOfferPrices");
      const savedPrices = savedPricesText ? JSON.parse(savedPricesText) : {};

      // Put saved prices back into the correct motorcycle lots.
      const motorcycleOffersWithSavedPrices = motorcycleOffers.map((offer) => ({
        ...offer,
        price: savedPrices[offer.motorcycle_id] || "",
      }));

      setOffers(motorcycleOffersWithSavedPrices);
    }

    loadAuctionStatus();
    loadMotorcycles();
  }, []);

  function updatePrice(index: number, value: string) {
    const newOffers = [...offers];
    newOffers[index].price = value;
    setOffers(newOffers);

    // Save prices by motorcycle id.
    const pricesToSave: Record<number, string> = {};

    newOffers.forEach((offer) => {
      pricesToSave[offer.motorcycle_id] = offer.price;
    });

    localStorage.setItem("merchantOfferPrices", JSON.stringify(pricesToSave));
  }

  function handleSubmit() {
    if (auctionStatus === "closed") {
      alert("Auction is closed. You cannot submit offers anymore.");
      return;
    }

    const submittedOffers = offers.filter((offer) => offer.price !== "");

    if (!merchantName || !shopName || !phone) {
      alert("Please fill merchant name, shop name, and phone number.");
      return;
    }

    if (submittedOffers.length === 0) {
      alert("Please enter at least one offer price.");
      return;
    }

    const data = {
      merchantName,
      shopName,
      phone,
      offers: submittedOffers,
    };

    localStorage.setItem("draftSubmission", JSON.stringify(data));
    window.location.href = "/summary";
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Merchant Offer Page</h1>

      {auctionStatus === "open" ? (
        <p className="mt-4 rounded border border-green-500 p-3 text-green-700">
          Auction is OPEN. You can submit offers.
        </p>
      ) : (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-700">
          Auction is CLOSED. You cannot submit offers anymore.
        </p>
      )}

      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      <section className="mt-6 max-w-md space-y-3">
        <input
          className="w-full rounded border p-2"
          placeholder="Merchant name"
          value={merchantName}
          onChange={(e) => setMerchantName(e.target.value)}
        />

        <input
          className="w-full rounded border p-2"
          placeholder="Shop name"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
        />

        <input
          className="w-full rounded border p-2"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Motorcycle Lots</h2>

        {offers.length === 0 && !errorMessage && (
          <p className="mt-4">Loading motorcycles...</p>
        )}

        {offers.map((offer, index) => (
  <div key={offer.motorcycle_id} className="rounded border p-4">
{offer.image_url && (
  <button
    type="button"
    onClick={() => {
      setSelectedImage(offer.image_url);
      setSelectedImageName(`Lot ${offer.lot} - ${offer.motorcycle}`);
    }}
    className="mb-3 block w-full max-w-md text-left"
  >
    <img
      src={offer.image_url}
      alt={offer.motorcycle}
      className="h-48 w-full rounded object-cover transition hover:opacity-80"
    />

    <p className="mt-1 text-sm text-gray-500">
      Click photo to enlarge
    </p>
  </button>
)}

  <p className="font-bold">Lot {offer.lot}</p>
  <p>{offer.motorcycle}</p>

            <input
              className="mt-3 w-full rounded border p-2"
              placeholder="Enter offer price"
              value={offer.price}
              onChange={(e) => updatePrice(index, e.target.value)}
            />
          </div>
        ))}
      </section>

      <button
        onClick={handleSubmit}
        disabled={auctionStatus === "closed"}
        className="mt-6 rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
      >
        Review My Offers
      </button>
      {selectedImage && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{selectedImageName}</h2>

        <button
          type="button"
          onClick={() => {
            setSelectedImage(null);
            setSelectedImageName("");
          }}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Close
        </button>
      </div>

      <img
        src={selectedImage}
        alt={selectedImageName}
        className="mx-auto max-h-[75vh] w-auto max-w-full rounded object-contain"
      />

      <div className="mt-3 flex gap-3">
        <a
          href={selectedImage}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-4 py-2"
        >
          Open Full Size
        </a>

        <p className="py-2 text-sm text-gray-600">
          Tip: open full size, then use browser zoom or pinch zoom on phone.
        </p>
      </div>
    </div>
  </div>
)}
    </main>
  );
}