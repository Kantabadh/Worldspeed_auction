"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

type AcquisitionType = "" | "ซื้อ" | "เทิร์น" | "นวนคร" | "ประมูล";

type MotorcycleDetails = {
  brand: string;
  model: string;
  year: string;
  color: string;
  license_plate: string;
  frame_number: string;
  engine_number: string;
  registration_status: string;
  tax_expiry: string;
  acquisition_type: AcquisitionType;
  source_name: string;
  condition: string;
  notes: string;
};

type DetailKey = keyof MotorcycleDetails;

type Motorcycle = MotorcycleDetails & {
  id: number;
  lot_number: string;
  round_lot_number?: string | null;
  sort_order?: number | null;
  auction_round_id?: number | null;
  stock_motorcycle_id?: number | null;
  motorcycle_name: string;
  cost_price: number | null;
  active: boolean;
  created_at: string;
  motorcycle_photos: MotorcyclePhoto[];
};

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
};

type RoundLotMapping = {
  original_motorcycle_id: number | null;
  lot_number: string | null;
  round_lot_number?: string | null;
  sort_order?: number | null;
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

const ITEMS_PER_PAGE = 5;

const acquisitionTypeOptions: AcquisitionType[] = [
  "",
  "ซื้อ",
  "เทิร์น",
  "นวนคร",
  "ประมูล",
];

const detailFields: {
  key: DetailKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  { key: "brand", label: "ยี่ห้อ", placeholder: "เช่น Honda" },
  { key: "model", label: "รุ่น", placeholder: "เช่น Wave 110i" },
  { key: "year", label: "ปี", placeholder: "เช่น 2020" },
  { key: "color", label: "สี", placeholder: "เช่น แดง" },
  { key: "license_plate", label: "ทะเบียน", placeholder: "เช่น 1กก 1234" },
  { key: "frame_number", label: "เลขตัวถัง", placeholder: "เลขตัวถัง" },
  { key: "engine_number", label: "เลขเครื่อง", placeholder: "เลขเครื่อง" },
  {
    key: "registration_status",
    label: "สถานะเล่ม",
    placeholder: "เช่น มีเล่ม / ไม่มีเล่ม / รอโอน",
  },
  {
    key: "tax_expiry",
    label: "ภาษีหมดอายุ",
    placeholder: "เช่น 12/2567",
  },
  {
    key: "acquisition_type",
    label: "ซื้อ/เทิร์น",
    placeholder: "",
  },
  {
    key: "source_name",
    label: "มาจาก",
    placeholder: "เช่น R1 / S2 / B1 / HO / นวนคร / บางบอน",
  },
  {
    key: "condition",
    label: "สภาพรถ",
    placeholder: "เช่น ใช้งานปกติ / มีตำหนิ",
    multiline: true,
  },
  {
    key: "notes",
    label: "หมายเหตุ",
    placeholder: "รายละเอียดเพิ่มเติม",
    multiline: true,
  },
];

function createEmptyDetails(): MotorcycleDetails {
  return {
    brand: "",
    model: "",
    year: "",
    color: "",
    license_plate: "",
    frame_number: "",
    engine_number: "",
    registration_status: "",
    tax_expiry: "",
    acquisition_type: "",
    source_name: "",
    condition: "",
    notes: "",
  };
}

function cleanDetails(details: MotorcycleDetails) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, value.trim() || null])
  );
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  const numberValue = Number(cleaned);

  if (Number.isNaN(numberValue)) return null;

  return numberValue;
}

