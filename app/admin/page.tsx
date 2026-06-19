"use client";

import { useEffect, useState } from "react";
import StaffGuard from "@/components/StaffGuard";
import { signOutAfterInvalidAuth } from "@/lib/authRecovery";
import { clearCachedStaffProfile, getCachedStaffProfile } from "@/lib/staffSession";
import { supabase } from "@/lib/supabase";

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  expiresAt?: number;
};

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
  created_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
};

function getStaffRoleLabel(role?: string | null) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "stock_staff") return "เจ้าหน้าที่รับรถ";
  return role || "-";
}

function getRoundStatusLabel(status?: string | null) {
  if (status === "draft" || status === "prepared" || status === "preparing") {
    return "เตรียมรอบ";
  }
  if (status === "open") return "เปิดรับราคา";
  if (status === "closed") return "ปิดรับราคา";
  if (status === "finished") return "จบรอบแล้ว";
  if (status === "archived") return "บันทึกประวัติแล้ว";
  return status || "-";
}

function getRoundStatusBadgeClass(status?: string | null) {
  if (status === "draft" || status === "prepared" || status === "preparing") {
    return "bg-gray-100 text-gray-900 ring-gray-200";
  }
  if (status === "open") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "closed") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "finished") {
    return "bg-purple-50 text-purple-700 ring-purple-200";
  }
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

