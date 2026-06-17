"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { withBackFrom } from "@/lib/navigation";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type AuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
  created_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  archived_by_email: string | null;
  archived_by_role: string | null;
  total_lots: number | null;
  total_merchants: number | null;
  total_offers: number | null;
  total_highest_offer: number | null;
  total_cost: number | null;
  total_gross_profit: number | null;
  note: string | null;
};

type StaffProfile = {
  id?: string;
  email?: string;
  role?: string;
};

function formatBaht(value: number | null | undefined) {
  const numberValue = Number(value || 0);

  if (!numberValue) return "-";

  return `${numberValue.toLocaleString()} บาท`;
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
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

function formatThaiDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
  });
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

function getStatusBadgeClass(status?: string | null) {
  if (status === "draft" || status === "prepared" || status === "preparing") {
    return "bg-gray-100 text-gray-900";
  }
  if (status === "open") return "bg-blue-100 text-blue-700";
  if (status === "closed") return "bg-red-100 text-red-700";
  if (status === "finished") return "bg-purple-100 text-purple-700";
  if (status === "archived") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-700";
}

function getSavedStaffProfile(): StaffProfile | null {
  if (typeof window === "undefined") return null;

  const savedProfileText = localStorage.getItem("staffProfile");

  if (!savedProfileText) return null;

  try {
    return JSON.parse(savedProfileText) as StaffProfile;
  } catch {
    return null;
  }
}

async function createAuditLog({
  action,
  targetType,
  targetId,
  targetName,
  details,
}: {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
}) {
  const staffProfile = getSavedStaffProfile();

  await supabase.from("admin_audit_logs").insert({
    staff_id: staffProfile?.id || null,
    staff_email: staffProfile?.email || null,
    staff_role: staffProfile?.role || null,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    target_name: targetName || null,
    details: details || {},
  });
}

