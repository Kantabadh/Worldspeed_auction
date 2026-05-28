"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type SoldMotorcycle = {
  id: number;
  auction_round_id: number | null;
  original_motorcycle_id: number | null;
  original_stock_motorcycle_id: number | null;
  lot_number: string | null;
  motorcycle_name: string | null;
  cost_price: number | null;
  sold_price: number | null;
  diff: number | null;
  winner_merchant_id: number | null;
  winner_shop_name: string | null;
  winner_contact_name: string | null;
  winner_phone: string | null;
  sold_at: string | null;
  sold_by_email: string | null;
  note: string | null;
  created_at: string | null;
  auction_rounds?: {
    id: number;
    round_name: string | null;
    auction_date: string | null;
    status: string | null;
  } | null;
};

type SoldRoundGroup = {
  roundId: string;
  roundName: string;
  auctionDate: string | null;
  items: SoldMotorcycle[];
  count: number;
  totalSoldPrice: number;
  totalCost: number;
  totalDiff: number;
};

function formatBaht(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toLocaleString()} บาท`;
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

function escapeCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function AdminSoldPage() {
  const [soldMotorcycles, setSoldMotorcycles] = useState<SoldMotorcycle[]>([]);
  const [searchText, setSearchText] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSoldMotorcycles() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("sold_motorcycles")
      .select(
        `
        id,
        auction_round_id,
        original_motorcycle_id,
        original_stock_motorcycle_id,
        lot_number,
        motorcycle_name,
        cost_price,
        sold_price,
        diff,
        winner_merchant_id,
        winner_shop_name,
        winner_contact_name,
        winner_phone,
        sold_at,
        sold_by_email,
        note,
        created_at,
        auction_rounds (
          id,
          round_name,
          auction_date,
          status
        )
      `
      )
      .order("sold_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setSoldMotorcycles((data as unknown as SoldMotorcycle[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadSoldMotorcycles();
  }, []);

  const filteredSoldMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return soldMotorcycles;

    return soldMotorcycles.filter((item) => {
      const text = [
        item.lot_number,
        item.motorcycle_name,
        item.winner_shop_name,
        item.winner_contact_name,
        item.winner_phone,
        item.sold_by_email,
        item.auction_rounds?.round_name,
        item.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [soldMotorcycles, searchText]);

  const totalSoldPrice = filteredSoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.sold_price || 0);
  }, 0);

  const totalCost = filteredSoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.cost_price || 0);
  }, 0);

  const totalDiff = filteredSoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.diff || 0);
  }, 0);

  const soldRoundGroups = useMemo(() => {
    const map = new Map<string, SoldRoundGroup>();

    filteredSoldMotorcycles.forEach((item) => {
      const roundId = item.auction_round_id
        ? String(item.auction_round_id)
        : "no-round";
      const roundName = item.auction_rounds?.round_name || "ไม่พบรอบเสนอราคา";
      const auctionDate = item.auction_rounds?.auction_date || null;

      if (!map.has(roundId)) {
        map.set(roundId, {
          roundId,
          roundName,
          auctionDate,
          items: [],
          count: 0,
          totalSoldPrice: 0,
          totalCost: 0,
          totalDiff: 0,
        });
      }

      const group = map.get(roundId);

      if (!group) return;

      group.items.push(item);
      group.count += 1;
      group.totalSoldPrice += Number(item.sold_price || 0);
      group.totalCost += Number(item.cost_price || 0);
      group.totalDiff += Number(item.diff || 0);
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.auctionDate ? new Date(a.auctionDate).getTime() : 0;
      const dateB = b.auctionDate ? new Date(b.auctionDate).getTime() : 0;

      return dateB - dateA;
    });
  }, [filteredSoldMotorcycles]);

  function toggleRound(roundId: string) {
    setExpandedRoundIds((current) => ({
      ...current,
      [roundId]: !current[roundId],
    }));
  }

  function exportSoldCsv() {
    const headers = [
      "ลำดับ",
      "รอบเสนอราคา",
      "ล็อต",
      "รถ",
      "ร้านที่ซื้อ",
      "ผู้ติดต่อ",
      "โทร",
      "ราคาขาย",
      "ต้นทุน",
      "diff",
      "วันที่ขาย",
      "ผู้ยืนยันขาย",
      "หมายเหตุ",
    ];

    const rows = filteredSoldMotorcycles.map((item, index) => [
      index + 1,
      item.auction_rounds?.round_name || "",
      item.lot_number || "",
      item.motorcycle_name || "",
      item.winner_shop_name || "",
      item.winner_contact_name || "",
      item.winner_phone || "",
      Number(item.sold_price || 0),
      Number(item.cost_price || 0),
      Number(item.diff || 0),
      formatThaiDateTime(item.sold_at),
      item.sold_by_email || "",
      item.note || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sold-motorcycles-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                รายการขายแล้ว
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รถที่ขายแล้ว
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                ดูรายการรถที่ปิดการขายแล้ว พร้อมรอบเสนอราคา ผู้ซื้อ ราคา และกำไร
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadSoldMotorcycles}
                className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
              >
                โหลดใหม่
              </button>

              <button
                onClick={exportSoldCsv}
                disabled={filteredSoldMotorcycles.length === 0}
                className="rounded-xl bg-black px-4 py-2 font-medium text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-300"
              >
                ดาวน์โหลด CSV
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">จำนวนรถขายแล้ว</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {filteredSoldMotorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ยอดขายรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-green-700">
                {formatBaht(totalSoldPrice)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ต้นทุนรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-orange-700">
                {formatBaht(totalCost)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">กำไรรวม</p>
              <p
                className={
                  totalDiff >= 0
                    ? "mt-2 break-words text-xl font-bold text-green-700"
                    : "mt-2 break-words text-xl font-bold text-red-700"
                }
              >
                {formatBaht(totalDiff)}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  รายการขายแล้ว
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  ค้นหาจากล็อต, ชื่อรถ, ร้านค้า, เบอร์โทร หรือรอบเสนอราคา
                </p>
              </div>

              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหาล็อต / รถ / ร้าน / โทร / รอบ"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดข้อมูล...
              </div>
            )}

            {!isLoading && filteredSoldMotorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">
                  ยังไม่มีรถที่ขายแล้ว
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  เมื่อกดยืนยันขายจากหน้าล็อต รายการจะแสดงที่นี่
                </p>
              </div>
            )}

            {!isLoading && filteredSoldMotorcycles.length > 0 && (
              <div className="mt-4 space-y-4">
                {soldRoundGroups.map((group) => {
                  const isExpanded = Boolean(expandedRoundIds[group.roundId]);

                  return (
                    <article
                      key={group.roundId}
                      className="rounded-2xl border bg-white p-4 ring-1 ring-gray-100"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            รอบเสนอราคา
                          </p>

                          <h3 className="mt-1 text-xl font-bold text-gray-900">
                            {group.roundName}
                          </h3>

                          <p className="mt-1 text-sm text-gray-600">
                            วันที่ประมูล: {formatThaiDate(group.auctionDate)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRound(group.roundId)}
                          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                        >
                          {isExpanded ? "ซ่อนรายการ" : "เปิดดูรายการ"}
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">
                            จำนวนรถขายแล้ว
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-900">
                            {group.count}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">ยอดขายรวม</p>
                          <p className="mt-1 text-lg font-bold text-green-700">
                            {formatBaht(group.totalSoldPrice)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">ต้นทุนรวม</p>
                          <p className="mt-1 text-lg font-bold text-orange-700">
                            {formatBaht(group.totalCost)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">กำไรรวม</p>
                          <p
                            className={
                              group.totalDiff >= 0
                                ? "mt-1 text-lg font-bold text-green-700"
                                : "mt-1 text-lg font-bold text-red-700"
                            }
                          >
                            {formatBaht(group.totalDiff)}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          <div className="mt-4 hidden overflow-x-auto rounded-2xl border md:block">
                            <table className="w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                  <th className="border p-3">ล็อต</th>
                                  <th className="border p-3">รถ</th>
                                  <th className="border p-3">ร้านที่ซื้อ</th>
                                  <th className="border p-3">โทร</th>
                                  <th className="border p-3 text-right">
                                    ราคาขาย
                                  </th>
                                  <th className="border p-3 text-right">
                                    ต้นทุน
                                  </th>
                                  <th className="border p-3 text-right">diff</th>
                                  <th className="border p-3">วันที่ขาย</th>
                                  <th className="border p-3">ผู้ยืนยัน</th>
                                </tr>
                              </thead>

                              <tbody>
                                {group.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="border p-3 font-bold">
                                      {item.lot_number || "-"}
                                    </td>

                                    <td className="border p-3">
                                      {item.motorcycle_name || "-"}
                                    </td>

                                    <td className="border p-3">
                                      <p className="font-semibold text-gray-900">
                                        {item.winner_shop_name || "-"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {item.winner_contact_name || "-"}
                                      </p>
                                    </td>

                                    <td className="border p-3">
                                      {item.winner_phone || "-"}
                                    </td>

                                    <td className="border p-3 text-right font-bold text-green-700">
                                      {formatBaht(item.sold_price)}
                                    </td>

                                    <td className="border p-3 text-right">
                                      {formatBaht(item.cost_price)}
                                    </td>

                                    <td
                                      className={
                                        Number(item.diff || 0) >= 0
                                          ? "border p-3 text-right font-bold text-green-700"
                                          : "border p-3 text-right font-bold text-red-700"
                                      }
                                    >
                                      {formatBaht(item.diff)}
                                    </td>

                                    <td className="border p-3">
                                      {formatThaiDateTime(item.sold_at)}
                                    </td>

                                    <td className="border p-3">
                                      {item.sold_by_email || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 space-y-3 md:hidden">
                            {group.items.map((item) => (
                              <article
                                key={item.id}
                                className="rounded-2xl border bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                      ล็อต {item.lot_number || "-"}
                                    </p>

                                    <h3 className="mt-1 text-lg font-bold text-gray-900">
                                      {item.motorcycle_name || "-"}
                                    </h3>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-xs text-gray-500">
                                      ราคาขาย
                                    </p>
                                    <p className="text-lg font-bold text-green-700">
                                      {formatBaht(item.sold_price)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
                                  <p>
                                    <span className="text-gray-500">ร้าน: </span>
                                    <span className="font-semibold">
                                      {item.winner_shop_name || "-"}
                                    </span>
                                  </p>

                                  <p className="mt-1">
                                    <span className="text-gray-500">ติดต่อ: </span>
                                    <span className="font-semibold">
                                      {item.winner_contact_name || "-"} •{" "}
                                      {item.winner_phone || "-"}
                                    </span>
                                  </p>

                                  <p className="mt-1">
                                    <span className="text-gray-500">ต้นทุน: </span>
                                    <span>{formatBaht(item.cost_price)}</span>
                                  </p>

                                  <p className="mt-1">
                                    <span className="text-gray-500">diff: </span>
                                    <span
                                      className={
                                        Number(item.diff || 0) >= 0
                                          ? "font-bold text-green-700"
                                          : "font-bold text-red-700"
                                      }
                                    >
                                      {formatBaht(item.diff)}
                                    </span>
                                  </p>

                                  <p className="mt-1">
                                    <span className="text-gray-500">
                                      วันที่ขาย:{" "}
                                    </span>
                                    <span>{formatThaiDateTime(item.sold_at)}</span>
                                  </p>

                                  <p className="mt-1">
                                    <span className="text-gray-500">
                                      ผู้ยืนยัน:{" "}
                                    </span>
                                    <span>{item.sold_by_email || "-"}</span>
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </>
                      )}
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
