"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type ApprovalStatus = "pending" | "approved" | "rejected";

type SubmittedLot = {
  offer_id: number;
  merchant_row_id: number;
  motorcycle_id: number;
  lot_number: string;
  motorcycle_name: string;
  offer_price: number;
  can_edit_lot: boolean;
};

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
  submitted_lots?: SubmittedLot[];
};

type SubmittedMerchantRow = {
  id: number;
  merchant_account_id: number;
  offers?: {
    id: number;
    offer_price: number;
    motorcycle_id: number;
    motorcycles?: {
      id: number;
      lot_number: string;
      motorcycle_name: string;
    } | null;
  }[];
};

type LotEditPermission = {
  id: number;
  merchant_account_id: number;
  motorcycle_id: number;
  can_edit: boolean;
};

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidPhone(value: string) {
  return /^\d{9,10}$/.test(value);
}

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
  const [updatingLotKey, setUpdatingLotKey] = useState<string | null>(null);
  const [openMerchantLotIds, setOpenMerchantLotIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  function toggleMerchantLots(merchantId: number) {
    setOpenMerchantLotIds((currentIds) =>
      currentIds.includes(merchantId)
        ? currentIds.filter((id) => id !== merchantId)
        : [...currentIds, merchantId]
    );
  }

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
        .select(`
          id,
          merchant_account_id,
          offers (
            id,
            offer_price,
            motorcycle_id,
            motorcycles (
              id,
              lot_number,
              motorcycle_name
            )
          )
        `)
        .not("merchant_account_id", "is", null);

    if (submittedMerchantsError) {
      setErrorMessage(submittedMerchantsError.message);
      setIsLoading(false);
      return;
    }

    const { data: permissionData, error: permissionError } = await supabase
      .from("merchant_lot_edit_permissions")
      .select("id, merchant_account_id, motorcycle_id, can_edit");

    if (permissionError) {
      setErrorMessage(permissionError.message);
      setIsLoading(false);
      return;
    }

    const permissionMap = new Map<string, boolean>();

    ((permissionData as LotEditPermission[] | null) || []).forEach(
      (permission) => {
        permissionMap.set(
          `${permission.merchant_account_id}-${permission.motorcycle_id}`,
          permission.can_edit
        );
      }
    );

    const submittedLotsByMerchantAccount = new Map<number, SubmittedLot[]>();

    ((submittedMerchantsData as unknown as SubmittedMerchantRow[] | null) || [])
      .filter((merchantRow) => merchantRow.merchant_account_id)
      .forEach((merchantRow) => {
        const merchantAccountId = merchantRow.merchant_account_id;
        const currentLots =
          submittedLotsByMerchantAccount.get(merchantAccountId) || [];

        (merchantRow.offers || []).forEach((offer) => {
          const motorcycle = offer.motorcycles;

          currentLots.push({
            offer_id: offer.id,
            merchant_row_id: merchantRow.id,
            motorcycle_id: offer.motorcycle_id,
            lot_number: motorcycle?.lot_number || "-",
            motorcycle_name: motorcycle?.motorcycle_name || "-",
            offer_price: Number(offer.offer_price || 0),
            can_edit_lot:
              permissionMap.get(
                `${merchantAccountId}-${offer.motorcycle_id}`
              ) || false,
          });
        });

        submittedLotsByMerchantAccount.set(
          merchantAccountId,
          currentLots.sort((a, b) => a.lot_number.localeCompare(b.lot_number))
        );
      });

    const merchantAccountsWithSubmissionStatus =
      (merchantAccountsData as MerchantAccount[] | null)?.map((merchant) => {
        const submittedLots =
          submittedLotsByMerchantAccount.get(merchant.id) || [];

        return {
          ...merchant,
          approval_status: merchant.approval_status || "approved",
          can_edit_submission: merchant.can_edit_submission ?? false,
          is_starred: merchant.is_starred ?? false,
          has_submission: submittedLots.length > 0,
          submitted_lots: submittedLots,
        };
      }) || [];

    setMerchants(merchantAccountsWithSubmissionStatus);
    setIsLoading(false);
  }

  async function addMerchant() {
    const cleanedPhone = cleanPhone(phone);

    if (!merchantCode || !merchantName || !shopName || !cleanedPhone) {
      alert("กรุณากรอกรหัสร้านค้า ชื่อผู้ติดต่อ ชื่อร้าน และเบอร์โทร");
      return;
    }

    if (!isValidPhone(cleanedPhone)) {
      alert("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    const { error } = await supabase.from("merchant_accounts").insert({
      merchant_code: merchantCode.trim().toUpperCase(),
      merchant_name: merchantName.trim(),
      shop_name: shopName.trim(),
      phone: cleanedPhone,
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
      `ไม่อนุมัติร้าน ${merchant.shop_name} ใช่หรือไม่? ร้านนี้จะไม่สามารถเข้าสู่ระบบได้`
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
    const cleanedPhone = cleanPhone(editPhone);

    if (
      !editMerchantCode ||
      !editMerchantName ||
      !editShopName ||
      !cleanedPhone
    ) {
      alert("กรุณากรอกรหัสร้านค้า ชื่อผู้ติดต่อ ชื่อร้าน และเบอร์โทร");
      return;
    }

    if (!isValidPhone(cleanedPhone)) {
      alert("เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        merchant_code: editMerchantCode.trim().toUpperCase(),
        merchant_name: editMerchantName.trim(),
        shop_name: editShopName.trim(),
        phone: cleanedPhone,
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

  async function toggleLotEditPermission(
    merchant: MerchantAccount,
    lot: SubmittedLot
  ) {
    const lotKey = `${merchant.id}-${lot.motorcycle_id}`;
    setUpdatingLotKey(lotKey);
    setErrorMessage("");

    if (lot.can_edit_lot) {
      const confirmLock = confirm(
        `ต้องการล็อกการแก้ไขราคา Lot ${lot.lot_number} ของร้าน ${merchant.shop_name} ใช่หรือไม่?`
      );

      if (!confirmLock) {
        setUpdatingLotKey(null);
        return;
      }

      const { error } = await supabase
        .from("merchant_lot_edit_permissions")
        .update({
          can_edit: false,
        })
        .eq("merchant_account_id", merchant.id)
        .eq("motorcycle_id", lot.motorcycle_id);

      if (error) {
        setErrorMessage(error.message);
        setUpdatingLotKey(null);
        return;
      }

      setUpdatingLotKey(null);
      loadMerchants();
      return;
    }

    const confirmAllow = confirm(
      `ให้ร้าน ${merchant.shop_name} แก้ไขราคาเฉพาะ Lot ${lot.lot_number} ใช่หรือไม่?`
    );

    if (!confirmAllow) {
      setUpdatingLotKey(null);
      return;
    }

    const { error } = await supabase
      .from("merchant_lot_edit_permissions")
      .upsert(
        {
          merchant_account_id: merchant.id,
          motorcycle_id: lot.motorcycle_id,
          can_edit: true,
        },
        {
          onConflict: "merchant_account_id,motorcycle_id",
        }
      );

    if (error) {
      setErrorMessage(error.message);
      setUpdatingLotKey(null);
      return;
    }

    await supabase
      .from("merchant_accounts")
      .update({
        can_edit_submission: false,
      })
      .eq("id", merchant.id);

    setUpdatingLotKey(null);
    loadMerchants();
  }

  async function deleteMerchant(id: number) {
    const confirmDelete = confirm("ต้องการลบบัญชีร้านค้านี้ใช่หรือไม่?");

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
      `ต้องการล้างรายการเสนอราคาของร้าน ${merchant.shop_name} ใช่หรือไม่? ร้านนี้จะสามารถส่งราคาใหม่ได้`
    );

    if (!confirmClear) return;

    const secondConfirm = confirm(
      "ยืนยันอีกครั้ง: ระบบจะลบเฉพาะรายการเสนอราคาของร้านนี้เท่านั้น ต้องการทำต่อหรือไม่?"
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
      alert("ร้านค้านี้ยังไม่มีรายการเสนอราคา");
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
      .from("merchant_lot_edit_permissions")
      .delete()
      .eq("merchant_account_id", merchant.id);

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
  const pendingCount = merchants.filter(
    (merchant) => merchant.approval_status === "pending"
  ).length;
  const starredCount = merchants.filter((merchant) => merchant.is_starred)
    .length;

  const editableLotCount = merchants.reduce((sum, merchant) => {
    return (
      sum +
      (merchant.submitted_lots || []).filter((lot) => lot.can_edit_lot).length
    );
  }, 0);

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                จัดการระบบ
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                บัญชีร้านค้า
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                อนุมัติร้านค้า จัดการสถานะ และเปิดสิทธิ์แก้ไขราคาแบบราย Lot
              </p>
            </div>

            <button
              onClick={loadMerchants}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              โหลดใหม่
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid gap-4 md:grid-cols-7">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ร้านค้าทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {merchants.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ปักดาว</p>
              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {starredCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">รออนุมัติ</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {pendingCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ใช้งาน</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ปิดใช้งาน</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {inactiveCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ส่งราคาแล้ว</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {submittedCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Lot ที่แก้ได้</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {editableLotCount}
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              เพิ่มบัญชีร้านค้า
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              ร้านค้าที่เพิ่มโดยแอดมินจะได้รับการอนุมัติทันที
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  รหัสร้านค้า
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    className="w-full rounded-2xl border p-3 uppercase outline-none focus:ring-2 focus:ring-black"
                    placeholder="เช่น M001"
                    value={merchantCode}
                    onChange={(e) =>
                      setMerchantCode(e.target.value.toUpperCase())
                    }
                  />

                  <button
                    onClick={generateNextCode}
                    className="rounded-2xl border px-4 py-2 font-medium hover:bg-gray-100"
                  >
                    อัตโนมัติ
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ชื่อผู้ติดต่อ
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น สมชาย"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ชื่อร้าน
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น สมชายมอเตอร์"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  เบอร์โทร
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="9 หรือ 10 หลัก"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(cleanPhone(e.target.value))}
                />

                <p className="mt-1 text-xs text-gray-500">
                  ใช้ได้ทั้งเบอร์บ้าน 9 หลัก และเบอร์มือถือ 10 หลัก
                </p>
              </div>
            </div>

            <button
              onClick={addMerchant}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มร้านค้า"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              รายชื่อร้านค้า
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              จัดการอนุมัติ แก้ไข ปิดใช้งาน ล้างราคา และเปิดสิทธิ์แก้ไขราคาเฉพาะ Lot
            </p>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">กำลังโหลดข้อมูลร้านค้า...</p>
              </div>
            )}

            {!isLoading && merchants.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">ยังไม่มีบัญชีร้านค้า</p>
              </div>
            )}

            {!isLoading && merchants.length > 0 && (
              <div className="mt-5 space-y-4">
                {merchants.map((merchant) => {
                  const submittedLots = merchant.submitted_lots || [];
                  const hasEditableLot = submittedLots.some(
                    (lot) => lot.can_edit_lot
                  );
                  const isLotsOpen = openMerchantLotIds.includes(merchant.id);

                  return (
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
                            {merchant.shop_name}
                          </h3>

                          <p className="mt-1 text-sm text-gray-600">
                            ผู้ติดต่อ: {merchant.merchant_name} • โทร:{" "}
                            {merchant.phone}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {merchant.is_starred && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-700">
                              ปักดาว
                            </span>
                          )}

                          {merchant.approval_status === "pending" && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                              รออนุมัติ
                            </span>
                          )}

                          {merchant.approval_status === "approved" && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                              อนุมัติแล้ว
                            </span>
                          )}

                          {merchant.approval_status === "rejected" && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                              ไม่อนุมัติ
                            </span>
                          )}

                          {merchant.has_submission ? (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                              ส่งราคาแล้ว
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                              ยังไม่ส่งราคา
                            </span>
                          )}

                          {hasEditableLot && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                              มี Lot ที่แก้ได้
                            </span>
                          )}

                          {merchant.active ? (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                              ใช้งาน
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                              ปิดใช้งาน
                            </span>
                          )}
                        </div>
                      </div>

                      {submittedLots.length > 0 && (
                        <section className="mt-5 rounded-2xl bg-gray-50 p-4">
                          <button
                            type="button"
                            onClick={() => toggleMerchantLots(merchant.id)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                รายการที่ร้านส่งราคา
                              </h4>

                              <p className="mt-1 text-sm text-gray-500">
                                ทั้งหมด {submittedLots.length} Lot • เปิดแก้เฉพาะ Lot ที่ต้องการ
                              </p>
                            </div>

                            <span className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                              {isLotsOpen ? "ซ่อนรายการ" : "ดูรายการ"}
                            </span>
                          </button>

                          {isLotsOpen && (
                            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                              {submittedLots.map((lot) => {
                                const lotKey = `${merchant.id}-${lot.motorcycle_id}`;

                                return (
                                  <div
                                    key={`${merchant.id}-${lot.offer_id}`}
                                    className={
                                      lot.can_edit_lot
                                        ? "rounded-2xl border border-orange-200 bg-orange-50 p-4"
                                        : "rounded-2xl border bg-white p-4"
                                    }
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-gray-500">
                                          Lot {lot.lot_number}
                                        </p>

                                        <p className="font-bold text-gray-900">
                                          {lot.motorcycle_name}
                                        </p>

                                        <p className="mt-1 text-sm text-green-700">
                                          ราคาเดิม:{" "}
                                          {Number(lot.offer_price).toLocaleString()} บาท
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        {lot.can_edit_lot ? (
                                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                                            แก้ไขได้
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                                            ล็อกอยู่
                                          </span>
                                        )}

                                        <button
                                          onClick={() =>
                                            toggleLotEditPermission(merchant, lot)
                                          }
                                          disabled={updatingLotKey === lotKey}
                                          className={
                                            lot.can_edit_lot
                                              ? "rounded-xl bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
                                              : "rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:bg-gray-400"
                                          }
                                        >
                                          {updatingLotKey === lotKey
                                            ? "กำลังอัปเดต..."
                                            : lot.can_edit_lot
                                            ? "ล็อก Lot นี้"
                                            : "ให้แก้ Lot นี้"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      )}

                      {editingId === merchant.id ? (
                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                          <h4 className="font-semibold text-gray-900">
                            แก้ไขข้อมูลร้านค้า
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
                              inputMode="numeric"
                              value={editPhone}
                              onChange={(e) =>
                                setEditPhone(cleanPhone(e.target.value))
                              }
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() => saveEdit(merchant.id)}
                              className="rounded-xl bg-black px-4 py-2 font-semibold text-white"
                            >
                              บันทึก
                            </button>

                            <button
                              onClick={cancelEditing}
                              className="rounded-xl border bg-white px-4 py-2 font-semibold hover:bg-gray-100"
                            >
                              ยกเลิก
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
                            {merchant.is_starred ? "ยกเลิกดาว" : "⭐ ปักดาว"}
                          </button>

                          {merchant.approval_status === "pending" && (
                            <>
                              <button
                                onClick={() => approveMerchant(merchant)}
                                className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                              >
                                อนุมัติ
                              </button>

                              <button
                                onClick={() => rejectMerchant(merchant)}
                                className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                              >
                                ไม่อนุมัติ
                              </button>
                            </>
                          )}

                          {merchant.approval_status === "rejected" && (
                            <button
                              onClick={() => approveMerchant(merchant)}
                              className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                            >
                              อนุมัติอีกครั้ง
                            </button>
                          )}

                          <button
                            onClick={() => startEditing(merchant)}
                            className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                          >
                            แก้ไข
                          </button>

                          <button
                            onClick={() => toggleActive(merchant)}
                            className={
                              merchant.active
                                ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
                                : "rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                            }
                          >
                            {merchant.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </button>

                          {merchant.has_submission && (
                            <button
                              onClick={() => clearMerchantSubmission(merchant)}
                              disabled={clearingId === merchant.id}
                              className="rounded-xl bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:bg-gray-400"
                            >
                              {clearingId === merchant.id
                                ? "กำลังล้าง..."
                                : "ล้างราคาที่ส่ง"}
                            </button>
                          )}

                          <button
                            onClick={() => deleteMerchant(merchant.id)}
                            className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                          >
                            ลบ
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}