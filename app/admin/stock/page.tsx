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
  | "repairing"
  | "ready_to_sell"
  | "in_auction"
  | "sold"
  | "cancelled";

type AcquisitionType = "" | "ซื้อ" | "เทิร์น" | "นวนคร" | "ประมูล";

type MotorcycleDetails = {
  brand: string;
  model: string;
  year: string;
  color: string;
  license_plate: string;
  mileage: string;
  frame_number: string;
  engine_number: string;
  registration_status: string;
  tax_expiry: string;
  condition: string;
  notes: string;
  purchase_date: string;
  acquisition_type: AcquisitionType;
  source_name: string;
  repair_notes: string;
};

type DetailKey = keyof MotorcycleDetails;

type StockMotorcycle = MotorcycleDetails & {
  id: number;
  stock_number: string | null;
  motorcycle_name: string;
  cost_price: number | null;
  stock_status: StockStatus;
  current_auction_motorcycle_id: number | null;
  current_auction_round_id: number | null;
  created_at: string;
  updated_at: string;
  stock_motorcycle_photos: StockPhoto[];
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
};

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

const acquisitionTypeOptions: AcquisitionType[] = [
  "",
  "ซื้อ",
  "เทิร์น",
  "นวนคร",
  "ประมูล",
];

const statusOptions: { value: StockStatus; label: string; badge: string }[] = [
  {
    value: "in_stock",
    label: "อยู่ในสต็อก",
    badge: "bg-gray-100 text-gray-700",
  },
  {
    value: "repairing",
    label: "กำลังซ่อม",
    badge: "bg-yellow-100 text-yellow-700",
  },
  {
    value: "ready_to_sell",
    label: "พร้อมขาย",
    badge: "bg-green-100 text-green-700",
  },
  {
    value: "in_auction",
    label: "อยู่ใน Auction",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    value: "sold",
    label: "ขายแล้ว",
    badge: "bg-purple-100 text-purple-700",
  },
  {
    value: "cancelled",
    label: "ยกเลิก",
    badge: "bg-red-100 text-red-700",
  },
];

const detailFields: {
  key: DetailKey;
  label: string;
  placeholder: string;
  type?: string;
  multiline?: boolean;
}[] = [
  { key: "brand", label: "ยี่ห้อ", placeholder: "เช่น Honda" },
  { key: "model", label: "รุ่น", placeholder: "เช่น Wave 110i" },
  { key: "year", label: "ปี", placeholder: "เช่น 2020" },
  { key: "color", label: "สี", placeholder: "เช่น แดง" },
  { key: "license_plate", label: "ทะเบียน", placeholder: "เช่น 1กก 1234" },
  { key: "mileage", label: "เลขไมล์", placeholder: "เช่น 25,000 กม." },
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
    key: "purchase_date",
    label: "วันที่รับรถเข้า",
    placeholder: "",
    type: "date",
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
    key: "repair_notes",
    label: "หมายเหตุงานซ่อม",
    placeholder: "เช่น เปลี่ยนยาง / เช็กเครื่อง / รออะไหล่",
    multiline: true,
  },
  {
    key: "notes",
    label: "หมายเหตุเพิ่มเติม",
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
    mileage: "",
    frame_number: "",
    engine_number: "",
    registration_status: "",
    tax_expiry: "",
    condition: "",
    notes: "",
    purchase_date: "",
    acquisition_type: "",
    source_name: "",
    repair_notes: "",
  };
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  const numberValue = Number(cleaned);

  if (Number.isNaN(numberValue)) return null;

  return numberValue;
}

function cleanDetails(details: MotorcycleDetails) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, value.trim() || null])
  );
}

function formatMoneyInput(value: number | null) {
  if (value === null || value === undefined) return "";

  return String(value);
}

function getStatusLabel(status: StockStatus | string) {
  return statusOptions.find((item) => item.value === status)?.label || status;
}

function getStatusBadge(status: StockStatus | string) {
  return (
    statusOptions.find((item) => item.value === status)?.badge ||
    "bg-gray-100 text-gray-700"
  );
}

function getRoundStatusLabel(status?: string | null) {
  if (status === "draft") return "เตรียมรอบ";
  if (status === "open") return "เปิดรับราคา";
  if (status === "closed") return "ปิดรอบ";
  if (status === "archived") return "บันทึกประวัติแล้ว";
  return status || "-";
}

