"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  if (status === "draft") return "เตรียมรอบ";
  if (status === "open") return "เปิดรับราคา";
  if (status === "closed") return "ปิดรอบ";
  if (status === "archived") return "บันทึกประวัติแล้ว";
  return status || "-";
}

function getStatusBadgeClass(status?: string | null) {
  if (status === "open") return "bg-green-100 text-green-700";
  if (status === "closed") return "bg-red-100 text-red-700";
  if (status === "archived") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-700";
}

export default function AdminRoundsPage() {
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
      `ต้องการตั้ง "${round.round_name || `Round ${round.id}`}" เป็นรอบปัจจุบันใช่หรือไม่?`
    );

    if (!confirmSet) return;

    setIsUpdatingId(round.id);
    setErrorMessage("");

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

    setIsUpdatingId(null);
    await loadRounds();
  }

  async function updateRoundStatus(round: AuctionRound, status: "draft" | "open" | "closed") {
    const confirmUpdate = confirm(
      `ต้องการเปลี่ยนสถานะ "${round.round_name || `Round ${round.id}`}" เป็น "${getRoundStatusLabel(status)}" ใช่หรือไม่?`
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
      await supabase
        .from("auction_settings")
        .update({ status: status === "open" ? "open" : "closed" })
        .eq("auction_name", "Main Motorcycle Auction");
    }

    setIsUpdatingId(null);
    await loadRounds();
  }

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Auction Rounds
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                จัดการรอบ Auction
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                ดูรอบทั้งหมด ตั้งรอบปัจจุบัน และเปิด/ปิดรอบประมูล
              </p>
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

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
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

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">วันที่ประมูล</p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {formatThaiDate(currentRound?.auction_date)}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  รายการรอบ Auction
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  ค้นหาและจัดการสถานะของแต่ละรอบ
                </p>
              </div>

              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหารอบ / วันที่ / ผู้บันทึก"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดรอบ Auction...
              </div>
            )}

            {!isLoading && filteredRounds.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">ยังไม่มีรอบ Auction</p>
                <p className="mt-1 text-sm text-gray-600">
                  ไปที่หน้า /admin เพื่อสร้างรอบใหม่
                </p>
              </div>
            )}

            {!isLoading && filteredRounds.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-3">รอบ</th>
                      <th className="border p-3">วันที่ประมูล</th>
                      <th className="border p-3">สถานะ</th>
                      <th className="border p-3 text-center">ปัจจุบัน</th>
                      <th className="border p-3 text-right">Lot</th>
                      <th className="border p-3 text-right">ราคาเสนอ</th>
                      <th className="border p-3 text-right">มูลค่าสูงสุด</th>
                      <th className="border p-3">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRounds.map((round) => (
                      <tr key={round.id} className="hover:bg-gray-50">
                        <td className="border p-3">
                          <p className="font-bold text-gray-900">
                            {round.round_name || `Round ${round.id}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID #{round.id} • สร้าง {formatThaiDateTime(round.created_at)}
                          </p>
                        </td>

                        <td className="border p-3">
                          {formatThaiDate(round.auction_date)}
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

                        <td className="border p-3 text-right font-bold">
                          {formatNumber(round.total_offers)}
                        </td>

                        <td className="border p-3 text-right font-bold text-green-700">
                          {formatBaht(round.total_highest_offer)}
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

                            <a
                              href="/admin/history"
                              className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
                            >
                              ดูประวัติ
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