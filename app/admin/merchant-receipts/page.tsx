"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type ReceiptOffer = {
  id: number;
  merchant_id: number;
  motorcycle_id: number;
  offer_price: number;
  submitted_at: string;
  was_edited: boolean | null;
  original_offer_price: number | null;
  updated_at: string | null;
  merchants: {
    id: number;
    name: string;
    shop_name: string;
    phone: string;
  } | null;
  motorcycles: {
    id: number;
    lot_number: string;
    motorcycle_name: string;
  } | null;
};

type MerchantGroup = {
  merchantId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  offers: ReceiptOffer[];
  latestSubmittedAt: string;
  editedCount: number;
};

function formatThaiDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value || "-";

  return date.toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "medium",
  });
}

function formatThaiDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value || "-";

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatThaiTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatBaht(value: number) {
  return `${Number(value || 0).toLocaleString()} บาท`;
}

function makeReceiptNo(group: MerchantGroup) {
  const latestDate = new Date(group.latestSubmittedAt);

  const y = latestDate.getFullYear();
  const m = String(latestDate.getMonth() + 1).padStart(2, "0");
  const d = String(latestDate.getDate()).padStart(2, "0");

  return `MR-${y}${m}${d}-${group.merchantId}`;
}

function getEditNote(offer: ReceiptOffer) {
  if (!offer.was_edited) return "";

  const oldPrice = offer.original_offer_price;
  const newPrice = offer.offer_price;

  if (oldPrice !== null && oldPrice !== undefined) {
    return `แก้ไขแล้ว / ราคาเดิม: ${Number(oldPrice).toLocaleString()} บาท`;
  }

  return "แก้ไขแล้ว";
}

