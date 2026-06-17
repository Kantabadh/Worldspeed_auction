"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import {
  formatAuctionDisplayOrder,
  getAuctionDisplayLabel,
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
  license_plate: string | null;
};

function getOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredOrigin) return configuredOrigin;
  if (typeof window === "undefined") return "";

  return window.location.origin;
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
          "id, stock_motorcycle_id, display_order, motorcycle_name, brand, model, year, license_plate"
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
          label: getAuctionDisplayLabel(motorcycle),
          order: formatAuctionDisplayOrder(motorcycle.display_order),
          url: `${siteOrigin}/merchant?motorcycleId=${motorcycle.stock_motorcycle_id}`,
        })),
    [motorcycles, siteOrigin]
  );

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10 text-gray-900">
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }

            body {
              background: white !important;
            }

            .no-print {
              display: none !important;
            }

            .print-sheet {
              margin: 0 !important;
              max-width: none !important;
              padding: 0 !important;
            }

            .qr-grid {
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 8mm;
            }

            .qr-card {
              break-inside: avoid;
              box-shadow: none !important;
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
            <div className="qr-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {qrCards.map(({ motorcycle, label, order, url }) => (
                <article
                  key={motorcycle.id}
                  className="qr-card flex min-h-[190px] flex-col items-center justify-between rounded-lg border border-gray-300 bg-white p-4 text-center shadow-sm"
                >
                  <div>
                    <p className="text-lg font-bold">ลำดับ {order}</p>
                    <p className="mt-1 text-sm font-semibold">{label}</p>
                  </div>

                  <QRCodeSVG value={url} size={112} level="M" />
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </StaffGuard>
  );
}
