"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

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
};

type DetailKey = keyof MotorcycleDetails;

type Motorcycle = MotorcycleDetails & {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  cost_price: number | null;
  active: boolean;
  created_at: string;
  motorcycle_photos: MotorcyclePhoto[];
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

type StatusFilter = "all" | "active" | "hidden";

const ITEMS_PER_PAGE = 5;

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
    mileage: "",
    frame_number: "",
    engine_number: "",
    registration_status: "",
    tax_expiry: "",
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

function getDetailsFromBike(bike: Motorcycle): MotorcycleDetails {
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [openDetailIds, setOpenDetailIds] = useState<number[]>([]);

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
      mileage: bike.mileage || "",
      frame_number: bike.frame_number || "",
      engine_number: bike.engine_number || "",
      registration_status: bike.registration_status || "",
      tax_expiry: bike.tax_expiry || "",
      condition: bike.condition || "",
      notes: bike.notes || "",
      active: bike.active,
      photo_count: bike.motorcycle_photos?.length || 0,
    };
  }

  async function uploadPhoto(file: File, lot: string) {
    const fileExtension = file.name.split(".").pop();
    const safeLot = lot.replaceAll(" ", "-");

    const filePath = `${safeLot}-${Date.now()}-${Math.random()
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

    const { data, error } = await supabase
      .from("motorcycles")
      .select(`
        id,
        lot_number,
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
        active,
        created_at,
        motorcycle_photos (
          id,
          image_url
        )
      `)
      .order("lot_number");

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMotorcycles((data as Motorcycle[]) || []);
    setIsLoading(false);
  }

  async function addMotorcycle() {
    if (!lotNumber || !motorcycleName) {
      alert("กรุณากรอกเลข Lot และชื่อรถ");
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
        .select()
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
          mileage: motorcycleData.mileage || "",
          frame_number: motorcycleData.frame_number || "",
          engine_number: motorcycleData.engine_number || "",
          registration_status: motorcycleData.registration_status || "",
          tax_expiry: motorcycleData.tax_expiry || "",
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
      setIsAdding(false);
      loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เพิ่มรายการรถไม่สำเร็จ"
      );
      setIsAdding(false);
    }
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
    if (!editLotNumber || !editMotorcycleName) {
      alert("กรุณากรอกเลข Lot และชื่อรถ");
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
      loadMotorcycles();
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

    loadMotorcycles();
  }

  async function toggleActive(bike: Motorcycle) {
    setErrorMessage("");

    const oldActive = bike.active;
    const newActive = !bike.active;

    const confirmToggle = confirm(
      newActive
        ? `ต้องการแสดง Lot ${bike.lot_number} ให้ร้านค้าเห็นใช่หรือไม่?`
        : `ต้องการซ่อน Lot ${bike.lot_number} จากร้านค้าใช่หรือไม่?`
    );

    if (!confirmToggle) return;

    const { error } = await supabase
      .from("motorcycles")
      .update({
        active: newActive,
      })
      .eq("id", bike.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await createAuditLog({
      action: "motorcycle_active_changed",
      targetType: "motorcycle",
      targetId: String(bike.id),
      targetName: getMotorcycleTargetName(bike),
      details: {
        motorcycle_id: bike.id,
        lot_number: bike.lot_number,
        motorcycle_name: bike.motorcycle_name,
        old_active: oldActive,
        new_active: newActive,
        old_status_thai: oldActive ? "แสดงอยู่" : "ซ่อนอยู่",
        new_status_thai: newActive ? "แสดงอยู่" : "ซ่อนอยู่",
      },
    });

    loadMotorcycles();
  }

  async function deleteMotorcycle(bike: Motorcycle) {
    const confirmDelete = confirm(
      `ต้องการลบ Lot ${bike.lot_number} ถาวรใช่หรือไม่? ถ้ารถมีรายการเสนอราคาแล้ว อาจลบไม่ได้ แนะนำให้กดซ่อนแทน`
    );

    if (!confirmDelete) return;

    const secondConfirm = confirm(
      "ยืนยันอีกครั้ง: การลบรายการรถอาจกระทบข้อมูลเดิม ต้องการทำต่อหรือไม่?"
    );

    if (!secondConfirm) return;

    setErrorMessage("");

    const oldBikeData = getMotorcycleDetailPayload(bike);

    const { error } = await supabase
      .from("motorcycles")
      .delete()
      .eq("id", bike.id);

    if (error) {
      setErrorMessage(
        "ลบไม่ได้ เพราะรายการนี้อาจมีราคาเสนออยู่แล้ว แนะนำให้ใช้ปุ่มซ่อนแทน"
      );
      return;
    }

    await createAuditLog({
      action: "motorcycle_deleted",
      targetType: "motorcycle",
      targetId: String(bike.id),
      targetName: getMotorcycleTargetName(bike),
      details: {
        deleted_data: oldBikeData,
      },
    });

    loadMotorcycles();
  }

  function toggleDetail(bikeId: number) {
    setOpenDetailIds((current) =>
      current.includes(bikeId)
        ? current.filter((id) => id !== bikeId)
        : [...current, bikeId]
    );
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
                onChange={(e) =>
                  setValue((current) => ({
                    ...current,
                    [field.key]: e.target.value,
                  }))
                }
              />
            ) : (
              <input
                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder={field.placeholder}
                value={value[field.key]}
                onChange={(e) =>
                  setValue((current) => ({
                    ...current,
                    [field.key]: e.target.value,
                  }))
                }
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderBikeDetails(bike: Motorcycle) {
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
      ["สภาพรถ", bike.condition],
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
          หน้า {safeCurrentPage} / {totalPages} • แสดงทีละ {ITEMS_PER_PAGE}{" "}
          รายการ
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
  }, [searchText, statusFilter]);

  const activeCount = motorcycles.filter((bike) => bike.active).length;
  const hiddenCount = motorcycles.filter((bike) => !bike.active).length;

  const totalPhotos = motorcycles.reduce((sum, bike) => {
    return sum + (bike.motorcycle_photos?.length || 0);
  }, 0);

  const totalCost = motorcycles.reduce((sum, bike) => {
    return sum + Number(bike.cost_price || 0);
  }, 0);

  const filteredMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return motorcycles.filter((bike) => {
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && bike.active) ||
        (statusFilter === "hidden" && !bike.active);

      const searchableText = [
        bike.lot_number,
        bike.motorcycle_name,
        bike.brand,
        bike.model,
        bike.year,
        bike.color,
        bike.license_plate,
        bike.mileage,
        bike.frame_number,
        bike.engine_number,
        bike.registration_status,
        bike.tax_expiry,
        bike.condition,
        bike.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = !keyword || searchableText.includes(keyword);

      return matchStatus && matchSearch;
    });
  }, [motorcycles, searchText, statusFilter]);

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
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                จัดการระบบ
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รายการรถจักรยานยนต์
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                เพิ่มรถ อัปโหลดรูป แก้ไขรายละเอียด ต้นทุน และเปิด/ซ่อนรายการ
              </p>
            </div>

            <button
              onClick={loadMotorcycles}
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
              <p className="text-sm font-medium text-gray-500">รายการทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {motorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">เปิดใช้งาน</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">ซ่อน: {hiddenCount}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">รูปทั้งหมด</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalPhotos}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">ต้นทุนรวม</p>
              <p className="mt-2 text-2xl font-bold text-orange-700">
                {totalCost.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">บาท</p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">เพิ่มรายการรถ</h2>

            <p className="mt-1 text-sm text-gray-600">
              เพิ่มข้อมูลรถ ต้นทุน และอัปโหลดรูปหลายรูปได้
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  เลข Lot
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="เช่น 004"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
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
                  onChange={(e) => setMotorcycleName(e.target.value)}
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
                  onChange={(e) =>
                    setCostPrice(e.target.value.replace(/[^\d.]/g, ""))
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
                onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
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

          <section
            ref={listSectionRef}
           className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
            >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รายการรถทั้งหมด
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  ค้นหา กรองสถานะ แบ่งหน้า และกดเปิดรายละเอียดเฉพาะรายการที่ต้องการ
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                แสดง {paginatedMotorcycles.length} จาก{" "}
                {filteredMotorcycles.length} รายการ
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  ค้นหา
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="ค้นหา Lot / ชื่อรถ / รุ่น / ทะเบียน / เลขตัวถัง"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  สถานะ
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="active">แสดงอยู่</option>
                  <option value="hidden">ซ่อนอยู่</option>
                </select>
              </div>
            </div>

            {(searchText || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("all");
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
                    ลองเปลี่ยนคำค้นหาหรือสถานะตัวกรอง
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
                        <div className="bg-gray-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Lot {bike.lot_number}
                              </p>

                              <h3 className="mt-1 text-lg font-bold text-gray-900">
                                {bike.motorcycle_name}
                              </h3>

                              <p className="mt-2 text-sm font-semibold text-orange-700">
                                ต้นทุน:{" "}
                                {bike.cost_price
                                  ? `${Number(
                                      bike.cost_price
                                    ).toLocaleString()} บาท`
                                  : "-"}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {bike.active ? (
                                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                                  แสดงอยู่
                                </span>
                              ) : (
                                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                                  ซ่อนอยู่
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleDetail(bike.id)}
                                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
                              >
                                {isDetailOpen
                                  ? "ซ่อนรายละเอียด ▲"
                                  : "ดูรายละเอียด ▼"}
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
                                  แก้ไขรายการรถ
                                </h4>

                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">
                                      เลข Lot
                                    </label>

                                    <input
                                      className="mt-1 w-full rounded-xl border p-3"
                                      value={editLotNumber}
                                      onChange={(e) =>
                                        setEditLotNumber(e.target.value)
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
                                      onChange={(e) =>
                                        setEditMotorcycleName(e.target.value)
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
                                      onChange={(e) =>
                                        setEditCostPrice(
                                          e.target.value.replace(/[^\d.]/g, "")
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
                                    onChange={(e) =>
                                      setEditPhotoFiles(
                                        Array.from(e.target.files || [])
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
                                  onClick={() => toggleActive(bike)}
                                  className={
                                    bike.active
                                      ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
                                      : "rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                                  }
                                >
                                  {bike.active ? "ซ่อน" : "แสดง"}
                                </button>

                                <button
                                  onClick={() => deleteMotorcycle(bike)}
                                  className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                                >
                                  ลบรายการ
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