export default function AdminMerchantReceiptsPage() {
  const [offers, setOffers] = useState<ReceiptOffer[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(
    null
  );
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadOffers() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("offers")
      .select(
        `
        id,
        merchant_id,
        motorcycle_id,
        offer_price,
        submitted_at,
        was_edited,
        original_offer_price,
        updated_at,
        merchants (
          id,
          name,
          shop_name,
          phone
        ),
        motorcycles (
          id,
          lot_number,
          motorcycle_name
        )
      `
      )
      .order("submitted_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setOffers((data as unknown as ReceiptOffer[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadOffers();
  }, []);

  const merchantGroups = useMemo(() => {
    const map = new Map<number, MerchantGroup>();

    offers.forEach((offer) => {
      const merchantId = Number(offer.merchant_id);

      if (!map.has(merchantId)) {
        map.set(merchantId, {
          merchantId,
          merchantName: offer.merchants?.name || "-",
          shopName: offer.merchants?.shop_name || "-",
          phone: offer.merchants?.phone || "-",
          offers: [],
          latestSubmittedAt: offer.submitted_at,
          editedCount: 0,
        });
      }

      const group = map.get(merchantId);

      if (!group) return;

      group.offers.push(offer);

      if (offer.was_edited) {
        group.editedCount += 1;
      }

      if (
        new Date(offer.submitted_at).getTime() >
        new Date(group.latestSubmittedAt).getTime()
      ) {
        group.latestSubmittedAt = offer.submitted_at;
      }

      if (
        offer.updated_at &&
        new Date(offer.updated_at).getTime() >
          new Date(group.latestSubmittedAt).getTime()
      ) {
        group.latestSubmittedAt = offer.updated_at;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      return a.shopName.localeCompare(b.shopName, "th");
    });
  }, [offers]);

  const filteredMerchantGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return merchantGroups;

    return merchantGroups.filter((group) => {
      const text = [
        group.shopName,
        group.merchantName,
        group.phone,
        group.merchantId,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [merchantGroups, searchText]);

  const selectedGroup =
    merchantGroups.find((group) => group.merchantId === selectedMerchantId) ||
    null;

  const sortedSelectedOffers = selectedGroup
    ? [...selectedGroup.offers].sort((a, b) => {
        const lotA = a.motorcycles?.lot_number || "";
        const lotB = b.motorcycles?.lot_number || "";

        return lotA.localeCompare(lotB, "th", {
          numeric: true,
          sensitivity: "base",
        });
      })
    : [];

  const selectedTotal = sortedSelectedOffers.reduce((sum, offer) => {
    return sum + Number(offer.offer_price || 0);
  }, 0);

  const selectedEditedCount = sortedSelectedOffers.filter(
    (offer) => offer.was_edited
  ).length;

  function printSelectedReceipt() {
    if (!selectedGroup) {
      alert("กรุณาเลือกร้านค้าก่อนพิมพ์");
      return;
    }

    window.print();
  }

  return (
    <StaffGuard>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          #print-receipt,
          #print-receipt * {
            visibility: visible;
          }

          #print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .no-print {
            display: none !important;
          }

          .print-row {
            page-break-inside: avoid;
          }

          .print-edited-badge {
            border: 1px solid #92400e !important;
            color: #92400e !important;
            background: #fef3c7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <div className="no-print">
            <BackButton />
          </div>

          <div className="no-print mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Admin Receipt
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                พิมพ์ใบเสนอราคาของร้านค้า
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                เลือกร้านค้า 1 ร้าน แล้วพิมพ์ใบเสนอราคาของร้านนั้นเท่านั้น
              </p>
            </div>

            <button
              onClick={loadOffers}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              โหลดใหม่
            </button>
          </div>

          {errorMessage && (
            <div className="no-print mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
            <section className="no-print rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  รายชื่อร้านค้า
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  มีร้านค้าที่ส่งราคา {merchantGroups.length} ร้าน
                </p>
              </div>

              <input
                className="mt-4 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="ค้นหาร้าน / ผู้ติดต่อ / เบอร์โทร"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              {isLoading && (
                <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-gray-600">
                  กำลังโหลดข้อมูล...
                </div>
              )}

              {!isLoading && filteredMerchantGroups.length === 0 && (
                <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-gray-600">
                  ไม่พบร้านค้า
                </div>
              )}

              <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {filteredMerchantGroups.map((group) => {
                  const isSelected = group.merchantId === selectedMerchantId;

                  return (
                    <button
                      key={group.merchantId}
                      onClick={() => setSelectedMerchantId(group.merchantId)}
                      className={
                        isSelected
                          ? "w-full rounded-2xl border-2 border-black bg-gray-50 p-4 text-left"
                          : "w-full rounded-2xl border bg-white p-4 text-left hover:bg-gray-50"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900">
                            {group.shopName}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {group.merchantName}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {group.phone}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            {group.offers.length} Lot
                          </span>

                          {group.editedCount > 0 && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                              แก้ไขแล้ว {group.editedCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        ส่ง/แก้ไขล่าสุด:{" "}
                        {formatThaiDateTime(group.latestSubmittedAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    ตัวอย่างใบเสนอราคา
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    {selectedGroup
                      ? `ร้าน: ${selectedGroup.shopName}`
                      : "เลือกร้านค้าก่อนพิมพ์"}
                  </p>

                  {selectedGroup && selectedEditedCount > 0 && (
                    <p className="mt-2 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                      มีรายการแก้ไขแล้ว {selectedEditedCount} Lot
                    </p>
                  )}
                </div>

                <button
                  onClick={printSelectedReceipt}
                  disabled={!selectedGroup}
                  className="rounded-2xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  พิมพ์ใบนี้
                </button>
              </div>

              {!selectedGroup ? (
                <div className="no-print rounded-2xl bg-gray-50 p-10 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    เลือกร้านค้าทางซ้ายก่อน
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    หลังจากเลือกแล้ว ระบบจะแสดงใบเสนอราคาของร้านนั้นตรงนี้
                  </p>
                </div>
              ) : (
                <div
                  id="print-receipt"
                  className="mx-auto max-w-[900px] overflow-hidden rounded-2xl border border-gray-300 bg-white"
                >
                  <div className="border-b-2 border-black px-5 py-4 text-center">
                    <h1 className="text-2xl font-bold text-black">
                      ใบยืนยันการเสนอราคา
                    </h1>

                    <p className="mt-1 text-sm text-gray-700">
                      ระบบเสนอราคารถจักรยานยนต์
                    </p>
                  </div>

                  <div className="p-5">
                    <section className="grid grid-cols-2 gap-x-6 gap-y-3 border border-black p-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-600">
                          เลขที่อ้างอิง
                        </p>
                        <p className="mt-1 font-bold text-black">
                          {makeReceiptNo(selectedGroup)}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-gray-600">วันที่พิมพ์</p>
                        <p className="mt-1 font-bold text-black">
                          {formatThaiDate(new Date().toISOString())}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-gray-600">ร้านค้า</p>
                        <p className="mt-1 font-bold text-black">
                          {selectedGroup.shopName}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-gray-600">ผู้ติดต่อ</p>
                        <p className="mt-1 font-bold text-black">
                          {selectedGroup.merchantName}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-gray-600">โทร</p>
                        <p className="mt-1 font-bold text-black">
                          {selectedGroup.phone}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-gray-600">
                          ส่ง/แก้ไขล่าสุด
                        </p>
                        <p className="mt-1 font-bold text-black">
                          {formatThaiDateTime(selectedGroup.latestSubmittedAt)}
                        </p>
                      </div>

                      {selectedEditedCount > 0 && (
                        <div className="col-span-2">
                          <span className="print-edited-badge inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                            มีรายการแก้ไขแล้ว {selectedEditedCount} Lot
                          </span>
                        </div>
                      )}
                    </section>

                    <section className="mt-4">
                      <table className="w-full border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="w-12 border border-black p-2 text-left">
                              ลำดับ
                            </th>
                            <th className="w-16 border border-black p-2 text-left">
                              Lot
                            </th>
                            <th className="border border-black p-2 text-left">
                              รายการรถ
                            </th>
                            <th className="w-32 border border-black p-2 text-right">
                              ราคาเสนอ
                            </th>
                            <th className="w-24 border border-black p-2 text-left">
                              เวลา
                            </th>
                            <th className="w-40 border border-black p-2 text-left">
                              หมายเหตุ
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {sortedSelectedOffers.map((offer, index) => {
                            const editNote = getEditNote(offer);

                            return (
                              <tr key={offer.id} className="print-row">
                                <td className="border border-black p-2">
                                  {index + 1}
                                </td>

                                <td className="border border-black p-2 font-bold">
                                  {offer.motorcycles?.lot_number || "-"}
                                </td>

                                <td className="border border-black p-2">
                                  {offer.motorcycles?.motorcycle_name || "-"}
                                </td>

                                <td className="border border-black p-2 text-right font-bold">
                                  {formatBaht(Number(offer.offer_price || 0))}
                                </td>

                                <td className="border border-black p-2">
                                  {formatThaiTime(
                                    offer.updated_at || offer.submitted_at
                                  )}
                                </td>

                                <td className="border border-black p-2">
                                  {editNote ? (
                                    <div>
                                      <span className="print-edited-badge inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-bold text-yellow-800">
                                        แก้ไขแล้ว
                                      </span>

                                      {offer.original_offer_price !== null &&
                                        offer.original_offer_price !==
                                          undefined && (
                                          <p className="mt-1 text-[11px] text-gray-700">
                                            เดิม{" "}
                                            {Number(
                                              offer.original_offer_price
                                            ).toLocaleString()}{" "}
                                            บาท
                                          </p>
                                        )}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        <tfoot>
                          <tr>
                            <td
                              colSpan={3}
                              className="border border-black p-2 text-right font-bold"
                            >
                              รวม
                            </td>

                            <td className="border border-black p-2 text-right font-bold">
                              {formatBaht(selectedTotal)}
                            </td>

                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </section>

                    <section className="mt-10 grid grid-cols-2 gap-6 text-center text-sm">
                      <div>
                        <div className="border-t border-black pt-3">
                          ร้านค้า / ผู้เสนอราคา
                        </div>
                      </div>

                      <div>
                        <div className="border-t border-black pt-3">
                          เจ้าหน้าที่ผู้ตรวจสอบ
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </StaffGuard>
  );
}