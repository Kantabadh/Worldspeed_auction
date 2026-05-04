"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type ApprovalStatus = "pending" | "approved" | "rejected";

type MerchantAccount = {
  id: number;
  merchant_code: string;
  merchant_name: string;
  shop_name: string;
  phone: string;
  active: boolean;
  approval_status: ApprovalStatus;
  can_edit_submission: boolean;
  is_starred: boolean;
  created_at: string;
  has_submission?: boolean;
};

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantAccount[]>([]);

  const [merchantCode, setMerchantCode] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMerchantCode, setEditMerchantCode] = useState("");
  const [editMerchantName, setEditMerchantName] = useState("");
  const [editShopName, setEditShopName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [clearingId, setClearingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadMerchants() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: merchantAccountsData, error: merchantAccountsError } =
      await supabase
        .from("merchant_accounts")
        .select("*")
        .order("is_starred", { ascending: false })
        .order("created_at", { ascending: false });

    if (merchantAccountsError) {
      setErrorMessage(merchantAccountsError.message);
      setIsLoading(false);
      return;
    }

    const { data: submittedMerchantsData, error: submittedMerchantsError } =
      await supabase
        .from("merchants")
        .select("id, merchant_account_id")
        .not("merchant_account_id", "is", null);

    if (submittedMerchantsError) {
      setErrorMessage(submittedMerchantsError.message);
      setIsLoading(false);
      return;
    }

    const submittedMerchantAccountIds = new Set(
      (submittedMerchantsData || []).map(
        (merchant) => merchant.merchant_account_id
      )
    );

    const merchantAccountsWithSubmissionStatus =
      (merchantAccountsData as MerchantAccount[] | null)?.map((merchant) => ({
        ...merchant,
        approval_status: merchant.approval_status || "approved",
        can_edit_submission: merchant.can_edit_submission ?? false,
        is_starred: merchant.is_starred ?? false,
        has_submission: submittedMerchantAccountIds.has(merchant.id),
      })) || [];

    setMerchants(merchantAccountsWithSubmissionStatus);
    setIsLoading(false);
  }

  async function addMerchant() {
    if (!merchantCode || !merchantName || !shopName || !phone) {
      alert("Please fill merchant code, merchant name, shop name, and phone.");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    const { error } = await supabase.from("merchant_accounts").insert({
      merchant_code: merchantCode.trim().toUpperCase(),
      merchant_name: merchantName.trim(),
      shop_name: shopName.trim(),
      phone: phone.trim(),
      active: true,
      approval_status: "approved",
      can_edit_submission: false,
      is_starred: false,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsAdding(false);
      return;
    }

    setMerchantCode("");
    setMerchantName("");
    setShopName("");
    setPhone("");
    setIsAdding(false);
    loadMerchants();
  }

  async function approveMerchant(merchant: MerchantAccount) {
    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        approval_status: "approved",
        active: true,
      })
      .eq("id", merchant.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  async function rejectMerchant(merchant: MerchantAccount) {
    const confirmReject = confirm(
      `Reject ${merchant.merchant_name} / ${merchant.shop_name}? They will not be able to log in.`
    );

    if (!confirmReject) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        approval_status: "rejected",
        active: false,
      })
      .eq("id", merchant.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  async function toggleStar(merchant: MerchantAccount) {
    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        is_starred: !merchant.is_starred,
      })
      .eq("id", merchant.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  function startEditing(merchant: MerchantAccount) {
    setEditingId(merchant.id);
    setEditMerchantCode(merchant.merchant_code);
    setEditMerchantName(merchant.merchant_name);
    setEditShopName(merchant.shop_name);
    setEditPhone(merchant.phone);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditMerchantCode("");
    setEditMerchantName("");
    setEditShopName("");
    setEditPhone("");
  }

  async function saveEdit(id: number) {
    if (!editMerchantCode || !editMerchantName || !editShopName || !editPhone) {
      alert("Please fill merchant code, merchant name, shop name, and phone.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        merchant_code: editMerchantCode.trim().toUpperCase(),
        merchant_name: editMerchantName.trim(),
        shop_name: editShopName.trim(),
        phone: editPhone.trim(),
      })
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    cancelEditing();
    loadMerchants();
  }

  async function toggleActive(merchant: MerchantAccount) {
    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        active: !merchant.active,
      })
      .eq("id", merchant.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  async function toggleEditPermission(merchant: MerchantAccount) {
    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        can_edit_submission: !merchant.can_edit_submission,
      })
      .eq("id", merchant.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  async function deleteMerchant(id: number) {
    const confirmDelete = confirm(
      "Are you sure you want to delete this merchant account?"
    );

    if (!confirmDelete) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMerchants();
  }

  async function clearMerchantSubmission(merchant: MerchantAccount) {
    const confirmClear = confirm(
      `Clear submitted offers for ${merchant.merchant_name} / ${merchant.shop_name}? This will allow this merchant to submit again.`
    );

    if (!confirmClear) return;

    const secondConfirm = confirm(
      "Final confirmation: this will delete only this merchant's submitted offers. Continue?"
    );

    if (!secondConfirm) return;

    setClearingId(merchant.id);
    setErrorMessage("");

    const { data: submittedMerchantRows, error: merchantRowsError } =
      await supabase
        .from("merchants")
        .select("id")
        .eq("merchant_account_id", merchant.id);

    if (merchantRowsError) {
      setErrorMessage(merchantRowsError.message);
      setClearingId(null);
      return;
    }

    if (!submittedMerchantRows || submittedMerchantRows.length === 0) {
      alert("This merchant has no submitted offers to clear.");
      setClearingId(null);
      loadMerchants();
      return;
    }

    const submittedMerchantIds = submittedMerchantRows.map((row) => row.id);

    const { error: offersDeleteError } = await supabase
      .from("offers")
      .delete()
      .in("merchant_id", submittedMerchantIds);

    if (offersDeleteError) {
      setErrorMessage(offersDeleteError.message);
      setClearingId(null);
      return;
    }

    const { error: merchantsDeleteError } = await supabase
      .from("merchants")
      .delete()
      .in("id", submittedMerchantIds);

    if (merchantsDeleteError) {
      setErrorMessage(merchantsDeleteError.message);
      setClearingId(null);
      return;
    }

    await supabase
      .from("merchant_accounts")
      .update({
        can_edit_submission: false,
      })
      .eq("id", merchant.id);

    setClearingId(null);
    loadMerchants();
  }

  function generateNextCode() {
    const numbers = merchants
      .map((merchant) => {
        const match = merchant.merchant_code.match(/\d+/);
        return match ? Number(match[0]) : 0;
      })
      .filter((num) => !Number.isNaN(num));

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const nextCode = "M" + String(nextNumber).padStart(3, "0");

    setMerchantCode(nextCode);
  }

  useEffect(() => {
    loadMerchants();
  }, []);

  const activeCount = merchants.filter((merchant) => merchant.active).length;
  const inactiveCount = merchants.filter((merchant) => !merchant.active).length;
  const submittedCount = merchants.filter(
    (merchant) => merchant.has_submission
  ).length;
  const editableCount = merchants.filter(
    (merchant) => merchant.can_edit_submission
  ).length;
  const pendingCount = merchants.filter(
    (merchant) => merchant.approval_status === "pending"
  ).length;
  const starredCount = merchants.filter((merchant) => merchant.is_starred)
    .length;

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Admin Management
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Merchant Accounts
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                Approve new merchant registrations, star important accounts, and
                control offer editing.
              </p>
            </div>

            <button
              onClick={loadMerchants}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid gap-4 md:grid-cols-7">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">
                Total Merchants
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {merchants.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Starred</p>
              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {starredCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {pendingCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {inactiveCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Submitted</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {submittedCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Editable</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {editableCount}
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Add Merchant Account
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Admin-created merchants are approved immediately.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Merchant Code
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    className="w-full rounded-2xl border p-3 uppercase outline-none focus:ring-2 focus:ring-black"
                    placeholder="Example: M001"
                    value={merchantCode}
                    onChange={(e) =>
                      setMerchantCode(e.target.value.toUpperCase())
                    }
                  />

                  <button
                    onClick={generateNextCode}
                    className="rounded-2xl border px-4 py-2 font-medium hover:bg-gray-100"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Merchant Name
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="Example: Somchai"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Shop Name
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="Example: ABC Motor"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="Example: 0812345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={addMerchant}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "Adding..." : "Add Merchant"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Merchant Account List
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Star, approve, reject, activate, edit, clear submission, or allow
              offer editing.
            </p>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">Loading merchants...</p>
              </div>
            )}

            {!isLoading && merchants.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">No merchant accounts found.</p>
              </div>
            )}

            {!isLoading && merchants.length > 0 && (
              <div className="mt-5 space-y-4">
                {merchants.map((merchant) => (
                  <article
                    key={merchant.id}
                    className={
                      merchant.is_starred
                        ? "rounded-2xl border border-yellow-300 bg-yellow-50 p-4 shadow-sm"
                        : "rounded-2xl border bg-white p-4 shadow-sm"
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          {merchant.is_starred ? "⭐ " : ""}
                          {merchant.merchant_code}
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {merchant.merchant_name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-600">
                          {merchant.shop_name} • {merchant.phone}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {merchant.is_starred && (
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-700">
                            Starred
                          </span>
                        )}

                        {merchant.approval_status === "pending" && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                            Pending
                          </span>
                        )}

                        {merchant.approval_status === "approved" && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                            Approved
                          </span>
                        )}

                        {merchant.approval_status === "rejected" && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                            Rejected
                          </span>
                        )}

                        {merchant.has_submission ? (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                            Submitted
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                            Not Submitted
                          </span>
                        )}

                        {merchant.can_edit_submission && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                            Edit Allowed
                          </span>
                        )}

                        {merchant.active ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {editingId === merchant.id ? (
                      <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                        <h4 className="font-semibold text-gray-900">
                          Edit Merchant
                        </h4>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            className="rounded-xl border p-3 uppercase"
                            value={editMerchantCode}
                            onChange={(e) =>
                              setEditMerchantCode(e.target.value.toUpperCase())
                            }
                          />

                          <input
                            className="rounded-xl border p-3"
                            value={editMerchantName}
                            onChange={(e) =>
                              setEditMerchantName(e.target.value)
                            }
                          />

                          <input
                            className="rounded-xl border p-3"
                            value={editShopName}
                            onChange={(e) => setEditShopName(e.target.value)}
                          />

                          <input
                            className="rounded-xl border p-3"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => saveEdit(merchant.id)}
                            className="rounded-xl bg-black px-4 py-2 font-semibold text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEditing}
                            className="rounded-xl border bg-white px-4 py-2 font-semibold hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => toggleStar(merchant)}
                          className={
                            merchant.is_starred
                              ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
                              : "rounded-xl border px-4 py-2 font-medium hover:bg-yellow-50"
                          }
                        >
                          {merchant.is_starred ? "Unstar" : "⭐ Star"}
                        </button>

                        {merchant.approval_status === "pending" && (
                          <>
                            <button
                              onClick={() => approveMerchant(merchant)}
                              className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => rejectMerchant(merchant)}
                              className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {merchant.approval_status === "rejected" && (
                          <button
                            onClick={() => approveMerchant(merchant)}
                            className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                          >
                            Approve Again
                          </button>
                        )}

                        <button
                          onClick={() => startEditing(merchant)}
                          className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => toggleActive(merchant)}
                          className={
                            merchant.active
                              ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
                              : "rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                          }
                        >
                          {merchant.active ? "Deactivate" : "Activate"}
                        </button>

                        {merchant.has_submission && (
                          <button
                            onClick={() => toggleEditPermission(merchant)}
                            className={
                              merchant.can_edit_submission
                                ? "rounded-xl bg-gray-700 px-4 py-2 font-medium text-white hover:bg-gray-800"
                                : "rounded-xl bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
                            }
                          >
                            {merchant.can_edit_submission
                              ? "Lock Edit"
                              : "Allow Edit"}
                          </button>
                        )}

                        {merchant.has_submission && (
                          <button
                            onClick={() => clearMerchantSubmission(merchant)}
                            disabled={clearingId === merchant.id}
                            className="rounded-xl bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:bg-gray-400"
                          >
                            {clearingId === merchant.id
                              ? "Clearing..."
                              : "Clear Submission"}
                          </button>
                        )}

                        <button
                          onClick={() => deleteMerchant(merchant.id)}
                          className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}