function getStockStatusDescription(status: StockStatus | string) {
  if (status === "ready_to_sell") return "พร้อมนำเข้ารอบ Auction ถัดไป";
  if (status === "in_auction") return "อยู่ในรอบ Auction ปัจจุบันหรือรอบที่เลือกไว้";
  if (status === "sold") return "ขายแล้ว ไม่ควรนำเข้ารอบใหม่";
  if (status === "repairing") return "ยังซ่อมอยู่ ควรรอให้พร้อมก่อน";
  if (status === "cancelled") return "ยกเลิกรายการนี้แล้ว";
  if (status === "in_stock") return "อยู่ในคลัง ยังไม่ถูกนำเข้ารอบ";
  return "-";
}

function canSendStockBikeToRound(bike: StockMotorcycle) {
  if (bike.current_auction_motorcycle_id) return false;
  if (bike.stock_status === "in_auction") return false;
  if (bike.stock_status === "sold") return false;
  if (bike.stock_status === "repairing") return false;
  if (bike.stock_status === "cancelled") return false;
  return true;
}

function getSendToRoundButtonText(
  bike: StockMotorcycle,
  sendingToAuctionId: number | null
) {
  if (sendingToAuctionId === bike.id) return "กำลังนำเข้ารอบ...";
  if (bike.current_auction_motorcycle_id || bike.stock_status === "in_auction") {
    return "เข้ารอบ Auction แล้ว";
  }
  if (bike.stock_status === "sold") return "ขายแล้ว";
  if (bike.stock_status === "repairing") return "กำลังซ่อม";
  if (bike.stock_status === "cancelled") return "ยกเลิกแล้ว";
  return "นำเข้ารอบปัจจุบัน";
}

