"use client";

import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";
import {
  handleInvalidRefreshToken,
  signOutAfterInvalidAuth,
} from "@/lib/authRecovery";
import { supabase } from "@/lib/supabase";

type RegistrationStatus = "" | "มีเล่ม" | "ปิดบัญชี" | "อื่น";

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active?: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  expiresAt?: number;
};

type StockPhoto = {
  id: number;
  image_url: string;
};

type StockMotorcycle = {
  id: number;
  stock_number: string | null;
  motorcycle_name: string | null;
  cost_price: number | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  license_plate: string | null;
  frame_number: string | null;
  registration_status: string | null;
  tax_expiry: string | null;
  notes: string | null;
  stock_status: string | null;
  stock_branch_code: string | null;
  stock_branch_name: string | null;
  created_by_staff_email: string | null;
  sent_to_center_at: string | null;
  is_complete: boolean | null;
  current_auction_motorcycle_id: number | null;
  current_auction_round_id: number | null;
  missing_detail_remark: string | null;
  stock_motorcycle_photos: StockPhoto[];
};

type StockEditForm = {
  stock_branch_code: string;
  brand: string;
  model: string;
  year: string;
  frame_number: string;
  license_plate: string;
  color: string;
  registration_status: RegistrationStatus;
  tax_expiry: string;
  cost_price: string;
  notes: string;
};

type BranchCode =
  | "all"
  | "bangkapi"
  | "bangbon"
  | "rangsit"
  | "sukhapiban3"
  | "tohlim"
  | "other";

const registrationStatusOptions: RegistrationStatus[] = [
  "",
  "มีเล่ม",
  "ปิดบัญชี",
  "อื่น",
];

const branchFilterOptions: { code: BranchCode; label: string }[] = [
  { code: "all", label: "ทั้งหมด" },
  { code: "bangkapi", label: "บางกะปิ" },
  { code: "bangbon", label: "บางบอน" },
  { code: "rangsit", label: "รังสิต" },
  { code: "sukhapiban3", label: "สุขาภิบาล3" },
  { code: "tohlim", label: "โต๊ะลิ้ม" },
  { code: "other", label: "อื่น" },
];

const BRANCH_OPTIONS = [
  { code: "bangkapi", name: "บางกะปิ", prefix: "A" },
  { code: "bangbon", name: "บางบอน", prefix: "B" },
  { code: "rangsit", name: "รังสิต", prefix: "C" },
  { code: "sukhapiban3", name: "สุขาภิบาล3", prefix: "D" },
  { code: "tohlim", name: "โต๊ะลิ้ม", prefix: "E" },
  { code: "other", name: "อื่นๆ", prefix: "F" },
] as const;

const BRANCH_BY_PREFIX = Object.fromEntries(
  BRANCH_OPTIONS.map((branch) => [branch.prefix, branch.name])
) as Record<string, string>;

const BRANCH_BY_CODE = Object.fromEntries(
  BRANCH_OPTIONS.map((branch) => [branch.code, branch.name])
) as Record<string, string>;

const BRANCH_CODE_BY_PREFIX = Object.fromEntries(
  BRANCH_OPTIONS.map((branch) => [branch.prefix, branch.code])
) as Record<string, string>;

function getSavedStaffProfile() {
  const savedProfileText = localStorage.getItem("staffProfile");
  if (!savedProfileText) return null;

  try {
    return JSON.parse(savedProfileText) as StaffProfile;
  } catch {
    return null;
  }
}

function saveStaffProfile(profile: StaffProfile) {
  const currentProfile = getSavedStaffProfile();
  const updatedProfile = {
    ...currentProfile,
    ...profile,
  };

  localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));
  return updatedProfile;
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;

  const numberValue = Number(cleaned);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toLocaleString("th-TH");
}

function formatMoneyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }

  return String(value);
}

