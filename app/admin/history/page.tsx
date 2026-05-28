"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type AuctionRound = {
  id: number;
  round_name: string | null;
  archived_at: string;
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

type AuctionRoundLot = {
  id: number;
  auction_round_id: number;
  original_motorcycle_id: number | null;
  lot_number: string | null;
  motorcycle_name: string | null;
  cost_price: number | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  license_plate: string | null;
  frame_number: string | null;
  engine_number: string | null;
  purchase_date: string | null;
  acquisition_type: string | null;
  source_name: string | null;
  highest_offer: number | null;
  winner_shop_name: string | null;
  winner_contact_name: string | null;
  winner_phone: string | null;
  second_place_text: string | null;
  diff: number | null;
  created_at: string;
};

type AuctionRoundOffer = {
  id: number;
  auction_round_id: number;
  original_offer_id: number | null;
  original_merchant_id: number | null;
  original_motorcycle_id: number | null;
  lot_number: string | null;
  motorcycle_name: string | null;
  merchant_name: string | null;
  shop_name: string | null;
  phone: string | null;
  offer_price: number | null;
  submitted_at: string | null;
  was_edited: boolean | null;
  original_offer_price: number | null;
  updated_at: string | null;
  created_at: string;
};

function formatBaht(value: number | null | undefined) {
  const numberValue = Number(value || 0);

  if (!numberValue) return "-";

  return `${numberValue.toLocaleString()} บาท`;
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
}

function formatThaiDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "medium",
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

function formatThaiTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function escapeCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function AdminHistoryPage() {
  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [roundLots, setRoundLots] = useState<AuctionRoundLot[]>([]);
  const [roundOffers, setRoundOffers] = useState<AuctionRoundOffer[]>([]);

  const [searchText, setSearchText] = useState("");
  const [isLoadingRounds, setIsLoadingRounds] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadAuctionRounds() {
    setIsLoadingRounds(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("auction_rounds")
      .select(
        `
        id,
        round_name,
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
      .order("archived_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoadingRounds(false);
      return;
    }

    const loadedRounds = (data as AuctionRound[]) || [];

    setRounds(loadedRounds);
    setIsLoadingRounds(false);

    if (loadedRounds.length > 0 && !selectedRoundId) {
      setSelectedRoundId(loadedRounds[0].id);
      await loadRoundDetails(loadedRounds[0].id);
    }
  }

  async function loadRoundDetails(roundId: number) {
    setSelectedRoundId(roundId);
    setIsLoadingDetails(true);
    setErrorMessage("");

    const { data: lotData, error: lotError } = await supabase
      .from("auction_round_lots")
      .select(
        `
        id,
        auction_round_id,
        original_motorcycle_id,
        lot_number,
        motorcycle_name,
        cost_price,
        brand,
        model,
        year,
        license_plate,
        frame_number,
        engine_number,
        purchase_date,
        acquisition_type,
        source_name,
        highest_offer,
        winner_shop_name,
        winner_contact_name,
        winner_phone,
        second_place_text,
        diff,
        created_at
      `
      )
      .eq("auction_round_id", roundId)
      .order("lot_number", { ascending: true });

    if (lotError) {
      setErrorMessage(lotError.message);
      setIsLoadingDetails(false);
      return;
    }

    const { data: offerData, error: offerError } = await supabase
      .from("auction_round_offers")
      .select(
        `
        id,
        auction_round_id,
        original_offer_id,
        original_merchant_id,
        original_motorcycle_id,
        lot_number,
        motorcycle_name,
        merchant_name,
        shop_name,
        phone,
        offer_price,
        submitted_at,
        was_edited,
        original_offer_price,
        updated_at,
        created_at
      `
      )
      .eq("auction_round_id", roundId)
      .order("lot_number", { ascending: true });

    if (offerError) {
      setErrorMessage(offerError.message);
      setIsLoadingDetails(false);
      return;
    }

    setRoundLots((lotData as AuctionRoundLot[]) || []);
    setRoundOffers((offerData as AuctionRoundOffer[]) || []);
    setIsLoadingDetails(false);
  }

  useEffect(() => {
    loadAuctionRounds();
  }, []);

  const selectedRound =
    rounds.find((round) => round.id === selectedRoundId) || null;

  const filteredRounds = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return rounds;

    return rounds.filter((round) => {
      const text = [
        round.round_name,
        round.archived_by_email,
        round.archived_by_role,
        round.note,
        formatThaiDateTime(round.archived_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [rounds, searchText]);

  const totalHighestAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_highest_offer || 0);
  }, 0);

  const totalCostAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_cost || 0);
  }, 0);

  const totalProfitAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_gross_profit || 0);
  }, 0);

  const offersByLotNumber = useMemo(() => {
    const map = new Map<string, AuctionRoundOffer[]>();

    roundOffers.forEach((offer) => {
      const lotNumber = offer.lot_number || "-";

      if (!map.has(lotNumber)) {
        map.set(lotNumber, []);
      }

      map.get(lotNumber)?.push(offer);
    });

    map.forEach((offers) => {
      offers.sort((a, b) => Number(b.offer_price || 0) - Number(a.offer_price || 0));
    });

    return map;
  }, [roundOffers]);

  function exportRoundLotsCsv() {
    if (!selectedRound) return;

    const headers = [
      "ลำดับ",
      "Lot",
      "ยี่ห้อ",
      "รุ่น",
      "ชื่อรถ",
      "เลขถัง",
      "ทะเบียน",
      "ปี",
      "ซื้อ/เทิร์น",
      "มาจาก",
      "ทุน",
      "ราคาสูงสุด",
      "ผู้ชนะ",
      "เบอร์ผู้ชนะ",
      "อันดับ 2",
      "diff",
    ];

    const rows = roundLots.map((lot, index) => [
      index + 1,
      lot.lot_number || "",
      lot.brand || "",
      lot.model || "",
      lot.motorcycle_name || "",
      lot.frame_number || "",
      lot.license_plate || "",
      lot.year || "",
      lot.acquisition_type || "",
      lot.source_name || "",
      Number(lot.cost_price || 0),
      Number(lot.highest_offer || 0),
      lot.winner_shop_name || "",
      lot.winner_phone || "",
      lot.second_place_text || "",
      Number(lot.diff || 0),
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
    link.download = `auction-history-round-${selectedRound.id}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportRoundOffersCsv() {
    if (!selectedRound) return;

    const headers = [
      "Lot",
      "รถ",
      "ร้านค้า",
      "ผู้ติดต่อ",
      "โทร",
      "ราคาเสนอ",
      "เวลาส่ง",
      "แก้ไขแล้ว",
      "ราคาเดิม",
      "เวลาแก้ไข",
    ];

    const rows = roundOffers.map((offer) => [
      offer.lot_number || "",
      offer.motorcycle_name || "",
      offer.shop_name || "",
      offer.merchant_name || "",
      offer.phone || "",
      Number(offer.offer_price || 0),
      formatThaiDateTime(offer.submitted_at),
      offer.was_edited ? "แก้ไขแล้ว" : "",
      offer.original_offer_price ? Number(offer.original_offer_price) : "",
      offer.updated_at ? formatThaiDateTime(offer.updated_at) : "",
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
    link.download = `auction-history-offers-round-${selectedRound.id}.csv`;
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
                Auction History
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                ประวัติรอบ Auction
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                ดูประวัติรอบที่บันทึกไว้ พร้อมผู้ชนะ อันดับ 2 และราคาทุกร้าน
              </p>
            </div>

            <button
              onClick={loadAuctionRounds}
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
              <p className="text-sm text-gray-500">จำนวนรอบ</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {rounds.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">มูลค่าสูงสุดรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-green-700">
                {formatBaht(totalHighestAllRounds)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">ต้นทุนรวม</p>
              <p className="mt-2 break-words text-xl font-bold text-orange-700">
                {formatBaht(totalCostAllRounds)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">กำไรขั้นต้นรวม</p>
              <p
                className={
                  totalProfitAllRounds >= 0
                    ? "mt-2 break-words text-xl font-bold text-green-700"
                    : "mt-2 break-words text-xl font-bold text-red-700"
                }
              >
                {formatBaht(totalProfitAllRounds)}
              </p>
            </div>
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-[380px_1fr]">
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                รอบที่บันทึกไว้
              </h2>

              <input
                className="mt-4 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="ค้นหารอบ / ผู้บันทึก / หมายเหตุ"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              {isLoadingRounds && (
                <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-gray-600">
                  กำลังโหลดประวัติ...
                </div>
              )}

              {!isLoadingRounds && filteredRounds.length === 0 && (
                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                  <p className="font-semibold text-gray-900">
                    ยังไม่มีประวัติรอบ Auction
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    ให้ Owner กด “บันทึกประวัติรอบนี้” จากหน้า Admin ก่อน
                  </p>
                </div>
              )}

              <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {filteredRounds.map((round) => {
                  const isSelected = round.id === selectedRoundId;

                  return (
                    <button
                      key={round.id}
                      onClick={() => loadRoundDetails(round.id)}
                      className={
                        isSelected
                          ? "w-full rounded-2xl border-2 border-black bg-gray-50 p-4 text-left"
                          : "w-full rounded-2xl border bg-white p-4 text-left hover:bg-gray-50"
                      }
                    >
                      <p className="font-bold text-gray-900">
                        {round.round_name || `รอบ #${round.id}`}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatThaiDateTime(round.archived_at)}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-gray-100 p-2">
                          <p className="font-bold text-gray-900">
                            {formatNumber(round.total_lots)}
                          </p>
                          <p className="text-gray-500">Lot</p>
                        </div>

                        <div className="rounded-xl bg-gray-100 p-2">
                          <p className="font-bold text-gray-900">
                            {formatNumber(round.total_merchants)}
                          </p>
                          <p className="text-gray-500">ร้าน</p>
                        </div>

                        <div className="rounded-xl bg-gray-100 p-2">
                          <p className="font-bold text-gray-900">
                            {formatNumber(round.total_offers)}
                          </p>
                          <p className="text-gray-500">ราคา</p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-green-700">
                        สูงสุดรวม: {formatBaht(round.total_highest_offer)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        บันทึกโดย: {round.archived_by_email || "-"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              {!selectedRound ? (
                <div className="rounded-2xl bg-gray-50 p-8 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    เลือกรอบ Auction ก่อน
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    หลังจากเลือกแล้ว ระบบจะแสดงรายละเอียดรอบนั้น
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                        Selected Round
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-gray-900">
                        {selectedRound.round_name ||
                          `รอบ #${selectedRound.id}`}
                      </h2>

                      <p className="mt-1 text-sm text-gray-600">
                        บันทึกเมื่อ {formatThaiDateTime(selectedRound.archived_at)}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        บันทึกโดย {selectedRound.archived_by_email || "-"} •{" "}
                        {selectedRound.archived_by_role || "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportRoundLotsCsv}
                        disabled={roundLots.length === 0}
                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
                      >
                        Export Lot CSV
                      </button>

                      <button
                        onClick={exportRoundOffersCsv}
                        disabled={roundOffers.length === 0}
                        className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-40"
                      >
                        Export Offer CSV
                      </button>
                    </div>
                  </div>

                  <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Lot</p>
                      <p className="mt-1 text-xl font-bold">
                        {formatNumber(selectedRound.total_lots)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">ร้านค้า</p>
                      <p className="mt-1 text-xl font-bold">
                        {formatNumber(selectedRound.total_merchants)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">ราคาเสนอ</p>
                      <p className="mt-1 text-xl font-bold">
                        {formatNumber(selectedRound.total_offers)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">มูลค่าสูงสุด</p>
                      <p className="mt-1 text-lg font-bold text-green-700">
                        {formatBaht(selectedRound.total_highest_offer)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">กำไรขั้นต้น</p>
                      <p
                        className={
                          Number(selectedRound.total_gross_profit || 0) >= 0
                            ? "mt-1 text-lg font-bold text-green-700"
                            : "mt-1 text-lg font-bold text-red-700"
                        }
                      >
                        {formatBaht(selectedRound.total_gross_profit)}
                      </p>
                    </div>
                  </section>

                  {isLoadingDetails ? (
                    <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-gray-600">
                      กำลังโหลดรายละเอียด...
                    </div>
                  ) : (
                    <>
                      <section className="mt-6">
                        <h3 className="text-lg font-bold text-gray-900">
                          สรุปผลแต่ละ Lot
                        </h3>

                        {roundLots.length === 0 ? (
                          <div className="mt-3 rounded-2xl bg-gray-50 p-5 text-gray-600">
                            ไม่มีข้อมูล Lot ในรอบนี้
                          </div>
                        ) : (
                          <div className="mt-3 overflow-x-auto rounded-2xl border">
                            <table className="w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                  <th className="border p-3">Lot</th>
                                  <th className="border p-3">รถ</th>
                                  <th className="border p-3">ซื้อ/เทิร์น</th>
                                  <th className="border p-3">มาจาก</th>
                                  <th className="border p-3 text-right">ทุน</th>
                                  <th className="border p-3 text-right">
                                    ราคาสูงสุด
                                  </th>
                                  <th className="border p-3">ผู้ชนะ</th>
                                  <th className="border p-3">อันดับ 2</th>
                                  <th className="border p-3 text-right">diff</th>
                                </tr>
                              </thead>

                              <tbody>
                                {roundLots.map((lot) => (
                                  <tr key={lot.id} className="hover:bg-gray-50">
                                    <td className="border p-3 font-bold">
                                      {lot.lot_number || "-"}
                                    </td>

                                    <td className="border p-3">
                                      <p className="font-medium text-gray-900">
                                        {lot.motorcycle_name || "-"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {lot.brand || ""} {lot.model || ""}{" "}
                                        {lot.year || ""}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        เลขถัง: {lot.frame_number || "-"}
                                      </p>
                                    </td>

                                    <td className="border p-3">
                                      {lot.acquisition_type || "-"}
                                    </td>

                                    <td className="border p-3">
                                      {lot.source_name || "-"}
                                    </td>

                                    <td className="border p-3 text-right">
                                      {formatBaht(lot.cost_price)}
                                    </td>

                                    <td className="border p-3 text-right font-bold text-green-700">
                                      {formatBaht(lot.highest_offer)}
                                    </td>

                                    <td className="border p-3">
                                      <p className="font-semibold">
                                        {lot.winner_shop_name || "-"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {lot.winner_phone || "-"}
                                      </p>
                                    </td>

                                    <td className="border p-3">
                                      {lot.second_place_text || "-"}
                                    </td>

                                    <td
                                      className={
                                        Number(lot.diff || 0) >= 0
                                          ? "border p-3 text-right font-bold text-green-700"
                                          : "border p-3 text-right font-bold text-red-700"
                                      }
                                    >
                                      {formatBaht(lot.diff)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>

                      <section className="mt-6">
                        <h3 className="text-lg font-bold text-gray-900">
                          รายละเอียดราคาเสนอทั้งหมด
                        </h3>

                        {roundOffers.length === 0 ? (
                          <div className="mt-3 rounded-2xl bg-gray-50 p-5 text-gray-600">
                            ไม่มีข้อมูลราคาเสนอในรอบนี้
                          </div>
                        ) : (
                          <div className="mt-3 space-y-4">
                            {roundLots.map((lot) => {
                              const lotNumber = lot.lot_number || "-";
                              const offers = offersByLotNumber.get(lotNumber) || [];

                              return (
                                <details
                                  key={lot.id}
                                  className="rounded-2xl border bg-white p-4"
                                >
                                  <summary className="cursor-pointer font-bold text-gray-900">
                                    Lot {lotNumber} •{" "}
                                    {lot.motorcycle_name || "-"} •{" "}
                                    {offers.length} ราคา
                                  </summary>

                                  {offers.length === 0 ? (
                                    <p className="mt-3 text-sm text-gray-500">
                                      ไม่มีราคาเสนอ
                                    </p>
                                  ) : (
                                    <div className="mt-3 overflow-x-auto">
                                      <table className="w-full border-collapse text-left text-sm">
                                        <thead>
                                          <tr className="bg-gray-100 text-gray-700">
                                            <th className="border p-2">อันดับ</th>
                                            <th className="border p-2">ร้าน</th>
                                            <th className="border p-2">ผู้ติดต่อ</th>
                                            <th className="border p-2">โทร</th>
                                            <th className="border p-2 text-right">
                                              ราคา
                                            </th>
                                            <th className="border p-2">เวลา</th>
                                            <th className="border p-2">หมายเหตุ</th>
                                          </tr>
                                        </thead>

                                        <tbody>
                                          {offers.map((offer, index) => (
                                            <tr key={offer.id}>
                                              <td className="border p-2 font-bold">
                                                {index + 1}
                                              </td>

                                              <td className="border p-2">
                                                {offer.shop_name || "-"}
                                              </td>

                                              <td className="border p-2">
                                                {offer.merchant_name || "-"}
                                              </td>

                                              <td className="border p-2">
                                                {offer.phone || "-"}
                                              </td>

                                              <td className="border p-2 text-right font-bold text-green-700">
                                                {formatBaht(offer.offer_price)}
                                              </td>

                                              <td className="border p-2">
                                                {formatThaiTime(
                                                  offer.updated_at ||
                                                    offer.submitted_at
                                                )}
                                              </td>

                                              <td className="border p-2">
                                                {offer.was_edited ? (
                                                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-800">
                                                    แก้ไขแล้ว
                                                    {offer.original_offer_price
                                                      ? ` / เดิม ${Number(
                                                          offer.original_offer_price
                                                        ).toLocaleString()} บาท`
                                                      : ""}
                                                  </span>
                                                ) : (
                                                  "-"
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </details>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </section>
      </main>
    </StaffGuard>
  );
}