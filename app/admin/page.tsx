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
    localStorage.setItem(
      "adminSession",
      JSON.stringify({
        expiresAt: Date.now() + ADMIN_TIMEOUT_MS,
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

  const uniqueMerchants = new Set(
    offers.map((offer) => offer.merchants?.phone).filter(Boolean)
  );

  const uniqueMotorcycles = new Set(
    offers.map((offer) => offer.motorcycles?.lot_number).filter(Boolean)
  );

  const totalOfferValue = offers.reduce((sum, offer) => {
    return sum + Number(offer.offer_price || 0);
  }, 0);

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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
        <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-gray-200">
          <div className="bg-black px-6 py-6 text-white">
            <p className="text-sm font-medium uppercase tracking-wide text-gray-300">
              Motorcycle Offer System
            </p>

            <h1 className="mt-2 text-2xl font-bold">Admin Login</h1>

            <p className="mt-2 text-sm text-gray-300">
              Enter the admin password to manage auction results.
            </p>
          </div>

          <div className="p-6">
            {loginError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="font-semibold">Login failed</p>
                <p className="text-sm">{loginError}</p>
              </div>
            )}

            <label className="text-sm font-medium text-gray-700">
              Admin Password
            </label>

            <input
              type="password"
              className="mt-2 w-full rounded-2xl border p-3 text-lg outline-none focus:ring-2 focus:ring-black"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdminLogin();
              }}
            />

            <button
              onClick={handleAdminLogin}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white shadow"
            >
              Login
            </button>

            <p className="mt-4 text-center text-xs text-gray-500">
              Admin session expires after 10 minutes of no activity.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <header className="border-b bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Admin Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              Motorcycle Offer System
            </h1>
          </div>

          <button
            onClick={logoutAdmin}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Auction Status
              </p>

              <h2
                className={
                  auctionStatus === "open"
                    ? "mt-1 text-3xl font-bold text-green-600"
                    : "mt-1 text-3xl font-bold text-red-600"
                }
              >
                {auctionStatus.toUpperCase()}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                {auctionStatus === "open"
                  ? "Merchants can currently submit offers."
                  : "Offer submission is currently blocked."}
              </p>
            </div>

            <button
              onClick={toggleAuctionStatus}
              disabled={isUpdatingStatus}
              className={
                auctionStatus === "open"
                  ? "rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
                  : "rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
              }
            >
              {isUpdatingStatus
                ? "Updating..."
                : auctionStatus === "open"
                ? "Close Auction"
                : "Open Auction"}
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Total Offers</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {offers.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Merchants</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {uniqueMerchants.size}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Lots With Offers</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {uniqueMotorcycles.size}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Total Value</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalOfferValue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">baht</p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin/motorcycles"
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              Manage Motorcycles
            </a>

            <a
              href="/admin/merchants"
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              Manage Merchants
            </a>

            <button
              onClick={loadOffers}
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              Refresh Data
            </button>

            {!isLoading && offers.length > 0 && (
              <>
                <button
                  onClick={exportWinnersCsv}
                  className="rounded-xl bg-black px-4 py-2 font-medium text-white"
                >
                  Export Highest Offers
                </button>

                <button
                  onClick={exportAllOffersCsv}
                  className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                >
                  Export All Offers
                </button>
              </>
            )}
          </div>
        </section>

        {isLoading && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">Loading offers...</p>
          </div>
        )}

        {!isLoading && !errorMessage && offers.length === 0 && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">No offers submitted yet.</p>
          </div>
        )}

        {!isLoading && winners.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Highest Offer Per Motorcycle
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Current leading offer for each lot.
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-green-50 text-green-900">
                    <th className="p-3">Lot</th>
                    <th className="p-3">Motorcycle</th>
                    <th className="p-3">Highest Offer</th>
                    <th className="p-3">Merchant</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Phone</th>
                  </tr>
                </thead>

                <tbody>
                  {winners.map((winner) => (
                    <tr key={winner.id} className="border-b">
                      <td className="p-3 font-semibold">
                        {winner.motorcycles?.lot_number}
                      </td>

                      <td className="p-3">
                        {winner.motorcycles?.motorcycle_name}
                      </td>

                      <td className="p-3 font-bold text-green-700">
                        {Number(winner.offer_price).toLocaleString()} baht
                      </td>

                      <td className="p-3">{winner.merchants?.name}</td>

                      <td className="p-3">{winner.merchants?.shop_name}</td>

                      <td className="p-3">{winner.merchants?.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!isLoading && offers.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              All Submitted Offers
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Full submission history from all merchants.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-gray-700">
                    <th className="p-3">Lot</th>
                    <th className="p-3">Motorcycle</th>
                    <th className="p-3">Offer Price</th>
                    <th className="p-3">Merchant</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Submitted At</th>
                  </tr>
                </thead>

                <tbody>
                  {offers.map((offer) => (
                    <tr key={offer.id} className="border-b">
                      <td className="p-3 font-semibold">
                        {offer.motorcycles?.lot_number}
                      </td>

                      <td className="p-3">
                        {offer.motorcycles?.motorcycle_name}
                      </td>

                      <td className="p-3 font-bold">
                        {Number(offer.offer_price).toLocaleString()} baht
                      </td>

                      <td className="p-3">{offer.merchants?.name}</td>

                      <td className="p-3">{offer.merchants?.shop_name}</td>

                      <td className="p-3">{offer.merchants?.phone}</td>

                      <td className="p-3">
                        {new Date(offer.submitted_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}