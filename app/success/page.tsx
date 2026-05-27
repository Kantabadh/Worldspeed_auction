"use client";

import { useEffect, useState } from "react";

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
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

    const date = new Date(submittedAt);

    if (Number.isNaN(date.getTime())) {
      return submittedAt;
    }

    return date.toLocaleString("th-TH", {
      dateStyle: "long",
      timeStyle: "medium",
    });
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
            ระบบบันทึกราคาของร้านเรียบร้อยแล้ว
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
                <p className="text-sm font-medium text-gray-500">จำนวน Lot</p>
                <p className="mt-1 font-bold text-gray-900">
                  {submission.offers.length} รายการ
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-500">เวลาส่งราคา</p>
                <p className="mt-1 font-bold text-gray-900">
                  {getSubmissionDateTime(submission.submittedAt)}
                </p>
              </div>

              {submission.isUpdatedSubmission && editedCount > 0 && (
                <div className="sm:col-span-2">
                  <p className="rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-bold text-yellow-800">
                    มีรายการที่แก้ไข {editedCount} Lot
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
            <p className="font-bold">ไม่ต้องพิมพ์ใบยืนยันเอง</p>
            <p className="mt-1 text-sm">
              เจ้าหน้าที่จะเป็นผู้พิมพ์ใบเสนอราคาจากหน้าผู้ดูแลระบบให้
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={goBackToMerchantPage}
              className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
            >
              กลับไปดูรายการที่ส่ง
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