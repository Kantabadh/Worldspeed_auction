"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MerchantAccount = {
  id: number;
  merchant_code: string;
  merchant_name: string;
  shop_name: string;
  phone: string;
  active: boolean;
  created_at: string;
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
  const [errorMessage, setErrorMessage] = useState("");

  async function loadMerchants() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("*")
      .order("merchant_code");

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMerchants((data as MerchantAccount[]) || []);
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
      merchant_code: merchantCode,
      merchant_name: merchantName,
      shop_name: shopName,
      phone,
      active: true,
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
        merchant_code: editMerchantCode,
        merchant_name: editMerchantName,
        shop_name: editShopName,
        phone: editPhone,
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

  async function deleteMerchant(id: number) {
    const confirmDelete = confirm(
      "Are you sure you want to delete this merchant account?"
    );

    if (!confirmDelete) {
      return;
    }

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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Merchant Management</h1>
            <p className="mt-1 text-gray-600">
              Create merchant accounts for phone + merchant code login.
            </p>
          </div>

          <div className="flex gap-3">
            <a href="/admin" className="rounded border bg-white px-4 py-2">
              Back to Admin
            </a>

            <button onClick={loadMerchants} className="rounded border bg-white px-4 py-2">
              Refresh
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded border border-red-500 bg-red-50 p-3 text-red-600">
            Error: {errorMessage}
          </p>
        )}

        <section className="mt-6 rounded-2xl bg-white p-5 shadow">
          <h2 className="text-xl font-semibold">Add Merchant Account</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Merchant Code
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  className="w-full rounded border p-2"
                  placeholder="Example: M001"
                  value={merchantCode}
                  onChange={(e) => setMerchantCode(e.target.value)}
                />

                <button
                  onClick={generateNextCode}
                  className="rounded border px-3 py-2"
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
                className="mt-1 w-full rounded border p-2"
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
                className="mt-1 w-full rounded border p-2"
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
                className="mt-1 w-full rounded border p-2"
                placeholder="Example: 0812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={addMerchant}
            disabled={isAdding}
            className="mt-4 rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
          >
            {isAdding ? "Adding..." : "Add Merchant"}
          </button>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow">
          <h2 className="text-xl font-semibold">Merchant Accounts</h2>

          {isLoading && <p className="mt-4">Loading merchants...</p>}

          {!isLoading && merchants.length === 0 && (
            <p className="mt-4">No merchant accounts found.</p>
          )}

          {!isLoading && merchants.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Code</th>
                    <th className="border p-2">Merchant Name</th>
                    <th className="border p-2">Shop</th>
                    <th className="border p-2">Phone</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Created At</th>
                    <th className="border p-2">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {merchants.map((merchant) => (
                    <tr key={merchant.id}>
                      <td className="border p-2">
                        {editingId === merchant.id ? (
                          <input
                            className="w-full rounded border p-1"
                            value={editMerchantCode}
                            onChange={(e) =>
                              setEditMerchantCode(e.target.value)
                            }
                          />
                        ) : (
                          merchant.merchant_code
                        )}
                      </td>

                      <td className="border p-2">
                        {editingId === merchant.id ? (
                          <input
                            className="w-full rounded border p-1"
                            value={editMerchantName}
                            onChange={(e) =>
                              setEditMerchantName(e.target.value)
                            }
                          />
                        ) : (
                          merchant.merchant_name
                        )}
                      </td>

                      <td className="border p-2">
                        {editingId === merchant.id ? (
                          <input
                            className="w-full rounded border p-1"
                            value={editShopName}
                            onChange={(e) => setEditShopName(e.target.value)}
                          />
                        ) : (
                          merchant.shop_name
                        )}
                      </td>

                      <td className="border p-2">
                        {editingId === merchant.id ? (
                          <input
                            className="w-full rounded border p-1"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                          />
                        ) : (
                          merchant.phone
                        )}
                      </td>

                      <td className="border p-2">
                        {merchant.active ? (
                          <span className="font-bold text-green-600">
                            Active
                          </span>
                        ) : (
                          <span className="font-bold text-red-600">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="border p-2">
                        {new Date(merchant.created_at).toLocaleString()}
                      </td>

                      <td className="space-x-2 border p-2">
                        {editingId === merchant.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(merchant.id)}
                              className="rounded bg-black px-3 py-1 text-white"
                            >
                              Save
                            </button>

                            <button
                              onClick={cancelEditing}
                              className="rounded border px-3 py-1"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(merchant)}
                              className="rounded border px-3 py-1"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => toggleActive(merchant)}
                              className={
                                merchant.active
                                  ? "rounded bg-yellow-500 px-3 py-1 text-white"
                                  : "rounded bg-green-600 px-3 py-1 text-white"
                              }
                            >
                              {merchant.active ? "Deactivate" : "Activate"}
                            </button>

                            <button
                              onClick={() => deleteMerchant(merchant.id)}
                              className="rounded bg-red-600 px-3 py-1 text-white"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}