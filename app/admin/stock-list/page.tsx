"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type StockPhoto = {
  id: number;
  image_url: string;
};

type StockStatus =
  | "in_stock"
  | "อยู่ในสต็อก"
  | "repairing"
  | "ready_to_sell"
  | "in_auction"
  | "อยู่ในรอบเสนอราคา"
  | "sold"
  | "ขายแล้ว"
  | "cancelled";

type StatusFilter = "all" | "in_stock" | "in_auction" | "sold";

type StockMotorcycle = {
  id: number;
  stock_number: string | null;
  motorcycle_name: string;
  cost_price: number | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  license_plate: string | null;
  mileage: string | null;
  frame_number: string | null;
  engine_number: string | null;
  registration_status: string | null;
  tax_expiry: string | null;
  condition: string | null;
  notes: string | null;
  purchase_date: string | null;
  acquisition_type: string | null;
  source_name: string | null;
  repair_notes: string | null;
  stock_status: StockStatus;
  current_auction_motorcycle_id: number | null;
  current_auction_round_id: number | null;
  created_at: string;
  updated_at: string | null;
  stock_motorcycle_photos: StockPhoto[];
};

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
};

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

type RoundMotorcycle = {
  id: number;
  stock_motorcycle_id: number | null;
  brand: string | null;
  model: string | null;
  frame_number: string | null;
  motorcycle_name: string | null;
  lot_number: string | null;
  cost_price: number | null;
  year: string | null;
  license_plate: string | null;
  engine_number: string | null;
  purchase_date: string | null;
  acquisition_type: string | null;
  source_name: string | null;
};

const statusLabels: Record<string, string> = {
  in_stock: "อยู่ในสต็อก",
  "อยู่ในสต็อก": "อยู่ในสต็อก",
  repairing: "กำลังซ่อม",
  ready_to_sell: "พร้อมขาย",
  in_auction: "อยู่ในรอบเสนอราคา",
  "อยู่ในรอบเสนอราคา": "อยู่ในรอบเสนอราคา",
  sold: "ขายแล้ว",
  "ขายแล้ว": "ขายแล้ว",
  cancelled: "ยกเลิก",
};

