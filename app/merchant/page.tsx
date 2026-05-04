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
  expiresAt?: number;
};

type ExistingSubmissionOffer = {
  id: number;
  offer_price: number;
  motorcycle_id: number;
};

const MERCHANT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export default function MerchantPage() {
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [merchantAccountId, setMerchantAccountId] = useState<number | null>(
    null
  );

  const [offers, setOffers] = useState<Offer[]>([]);
  const [starredLotIds, setStarredLotIds] = useState<number[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [auctionStatus, setAuctionStatus] = useState("open");

  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [canEditSubmission, setCanEditSubmission] = useState(false);
  const [submittedMerchantId, setSubmittedMerchantId] = useState<number | null>(
    null
  );

  const [galleryPhotos, setGalleryPhotos] = useState<MotorcyclePhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  function saveMerchantSession(session: MerchantSession) {
    localStorage.setItem(
      "merchantSession",
      JSON.stringify({
        ...session,
        expiresAt: Date.now() + MERCHANT_TIMEOUT_MS,
      })
    );
  }

  function logoutMerchant() {
    localStorage.removeItem("merchantSession");
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");
    localStorage.removeItem("draftSubmission");
    window.location.href = "/merchant-login";
  }

  function refreshMerchantActivity() {
    const savedSession = localStorage.getItem("merchantSession");

    if (!savedSession) return;

    const session = JSON.parse(savedSession) as MerchantSession;
    saveMerchantSession(session);
  }

  function toggleStarLot(motorcycleId: number) {
    const updatedStarredLotIds = starredLotIds.includes(motorcycleId)
      ? starredLotIds.filter((id) => id !== motorcycleId)
      : [...starredLotIds, motorcycleId];

    setStarredLotIds(updatedStarredLotIds);

    localStorage.setItem(
      "merchantStarredLotIds",
      JSON.stringify(updatedStarredLotIds)
    );
  }

  async function checkExistingSubmission(accountId: number) {
    const { data: accountData, error: accountError } = await supabase
      .from("merchant_accounts")
      .select("can_edit_submission")
      .eq("id", accountId)
      .limit(1);

    if (accountError) {
      setErrorMessage(accountError.message);
      return;
    }

    const canEdit = accountData?.[0]?.can_edit_submission || false;
    setCanEditSubmission(canEdit);

    const { data: merchantRows, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("merchant_account_id", accountId)
      .limit(1);

    if (merchantError) {
      setErrorMessage(merchantError.message);
      return;
    }

    if (!merchantRows || merchantRows.length === 0) {
      setHasSubmitted(false);
      setSubmittedMerchantId(null);
      return;
    }

    const merchantRowId = merchantRows[0].id;

    setHasSubmitted(true);
    setSubmittedMerchantId(merchantRowId);

    const { data: existingOffers, error: offersError } = await supabase
      .from("offers")
      .select("id, offer_price, motorcycle_id")
      .eq("merchant_id", merchantRowId);

    if (offersError) {
      setErrorMessage(offersError.message);
      return;
    }

    const submittedPrices: Record<number, string> = {};

    (existingOffers as ExistingSubmissionOffer[] | null)?.forEach((offer) => {
      submittedPrices[offer.motorcycle_id] = String(offer.offer_price);
    });

    localStorage.setItem("merchantOfferPrices", JSON.stringify(submittedPrices));

    setOffers((currentOffers) =>
      currentOffers.map((offer) => ({
        ...offer,
        price: submittedPrices[offer.motorcycle_id] || offer.price || "",
      }))
    );
  }

  useEffect(() => {
    const savedSession = localStorage.getItem("merchantSession");

    if (!savedSession) {
      window.location.href = "/merchant-login";
      return;
    }

    const session = JSON.parse(savedSession) as MerchantSession;

    if (session.expiresAt && Date.now() > session.expiresAt) {
      logoutMerchant();
      return;
    }

    const savedStarredLots = localStorage.getItem("merchantStarredLotIds");

    if (savedStarredLots) {
      setStarredLotIds(JSON.parse(savedStarredLots));
    }

    setMerchantName(session.merchantName || "");
    setShopName(session.shopName || "");
    setPhone(session.phone || "");
    setMerchantAccountId(session.merchantAccountId);
    setIsMerchantLoggedIn(true);

    saveMerchantSession(session);
    checkExistingSubmission(session.merchantAccountId);
  }, []);

  useEffect(() => {
    if (!isMerchantLoggedIn) return;

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, refreshMerchantActivity);
    });

    const interval = setInterval(() => {
      const savedSession = localStorage.getItem("merchantSession");

      if (!savedSession) {
        window.location.href = "/merchant-login";
        return;
      }

      const session = JSON.parse(savedSession) as MerchantSession;

      if (session.expiresAt && Date.now() > session.expiresAt) {
        logoutMerchant();
      }
    }, 5000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refreshMerchantActivity);
      });

      clearInterval(interval);
    };
  }, [isMerchantLoggedIn]);

  useEffect(() => {
    async function loadAuctionStatus() {
      const { data, error } = await supabase
        .from("auction_settings")
        .select("status")
        .order("id", { ascending: true })
        .limit(1);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage("No auction setting found.");
        return;
      }

      setAuctionStatus(data[0].status);
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

  useEffect(() => {
    if (merchantAccountId) {
      checkExistingSubmission(merchantAccountId);
    }
  }, [offers.length, merchantAccountId]);

  function updatePrice(index: number, value: string) {
    const cleanValue = value.replace(/[^\d]/g, "");

    const newOffers = [...offers];
    newOffers[index].price = cleanValue;
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

  function handleSubmit() {
    if (hasSubmitted && !canEditSubmission) {
      alert("You have already submitted offers for this auction.");
      return;
    }

    if (auctionStatus === "closed") {
      alert("Auction is closed. You cannot submit offers anymore.");
      return;
    }

    const submittedOffers = offers.filter((offer) => offer.price !== "");

    if (!merchantName || !shopName || !phone || !merchantAccountId) {
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
      isEditingSubmission: hasSubmitted && canEditSubmission,
      submittedMerchantId,
      merchantAccountId,
    };

    localStorage.setItem("draftSubmission", JSON.stringify(data));
    window.location.href = "/summary";
  }

  const enteredOfferCount = offers.filter((offer) => offer.price !== "").length;
  const isLockedAfterSubmission = hasSubmitted && !canEditSubmission;
  const canTypeOffer = auctionStatus === "open" && !isLockedAfterSubmission;

  const sortedOffers = [...offers].sort((a, b) => {
    const aStarred = starredLotIds.includes(a.motorcycle_id);
    const bStarred = starredLotIds.includes(b.motorcycle_id);

    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;

    return a.lot.localeCompare(b.lot);
  });

  if (!isMerchantLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Opening merchant page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              Motorcycle Offer System
            </h1>

            <p className="mt-0.5 truncate text-xs text-gray-600 sm:text-sm">
              {merchantName} • {shopName}
            </p>
          </div>

          <button
            onClick={logoutMerchant}
            className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100 sm:px-4 sm:text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-5">
        {auctionStatus === "open" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-green-800 sm:p-4">
            <p className="font-semibold">Auction is OPEN</p>
            <p className="text-sm">You can enter and submit offers.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-800 sm:p-4">
            <p className="font-semibold">Auction is CLOSED</p>
            <p className="text-sm">Offer submission is currently blocked.</p>
          </div>
        )}

        {hasSubmitted && !canEditSubmission && (
          <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 sm:p-4">
            <p className="font-semibold">Already Submitted</p>
            <p className="text-sm">
              Your submitted offer prices are shown below. Editing is currently
              locked.
            </p>
          </div>
        )}

        {hasSubmitted && canEditSubmission && (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-800 sm:p-4">
            <p className="font-semibold">Editing Allowed</p>
            <p className="text-sm">
              Auction staff has allowed you to edit your submitted offers.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 sm:p-4">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Merchant Info
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {merchantName} • {phone}
              </p>
            </div>

            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {shopName}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Motorcycle Lots
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {hasSubmitted
                  ? "Your submitted prices are shown below."
                  : "Enter offer prices for lots you want."}
              </p>
            </div>

            <div className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-sm font-medium text-white">
              {enteredOfferCount}/{offers.length}
            </div>
          </div>

          {starredLotIds.length > 0 && (
            <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
              <p className="text-sm font-semibold">Starred lots are shown first.</p>
            </div>
          )}

          {offers.length === 0 && !errorMessage && (
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-gray-600">Loading motorcycles...</p>
            </div>
          )}

          <div className="mt-4 space-y-4">
            {sortedOffers.map((offer) => {
              const originalIndex = offers.findIndex(
                (item) => item.motorcycle_id === offer.motorcycle_id
              );

              const isStarred = starredLotIds.includes(offer.motorcycle_id);
              const firstPhoto = offer.photos[0];

              return (
                <article
                  key={offer.motorcycle_id}
                  className={
                    isStarred
                      ? "overflow-hidden rounded-3xl border border-yellow-300 bg-yellow-50 shadow-sm"
                      : "overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200"
                  }
                >
                  {firstPhoto ? (
                    <button
                      type="button"
                      onClick={() => openGallery(offer.photos, 0)}
                      className="relative block w-full overflow-hidden bg-gray-100"
                    >
                      <img
                        src={firstPhoto.image_url}
                        alt={`${offer.motorcycle} photo`}
                        className="h-48 w-full object-cover sm:h-64"
                      />

                      {offer.photos.length > 1 && (
                        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                          {offer.photos.length} photos
                        </span>
                      )}

                      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                        Tap to view
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-gray-100 text-sm text-gray-500">
                      No photo
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          {isStarred ? "⭐ " : ""}
                          Lot {offer.lot}
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {offer.motorcycle}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleStarLot(offer.motorcycle_id)}
                        className={
                          isStarred
                            ? "shrink-0 rounded-full bg-yellow-200 px-3 py-2 text-sm font-semibold text-yellow-800"
                            : "shrink-0 rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-yellow-50"
                        }
                      >
                        {isStarred ? "⭐" : "☆"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {offer.price && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          {hasSubmitted
                            ? "Submitted price"
                            : "Offer entered"}
                        </span>
                      )}

                      {isStarred && (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                          Starred
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700">
                        Offer Price
                      </label>

                      <div className="mt-2 flex items-center overflow-hidden rounded-2xl border bg-white focus-within:ring-2 focus-within:ring-black">
                        <input
                          inputMode="numeric"
                          disabled={!canTypeOffer}
                          className="w-full p-4 text-xl font-semibold outline-none disabled:bg-gray-100 disabled:text-gray-700"
                          placeholder="Enter price"
                          value={
                            offer.price
                              ? Number(offer.price).toLocaleString()
                              : ""
                          }
                          onChange={(e) =>
                            updatePrice(originalIndex, e.target.value)
                          }
                        />

                        <span className="border-l bg-gray-50 px-4 py-4 text-sm font-medium text-gray-600">
                          baht
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white p-3 shadow-lg sm:p-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {enteredOfferCount} offer(s) entered
            </p>

            {isLockedAfterSubmission ? (
              <p className="text-xs text-yellow-700">
                Already submitted. Editing locked.
              </p>
            ) : hasSubmitted && canEditSubmission ? (
              <p className="text-xs text-orange-700">
                Editing allowed. Submit again to update.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Review before final submission.
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={auctionStatus === "closed" || isLockedAfterSubmission}
            className="shrink-0 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow disabled:bg-gray-400 sm:px-6 sm:text-base"
          >
            {isLockedAfterSubmission
              ? "Submitted"
              : hasSubmitted && canEditSubmission
              ? "Review Update"
              : "Review"}
          </button>
        </div>
      </div>

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