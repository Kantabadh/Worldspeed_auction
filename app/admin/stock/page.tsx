"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type SourceBranch =
  | ""
  | "บางกะปิ"
  | "บางบอน"
  | "รังสิต"
  | "สุขาภิบาล3"
  | "โต๊ะลิ้ม"
  | "อื่น";

type RegistrationStatus = "" | "มีเล่ม" | "ปิดบัญชี" | "อื่น";
type BrandOption =
  | ""
  | "Honda"
  | "Yamaha"
  | "Suzuki"
  | "Kawasaki"
  | "Vespa"
  | "อื่น";

type MotorcycleDetails = {
  brand: string;
  model: string;
  year: string;
  color: string;
  license_plate: string;
  frame_number: string;
  tax_expiry: string;
  notes: string;
};

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active?: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
};

type SaveMode = "draft" | "complete";

const sourceBranchOptions: SourceBranch[] = [
  "",
  "บางกะปิ",
  "บางบอน",
  "รังสิต",
  "สุขาภิบาล3",
  "โต๊ะลิ้ม",
  "อื่น",
];

function isSourceBranch(value?: string | null): value is SourceBranch {
  return sourceBranchOptions.includes((value || "") as SourceBranch);
}

function getProfileSourceBranch(profile?: StaffProfile | null): SourceBranch {
  return profile?.branch_name && isSourceBranch(profile.branch_name)
    ? profile.branch_name
    : "";
}

const sourcePrefixMap: Record<Exclude<SourceBranch, "">, string> = {
  บางกะปิ: "A",
  บางบอน: "B",
  รังสิต: "C",
  สุขาภิบาล3: "D",
  โต๊ะลิ้ม: "E",
  อื่น: "F",
};

const registrationStatusOptions: RegistrationStatus[] = [
  "",
  "มีเล่ม",
  "ปิดบัญชี",
  "อื่น",
];

const brandOptions: BrandOption[] = [
  "",
  "Honda",
  "Yamaha",
  "Suzuki",
  "Kawasaki",
  "Vespa",
  "อื่น",
];

function createEmptyDetails(): MotorcycleDetails {
  return {
    brand: "",
    model: "",
    year: "",
    color: "",
    license_plate: "",
    frame_number: "",
    tax_expiry: "",
    notes: "",
  };
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;

  const numberValue = Number(cleaned);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function sanitizeEnglishNumber(value: string) {
  return value.replace(/[^A-Za-z0-9\s/.\-_]/g, "");
}

function sanitizeYear(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function sanitizeFrameNumber(value: string) {
  return value.replace(/[^A-Za-z0-9\s-]/g, "").toUpperCase();
}

function sanitizeThaiNumber(value: string) {
  return value.replace(/[^\u0E00-\u0E7F0-9๐-๙\s/.\-_]/g, "");
}

function sanitizeNumber(value: string) {
  return value.replace(/[^\d,]/g, "");
}

function sanitizeTaxExpiry(value: string) {
  return value.replace(/[^\u0E00-\u0E7F0-9๐-๙\s/.\-_]/g, "");
}

function cleanDetails(details: MotorcycleDetails) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, value.trim() || null])
  );
}

function sanitizeMotorcycleDetailValue(
  keyName: keyof MotorcycleDetails,
  value: string
) {
  if (keyName === "model") return sanitizeEnglishNumber(value);
  if (keyName === "year") return sanitizeYear(value);
  if (keyName === "frame_number") return sanitizeFrameNumber(value);
  if (keyName === "license_plate") return sanitizeThaiNumber(value);
  if (keyName === "color") return sanitizeThaiNumber(value);
  if (keyName === "tax_expiry") return sanitizeTaxExpiry(value);
  if (keyName === "notes") return sanitizeThaiNumber(value);

  return value;
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
    "กรุณารัน SQL นี้ก่อนใช้งานบันทึกร่าง:",
    "alter table public.stock_motorcycles add column if not exists is_complete boolean not null default true;",
  ].join("\n");
}