const statusBadges: Record<string, string> = {
  in_stock: "bg-gray-100 text-gray-700",
  repairing: "bg-yellow-100 text-yellow-700",
  ready_to_sell: "bg-green-100 text-green-700",
  in_auction: "bg-blue-100 text-blue-700",
  "อยู่ในรอบเสนอราคา": "bg-blue-100 text-blue-700",
  sold: "bg-purple-100 text-purple-700",
  "ขายแล้ว": "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "in_stock", label: "พร้อมเลือกรอบ" },
  { value: "in_auction", label: "อยู่ในรอบเสนอราคา" },
  { value: "sold", label: "ขายแล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

function getStatusLabel(status: string | null | undefined) {
  return status ? statusLabels[status] || status : "-";
}

function getStockLocationLabel(bike: StockMotorcycle) {
  if (bike.stock_status === "sold" || bike.stock_status === "ขายแล้ว") {
    return "ขายแล้ว";
  }

  if (bike.current_auction_round_id || bike.current_auction_motorcycle_id) {
    return "อยู่ในรอบเสนอราคา";
  }

  return "อยู่ในสต็อก";
}

function getStockLocationBadge(bike: StockMotorcycle) {
  if (bike.stock_status === "sold" || bike.stock_status === "ขายแล้ว") {
    return "bg-purple-100 text-purple-700";
  }

  if (bike.current_auction_round_id || bike.current_auction_motorcycle_id) {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-gray-100 text-gray-700";
}

function isAvailableStockBike(bike: StockMotorcycle) {
  const isInStockStatus =
    bike.stock_status === "อยู่ในสต็อก" || bike.stock_status === "in_stock";

  return (
    isInStockStatus &&
    bike.current_auction_round_id === null &&
    bike.current_auction_motorcycle_id === null
  );
}

function getRoundStatusLabel(status?: string | null) {
  if (status === "draft") return "เตรียมรอบ";
  if (status === "open") return "เปิดรับราคา";
  if (status === "closed") return "ปิดรับราคา";
  if (status === "finished") return "จบรอบแล้ว";
  if (status === "archived") return "บันทึกประวัติแล้ว";
  return status || "-";
}

function formatBaht(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toLocaleString()} บาท`;
}

function formatThaiDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "เกิดข้อผิดพลาดระหว่างส่งเข้ารอบเสนอราคา";
}

function canSendStockBikeToRound(bike: StockMotorcycle) {
  return isAvailableStockBike(bike);
}

function formatRoundLotNumber(index: number) {
  return String(index + 1).padStart(3, "0");
}

function sortRoundMotorcycles(items: RoundMotorcycle[]) {
  return [...items].sort((a, b) => {
    return [a.brand, a.model, a.frame_number]
      .join(" ")
      .localeCompare([b.brand, b.model, b.frame_number].join(" "), "th", {
        numeric: true,
        sensitivity: "base",
      });
  });
}

export default function AdminStockListPage() {
  const [stockMotorcycles, setStockMotorcycles] = useState<StockMotorcycle[]>(
    []
  );
  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("in_stock");
  const [returnedStockIds, setReturnedStockIds] = useState<Set<number>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  function getStockTargetName(bike: StockMotorcycle) {
    return `${bike.stock_number || "ไม่มีเลขสต็อก"} • ${bike.motorcycle_name}`;
  }

  function getStockDetailPayload(bike: StockMotorcycle) {
    return {
      stock_motorcycle_id: bike.id,
      stock_number: bike.stock_number || "",
      motorcycle_name: bike.motorcycle_name,
      cost_price: Number(bike.cost_price || 0),
      brand: bike.brand || "",
      model: bike.model || "",
      year: bike.year || "",
      color: bike.color || "",
      license_plate: bike.license_plate || "",
      mileage: bike.mileage || "",
      frame_number: bike.frame_number || "",
      engine_number: bike.engine_number || "",
      registration_status: bike.registration_status || "",
      tax_expiry: bike.tax_expiry || "",
      condition: bike.condition || "",
      notes: bike.notes || "",
      purchase_date: bike.purchase_date || "",
      acquisition_type: bike.acquisition_type || "",
      source_name: bike.source_name || "",
      repair_notes: bike.repair_notes || "",
      stock_status: bike.stock_status,
      stock_status_thai: getStatusLabel(bike.stock_status),
      current_auction_motorcycle_id: bike.current_auction_motorcycle_id,
      current_auction_round_id: bike.current_auction_round_id,
      photo_count: bike.stock_motorcycle_photos?.length || 0,
    };
  }

  async function loadCurrentAuctionRound() {
    const { data, error } = await supabase
      .from("auction_rounds")
      .select("id, round_name, auction_date, status, is_current")
      .eq("is_current", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setCurrentRound(null);
      return null;
    }

    const round = (data as CurrentAuctionRound) || null;
    setCurrentRound(round);
    return round;
  }

  async function loadStockMotorcycles() {
    const { data, error } = await supabase
      .from("stock_motorcycles")
      .select(
        `
        id,
        stock_number,
        motorcycle_name,
        cost_price,
        brand,
        model,
        year,
        color,
        license_plate,
        mileage,
        frame_number,
        engine_number,
        registration_status,
        tax_expiry,
        condition,
        notes,
        purchase_date,
        acquisition_type,
        source_name,
        repair_notes,
        stock_status,
        current_auction_motorcycle_id,
        current_auction_round_id,
        created_at,
        updated_at,
        stock_motorcycle_photos (
          id,
          image_url
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStockMotorcycles((data as StockMotorcycle[]) || []);
  }

  async function loadReturnedStockIds() {
    const { data, error } = await supabase
      .from("unsold_motorcycles")
      .select("original_stock_motorcycle_id");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setReturnedStockIds(
      new Set(
        ((data || []) as { original_stock_motorcycle_id: number | null }[])
          .map((item) => item.original_stock_motorcycle_id)
          .filter((id): id is number => typeof id === "number")
      )
    );
  }

  async function loadPageData() {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    await Promise.all([
      loadCurrentAuctionRound(),
      loadStockMotorcycles(),
      loadReturnedStockIds(),
    ]);

    setIsLoading(false);
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter]);

  const filteredStockMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return stockMotorcycles.filter((bike) => {
      if (statusFilter === "in_stock" && !isAvailableStockBike(bike)) {
        return false;
      }

      if (
        statusFilter === "in_auction" &&
        getStockLocationLabel(bike) !== "อยู่ในรอบเสนอราคา"
      ) {
        return false;
      }

      if (statusFilter === "sold" && getStockLocationLabel(bike) !== "ขายแล้ว") {
        return false;
      }

      if (!keyword) return true;

      const searchableText = [
        bike.stock_number,
        bike.motorcycle_name,
        bike.brand,
        bike.model,
        bike.year,
        bike.license_plate,
        bike.frame_number,
        bike.acquisition_type,
        bike.source_name,
        getStockLocationLabel(bike),
        getStatusLabel(bike.stock_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [stockMotorcycles, searchText, statusFilter, returnedStockIds]);

  const selectableIds = filteredStockMotorcycles
    .filter((bike) => statusFilter === "in_stock" && canSendStockBikeToRound(bike))
    .map((bike) => bike.id);

  function toggleSelection(stockMotorcycleId: number) {
    if (statusFilter !== "in_stock") return;

    const bike = stockMotorcycles.find((item) => item.id === stockMotorcycleId);

    if (!bike || !canSendStockBikeToRound(bike)) return;

    setSelectedIds((current) =>
      current.includes(stockMotorcycleId)
        ? current.filter((id) => id !== stockMotorcycleId)
        : [...current, stockMotorcycleId]
    );
  }

  function toggleAllVisible() {
    const allSelected = selectableIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !selectableIds.includes(id))
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...selectableIds])));
  }

  async function roundHasSubmittedOffers(roundId: number) {
    const { data, error } = await supabase
      .from("offers")
      .select("id")
      .eq("auction_round_id", roundId)
      .limit(1);

    if (error) throw error;

    return Boolean(data && data.length > 0);
  }

  async function syncAuctionRoundLotOrder(roundId: number) {
    const { data, error } = await supabase
      .from("motorcycles")
      .select(
        `
        id,
        stock_motorcycle_id,
        brand,
        model,
        frame_number,
        motorcycle_name,
        lot_number,
        cost_price,
        year,
        license_plate,
        engine_number,
        purchase_date,
        acquisition_type,
        source_name
      `
      )
      .eq("auction_round_id", roundId);

    if (error) throw error;

    const sortedMotorcycles = sortRoundMotorcycles(
      (data as RoundMotorcycle[]) || []
    );

    for (const [index, motorcycle] of sortedMotorcycles.entries()) {
      const roundLotNumber = formatRoundLotNumber(index);

      const { error: motorcycleUpdateError } = await supabase
        .from("motorcycles")
        .update({ lot_number: roundLotNumber })
        .eq("id", motorcycle.id);

      if (motorcycleUpdateError) throw motorcycleUpdateError;

      const { data: existingRows, error: existingRowsError } = await supabase
        .from("auction_round_lots")
        .select("id")
        .eq("auction_round_id", roundId)
        .eq("original_motorcycle_id", motorcycle.id)
        .limit(1);

      if (existingRowsError) throw existingRowsError;

      const lotPayload = {
        auction_round_id: roundId,
        original_motorcycle_id: motorcycle.id,
        stock_motorcycle_id: motorcycle.stock_motorcycle_id || null,
        lot_number: roundLotNumber,
        round_lot_number: roundLotNumber,
        sort_order: index + 1,
        motorcycle_name: motorcycle.motorcycle_name,
        cost_price: motorcycle.cost_price,
        brand: motorcycle.brand,
        model: motorcycle.model,
        year: motorcycle.year,
        license_plate: motorcycle.license_plate,
        frame_number: motorcycle.frame_number,
        engine_number: motorcycle.engine_number,
        purchase_date: motorcycle.purchase_date,
        acquisition_type: motorcycle.acquisition_type,
        source_name: motorcycle.source_name,
      };

      const fallbackPayload = {
        auction_round_id: roundId,
        original_motorcycle_id: motorcycle.id,
        lot_number: roundLotNumber,
        motorcycle_name: motorcycle.motorcycle_name,
        cost_price: motorcycle.cost_price,
        brand: motorcycle.brand,
        model: motorcycle.model,
        year: motorcycle.year,
        license_plate: motorcycle.license_plate,
        frame_number: motorcycle.frame_number,
        engine_number: motorcycle.engine_number,
        purchase_date: motorcycle.purchase_date,
        acquisition_type: motorcycle.acquisition_type,
        source_name: motorcycle.source_name,
      };

      const existingId = existingRows?.[0]?.id;

      if (existingId) {
        const { error: updateError } = await supabase
          .from("auction_round_lots")
          .update(lotPayload)
          .eq("id", existingId);

        if (updateError) {
          const { error: fallbackUpdateError } = await supabase
            .from("auction_round_lots")
            .update(fallbackPayload)
            .eq("id", existingId);

          if (fallbackUpdateError) throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("auction_round_lots")
          .insert(lotPayload);

        if (insertError) {
          const { error: fallbackInsertError } = await supabase
            .from("auction_round_lots")
            .insert(fallbackPayload);

          if (fallbackInsertError) throw insertError;
        }
      }
    }

    return sortedMotorcycles.length;
  }

  async function sendSelectedToRound() {
    if (!currentRound) {
      setErrorMessage("ยังไม่มีรอบเสนอราคาปัจจุบัน");
      return;
    }

    if (
      currentRound.status === "closed" ||
      currentRound.status === "finished" ||
      currentRound.status === "archived"
    ) {
      setErrorMessage("รอบเสนอราคาปัจจุบันปิดแล้ว กรุณาเปิดรอบหรือสร้างรอบใหม่ก่อน");
      return;
    }

    const selectedBikes = stockMotorcycles.filter((bike) =>
      selectedIds.includes(bike.id)
    );

    if (selectedBikes.length === 0) {
      setErrorMessage("กรุณาเลือกรถก่อนส่งเข้ารอบเสนอราคา");
      return;
    }

    const sendableBikes = selectedBikes.filter((bike) =>
      canSendStockBikeToRound(bike)
    );

    if (sendableBikes.length === 0) {
      setErrorMessage("รถที่เลือกอยู่ในรอบเสนอราคาแล้วหรือยังไม่พร้อมส่งเข้ารอบ");
      return;
    }

    const roundName = currentRound.round_name || `รอบ #${currentRound.id}`;

    const confirmSend = confirm(
      `ต้องการส่งรถ ${sendableBikes.length} คันเข้ารอบ "${roundName}" ใช่หรือไม่?`
    );

    if (!confirmSend) return;

    setIsSending(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const hasSubmittedOffers = await roundHasSubmittedOffers(currentRound.id);

      if (hasSubmittedOffers) {
        const confirmRegenerate = confirm(
          "รอบนี้มีร้านค้าส่งราคาแล้ว การจัดเรียงล็อตใหม่อาจทำให้สับสน ต้องการดำเนินการต่อหรือไม่?"
        );

        if (!confirmRegenerate) {
          setIsSending(false);
          return;
        }
      }

      const { data: existingLots, error: existingError } = await supabase
        .from("motorcycles")
        .select("stock_motorcycle_id")
        .eq("auction_round_id", currentRound.id)
        .in(
          "stock_motorcycle_id",
          sendableBikes.map((bike) => bike.id)
        );

      if (existingError) throw existingError;

      const existingStockIds = new Set(
        (existingLots || [])
          .map((item) => item.stock_motorcycle_id)
          .filter((id): id is number => typeof id === "number")
      );

      const bikesToSend = sendableBikes.filter(
        (bike) => !existingStockIds.has(bike.id)
      );

      const { count: existingRoundCount, error: countError } = await supabase
        .from("motorcycles")
        .select("id", { count: "exact", head: true })
        .eq("auction_round_id", currentRound.id);

      if (countError) throw countError;

      let sentCount = 0;

      for (const [index, bike] of bikesToSend.entries()) {
        const firstPhoto = bike.stock_motorcycle_photos?.[0]?.image_url || null;
        const initialRoundLotNumber = formatRoundLotNumber(
          Number(existingRoundCount || 0) + index
        );

        const { data: auctionMotorcycle, error: auctionError } = await supabase
          .from("motorcycles")
          .insert({
            lot_number: initialRoundLotNumber,
            motorcycle_name: bike.motorcycle_name,
            cost_price: bike.cost_price,
            brand: bike.brand || null,
            model: bike.model || null,
            year: bike.year || null,
            color: bike.color || null,
            license_plate: bike.license_plate || null,
            mileage: bike.mileage || null,
            frame_number: bike.frame_number || null,
            engine_number: bike.engine_number || null,
            registration_status: bike.registration_status || null,
            tax_expiry: bike.tax_expiry || null,
            condition: bike.condition || null,
            notes: bike.notes || null,
            purchase_date: bike.purchase_date || null,
            acquisition_type: bike.acquisition_type || null,
            source_name: bike.source_name || null,
            repair_notes: bike.repair_notes || null,
            active: true,
            image_url: firstPhoto,
            stock_motorcycle_id: bike.id,
            auction_round_id: currentRound.id,
            lot_sale_status: "in_auction",
          })
          .select()
          .single();

        if (auctionError) throw auctionError;

        if (bike.stock_motorcycle_photos?.length > 0) {
          const auctionPhotoRows = bike.stock_motorcycle_photos.map((photo) => ({
            motorcycle_id: auctionMotorcycle.id,
            image_url: photo.image_url,
          }));

          const { error: photoCopyError } = await supabase
            .from("motorcycle_photos")
            .insert(auctionPhotoRows);

          if (photoCopyError) throw photoCopyError;
        }

        const { error: stockUpdateError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "อยู่ในรอบเสนอราคา",
            current_auction_motorcycle_id: auctionMotorcycle.id,
            current_auction_round_id: currentRound.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bike.id);

        if (stockUpdateError) throw stockUpdateError;

        await createAuditLog({
          action: "stock_motorcycle_sent_to_auction_round",
          targetType: "stock_motorcycle",
          targetId: String(bike.id),
          targetName: getStockTargetName(bike),
          details: {
            stock: getStockDetailPayload(bike),
            auction_motorcycle_id: auctionMotorcycle.id,
            auction_round_id: currentRound.id,
            auction_round_name: roundName,
            lot_number: initialRoundLotNumber,
            copied_photo_count: bike.stock_motorcycle_photos?.length || 0,
          },
        });

        sentCount += 1;
      }

      setSelectedIds([]);
      const sortedLotCount = await syncAuctionRoundLotOrder(currentRound.id);
      await loadStockMotorcycles();

      const skippedCount = sendableBikes.length - bikesToSend.length;
      setSuccessMessage(
        skippedCount > 0
          ? `ส่งรถเข้ารอบเสนอราคาแล้ว ${sentCount} คัน ข้ามรายการซ้ำ ${skippedCount} คัน และจัดเรียงล็อต ${sortedLotCount} คัน`
          : `ส่งรถเข้ารอบเสนอราคาแล้ว ${sentCount} คัน และจัดเรียงล็อต ${sortedLotCount} คัน`
      );
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Send stock motorcycles to round failed:", error);
      setErrorMessage(`ส่งเข้ารอบไม่สำเร็จ: ${message}`);
    }

    setIsSending(false);
  }

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                คลังรถ
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รายการรถในคลัง
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                แสดงเฉพาะรถที่พร้อมเลือกเข้ารอบเสนอราคาเป็นค่าเริ่มต้น
              </p>
            </div>

            <button
              type="button"
              onClick={loadPageData}
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

          {successMessage && (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
              <p className="font-semibold">{successMessage}</p>
            </div>
          )}

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                  รอบเสนอราคาปัจจุบัน
                </p>

                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {currentRound?.round_name || "ยังไม่มีรอบเสนอราคาปัจจุบัน"}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  สถานะ: {getRoundStatusLabel(currentRound?.status)} • รหัสรอบ:{" "}
                  {currentRound?.id ? `#${currentRound.id}` : "-"}
                </p>
              </div>

              <button
                type="button"
                onClick={sendSelectedToRound}
                disabled={
                  isSending || statusFilter !== "in_stock" || selectedIds.length === 0
                }
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSending ? "กำลังส่งเข้ารอบ..." : "ส่งเข้ารอบเสนอราคา"}
              </button>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รถในคลังบริษัท
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  เลือกรถที่พร้อมเข้ารอบจากแท็บพร้อมเลือกรอบ
                </p>
              </div>

              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหาเลขสต็อก / ชื่อรถ / รุ่น / ทะเบียน / แหล่งที่มา"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {statusFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={
                    statusFilter === option.value
                      ? "rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                  }
                >
                  {option.label}
                </button>
              ))}

              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={statusFilter !== "in_stock" || selectableIds.length === 0}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
              >
                เลือกรถที่พร้อมส่งทั้งหมด
              </button>

              <span className="text-sm text-gray-500">
                เลือกแล้ว {selectedIds.length} คัน
              </span>
            </div>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดข้อมูล...
              </div>
            )}

            {!isLoading && filteredStockMotorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">ไม่พบข้อมูลรถ</p>
                <p className="mt-1 text-sm text-gray-600">
                  ลองเปลี่ยนคำค้นหา หรือเพิ่มรถเข้าคลังจากหน้าเพิ่มรถเข้าคลัง
                </p>
              </div>
            )}

            {!isLoading && filteredStockMotorcycles.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-3">เลือก</th>
                      <th className="border p-3">รูป</th>
                      <th className="border p-3">รหัสสต็อก</th>
                      <th className="border p-3">รถ</th>
                      <th className="border p-3 text-right">ต้นทุน</th>
                      <th className="border p-3">สถานะ</th>
                      <th className="border p-3">ที่มา</th>
                      <th className="border p-3">วันที่เพิ่ม</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStockMotorcycles.map((bike) => {
                      const canSend =
                        statusFilter === "in_stock" &&
                        canSendStockBikeToRound(bike);
                      const isSelected = selectedIds.includes(bike.id);
                      const thumbnail =
                        bike.stock_motorcycle_photos?.[0]?.image_url || null;

                      return (
                        <tr key={bike.id} className="hover:bg-gray-50">
                          <td className="border p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSend}
                              onChange={() => toggleSelection(bike.id)}
                              className="h-5 w-5"
                            />
                          </td>

                          <td className="border p-3">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={bike.motorcycle_name}
                                className="h-16 w-24 rounded-xl bg-gray-50 object-contain"
                              />
                            ) : (
                              <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                                ไม่มีรูป
                              </div>
                            )}
                          </td>

                          <td className="border p-3 font-bold">
                            {bike.stock_number || "-"}
                          </td>

                          <td className="border p-3">
                            <p className="font-semibold text-gray-900">
                              {bike.motorcycle_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {[bike.brand, bike.model, bike.year]
                                .filter(Boolean)
                                .join(" ") || "-"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              ทะเบียน: {bike.license_plate || "-"}
                            </p>
                          </td>

                          <td className="border p-3 text-right font-bold text-orange-700">
                            {formatBaht(bike.cost_price)}
                          </td>

                          <td className="border p-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getStockLocationBadge(
                                bike
                              )}`}
                            >
                              {getStockLocationLabel(bike)}
                            </span>
                            <p className="mt-2 text-xs text-gray-500">
                              สถานะคลัง: {getStatusLabel(bike.stock_status)}
                            </p>
                            {!canSend && (
                              <p className="mt-2 text-xs text-gray-500">
                                ไม่พร้อมส่งเข้ารอบ
                              </p>
                            )}
                            {returnedStockIds.has(bike.id) && (
                              <p className="mt-2 text-xs font-semibold text-yellow-700">
                                เคยกลับเข้าสต็อก
                              </p>
                            )}
                          </td>

                          <td className="border p-3">
                            <p>{bike.acquisition_type || "-"}</p>
                            <p className="text-xs text-gray-500">
                              {bike.source_name || "-"}
                            </p>
                          </td>

                          <td className="border p-3">
                            {formatThaiDate(bike.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
