"use client";

import { useEffect, useState } from "react";

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  price: string;
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
      setSubmission(JSON.parse(savedSubmission));
    }
  }, []);

  function logoutMerchant() {
    localStorage.removeItem("merchantSession");
    localStorage.removeItem("latestSubmission");
    window.location.href = "/merchant-login";
  }

  if (!submission) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600">
            !
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            ไม่พบใบยืนยัน
          </h1>

          <p className="mt-3 text-gray-600">
            ไม่พบข้อมูลการส่งราคาบนอุปกรณ์นี้
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

  const total = submission.offers.reduce((sum, offer) => {
    return sum + Number(offer.price || 0);
  }, 0);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
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
            box-shadow: none !important;
            border: none !important;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-table {
            page-break-inside: auto;
          }

          .print-row {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <main className="min-h-screen bg-gray-50 px-4 py-8 print-page">
        <section className="mx-auto max-w-4xl">
          <div
            id="print-receipt"
            className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200"
          >
            <div className="bg-green-600 px-6 py-6 text-white no-print">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold text-green-600">
                ✓
              </div>

              <h1 className="mt-4 text-2xl font-bold">
                {submission.isUpdatedSubmission
                  ? "แก้ไขราคาเรียบร้อย"
                  : "ส่งราคาเรียบร้อย"}
              </h1>

              <p className="mt-2 text-sm text-green-50">
                ระบบบันทึกราคาของร้านแล้ว
              </p>
            </div>

            <div className="p-6">
              <div className="hidden print:block">
                <div className="border-b-2 border-black pb-4">
                  <h1 className="text-center text-2xl font-bold text-black">
                    ใบยืนยันการเสนอราคา
                  </h1>

                  <p className="mt-1 text-center text-sm text-gray-700">
                    ระบบเสนอราคารถจักรยานยนต์
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border bg-gray-50 p-4 print:mt-4 print:rounded-none print:border-black print:bg-white">
                <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      เลขที่อ้างอิง
                    </p>
                    <p className="mt-1 font-bold text-gray-900 print:text-black">
                      {submission.receiptNo}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      เวลาส่ง
                    </p>
                    <p className="mt-1 font-bold text-gray-900 print:text-black">
                      {submission.submittedAt}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      ร้านค้า
                    </p>
                    <p className="mt-1 font-bold text-gray-900 print:text-black">
                      {submission.shopName}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      ผู้ติดต่อ
                    </p>
                    <p className="mt-1 font-bold text-gray-900 print:text-black">
                      {submission.merchantName}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      โทร
                    </p>
                    <p className="mt-1 font-bold text-gray-900 print:text-black">
                      {submission.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 print:text-black">
                      ราคารวม
                    </p>
                    <p className="mt-1 text-xl font-bold text-green-700 print:text-black">
                      {total.toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 print:mt-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 print:text-lg print:text-black">
                      รายการที่ส่ง
                    </h2>

                    <p className="mt-1 text-sm text-gray-600 print:text-black">
                      ทั้งหมด {submission.offers.length} รายการ
                    </p>
                  </div>
                </div>

                <div className="mt-4 hidden print:block">
                  <table className="print-table w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-black p-2 text-left">
                          ลำดับ
                        </th>
                        <th className="border border-black p-2 text-left">
                          Lot
                        </th>
                        <th className="border border-black p-2 text-left">
                          รายการรถ
                        </th>
                        <th className="border border-black p-2 text-right">
                          ราคาเสนอ
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {submission.offers.map((offer, index) => (
                        <tr key={offer.motorcycle_id} className="print-row">
                          <td className="border border-black p-2">
                            {index + 1}
                          </td>
                          <td className="border border-black p-2">
                            {offer.lot}
                          </td>
                          <td className="border border-black p-2">
                            {offer.motorcycle}
                          </td>
                          <td className="border border-black p-2 text-right font-bold">
                            {Number(offer.price).toLocaleString()} บาท
                          </td>
                        </tr>
                      ))}

                      <tr>
                        <td
                          colSpan={3}
                          className="border border-black p-2 text-right font-bold"
                        >
                          รวม
                        </td>
                        <td className="border border-black p-2 text-right font-bold">
                          {total.toLocaleString()} บาท
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 space-y-3 print:hidden">
                  {submission.offers.map((offer) => (
                    <div
                      key={offer.motorcycle_id}
                      className="rounded-2xl border bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Lot {offer.lot}
                          </p>

                          <h3 className="mt-1 font-bold text-gray-900">
                            {offer.motorcycle}
                          </h3>
                        </div>

                        <p className="text-lg font-bold text-green-700">
                          {Number(offer.price).toLocaleString()} บาท
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 print:mt-6 print:rounded-none print:border-black print:bg-white print:text-black">
                <p className="font-semibold">หมายเหตุ</p>
                <p className="mt-1 text-sm">
                  เอกสารนี้เป็นหลักฐานการส่งราคาผ่านระบบ
                  การแสดงราคาเสนอไม่ถือว่าการซื้อขายเสร็จสมบูรณ์ทันที
                  บริษัทจะเป็นผู้พิจารณาและติดต่อกลับตามขั้นตอน
                </p>
              </div>

              <div className="mt-8 hidden print:grid print:grid-cols-2 print:gap-12">
                <div className="pt-10 text-center">
                  <div className="border-t border-black pt-2">
                    ผู้เสนอราคา / ร้านค้า
                  </div>
                </div>

                <div className="pt-10 text-center">
                  <div className="border-t border-black pt-2">
                    ผู้รับเอกสาร / บริษัท
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 no-print">
                <a
                  href="/merchant"
                  className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
                >
                  กลับไปหน้าเสนอราคา
                </a>

                <button
                  onClick={() => window.print()}
                  className="rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow"
                >
                  พิมพ์ / บันทึกใบยืนยัน
                </button>

                <button
                  onClick={logoutMerchant}
                  className="rounded-2xl border border-red-200 px-5 py-3 font-semibold text-red-700 hover:bg-red-50"
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}