"use client";

// useEffect runs code when the page loads.
// useState stores changing data on the page.
import { useEffect, useState } from "react";

// Import Supabase connection.
import { supabase } from "@/lib/supabase";

// This is the shape of one motorcycle from Supabase.
type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
};

// This is the shape of one offer input.
type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  price: string;
};

export default function MerchantPage() {
  // Store merchant name input.
  const [merchantName, setMerchantName] = useState("");

  // Store shop name input.
  const [shopName, setShopName] = useState("");

  // Store phone number input.
  const [phone, setPhone] = useState("");

  // Store motorcycle offers.
  const [offers, setOffers] = useState<Offer[]>([]);

  // Store error message if Supabase has a problem.
  const [errorMessage, setErrorMessage] = useState("");

  // Store auction status from Supabase.
// open = merchant can submit.
// closed = merchant cannot submit.
const [auctionStatus, setAuctionStatus] = useState("open");

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
        price: "",
      })) || [];

    setOffers(motorcycleOffers);
  }

  loadAuctionStatus();
  loadMotorcycles();
}, []);

  // This function updates the price for one motorcycle.
  function updatePrice(index: number, value: string) {
    // Copy current offers.
    const newOffers = [...offers];

    // Change price of selected offer.
    newOffers[index].price = value;

    // Save updated offers.
    setOffers(newOffers);
  }

  // This function runs when user clicks Review My Offers.
  function handleSubmit() {
    if (auctionStatus === "closed") {
  alert("Auction is closed. You cannot submit offers anymore.");
  return;
}
    // Keep only motorcycles where merchant entered a price.
    const submittedOffers = offers.filter((offer) => offer.price !== "");

    // Check merchant information.
    if (!merchantName || !shopName || !phone) {
      alert("Please fill merchant name, shop name, and phone number.");
      return;
    }

    // Check at least one offer.
    if (submittedOffers.length === 0) {
      alert("Please enter at least one offer price.");
      return;
    }

    // Save draft submission.
    const data = {
      merchantName,
      shopName,
      phone,
      offers: submittedOffers,
    };

    // Still save to localStorage for summary page.
    // Next step, summary page will save final data to Supabase.
    localStorage.setItem("draftSubmission", JSON.stringify(data));

    // Go to summary page.
    window.location.href = "/summary";
  }

  return (
    <main className="min-h-screen p-8">
      {/* Page title */}
      <h1 className="text-2xl font-bold">Merchant Offer Page</h1>

      {/* Auction status message */}
{auctionStatus === "open" ? (
  <p className="mt-4 rounded border border-green-500 p-3 text-green-700">
    Auction is OPEN. You can submit offers.
  </p>
) : (
  <p className="mt-4 rounded border border-red-500 p-3 text-red-700">
    Auction is CLOSED. You cannot submit offers anymore.
  </p>
)}

      {/* Error message */}
      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      {/* Merchant information form */}
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

      {/* Motorcycle offer list */}
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Motorcycle Lots</h2>

        {/* Show loading text before motorcycles load */}
        {offers.length === 0 && !errorMessage && (
          <p className="mt-4">Loading motorcycles...</p>
        )}

        {/* Show motorcycles from Supabase */}
        {offers.map((offer, index) => (
          <div key={offer.motorcycle_id} className="rounded border p-4">
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

      {/* Review button */}
      <button
  onClick={handleSubmit}
  disabled={auctionStatus === "closed"}
  className="mt-6 rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
>
  Review My Offers
</button>
    </main>
  );
}