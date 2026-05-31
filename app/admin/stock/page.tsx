"use client";

import { useEffect, useState } from "react";
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
};

const sourceBranchOptions: SourceBranch[] = [
  "",
  "บางกะปิ",
  "บางบอน",
  "รังสิต",
  "สุขาภิบาล3",
  "โต๊ะลิ้ม",
  "อื่น",
];

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

function cleanDetails(details: MotorcycleDetails) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, value.trim() || null])
  );
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
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  useEffect(() => {
    generateStockNumber(sourceBranch);
  }, [sourceBranch]);

  useEffect(() => {
    setStaffProfile(getSavedStaffProfile());
  }, []);

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

  async function addStockMotorcycle() {
    if (!sourceBranch) {
      alert("กรุณาเลือกแหล่งที่มา");
      return;
    }

    if (!stockNumber.trim()) {
      alert("ระบบยังไม่ได้สร้างรหัสสต็อก กรุณาเลือกแหล่งที่มาอีกครั้ง");
      return;
    }

    const finalSourceName =
      sourceBranch === "อื่น" ? customSourceName.trim() : sourceBranch;

    if (!finalSourceName) {
      alert("กรุณาระบุแหล่งที่มา");
      return;
    }

    const finalRegistrationStatus =
      registrationStatus === "อื่น"
        ? customRegistrationStatus.trim()
        : registrationStatus;

    const finalBrand =
      brandOption === "อื่น" ? customBrand.trim() : brandOption;

    if (!brandOption) {
      alert("กรุณาเลือกยี่ห้อ");
      return;
    }

    if (brandOption === "อื่น" && !finalBrand) {
      alert("กรุณาระบุยี่ห้อ");
      return;
    }

    if (!details.model.trim()) {
      alert("กรุณาระบุรุ่น");
      return;
    }

    if (registrationStatus === "อื่น" && !finalRegistrationStatus) {
      alert("กรุณาระบุสถานะเล่ม");
      return;
    }

    const generatedMotorcycleName =
      [finalBrand, details.model.trim()].filter(Boolean).join(" ") ||
      "ไม่ระบุรุ่น";

    setIsAdding(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const newStockInput = {
        stock_number: stockNumber.trim(),
        motorcycle_name: generatedMotorcycleName,
        cost_price: cleanMoney(costPrice),
        stock_status: "อยู่ในสต็อก",
        current_auction_motorcycle_id: null,
        current_auction_round_id: null,
        brand: finalBrand || null,
        source_name: finalSourceName,
        registration_status: finalRegistrationStatus || null,
        ...cleanDetails(details),
      };

      const { data: stockData, error: stockError } = await supabase
        .from("stock_motorcycles")
        .insert(newStockInput)
        .select()
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
          stock_status: stockData.stock_status,
          stock_status_thai: stockData.stock_status,
          source_name: finalSourceName,
          registration_status: finalRegistrationStatus || "",
          uploaded_photo_count: uploadedPhotoCount,
          ...cleanDetails(details),
        },
      });

      setStockNumber("");
      setCostPrice("");
      setSourceBranch("");
      setCustomSourceName("");
      setBrandOption("");
      setCustomBrand("");
      setRegistrationStatus("");
      setCustomRegistrationStatus("");
      setDetails(createEmptyDetails());
      setPhotoFiles([]);
      setSuccessMessage("เพิ่มรถเข้าคลังเรียบร้อยแล้ว");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างเพิ่มรถเข้าคลัง";

      setErrorMessage(message);
    }

    setIsAdding(false);
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
                [keyName]: event.target.value,
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
              [keyName]: event.target.value,
            })
          }
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
              onChange={(event) => setCustomBrand(event.target.value)}
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
          keyName: "color",
          label: "สี",
          placeholder: "เช่น แดง",
        })}
        {renderDetailInput({
          keyName: "license_plate",
          label: "ทะเบียน",
          placeholder: "เช่น 1กก 1234",
        })}
        {renderDetailInput({
          keyName: "frame_number",
          label: "เลขตัวถัง",
          placeholder: "เลขตัวถัง",
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
                setCustomRegistrationStatus(event.target.value)
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
            onChange={(event) => setCostPrice(event.target.value)}
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
              เพิ่มรถเข้าคลัง
            </h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">มาจาก</label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={sourceBranch}
                  onChange={(event) =>
                    setSourceBranch(event.target.value as SourceBranch)
                  }
                >
                  {sourceBranchOptions.map((option) => (
                    <option key={option || "empty"} value={option}>
                      {option || "เลือกแหล่งที่มา"}
                    </option>
                  ))}
                </select>
              </div>

              {sourceBranch === "อื่น" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    ระบุแหล่งที่มา
                  </label>

                  <input
                    className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                    placeholder="เช่น สาขาอื่น / ชื่อร้าน / แหล่งที่มา"
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
                  placeholder="เลือกแหล่งที่มาก่อน"
                  value={stockNumber}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  รูปภาพ
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
                  เลือกได้หลายรูป เช่น 5-7 รูปต่อคัน
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <h3 className="font-bold text-gray-900">รายละเอียดรถ</h3>

              <div className="mt-4">
                {renderDetailInputs()}
              </div>
            </div>

            <button
              type="button"
              onClick={addStockMotorcycle}
              disabled={isAdding}
              className="mt-5 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มรถเข้าคลัง"}
            </button>
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