function getDetailsFromStock(bike: StockMotorcycle): MotorcycleDetails {
  return {
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

export default function AdminStockPage() {
  const [stockMotorcycles, setStockMotorcycles] = useState<StockMotorcycle[]>(
    []
  );

  const [stockNumber, setStockNumber] = useState("");
  const [motorcycleName, setMotorcycleName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("in_stock");
  const [details, setDetails] = useState<MotorcycleDetails>(
    createEmptyDetails()
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStockNumber, setEditStockNumber] = useState("");
  const [editMotorcycleName, setEditMotorcycleName] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editStockStatus, setEditStockStatus] =
    useState<StockStatus>("in_stock");
  const [editDetails, setEditDetails] = useState<MotorcycleDetails>(
    createEmptyDetails()
  );
  const [editPhotoFiles, setEditPhotoFiles] = useState<File[]>([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [sendingToAuctionId, setSendingToAuctionId] = useState<number | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(null);
  const [isLoadingCurrentRound, setIsLoadingCurrentRound] = useState(true);

  useEffect(() => {
    setStaffProfile(getSavedStaffProfile());
  }, []);

  const isStockStaff = staffProfile?.role === "stock_staff";

  const canManageAuctionFromStock =
    staffProfile?.role === "owner" || staffProfile?.role === "admin";

  const addStatusOptions = isStockStaff
    ? statusOptions.filter(
        (status) => status.value !== "in_auction" && status.value !== "sold"
      )
    : statusOptions;

  const editStatusOptions = useMemo(() => {
    if (!isStockStaff) return statusOptions;

    const basicOptions = statusOptions.filter(
      (status) => status.value !== "in_auction" && status.value !== "sold"
    );

    const currentStatusIsHidden = !basicOptions.some(
      (status) => status.value === editStockStatus
    );

    if (!currentStatusIsHidden) return basicOptions;

    const currentStatus = statusOptions.find(
      (status) => status.value === editStockStatus
    );

    return currentStatus ? [currentStatus, ...basicOptions] : basicOptions;
  }, [isStockStaff, editStockStatus]);

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

  function getStockTargetName(bike: {
    stock_number: string | null;
    motorcycle_name: string;
  }) {
    return `${bike.stock_number || "ไม่มีเลขสต็อก"} • ${
      bike.motorcycle_name
    }`;
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

  async function uploadPhoto(file: File, stockNumberInput: string) {
    const fileExtension = file.name.split(".").pop();
    const safeStockNumber = (stockNumberInput || "stock")
      .replaceAll(" ", "-")
      .replace(/[^\w-]/g, "");

    const filePath = `stock-${safeStockNumber}-${Date.now()}-${Math.random()
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

  async function uploadMultipleStockPhotos(
    files: File[],
    stockMotorcycleId: number,
    stockNumberInput: string
  ) {
    if (files.length === 0) return 0;

    const photoRows = [];

    for (const file of files) {
      const imageUrl = await uploadPhoto(file, stockNumberInput);

      photoRows.push({
        stock_motorcycle_id: stockMotorcycleId,
        image_url: imageUrl,
      });
    }

    const { error } = await supabase
      .from("stock_motorcycle_photos")
      .insert(photoRows);

    if (error) {
      throw error;
    }

    return photoRows.length;
  }

  async function loadCurrentAuctionRound() {
    setIsLoadingCurrentRound(true);

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
      setIsLoadingCurrentRound(false);
      return;
    }

    setCurrentRound((data as CurrentAuctionRound) || null);
    setIsLoadingCurrentRound(false);
  }

  async function loadStockMotorcycles() {
    setIsLoading(true);
    setErrorMessage("");

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
      setIsLoading(false);
      return;
    }

    setStockMotorcycles((data as StockMotorcycle[]) || []);
    setIsLoading(false);
  }

  async function addStockMotorcycle() {
    if (!motorcycleName.trim()) {
      alert("กรุณากรอกชื่อรถ");
      return;
    }

    if (
      isStockStaff &&
      (stockStatus === "in_auction" || stockStatus === "sold")
    ) {
      alert("เจ้าหน้าที่รับรถไม่สามารถตั้งสถานะนี้ได้");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    try {
      const newStockInput = {
        stock_number: stockNumber.trim() || null,
        motorcycle_name: motorcycleName.trim(),
        cost_price: cleanMoney(costPrice),
        stock_status: stockStatus,
        ...cleanDetails(details),
      };

      const { data: stockData, error: stockError } = await supabase
        .from("stock_motorcycles")
        .insert(newStockInput)
        .select()
        .single();

      if (stockError) {
        throw stockError;
      }

      const uploadedPhotoCount = await uploadMultipleStockPhotos(
        photoFiles,
        Number(stockData.id),
        stockNumber || motorcycleName
      );

      await createAuditLog({
        action: "stock_motorcycle_created",
        targetType: "stock_motorcycle",
        targetId: String(stockData.id),
        targetName: `${stockData.stock_number || "ไม่มีเลขสต็อก"} • ${
          stockData.motorcycle_name
        }`,
        details: {
          stock_motorcycle_id: stockData.id,
          stock_number: stockData.stock_number || "",
          motorcycle_name: stockData.motorcycle_name,
          cost_price: Number(stockData.cost_price || 0),
          stock_status: stockData.stock_status,
          stock_status_thai: getStatusLabel(stockData.stock_status),
          uploaded_photo_count: uploadedPhotoCount,
          ...cleanDetails(details),
        },
      });

      setStockNumber("");
      setMotorcycleName("");
      setCostPrice("");
      setStockStatus("in_stock");
      setDetails(createEmptyDetails());
      setPhotoFiles([]);

      await loadStockMotorcycles();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างเพิ่มรถเข้าคลัง";

      setErrorMessage(message);
    }

    setIsAdding(false);
  }

  function startEditing(bike: StockMotorcycle) {
    setEditingId(bike.id);
    setEditStockNumber(bike.stock_number || "");
    setEditMotorcycleName(bike.motorcycle_name || "");
    setEditCostPrice(formatMoneyInput(bike.cost_price));
    setEditStockStatus(bike.stock_status || "in_stock");
    setEditDetails(getDetailsFromStock(bike));
    setEditPhotoFiles([]);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditStockNumber("");
    setEditMotorcycleName("");
    setEditCostPrice("");
    setEditStockStatus("in_stock");
    setEditDetails(createEmptyDetails());
    setEditPhotoFiles([]);
  }

  async function saveEdit(bike: StockMotorcycle) {
    if (!editMotorcycleName.trim()) {
      alert("กรุณากรอกชื่อรถ");
      return;
    }

    if (
      isStockStaff &&
      (editStockStatus === "in_auction" || editStockStatus === "sold") &&
      editStockStatus !== bike.stock_status
    ) {
      alert("เจ้าหน้าที่รับรถไม่สามารถเปลี่ยนเป็นสถานะนี้ได้");
      return;
    }

    setErrorMessage("");

    try {
      const updateInput = {
        stock_number: editStockNumber.trim() || null,
        motorcycle_name: editMotorcycleName.trim(),
        cost_price: cleanMoney(editCostPrice),
        stock_status: editStockStatus,
        ...cleanDetails(editDetails),
        updated_at: new Date().toISOString(),
      };

      const { error: stockError } = await supabase
        .from("stock_motorcycles")
        .update(updateInput)
        .eq("id", bike.id);

      if (stockError) {
        throw stockError;
      }

      const uploadedPhotoCount = await uploadMultipleStockPhotos(
        editPhotoFiles,
        bike.id,
        editStockNumber || editMotorcycleName
      );

      if (bike.current_auction_motorcycle_id) {
        const { error: auctionUpdateError } = await supabase
          .from("motorcycles")
          .update({
            motorcycle_name: editMotorcycleName.trim(),
            cost_price: cleanMoney(editCostPrice),
            brand: editDetails.brand.trim() || null,
            model: editDetails.model.trim() || null,
            year: editDetails.year.trim() || null,
            color: editDetails.color.trim() || null,
            license_plate: editDetails.license_plate.trim() || null,
            mileage: editDetails.mileage.trim() || null,
            frame_number: editDetails.frame_number.trim() || null,
            engine_number: editDetails.engine_number.trim() || null,
            registration_status:
              editDetails.registration_status.trim() || null,
            tax_expiry: editDetails.tax_expiry.trim() || null,
            condition: editDetails.condition.trim() || null,
            notes: editDetails.notes.trim() || null,
            purchase_date: editDetails.purchase_date.trim() || null,
            acquisition_type: editDetails.acquisition_type.trim() || null,
            source_name: editDetails.source_name.trim() || null,
            repair_notes: editDetails.repair_notes.trim() || null,
          })
          .eq("id", bike.current_auction_motorcycle_id);

        if (auctionUpdateError) {
          throw auctionUpdateError;
        }
      }

      await createAuditLog({
        action: "stock_motorcycle_updated",
        targetType: "stock_motorcycle",
        targetId: String(bike.id),
        targetName: `${
          editStockNumber || "ไม่มีเลขสต็อก"
        } • ${editMotorcycleName}`,
        details: {
          before: getStockDetailPayload(bike),
          after: {
            stock_motorcycle_id: bike.id,
            stock_number: editStockNumber.trim() || "",
            motorcycle_name: editMotorcycleName.trim(),
            cost_price: cleanMoney(editCostPrice),
            stock_status: editStockStatus,
            stock_status_thai: getStatusLabel(editStockStatus),
            uploaded_photo_count: uploadedPhotoCount,
            synced_to_auction_motorcycle_id:
              bike.current_auction_motorcycle_id || null,
            ...cleanDetails(editDetails),
          },
        },
      });

      cancelEditing();
      await loadStockMotorcycles();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างแก้ไขรถในคลัง";

      setErrorMessage(message);
    }
  }

  async function sendToAuction(bike: StockMotorcycle) {
    if (!canManageAuctionFromStock) {
      alert(
        "เจ้าหน้าที่รับรถสามารถเพิ่ม/แก้ไขรถในคลังได้ แต่ไม่สามารถนำรถเข้ารอบ Auction ได้"
      );
      return;
    }

    if (!currentRound) {
      alert("ยังไม่มีรอบ Auction ปัจจุบัน กรุณาสร้างรอบจากหน้า Admin ก่อน");
      return;
    }

    if (currentRound.status === "closed" || currentRound.status === "archived") {
      alert("รอบ Auction ปัจจุบันปิดแล้ว กรุณาเปิดรอบหรือสร้างรอบใหม่ก่อน");
      return;
    }

    if (bike.current_auction_motorcycle_id || bike.stock_status === "in_auction") {
      alert("รถคันนี้ถูกนำเข้ารอบ Auction แล้ว");
      return;
    }

    if (bike.stock_status === "sold") {
      alert("รถคันนี้ขายแล้ว ไม่สามารถนำเข้ารอบ Auction ใหม่ได้");
      return;
    }

    if (bike.stock_status === "repairing") {
      alert("รถคันนี้ยังอยู่ระหว่างซ่อม กรุณาเปลี่ยนสถานะเป็นพร้อมขายก่อน");
      return;
    }

    if (bike.stock_status === "cancelled") {
      alert("รถคันนี้ถูกยกเลิกแล้ว ไม่สามารถนำเข้ารอบ Auction ได้");
      return;
    }

    const roundName = currentRound.round_name || `Round ${currentRound.id}`;

    const confirmSend = confirm(
      `ต้องการนำ "${bike.motorcycle_name}" เข้ารอบ "${roundName}" ใช่หรือไม่?`
    );

    if (!confirmSend) return;

    setSendingToAuctionId(bike.id);
    setErrorMessage("");

    try {
      const lotNumber = bike.stock_number || `STOCK-${bike.id}`;

      const firstPhoto = bike.stock_motorcycle_photos?.[0]?.image_url || null;

      const { data: auctionMotorcycle, error: auctionError } = await supabase
        .from("motorcycles")
        .insert({
          lot_number: lotNumber,
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

      if (auctionError) {
        throw auctionError;
      }

      if (bike.stock_motorcycle_photos?.length > 0) {
        const auctionPhotoRows = bike.stock_motorcycle_photos.map((photo) => ({
          motorcycle_id: auctionMotorcycle.id,
          image_url: photo.image_url,
        }));

        const { error: photoCopyError } = await supabase
          .from("motorcycle_photos")
          .insert(auctionPhotoRows);

        if (photoCopyError) {
          throw photoCopyError;
        }
      }

      const { error: stockUpdateError } = await supabase
        .from("stock_motorcycles")
        .update({
          stock_status: "in_auction",
          current_auction_motorcycle_id: auctionMotorcycle.id,
          current_auction_round_id: currentRound.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bike.id);

      if (stockUpdateError) {
        throw stockUpdateError;
      }

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
          lot_number: lotNumber,
          copied_photo_count: bike.stock_motorcycle_photos?.length || 0,
        },
      });

      await loadStockMotorcycles();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างนำรถเข้ารอบ Auction";

      setErrorMessage(message);
    }

    setSendingToAuctionId(null);
  }

  async function deleteStockMotorcycle(bike: StockMotorcycle) {
    if (!canManageAuctionFromStock) {
      alert(
        "เจ้าหน้าที่รับรถสามารถเพิ่ม/แก้ไขรถในคลังได้ แต่ไม่สามารถลบรถออกจากคลังได้"
      );
      return;
    }

    if (bike.current_auction_motorcycle_id) {
      alert("รถคันนี้ถูกนำเข้ารอบ Auction แล้ว แนะนำให้เปลี่ยนสถานะแทนการลบ");
      return;
    }

    const confirmDelete = confirm(
      `ต้องการลบ "${bike.motorcycle_name}" ออกจากคลังใช่หรือไม่?`
    );

    if (!confirmDelete) return;

    setErrorMessage("");

    try {
      const { error: photosError } = await supabase
        .from("stock_motorcycle_photos")
        .delete()
        .eq("stock_motorcycle_id", bike.id);

      if (photosError) {
        throw photosError;
      }

      const { error: stockError } = await supabase
        .from("stock_motorcycles")
        .delete()
        .eq("id", bike.id);

      if (stockError) {
        throw stockError;
      }

      await createAuditLog({
        action: "stock_motorcycle_deleted",
        targetType: "stock_motorcycle",
        targetId: String(bike.id),
        targetName: getStockTargetName(bike),
        details: getStockDetailPayload(bike),
      });

      await loadStockMotorcycles();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างลบรถออกจากคลัง";

      setErrorMessage(message);
    }
  }

  async function deletePhoto(photo: StockPhoto, bike: StockMotorcycle) {
    const confirmDelete = confirm("ต้องการลบรูปนี้ใช่หรือไม่?");

    if (!confirmDelete) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("stock_motorcycle_photos")
      .delete()
      .eq("id", photo.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await createAuditLog({
      action: "stock_motorcycle_photo_deleted",
      targetType: "stock_motorcycle",
      targetId: String(bike.id),
      targetName: getStockTargetName(bike),
      details: {
        stock_motorcycle_id: bike.id,
        deleted_photo_id: photo.id,
        deleted_photo_url: photo.image_url,
      },
    });

    await loadStockMotorcycles();
  }

  function renderDetailInputs(
    currentDetails: MotorcycleDetails,
    setCurrentDetails: (value: MotorcycleDetails) => void
  ) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {detailFields.map((field) => {
          const value = currentDetails[field.key];

          if (field.key === "acquisition_type") {
            return (
              <div key={field.key}>
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                </label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={value}
                  onChange={(event) =>
                    setCurrentDetails({
                      ...currentDetails,
                      acquisition_type: event.target.value as AcquisitionType,
                    })
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

          if (field.multiline) {
            return (
              <div key={field.key} className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                </label>

                <textarea
                  className="mt-2 min-h-24 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) =>
                    setCurrentDetails({
                      ...currentDetails,
                      [field.key]: event.target.value,
                    })
                  }
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label className="text-sm font-medium text-gray-700">
                {field.label}
              </label>

              <input
                type={field.type || "text"}
                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder={field.placeholder}
                value={value}
                onChange={(event) =>
                  setCurrentDetails({
                    ...currentDetails,
                    [field.key]: event.target.value,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    );
  }

  const filteredStockMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return stockMotorcycles.filter((bike) => {
      const searchableText = [
        bike.stock_number,
        bike.motorcycle_name,
        bike.brand,
        bike.model,
        bike.year,
        bike.color,
        bike.license_plate,
        bike.frame_number,
        bike.engine_number,
        bike.acquisition_type,
        bike.source_name,
        bike.stock_status,
        getStatusLabel(bike.stock_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);

      const matchesStatus =
        statusFilter === "all" || bike.stock_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [stockMotorcycles, searchText, statusFilter]);

  const totalCost = stockMotorcycles.reduce((sum, bike) => {
    return sum + Number(bike.cost_price || 0);
  }, 0);

  const readyCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "ready_to_sell"
  ).length;

  const inAuctionCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "in_auction"
  ).length;

  const soldCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "sold"
  ).length;

  const inStockCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "in_stock"
  ).length;

  const repairingCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "repairing"
  ).length;

  const cancelledCount = stockMotorcycles.filter(
    (bike) => bike.stock_status === "cancelled"
  ).length;

  const stockFilterOptions: {
    value: "all" | StockStatus;
    label: string;
    count: number;
  }[] = [
    {
      value: "all",
      label: "ทั้งหมด",
      count: stockMotorcycles.length,
    },
    {
      value: "ready_to_sell",
      label: "พร้อมขาย",
      count: readyCount,
    },
    {
      value: "in_auction",
      label: "อยู่ใน Auction",
      count: inAuctionCount,
    },
    {
      value: "sold",
      label: "ขายแล้ว",
      count: soldCount,
    },
    {
      value: "in_stock",
      label: "อยู่ในสต็อก",
      count: inStockCount,
    },
    {
      value: "repairing",
      label: "กำลังซ่อม",
      count: repairingCount,
    },
    {
      value: "cancelled",
      label: "ยกเลิก",
      count: cancelledCount,
    },
  ];

  useEffect(() => {
    loadStockMotorcycles();
    loadCurrentAuctionRound();
  }, []);

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Stock
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                คลังรถบริษัท
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                เพิ่มรถเข้าคลัง เก็บข้อมูลต้นทุน รูปภาพ และเลือกนำเข้ารอบ Auction ปัจจุบัน
              </p>

              {isStockStaff && (
                <p className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                  เจ้าหน้าที่รับรถ: เพิ่ม/แก้ไขข้อมูลรถในคลังได้เท่านั้น
                </p>
              )}
            </div>

            <button
              onClick={() => {
                loadStockMotorcycles();
                loadCurrentAuctionRound();
              }}
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

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                  Current Auction Round
                </p>

                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  รอบ Auction ปัจจุบัน
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  รถที่นำเข้ารอบปัจจุบัน จากหน้านี้จะถูกผูกกับรอบปัจจุบัน
                </p>
              </div>

              <button
                type="button"
                onClick={loadCurrentAuctionRound}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-100"
              >
                โหลดรอบใหม่
              </button>
            </div>

            {isLoadingCurrentRound ? (
              <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                กำลังโหลดรอบ Auction ปัจจุบัน...
              </div>
            ) : currentRound ? (
              <div className="mt-4 grid gap-3 rounded-2xl border bg-gray-50 p-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อรอบ</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {currentRound.round_name || `Round ${currentRound.id}`}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">วันที่ประมูล</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {currentRound.auction_date || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">สถานะรอบ</p>
                  <p className="mt-1 font-bold text-blue-700">
                    {getRoundStatusLabel(currentRound.status)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">รหัสรอบ</p>
                  <p className="mt-1 font-bold text-gray-900">
                    #{currentRound.id}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                <p className="font-bold">ยังไม่มีรอบ Auction ปัจจุบัน</p>
                <p className="mt-1 text-sm">
                  กรุณาไปหน้า Admin แล้วสร้างรอบ Auction ปัจจุบันก่อนนำรถเข้า Auction
                </p>
              </div>
            )}
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">รถทั้งหมด</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {stockMotorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">พร้อมขาย</p>
              <p className="mt-2 text-2xl font-bold text-green-700">
                {readyCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">อยู่ใน Auction</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {inAuctionCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ขายแล้ว</p>
              <p className="mt-2 text-2xl font-bold text-purple-700">
                {soldCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ต้นทุนรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-orange-700">
                {totalCost.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">บาท</p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <h2 className="text-xl font-bold text-gray-900">
              เพิ่มรถเข้าคลัง
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              รถที่เพิ่มในหน้านี้ยังไม่แสดงให้ร้านค้าเห็น จนกว่าจะนำเข้ารอบ Auction ปัจจุบัน
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  เลขสต็อก / Lot ที่ต้องการ
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น A001"
                  value={stockNumber}
                  onChange={(event) => setStockNumber(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ชื่อรถ
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น Honda Wave 110i"
                  value={motorcycleName}
                  onChange={(event) => setMotorcycleName(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  ต้นทุน
                </label>

                <input
                  inputMode="decimal"
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น 12000"
                  value={costPrice}
                  onChange={(event) => setCostPrice(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  สถานะ
                </label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={stockStatus}
                  onChange={(event) =>
                    setStockStatus(event.target.value as StockStatus)
                  }
                >
                  {addStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  รูปรถ
                </label>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="mt-2 w-full rounded-2xl border bg-white p-3 outline-none"
                  onChange={(event) =>
                    setPhotoFiles(Array.from(event.target.files || []))
                  }
                />

                <p className="mt-1 text-xs text-gray-500">
                  เลือกได้หลายรูป เช่น 5–7 รูปต่อคัน
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <h3 className="font-bold text-gray-900">รายละเอียดรถ</h3>

              <div className="mt-4">
                {renderDetailInputs(details, setDetails)}
              </div>
            </div>

            <button
              onClick={addStockMotorcycle}
              disabled={isAdding}
              className="mt-5 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มรถเข้าคลัง"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รายการรถในคลัง
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  ค้นหาและจัดการรถทั้งหมดในคลังบริษัท
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {stockFilterOptions.map((option) => {
                const isSelected = statusFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={
                      isSelected
                        ? "rounded-full bg-black px-4 py-2 text-sm font-bold text-white"
                        : "rounded-full border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    }
                  >
                    {option.label} ({option.count})
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
              <input
                className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="ค้นหาเลขสต็อก / ชื่อรถ / รุ่น / ทะเบียน / ซื้อ/เทิร์น / มาจาก"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              <select
                className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | StockStatus)
                }
              >
                <option value="all">ทุกสถานะ</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {statusFilter !== "all" && (
              <div className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {getStatusLabel(statusFilter)}:
                </span>{" "}
                {getStockStatusDescription(statusFilter)}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            )}

            {!isLoading && filteredStockMotorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">ไม่พบข้อมูลรถ</p>
                <p className="mt-1 text-sm text-gray-600">
                  ลองเปลี่ยนคำค้นหาหรือตัวกรอง
                </p>
              </div>
            )}

            {!isLoading && filteredStockMotorcycles.length > 0 && (
              <div className="mt-4 space-y-4">
                {filteredStockMotorcycles.map((bike) => {
                  const isEditing = editingId === bike.id;

                  return (
                    <article
                      key={bike.id}
                      className="overflow-hidden rounded-3xl border bg-white shadow-sm"
                    >
                      {bike.stock_motorcycle_photos?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto bg-gray-100 p-3">
                          {bike.stock_motorcycle_photos.map((photo) => (
                            <div key={photo.id} className="relative shrink-0">
                              <img
                                src={photo.image_url}
                                alt={bike.motorcycle_name}
                                className="h-32 w-44 rounded-2xl bg-white object-contain"
                              />

                              <button
                                onClick={() => deletePhoto(photo, bike)}
                                className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {bike.stock_number || "ไม่มีเลขสต็อก"}
                              </p>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(
                                  bike.stock_status
                                )}`}
                              >
                                {getStatusLabel(bike.stock_status)}
                              </span>

                              {bike.current_auction_motorcycle_id && (
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                  เข้ารอบ Auction แล้ว
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2 text-lg font-bold text-gray-900">
                              {bike.motorcycle_name}
                            </h3>

                            <p className="mt-1 text-sm text-gray-600">
                              {bike.brand || "-"} {bike.model || ""}{" "}
                              {bike.year || ""}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              ทะเบียน: {bike.license_plate || "-"}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              ซื้อ/เทิร์น: {bike.acquisition_type || "-"} •
                              มาจาก: {bike.source_name || "-"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-gray-500">ต้นทุน</p>
                            <p className="text-xl font-bold text-orange-700">
                              {Number(bike.cost_price || 0).toLocaleString()}{" "}
                              บาท
                            </p>
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => startEditing(bike)}
                              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                            >
                              แก้ไข
                            </button>

                            {canManageAuctionFromStock && (
                              <>
                                <button
                                  onClick={() => sendToAuction(bike)}
                                  disabled={
                                    !canSendStockBikeToRound(bike) ||
                                    sendingToAuctionId === bike.id
                                  }
                                  className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                  title={getStockStatusDescription(bike.stock_status)}
                                >
                                  {getSendToRoundButtonText(
                                    bike,
                                    sendingToAuctionId
                                  )}
                                </button>

                                <button
                                  onClick={() => deleteStockMotorcycle(bike)}
                                  className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                                >
                                  ลบจากคลัง
                                </button>
                              </>
                            )}

                            {isStockStaff && (
                              <p className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                                เพิ่ม/แก้ไขข้อมูลได้เท่านั้น
                              </p>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                            <h4 className="font-bold text-gray-900">
                              แก้ไขข้อมูลรถ
                            </h4>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  เลขสต็อก
                                </label>

                                <input
                                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                  value={editStockNumber}
                                  onChange={(event) =>
                                    setEditStockNumber(event.target.value)
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  ชื่อรถ
                                </label>

                                <input
                                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                  value={editMotorcycleName}
                                  onChange={(event) =>
                                    setEditMotorcycleName(event.target.value)
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  ต้นทุน
                                </label>

                                <input
                                  inputMode="decimal"
                                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                  value={editCostPrice}
                                  onChange={(event) =>
                                    setEditCostPrice(event.target.value)
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  สถานะ
                                </label>

                                <select
                                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                  value={editStockStatus}
                                  onChange={(event) =>
                                    setEditStockStatus(
                                      event.target.value as StockStatus
                                    )
                                  }
                                >
                                  {editStatusOptions.map((status) => (
                                    <option
                                      key={status.value}
                                      value={status.value}
                                    >
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">
                                  เพิ่มรูปใหม่
                                </label>

                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  className="mt-2 w-full rounded-2xl border bg-white p-3 outline-none"
                                  onChange={(event) =>
                                    setEditPhotoFiles(
                                      Array.from(event.target.files || [])
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-5 rounded-2xl bg-white p-4">
                              {renderDetailInputs(
                                editDetails,
                                setEditDetails
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => saveEdit(bike)}
                                className="rounded-xl bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800"
                              >
                                บันทึก
                              </button>

                              <button
                                onClick={cancelEditing}
                                className="rounded-xl border px-4 py-2 font-semibold hover:bg-gray-100"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
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