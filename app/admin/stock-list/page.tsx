"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  | "branch_stock"
  | "center_stock"
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
  frame_number: string | null;
  engine_number: string | null;
  registration_status: string | null;
  tax_expiry: string | null;
  notes: string | null;
  acquisition_type: string | null;
  source_name: string | null;
  stock_status: StockStatus;
  stock_branch_code: string | null;
  stock_branch_name: string | null;
  created_by_staff_email: string | null;
  missing_detail_remark: string | null;
  is_complete: boolean | null;
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
  branch_code?: string | null;
  branch_name?: string | null;
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

type StockEditForm = {
  stock_number: string;
  brand: string;
  model: string;
  cost_price: string;
  year: string;
  color: string;
  license_plate: string;
  frame_number: string;
  registration_status: string;
  tax_expiry: string;
  notes: string;
};

const statusLabels: Record<string, string> = {
  in_stock: "อยู่ในคลัง",
  "อยู่ในสต็อก": "อยู่ในคลัง",
  branch_stock: "อยู่ในคลังสาขา",
  center_stock: "อยู่ในคลัง",
  repairing: "กำลังซ่อม",
  ready_to_sell: "พร้อมขาย",
  in_auction: "อยู่ในรอบเสนอราคา",
  "อยู่ในรอบเสนอราคา": "อยู่ในรอบเสนอราคา",
  sold: "ขายแล้ว",
  "ขายแล้ว": "ขายแล้ว",
  cancelled: "ยกเลิก",
};

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "in_stock", label: "อยู่ในคลัง" },
  { value: "in_auction", label: "อยู่ในการประมูล" },
  { value: "sold", label: "ขายแล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

function getStatusLabel(status: string | null | undefined) {
  return status ? statusLabels[status] || status : "-";
}

function normalizeFrameNumber(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function isIncompleteStockBike(bike: StockMotorcycle) {
  return bike.is_complete === false;
}

function hasExistingAuctionRoundLink(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  return (
    bike.current_auction_round_id !== null &&
    existingAuctionRoundIds.has(bike.current_auction_round_id)
  );
}

function getStockLocationLabel(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  if (isIncompleteStockBike(bike)) {
    return "รอกรอกข้อมูล";
  }

  if (bike.stock_status === "sold" || bike.stock_status === "ขายแล้ว") {
    return "ขายแล้ว";
  }

  if (hasExistingAuctionRoundLink(bike, existingAuctionRoundIds)) {
    return "อยู่ในการประมูล";
  }

  return "อยู่ในคลัง";
}

function getStockLocationBadge(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  if (isIncompleteStockBike(bike)) {
    return "bg-yellow-100 text-yellow-800";
  }

  if (bike.stock_status === "sold" || bike.stock_status === "ขายแล้ว") {
    return "bg-purple-100 text-purple-700";
  }

  if (hasExistingAuctionRoundLink(bike, existingAuctionRoundIds)) {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-gray-100 text-gray-700";
}

function isAvailableStockBike(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  return (
    bike.stock_status !== "sold" &&
    bike.stock_status !== "ขายแล้ว" &&
    !isIncompleteStockBike(bike) &&
    !hasExistingAuctionRoundLink(bike, existingAuctionRoundIds)
  );
}

function matchesStockFilter(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  return (
    bike.stock_status !== "sold" &&
    bike.stock_status !== "ขายแล้ว" &&
    !hasExistingAuctionRoundLink(bike, existingAuctionRoundIds)
  );
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;

  const numberValue = Number(cleaned);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function formatMoneyInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function isMissingIsCompleteColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  const message = String(error.message).toLowerCase();
  return message.includes("is_complete") && message.includes("column");
}

function getIsCompleteMigrationMessage() {
  return [
    "ยังไม่พบคอลัมน์ is_complete ในตาราง stock_motorcycles",
    "กรุณารัน SQL นี้:",
    "alter table public.stock_motorcycles add column if not exists is_complete boolean not null default true;",
  ].join("\n");
}

function createStockEditForm(bike: StockMotorcycle): StockEditForm {
  return {
    stock_number: bike.stock_number || "",
    brand: bike.brand || "",
    model: bike.model || "",
    cost_price: formatMoneyInput(bike.cost_price),
    year: bike.year || "",
    color: bike.color || "",
    license_plate: bike.license_plate || "",
    frame_number: bike.frame_number || "",
    registration_status: bike.registration_status || "",
    tax_expiry: bike.tax_expiry || "",
    notes: bike.notes || "",
  };
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

function canSendStockBikeToRound(
  bike: StockMotorcycle,
  existingAuctionRoundIds: Set<number>
) {
  return isAvailableStockBike(bike, existingAuctionRoundIds);
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
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return getSavedStaffProfile();
  });
  const [existingAuctionRoundIds, setExistingAuctionRoundIds] = useState<
    Set<number>
  >(new Set());
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
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<StockEditForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingStockId, setDeletingStockId] = useState<number | null>(null);
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
    return `${bike.stock_number || "ไม่มีเลขคลัง"} • ${bike.motorcycle_name}`;
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
      frame_number: bike.frame_number || "",
      engine_number: bike.engine_number || "",
      registration_status: bike.registration_status || "",
      tax_expiry: bike.tax_expiry || "",
      notes: bike.notes || "",
      acquisition_type: bike.acquisition_type || "",
      source_name: bike.source_name || "",
      stock_status: bike.stock_status,
      stock_branch_code: bike.stock_branch_code || "",
      stock_branch_name: bike.stock_branch_name || "",
      created_by_staff_email: bike.created_by_staff_email || "",
      missing_detail_remark: bike.missing_detail_remark || "",
      is_complete: bike.is_complete !== false,
      stock_status_thai: getStatusLabel(bike.stock_status),
      current_auction_motorcycle_id: bike.current_auction_motorcycle_id,
      current_auction_round_id: bike.current_auction_round_id,
      photo_count: bike.stock_motorcycle_photos?.length || 0,
    };
  }

  async function loadAuctionRoundData() {
    const { data, error } = await supabase
      .from("auction_rounds")
      .select("id, round_name, auction_date, status, is_current")
      .order("id", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setCurrentRound(null);
      setExistingAuctionRoundIds(new Set());
      return null;
    }

    const rounds = ((data as CurrentAuctionRound[]) || []).filter(
      (round) => typeof round.id === "number"
    );
    const round = rounds.find((item) => item.is_current) || null;

    setCurrentRound(round);
    setExistingAuctionRoundIds(new Set(rounds.map((item) => item.id)));
    return round;
  }

  async function queryStockMotorcycles(includeIsComplete: boolean) {
    const currentStaffProfile = getSavedStaffProfile();

    if (currentStaffProfile?.role === "stock_staff" && !currentStaffProfile.branch_code) {
      return { data: [], error: null };
    }

    let query = supabase
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
        frame_number,
        engine_number,
        registration_status,
        tax_expiry,
        notes,
        acquisition_type,
        source_name,
        stock_status,
        stock_branch_code,
        stock_branch_name,
        created_by_staff_email,
        missing_detail_remark,
        ${includeIsComplete ? "is_complete," : ""}
        current_auction_motorcycle_id,
        current_auction_round_id,
        created_at,
        updated_at,
        stock_motorcycle_photos (
          id,
          image_url
        )
      `
      );

    if (currentStaffProfile?.role === "stock_staff") {
      query = query.eq("stock_branch_code", currentStaffProfile.branch_code);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    return { data, error };
  }

  async function loadStockMotorcycles() {
    let { data, error } = await queryStockMotorcycles(true);

    if (error && isMissingIsCompleteColumn(error)) {
      setErrorMessage(getIsCompleteMigrationMessage());
      const fallbackResult = await queryStockMotorcycles(false);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStockMotorcycles(
      (((data as unknown as StockMotorcycle[]) || []).map((bike) => ({
        ...bike,
        is_complete: bike.is_complete ?? true,
      })))
    );
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
      loadAuctionRoundData(),
      loadStockMotorcycles(),
      loadReturnedStockIds(),
    ]);

    setIsLoading(false);
  }

  useEffect(() => {
    setStaffProfile(getSavedStaffProfile());
    loadPageData();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter]);

  const filteredStockMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return stockMotorcycles.filter((bike) => {
      if (
        statusFilter === "in_stock" &&
        !matchesStockFilter(bike, existingAuctionRoundIds)
      ) {
        return false;
      }

      if (
        statusFilter === "in_auction" &&
        getStockLocationLabel(bike, existingAuctionRoundIds) !==
          "อยู่ในการประมูล"
      ) {
        return false;
      }

      if (
        statusFilter === "sold" &&
        getStockLocationLabel(bike, existingAuctionRoundIds) !== "ขายแล้ว"
      ) {
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
        bike.stock_branch_name,
        getStockLocationLabel(bike, existingAuctionRoundIds),
        getStatusLabel(bike.stock_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [
    stockMotorcycles,
    searchText,
    statusFilter,
    existingAuctionRoundIds,
  ]);

  const duplicateFrameNumbers = useMemo(() => {
    const counts = new Map<string, number>();

    stockMotorcycles.forEach((bike) => {
      const frameNumber = normalizeFrameNumber(bike.frame_number);
      if (!frameNumber) return;

      counts.set(frameNumber, (counts.get(frameNumber) || 0) + 1);
    });

    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([frameNumber]) => frameNumber)
    );
  }, [stockMotorcycles]);

  function isDuplicateStockBike(bike: StockMotorcycle) {
    const frameNumber = normalizeFrameNumber(bike.frame_number);
    return Boolean(frameNumber && duplicateFrameNumbers.has(frameNumber));
  }

  const selectableIds = filteredStockMotorcycles
    .filter(
      (bike) =>
        statusFilter === "in_stock" &&
        canSendStockBikeToRound(bike, existingAuctionRoundIds)
    )
    .map((bike) => bike.id);

  function toggleSelection(stockMotorcycleId: number) {
    if (statusFilter !== "in_stock") return;

    const bike = stockMotorcycles.find((item) => item.id === stockMotorcycleId);

    if (!bike || !canSendStockBikeToRound(bike, existingAuctionRoundIds)) return;

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

  function startEditingStockBike(bike: StockMotorcycle) {
    setEditingStockId(bike.id);
    setEditForm(createStockEditForm(bike));
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEditingStockBike() {
    setEditingStockId(null);
    setEditForm(null);
  }

  function updateEditForm(field: keyof StockEditForm, value: string) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
    );
  }

  async function saveStockBikeDetails(bike: StockMotorcycle) {
    if (!editForm) return;

    const costPrice = cleanMoney(editForm.cost_price);
    const finalBrand = editForm.brand.trim();
    const finalModel = editForm.model.trim();

    setIsSavingEdit(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const motorcycleName =
        [finalBrand, finalModel].filter(Boolean).join(" ") ||
        bike.motorcycle_name ||
        `รอกรอกข้อมูล ${editForm.stock_number.trim() || bike.id}`;
      const updatedStockInput = {
        motorcycle_name: motorcycleName,
        stock_number: editForm.stock_number.trim() || null,
        brand: finalBrand || null,
        model: finalModel || null,
        cost_price: costPrice,
        year: editForm.year.trim() || null,
        color: editForm.color.trim() || null,
        license_plate: editForm.license_plate.trim() || null,
        frame_number: editForm.frame_number.trim() || null,
        registration_status: editForm.registration_status.trim() || null,
        tax_expiry: editForm.tax_expiry.trim() || null,
        notes: editForm.notes.trim() || null,
        is_complete: Boolean(finalBrand && finalModel && costPrice !== null),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("stock_motorcycles")
        .update(updatedStockInput)
        .eq("id", bike.id);

      if (error) throw error;

      await createAuditLog({
        action: "stock_motorcycle_completed",
        targetType: "stock_motorcycle",
        targetId: String(bike.id),
        targetName: `${bike.stock_number || "ไม่มีเลขคลัง"} • ${motorcycleName}`,
        details: {
          before: getStockDetailPayload(bike),
          after: updatedStockInput,
        },
      });

      cancelEditingStockBike();
      await loadStockMotorcycles();
      setSuccessMessage("บันทึกข้อมูลรถเรียบร้อยแล้ว");
    } catch (error) {
      setErrorMessage(
        isMissingIsCompleteColumn(error)
          ? getIsCompleteMigrationMessage()
          : error instanceof Error
            ? error.message
            : "บันทึกข้อมูลรถไม่สำเร็จ"
      );
    }

    setIsSavingEdit(false);
  }

  function isStockBikeDeleteBlocked(bike: StockMotorcycle) {
    return (
      bike.stock_status === "in_auction" ||
      bike.stock_status === "อยู่ในรอบเสนอราคา" ||
      bike.current_auction_round_id === currentRound?.id ||
      bike.current_auction_motorcycle_id !== null
    );
  }

  async function deleteStockBike(bike: StockMotorcycle) {
    if (isStockBikeDeleteBlocked(bike)) {
      setErrorMessage("ไม่สามารถลบรถที่อยู่ในรอบประมูลได้");
      return;
    }

    const confirmed = confirm("ต้องการลบรถคันนี้ออกจากคลังหรือไม่?");
    if (!confirmed) return;

    setDeletingStockId(bike.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error: photoRowsError } = await supabase
        .from("stock_motorcycle_photos")
        .delete()
        .eq("stock_motorcycle_id", bike.id);

      if (photoRowsError) throw photoRowsError;

      const { error } = await supabase
        .from("stock_motorcycles")
        .delete()
        .eq("id", bike.id);

      if (error) throw error;

      await createAuditLog({
        action: "stock_motorcycle_deleted",
        targetType: "stock_motorcycle",
        targetId: String(bike.id),
        targetName: getStockTargetName(bike),
        details: getStockDetailPayload(bike),
      });

      if (editingStockId === bike.id) {
        cancelEditingStockBike();
      }

      setSelectedIds((current) => current.filter((id) => id !== bike.id));
      await loadStockMotorcycles();
      setSuccessMessage("ลบรถออกจากคลังเรียบร้อยแล้ว");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ลบรถออกจากคลังไม่สำเร็จ"
      );
    }

    setDeletingStockId(null);
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

    if (selectedBikes.some((bike) => isIncompleteStockBike(bike))) {
      setErrorMessage("กรุณากรอกข้อมูลรถให้ครบก่อนส่งเข้ารอบประมูล");
      return;
    }

    const sendableBikes = selectedBikes.filter((bike) =>
      canSendStockBikeToRound(bike, existingAuctionRoundIds)
    );

    if (sendableBikes.length === 0) {
      setErrorMessage("รถที่เลือกอยู่ในการประมูลแล้วหรือยังไม่พร้อมส่งเข้ารอบ");
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
            frame_number: bike.frame_number || null,
            engine_number: bike.engine_number || null,
            registration_status: bike.registration_status || null,
            tax_expiry: bike.tax_expiry || null,
            notes: bike.notes || null,
            acquisition_type: bike.acquisition_type || null,
            source_name: bike.source_name || null,
            active: true,
            image_url: firstPhoto,
            stock_motorcycle_id: bike.id,
            auction_round_id: currentRound.id,
            lot_sale_status: "in_auction",
          })
          .select("id")
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

  const isSelectionMode = statusFilter === "in_stock";

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รายการรถในคลัง
              </h1>
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
                <h2 className="text-xl font-bold text-gray-900">
                  {currentRound?.round_name || "ยังไม่มีรอบเสนอราคาปัจจุบัน"}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  สถานะ: {getRoundStatusLabel(currentRound?.status)}
                </p>
              </div>

              {isSelectionMode && (
                <button
                  type="button"
                  onClick={sendSelectedToRound}
                  disabled={isSending || selectedIds.length === 0}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isSending ? "กำลังส่งเข้ารอบ..." : "ส่งเข้ารอบเสนอราคา"}
                </button>
              )}
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รถในคลังบริษัท
                </h2>
              </div>

              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหารหัสคลัง / ชื่อรถ / รุ่น / ทะเบียน / สาขา"
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

              {isSelectionMode && (
                <>
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    disabled={selectableIds.length === 0}
                    className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                  >
                    เลือกรถที่พร้อมส่งทั้งหมด
                  </button>

                  <span className="text-sm text-gray-500">
                    เลือกแล้ว {selectedIds.length} คัน
                  </span>
                </>
              )}
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
                <table className="min-w-[1250px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      {isSelectionMode && (
                        <th className="border p-3">เลือก</th>
                      )}
                      <th className="border p-3">รูป</th>
                      <th className="border p-3">รหัสคลัง</th>
                      <th className="border p-3">รถ</th>
                      <th className="border p-3 text-right">ต้นทุน</th>
                      <th className="border p-3">สถานะ</th>
                      <th className="border p-3">สาขา</th>
                      <th className="border p-3">วันที่เพิ่ม</th>
                      <th className="border p-3">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStockMotorcycles.map((bike) => {
                      const canSend =
                        isSelectionMode &&
                        canSendStockBikeToRound(bike, existingAuctionRoundIds);
                      const isSelected = selectedIds.includes(bike.id);
                      const thumbnail =
                        bike.stock_motorcycle_photos?.[0]?.image_url || null;

                      return (
                        <Fragment key={bike.id}>
                        <tr className="hover:bg-gray-50">
                          {isSelectionMode && (
                            <td className="border p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canSend}
                                onChange={() => toggleSelection(bike.id)}
                                className="h-5 w-5"
                              />
                            </td>
                          )}

                          <td className="border p-3">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={bike.motorcycle_name}
                                loading="lazy"
                                decoding="async"
                                width={96}
                                height={64}
                                className="h-16 w-24 rounded-xl bg-gray-50 object-contain"
                              />
                            ) : (
                              <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                                ไม่มีรูป
                              </div>
                            )}
                          </td>

                          <td className="border p-3 font-bold">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{bike.stock_number || "-"}</span>
                              {isDuplicateStockBike(bike) && (
                                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                                  ซ้ำ
                                </span>
                              )}
                            </div>
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
                            {bike.missing_detail_remark && (
                              <p className="mt-2 rounded-lg bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-800">
                                {bike.missing_detail_remark}
                              </p>
                            )}
                          </td>

                          <td className="border p-3 text-right font-bold text-orange-700">
                            {formatBaht(bike.cost_price)}
                          </td>

                          <td className="border p-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getStockLocationBadge(
                                bike,
                                existingAuctionRoundIds
                              )}`}
                            >
                              {getStockLocationLabel(
                                bike,
                                existingAuctionRoundIds
                              )}
                            </span>
                            {returnedStockIds.has(bike.id) && (
                              <p className="mt-2 text-xs font-semibold text-red-600">
                                รถตีกลับ
                              </p>
                            )}
                          </td>

                          <td className="border p-3">
                            {bike.stock_branch_name || "-"}
                          </td>

                          <td className="border p-3">
                            {formatThaiDate(bike.created_at)}
                          </td>

                          <td className="border p-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingStockBike(bike)}
                                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-100"
                              >
                                แก้ไข
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteStockBike(bike)}
                                disabled={deletingStockId === bike.id}
                                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingStockId === bike.id ? "กำลังลบ..." : "ลบ"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingStockId === bike.id && editForm && (
                          <tr className="bg-yellow-50">
                            <td
                              className="border p-4"
                              colSpan={isSelectionMode ? 9 : 8}
                            >
                              <div className="grid gap-3 md:grid-cols-4">
                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    รหัสสต๊อก
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.stock_number}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "stock_number",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    ยี่ห้อ
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.brand}
                                    onChange={(event) =>
                                      updateEditForm("brand", event.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    รุ่น
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.model}
                                    onChange={(event) =>
                                      updateEditForm("model", event.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    ปี
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.year}
                                    onChange={(event) =>
                                      updateEditForm("year", event.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    เลขตัวถัง
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.frame_number}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "frame_number",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    ทะเบียน
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.license_plate}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "license_plate",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    สี
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.color}
                                    onChange={(event) =>
                                      updateEditForm("color", event.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    สถานะเล่ม
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.registration_status}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "registration_status",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    ภาษีหมดอายุ
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.tax_expiry}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "tax_expiry",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-semibold text-gray-700">
                                    ต้นทุน
                                  </label>
                                  <input
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.cost_price}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "cost_price",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  <label className="text-xs font-semibold text-gray-700">
                                    หมายเหตุเพิ่มเติม
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.notes}
                                    onChange={(event) =>
                                      updateEditForm("notes", event.target.value)
                                    }
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveStockBikeDetails(bike)}
                                  disabled={isSavingEdit}
                                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
                                >
                                  {isSavingEdit ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelEditingStockBike}
                                  disabled={isSavingEdit}
                                  className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
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