export default function AdminStockPage() {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(() => {
    if (typeof window === "undefined") return null;
    return getSavedStaffProfile();
  });
  const [stockNumber, setStockNumber] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sourceBranch, setSourceBranch] = useState<SourceBranch>("");
  const [customSourceName, setCustomSourceName] = useState("");
  const [brandOption, setBrandOption] = useState<BrandOption>("");
  const [customBrand, setCustomBrand] = useState("");
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>("");
  const [customRegistrationStatus, setCustomRegistrationStatus] = useState("");
  const [details, setDetails] = useState<MotorcycleDetails>(
    createEmptyDetails()
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [savingMode, setSavingMode] = useState<SaveMode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isStockStaff = staffProfile?.role === "stock_staff";
  const staffSourceBranch = getProfileSourceBranch(staffProfile);
  const staffBranchName = staffProfile?.branch_name?.trim() || "";

  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photoFiles]
  );

  async function generateStockNumber(branch: SourceBranch) {
    if (!branch) {
      setStockNumber("");
      return;
    }

    const prefix = sourcePrefixMap[branch];

    const { data, error } = await supabase
      .from("stock_motorcycles")
      .select("stock_number")
      .like("stock_number", `${prefix}%`);

    if (error) {
      setErrorMessage(error.message);
      setStockNumber("");
      return;
    }

    const highestNumber = (data || []).reduce((highest, item) => {
      const stockNumberText = item.stock_number || "";
      const numericPart = Number(stockNumberText.slice(prefix.length));

      if (Number.isNaN(numericPart)) return highest;

      return Math.max(highest, numericPart);
    }, 0);

    setStockNumber(`${prefix}${String(highestNumber + 1).padStart(4, "0")}`);
  }

  async function refreshStaffProfile() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) return;

    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active, branch_code, branch_name")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    const updatedProfile = {
      ...(getSavedStaffProfile() || {}),
      id: data.id,
      email: data.email,
      role: data.role,
      active: data.active,
      branch_code: data.branch_code,
      branch_name: data.branch_name,
    } as StaffProfile;

    localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));
    setStaffProfile(updatedProfile);
  }

  useEffect(() => {
    generateStockNumber(sourceBranch);
  }, [sourceBranch]);

  useEffect(() => {
    setStaffProfile(getSavedStaffProfile());
    refreshStaffProfile();
  }, []);

  useEffect(() => {
    if (!isStockStaff) return;

    setSourceBranch(staffSourceBranch);
    setCustomSourceName("");
  }, [isStockStaff, staffSourceBranch]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

  async function logoutStaff() {
    localStorage.removeItem("staffProfile");
    await supabase.auth.signOut();
    window.location.href = "/staff-login";
  }

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

  async function uploadPhoto(file: File, stockNumberInput: string) {
    // TODO: Compress large motorcycle photos before upload to speed up merchant page thumbnails.
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

    if (uploadError) throw uploadError;

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

    if (error) throw error;

    return photoRows.length;
  }

  async function addStockMotorcycle(saveMode: SaveMode) {
    const selectedSourceBranch = isStockStaff ? staffSourceBranch : sourceBranch;

    if (isStockStaff && (!staffProfile?.branch_code || !staffBranchName)) {
      alert("บัญชีเจ้าหน้าที่รับรถยังไม่ได้ผูกสาขา กรุณาติดต่อ Admin");
      return;
    }

    if (!selectedSourceBranch) {
      alert("กรุณาเลือกสาขา");
      return;
    }

    if (!stockNumber.trim()) {
      alert("ระบบยังไม่ได้สร้างรหัสสต็อก กรุณาเลือกสาขาอีกครั้ง");
      return;
    }

    const finalSourceName = isStockStaff
      ? staffBranchName
      : selectedSourceBranch === "อื่น"
      ? customSourceName.trim()
      : selectedSourceBranch;

    if (!finalSourceName) {
      alert("กรุณาระบุสาขา");
      return;
    }

    if (photoFiles.length === 0) {
      alert("กรุณาเลือกรูปอย่างน้อย 1 รูป");
      return;
    }

    const finalRegistrationStatus =
      registrationStatus === "อื่น"
        ? customRegistrationStatus.trim()
        : registrationStatus;

    const finalBrand =
      brandOption === "อื่น" ? customBrand.trim() : brandOption;

    if (saveMode === "complete" && !brandOption) {
      alert("กรุณาเลือกยี่ห้อ");
      return;
    }

    if (saveMode === "complete" && brandOption === "อื่น" && !finalBrand) {
      alert("กรุณาระบุยี่ห้อ");
      return;
    }

    if (saveMode === "complete" && !details.model.trim()) {
      alert("กรุณาระบุรุ่น");
      return;
    }

    if (saveMode === "complete" && cleanMoney(costPrice) === null) {
      alert("กรุณาระบุต้นทุน");
      return;
    }

    if (
      saveMode === "complete" &&
      registrationStatus === "อื่น" &&
      !finalRegistrationStatus
    ) {
      alert("กรุณาระบุสถานะเล่ม");
      return;
    }

    const generatedMotorcycleName =
      [finalBrand, details.model.trim()].filter(Boolean).join(" ") ||
      `รอกรอกข้อมูล ${stockNumber.trim()}`;

    setSavingMode(saveMode);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const newStockInput = {
        stock_number: stockNumber.trim(),
        motorcycle_name: generatedMotorcycleName,
        cost_price: cleanMoney(costPrice),
        stock_status: isStockStaff ? "branch_stock" : "center_stock",
        current_auction_motorcycle_id: null,
        current_auction_round_id: null,
        is_complete: saveMode === "complete",
        brand: finalBrand || null,
        source_name: finalSourceName,
        registration_status: finalRegistrationStatus || null,
        ...(isStockStaff
          ? {
              stock_branch_code: staffProfile?.branch_code || null,
              stock_branch_name: staffBranchName,
              created_by_staff_email: staffProfile?.email || null,
            }
          : {}),
        ...cleanDetails(details),
      };

      const { data: stockData, error: stockError } = await supabase
        .from("stock_motorcycles")
        .insert(newStockInput)
        .select("id, stock_number, motorcycle_name, cost_price, stock_status")
        .single();

      if (stockError) throw stockError;

      const uploadedPhotoCount = await uploadMultipleStockPhotos(
        photoFiles,
        Number(stockData.id),
        stockNumber || generatedMotorcycleName
      );

      await createAuditLog({
        action: "stock_motorcycle_created",
        targetType: "stock_motorcycle",
        targetId: String(stockData.id),
        targetName: `${
          stockData.stock_number || "ไม่มีเลขสต็อก"
        } • ${stockData.motorcycle_name}`,
        details: {
          stock_motorcycle_id: stockData.id,
          stock_number: stockData.stock_number || "",
          motorcycle_name: stockData.motorcycle_name,
          cost_price: Number(stockData.cost_price || 0),
          brand: finalBrand || "",
          is_complete: saveMode === "complete",
          stock_status: stockData.stock_status,
          stock_status_thai: stockData.stock_status,
          stock_branch_code: isStockStaff ? staffProfile?.branch_code || "" : "",
          stock_branch_name: isStockStaff ? staffBranchName : "",
          created_by_staff_email: isStockStaff ? staffProfile?.email || "" : "",
          source_name: finalSourceName,
          registration_status: finalRegistrationStatus || "",
          uploaded_photo_count: uploadedPhotoCount,
          ...cleanDetails(details),
        },
      });

      setCostPrice("");
      setBrandOption("");
      setCustomBrand("");
      setRegistrationStatus("");
      setCustomRegistrationStatus("");
      setDetails(createEmptyDetails());
      setPhotoFiles([]);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }

      if (saveMode === "draft" || isStockStaff) {
        await generateStockNumber(selectedSourceBranch);
      } else {
        setStockNumber("");
        setSourceBranch("");
        setCustomSourceName("");
      }

      setSuccessMessage(
        isStockStaff
          ? "บันทึกรถเข้าคลังสาขาเรียบร้อยแล้ว"
          : saveMode === "complete"
          ? "เพิ่มรถเข้าคลังเรียบร้อยแล้ว"
          : "บันทึกไว้ก่อนแล้ว สามารถเพิ่มคันถัดไปได้"
      );
    } catch (error) {
      const message =
        isMissingIsCompleteColumn(error)
          ? getIsCompleteMigrationMessage()
          : error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างเพิ่มรถเข้าคลัง";

      setErrorMessage(message);
    }

    setSavingMode(null);
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  function handlePhotoSelection(files: FileList | null) {
    setPhotoFiles(Array.from(files || []));
  }

  function removeSelectedPhoto(indexToRemove: number) {
    setPhotoFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    );

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function renderDetailInput({
    keyName,
    label,
    placeholder,
    multiline,
  }: {
    keyName: keyof MotorcycleDetails;
    label: string;
    placeholder: string;
    multiline?: boolean;
  }) {
    if (multiline) {
      return (
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-700">{label}</label>

          <textarea
            className="mt-2 min-h-24 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
            placeholder={placeholder}
            value={details[keyName]}
            onChange={(event) =>
              setDetails({
                ...details,
                [keyName]: sanitizeMotorcycleDetailValue(
                  keyName,
                  event.target.value
                ),
              })
            }
          />
        </div>
      );
    }

    return (
      <div>
        <label className="text-sm font-medium text-gray-700">{label}</label>

        <input
          className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
          placeholder={placeholder}
          value={details[keyName]}
          onChange={(event) =>
            setDetails({
              ...details,
              [keyName]: sanitizeMotorcycleDetailValue(
                keyName,
                event.target.value
              ),
            })
          }
          maxLength={keyName === "year" ? 4 : undefined}
        />
      </div>
    );
  }

  function renderDetailInputs() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-gray-700">ยี่ห้อ</label>

          <select
            className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
            value={brandOption}
            onChange={(event) =>
              setBrandOption(event.target.value as BrandOption)
            }
          >
            {brandOptions.map((option) => (
              <option key={option || "empty"} value={option}>
                {option || "เลือกยี่ห้อ"}
              </option>
            ))}
          </select>
        </div>

        {brandOption === "อื่น" && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              ระบุยี่ห้อ
            </label>

            <input
              className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="เช่น แบรนด์อื่น"
              value={customBrand}
              onChange={(event) =>
                setCustomBrand(sanitizeEnglishNumber(event.target.value))
              }
            />
          </div>
        )}

        {renderDetailInput({
          keyName: "model",
          label: "รุ่น",
          placeholder: "เช่น Wave 110i",
        })}
        {renderDetailInput({
          keyName: "year",
          label: "ปี",
          placeholder: "เช่น 2020",
        })}
        {renderDetailInput({
          keyName: "frame_number",
          label: "เลขตัวถัง",
          placeholder: "เลขตัวถัง",
        })}
        {renderDetailInput({
          keyName: "license_plate",
          label: "ทะเบียน",
          placeholder: "เช่น 1กก 1234",
        })}
        {renderDetailInput({
          keyName: "color",
          label: "สี",
          placeholder: "เช่น แดง",
        })}

        <div>
          <label className="text-sm font-medium text-gray-700">สถานะเล่ม</label>

          <select
            className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
            value={registrationStatus}
            onChange={(event) =>
              setRegistrationStatus(event.target.value as RegistrationStatus)
            }
          >
            {registrationStatusOptions.map((option) => (
              <option key={option || "empty"} value={option}>
                {option || "เลือกสถานะเล่ม"}
              </option>
            ))}
          </select>
        </div>

        {registrationStatus === "อื่น" && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              ระบุสถานะเล่ม
            </label>

            <input
              className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="ระบุสถานะเล่ม"
              value={customRegistrationStatus}
              onChange={(event) =>
                setCustomRegistrationStatus(
                  sanitizeThaiNumber(event.target.value)
                )
              }
            />
          </div>
        )}

        {renderDetailInput({
          keyName: "tax_expiry",
          label: "ภาษีหมดอายุ",
          placeholder: "เช่น 12/2567",
        })}

        <div>
          <label className="text-sm font-medium text-gray-700">ต้นทุน</label>

          <input
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
            placeholder="เช่น 12000"
            value={costPrice}
            onChange={(event) => setCostPrice(sanitizeNumber(event.target.value))}
          />
        </div>

        {renderDetailInput({
          keyName: "notes",
          label: "หมายเหตุเพิ่มเติม",
          placeholder: "รายละเอียดเพิ่มเติม",
          multiline: true,
        })}
      </div>
    );
  }

  return (
    <StaffGuard allowedRoles={["owner", "admin", "stock_staff"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          {staffProfile?.role === "stock_staff" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={logoutStaff}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <BackButton />
          )}

          <div className="mt-4">
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              คลังรถบริษัท
            </h1>

            {isStockStaff && staffBranchName && (
              <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
                คลังสาขา: {staffBranchName}
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
            <h2 className="text-xl font-bold text-gray-900">
              {isStockStaff ? "เพิ่มรถเข้าคลังสาขา" : "เพิ่มรถเข้าคลัง"}
            </h2>

            <div className="mt-4 grid gap-4">
              {isStockStaff ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">สาขา</label>

                  <input
                    readOnly
                    className="mt-2 w-full rounded-2xl border bg-gray-50 p-3 text-gray-700 outline-none"
                    value={staffBranchName ? `คลังสาขา: ${staffBranchName}` : ""}
                    placeholder="ยังไม่ได้ผูกสาขา"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700">สาขา</label>

                  <select
                    className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                    value={sourceBranch}
                    onChange={(event) =>
                      setSourceBranch(event.target.value as SourceBranch)
                    }
                  >
                    {sourceBranchOptions.map((option) => (
                      <option key={option || "empty"} value={option}>
                        {option || "เลือกสาขา"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isStockStaff && sourceBranch === "อื่น" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    ระบุสาขา
                  </label>

                  <input
                    className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                    placeholder="เช่น สาขาอื่น"
                    value={customSourceName}
                    onChange={(event) => setCustomSourceName(event.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">
                  รหัสสต็อก
                </label>

                <input
                  readOnly
                  className="mt-2 w-full rounded-2xl border bg-gray-50 p-3 text-gray-700 outline-none"
                  placeholder="เลือกสาขาก่อน"
                  value={stockNumber}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  รูปภาพ
                </label>

                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handlePhotoSelection(event.target.files)
                  }
                />

                <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <button
                    type="button"
                    onClick={openPhotoPicker}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-800"
                  >
                    เลือกรูป
                  </button>

                  <p className="mt-2 text-xs text-gray-500">
                    เลือกรูปได้หลายรูป เช่น 5-7 รูปต่อคัน
                  </p>

                  {photoFiles.length > 0 && (
                    <p className="mt-3 text-sm font-semibold text-gray-800">
                      เลือกแล้ว {photoFiles.length} รูป
                    </p>
                  )}

                  {photoPreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {photoPreviews.map((preview, index) => (
                        <div
                          key={preview.id}
                          className="overflow-hidden rounded-xl border bg-white"
                        >
                          <div className="aspect-[4/3] bg-gray-100">
                            <img
                              src={preview.url}
                              alt={`รูปที่ ${index + 1}`}
                              width={320}
                              height={240}
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 p-2">
                            <p className="truncate text-xs text-gray-500">
                              {preview.name}
                            </p>

                            <button
                              type="button"
                              onClick={() => removeSelectedPhoto(index)}
                              className="shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <h3 className="font-bold text-gray-900">รายละเอียดรถ</h3>

              <div className="mt-4">
                {renderDetailInputs()}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {isStockStaff ? (
                <>
                  <button
                    type="button"
                    onClick={() => addStockMotorcycle("draft")}
                    disabled={savingMode !== null}
                    className="w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
                  >
                    {savingMode === "draft"
                      ? "กำลังบันทึก..."
                      : "บันทึกเข้าคลังสาขา"}
                  </button>

                  <a
                    href="/admin/stock/branch"
                    className="w-full rounded-2xl border bg-white px-5 py-3 text-center font-semibold shadow hover:bg-gray-100 sm:w-auto"
                  >
                    ไปคลังสาขา
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => addStockMotorcycle("draft")}
                    disabled={savingMode !== null}
                    className="w-full rounded-2xl border bg-white px-5 py-3 font-semibold shadow hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:w-auto"
                  >
                    {savingMode === "draft" ? "กำลังบันทึก..." : "บันทึกไว้ก่อน"}
                  </button>

                  <button
                    type="button"
                    onClick={() => addStockMotorcycle("complete")}
                    disabled={savingMode !== null}
                    className="w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
                  >
                    {savingMode === "complete"
                      ? "กำลังบันทึก..."
                      : "บันทึกเข้าคลัง"}
                  </button>
                </>
              )}
            </div>
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
