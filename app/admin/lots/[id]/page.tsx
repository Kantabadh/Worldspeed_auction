"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  cost_price: number | null;
  active: boolean;
  stock_motorcycle_id: number | null;
  auction_round_id: number | null;
  lot_sale_status: string | null;
  sold_price: number | null;
  sold_to_merchant_id: number | null;
  sold_at: string | null;
  sold_by_email: string | null;
  motorcycle_photos: MotorcyclePhoto[];
};

type LotOffer = {
  id: number;
  merchant_id: number;
  offer_price: number;
  submitted_at: string;
  was_edited: boolean | null;
  original_offer_price: number | null;
  updated_at: string | null;
  merchants: {
    id: number;
    name: string;
    shop_name: string;
    phone: string;
    merchant_account_id: number | string | null;
  } | null;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

function getRank(offers: LotOffer[], index: number) {
  if (index === 0) return 1;

  const currentPrice = Number(offers[index].offer_price);
  const previousPrice = Number(offers[index - 1].offer_price);

  if (currentPrice === previousPrice) {
    return getRank(offers, index - 1);
  }

  return index + 1;
}

function getOfferGroupsByPrice(offers: LotOffer[]) {
  const sortedOffers = [...offers].sort(
    (a, b) => Number(b.offer_price) - Number(a.offer_price)
  );

  const groups: LotOffer[][] = [];

  sortedOffers.forEach((offer) => {
    const lastGroup = groups[groups.length - 1];

    if (
      lastGroup &&
      Number(lastGroup[0].offer_price) === Number(offer.offer_price)
    ) {
      lastGroup.push(offer);
    } else {
      groups.push([offer]);
    }
  });

  return groups;
}

function formatBaht(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toLocaleString()} บาท`;
}

function formatThaiDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getSaleStatusLabel(status?: string | null) {
  if (status === "in_auction") return "อยู่ในรอบประมูล";
  if (status === "sold") return "ขายแล้ว";
  if (status === "unsold") return "กลับเข้าสต็อกแล้ว";
  if (status === "cancelled") return "ยกเลิก";
  return status || "อยู่ในรอบประมูล";
}

function getSavedStaffProfile() {
  const savedProfileText = localStorage.getItem("staffProfile");

  if (!savedProfileText) return null;

  try {
    return JSON.parse(savedProfileText) as StaffProfile;
  } catch {
    return null;
  }
}

export default function LotResultPage() {
  const params = useParams();
  const lotId = Number(params.id);

  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [offers, setOffers] = useState<LotOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowingEditId, setIsAllowingEditId] = useState<number | null>(null);
  const [isSellingOfferId, setIsSellingOfferId] = useState<number | null>(null);
  const [isMarkingUnsold, setIsMarkingUnsold] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function createAuditLog({
    action,
    targetType,
    targetId,
    targetName,
    details,
  }: AuditLogInput) {
    const staffProfile = getSavedStaffProfile();

    const { error } = await supabase.from("admin_audit_logs").insert({
      staff_id: staffProfile?.id || null,
      staff_email: staffProfile?.email || null,
      staff_role: staffProfile?.role || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      target_name: targetName || null,
      details: details || {},
    });

    if (error) {
      console.error("Audit log error:", error.message);
    }
  }

  async function loadLotResult() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: motorcycleData, error: motorcycleError } = await supabase
      .from("motorcycles")
      .select(
        `
        id,
        lot_number,
        motorcycle_name,
        cost_price,
        active,
        stock_motorcycle_id,
        auction_round_id,
        lot_sale_status,
        sold_price,
        sold_to_merchant_id,
        sold_at,
        sold_by_email,
        motorcycle_photos (
          id,
          image_url
        )
      `
      )
      .eq("id", lotId)
      .limit(1);

    if (motorcycleError) {
      setErrorMessage(motorcycleError.message);
      setIsLoading(false);
      return;
    }

    if (!motorcycleData || motorcycleData.length === 0) {
      setErrorMessage("ไม่พบรายการรถนี้");
      setIsLoading(false);
      return;
    }

    setMotorcycle(motorcycleData[0] as Motorcycle);

    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .select(
        `
        id,
        merchant_id,
        offer_price,
        submitted_at,
        was_edited,
        original_offer_price,
        updated_at,
        merchants (
          id,
          name,
          shop_name,
          phone,
          merchant_account_id
        )
      `
      )
      .eq("motorcycle_id", lotId)
      .order("offer_price", { ascending: false });

    if (offerError) {
      setErrorMessage(offerError.message);
      setIsLoading(false);
      return;
    }

    setOffers((offerData as unknown as LotOffer[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!Number.isNaN(lotId)) {
      loadLotResult();
    }
  }, [lotId]);

  const cost = Number(motorcycle?.cost_price || 0);
  const highestPrice = offers.length > 0 ? Number(offers[0].offer_price) : null;
  const highestProfit = highestPrice !== null ? highestPrice - cost : null;

  const topWinnerOffers =
    highestPrice === null
      ? []
      : offers.filter((offer) => Number(offer.offer_price) === highestPrice);

  const hasTieWinner = topWinnerOffers.length >= 2;

  const offerGroups = getOfferGroupsByPrice(offers);
  const topThreeGroups = offerGroups.slice(0, 3);

  const saleStatus = motorcycle?.lot_sale_status || "in_auction";
  const isSold = saleStatus === "sold";
  const isUnsold = saleStatus === "unsold";

  const selectedSoldOffer = useMemo(() => {
    if (!motorcycle?.sold_to_merchant_id) return null;

    return (
      offers.find(
        (offer) => Number(offer.merchant_id) === Number(motorcycle.sold_to_merchant_id)
      ) || null
    );
  }, [motorcycle?.sold_to_merchant_id, offers]);

  async function allowMerchantEdit(offer: LotOffer) {
    const merchantAccountId = offer.merchants?.merchant_account_id;

    if (!merchantAccountId) {
      alert("ไม่พบ merchant_account_id ของร้านค้านี้");
      return;
    }

    const shopName =
      offer.merchants?.shop_name || offer.merchants?.name || "ร้านค้านี้";

    const confirmAllow = confirm(
      `ต้องการเปิดให้ "${shopName}" แก้ไขราคาใช่หรือไม่?`
    );

    if (!confirmAllow) return;

    setIsAllowingEditId(offer.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("merchant_accounts")
      .update({
        can_edit_submission: true,
      })
      .eq("id", merchantAccountId);

    if (error) {
      setErrorMessage(error.message);
      setIsAllowingEditId(null);
      return;
    }

    await createAuditLog({
  action: "merchant_edit_allowed",
  targetType: "offer",
  targetId: String(offer.id),
  targetName: `${shopName} • Lot ${motorcycle?.lot_number || "-"}`,
  details: {
    offer_id: offer.id,
    merchant_id: offer.merchant_id,
    merchant_account_id: merchantAccountId,
    merchant_shop_name: offer.merchants?.shop_name || "",
    merchant_contact_name: offer.merchants?.name || "",
    merchant_phone: offer.merchants?.phone || "",
    motorcycle_id: motorcycle?.id || null,
    auction_round_id: motorcycle?.auction_round_id || null,
    lot_number: motorcycle?.lot_number || "",
    motorcycle_name: motorcycle?.motorcycle_name || "",
    current_offer_price: Number(offer.offer_price || 0),
    permission_after: true,
  },
});

alert(`เปิดให้ ${shopName} แก้ไขราคาแล้ว`);
setIsAllowingEditId(null);
  }

  async function markLotSold(offer: LotOffer) {
    if (!motorcycle) return;

    if (isSold) {
      alert("Lot นี้ถูกบันทึกว่าขายแล้ว");
      return;
    }

    if (isUnsold) {
      alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว ไม่สามารถบันทึกขายซ้ำได้");
      return;
    }

    const { data: existingSoldRecords, error: existingSoldError } =
      await supabase
        .from("sold_motorcycles")
        .select("id")
        .eq("original_motorcycle_id", motorcycle.id)
        .limit(1);

    if (existingSoldError) {
      setErrorMessage(existingSoldError.message);
      return;
    }

    if (existingSoldRecords && existingSoldRecords.length > 0) {
      alert("Lot นี้ถูกบันทึกว่าขายแล้ว");
      await loadLotResult();
      return;
    }

    const staffProfile = getSavedStaffProfile();
    const soldPrice = Number(offer.offer_price || 0);
    const diff = soldPrice - cost;
    const shopName = offer.merchants?.shop_name || offer.merchants?.name || "-";

    const confirmSold = confirm(
      `ยืนยันขาย Lot ${motorcycle.lot_number} ให้ "${shopName}" ใช่หรือไม่?\n\nราคา: ${soldPrice.toLocaleString()} บาท\nกำไรขั้นต้น: ${diff.toLocaleString()} บาท`
    );

    if (!confirmSold) return;

    setIsSellingOfferId(offer.id);
    setErrorMessage("");

    try {
      const { error: soldInsertError } = await supabase
        .from("sold_motorcycles")
        .insert({
          auction_round_id: motorcycle.auction_round_id || null,
          original_motorcycle_id: motorcycle.id,
          original_stock_motorcycle_id: motorcycle.stock_motorcycle_id || null,
          lot_number: motorcycle.lot_number,
          motorcycle_name: motorcycle.motorcycle_name,
          cost_price: cost,
          sold_price: soldPrice,
          diff,
          winner_merchant_id: offer.merchant_id,
          winner_shop_name: offer.merchants?.shop_name || "",
          winner_contact_name: offer.merchants?.name || "",
          winner_phone: offer.merchants?.phone || "",
          sold_by_email: staffProfile?.email || null,
          note: "ขายจากหน้าผลเสนอราคา Lot",
        });

      if (soldInsertError) {
        throw new Error(`บันทึกรถที่ขายแล้วไม่สำเร็จ: ${soldInsertError.message}`);
      }

      const { error: motorcycleUpdateError } = await supabase
        .from("motorcycles")
        .update({
          active: false,
          lot_sale_status: "sold",
          sold_price: soldPrice,
          sold_to_merchant_id: offer.merchant_id,
          sold_at: new Date().toISOString(),
          sold_by_email: staffProfile?.email || null,
        })
        .eq("id", motorcycle.id);

      if (motorcycleUpdateError) {
        throw new Error(`อัปเดต Lot ไม่สำเร็จ: ${motorcycleUpdateError.message}`);
      }

      if (motorcycle.stock_motorcycle_id) {
        const { error: stockUpdateError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "sold",
            current_auction_motorcycle_id: null,
            current_auction_round_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", motorcycle.stock_motorcycle_id);

        if (stockUpdateError) {
          throw new Error(`อัปเดตรถในคลังไม่สำเร็จ: ${stockUpdateError.message}`);
        }
      }

      await createAuditLog({
        action: "lot_marked_sold",
        targetType: "motorcycle",
        targetId: String(motorcycle.id),
        targetName: `Lot ${motorcycle.lot_number} • ${motorcycle.motorcycle_name}`,
        details: {
          motorcycle_id: motorcycle.id,
          stock_motorcycle_id: motorcycle.stock_motorcycle_id,
          auction_round_id: motorcycle.auction_round_id,
          lot_number: motorcycle.lot_number,
          motorcycle_name: motorcycle.motorcycle_name,
          sold_price: soldPrice,
          cost_price: cost,
          diff,
          winner_merchant_id: offer.merchant_id,
          winner_shop_name: offer.merchants?.shop_name || "",
          winner_contact_name: offer.merchants?.name || "",
          winner_phone: offer.merchants?.phone || "",
        },
      });

      alert(`บันทึกขาย Lot ${motorcycle.lot_number} เรียบร้อยแล้ว`);
      await loadLotResult();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "บันทึกขายไม่สำเร็จ";

      setErrorMessage(message);
    }

    setIsSellingOfferId(null);
  }

  async function markLotUnsold() {
    if (!motorcycle) return;

    if (isSold) {
      alert("Lot นี้ขายแล้ว ไม่สามารถย้ายกลับเข้าสต็อกได้จากหน้านี้");
      return;
    }

    if (isUnsold) {
      alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว");
      return;
    }

    const { data: existingUnsoldRecords, error: existingUnsoldError } =
      await supabase
        .from("unsold_motorcycles")
        .select("id")
        .eq("original_motorcycle_id", motorcycle.id)
        .limit(1);

    if (existingUnsoldError) {
      setErrorMessage(existingUnsoldError.message);
      return;
    }

    if (existingUnsoldRecords && existingUnsoldRecords.length > 0) {
      alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว");
      await loadLotResult();
      return;
    }

    const confirmUnsold = confirm(
      `ต้องการปิด Lot ${motorcycle.lot_number} เป็น "ไม่ขาย / กลับเข้าสต็อก" ใช่หรือไม่?\n\nระบบจะซ่อน Lot นี้จากหน้า Merchant และทำให้รถในคลังพร้อมนำไปรอบถัดไป`
    );

    if (!confirmUnsold) return;

    setIsMarkingUnsold(true);
    setErrorMessage("");

    try {
            const staffProfile = getSavedStaffProfile();
      const highestOffer = offers.length > 0 ? offers[0] : null;
      const highestOfferPrice = highestOffer
        ? Number(highestOffer.offer_price || 0)
        : null;
      const diff =
        highestOfferPrice !== null ? highestOfferPrice - cost : null;

      const { error: unsoldInsertError } = await supabase
        .from("unsold_motorcycles")
        .insert({
          auction_round_id: motorcycle.auction_round_id || null,
          original_motorcycle_id: motorcycle.id,
          original_stock_motorcycle_id: motorcycle.stock_motorcycle_id || null,
          lot_number: motorcycle.lot_number,
          motorcycle_name: motorcycle.motorcycle_name,
          cost_price: cost,
          highest_offer: highestOfferPrice,
          diff,
          highest_merchant_id: highestOffer?.merchant_id || null,
          highest_shop_name: highestOffer?.merchants?.shop_name || "",
          highest_contact_name: highestOffer?.merchants?.name || "",
          highest_phone: highestOffer?.merchants?.phone || "",
          returned_by_email: staffProfile?.email || null,
          note: "ไม่ขาย / กลับเข้าสต็อกจากหน้าผลเสนอราคา Lot",
        });

      if (unsoldInsertError) {
        throw new Error(
          `บันทึกรถที่กลับเข้าสต็อกไม่สำเร็จ: ${unsoldInsertError.message}`
        );
      }
      
      const { error: motorcycleUpdateError } = await supabase
        .from("motorcycles")
        .update({
          active: false,
          lot_sale_status: "unsold",
          sold_price: null,
          sold_to_merchant_id: null,
          sold_at: null,
          sold_by_email: null,
        })
        .eq("id", motorcycle.id);

      if (motorcycleUpdateError) {
        throw new Error(`อัปเดต Lot ไม่สำเร็จ: ${motorcycleUpdateError.message}`);
      }

      if (motorcycle.stock_motorcycle_id) {
        const { error: stockUpdateError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "ready_to_sell",
            current_auction_motorcycle_id: null,
            current_auction_round_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", motorcycle.stock_motorcycle_id);

        if (stockUpdateError) {
          throw new Error(`อัปเดตรถในคลังไม่สำเร็จ: ${stockUpdateError.message}`);
        }
      }

      await createAuditLog({
        action: "lot_marked_unsold",
        targetType: "motorcycle",
        targetId: String(motorcycle.id),
        targetName: `Lot ${motorcycle.lot_number} • ${motorcycle.motorcycle_name}`,
        details: {
          motorcycle_id: motorcycle.id,
          stock_motorcycle_id: motorcycle.stock_motorcycle_id,
          auction_round_id: motorcycle.auction_round_id,
          lot_number: motorcycle.lot_number,
          motorcycle_name: motorcycle.motorcycle_name,
          status_after: "unsold",
          stock_status_after: "ready_to_sell",
        },
      });

      alert(`ปิด Lot ${motorcycle.lot_number} และส่งกลับเข้าสต็อกเรียบร้อยแล้ว`);
      await loadLotResult();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ส่งกลับเข้าสต็อกไม่สำเร็จ";

      setErrorMessage(message);
    }

    setIsMarkingUnsold(false);
  }

  function exportLotOffersCsv() {
    if (!motorcycle) return;

    const headers = [
      "อันดับ",
      "Lot",
      "รายการรถ",
      "สถานะขาย",
      "ต้นทุน",
      "ราคาเสนอ",
      "กำไรขั้นต้น",
      "ผู้ติดต่อ",
      "ร้านค้า",
      "โทร",
      "แก้ไขแล้ว",
      "ราคาเดิม",
      "เวลาส่ง",
    ];

    const rows = offers.map((offer, index) => {
      const offerPrice = Number(offer.offer_price || 0);

      return [
        getRank(offers, index),
        motorcycle.lot_number,
        motorcycle.motorcycle_name,
        getSaleStatusLabel(motorcycle.lot_sale_status),
        cost || "",
        offerPrice,
        cost ? offerPrice - cost : "",
        offer.merchants?.name || "",
        offer.merchants?.shop_name || "",
        offer.merchants?.phone || "",
        offer.was_edited ? "แก้ไขแล้ว" : "",
        offer.original_offer_price || "",
        new Date(offer.submitted_at).toLocaleString("th-TH"),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `lot-${motorcycle.lot_number}-offers.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function renderMobileOfferCard(offer: LotOffer, index: number) {
    const rank = getRank(offers, index);
    const offerPrice = Number(offer.offer_price || 0);
    const profit = offerPrice - cost;
    const isTopWinner = highestPrice !== null && offerPrice === highestPrice;
    const isSoldWinner =
      isSold && Number(motorcycle?.sold_to_merchant_id) === Number(offer.merchant_id);

    return (
      <article
        key={offer.id}
        className={
          isSoldWinner
            ? "rounded-2xl border border-purple-200 bg-purple-50 p-4 shadow-sm"
            : isTopWinner
            ? "rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm"
            : "rounded-2xl border bg-white p-4 shadow-sm"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={
                isSoldWinner
                  ? "text-sm font-bold text-purple-700"
                  : isTopWinner
                  ? "text-sm font-bold text-green-700"
                  : "text-sm font-bold text-gray-700"
              }
            >
              อันดับ {rank === 1 ? "1 🏆" : rank}
              {isSoldWinner ? " • ขายแล้ว" : ""}
            </p>

            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {offer.merchants?.shop_name || "-"}
            </h3>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">ราคาเสนอ</p>
            <p className="text-xl font-bold text-green-700">
              {offerPrice.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">บาท</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-xl bg-white/80 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">ผู้ติดต่อ</span>
            <span className="font-medium text-gray-900">
              {offer.merchants?.name || "-"}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-gray-500">โทร</span>
            <span className="font-medium text-gray-900">
              {offer.merchants?.phone || "-"}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-gray-500">กำไรขั้นต้น</span>
            <span
              className={
                cost && profit >= 0
                  ? "font-bold text-green-700"
                  : "font-bold text-red-700"
              }
            >
              {cost ? `${profit.toLocaleString()} บาท` : "-"}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-gray-500">เวลาส่ง</span>
            <span className="text-right font-medium text-gray-900">
              {formatThaiDateTime(offer.updated_at || offer.submitted_at)}
            </span>
          </div>

          {offer.was_edited && (
            <div className="rounded-xl bg-yellow-100 px-3 py-2 text-xs font-bold text-yellow-800">
              แก้ไขแล้ว
              {offer.original_offer_price
                ? ` • เดิม ${Number(offer.original_offer_price).toLocaleString()} บาท`
                : ""}
            </div>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => markLotSold(offer)}
            disabled={isSold || isUnsold || isSellingOfferId === offer.id}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSellingOfferId === offer.id ? "กำลังขาย..." : "ขายให้ร้านนี้"}
          </button>

          <button
            onClick={() => allowMerchantEdit(offer)}
            disabled={isSold || isUnsold || isAllowingEditId === offer.id}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAllowingEditId === offer.id
              ? "กำลังเปิดให้แก้..."
              : "เปิดให้แก้ราคา"}
          </button>
        </div>
      </article>
    );
  }

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <p className="text-gray-600">กำลังโหลดผลรายการ...</p>
            </div>
          )}

          {!isLoading && motorcycle && (
            <>
              <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                      ผลเสนอราคา
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-gray-900">
                      Lot {motorcycle.lot_number}
                    </h1>

                    <p className="mt-1 text-lg text-gray-700">
                      {motorcycle.motorcycle_name}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-orange-700">
                      ต้นทุน: {cost ? formatBaht(cost) : "-"}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {isSold ? (
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                        ขายแล้ว
                      </span>
                    ) : isUnsold ? (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                        กลับเข้าสต็อกแล้ว
                      </span>
                    ) : motorcycle.active ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                        แสดงอยู่
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                        ซ่อนอยู่
                      </span>
                    )}

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {getSaleStatusLabel(saleStatus)}
                    </span>
                  </div>
                </div>

                {motorcycle.motorcycle_photos?.length > 0 && (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {motorcycle.motorcycle_photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.image_url}
                        alt={motorcycle.motorcycle_name}
                        className="h-32 w-full rounded-2xl bg-white object-contain ring-1 ring-gray-200"
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                  <p className="text-sm font-medium text-gray-500">
                    จำนวนร้านที่เสนอ
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {offers.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                  <p className="text-sm font-medium text-gray-500">ต้นทุน</p>
                  <p className="mt-2 break-words text-2xl font-bold text-orange-700">
                    {cost ? cost.toLocaleString() : "-"}
                  </p>
                  {cost > 0 && <p className="text-sm text-gray-500">บาท</p>}
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                  <p className="text-sm font-medium text-gray-500">
                    ราคาสูงสุด
                  </p>
                  <p className="mt-2 break-words text-2xl font-bold text-green-700">
                    {highestPrice !== null
                      ? highestPrice.toLocaleString()
                      : "ยังไม่มีราคา"}
                  </p>
                  {highestPrice !== null && (
                    <p className="text-sm text-gray-500">บาท</p>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                  <p className="text-sm font-medium text-gray-500">
                    กำไรขั้นต้น
                  </p>
                  <p
                    className={
                      highestProfit !== null && highestProfit >= 0
                        ? "mt-2 break-words text-2xl font-bold text-green-700"
                        : "mt-2 break-words text-2xl font-bold text-red-700"
                    }
                  >
                    {cost && highestProfit !== null
                      ? highestProfit.toLocaleString()
                      : "-"}
                  </p>
                  {cost > 0 && highestProfit !== null && (
                    <p className="text-sm text-gray-500">บาท</p>
                  )}
                </div>
              </section>

              <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      จัดการสถานะขาย
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      ใช้ปิด Lot หลังตัดสินใจขาย หรือส่งรถกลับเข้าสต็อกถ้าไม่ขาย
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                    {getSaleStatusLabel(saleStatus)}
                  </span>
                </div>

                {isSold ? (
                  <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-purple-800">
                    <p className="font-bold">Lot นี้ขายแล้ว</p>
                    <p className="mt-1 text-sm">
                      ราคา: {formatBaht(motorcycle.sold_price)} • ร้าน:{" "}
                      {selectedSoldOffer?.merchants?.shop_name || "-"} • เวลา:{" "}
                      {formatThaiDateTime(motorcycle.sold_at)}
                    </p>
                  </div>
                ) : isUnsold ? (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                    <p className="font-bold">Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว</p>
                    <p className="mt-1 text-sm">
                      สามารถนำรถจากคลังเข้าสู่รอบถัดไปได้
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (topWinnerOffers.length === 1) {
                          markLotSold(topWinnerOffers[0]);
                          return;
                        }

                        alert(
                          "อันดับ 1 มีมากกว่า 1 ร้าน กรุณาเลือกขายให้ร้านจากตารางด้านล่าง"
                        );
                      }}
                      disabled={
                        offers.length === 0 ||
                        topWinnerOffers.length !== 1 ||
                        isSellingOfferId !== null
                      }
                      className="rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      ยืนยันขายให้ร้านอันดับ 1
                    </button>

                    <button
                      onClick={markLotUnsold}
                      disabled={isMarkingUnsold}
                      className="rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-3 font-semibold text-yellow-800 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isMarkingUnsold
                        ? "กำลังส่งกลับ..."
                        : "ไม่ขาย / กลับเข้าสต็อก"}
                    </button>
                  </div>
                )}
              </section>

              {topThreeGroups.length > 0 && (
                <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                  <h2 className="text-xl font-bold text-gray-900">
                    อันดับ 1-3
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    หากราคาเท่ากัน ระบบจะแสดงเป็นอันดับร่วม
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {topThreeGroups.map((group, groupIndex) => {
                      const rank = groupIndex + 1;
                      const groupPrice = Number(group[0].offer_price || 0);
                      const profit = groupPrice - cost;

                      return (
                        <div
                          key={rank}
                          className={
                            rank === 1
                              ? "rounded-2xl border border-green-200 bg-green-50 p-4"
                              : "rounded-2xl border bg-gray-50 p-4"
                          }
                        >
                          <p
                            className={
                              rank === 1
                                ? "text-sm font-semibold text-green-700"
                                : "text-sm font-semibold text-gray-600"
                            }
                          >
                            อันดับ {rank}
                            {group.length >= 2
                              ? ` ร่วม ${group.length} ราย`
                              : ""}
                          </p>

                          <p className="mt-2 text-xl font-bold text-gray-900">
                            {groupPrice.toLocaleString()} บาท
                          </p>

                          <p
                            className={
                              cost && profit >= 0
                                ? "mt-1 text-sm font-semibold text-green-700"
                                : "mt-1 text-sm font-semibold text-red-700"
                            }
                          >
                            กำไร: {cost ? formatBaht(profit) : "-"}
                          </p>

                          <div className="mt-3 space-y-2">
                            {group.map((offer) => (
                              <div
                                key={offer.id}
                                className="rounded-xl bg-white p-3"
                              >
                                <p className="font-semibold text-gray-900">
                                  {offer.merchants?.shop_name || "-"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {offer.merchants?.name || "-"} •{" "}
                                  {offer.merchants?.phone || "-"}
                                </p>

                                <div className="mt-2 grid gap-2">
                                  <button
                                    onClick={() => markLotSold(offer)}
                                    disabled={isSold || isUnsold || isSellingOfferId === offer.id}
                                    className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                  >
                                    {isSellingOfferId === offer.id
                                      ? "กำลังขาย..."
                                      : "ขายให้ร้านนี้"}
                                  </button>

                                  <button
                                    onClick={() => allowMerchantEdit(offer)}
                                    disabled={isSold || isUnsold || isAllowingEditId === offer.id}
                                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isAllowingEditId === offer.id
                                      ? "กำลังเปิด..."
                                      : "เปิดให้แก้ราคา"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {hasTieWinner && !isSold && !isUnsold && (
                <section className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-5 text-orange-800">
                  <p className="text-lg font-bold">
                    มีผู้เสนอราคาสูงสุดเท่ากัน {topWinnerOffers.length} ราย
                  </p>

                  <p className="mt-1 text-sm">
                    ระบบจะแสดงเป็นอันดับ 1 ทั้งหมด กรุณาเลือกขายให้ร้านจากรายการด้านล่าง
                  </p>
                </section>
              )}

              <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      รายการเสนอราคา Lot {motorcycle.lot_number}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      เรียงจากราคาสูงสุดไปต่ำสุด
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={loadLotResult}
                      className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                    >
                      โหลดใหม่
                    </button>

                    {offers.length > 0 && (
                      <button
                        onClick={exportLotOffersCsv}
                        className="rounded-xl bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
                      >
                        ดาวน์โหลด CSV
                      </button>
                    )}
                  </div>
                </div>

                {offers.length === 0 ? (
                  <div className="mt-5 rounded-2xl bg-gray-50 p-5">
                    <p className="text-gray-600">
                      ยังไม่มีร้านค้าเสนอราคาสำหรับ Lot นี้
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 space-y-3 md:hidden">
                      {offers.map((offer, index) =>
                        renderMobileOfferCard(offer, index)
                      )}
                    </div>

                    <div className="mt-5 hidden overflow-x-auto md:block">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b bg-gray-100 text-gray-700">
                            <th className="p-3">อันดับ</th>
                            <th className="p-3">ราคา</th>
                            <th className="p-3">กำไรขั้นต้น</th>
                            <th className="p-3">ผู้ติดต่อ</th>
                            <th className="p-3">ร้าน</th>
                            <th className="p-3">โทร</th>
                            <th className="p-3">สถานะ</th>
                            <th className="p-3">เวลาส่ง</th>
                            <th className="p-3">จัดการ</th>
                          </tr>
                        </thead>

                        <tbody>
                          {offers.map((offer, index) => {
                            const rank = getRank(offers, index);
                            const offerPrice = Number(offer.offer_price || 0);
                            const profit = offerPrice - cost;
                            const isTopWinner =
                              highestPrice !== null &&
                              offerPrice === highestPrice;
                            const isSoldWinner =
                              isSold &&
                              Number(motorcycle.sold_to_merchant_id) ===
                                Number(offer.merchant_id);

                            return (
                              <tr
                                key={offer.id}
                                className={
                                  isSoldWinner
                                    ? "border-b bg-purple-50"
                                    : isTopWinner
                                    ? "border-b bg-green-50"
                                    : "border-b"
                                }
                              >
                                <td className="p-3 font-bold">
                                  {rank === 1 ? "1 🏆" : rank}
                                </td>

                                <td className="p-3 font-bold text-green-700">
                                  {offerPrice.toLocaleString()} บาท
                                </td>

                                <td
                                  className={
                                    cost && profit >= 0
                                      ? "p-3 font-bold text-green-700"
                                      : "p-3 font-bold text-red-700"
                                  }
                                >
                                  {cost
                                    ? `${profit.toLocaleString()} บาท`
                                    : "-"}
                                </td>

                                <td className="p-3">
                                  {offer.merchants?.name || "-"}
                                </td>

                                <td className="p-3 font-medium">
                                  {offer.merchants?.shop_name || "-"}
                                </td>

                                <td className="p-3">
                                  {offer.merchants?.phone || "-"}
                                </td>

                                <td className="p-3">
                                  {isSoldWinner ? (
                                    <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">
                                      ขายแล้ว
                                    </span>
                                  ) : offer.was_edited ? (
                                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-800">
                                      แก้ไขแล้ว
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>

                                <td className="p-3">
                                  {formatThaiDateTime(
                                    offer.updated_at || offer.submitted_at
                                  )}
                                </td>

                                <td className="p-3">
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => markLotSold(offer)}
                                      disabled={
                                        isSold ||
                                        isUnsold ||
                                        isSellingOfferId === offer.id
                                      }
                                      className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                      {isSellingOfferId === offer.id
                                        ? "กำลังขาย..."
                                        : "ขายให้ร้านนี้"}
                                    </button>

                                    <button
                                      onClick={() => allowMerchantEdit(offer)}
                                      disabled={
                                        isSold ||
                                        isUnsold ||
                                        isAllowingEditId === offer.id
                                      }
                                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isAllowingEditId === offer.id
                                        ? "กำลังเปิด..."
                                        : "เปิดให้แก้ราคา"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </section>
      </main>
    </StaffGuard>
  );
}
