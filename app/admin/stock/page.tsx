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

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

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
    label: "อยู่ในการประมูล",
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
    key: "source_name",
    label: "ที่มาของรถ",
    placeholder: "เช่น ซื้อหน้าร้าน / ลูกค้าเก่า / ประมูล",
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
      source_name: bike.source_name || "",
      repair_notes: bike.repair_notes || "",
      stock_status: bike.stock_status,
      stock_status_thai: getStatusLabel(bike.stock_status),
      current_auction_motorcycle_id: bike.current_auction_motorcycle_id,
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
        source_name,
        repair_notes,
        stock_status,
        current_auction_motorcycle_id,
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
      setIsAdding(false);
      loadStockMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เพิ่มรถเข้าสต็อกไม่สำเร็จ"
      );
      setIsAdding(false);
    }
  }

  function startEditing(bike: StockMotorcycle) {
    setEditingId(bike.id);
    setEditStockNumber(bike.stock_number || "");
    setEditMotorcycleName(bike.motorcycle_name);
    setEditCostPrice(formatMoneyInput(bike.cost_price));
    setEditStockStatus(bike.stock_status);
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

  setErrorMessage("");

  try {
    const oldData = getStockDetailPayload(bike);

    const cleanedCostPrice = cleanMoney(editCostPrice);

    const updatedInput = {
      stock_number: editStockNumber.trim() || null,
      motorcycle_name: editMotorcycleName.trim(),
      cost_price: cleanedCostPrice,
      stock_status: editStockStatus,
      updated_at: new Date().toISOString(),
      ...cleanDetails(editDetails),
    };

    const { error } = await supabase
      .from("stock_motorcycles")
      .update(updatedInput)
      .eq("id", bike.id);

    if (error) {
      throw error;
    }

    const uploadedPhotoCount = await uploadMultipleStockPhotos(
      editPhotoFiles,
      bike.id,
      editStockNumber || editMotorcycleName
    );

    /*
      Important:
      Stock is now the master data.

      If this stock motorcycle was already sent to Auction,
      update the linked row in motorcycles too.

      We do NOT sync:
      - lot_number
      - active status
      - photos

      Because those belong to the auction side.
    */
    if (bike.current_auction_motorcycle_id) {
      const auctionUpdateInput = {
        motorcycle_name: editMotorcycleName.trim(),
        cost_price: cleanedCostPrice,
        brand: editDetails.brand.trim() || null,
        model: editDetails.model.trim() || null,
        year: editDetails.year.trim() || null,
        color: editDetails.color.trim() || null,
        license_plate: editDetails.license_plate.trim() || null,
        mileage: editDetails.mileage.trim() || null,
        frame_number: editDetails.frame_number.trim() || null,
        engine_number: editDetails.engine_number.trim() || null,
        registration_status: editDetails.registration_status.trim() || null,
        tax_expiry: editDetails.tax_expiry.trim() || null,
        condition: editDetails.condition.trim() || null,
        notes: editDetails.notes.trim() || null,
      };

      const { error: auctionUpdateError } = await supabase
        .from("motorcycles")
        .update(auctionUpdateInput)
        .eq("id", bike.current_auction_motorcycle_id);

      if (auctionUpdateError) {
        throw auctionUpdateError;
      }
    }

    await createAuditLog({
      action: "stock_motorcycle_updated",
      targetType: "stock_motorcycle",
      targetId: String(bike.id),
      targetName: `${editStockNumber.trim() || "ไม่มีเลขสต็อก"} • ${editMotorcycleName.trim()}`,
      details: {
        old_data: oldData,
        new_data: {
          stock_motorcycle_id: bike.id,
          stock_number: editStockNumber.trim() || "",
          motorcycle_name: editMotorcycleName.trim(),
          cost_price: cleanedCostPrice,
          stock_status: editStockStatus,
          stock_status_thai: getStatusLabel(editStockStatus),
          linked_auction_motorcycle_id:
            bike.current_auction_motorcycle_id || null,
          synced_to_auction: Boolean(bike.current_auction_motorcycle_id),
          ...cleanDetails(editDetails),
        },
        uploaded_photo_count: uploadedPhotoCount,
      },
    });

    cancelEditing();
    loadStockMotorcycles();

    if (bike.current_auction_motorcycle_id) {
      alert("บันทึกข้อมูลแล้ว และอัปเดตรายการ Auction ที่เชื่อมอยู่แล้ว");
    } else {
      alert("บันทึกข้อมูลรถในคลังเรียบร้อยแล้ว");
    }
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ"
    );
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
        stock_number: bike.stock_number || "",
        motorcycle_name: bike.motorcycle_name,
        photo_id: photo.id,
        photo_url: photo.image_url,
        photo_count_before_delete: bike.stock_motorcycle_photos?.length || 0,
      },
    });

    loadStockMotorcycles();
  }

  async function deleteStockMotorcycle(bike: StockMotorcycle) {
    if (bike.current_auction_motorcycle_id) {
      alert("รถคันนี้ถูกนำเข้า Auction แล้ว แนะนำให้เปลี่ยนสถานะ แทนการลบ");
      return;
    }

    const confirmDelete = confirm(
      `ต้องการลบ ${getStockTargetName(
        bike
      )} ออกจากคลังรถถาวรใช่หรือไม่?`
    );

    if (!confirmDelete) return;

    const secondConfirm = confirm(
      "ยืนยันอีกครั้ง: การลบจะลบข้อมูลและรูปของรถคันนี้จากคลังรถ ต้องการทำต่อหรือไม่?"
    );

    if (!secondConfirm) return;

    setErrorMessage("");

    const oldData = getStockDetailPayload(bike);

    const { error } = await supabase
      .from("stock_motorcycles")
      .delete()
      .eq("id", bike.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await createAuditLog({
      action: "stock_motorcycle_deleted",
      targetType: "stock_motorcycle",
      targetId: String(bike.id),
      targetName: getStockTargetName(bike),
      details: {
        deleted_data: oldData,
      },
    });

    loadStockMotorcycles();
  }

  async function sendToAuction(bike: StockMotorcycle) {
    if (bike.current_auction_motorcycle_id) {
      alert("รถคันนี้ถูกนำเข้า Auction แล้ว");
      return;
    }

    const defaultLot = bike.stock_number || "";
    const lotNumber = prompt(
      `กรอกเลข Lot สำหรับ Auction\nรถ: ${bike.motorcycle_name}`,
      defaultLot
    );

    if (!lotNumber || !lotNumber.trim()) {
      return;
    }

    const confirmSend = confirm(
      `ต้องการนำ ${bike.motorcycle_name} เข้า Auction เป็น Lot ${lotNumber.trim()} ใช่หรือไม่?`
    );

    if (!confirmSend) return;

    setSendingToAuctionId(bike.id);
    setErrorMessage("");

    try {
      const auctionInput = {
        stock_motorcycle_id: bike.id,
        lot_number: lotNumber.trim(),
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
        active: true,
      };

      const { data: auctionBike, error: auctionError } = await supabase
        .from("motorcycles")
        .insert(auctionInput)
        .select()
        .single();

      if (auctionError) {
        throw auctionError;
      }

      const stockPhotos = bike.stock_motorcycle_photos || [];

      if (stockPhotos.length > 0) {
        const auctionPhotoRows = stockPhotos.map((photo) => ({
          motorcycle_id: auctionBike.id,
          image_url: photo.image_url,
        }));

        const { error: photoError } = await supabase
          .from("motorcycle_photos")
          .insert(auctionPhotoRows);

        if (photoError) {
          throw photoError;
        }
      }

      const { error: stockUpdateError } = await supabase
        .from("stock_motorcycles")
        .update({
          stock_status: "in_auction",
          current_auction_motorcycle_id: auctionBike.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bike.id);

      if (stockUpdateError) {
        throw stockUpdateError;
      }

      await createAuditLog({
        action: "stock_motorcycle_sent_to_auction",
        targetType: "stock_motorcycle",
        targetId: String(bike.id),
        targetName: getStockTargetName(bike),
        details: {
          stock_motorcycle_id: bike.id,
          stock_number: bike.stock_number || "",
          auction_motorcycle_id: auctionBike.id,
          lot_number: auctionBike.lot_number,
          motorcycle_name: auctionBike.motorcycle_name,
          copied_photo_count: stockPhotos.length,
        },
      });

      setSendingToAuctionId(null);
      loadStockMotorcycles();
      alert(`นำรถเข้า Auction เป็น Lot ${lotNumber.trim()} เรียบร้อยแล้ว`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "นำรถเข้า Auction ไม่สำเร็จ"
      );
      setSendingToAuctionId(null);
    }
  }

  function renderDetailInputs(
    value: MotorcycleDetails,
    setValue: React.Dispatch<React.SetStateAction<MotorcycleDetails>>
  ) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {detailFields.map((field) => (
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
                type={field.type || "text"}
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
        ))}
      </div>
    );
  }

  function renderBikeDetails(bike: StockMotorcycle) {
    const displayItems = [
      [
        "ต้นทุน",
        bike.cost_price ? `${Number(bike.cost_price).toLocaleString()} บาท` : "-",
      ],
      ["ยี่ห้อ", bike.brand],
      ["รุ่น", bike.model],
      ["ปี", bike.year],
      ["สี", bike.color],
      ["ทะเบียน", bike.license_plate],
      ["เลขไมล์", bike.mileage],
      ["เลขตัวถัง", bike.frame_number],
      ["เลขเครื่อง", bike.engine_number],
      ["สถานะเล่ม", bike.registration_status],
      ["ภาษีหมดอายุ", bike.tax_expiry],
      ["วันที่รับรถเข้า", bike.purchase_date],
      ["ที่มาของรถ", bike.source_name],
      ["สภาพรถ", bike.condition],
      ["หมายเหตุงานซ่อม", bike.repair_notes],
      ["หมายเหตุเพิ่มเติม", bike.notes],
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

  useEffect(() => {
    loadStockMotorcycles();
  }, []);

  const filteredStock = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return stockMotorcycles.filter((bike) => {
      const matchStatus =
        statusFilter === "all" || bike.stock_status === statusFilter;

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
        bike.source_name,
      ]
        .join(" ")
        .toLowerCase();

      const matchKeyword = !keyword || searchableText.includes(keyword);

      return matchStatus && matchKeyword;
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

  const totalPhotos = stockMotorcycles.reduce((sum, bike) => {
    return sum + (bike.stock_motorcycle_photos?.length || 0);
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
                คลังรถบริษัท
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                เก็บข้อมูลรถทั้งหมดก่อนเลือกนำเข้า Auction
              </p>
            </div>

            <button
              onClick={loadStockMotorcycles}
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

          <section className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">รถในคลังทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stockMotorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">พร้อมขาย</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {readyCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                อยู่ในการประมูล: {inAuctionCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">รูปทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalPhotos}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ต้นทุนรวมในคลัง</p>
              <p className="mt-2 text-2xl font-bold text-orange-700">
                {totalCost.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">บาท</p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">เพิ่มรถเข้าคลัง</h2>

            <p className="mt-1 text-sm text-gray-600">
              ข้อมูลนี้ยังไม่ใช่ Auction Lot จนกว่าจะกดนำเข้า Auction
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  เลขสต็อก
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น S001"
                  value={stockNumber}
                  onChange={(event) => setStockNumber(event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
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
                  สถานะ
                </label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={stockStatus}
                  onChange={(event) =>
                    setStockStatus(event.target.value as StockStatus)
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
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
              onClick={addStockMotorcycle}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มรถเข้าคลัง"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รายการรถในคลัง
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  ค้นหา กรองสถานะ แก้ไขข้อมูล และเลือกนำรถเข้า Auction
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                className="rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:col-span-2"
                placeholder="ค้นหาเลขสต็อก / ชื่อรถ / รุ่น / ทะเบียน / เลขตัวถัง"
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

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            )}

            {!isLoading && filteredStock.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">ไม่พบรายการรถในคลัง</p>
              </div>
            )}

            {!isLoading && filteredStock.length > 0 && (
              <div className="mt-5 space-y-5">
                {filteredStock.map((bike) => (
                  <article
                    key={bike.id}
                    className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                  >
                    <div className="border-b bg-gray-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            {bike.stock_number
                              ? `Stock ${bike.stock_number}`
                              : "ไม่มีเลขสต็อก"}
                          </p>

                          <h3 className="mt-1 text-lg font-bold text-gray-900">
                            {bike.motorcycle_name}
                          </h3>

                          <p className="mt-2 text-sm font-semibold text-orange-700">
                            ต้นทุน:{" "}
                            {bike.cost_price
                              ? `${Number(bike.cost_price).toLocaleString()} บาท`
                              : "-"}
                          </p>

                          {bike.current_auction_motorcycle_id && (
                            <p className="mt-1 text-sm font-medium text-blue-700">
                              ถูกนำเข้า Auction แล้ว
                            </p>
                          )}
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(
                            bike.stock_status
                          )}`}
                        >
                          {getStatusLabel(bike.stock_status)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      {bike.stock_motorcycle_photos?.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                          {bike.stock_motorcycle_photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="overflow-hidden rounded-2xl border bg-gray-50"
                            >
                              <img
                                src={photo.image_url}
                                alt={bike.motorcycle_name}
                                className="h-28 w-full object-cover"
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
                            แก้ไขข้อมูลรถในคลัง
                          </h4>

                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                เลขสต็อก
                              </label>

                              <input
                                className="mt-1 w-full rounded-xl border p-3"
                                value={editStockNumber}
                                onChange={(event) =>
                                  setEditStockNumber(event.target.value)
                                }
                              />
                            </div>

                            <div className="md:col-span-2">
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
                                สถานะ
                              </label>

                              <select
                                className="mt-1 w-full rounded-xl border p-3"
                                value={editStockStatus}
                                onChange={(event) =>
                                  setEditStockStatus(
                                    event.target.value as StockStatus
                                  )
                                }
                              >
                                {statusOptions.map((status) => (
                                  <option
                                    key={status.value}
                                    value={status.value}
                                  >
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
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
                                    event.target.value.replace(/[^\d.]/g, "")
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="mt-5">
                            {renderDetailInputs(editDetails, setEditDetails)}
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

                          <button
                            onClick={() => sendToAuction(bike)}
                            disabled={
                              Boolean(bike.current_auction_motorcycle_id) ||
                              sendingToAuctionId === bike.id
                            }
                            className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {sendingToAuctionId === bike.id
                              ? "กำลังนำเข้า Auction..."
                              : bike.current_auction_motorcycle_id
                                ? "เข้า Auction แล้ว"
                                : "นำเข้า Auction"}
                          </button>

                          <button
                            onClick={() => deleteStockMotorcycle(bike)}
                            className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                          >
                            ลบจากคลัง
                          </button>
                        </div>
                      )}
                    </div>
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