function formatMoneyInput(value: number | null) {
  if (value === null || value === undefined) return "";

  return String(value);
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

function formatChecklistFileDate(value: string | null | undefined) {
  const text = formatThaiDate(value);

  if (text === "-") return "ไม่ระบุวันที่";

  return text.replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
}

function cleanOptionalText(value: string | null | undefined) {
  return value?.trim() || "";
}

function getRoundLotDisplay(bike: Motorcycle) {
  return (
    cleanOptionalText(bike.round_lot_number) ||
    cleanOptionalText(bike.lot_number) ||
    "-"
  );
}

function getMotorcycleDisplayTitle(bike: Motorcycle) {
  const brand = cleanOptionalText(bike.brand);
  const model = cleanOptionalText(bike.model);
  const licensePlate = cleanOptionalText(bike.license_plate);
  const details = [model, licensePlate].filter(Boolean).join(" / ");

  if (brand && details) return `${brand} (${details})`;
  if (brand) return brand;

  return cleanOptionalText(bike.motorcycle_name) || "ไม่ระบุรุ่น";
}

function sortChecklistMotorcycles(a: Motorcycle, b: Motorcycle) {
  const sortA = a.sort_order;
  const sortB = b.sort_order;

  if (
    sortA !== null &&
    sortA !== undefined &&
    sortB !== null &&
    sortB !== undefined
  ) {
    const sortResult = Number(sortA) - Number(sortB);

    if (sortResult !== 0) return sortResult;
  }

  if (sortA !== null && sortA !== undefined) return -1;
  if (sortB !== null && sortB !== undefined) return 1;

  const lotResult = getRoundLotDisplay(a).localeCompare(
    getRoundLotDisplay(b),
    "th",
    { numeric: true }
  );

  if (lotResult !== 0) return lotResult;

  return (
    (a.brand || "").localeCompare(b.brand || "", "th", { numeric: true }) ||
    (a.model || "").localeCompare(b.model || "", "th", { numeric: true }) ||
    (a.frame_number || "").localeCompare(b.frame_number || "", "th", {
      numeric: true,
    })
  );
}

function getDetailsFromBike(bike: Motorcycle): MotorcycleDetails {
  return {
    brand: bike.brand || "",
    model: bike.model || "",
    year: bike.year || "",
    color: bike.color || "",
    license_plate: bike.license_plate || "",
    frame_number: bike.frame_number || "",
    engine_number: bike.engine_number || "",
    registration_status: bike.registration_status || "",
    tax_expiry: bike.tax_expiry || "",
    acquisition_type: bike.acquisition_type || "",
    source_name: bike.source_name || "",
    condition: bike.condition || "",
    notes: bike.notes || "",
  };
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

export default function AdminMotorcyclesPage() {
  const listSectionRef = useRef<HTMLElement | null>(null);

  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(
    null
  );

  const [lotNumber, setLotNumber] = useState("");
  const [motorcycleName, setMotorcycleName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [details, setDetails] = useState<MotorcycleDetails>(
    createEmptyDetails()
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLotNumber, setEditLotNumber] = useState("");
  const [editMotorcycleName, setEditMotorcycleName] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editDetails, setEditDetails] = useState<MotorcycleDetails>(
    createEmptyDetails()
  );
  const [editPhotoFiles, setEditPhotoFiles] = useState<File[]>([]);

  const [searchText, setSearchText] = useState("");
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openDetailIds, setOpenDetailIds] = useState<number[]>([]);
  const [movingBackId, setMovingBackId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
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

  function getMotorcycleTargetName(bike: {
    lot_number: string;
    motorcycle_name: string;
  }) {
    return `Lot ${bike.lot_number} • ${bike.motorcycle_name}`;
  }

  function getMotorcycleDetailPayload(bike: Motorcycle) {
    return {
      motorcycle_id: bike.id,
      lot_number: bike.lot_number,
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
      acquisition_type: bike.acquisition_type || "",
      source_name: bike.source_name || "",
      condition: bike.condition || "",
      notes: bike.notes || "",
      active: bike.active,
      photo_count: bike.motorcycle_photos?.length || 0,
    };
  }

  async function uploadPhoto(file: File, lot: string) {
    const fileExtension = file.name.split(".").pop();
    const safeLot = lot.replaceAll(" ", "-").replace(/[^\w-]/g, "");

    const filePath = `${safeLot || "lot"}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("motorcycle-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("motorcycle-photos")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function uploadMultiplePhotos(
    files: File[],
    motorcycleId: number,
    lot: string
  ) {
    if (files.length === 0) return 0;

    const photoRows = [];

    for (const file of files) {
      const imageUrl = await uploadPhoto(file, lot);

      photoRows.push({
        motorcycle_id: motorcycleId,
        image_url: imageUrl,
      });
    }

    const { error } = await supabase.from("motorcycle_photos").insert(photoRows);

    if (error) {
      throw error;
    }

    return photoRows.length;
  }

  async function loadMotorcycles() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: roundData, error: roundError } = await supabase
      .from("auction_rounds")
      .select("id, round_name, auction_date, status, is_current")
      .eq("is_current", true)
      .maybeSingle();

    if (roundError) {
      setErrorMessage(roundError.message);
      setIsLoading(false);
      return;
    }

    const activeRound = (roundData as CurrentAuctionRound | null) || null;
    setCurrentRound(activeRound);

    if (!activeRound) {
      setMotorcycles([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("motorcycles")
      .select(
        `
        id,
        lot_number,
        auction_round_id,
        stock_motorcycle_id,
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
        acquisition_type,
        source_name,
        condition,
        notes,
        active,
        created_at,
        motorcycle_photos (
          id,
          image_url
        )
      `
      )
      .eq("auction_round_id", activeRound.id)
      .order("lot_number");

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    let roundLotByMotorcycleId = new Map<number, RoundLotMapping>();

    if (activeRound) {
      const { data: roundLotData, error: roundLotError } = await supabase
        .from("auction_round_lots")
        .select("original_motorcycle_id, lot_number, round_lot_number, sort_order")
        .eq("auction_round_id", activeRound.id);

      if (roundLotError) {
        setErrorMessage(roundLotError.message);
        setIsLoading(false);
        return;
      }

      roundLotByMotorcycleId = new Map(
        ((roundLotData as RoundLotMapping[]) || [])
          .filter((item) => item.original_motorcycle_id)
          .map((item) => [Number(item.original_motorcycle_id), item])
      );
    }

    const mergedMotorcycles = ((data as Motorcycle[]) || []).map((bike) => {
      const mapping = roundLotByMotorcycleId.get(bike.id);

      return {
        ...bike,
        round_lot_number:
          mapping?.round_lot_number || mapping?.lot_number || null,
        sort_order: mapping?.sort_order ?? null,
      };
    });

    setMotorcycles(mergedMotorcycles.sort(sortChecklistMotorcycles));
    setIsLoading(false);
  }

  async function addMotorcycle() {
    if (!lotNumber.trim() || !motorcycleName.trim()) {
      alert("กรุณากรอกเลขล็อตและชื่อรถ");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    try {
      const newMotorcycleInput = {
        lot_number: lotNumber.trim(),
        motorcycle_name: motorcycleName.trim(),
        cost_price: cleanMoney(costPrice),
        ...cleanDetails(details),
        active: true,
      };

      const { data: motorcycleData, error: motorcycleError } = await supabase
        .from("motorcycles")
        .insert(newMotorcycleInput)
        .select(
          "id, lot_number, motorcycle_name, cost_price, brand, model, year, color, license_plate, frame_number, engine_number, registration_status, tax_expiry, acquisition_type, source_name, condition, notes, active"
        )
        .single();

      if (motorcycleError) {
        throw motorcycleError;
      }

      const uploadedPhotoCount = await uploadMultiplePhotos(
        photoFiles,
        motorcycleData.id,
        lotNumber
      );

      await createAuditLog({
        action: "motorcycle_created",
        targetType: "motorcycle",
        targetId: String(motorcycleData.id),
        targetName: `Lot ${motorcycleData.lot_number} • ${motorcycleData.motorcycle_name}`,
        details: {
          motorcycle_id: motorcycleData.id,
          lot_number: motorcycleData.lot_number,
          motorcycle_name: motorcycleData.motorcycle_name,
          cost_price: Number(motorcycleData.cost_price || 0),
          brand: motorcycleData.brand || "",
          model: motorcycleData.model || "",
          year: motorcycleData.year || "",
          color: motorcycleData.color || "",
          license_plate: motorcycleData.license_plate || "",
          frame_number: motorcycleData.frame_number || "",
          engine_number: motorcycleData.engine_number || "",
          registration_status: motorcycleData.registration_status || "",
          tax_expiry: motorcycleData.tax_expiry || "",
          acquisition_type: motorcycleData.acquisition_type || "",
          source_name: motorcycleData.source_name || "",
          condition: motorcycleData.condition || "",
          notes: motorcycleData.notes || "",
          active: motorcycleData.active,
          uploaded_photo_count: uploadedPhotoCount,
        },
      });

      setLotNumber("");
      setMotorcycleName("");
      setCostPrice("");
      setDetails(createEmptyDetails());
      setPhotoFiles([]);
      await loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เพิ่มรายการรถไม่สำเร็จ"
      );
    }

    setIsAdding(false);
  }

  function startEditing(bike: Motorcycle) {
    setEditingId(bike.id);
    setEditLotNumber(bike.lot_number);
    setEditMotorcycleName(bike.motorcycle_name);
    setEditCostPrice(formatMoneyInput(bike.cost_price));
    setEditDetails(getDetailsFromBike(bike));
    setEditPhotoFiles([]);

    setOpenDetailIds((current) =>
      current.includes(bike.id) ? current : [...current, bike.id]
    );
  }

  function cancelEditing() {
    setEditingId(null);
    setEditLotNumber("");
    setEditMotorcycleName("");
    setEditCostPrice("");
    setEditDetails(createEmptyDetails());
    setEditPhotoFiles([]);
  }

  async function saveEdit(bike: Motorcycle) {
    if (!editLotNumber.trim() || !editMotorcycleName.trim()) {
      alert("กรุณากรอกเลขล็อตและชื่อรถ");
      return;
    }

    setErrorMessage("");

    try {
      const oldBikeData = getMotorcycleDetailPayload(bike);

      const updatedMotorcycleInput = {
        lot_number: editLotNumber.trim(),
        motorcycle_name: editMotorcycleName.trim(),
        cost_price: cleanMoney(editCostPrice),
        ...cleanDetails(editDetails),
      };

      const { error } = await supabase
        .from("motorcycles")
        .update(updatedMotorcycleInput)
        .eq("id", bike.id);

      if (error) {
        throw error;
      }

      const uploadedPhotoCount = await uploadMultiplePhotos(
        editPhotoFiles,
        bike.id,
        editLotNumber
      );

      await createAuditLog({
        action: "motorcycle_updated",
        targetType: "motorcycle",
        targetId: String(bike.id),
        targetName: `Lot ${editLotNumber.trim()} • ${editMotorcycleName.trim()}`,
        details: {
          old_data: oldBikeData,
          new_data: {
            motorcycle_id: bike.id,
            lot_number: editLotNumber.trim(),
            motorcycle_name: editMotorcycleName.trim(),
            cost_price: cleanMoney(editCostPrice),
            ...cleanDetails(editDetails),
            active: bike.active,
          },
          uploaded_photo_count: uploadedPhotoCount,
        },
      });

      cancelEditing();
      await loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ"
      );
    }
  }

  async function deletePhoto(photo: MotorcyclePhoto, bike: Motorcycle) {
    const confirmDelete = confirm("ต้องการลบรูปนี้ใช่หรือไม่?");

    if (!confirmDelete) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("motorcycle_photos")
      .delete()
      .eq("id", photo.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await createAuditLog({
      action: "motorcycle_photo_deleted",
      targetType: "motorcycle",
      targetId: String(bike.id),
      targetName: getMotorcycleTargetName(bike),
      details: {
        motorcycle_id: bike.id,
        lot_number: bike.lot_number,
        motorcycle_name: bike.motorcycle_name,
        photo_id: photo.id,
        photo_url: photo.image_url,
        photo_count_before_delete: bike.motorcycle_photos?.length || 0,
      },
    });

    await loadMotorcycles();
  }

  async function moveMotorcycleBackToStock(bike: Motorcycle) {
    const confirmed = confirm("ยืนยันย้ายรถคันนี้กลับเข้าคลัง?");

    if (!confirmed) return;

    if (!currentRound) {
      setErrorMessage("ยังไม่มีรอบประมูลปัจจุบัน");
      return;
    }

    setMovingBackId(bike.id);
    setErrorMessage("");

    try {
      const { data: offerRows, error: offerError } = await supabase
        .from("offers")
        .select("id")
        .eq("motorcycle_id", bike.id)
        .eq("auction_round_id", currentRound.id)
        .limit(1);

      if (offerError) throw offerError;

      if (offerRows && offerRows.length > 0) {
        setErrorMessage(
          "ไม่สามารถย้ายกลับเข้าคลังได้ เพราะมีร้านค้าเสนอราคาแล้ว"
        );
        setMovingBackId(null);
        return;
      }

      if (bike.stock_motorcycle_id) {
        const { error: stockError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "อยู่ในสต็อก",
            current_auction_round_id: null,
            current_auction_motorcycle_id: null,
          })
          .eq("id", bike.stock_motorcycle_id);

        if (stockError) throw stockError;
      }

      const { error: roundLotError } = await supabase
        .from("auction_round_lots")
        .delete()
        .eq("auction_round_id", currentRound.id)
        .eq("original_motorcycle_id", bike.id);

      if (roundLotError) throw roundLotError;

      const { error: motorcycleError } = await supabase
        .from("motorcycles")
        .update({
          active: false,
          auction_round_id: null,
        })
        .eq("id", bike.id);

      if (motorcycleError) throw motorcycleError;

      await createAuditLog({
        action: "motorcycle_moved_back_to_stock",
        targetType: "motorcycle",
        targetId: String(bike.id),
        targetName: getMotorcycleTargetName(bike),
        details: {
          motorcycle_id: bike.id,
          stock_motorcycle_id: bike.stock_motorcycle_id || null,
          auction_round_id: currentRound.id,
          round_lot_number: getRoundLotDisplay(bike),
        },
      });

      await loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ย้ายรถกลับเข้าคลังไม่สำเร็จ"
      );
    }

    setMovingBackId(null);
  }

  function toggleDetail(bikeId: number) {
    setOpenDetailIds((current) =>
      current.includes(bikeId)
        ? current.filter((id) => id !== bikeId)
        : [...current, bikeId]
    );
  }

  function exportChecklistExcel() {
    if (!currentRound) {
      alert("ยังไม่มีรอบเสนอราคาปัจจุบัน");
      return;
    }

    const checklistMotorcycles = motorcycles
      .filter((bike) => bike.auction_round_id === currentRound.id)
      .sort(sortChecklistMotorcycles);

    if (checklistMotorcycles.length === 0) {
      alert("ยังไม่มีรถในรอบเสนอราคาปัจจุบัน");
      return;
    }

    const headers = [
      "ลำดับ",
      "ล็อต",
      "ยี่ห้อ",
      "รุ่น",
      "เลขตัวถัง",
      "เลขเครื่อง",
      "สี",
      "ทะเบียน",
      "มาจาก",
      "หมายเหตุ",
      "ช่องตรวจสอบ",
    ];

    const rows = checklistMotorcycles.map((bike, index) => [
      index + 1,
      getRoundLotDisplay(bike),
      bike.brand || "-",
      bike.model || "-",
      bike.frame_number || "-",
      bike.engine_number || "-",
      bike.color || "-",
      bike.license_plate || "-",
      bike.source_name || "-",
      bike.notes || "",
      "",
    ]);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    sheet["!cols"] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 34 },
      { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, "จัดเรียงล็อต");
    XLSX.writeFile(
      workbook,
      `จัดเรียงล็อต_รอบวันที่_${formatChecklistFileDate(
        currentRound.auction_date
      )}.xlsx`
    );
  }

  function renderDetailInputs(
    value: MotorcycleDetails,
    setValue: Dispatch<SetStateAction<MotorcycleDetails>>
  ) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {detailFields.map((field) => {
          if (field.key === "acquisition_type") {
            return (
              <div key={field.key}>
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                </label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={value.acquisition_type}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      acquisition_type: event.target.value as AcquisitionType,
                    }))
                  }
                >
                  {acquisitionTypeOptions.map((option) => (
                    <option key={option || "empty"} value={option}>
                      {option || "เลือกประเภท"}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div
              key={field.key}
              className={field.multiline ? "md:col-span-2" : ""}
            >
              <label className="text-sm font-medium text-gray-700">
                {field.label}
              </label>

              {field.multiline ? (
                <textarea
                  className="mt-2 min-h-24 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder={field.placeholder}
                  value={value[field.key]}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              ) : (
                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder={field.placeholder}
                  value={value[field.key]}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderBikeDetails(bike: Motorcycle) {
    const displayItems = [
      [
        "ต้นทุน",
        bike.cost_price
          ? `${Number(bike.cost_price).toLocaleString()} บาท`
          : "-",
      ],
      ["ยี่ห้อ", bike.brand],
      ["รุ่น", bike.model],
      ["ปี", bike.year],
      ["สี", bike.color],
      ["ทะเบียน", bike.license_plate],
      ["เลขตัวถัง", bike.frame_number],
      ["สถานะเล่ม", bike.registration_status],
      ["ภาษีหมดอายุ", bike.tax_expiry],
      ["มาจาก", bike.source_name],
      ["หมายเหตุ", bike.notes],
    ];

    return (
      <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-4 text-sm md:grid-cols-2">
        {displayItems.map(([label, value]) => (
          <div key={label}>
            <p className="font-semibold text-gray-700">{label}</p>
            <p
              className={
                label === "ต้นทุน"
                  ? "mt-1 font-bold text-orange-700"
                  : "mt-1 text-gray-600"
              }
            >
              {value || "-"}
            </p>
          </div>
        ))}
      </div>
    );
  }

  function goToPage(page: number) {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(safePage);

    setTimeout(() => {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function renderPaginationControls() {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          หน้า {safeCurrentPage} / {totalPages}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => goToPage(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ก่อนหน้า
          </button>

          {pageNumbers.map((page, index) => {
            const previousPage = pageNumbers[index - 1];
            const showDots =
              previousPage !== undefined && page - previousPage > 1;

            return (
              <div key={page} className="flex items-center gap-2">
                {showDots && (
                  <span className="px-1 text-sm text-gray-400">...</span>
                )}

                <button
                  onClick={() => goToPage(page)}
                  className={
                    page === safeCurrentPage
                      ? "rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
                  }
                >
                  {page}
                </button>
              </div>
            );
          })}

          <button
            onClick={() => goToPage(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadMotorcycles();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const filteredMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return motorcycles.filter((bike) => {
      const searchableText = [
        getRoundLotDisplay(bike),
        bike.motorcycle_name,
        bike.brand,
        bike.model,
        bike.year,
        bike.color,
        bike.license_plate,
        bike.frame_number,
        bike.engine_number,
        bike.registration_status,
        bike.tax_expiry,
        bike.acquisition_type,
        bike.source_name,
        bike.condition,
        bike.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = !keyword || searchableText.includes(keyword);

      return matchSearch;
    });
  }, [motorcycles, searchText]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMotorcycles.length / ITEMS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedMotorcycles = filteredMotorcycles.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((page) => {
      return (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - safeCurrentPage) <= 2
      );
    });

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รายการรถในรอบประมูล
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportChecklistExcel}
                disabled={!currentRound}
                className="rounded-xl bg-black px-4 py-2 font-medium text-white shadow hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                ดาวน์โหลด Excel ลำดับรถ
              </button>

              <button
                onClick={loadMotorcycles}
                className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
              >
                โหลดใหม่
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">รายการทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {motorcycles.length}
              </p>
            </div>
          </section>

          {false && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">เพิ่มรายการรถ</h2>

            <p className="mt-1 text-sm text-gray-600">
              เพิ่มข้อมูลรถ ต้นทุน และอัปโหลดรูปหลายรูปได้
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  เลขล็อต
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น 004"
                  value={lotNumber}
                  onChange={(event) => setLotNumber(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ชื่อรถ
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น Honda PCX 160"
                  value={motorcycleName}
                  onChange={(event) => setMotorcycleName(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ต้นทุน / ราคาทุน
                </label>

                <input
                  inputMode="decimal"
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น 25000"
                  value={costPrice}
                  onChange={(event) =>
                    setCostPrice(event.target.value.replace(/[^\d.]/g, ""))
                  }
                />

                <p className="mt-1 text-xs text-gray-500">
                  เห็นเฉพาะผู้ดูแลระบบ ร้านค้าไม่เห็นข้อมูลนี้
                </p>
              </div>
            </div>

            <div className="mt-5">{renderDetailInputs(details, setDetails)}</div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                รูปรถ
              </label>

              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-2 w-full rounded-2xl border bg-gray-50 p-3"
                onChange={(event) =>
                  setPhotoFiles(Array.from(event.target.files || []))
                }
              />

              {photoFiles.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  เลือกแล้ว {photoFiles.length} รูป
                </p>
              )}
            </div>

            <button
              onClick={addMotorcycle}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มรายการรถ"}
            </button>
          </section>
          )}

          <section
            ref={listSectionRef}
            className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รายการรถทั้งหมด
                </h2>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                แสดง {paginatedMotorcycles.length} จาก{" "}
                {filteredMotorcycles.length} รายการ
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span>ค้นหา</span>
                  <button
                    type="button"
                    onClick={() => setIsSearchHelpOpen((current) => !current)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-gray-500"
                    aria-label="ค้นหาได้จาก: ลำดับ, ยี่ห้อ, รุ่น, ทะเบียน, เลขตัวถัง, ชื่อ/เก็บ, แหล่งที่มา"
                  >
                    ?
                  </button>
                </label>

                {isSearchHelpOpen && (
                  <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    ค้นหาได้จาก: ลำดับ, ยี่ห้อ, รุ่น, ทะเบียน, เลขตัวถัง,
                    ชื่อ/เก็บ, แหล่งที่มา
                  </p>
                )}

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="ค้นหารถ"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
            </div>

            {searchText && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  setCurrentPage(1);
                }}
                className="mt-3 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-100"
              >
                ล้างตัวกรอง
              </button>
            )}

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            )}

            {!isLoading && motorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">ยังไม่มีรายการรถ</p>
              </div>
            )}

            {!isLoading &&
              motorcycles.length > 0 &&
              filteredMotorcycles.length === 0 && (
                <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                  <p className="font-semibold text-gray-900">
                    ไม่พบรายการที่ค้นหา
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    ลองเปลี่ยนคำค้นหา
                  </p>
                </div>
              )}

            {!isLoading && paginatedMotorcycles.length > 0 && (
              <>
                <div className="mt-5">{renderPaginationControls()}</div>

                <div className="mt-5 space-y-4">
                  {paginatedMotorcycles.map((bike) => {
                    const isDetailOpen = openDetailIds.includes(bike.id);

                    return (
                      <article
                        key={bike.id}
                        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                      >
                        <div className="bg-gray-50 p-3 sm:p-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
                              ลำดับ {getRoundLotDisplay(bike)}
                            </p>
                          </div>

                          <h3 className="mt-1 text-base font-bold text-gray-900 sm:text-lg">
                            {getMotorcycleDisplayTitle(bike)}
                          </h3>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleDetail(bike.id)}
                                className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100 sm:text-sm"
                              >
                                {isDetailOpen ? "รายละเอียด ▲" : "รายละเอียด ▼"}
                              </button>

                              <button
                                type="button"
                                onClick={() => moveMotorcycleBackToStock(bike)}
                                disabled={movingBackId === bike.id}
                                className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-800 shadow-sm hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                              >
                                {movingBackId === bike.id
                                  ? "กำลังย้าย..."
                                  : "ย้ายกลับเข้าคลัง"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isDetailOpen && (
                          <div className="border-t p-4">
                            {bike.motorcycle_photos?.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                {bike.motorcycle_photos.map((photo) => (
                                  <div
                                    key={photo.id}
                                    className="overflow-hidden rounded-2xl border bg-gray-50"
                                  >
                                    <img
                                      src={photo.image_url}
                                      alt={bike.motorcycle_name}
                                      loading="lazy"
                                      decoding="async"
                                      width={240}
                                      height={112}
                                      className="h-28 w-full bg-white object-contain"
                                    />

                                    <button
                                      onClick={() => deletePhoto(photo, bike)}
                                      className="w-full bg-red-600 px-2 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                    >
                                      ลบรูป
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                                ยังไม่มีรูป
                              </div>
                            )}

                            {renderBikeDetails(bike)}

                            {editingId === bike.id ? (
                              <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                                <h4 className="font-semibold text-gray-900">
                                  แก้ไขรายการรถ
                                </h4>

                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">
                                      เลขล็อต
                                    </label>

                                    <input
                                      className="mt-1 w-full rounded-xl border p-3"
                                      value={editLotNumber}
                                      onChange={(event) =>
                                        setEditLotNumber(event.target.value)
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium text-gray-700">
                                      ชื่อรถ
                                    </label>

                                    <input
                                      className="mt-1 w-full rounded-xl border p-3"
                                      value={editMotorcycleName}
                                      onChange={(event) =>
                                        setEditMotorcycleName(event.target.value)
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium text-gray-700">
                                      ต้นทุน / ราคาทุน
                                    </label>

                                    <input
                                      inputMode="decimal"
                                      className="mt-1 w-full rounded-xl border p-3"
                                      value={editCostPrice}
                                      onChange={(event) =>
                                        setEditCostPrice(
                                          event.target.value.replace(
                                            /[^\d.]/g,
                                            ""
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="mt-5">
                                  {renderDetailInputs(
                                    editDetails,
                                    setEditDetails
                                  )}
                                </div>

                                <div className="mt-3">
                                  <label className="text-sm font-medium text-gray-700">
                                    เพิ่มรูป
                                  </label>

                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="mt-1 w-full rounded-xl border bg-white p-3"
                                    onChange={(event) =>
                                      setEditPhotoFiles(
                                        Array.from(event.target.files || [])
                                      )
                                    }
                                  />

                                  {editPhotoFiles.length > 0 && (
                                    <p className="mt-2 text-sm text-gray-600">
                                      เลือกเพิ่ม {editPhotoFiles.length} รูป
                                    </p>
                                  )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button
                                    onClick={() => saveEdit(bike)}
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
                                  onClick={() => startEditing(bike)}
                                  className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                                >
                                  แก้ไข
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="mt-6">{renderPaginationControls()}</div>
              </>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
