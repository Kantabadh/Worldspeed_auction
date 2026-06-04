"use client";

import { useEffect, useState } from "react";
import {
  formatAuctionDisplayOrder,
  getAuctionDisplayLabel,
} from "@/lib/auctionDisplayOrder";

type Offer = {
  motorcycle_id: number;
  display_order?: number | null;
  lot: string;
  motorcycle: string;
  brand?: string;
  model?: string;
  year?: string;
  license_plate?: string;
  price: string;
  wasEdited?: boolean;
};

type FinalSubmission = {
  merchantName: string;
  shopName: string;
  phone: string;
  offers: Offer[];
  submittedAt: string;
  receiptNo: string;
  isUpdatedSubmission?: boolean;
};

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export default function SuccessPage() {
  const [submission, setSubmission] = useState<FinalSubmission | null>(null);

  useEffect(() => {
    const savedSubmission = localStorage.getItem("latestSubmission");

    if (savedSubmission) {
      try {
        setSubmission(JSON.parse(savedSubmission));
      } catch {
        setSubmission(null);
      }
    }
  }, []);

  function logoutMerchant() {
    localStorage.removeItem("merchantSession");
    localStorage.removeItem("latestSubmission");
    window.location.href = "/merchant-login";
  }

  function goBackToMerchantPage() {
    window.location.href = "/merchant";
  }

  function getSubmissionDateTime(submittedAt?: string) {
    if (!submittedAt) return "-";

    const numericThaiDate = submittedAt.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+)?(.*)$/
    );

    if (numericThaiDate) {
      const day = Number(numericThaiDate[1]);
      const month = Number(numericThaiDate[2]);
      const year = Number(numericThaiDate[3]);
      const time = numericThaiDate[4]?.trim();
      const displayYear = year < 2400 ? year + 543 : year;
      const monthName = THAI_MONTHS[month - 1];

      if (day && monthName && year) {
        return `${day} ${monthName} ${displayYear}${time ? ` เวลา ${time}` : ""}`;
      }
    }

    const date = new Date(submittedAt);

    if (Number.isNaN(date.getTime())) {
      return submittedAt;
    }

    const year = date.getFullYear();
    const displayYear = year < 2400 ? year + 543 : year;

    return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${displayYear} เวลา ${date.toLocaleTimeString("th-TH")}`;
  }

  if (!submission) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-red-600">
            !
          </div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            ไม่พบข้อมูลการส่งราคา
          </h1>

          <p className="mt-3 text-gray-600">
            ไม่พบข้อมูลการส่งราคาบนอุปกรณ์นี้ กรุณากลับไปหน้าเสนอราคา
          </p>

          <a
            href="/merchant"
            className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
          >
            กลับไปหน้าเสนอราคา
          </a>
        </section>
      </main>
    );
  }

  const editedCount = submission.offers.filter((offer) => offer.wasEdited)
    .length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="bg-green-600 px-6 py-8 text-center text-white">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl font-bold text-green-600">
            ✓
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            {submission.isUpdatedSubmission
              ? "แก้ไขราคาเรียบร้อย"
              : "ส่งราคาเรียบร้อย"}
          </h1>

          <p className="mt-3 text-green-50">
            เจ้าหน้าที่จะพิมพ์ใบเสนอราคาของร้านค้าให้
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-500">ร้านค้า</p>
                <p className="mt-1 font-bold text-gray-900">
                  {submission.shopName || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">ผู้ติดต่อ</p>
                <p className="mt-1 font-bold text-gray-900">
                  {submission.merchantName || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">โทร</p>
                <p className="mt-1 font-bold text-gray-900">
                  {submission.phone || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">จำนวน</p>
                <p className="mt-1 font-bold text-gray-900">
                  {submission.offers.length} รายการ
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-500">เวลา</p>
                <p className="mt-1 font-bold text-gray-900">
                  {getSubmissionDateTime(submission.submittedAt)}
                </p>
              </div>

              {submission.isUpdatedSubmission && editedCount > 0 && (
                <div className="sm:col-span-2">
                  <p className="rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-bold text-yellow-800">
                    มีรายการที่แก้ไข {editedCount} ล็อต
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {submission.offers.map((offer) => (
              <div
                key={offer.motorcycle_id}
                className="rounded-2xl border bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-gray-900">
                    ลำดับ{" "}
                    {formatAuctionDisplayOrder(offer.display_order ?? offer.lot)}{" "}
                    {getAuctionDisplayLabel(offer)}
                  </p>

                  <p className="text-lg font-bold text-green-700">
                    {Number(offer.price).toLocaleString()} บาท
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={goBackToMerchantPage}
              className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
            >
              ย้อนกลับ
            </button>

            <button
              onClick={logoutMerchant}
              className="rounded-2xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