export default function AdminPage() {
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(
    null
  );
  const [newRoundDate, setNewRoundDate] = useState("");
  const [isRoundLoading, setIsRoundLoading] = useState(true);
  const [isRoundUpdating, setIsRoundUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setStaffProfile(getCachedStaffProfile() as StaffProfile | null);
    loadCurrentAuctionRound();
  }, []);

  async function logoutStaff() {
    clearCachedStaffProfile();
    await signOutAfterInvalidAuth(supabase, "staff");
    window.location.href = "/staff-login";
  }

  async function loadCurrentAuctionRound() {
    setIsRoundLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("auction_rounds")
        .select(
          `
          id,
          round_name,
          auction_date,
          status,
          is_current,
          created_at,
          opened_at,
          closed_at,
          archived_at
        `
        )
        .eq("is_current", true)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setCurrentRound((data as CurrentAuctionRound) || null);
    } catch (error) {
      setCurrentRound(null);
      setErrorMessage(
        error instanceof Error ? error.message : "โหลดข้อมูลรอบไม่สำเร็จ"
      );
    } finally {
      setIsRoundLoading(false);
    }
  }

  async function createNewAuctionRound() {
    if (!newRoundDate) {
      alert("กรุณาเลือกวันที่ประมูล");
      return;
    }

    const selectedDate = new Date(`${newRoundDate}T00:00:00`);
    const autoRoundName = `รอบวันที่ ${selectedDate.toLocaleDateString(
      "th-TH",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    )}`;

    const confirmCreate = confirm(
      "ต้องการสร้างรอบเสนอราคาใหม่และตั้งเป็นรอบปัจจุบันใช่หรือไม่?"
    );

    if (!confirmCreate) return;

    setIsRoundUpdating(true);
    setErrorMessage("");

    try {
      const { error: clearCurrentError } = await supabase
        .from("auction_rounds")
        .update({ is_current: false })
        .eq("is_current", true);

      if (clearCurrentError) throw clearCurrentError;

      const { error: createError } = await supabase
        .from("auction_rounds")
        .insert({
          round_name: autoRoundName,
          auction_date: newRoundDate,
          status: "draft",
          is_current: true,
          note: "สร้างจากหน้า Admin Dashboard",
        });

      if (createError) throw createError;

      setNewRoundDate("");
      await loadCurrentAuctionRound();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "สร้างรอบใหม่ไม่สำเร็จ"
      );
    } finally {
      setIsRoundUpdating(false);
    }
  }

  async function updateCurrentRoundStatus(
    newStatus: "draft" | "open" | "closed" | "finished"
  ) {
    if (!currentRound) {
      alert("ยังไม่มีรอบเสนอราคาปัจจุบัน");
      return;
    }

    if (newStatus === "finished" && currentRound.status !== "closed") {
      alert("ต้องปิดรอบก่อนจบรอบประมูล");
      return;
    }

    const confirmUpdate = confirm(
      `ต้องการเปลี่ยนสถานะรอบนี้เป็น "${getRoundStatusLabel(
        newStatus
      )}" ใช่หรือไม่?`
    );

    if (!confirmUpdate) return;

    setIsRoundUpdating(true);
    setErrorMessage("");

    try {
      const updatePayload: {
        status: string;
        is_current: boolean;
        opened_at?: string | null;
        closed_at?: string | null;
      } = {
        status: newStatus,
        is_current: true,
      };

      if (newStatus === "open") {
        updatePayload.opened_at = new Date().toISOString();
        updatePayload.closed_at = null;
      }

      if (newStatus === "closed" || newStatus === "finished") {
        updatePayload.closed_at = new Date().toISOString();
      }

      const { error: roundError } = await supabase
        .from("auction_rounds")
        .update(updatePayload)
        .eq("id", currentRound.id);

      if (roundError) throw roundError;

      if (newStatus === "open" || newStatus === "closed") {
        const { error: settingError } = await supabase
          .from("auction_settings")
          .update({
            status: newStatus === "open" ? "open" : "closed",
          })
          .eq("auction_name", "Main Motorcycle Auction");

        if (settingError) throw settingError;
      }

      await loadCurrentAuctionRound();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เปลี่ยนสถานะรอบไม่สำเร็จ"
      );
    } finally {
      setIsRoundUpdating(false);
    }
  }

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:py-5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                ระบบเสนอราคารถจักรยานยนต์
              </h1>

              <p className="mt-1 truncate text-xs text-gray-600 sm:text-sm">
                เข้าสู่ระบบโดย {staffProfile?.email || "-"} •{" "}
                {getStaffRoleLabel(staffProfile?.role)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadCurrentAuctionRound}
                disabled={isRoundLoading}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
              >
                {isRoundLoading ? "กำลังโหลด..." : "โหลดใหม่"}
              </button>

              <button
                onClick={logoutStaff}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          {errorMessage && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  รอบเสนอราคาปัจจุบัน
                </h2>
              </div>
            </div>

            {isRoundLoading ? (
              <div className="mt-4 rounded-2xl border bg-gray-50 p-4 text-gray-600">
                กำลังโหลดรอบเสนอราคา...
              </div>
            ) : currentRound ? (
              <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">ชื่อรอบ</p>
                    <p className="mt-1 font-bold text-gray-900">
                      {currentRound.round_name || `รอบ #${currentRound.id}`}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm text-gray-500">สถานะรอบ</p>
                    <p
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${getRoundStatusBadgeClass(
                        currentRound.status
                      )}`}
                    >
                      {getRoundStatusLabel(currentRound.status)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateCurrentRoundStatus("draft")}
                    disabled={isRoundUpdating}
                    className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                  >
                    เตรียมรอบ
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentRoundStatus("open")}
                    disabled={isRoundUpdating}
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
                  >
                    เปิดรอบ
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentRoundStatus("closed")}
                    disabled={isRoundUpdating}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                  >
                    ปิดรอบ
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentRoundStatus("finished")}
                    disabled={
                      isRoundUpdating || currentRound.status !== "closed"
                    }
                    className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:bg-gray-400"
                  >
                    จบรอบประมูล
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                <p className="font-bold">ยังไม่มีรอบเสนอราคาปัจจุบัน</p>
                <p className="mt-1 text-sm">
                  สร้างรอบใหม่ก่อน แล้วค่อยนำรถจากคลังเข้าสู่รอบนั้น
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border bg-white p-3 sm:p-4">
              <h3 className="font-bold text-gray-900">
                สร้างรอบเสนอราคาใหม่
              </h3>

              <div className="mt-2 grid gap-3 md:grid-cols-[220px_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    วันที่ประมูล
                  </label>

                  <input
                    type="date"
                    className="mt-2 w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black"
                    value={newRoundDate}
                    onChange={(event) => setNewRoundDate(event.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={createNewAuctionRound}
                  disabled={isRoundUpdating}
                  className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400 md:w-auto"
                >
                  สร้างรอบใหม่
                </button>
              </div>
            </div>
          </section>

          <section className="mt-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h3 className="font-bold text-gray-900">เตรียมก่อนประมูล</h3>

                <div className="mt-3 grid gap-3">
                  <a
                    href="/admin/stock"
                    className="rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    เพิ่มรถเข้าคลังสาขา
                  </a>

                  <a
                    href="/admin/stock/branch"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    คลังสาขา
                  </a>

                  <a
                    href="/admin/stock-list"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    คลังกลาง
                  </a>

                  <a
                    href="/admin/motorcycles"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    รายการรถในรอบประมูล
                  </a>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h3 className="font-bold text-gray-900">
                  ระหว่างเสนอราคา / จบรอบ
                </h3>

                <div className="mt-3 grid gap-3">
                  <a
                    href="/admin/rounds"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    จัดการรอบปัจจุบัน
                  </a>

                  <a
                    href="/admin/merchants"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    ร้านค้า
                  </a>

                  <a
                    href="/admin/merchant-receipts"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    พิมพ์ใบเสนอราคา
                  </a>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h3 className="font-bold text-gray-900">ประวัติและระบบ</h3>

                <div className="mt-3 grid gap-3">
                  <a
                    href="/admin/history"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    ประวัติรอบเสนอราคา
                  </a>

                  <a
                    href="/admin/audit-logs"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    ประวัติการทำงาน
                  </a>

                  {staffProfile?.role === "owner" && (
                    <a
                      href="/admin/staff"
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                    >
                      ตั้งค่า Owner
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