export default function AdminRoundsPage() {
  const pathname = usePathname();
  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadRounds() {
    setIsLoading(true);
    setErrorMessage("");

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
        archived_at,
        archived_by_email,
        archived_by_role,
        total_lots,
        total_merchants,
        total_offers,
        total_highest_offer,
        total_cost,
        total_gross_profit,
        note
      `
      )
      .order("id", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setRounds((data as AuctionRound[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadRounds();
  }, []);

  const filteredRounds = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return rounds;

    return rounds.filter((round) => {
      const text = [
        round.id,
        round.round_name,
        round.auction_date,
        round.status,
        round.archived_by_email,
        round.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [rounds, searchText]);

  const currentRound = rounds.find((round) => round.is_current) || null;

  async function setAsCurrentRound(round: AuctionRound) {
    const confirmSet = confirm(
      `ต้องการตั้ง "${round.round_name || `รอบ #${round.id}`}" เป็นรอบปัจจุบันใช่หรือไม่?`
    );

    if (!confirmSet) return;

    setIsUpdatingId(round.id);
    setErrorMessage("");

    const previousCurrentRound = rounds.find((item) => item.is_current) || null;

    const { error: clearError } = await supabase
      .from("auction_rounds")
      .update({ is_current: false })
      .eq("is_current", true);

    if (clearError) {
      setErrorMessage(clearError.message);
      setIsUpdatingId(null);
      return;
    }

    const { error: setError } = await supabase
      .from("auction_rounds")
      .update({ is_current: true })
      .eq("id", round.id);

    if (setError) {
      setErrorMessage(setError.message);
      setIsUpdatingId(null);
      return;
    }

    await createAuditLog({
      action: "auction_round_set_current",
      targetType: "auction_round",
      targetId: String(round.id),
      targetName: round.round_name || `รอบ #${round.id}`,
      details: {
        round_id: round.id,
        round_name: round.round_name,
        auction_date: round.auction_date,
        status: round.status,
        is_current_after: true,
        previous_current_round_id: previousCurrentRound?.id || null,
        previous_current_round_name: previousCurrentRound?.round_name || null,
      },
    });

    setIsUpdatingId(null);
    await loadRounds();
  }

  async function updateRoundStatus(
    round: AuctionRound,
    status: "draft" | "open" | "closed" | "finished"
  ) {
    if (status === "finished" && round.status !== "closed") {
      alert("ต้องปิดรอบก่อนจบรอบประมูล");
      return;
    }

    const confirmUpdate =
      status === "finished"
        ? confirm("ยืนยันจบรอบประมูลนี้?")
        : confirm(
            `ต้องการเปลี่ยนสถานะ "${round.round_name || `รอบ #${round.id}`}" เป็น "${getRoundStatusLabel(status)}" ใช่หรือไม่?`
          );

    if (!confirmUpdate) return;

    setIsUpdatingId(round.id);
    setErrorMessage("");

    const payload: Record<string, string | boolean | null> = {
      status,
    };

    if (status === "open") {
      payload.opened_at = new Date().toISOString();
      payload.closed_at = null;
      payload.is_current = true;
    }

    if (status === "closed") {
      payload.closed_at = new Date().toISOString();
    }

    if (status === "finished" && !round.closed_at) {
      payload.closed_at = new Date().toISOString();
    }

    if (status === "open") {
      const { error: clearError } = await supabase
        .from("auction_rounds")
        .update({ is_current: false })
        .eq("is_current", true);

      if (clearError) {
        setErrorMessage(clearError.message);
        setIsUpdatingId(null);
        return;
      }
    }

    const { error } = await supabase
      .from("auction_rounds")
      .update(payload)
      .eq("id", round.id);

    if (error) {
      setErrorMessage(error.message);
      setIsUpdatingId(null);
      return;
    }

    if (status === "open" || status === "closed") {
      const { error: settingError } = await supabase
        .from("auction_settings")
        .update({ status: status === "open" ? "open" : "closed" })
        .eq("auction_name", "Main Motorcycle Auction");

      if (settingError) {
        setErrorMessage(settingError.message);
        setIsUpdatingId(null);
        return;
      }
    }

    await createAuditLog({
      action: "auction_round_status_changed",
      targetType: "auction_round",
      targetId: String(round.id),
      targetName: round.round_name || `รอบ #${round.id}`,
      details: {
        round_id: round.id,
        round_name: round.round_name,
        auction_date: round.auction_date,
        old_status: round.status,
        new_status: status,
        old_status_thai: getRoundStatusLabel(round.status),
        new_status_thai: getRoundStatusLabel(status),
        is_current_before: round.is_current,
        is_current_after: status === "open" ? true : round.is_current,
        synced_auction_settings:
          status === "open" || status === "closed" ? true : false,
      },
    });

    setIsUpdatingId(null);
    await loadRounds();
  }

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                จัดการรอบประมูล
              </h1>
            </div>

            <button
              onClick={loadRounds}
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

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">จำนวนรอบทั้งหมด</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {rounds.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">รอบปัจจุบัน</p>
              <p className="mt-2 line-clamp-1 text-lg font-bold text-blue-700">
                {currentRound?.round_name || "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">สถานะรอบปัจจุบัน</p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {currentRound ? getRoundStatusLabel(currentRound.status) : "-"}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  รอบทั้งหมด
                </h2>
              </div>

              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหารอบ"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดรอบเสนอราคา...
              </div>
            )}

            {!isLoading && filteredRounds.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">ยังไม่มีรอบเสนอราคา</p>
                <p className="mt-1 text-sm text-gray-600">
                  ไปที่หน้า /admin เพื่อสร้างรอบใหม่
                </p>
              </div>
            )}

            {!isLoading && filteredRounds.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-3">รอบประมูล</th>
                      <th className="border p-3">สถานะ</th>
                      <th className="border p-3 text-center">ปัจจุบัน</th>
                      <th className="border p-3 text-right">จำนวนรถ</th>
                      <th className="border p-3">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRounds.map((round) => (
                      <tr key={round.id} className="hover:bg-gray-50">
                        <td className="border p-3">
                          <p className="font-bold text-gray-900">
                            {round.round_name || `รอบ #${round.id}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID #{round.id} • สร้าง{" "}
                            {formatThaiDateTime(round.created_at)}
                          </p>
                        </td>

                        <td className="border p-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                              round.status
                            )}`}
                          >
                            {getRoundStatusLabel(round.status)}
                          </span>
                        </td>

                        <td className="border p-3 text-center">
                          {round.is_current ? (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              รอบปัจจุบัน
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="border p-3 text-right font-bold">
                          {formatNumber(round.total_lots)}
                        </td>

                        <td className="border p-3">
                          <div className="flex min-w-[460px] flex-wrap gap-2">
                            {!round.is_current && (
                              <button
                                onClick={() => setAsCurrentRound(round)}
                                disabled={isUpdatingId === round.id}
                                className="rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-gray-100 disabled:opacity-50"
                              >
                                ตั้งเป็นรอบปัจจุบัน
                              </button>
                            )}

                            <button
                              onClick={() => updateRoundStatus(round, "draft")}
                              disabled={isUpdatingId === round.id}
                              className="rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-gray-100 disabled:opacity-50"
                            >
                              เตรียมรอบ
                            </button>

                            <button
                              onClick={() => updateRoundStatus(round, "open")}
                              disabled={isUpdatingId === round.id}
                              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                            >
                              เปิดรอบ
                            </button>

                            <button
                              onClick={() => updateRoundStatus(round, "closed")}
                              disabled={isUpdatingId === round.id}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:bg-gray-300"
                            >
                              ปิดรอบ
                            </button>

                            <button
                              onClick={() => updateRoundStatus(round, "finished")}
                              disabled={
                                isUpdatingId === round.id ||
                                round.status !== "closed"
                              }
                              className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:bg-gray-300"
                            >
                              จบรอบ
                            </button>

                            <a
                              href={withBackFrom(`/admin/rounds/${round.id}`, pathname)}
                              className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
                            >
                              ดูรายละเอียด
                            </a>

                          </div>
                        </td>
                      </tr>
                    ))}
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
