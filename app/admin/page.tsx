"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const ADMIN_TIMEOUT_MS = 10 * 60 * 1000;

export default function AdminPage() {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [auctionStatus, setAuctionStatus] = useState("open");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  function saveAdminSession() {
    const expiresAt = Date.now() + ADMIN_TIMEOUT_MS;

    localStorage.setItem(
      "adminSession",
      JSON.stringify({
        expiresAt,
      })
    );
  }

  function logoutAdmin() {
    localStorage.removeItem("adminSession");
    setIsLoggedIn(false);
    setPasswordInput("");
    window.location.href = "/admin";
  }

  function checkAdminSession() {
    const savedSession = localStorage.getItem("adminSession");

    if (!savedSession) {
      setIsLoggedIn(false);
      return;
    }

    const session = JSON.parse(savedSession);

    if (Date.now() > session.expiresAt) {
      localStorage.removeItem("adminSession");
      setIsLoggedIn(false);
      return;
    }

    setIsLoggedIn(true);
  }

  function refreshAdminActivity() {
    const savedSession = localStorage.getItem("adminSession");

    if (!savedSession) return;

    saveAdminSession();
  }

  function handleAdminLogin() {
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    if (passwordInput === correctPassword) {
      saveAdminSession();
      setIsLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Wrong password. Please try again.");
    }
  }

  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, refreshAdminActivity);
    });

    const interval = setInterval(() => {
      const savedSession = localStorage.getItem("adminSession");

      if (!savedSession) {
        setIsLoggedIn(false);
        return;
      }

      const session = JSON.parse(savedSession);

      if (Date.now() > session.expiresAt) {
        logoutAdmin();
      }
    }, 5000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refreshAdminActivity);
      });

      clearInterval(interval);
    };
  }, [isLoggedIn]);

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

  async function toggleAuctionStatus() {
    setIsUpdatingStatus(true);
    setErrorMessage("");

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

  async function loadOffers() {
    setIsLoading(true);
    setErrorMessage("");

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

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setOffers((data as unknown as AdminOffer[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadAuctionStatus();
    loadOffers();
  }, []);

  const winnerSummary = offers.reduce((summary, offer) => {
    const lotNumber = offer.motorcycles?.lot_number || "Unknown";
    const existingWinner = summary[lotNumber];

    if (!existingWinner || offer.offer_price > existingWinner.offer_price) {
      summary[lotNumber] = offer;
    }

    return summary;
  }, {} as Record<string, AdminOffer>);

  const winners = Object.values(winnerSummary).sort((a, b) => {
    const lotA = a.motorcycles?.lot_number || "";
    const lotB = b.motorcycles?.lot_number || "";

    return lotA.localeCompare(lotB);
  });

  function exportAllOffersCsv() {
    const headers = [
      "Lot",
      "Motorcycle",
      "Offer Price",
      "Merchant",
      "Shop",
      "Phone",
      "Submitted At",
    ];

    const rows = offers.map((offer) => [
      offer.motorcycles?.lot_number || "",
      offer.motorcycles?.motorcycle_name || "",
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
    link.download = "all-submitted-offers.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportWinnersCsv() {
    const headers = [
      "Lot",
      "Motorcycle",
      "Highest Offer",
      "Merchant",
      "Shop",
      "Phone",
    ];

    const rows = winners.map((winner) => [
      winner.motorcycles?.lot_number || "",
      winner.motorcycles?.motorcycle_name || "",
      winner.offer_price,
      winner.merchants?.name || "",
      winner.merchants?.shop_name || "",
      winner.merchants?.phone || "",
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
    link.download = "highest-offers.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin Result Page</h1>

        <button onClick={logoutAdmin} className="rounded border px-4 py-2">
          Logout
        </button>
      </div>

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

      <div className="mt-4 flex flex-wrap gap-4">
        <a href="/admin/motorcycles" className="rounded border px-4 py-2">
          Manage Motorcycles
        </a>

        <a href="/admin/merchants" className="rounded border px-4 py-2">
          Manage Merchants
        </a>

        <button onClick={loadOffers} className="rounded border px-4 py-2">
          Refresh Data
        </button>

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

      {isLoading && <p className="mt-6">Loading offers...</p>}

      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && offers.length === 0 && (
        <p className="mt-6">No offers submitted yet.</p>
      )}

      {!isLoading && winners.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">
            Highest Offer Per Motorcycle
          </h2>

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