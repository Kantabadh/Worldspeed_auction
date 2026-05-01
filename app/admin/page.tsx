"use client";

// useEffect runs code when the page loads.
// useState stores changing data on the page.
import { useEffect, useState } from "react";

// Import Supabase connection.
import { supabase } from "@/lib/supabase";

// This is the shape of one offer row after joining tables.
type AdminOffer = {
  id: number;
  offer_price: number;
  submitted_at: string;
  merchants: {
    name: string;
    shop_name: string;
    phone: string;
  } | null;
  motorcycles: {
    lot_number: string;
    motorcycle_name: string;
  } | null;
};

export default function AdminPage() {
  // Store all offers loaded from Supabase.
  const [offers, setOffers] = useState<AdminOffer[]>([]);

  // Store error message if something fails.
  const [errorMessage, setErrorMessage] = useState("");

  // Store loading state.
  const [isLoading, setIsLoading] = useState(true);

  // Store auction status.
  // open = merchants can submit.
  // closed = merchants cannot submit.
  const [auctionStatus, setAuctionStatus] = useState("open");

  // Store loading state when changing auction status.
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Store whether admin has logged in.
const [isLoggedIn, setIsLoggedIn] = useState(false);

// Store password typed by admin.
const [passwordInput, setPasswordInput] = useState("");

// Store login error message.
const [loginError, setLoginError] = useState("");

// This function checks the admin password.
function handleAdminLogin() {
  const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  if (passwordInput === correctPassword) {
    setIsLoggedIn(true);
    setLoginError("");
  } else {
    setLoginError("Wrong password. Please try again.");
  }
}

  // This function loads auction status from Supabase.
  async function loadAuctionStatus() {
    const { data, error } = await supabase
      .from("auction_settings")
      .select("id, status")
      .limit(1)
      .single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setAuctionStatus(data.status);
  }

  // This function changes auction status between open and closed.
  async function toggleAuctionStatus() {
    setIsUpdatingStatus(true);
    setErrorMessage("");

    // If current status is open, change to closed.
    // If current status is closed, change to open.
    const newStatus = auctionStatus === "open" ? "closed" : "open";

    const { error } = await supabase
      .from("auction_settings")
      .update({ status: newStatus })
      .eq("id", 1);

    if (error) {
      setErrorMessage(error.message);
      setIsUpdatingStatus(false);
      return;
    }

    setAuctionStatus(newStatus);
    setIsUpdatingStatus(false);
  }

  // This function loads all offers from Supabase.
  async function loadOffers() {
    // Start loading.
    setIsLoading(true);

    // Clear old error message.
    setErrorMessage("");

    // Read offers and also bring merchant and motorcycle information.
    const { data, error } = await supabase
      .from("offers")
      .select(`
        id,
        offer_price,
        submitted_at,
        merchants (
          name,
          shop_name,
          phone
        ),
        motorcycles (
          lot_number,
          motorcycle_name
        )
      `)
      .order("submitted_at", { ascending: false });

    // If Supabase gives an error, show it.
    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    // Save data into state.
    setOffers((data as unknown as AdminOffer[]) || []);

    // Stop loading.
    setIsLoading(false);
  }

  // Load auction status and offers from Supabase when admin page opens.
  useEffect(() => {
    loadAuctionStatus();
    loadOffers();
  }, []);

  // Create winner summary by finding the highest offer for each motorcycle lot.
  const winnerSummary = offers.reduce((summary, offer) => {
    // Get motorcycle lot number.
    const lotNumber = offer.motorcycles?.lot_number || "Unknown";

    // Check if this lot is already inside summary.
    const existingWinner = summary[lotNumber];

    // If no winner exists yet, or this offer is higher than current winner,
    // save this offer as the new winner.
    if (!existingWinner || offer.offer_price > existingWinner.offer_price) {
      summary[lotNumber] = offer;
    }

    // Return updated summary object.
    return summary;
  }, {} as Record<string, AdminOffer>);

  // Convert winner summary object into an array so we can display it in a table.
  const winners = Object.values(winnerSummary).sort((a, b) => {
    const lotA = a.motorcycles?.lot_number || "";
    const lotB = b.motorcycles?.lot_number || "";

    return lotA.localeCompare(lotB);
  });

  // This function downloads all submitted offers as a CSV file.
  // CSV can be opened in Excel.
  function exportAllOffersCsv() {
    // Create the header row for the CSV file.
    const headers = [
      "Lot",
      "Motorcycle",
      "Offer Price",
      "Merchant",
      "Shop",
      "Phone",
      "Submitted At",
    ];

    // Convert each offer into one CSV row.
    const rows = offers.map((offer) => [
      offer.motorcycles?.lot_number || "",
      offer.motorcycles?.motorcycle_name || "",
      offer.offer_price,
      offer.merchants?.name || "",
      offer.merchants?.shop_name || "",
      offer.merchants?.phone || "",
      new Date(offer.submitted_at).toLocaleString(),
    ]);

    // Combine header and rows.
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    // Create a downloadable file.
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    // Create a temporary download link.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Set file name.
    link.href = url;
    link.download = "all-submitted-offers.csv";

    // Click the link automatically.
    link.click();

    // Clean up memory.
    URL.revokeObjectURL(url);
  }

  // This function downloads only the highest offer per motorcycle.
  function exportWinnersCsv() {
    // Create the header row.
    const headers = [
      "Lot",
      "Motorcycle",
      "Highest Offer",
      "Merchant",
      "Shop",
      "Phone",
    ];

    // Convert each winner into one CSV row.
    const rows = winners.map((winner) => [
      winner.motorcycles?.lot_number || "",
      winner.motorcycles?.motorcycle_name || "",
      winner.offer_price,
      winner.merchants?.name || "",
      winner.merchants?.shop_name || "",
      winner.merchants?.phone || "",
    ]);

    // Combine header and rows.
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    // Create downloadable file.
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    // Create temporary download link.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Set file name.
    link.href = url;
    link.download = "highest-offers.csv";

    // Click the link automatically.
    link.click();

    // Clean up memory.
    URL.revokeObjectURL(url);
  }

// If admin is not logged in, show password page.
if (!isLoggedIn) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Admin Login</h1>

      <section className="mt-6 max-w-sm space-y-3">
        <input
          type="password"
          className="w-full rounded border p-2"
          placeholder="Enter admin password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
        />

        {loginError && (
          <p className="rounded border border-red-500 p-3 text-red-600">
            {loginError}
          </p>
        )}

        <button
          onClick={handleAdminLogin}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Login
        </button>
      </section>
    </main>
  );
}

  return (
    <main className="min-h-screen p-8">
      {/* Page title */}
      <h1 className="text-2xl font-bold">Admin Result Page</h1>

      {/* Auction status control */}
      <section className="mt-4 rounded border p-4">
        <p className="font-bold">
          Current auction status:{" "}
          <span
            className={
              auctionStatus === "open" ? "text-green-600" : "text-red-600"
            }
          >
            {auctionStatus.toUpperCase()}
          </span>
        </p>

        <button
          onClick={toggleAuctionStatus}
          disabled={isUpdatingStatus}
          className={
            auctionStatus === "open"
              ? "mt-3 rounded bg-red-600 px-4 py-2 text-white disabled:bg-gray-400"
              : "mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:bg-gray-400"
          }
        >
          {isUpdatingStatus
            ? "Updating..."
            : auctionStatus === "open"
            ? "Close Auction"
            : "Open Auction"}
        </button>
      </section>

      {/* Admin action buttons */}
      <div className="mt-4 flex gap-4">
        <a href="/admin/motorcycles" className="rounded border px-4 py-2">
  Manage Motorcycles
</a>

        {/* This button reloads the offer data from Supabase */}
        <button onClick={loadOffers} className="rounded border px-4 py-2">
          Refresh Data
        </button>

        {/* These export buttons only show when offers exist */}
        {!isLoading && offers.length > 0 && (
          <>
            <button
              onClick={exportWinnersCsv}
              className="rounded bg-black px-4 py-2 text-white"
            >
              Export Highest Offers CSV
            </button>

            <button
              onClick={exportAllOffersCsv}
              className="rounded border px-4 py-2"
            >
              Export All Offers CSV
            </button>
          </>
        )}
      </div>

      {/* Loading message */}
      {isLoading && <p className="mt-6">Loading offers...</p>}

      {/* Error message */}
      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      {/* Empty message */}
      {!isLoading && !errorMessage && offers.length === 0 && (
        <p className="mt-6">No offers submitted yet.</p>
      )}

      {/* Winner summary table */}
      {!isLoading && winners.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Highest Offer Per Motorcycle</h2>

          <table className="mt-3 w-full border">
            <thead>
              <tr className="bg-green-100">
                <th className="border p-2">Lot</th>
                <th className="border p-2">Motorcycle</th>
                <th className="border p-2">Highest Offer</th>
                <th className="border p-2">Merchant</th>
                <th className="border p-2">Shop</th>
                <th className="border p-2">Phone</th>
              </tr>
            </thead>

            <tbody>
              {winners.map((winner) => (
                <tr key={winner.id}>
                  <td className="border p-2">
                    {winner.motorcycles?.lot_number}
                  </td>

                  <td className="border p-2">
                    {winner.motorcycles?.motorcycle_name}
                  </td>

                  <td className="border p-2 font-bold">
                    {Number(winner.offer_price).toLocaleString()} baht
                  </td>

                  <td className="border p-2">{winner.merchants?.name}</td>

                  <td className="border p-2">{winner.merchants?.shop_name}</td>

                  <td className="border p-2">{winner.merchants?.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Offer table */}
      {!isLoading && offers.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">All Submitted Offers</h2>

          <table className="mt-3 w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Lot</th>
                <th className="border p-2">Motorcycle</th>
                <th className="border p-2">Offer Price</th>
                <th className="border p-2">Merchant</th>
                <th className="border p-2">Shop</th>
                <th className="border p-2">Phone</th>
                <th className="border p-2">Submitted At</th>
              </tr>
            </thead>

            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="border p-2">
                    {offer.motorcycles?.lot_number}
                  </td>

                  <td className="border p-2">
                    {offer.motorcycles?.motorcycle_name}
                  </td>

                  <td className="border p-2">
                    {Number(offer.offer_price).toLocaleString()} baht
                  </td>

                  <td className="border p-2">{offer.merchants?.name}</td>

                  <td className="border p-2">{offer.merchants?.shop_name}</td>

                  <td className="border p-2">{offer.merchants?.phone}</td>

                  <td className="border p-2">
                    {new Date(offer.submitted_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}