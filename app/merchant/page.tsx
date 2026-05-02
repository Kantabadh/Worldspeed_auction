"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  motorcycle_photos: MotorcyclePhoto[];
};

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  photos: MotorcyclePhoto[];
  price: string;
};

type MerchantSession = {
  merchantAccountId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
};

export default function MerchantPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");

  const [offers, setOffers] = useState<Offer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [auctionStatus, setAuctionStatus] = useState("open");

  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState(false);

  const [galleryPhotos, setGalleryPhotos] = useState<MotorcyclePhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Check merchant login when page opens.
  useEffect(() => {
    const savedSession = localStorage.getItem("merchantSession");

    if (!savedSession) {
      window.location.href = "/merchant-login";
      return;
    }

    const session = JSON.parse(savedSession) as MerchantSession;

    setMerchantName(session.merchantName || "");
    setShopName(session.shopName || "");
    setPhone(session.phone || "");
    setIsMerchantLoggedIn(true);
  }, []);

  // Load saved offer prices when motorcycles are loaded later.
  // This saves only prices, not merchant info, because merchant info now comes from login.
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
        .select(`
          id,
          lot_number,
          motorcycle_name,
          motorcycle_photos (
            id,
            image_url
          )
        `)
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
          photos: bike.motorcycle_photos || [],
          price: "",
        })) || [];

      const savedPricesText = localStorage.getItem("merchantOfferPrices");
      const savedPrices = savedPricesText ? JSON.parse(savedPricesText) : {};

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

    const pricesToSave: Record<number, string> = {};

    newOffers.forEach((offer) => {
      pricesToSave[offer.motorcycle_id] = offer.price;
    });

    localStorage.setItem("merchantOfferPrices", JSON.stringify(pricesToSave));
  }

  function openGallery(photos: MotorcyclePhoto[], startIndex: number) {
    setGalleryPhotos(photos);
    setGalleryIndex(startIndex);
  }

  function closeGallery() {
    setGalleryPhotos([]);
    setGalleryIndex(0);
  }

  function showPreviousPhoto() {
    setGalleryIndex((currentIndex) =>
      currentIndex === 0 ? galleryPhotos.length - 1 : currentIndex - 1
    );
  }

  function showNextPhoto() {
    setGalleryIndex((currentIndex) =>
      currentIndex === galleryPhotos.length - 1 ? 0 : currentIndex + 1
    );
  }

  function logoutMerchant() {
    localStorage.removeItem("merchantSession");
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");
    localStorage.removeItem("draftSubmission");
    window.location.href = "/merchant-login";
  }

  function handleSubmit() {
    if (auctionStatus === "closed") {
      alert("Auction is closed. You cannot submit offers anymore.");
      return;
    }

    const submittedOffers = offers.filter((offer) => offer.price !== "");

    if (!merchantName || !shopName || !phone) {
      alert("Merchant information is missing. Please log in again.");
      window.location.href = "/merchant-login";
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

  if (!isMerchantLoggedIn) {
    return (
      <main className="min-h-screen p-8">
        <p>Checking merchant login...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Merchant Offer Page</h1>
          <p className="mt-1 text-sm text-gray-600">
            Logged in as {merchantName} / {shopName}
          </p>
        </div>

        <button onClick={logoutMerchant} className="rounded border px-4 py-2">
          Logout
        </button>
      </div>

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
          className="w-full rounded border bg-gray-100 p-2"
          placeholder="Merchant name"
          value={merchantName}
          readOnly
        />

        <input
          className="w-full rounded border bg-gray-100 p-2"
          placeholder="Shop name"
          value={shopName}
          readOnly
        />

        <input
          className="w-full rounded border bg-gray-100 p-2"
          placeholder="Phone number"
          value={phone}
          readOnly
        />
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Motorcycle Lots</h2>

        {offers.length === 0 && !errorMessage && (
          <p className="mt-4">Loading motorcycles...</p>
        )}

        {offers.map((offer, index) => (
          <div key={offer.motorcycle_id} className="rounded border p-4">
            {offer.photos.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {offer.photos.map((photo, photoIndex) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => openGallery(offer.photos, photoIndex)}
                    className="block overflow-hidden rounded border"
                  >
                    <img
                      src={photo.image_url}
                      alt={`${offer.motorcycle} photo ${photoIndex + 1}`}
                      className="h-32 w-full object-cover transition hover:opacity-80"
                    />
                  </button>
                ))}
              </div>
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

      {galleryPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            type="button"
            onClick={closeGallery}
            className="fixed right-4 top-4 z-50 rounded-full bg-black/60 px-4 py-2 text-2xl text-white"
          >
            ×
          </button>

          {galleryPhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="fixed left-3 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-3xl text-white"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={showNextPhoto}
                className="fixed right-3 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-3xl text-white"
              >
                ›
              </button>
            </>
          )}

          <div className="flex h-screen w-screen items-center justify-center overflow-auto p-2">
            <img
              src={galleryPhotos[galleryIndex].image_url}
              alt="Motorcycle photo"
              className="max-h-none max-w-none object-contain"
              style={{
                width: "100%",
                height: "auto",
                touchAction: "pinch-zoom",
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}