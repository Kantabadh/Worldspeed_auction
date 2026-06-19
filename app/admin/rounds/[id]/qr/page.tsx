"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import {
  formatAuctionDisplayOrder,
  sortBySavedAuctionDisplayOrder,
} from "@/lib/auctionDisplayOrder";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type AuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
};

type QrMotorcycle = {
  id: number;
  stock_motorcycle_id: number | null;
  display_order: number | null;
  motorcycle_name: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  license_plate: string | null;
  frame_number: string | null;
  registration_status: string | null;
  tax_expiry: string | null;
  notes: string | null;
};

function getOrigin() {
  if (typeof window === "undefined") return "";

  return window.location.origin;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function formatText(value?: string | number | null) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function getMotorcycleTitle(motorcycle: QrMotorcycle) {
  return (
    [motorcycle.brand, motorcycle.model].filter(Boolean).join(" ") ||
    motorcycle.motorcycle_name ||
    "-"
  );
}

export default function RoundQrPrintPage() {
  const params = useParams<{ id: string }>();
  const roundId = Number(params.id);

  const [round, setRound] = useState<AuctionRound | null>(null);
  const [motorcycles, setMotorcycles] = useState<QrMotorcycle[]>([]);
  const [siteOrigin, setSiteOrigin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSiteOrigin(getOrigin());
  }, []);

  useEffect(() => {
    async function loadQrData() {
      if (!Number.isFinite(roundId)) {
        setErrorMessage("ไม่พบรอบเสนอราคา");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      const { data: roundData, error: roundError } = await supabase
        .from("auction_rounds")
        .select("id, round_name, auction_date, status")
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) {
        setErrorMessage(roundError.message);
        setIsLoading(false);
        return;
      }

      const { data: motorcycleData, error: motorcycleError } = await supabase
        .from("motorcycles")
        .select(
          "id, stock_motorcycle_id, display_order, motorcycle_name, brand, model, year, color, license_plate, frame_number, registration_status, tax_expiry, notes"
        )
        .eq("auction_round_id", roundId);

      if (motorcycleError) {
        setErrorMessage(motorcycleError.message);
        setIsLoading(false);
        return;
      }

      setRound((roundData as AuctionRound | null) || null);
      setMotorcycles(
        sortBySavedAuctionDisplayOrder(
          (motorcycleData as QrMotorcycle[] | null) || []
        )
      );
      setIsLoading(false);
    }

    loadQrData();
  }, [roundId]);

  const qrCards = useMemo(
    () =>
      motorcycles
        .filter((motorcycle) => motorcycle.stock_motorcycle_id)
        .map((motorcycle) => ({
          motorcycle,
          order: formatAuctionDisplayOrder(motorcycle.display_order),
          url: `${siteOrigin}/merchant?motorcycleId=${motorcycle.stock_motorcycle_id}`,
        })),
    [motorcycles, siteOrigin]
  );
  const qrPages = useMemo(() => chunkItems(qrCards, 3), [qrCards]);

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10 text-gray-900">
        <style>{`
          .print-sheet {
            padding-bottom: 32px;
          }

          .print-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 18px;
            padding: 10mm;
            background: white;
            box-shadow: 0 12px 35px rgba(15, 23, 42, 0.16);
          }

          .qr-page-grid {
            display: grid;
            grid-template-rows: repeat(3, minmax(0, 1fr));
            gap: 5mm;
            height: 277mm;
          }

          .lot-block {
            break-inside: avoid;
            page-break-inside: avoid;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 48mm;
            gap: 8mm;
            min-height: 0;
            border: 1.5px solid #111827;
            border-radius: 4mm;
            padding: 6mm;
            background: white;
            color: #111827;
          }

          .qr-code {
            width: 45mm;
            height: 45mm;
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm;
            }

            html,
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .no-print {
              display: none !important;
            }

            main {
              min-height: 0 !important;
              background: white !important;
              padding: 0 !important;
            }

            .print-sheet {
              margin: 0 !important;
              max-width: none !important;
              padding: 0 !important;
            }

            .print-page {
              width: auto !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              page-break-after: always;
              break-after: page;
            }

            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .qr-page-grid {
              display: grid !important;
              grid-template-rows: repeat(3, minmax(0, 1fr));
              gap: 5mm;
              height: calc(297mm - 20mm);
            }

            .lot-block {
              break-inside: avoid;
              page-break-inside: avoid;
              box-shadow: none !important;
            }

            .qr-code {
              width: 45mm !important;
              height: 45mm !important;
            }
          }
        `}</style>

        <section className="no-print mx-auto max-w-6xl px-4 py-5">
          <BackButton fallbackHref="/admin/rounds" />

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">พิมพ์ QR รถ</h1>
              <p className="mt-1 text-sm text-gray-600">
                {round?.round_name || `รอบ #${roundId}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={isLoading || qrCards.length === 0}
              className="rounded-xl bg-black px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              พิมพ์ QR
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          )}
        </section>

        <section className="print-sheet mx-auto max-w-6xl px-4">
          {isLoading ? (
            <div className="no-print rounded-2xl bg-white p-5 text-gray-600 shadow-sm ring-1 ring-gray-200">
              กำลังโหลด QR...
            </div>
          ) : qrCards.length === 0 ? (
            <div className="no-print rounded-2xl bg-white p-5 text-gray-600 shadow-sm ring-1 ring-gray-200">
              ยังไม่มีรถในรอบนี้
            </div>
          ) : (
            <div>
              {qrPages.map((pageCards, pageIndex) => (
                <div key={pageIndex} className="print-page">
                  <div className="qr-page-grid">
                    {pageCards.map(({ motorcycle, order, url }) => (
                      <article key={motorcycle.id} className="lot-block">
                        <div className="min-w-0">
                          <p className="text-[30px] font-black leading-none tracking-normal text-black">
                            ลำดับ {order}
                          </p>
                          <h2 className="mt-3 text-[22px] font-extrabold leading-tight text-black">
                            {getMotorcycleTitle(motorcycle)}
                          </h2>
                          <p className="mt-2 text-[20px] font-bold leading-tight text-black">
                            ทะเบียน {formatText(motorcycle.license_plate)}
                          </p>

                          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] leading-tight text-black">
                            <div>
                              <dt className="font-semibold">ปี</dt>
                              <dd>{formatText(motorcycle.year)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">สี</dt>
                              <dd>{formatText(motorcycle.color)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">เลขตัวถัง</dt>
                              <dd className="break-all">
                                {formatText(motorcycle.frame_number)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold">สถานะเล่ม</dt>
                              <dd>{formatText(motorcycle.registration_status)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">ภาษีหมดอายุ</dt>
                              <dd>{formatText(motorcycle.tax_expiry)}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold">หมายเหตุ</dt>
                              <dd>{formatText(motorcycle.notes)}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-3 text-center">
                          <QRCodeSVG
                            value={url}
                            size={180}
                            level="M"
                            className="qr-code"
                          />
                          <p className="text-[12px] font-semibold leading-tight text-black">
                            สแกนเพื่อเสนอราคา
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </StaffGuard>
  );
}
