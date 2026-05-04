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
    id: number;
    lot_number: string;
    motorcycle_name: string;
  } | null;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

export default function AdminPage() {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [totalMotorcycles, setTotalMotorcycles] = useState(0);
  const [activeMotorcycles, setActiveMotorcycles] = useState(0);
  const [pendingMerchantRequests, setPendingMerchantRequests] = useState(0);

  const [auctionStatus, setAuctionStatus] = useState("open");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingStaff, setIsCheckingStaff] = useState(true);

  const [resetPassword, setResetPassword] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");

  function saveStaffSession(profile: StaffProfile) {
    const updatedProfile = {
      ...profile,
      expiresAt: Date.now() + STAFF_TIMEOUT_MS,
    };

    localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));
    setStaffProfile(updatedProfile);
  }

  async function logoutStaff() {
    localStorage.removeItem("staffProfile");
    await supabase.auth.signOut();
    setStaffProfile(null);
    window.location.href = "/staff-login";
  }

  async function checkStaffSession() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) {
      window.location.href = "/staff-login";
      return;
    }

    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

    if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
      await logoutStaff();
      return;
    }

    setStaffProfile(savedProfile);
    setIsCheckingStaff(false);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      localStorage.removeItem("staffProfile");
      window.location.href = "/staff-login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profile || profile.length === 0) {
      await logoutStaff();
      return;
    }

    saveStaffSession({
      id: profile[0].id,
      email: profile[0].email,
      role: profile[0].role,
      active: profile[0].active,
    });
  }

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

    saveStaffSession(savedProfile);
  }

  useEffect(() => {
    checkStaffSession();
  }, []);

  useEffect(() => {
    if (!staffProfile) return;

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, refreshStaffActivity);
    });

    const interval = setInterval(() => {
      const savedProfileText = localStorage.getItem("staffProfile");

      if (!savedProfileText) {
        logoutStaff();
        return;
      }

      const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

      if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
        logoutStaff();
      }
    }, 5000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refreshStaffActivity);
      });

      clearInterval(interval);
    };
  }, [staffProfile]);

  async function loadAuctionStatus() {
    const { data, error } = await supabase
      .from("auction_settings")
      .select("id, status")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data) {
      setErrorMessage("No auction setting found.");
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
      .eq("auction_name", "Main Motorcycle Auction");

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
          id,
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

  async function loadMotorcycleCounts() {
    const { data, error } = await supabase
      .from("motorcycles")
      .select("id, active");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const motorcycles = data || [];

    setTotalMotorcycles(motorcycles.length);
    setActiveMotorcycles(
      motorcycles.filter((motorcycle) => motorcycle.active).length
    );
  }

  async function loadPendingMerchantRequests() {
    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("id")
      .eq("approval_status", "pending");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPendingMerchantRequests(data?.length || 0);
  }

  async function loadDashboardData() {
    await Promise.all([
      loadAuctionStatus(),
      loadOffers(),
      loadMotorcycleCounts(),
      loadPendingMerchantRequests(),
    ]);
  }

  useEffect(() => {
    loadDashboardData();
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

  const totalHighestOfferValue = winners.reduce((sum, winner) => {
    return sum + Number(winner.offer_price || 0);
  }, 0);

  async function resetAuctionData() {
    if (staffProfile?.role !== "owner") {
      setErrorMessage("Only the owner account can reset auction data.");
      return;
    }

    if (!staffProfile?.email) {
      setErrorMessage("Staff profile not found. Please log in again.");
      return;
    }

    if (!resetPassword) {
      alert("Please enter your owner password before resetting auction data.");
      return;
    }

    if (resetPhrase !== "RESET AUCTION") {
      alert('Please type exactly "RESET AUCTION" before resetting.');
      return;
    }

    const confirmReset = confirm(
      "Are you sure you want to reset auction data? This will delete all submitted offers and merchant submission records. Motorcycle lots, photos, merchant accounts, and staff accounts will stay."
    );

    if (!confirmReset) return;

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: staffProfile.email,
      password: resetPassword,
    });

    if (passwordError) {
      setErrorMessage("Wrong password. Reset auction data was cancelled.");
      setResetPassword("");
      return;
    }

    const secondConfirm = confirm(
      "Final confirmation: this cannot be undone. Delete all submitted offers?"
    );

    if (!secondConfirm) return;

    setIsLoading(true);
    setErrorMessage("");

    const { error: offersError } = await supabase
      .from("offers")
      .delete()
      .neq("id", 0);

    if (offersError) {
      setErrorMessage(offersError.message);
      setIsLoading(false);
      return;
    }

    const { error: merchantsError } = await supabase
      .from("merchants")
      .delete()
      .neq("id", 0);

    if (merchantsError) {
      setErrorMessage(merchantsError.message);
      setIsLoading(false);
      return;
    }

    setResetPassword("");
    setResetPhrase("");
    await loadDashboardData();
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

  if (isCheckingStaff) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-700">Checking staff login...</p>
        </section>
      </main>
    );
  }

  if (!staffProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-700">Redirecting to staff login...</p>
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

            <p className="mt-1 text-sm text-gray-600">
              Logged in as {staffProfile.email} • {staffProfile.role}
            </p>
          </div>

          <button
            onClick={logoutStaff}
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

        {pendingMerchantRequests > 0 && (
          <section className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide">
                  New Merchant Requests
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {pendingMerchantRequests} merchant account request
                  {pendingMerchantRequests > 1 ? "s" : ""} pending approval
                </h2>
                <p className="mt-1 text-sm">
                  Review and approve new merchant registrations.
                </p>
              </div>

              <a
                href="/admin/merchants"
                className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white shadow hover:bg-red-700"
              >
                Review Requests
              </a>
            </div>
          </section>
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

        <section className="mt-5 grid gap-4 md:grid-cols-6">
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
            <p className="text-sm font-medium text-gray-500">
              Lots With Offers
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {uniqueMotorcycles.size}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Total Lots</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalMotorcycles}
            </p>
            <p className="text-sm text-gray-500">
              Active: {activeMotorcycles}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              Merchant Requests
            </p>
            <p
              className={
                pendingMerchantRequests > 0
                  ? "mt-2 text-3xl font-bold text-red-600"
                  : "mt-2 text-3xl font-bold text-gray-900"
              }
            >
              {pendingMerchantRequests}
            </p>
            <p className="text-sm text-gray-500">Pending approval</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">Total Value</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalHighestOfferValue.toLocaleString()}
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
              className="relative rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              Manage Merchants

              {pendingMerchantRequests > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingMerchantRequests}
                </span>
              )}
            </a>

            {staffProfile?.role === "owner" && (
              <a
                href="/admin/staff"
                className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
              >
                Owner Settings
              </a>
            )}

            <button
              onClick={loadDashboardData}
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              Refresh Data
            </button>

            {staffProfile?.role === "owner" && (
              <>
                <input
                  type="password"
                  className="rounded-xl border px-4 py-2 outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="Owner password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />

                <input
                  type="text"
                  className="rounded-xl border px-4 py-2 outline-none focus:ring-2 focus:ring-red-600"
                  placeholder='Type "RESET AUCTION"'
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value)}
                />

                <button
                  onClick={resetAuctionData}
                  className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  Reset Auction Data
                </button>
              </>
            )}

            {!isLoading && winners.length > 0 && (
              <button
                onClick={exportWinnersCsv}
                className="rounded-xl bg-black px-4 py-2 font-medium text-white"
              >
                Export Highest Offers
              </button>
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
            <h2 className="text-xl font-bold text-gray-900">
              Highest Offer Per Motorcycle
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Current leading offer for each lot. Click View Offers to see all
              offers for that lot.
            </p>

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
                    <th className="p-3">Details</th>
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

                      <td className="p-3">
                        {winner.motorcycles?.id ? (
                          <a
                            href={`/admin/lots/${winner.motorcycles.id}`}
                            className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            View Offers
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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