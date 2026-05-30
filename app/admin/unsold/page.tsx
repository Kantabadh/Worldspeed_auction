"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type UnsoldMotorcycle = {
  id: number;
  auction_round_id: number | null;
  original_motorcycle_id: number | null;
  original_stock_motorcycle_id: number | null;
  lot_number: string | null;
  motorcycle_name: string | null;
  cost_price: number | null;
  highest_offer: number | null;
  diff: number | null;
  highest_merchant_id: number | null;
  highest_shop_name: string | null;
  highest_contact_name: string | null;
  highest_phone: string | null;
  returned_at: string | null;
  returned_by_email: string | null;
  note: string | null;
  created_at: string | null;
  auction_rounds?: {
    id: number;
    round_name: string | null;
    auction_date: string | null;
    status: string | null;
  } | null;
};

type UnsoldRoundGroup = {
  roundId: string;
  roundName: string;
  auctionDate: string | null;
  items: UnsoldMotorcycle[];
  count: number;
  totalHighestOffer: number;
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

export default function AdminUnsoldPage() {
  const [unsoldMotorcycles, setUnsoldMotorcycles] = useState<
    UnsoldMotorcycle[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState<
    Record<string, boolean>
  >({});

  async function loadUnsoldMotorcycles() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("unsold_motorcycles")
      .select(
        `
        id,
        auction_round_id,
        original_motorcycle_id,
        original_stock_motorcycle_id,
        lot_number,
        motorcycle_name,
        cost_price,
        highest_offer,
        diff,
        highest_merchant_id,
        highest_shop_name,
        highest_contact_name,
        highest_phone,
        returned_at,
        returned_by_email,
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
      .order("returned_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setUnsoldMotorcycles((data as unknown as UnsoldMotorcycle[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadUnsoldMotorcycles();
  }, []);

  const filteredUnsoldMotorcycles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return unsoldMotorcycles;

    return unsoldMotorcycles.filter((item) => {
      const text = [
        item.lot_number,
        item.motorcycle_name,
        item.highest_shop_name,
        item.highest_contact_name,
        item.highest_phone,
        item.returned_by_email,
        item.auction_rounds?.round_name,
        item.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [unsoldMotorcycles, searchText]);

  const totalHighestOffer = filteredUnsoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.highest_offer || 0);
  }, 0);

  const totalCost = filteredUnsoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.cost_price || 0);
  }, 0);

  const totalDiff = filteredUnsoldMotorcycles.reduce((sum, item) => {
    return sum + Number(item.diff || 0);
  }, 0);

  const unsoldRoundGroups = useMemo(() => {
    const map = new Map<string, UnsoldRoundGroup>();

    filteredUnsoldMotorcycles.forEach((item) => {
      const roundId = item.auction_round_id
        ? String(item.auction_round_id)
        : "no-round";
      const existing = map.get(roundId);
      const group =
        existing ||
        {
          roundId,
          roundName: item.auction_rounds?.round_name || "ไม่พบรอบเสนอราคา",
          auctionDate: item.auction_rounds?.auction_date || null,
          items: [],
          count: 0,
          totalHighestOffer: 0,
          totalCost: 0,
          totalDiff: 0,
        };

      group.items.push(item);
      group.count += 1;
      group.totalHighestOffer += Number(item.highest_offer || 0);
      group.totalCost += Number(item.cost_price || 0);
      group.totalDiff += Number(item.diff || 0);

      map.set(roundId, group);
    });

    return Array.from(map.values()).sort((a, b) => {
      const aDate = a.auctionDate ? new Date(a.auctionDate).getTime() : 0;
      const bDate = b.auctionDate ? new Date(b.auctionDate).getTime() : 0;

      return bDate - aDate;
    });
  }, [filteredUnsoldMotorcycles]);

  function toggleRound(roundId: string) {
    setExpandedRoundIds((current) => ({
      ...current,
      [roundId]: !current[roundId],
    }));
  }

  function exportUnsoldCsv() {
    const headers = [
      "ลำดับ",
      "รอบเสนอราคา",
      "ล็อต",
      "รถ",
      "ร้านที่เสนอสูงสุด",
      "ผู้ติดต่อ",
      "โทร",
      "ราคาสูงสุด",
      "ต้นทุน",
      "กำไรขั้นต้น",
      "วันที่กลับเข้าสต็อก",
      "ผู้ดำเนินการ",
      "หมายเหตุ",
    ];

    const rows = filteredUnsoldMotorcycles.map((item, index) => [
      index + 1,
      item.auction_rounds?.round_name || "",
      item.lot_number || "",
      item.motorcycle_name || "",
      item.highest_shop_name || "",
      item.highest_contact_name || "",
      item.highest_phone || "",
      Number(item.highest_offer || 0),
      Number(item.cost_price || 0),
      Number(item.diff || 0),
      formatThaiDateTime(item.returned_at),
      item.returned_by_email || "",
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
    link.download = `unsold-motorcycles-${Date.now()}.csv`;
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
                รายการกลับเข้าสต็อก
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รถที่ไม่ขาย / กลับเข้าสต็อก
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                ดูรายการรถที่ไม่ขายในรอบเสนอราคา และถูกส่งกลับเข้าสต็อกเพื่อใช้รอบถัดไป
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadUnsoldMotorcycles}
                className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
              >
                โหลดใหม่
              </button>

              <button
                onClick={exportUnsoldCsv}
                disabled={filteredUnsoldMotorcycles.length === 0}
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
              <p className="text-sm text-gray-500">จำนวนรถไม่ขาย</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {filteredUnsoldMotorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ราคาสูงสุดรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-green-700">
                {formatBaht(totalHighestOffer)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ต้นทุนรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-orange-700">
                {formatBaht(totalCost)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">กำไรขั้นต้นรวม</p>
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
                  รายการกลับเข้าสต็อก
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

            {!isLoading && filteredUnsoldMotorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">
                  ยังไม่มีรถที่กลับเข้าสต็อก
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  เมื่อกด “ไม่ขาย / กลับเข้าสต็อก” จากหน้าล็อต รายการจะแสดงที่นี่
                </p>
              </div>
            )}

            {!isLoading && filteredUnsoldMotorcycles.length > 0 && (
              <div className="mt-4 space-y-4">
                {unsoldRoundGroups.map((group) => {
                  const isExpanded = Boolean(expandedRoundIds[group.roundId]);

                  return (
                    <div
                      key={group.roundId}
                      className="rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-gray-100"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            รอบเสนอราคา
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-gray-900">
                            {group.roundName}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            วันที่ประมูล: {formatThaiDate(group.auctionDate)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRound(group.roundId)}
                          className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                        >
                          {isExpanded ? "ซ่อนรายการ" : "เปิดดูรายการ"}
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">
                            จำนวนรถกลับเข้าสต็อก
                          </p>
                          <p className="mt-1 text-xl font-bold text-gray-900">
                            {group.count}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">
                            ราคาสูงสุดรวม
                          </p>
                          <p className="mt-1 break-words text-lg font-bold text-green-700">
                            {formatBaht(group.totalHighestOffer)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">ต้นทุนรวม</p>
                          <p className="mt-1 break-words text-lg font-bold text-orange-700">
                            {formatBaht(group.totalCost)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">กำไรขั้นต้นรวม</p>
                          <p
                            className={
                              group.totalDiff >= 0
                                ? "mt-1 break-words text-lg font-bold text-green-700"
                                : "mt-1 break-words text-lg font-bold text-red-700"
                            }
                          >
                            {formatBaht(group.totalDiff)}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4">
                          <div className="hidden overflow-x-auto rounded-2xl border md:block">
                            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                  <th className="border p-3">ล็อต</th>
                                  <th className="border p-3">รถ</th>
                                  <th className="border p-3">
                                    ร้านเสนอสูงสุด
                                  </th>
                                  <th className="border p-3">โทร</th>
                                  <th className="border p-3 text-right">
                                    ราคาสูงสุด
                                  </th>
                                  <th className="border p-3 text-right">
                                    ต้นทุน
                                  </th>
                                  <th className="border p-3 text-right">
                                    กำไรขั้นต้น
                                  </th>
                                  <th className="border p-3">วันที่กลับ</th>
                                  <th className="border p-3">
                                    ผู้ดำเนินการ
                                  </th>
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
                                        {item.highest_shop_name || "-"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {item.highest_contact_name || "-"}
                                      </p>
                                    </td>

                                    <td className="border p-3">
                                      {item.highest_phone || "-"}
                                    </td>

                                    <td className="border p-3 text-right font-bold text-green-700">
                                      {formatBaht(item.highest_offer)}
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
                                      {formatThaiDateTime(item.returned_at)}
                                    </td>

                                    <td className="border p-3">
                                      {item.returned_by_email || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="space-y-3 md:hidden">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border bg-gray-50 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs text-gray-500">ล็อต</p>
                                    <p className="text-lg font-bold text-gray-900">
                                      {item.lot_number || "-"}
                                    </p>
                                  </div>
                                  <p className="text-right text-sm text-gray-600">
                                    {formatThaiDateTime(item.returned_at)}
                                  </p>
                                </div>

                                <p className="mt-2 font-semibold text-gray-900">
                                  {item.motorcycle_name || "-"}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {item.highest_shop_name || "-"} /{" "}
                                  {item.highest_phone || "-"}
                                </p>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <p className="text-gray-500">
                                      ราคาสูงสุด
                                    </p>
                                    <p className="font-bold text-green-700">
                                      {formatBaht(item.highest_offer)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">ต้นทุน</p>
                                    <p className="font-semibold">
                                      {formatBaht(item.cost_price)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">กำไรขั้นต้น</p>
                                    <p
                                      className={
                                        Number(item.diff || 0) >= 0
                                          ? "font-bold text-green-700"
                                          : "font-bold text-red-700"
                                      }
                                    >
                                      {formatBaht(item.diff)}
                                    </p>
                                  </div>
                                </div>

                                <p className="mt-3 text-xs text-gray-500">
                                  ผู้ดำเนินการ: {item.returned_by_email || "-"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {false && !isLoading && filteredUnsoldMotorcycles.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-3">วันที่กลับ</th>
                      <th className="border p-3">รอบ</th>
                      <th className="border p-3">ล็อต</th>
                      <th className="border p-3">รถ</th>
                      <th className="border p-3">ร้านเสนอสูงสุด</th>
                      <th className="border p-3 text-right">ราคาสูงสุด</th>
                      <th className="border p-3 text-right">ต้นทุน</th>
                      <th className="border p-3 text-right">กำไรขั้นต้น</th>
                      <th className="border p-3">ผู้ดำเนินการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUnsoldMotorcycles.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border p-3">
                          {formatThaiDateTime(item.returned_at)}
                        </td>

                        <td className="border p-3">
                          {item.auction_rounds?.round_name || "-"}
                        </td>

                        <td className="border p-3 font-bold">
                          {item.lot_number || "-"}
                        </td>

                        <td className="border p-3">
                          {item.motorcycle_name || "-"}
                        </td>

                        <td className="border p-3">
                          <p className="font-semibold text-gray-900">
                            {item.highest_shop_name || "-"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.highest_contact_name || "-"} •{" "}
                            {item.highest_phone || "-"}
                          </p>
                        </td>

                        <td className="border p-3 text-right font-bold text-green-700">
                          {formatBaht(item.highest_offer)}
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
                          {item.returned_by_email || "-"}
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