function isRegistrationStatus(
  value?: string | null
): value is RegistrationStatus {
  return registrationStatusOptions.includes((value || "") as RegistrationStatus);
}

function normalizeFrameNumber(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function isAdminOrOwner(profile?: StaffProfile | null) {
  return profile?.role === "owner" || profile?.role === "admin";
}

function isSoldStockBike(bike: StockMotorcycle) {
  return bike.stock_status === "sold" || bike.stock_status === "ขายแล้ว";
}

function isStockBikeInAuction(bike: StockMotorcycle) {
  return Boolean(
    bike.stock_status === "in_auction" ||
      bike.stock_status === "อยู่ในรอบเสนอราคา" ||
      bike.current_auction_motorcycle_id ||
      bike.current_auction_round_id
  );
}

function getBranchWorkflowStatus(bike: StockMotorcycle) {
  return bike.is_complete === false ? "รอกรอกข้อมูล" : "รอส่งเข้าคลังกลาง";
}

function matchesBranchFilter(bike: StockMotorcycle, branchCode: BranchCode) {
  if (branchCode === "all") return true;

  return bike.stock_branch_code === branchCode;
}

function getBranchPrefix(stockNumber?: string | null) {
  return String(stockNumber || "").trim().charAt(0).toUpperCase();
}

function getDisplayBranch(row: {
  stock_branch_name?: string | null;
  stock_number?: string | null;
}) {
  const savedBranchName = row.stock_branch_name?.trim();

  if (savedBranchName && savedBranchName !== "-") {
    return savedBranchName;
  }

  return BRANCH_BY_PREFIX[getBranchPrefix(row.stock_number)] || "-";
}

function getEditableBranchCode(row: {
  stock_branch_code?: string | null;
  stock_number?: string | null;
}) {
  const savedBranchCode = row.stock_branch_code?.trim();

  if (savedBranchCode && BRANCH_BY_CODE[savedBranchCode]) {
    return savedBranchCode;
  }

  return BRANCH_CODE_BY_PREFIX[getBranchPrefix(row.stock_number)] || "";
}

function getMotorcycleTitle(bike: StockMotorcycle) {
  return (
    [bike.brand, bike.model].filter(Boolean).join(" ") ||
    bike.motorcycle_name ||
    "รอกรอกข้อมูล"
  );
}

function getDisplayBrand(bike: StockMotorcycle) {
  if (bike.brand?.trim()) return bike.brand.trim();

  const nameParts = (bike.motorcycle_name || "").trim().split(/\s+/);
  const [fallbackBrand = ""] = nameParts;

  return nameParts.length > 1 ? fallbackBrand : "";
}

function createStockEditForm(bike: StockMotorcycle): StockEditForm {
  return {
    stock_branch_code: getEditableBranchCode(bike),
    brand: bike.brand || getDisplayBrand(bike),
    model: bike.model || "",
    year: bike.year || "",
    frame_number: bike.frame_number || "",
    license_plate: bike.license_plate || "",
    color: bike.color || "",
    registration_status: isRegistrationStatus(bike.registration_status)
      ? bike.registration_status
      : "",
    tax_expiry: bike.tax_expiry || "",
    cost_price: formatMoneyInput(bike.cost_price),
    notes: bike.notes || "",
  };
}

export default function BranchStockPage() {
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return getSavedStaffProfile();
  });
  const [stockMotorcycles, setStockMotorcycles] = useState<StockMotorcycle[]>(
    []
  );
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<StockEditForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingStockId, setDeletingStockId] = useState<number | null>(null);
  const [sendingCenterId, setSendingCenterId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedBranchCode, setSelectedBranchCode] =
    useState<BranchCode>("all");

  const branchName = staffProfile?.branch_name?.trim() || "";
  const canViewAllBranches = isAdminOrOwner(staffProfile);
  const isStockStaff = staffProfile?.role === "stock_staff";
  const visibleStockMotorcycles = useMemo(() => {
    if (!canViewAllBranches) return stockMotorcycles;

    return stockMotorcycles.filter((bike) =>
      matchesBranchFilter(bike, selectedBranchCode)
    );
  }, [canViewAllBranches, selectedBranchCode, stockMotorcycles]);

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

  async function logoutStaff() {
    localStorage.removeItem("staffProfile");
    await signOutAfterInvalidAuth(supabase, "staff");
    window.location.href = "/staff-login";
  }

  async function refreshStaffProfile() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (
      await handleInvalidRefreshToken(
        userError,
        supabase,
        "staff",
        "/staff-login"
      )
    ) {
      return null;
    }

    if (userError || !userData.user) return null;

    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active, branch_code, branch_name")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (
      await handleInvalidRefreshToken(error, supabase, "staff", "/staff-login")
    ) {
      return null;
    }

    if (error || !data) return null;

    const updatedProfile = saveStaffProfile({
      id: data.id,
      email: data.email,
      role: data.role,
      active: data.active,
      branch_code: data.branch_code,
      branch_name: data.branch_name,
    });

    setStaffProfile(updatedProfile);
    return updatedProfile;
  }

  async function createAuditLog({
    action,
    bike,
    details,
  }: {
    action: string;
    bike: StockMotorcycle;
    details?: Record<string, unknown>;
  }) {
    const currentStaffProfile = getSavedStaffProfile();

    const { error } = await supabase.from("admin_audit_logs").insert({
      staff_id: currentStaffProfile?.id || null,
      staff_email: currentStaffProfile?.email || null,
      staff_role: currentStaffProfile?.role || null,
      action,
      target_type: "stock_motorcycle",
      target_id: String(bike.id),
      target_name: `${bike.stock_number || "ไม่มีเลขสต็อก"} • ${getMotorcycleTitle(
        bike
      )}`,
      details: details || {},
    });

    if (error) {
      console.error("Audit log error:", error.message);
    }
  }

  async function loadBranchStock(profileInput?: StaffProfile | null) {
    const currentStaffProfile = profileInput || getSavedStaffProfile();

    if (
      currentStaffProfile?.role === "stock_staff" &&
      !currentStaffProfile.branch_code
    ) {
      setStockMotorcycles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

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
        registration_status,
        tax_expiry,
        notes,
        stock_status,
        stock_branch_code,
        stock_branch_name,
        created_by_staff_email,
        sent_to_center_at,
        is_complete,
        current_auction_motorcycle_id,
        current_auction_round_id,
        missing_detail_remark,
        stock_motorcycle_photos (
          id,
          image_url
        )
      `
      )
      .is("sent_to_center_at", null)
      .not("stock_branch_code", "is", null)
      .is("current_auction_motorcycle_id", null)
      .is("current_auction_round_id", null)
      .not("stock_status", "eq", "sold")
      .not("stock_status", "eq", "ขายแล้ว")
      .order("id", { ascending: false });

    if (currentStaffProfile?.role === "stock_staff") {
      query = query.eq("stock_branch_code", currentStaffProfile.branch_code);
    }

    const { data, error } = await query;

    if (error) {
      setErrorMessage(error.message);
      setStockMotorcycles([]);
      setIsLoading(false);
      return;
    }

    setStockMotorcycles((data as unknown as StockMotorcycle[]) || []);
    setIsLoading(false);
  }

  function canManageBranchStock(bike: StockMotorcycle) {
    if (
      bike.sent_to_center_at ||
      !bike.stock_branch_code ||
      isSoldStockBike(bike) ||
      isStockBikeInAuction(bike)
    ) {
      return false;
    }

    if (isAdminOrOwner(staffProfile)) return true;

    return Boolean(
      staffProfile?.role === "stock_staff" &&
        staffProfile.branch_code &&
        bike.stock_branch_code === staffProfile.branch_code
    );
  }

  function startEditingStockBike(bike: StockMotorcycle) {
    if (!canManageBranchStock(bike)) return;

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
    if (!editForm || !canManageBranchStock(bike)) return;

    const finalBrand = editForm.brand.trim();
    const finalModel = editForm.model.trim();
    const motorcycleName =
      [finalBrand, finalModel].filter(Boolean).join(" ") ||
      bike.motorcycle_name ||
      `รอกรอกข้อมูล ${bike.stock_number || ""}`.trim();

    setIsSavingEdit(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const isComplete = Boolean(finalBrand && finalModel && cleanMoney(editForm.cost_price) !== null);
      const selectedBranchCode = editForm.stock_branch_code.trim();
      const selectedBranchName = BRANCH_BY_CODE[selectedBranchCode];
      const updatedStockInput = {
        motorcycle_name: motorcycleName,
        cost_price: cleanMoney(editForm.cost_price),
        brand: finalBrand || null,
        model: finalModel || null,
        year: editForm.year.trim() || null,
        color: editForm.color.trim() || null,
        license_plate: editForm.license_plate.trim() || null,
        frame_number: editForm.frame_number.trim() || null,
        registration_status: editForm.registration_status || null,
        tax_expiry: editForm.tax_expiry.trim() || null,
        notes: editForm.notes.trim() || null,
        stock_status: isComplete ? "branch_stock" : "รอกรอกข้อมูล",
        is_complete: isComplete,
        missing_detail_remark: null,
        ...(isAdminOrOwner(staffProfile) && selectedBranchCode && selectedBranchName
          ? {
              stock_branch_code: selectedBranchCode,
              stock_branch_name: selectedBranchName,
            }
          : {}),
      };

      let updateQuery = supabase
        .from("stock_motorcycles")
        .update(updatedStockInput)
        .eq("id", bike.id)
        .is("sent_to_center_at", null);

      if (staffProfile?.role === "stock_staff") {
        updateQuery = updateQuery.eq(
          "stock_branch_code",
          staffProfile.branch_code || ""
        );
      }

      const { error } = await updateQuery;

      if (error) throw error;

      await createAuditLog({
        action: "branch_stock_motorcycle_updated",
        bike,
        details: {
          stock_motorcycle_id: bike.id,
          stock_number: bike.stock_number || "",
          stock_branch_code: bike.stock_branch_code || "",
          stock_branch_name: bike.stock_branch_name || "",
          after: updatedStockInput,
        },
      });

      cancelEditingStockBike();
      await loadBranchStock();
      setSuccessMessage("บันทึกข้อมูลรถในคลังสาขาเรียบร้อยแล้ว");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "บันทึกข้อมูลรถไม่สำเร็จ"
      );
    }

    setIsSavingEdit(false);
  }

  async function deleteBranchStockBike(bike: StockMotorcycle) {
    if (!canManageBranchStock(bike)) return;

    const confirmed = confirm("ต้องการลบรถคันนี้ออกจากคลังสาขาหรือไม่?");
    if (!confirmed) return;

    setDeletingStockId(bike.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error: photoError } = await supabase
        .from("stock_motorcycle_photos")
        .delete()
        .eq("stock_motorcycle_id", bike.id);

      if (photoError) throw photoError;

      let deleteQuery = supabase
        .from("stock_motorcycles")
        .delete()
        .eq("id", bike.id)
        .is("sent_to_center_at", null);

      if (staffProfile?.role === "stock_staff") {
        deleteQuery = deleteQuery.eq(
          "stock_branch_code",
          staffProfile.branch_code || ""
        );
      }

      const { error } = await deleteQuery;

      if (error) throw error;

      await createAuditLog({
        action: "branch_stock_motorcycle_deleted",
        bike,
        details: {
          stock_motorcycle_id: bike.id,
          stock_number: bike.stock_number || "",
          stock_branch_code: bike.stock_branch_code || "",
          stock_branch_name: bike.stock_branch_name || "",
        },
      });

      if (editingStockId === bike.id) {
        cancelEditingStockBike();
      }

      await loadBranchStock();
      setSuccessMessage("ลบรถออกจากคลังสาขาเรียบร้อยแล้ว");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ลบรถในคลังสาขาไม่สำเร็จ"
      );
    }

    setDeletingStockId(null);
  }

  async function sendToCenterStock(bike: StockMotorcycle) {
    if (!canManageBranchStock(bike)) return;

    setSendingCenterId(bike.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const sentToCenterAt = new Date().toISOString();
      const updateInput = {
        stock_status: "center_stock",
        sent_to_center_at: sentToCenterAt,
        updated_at: sentToCenterAt,
      };

      let updateQuery = supabase
        .from("stock_motorcycles")
        .update(updateInput)
        .eq("id", bike.id)
        .is("sent_to_center_at", null)
        .is("current_auction_motorcycle_id", null)
        .is("current_auction_round_id", null)
        .not("stock_status", "eq", "sold")
        .not("stock_status", "eq", "ขายแล้ว");

      if (staffProfile?.role === "stock_staff") {
        updateQuery = updateQuery.eq(
          "stock_branch_code",
          staffProfile.branch_code || ""
        );
      }

      const { error } = await updateQuery;

      if (error) throw error;

      await createAuditLog({
        action: "stock_motorcycle_sent_to_center",
        bike,
        details: {
          stock_motorcycle_id: bike.id,
          stock_number: bike.stock_number || "",
          stock_branch_code: bike.stock_branch_code || "",
          stock_branch_name: bike.stock_branch_name || "",
          old_status: bike.stock_status,
          new_status: "center_stock",
          sent_to_center_at: sentToCenterAt,
        },
      });

      await loadBranchStock();
      setSuccessMessage("ส่งเข้าคลังกลางแล้ว");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ส่งรถเข้าคลังกลางไม่สำเร็จ"
      );
    }

    setSendingCenterId(null);
  }

  useEffect(() => {
    async function loadPage() {
      const refreshedProfile = await refreshStaffProfile();
      await loadBranchStock(refreshedProfile || getSavedStaffProfile());
    }

    loadPage();
  }, []);

  return (
    <StaffGuard allowedRoles={["owner", "admin", "stock_staff"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackButton fallbackHref="/admin" />

            <button
              type="button"
              onClick={logoutStaff}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              ออกจากระบบ
            </button>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {canViewAllBranches ? "คลังสาขาทั้งหมด" : "คลังสาขา"}
            </h1>
            {!canViewAllBranches && (
              <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
                คลังสาขา: {branchName || "-"}
              </p>
            )}
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              {isStockStaff ? (
                <p className="text-sm text-gray-600">
                  คลังสาขา: {branchName || "-"}
                </p>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => loadBranchStock()}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
              >
                โหลดใหม่
              </button>
            </div>

            {canViewAllBranches && (
              <div className="mt-4 flex flex-wrap gap-2">
                {branchFilterOptions.map((option) => {
                  const isActive = selectedBranchCode === option.code;

                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setSelectedBranchCode(option.code)}
                      className={
                        isActive
                          ? "rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                          : "rounded-full border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดข้อมูล...
              </div>
            )}

            {!isLoading && visibleStockMotorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">
                  ยังไม่มีรถในคลังสาขานี้
                </p>
              </div>
            )}

            {!isLoading && visibleStockMotorcycles.length > 0 && (
              <div className="mt-4 grid gap-3">
                {visibleStockMotorcycles.map((bike) => {
                  const thumbnail =
                    bike.stock_motorcycle_photos?.[0]?.image_url || null;
                  const canManage = canManageBranchStock(bike);

                  return (
                    <article
                      key={bike.id}
                      className="rounded-2xl border bg-white p-3 shadow-sm"
                    >
                      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={getMotorcycleTitle(bike)}
                              loading="lazy"
                              decoding="async"
                              width={120}
                              height={90}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                              ไม่มีรูป
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                                <span>รหัสสต๊อก: {bike.stock_number || "-"}</span>
                                {isDuplicateStockBike(bike) && (
                                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                                    ซ้ำ
                                  </span>
                                )}
                              </p>
                              <h3 className="mt-1 font-bold text-gray-900">
                                {getMotorcycleTitle(bike)}
                              </h3>
                            </div>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                              {getBranchWorkflowStatus(bike)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                            <p>
                              <span className="font-semibold">สาขา:</span>{" "}
                              {getDisplayBranch(bike)}
                            </p>
                            <p>
                              <span className="font-semibold">ยี่ห้อ:</span>{" "}
                              {getDisplayBrand(bike) || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">รุ่น:</span>{" "}
                              {bike.model || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">ปี:</span>{" "}
                              {bike.year || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">สี:</span>{" "}
                              {bike.color || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">ทะเบียน:</span>{" "}
                              {bike.license_plate || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">เลขตัวถัง:</span>{" "}
                              {bike.frame_number || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">สถานะเล่ม:</span>{" "}
                              {bike.registration_status || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">ภาษีหมดอายุ:</span>{" "}
                              {bike.tax_expiry || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">ต้นทุน:</span>{" "}
                              {formatMoney(bike.cost_price)}
                            </p>
                          </div>

                          {bike.missing_detail_remark && (
                            <p className="mt-3 rounded-xl bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800">
                              {bike.missing_detail_remark}
                            </p>
                          )}

                          {editingStockId === bike.id && editForm && (
                            <div className="mt-4 rounded-2xl bg-gray-50 p-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                {isAdminOrOwner(staffProfile) && (
                                  <div>
                                    <label className="text-xs font-semibold text-gray-700">
                                      สาขา
                                    </label>
                                    <select
                                      className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                      value={editForm.stock_branch_code}
                                      onChange={(event) =>
                                        updateEditForm(
                                          "stock_branch_code",
                                          event.target.value
                                        )
                                      }
                                    >
                                      <option value="">ระบุสาขา</option>
                                      {BRANCH_OPTIONS.map((branch) => (
                                        <option
                                          key={branch.code}
                                          value={branch.code}
                                        >
                                          {branch.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

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
                                  <select
                                    className="mt-1 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
                                    value={editForm.registration_status}
                                    onChange={(event) =>
                                      updateEditForm(
                                        "registration_status",
                                        event.target.value
                                      )
                                    }
                                  >
                                    {registrationStatusOptions.map((option) => (
                                      <option
                                        key={option || "empty"}
                                        value={option}
                                      >
                                        {option || "เลือกสถานะเล่ม"}
                                      </option>
                                    ))}
                                  </select>
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
                                  <textarea
                                    className="mt-1 min-h-20 w-full rounded-xl border bg-white p-2 outline-none focus:ring-2 focus:ring-black"
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
                                  {isSavingEdit
                                    ? "กำลังบันทึก..."
                                    : "บันทึกข้อมูล"}
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
                            </div>
                          )}

                          {canManage && (
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingStockBike(bike)}
                                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                              >
                                แก้ไข
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteBranchStockBike(bike)}
                                disabled={deletingStockId === bike.id}
                                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingStockId === bike.id
                                  ? "กำลังลบ..."
                                  : "ลบ"}
                              </button>

                              <button
                                type="button"
                                onClick={() => sendToCenterStock(bike)}
                                disabled={sendingCenterId === bike.id}
                                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-800 disabled:bg-gray-400"
                              >
                                {sendingCenterId === bike.id
                                  ? "กำลังส่ง..."
                                  : "ส่งเข้าคลังกลาง"}
                              </button>
                            </div>
                          )}
                        </div>
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
