"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";
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
};

type AdminOffer = {
  id: number;
  merchant_id: number;
  motorcycle_id: number;
  auction_round_id: number | null;
  offer_price: number;
  submitted_at: string;
  merchants: {
    name: string | null;
    shop_name: string | null;
    phone: string | null;
  } | null;
  motorcycles: {
    id: number;
    lot_number: string | null;
    motorcycle_name: string | null;
    cost_price: number | null;
    active: boolean | null;
    stock_motorcycle_id: number | null;
    auction_round_id: number | null;
    lot_sale_status: string | null;
    sold_price: number | null;
    sold_to_merchant_id: number | null;
    sold_at: string | null;
    sold_by_email: string | null;
  } | null;
};

type LotResult = {
  lotKey: string;
  motorcycle: ArrangementMotorcycle | null;
  offers: AdminOffer[];
  topOffers: AdminOffer[];
  highestPrice: number;
};

type ArrangementMotorcycle = {
  id: number;
  lot_number: string | null;
  round_lot_number?: string | null;
  sort_order?: number | null;
  motorcycle_name: string | null;
  brand: string | null;
  model: string | null;
  frame_number: string | null;
  engine_number: string | null;
  color: string | null;
  source_name: string | null;
  cost_price: number | null;
  stock_motorcycle_id: number | null;
  notes: string | null;
  active: boolean | null;
  lot_sale_status: string | null;
  auction_round_id: number | null;
};

type RoundLotMapping = {
  original_motorcycle_id: number | null;
  lot_number: string | null;
  round_lot_number?: string | null;
  sort_order?: number | null;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

type WinnerChooser = {
  lot: LotResult;
  offers: AdminOffer[];
  mode: "winner" | "runner-up";
} | null;

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

function formatMoney(value: number | null | undefined) {
  const numberValue = Number(value || 0);

  if (!numberValue) return "-";

  return numberValue.toLocaleString();
}

function getRoundStatusLabel(status?: string | null) {
  if (status === "draft") return "เตรียมรอบ";
  if (status === "open") return "เปิดรับราคา";
  if (status === "closed") return "ปิดรับราคา";
  if (status === "finished") return "จบรอบแล้ว";
  if (status === "archived") return "บันทึกประวัติแล้ว";
  return status || "-";
}

function getStatusBadgeClass(status?: string | null) {
  if (status === "open") return "bg-green-100 text-green-700";
  if (status === "closed") return "bg-red-100 text-red-700";
  if (status === "finished") return "bg-purple-100 text-purple-700";
  if (status === "archived") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-700";
}

function getMerchantName(offer: AdminOffer) {
  return (
    offer.merchants?.shop_name ||
    offer.merchants?.name ||
    offer.merchants?.phone ||
    "-"
  );
}

function getMerchantPhone(offer: AdminOffer) {
  return offer.merchants?.phone || "-";
}

function getOfferGroupsByPrice(offers: AdminOffer[]) {
  const sortedOffers = [...offers].sort(
    (a, b) => Number(b.offer_price) - Number(a.offer_price)
  );
  const groups: AdminOffer[][] = [];

  sortedOffers.forEach((offer) => {
    const lastGroup = groups[groups.length - 1];

    if (
      lastGroup &&
      Number(lastGroup[0].offer_price) === Number(offer.offer_price)
    ) {
      lastGroup.push(offer);
    } else {
      groups.push([offer]);
    }
  });

  return groups;
}

function getSaleStatusLabel(status?: string | null) {
  if (status === "sold") return "ขายแล้ว";
  if (status === "unsold") return "กลับเข้าสต็อกแล้ว";
  return "รอดำเนินการ";
}

function getSaleStatusBadgeClass(status?: string | null) {
  if (status === "sold") return "bg-purple-100 text-purple-700";
  if (status === "unsold") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function getSavedStaffProfile() {
  if (typeof window === "undefined") return null;

  const savedProfileText = localStorage.getItem("staffProfile");

  if (!savedProfileText) return null;

  try {
    return JSON.parse(savedProfileText) as StaffProfile;
  } catch {
    return null;
  }
}

function formatFileDate(dateInput: Date) {
  const year = dateInput.getFullYear() + 543;
  const month = String(dateInput.getMonth() + 1).padStart(2, "0");
  const day = String(dateInput.getDate()).padStart(2, "0");
  const hour = String(dateInput.getHours()).padStart(2, "0");
  const minute = String(dateInput.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hour}-${minute}`;
}

function formatRoundFilePart(round: AuctionRound | null) {
  return (round?.round_name || (round?.id ? `รอบ_${round.id}` : "รอบเสนอราคา"))
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
}

function getArrangementLotNumber(motorcycle: ArrangementMotorcycle | null) {
  return motorcycle?.round_lot_number || motorcycle?.lot_number || "-";
}

function sortArrangementMotorcycles(items: ArrangementMotorcycle[]) {
  return [...items].sort((a, b) => {
    const sortA = a.sort_order;
    const sortB = b.sort_order;

    if (sortA !== null && sortA !== undefined && sortB !== null && sortB !== undefined) {
      return Number(sortA) - Number(sortB);
    }

    if (sortA !== null && sortA !== undefined) return -1;
    if (sortB !== null && sortB !== undefined) return 1;

    const roundLotA = a.round_lot_number;
    const roundLotB = b.round_lot_number;

    if (roundLotA && roundLotB) {
      return roundLotA.localeCompare(roundLotB, "th", { numeric: true });
    }

    if (roundLotA) return -1;
    if (roundLotB) return 1;

    return [a.brand, a.model, a.frame_number]
      .join(" ")
      .localeCompare([b.brand, b.model, b.frame_number].join(" "), "th", {
        numeric: true,
      });
  });
}

export default function AdminRoundDetailPage() {
  const params = useParams<{ id: string }>();
  const roundId = Number(params.id);

  const [round, setRound] = useState<AuctionRound | null>(null);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [arrangementMotorcycles, setArrangementMotorcycles] = useState<
    ArrangementMotorcycle[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionMotorcycleId, setActionMotorcycleId] = useState<number | null>(
    null
  );
  const [isFinishingRound, setIsFinishingRound] = useState(false);
  const [winnerChooser, setWinnerChooser] = useState<WinnerChooser>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function createAuditLog({
    action,
    targetType,
    targetId,
    targetName,
    details,
  }: {
    action: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: Record<string, unknown>;
  }) {
    const staffProfile = getSavedStaffProfile();

    const { error } = await supabase.from("admin_audit_logs").insert({
      staff_id: staffProfile?.id || null,
      staff_email: staffProfile?.email || null,
      staff_role: staffProfile?.role || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      target_name: targetName || null,
      details: details || {},
    });

    if (error) {
      console.error("Audit log error:", error.message);
    }
  }

  async function loadArrangementMotorcycles() {
    const { data, error } = await supabase
      .from("motorcycles")
      .select(
        `
        id,
        lot_number,
        motorcycle_name,
        brand,
        model,
        frame_number,
        engine_number,
        color,
        source_name,
        cost_price,
        stock_motorcycle_id,
        notes,
        active,
        lot_sale_status,
        auction_round_id
      `
      )
      .eq("auction_round_id", roundId);

    if (error) throw new Error(error.message);

    let mappingRows: RoundLotMapping[] = [];
    const mappingResult = await supabase
      .from("auction_round_lots")
      .select("original_motorcycle_id, lot_number, round_lot_number, sort_order")
      .eq("auction_round_id", roundId);

    if (!mappingResult.error) {
      mappingRows = (mappingResult.data as unknown as RoundLotMapping[]) || [];
    } else {
      const fallbackMappingResult = await supabase
        .from("auction_round_lots")
        .select("original_motorcycle_id, lot_number")
        .eq("auction_round_id", roundId);

      if (!fallbackMappingResult.error) {
        mappingRows =
          (fallbackMappingResult.data as unknown as RoundLotMapping[]) || [];
      }
    }

    const mappingByMotorcycleId = new Map<number, RoundLotMapping>();
    mappingRows.forEach((mapping) => {
      if (mapping.original_motorcycle_id) {
        mappingByMotorcycleId.set(mapping.original_motorcycle_id, mapping);
      }
    });

    const motorcycles = ((data as unknown as ArrangementMotorcycle[]) || []).map(
      (motorcycle) => {
        const mapping = mappingByMotorcycleId.get(motorcycle.id);

        return {
          ...motorcycle,
          round_lot_number:
            mapping?.round_lot_number || mapping?.lot_number || motorcycle.lot_number,
          sort_order: mapping?.sort_order || null,
        };
      }
    );

    setArrangementMotorcycles(
      sortArrangementMotorcycles(motorcycles)
    );
  }

  async function loadRoundDetail() {
    if (!roundId || Number.isNaN(roundId)) {
      setErrorMessage("ไม่พบรหัสรอบเสนอราคา");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data: roundData, error: roundError } = await supabase
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
        closed_at
      `
      )
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) {
      setErrorMessage(roundError.message);
      setIsLoading(false);
      return;
    }

    if (!roundData) {
      setErrorMessage("ไม่พบรอบเสนอราคานี้");
      setIsLoading(false);
      return;
    }

    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .select(
        `
        id,
        merchant_id,
        motorcycle_id,
        auction_round_id,
        offer_price,
        submitted_at,
        merchants (
          name,
          shop_name,
          phone
        ),
        motorcycles (
          id,
          lot_number,
          motorcycle_name,
          cost_price,
          active,
          stock_motorcycle_id,
          auction_round_id,
          lot_sale_status,
          sold_price,
          sold_to_merchant_id,
          sold_at,
          sold_by_email
        )
      `
      )
      .eq("auction_round_id", roundId)
      .order("offer_price", { ascending: false });

    if (offerError) {
      setErrorMessage(offerError.message);
      setIsLoading(false);
      return;
    }

    try {
      await loadArrangementMotorcycles();
      setRound(roundData as AuctionRound);
      setOffers((offerData as unknown as AdminOffer[]) || []);
      setIsLoading(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "โหลดรายการจัดเรียงล็อตไม่สำเร็จ"
      );
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRoundDetail();
  }, [roundId]);

  const lotResults = useMemo(() => {
    const groupedLots = arrangementMotorcycles.reduce((summary, motorcycle) => {
      summary[String(motorcycle.id)] = {
        lotKey: String(motorcycle.id),
        motorcycle,
        offers: [],
        topOffers: [],
        highestPrice: 0,
      };

      return summary;
    }, {} as Record<string, LotResult>);

    offers.forEach((offer) => {
      const lotKey =
        offer.motorcycles?.id?.toString() ||
        offer.motorcycle_id?.toString() ||
        `unknown-${offer.id}`;

      if (!groupedLots[lotKey]) {
        groupedLots[lotKey] = {
          lotKey,
          motorcycle: offer.motorcycles
            ? ({
                ...offer.motorcycles,
                round_lot_number: offer.motorcycles.lot_number,
                sort_order: null,
                brand: null,
                model: null,
                frame_number: null,
                engine_number: null,
                color: null,
                source_name: null,
                stock_motorcycle_id: null,
                notes: null,
              } as ArrangementMotorcycle)
            : null,
          offers: [],
          topOffers: [],
          highestPrice: 0,
        };
      }

      groupedLots[lotKey].offers.push(offer);
    });

    return Object.values(groupedLots)
      .map((lot) => {
        const sortedOffers = [...lot.offers].sort(
          (a, b) => Number(b.offer_price) - Number(a.offer_price)
        );
        const highestPrice = Number(sortedOffers[0]?.offer_price || 0);
        const topOffers = sortedOffers.filter(
          (offer) => Number(offer.offer_price) === highestPrice
        );

        return {
          ...lot,
          offers: sortedOffers,
          topOffers,
          highestPrice,
        };
      })
      .sort((a, b) => {
        const sortA = a.motorcycle?.sort_order;
        const sortB = b.motorcycle?.sort_order;

        if (
          sortA !== null &&
          sortA !== undefined &&
          sortB !== null &&
          sortB !== undefined
        ) {
          return Number(sortA) - Number(sortB);
        }

        if (sortA !== null && sortA !== undefined) return -1;
        if (sortB !== null && sortB !== undefined) return 1;

        const lotA = getArrangementLotNumber(a.motorcycle);
        const lotB = getArrangementLotNumber(b.motorcycle);

        return lotA.localeCompare(lotB, "th", { numeric: true });
      });
  }, [arrangementMotorcycles, offers]);

  const filteredLotResults = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return lotResults;

    return lotResults.filter((lot) => {
      const winnerText = lot.topOffers.map(getMerchantName).join(" ");
      const text = [
        getArrangementLotNumber(lot.motorcycle),
        lot.motorcycle?.motorcycle_name,
        winnerText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [lotResults, searchText]);

  const isRoundFinished = round?.status === "finished" || round?.status === "archived";
  const canFinishRound =
    !!round &&
    round.status !== "open" &&
    lotResults.length > 0 &&
    lotResults.every((lot) => {
      const saleStatus = lot.motorcycle?.lot_sale_status;
      return saleStatus === "sold" || saleStatus === "unsold";
    });

  async function finishRound() {
    if (!round) return;

    if (round.status === "open") {
      setErrorMessage("กรุณาปิดรับราคาก่อนจบรอบเสนอราคา");
      return;
    }

    const hasPendingLots = lotResults.some((lot) => {
      const saleStatus = lot.motorcycle?.lot_sale_status;
      return saleStatus !== "sold" && saleStatus !== "unsold";
    });

    if (hasPendingLots) {
      setErrorMessage(
        "ยังมีรถที่ยังไม่ได้ตัดสินผล กรุณาขายหรือไม่ขายให้ครบก่อนจบรอบ"
      );
      return;
    }

    const confirmed = confirm(
      "ยืนยันจบรอบเสนอราคานี้? หลังจากจบรอบแล้วข้อมูลจะถูกล็อกและเก็บไว้ในประวัติ"
    );

    if (!confirmed) return;

    setIsFinishingRound(true);
    setErrorMessage("");

    try {
      const finishedAt = new Date().toISOString();
      const { error } = await supabase
        .from("auction_rounds")
        .update({
          status: "finished",
          is_current: false,
          closed_at: round.closed_at || finishedAt,
        })
        .eq("id", round.id);

      if (error) throw new Error(error.message);

      await createAuditLog({
        action: "auction_round_finished",
        targetType: "auction_round",
        targetId: String(round.id),
        targetName: round.round_name || `รอบ #${round.id}`,
        details: {
          round_id: round.id,
          round_name: round.round_name,
          status_before: round.status,
          status_after: "finished",
          finished_at: finishedAt,
          lot_count: lotResults.length,
        },
      });

      alert("จบรอบเสนอราคาเรียบร้อยแล้ว");
      await loadRoundDetail();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "จบรอบเสนอราคาไม่สำเร็จ"
      );
    }

    setIsFinishingRound(false);
  }

  async function markLotSold(
    lot: LotResult,
    offer: AdminOffer,
    mode: "winner" | "runner-up"
  ) {
    const motorcycle = lot.motorcycle;

    if (!motorcycle) return;

    if (isRoundFinished) {
      alert("รอบนี้จบแล้ว ไม่สามารถแก้ไขผลได้");
      return;
    }

    if (motorcycle.lot_sale_status === "sold") {
      alert("Lot นี้ถูกบันทึกว่าขายแล้ว");
      return;
    }

    if (motorcycle.lot_sale_status === "unsold") {
      alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว ไม่สามารถบันทึกขายซ้ำได้");
      return;
    }

    const confirmSold = confirm(
      mode === "winner"
        ? "ยืนยันขายรถล็อตนี้ให้ผู้เสนอราคาสูงสุด?"
        : "ยืนยันขายรถล็อตนี้ให้ผู้เสนอราคาอันดับ 2?"
    );

    if (!confirmSold) return;

    setActionMotorcycleId(motorcycle.id);
    setErrorMessage("");

    try {
      const displayLotNumber = getArrangementLotNumber(motorcycle);
      const { data: existingSoldRecords, error: existingSoldError } =
        await supabase
          .from("sold_motorcycles")
          .select("id")
          .eq("original_motorcycle_id", motorcycle.id)
          .limit(1);

      if (existingSoldError) {
        throw new Error(existingSoldError.message);
      }

      if (existingSoldRecords && existingSoldRecords.length > 0) {
        alert("Lot นี้ถูกบันทึกว่าขายแล้ว");
        await loadRoundDetail();
        setActionMotorcycleId(null);
        return;
      }

      const staffProfile = getSavedStaffProfile();
      const soldPrice = Number(offer.offer_price || 0);
      const cost = Number(motorcycle.cost_price || 0);
      const diff = soldPrice - cost;

      const { error: soldInsertError } = await supabase
        .from("sold_motorcycles")
        .insert({
          auction_round_id: motorcycle.auction_round_id || roundId || null,
          original_motorcycle_id: motorcycle.id,
          original_stock_motorcycle_id: motorcycle.stock_motorcycle_id || null,
          lot_number: displayLotNumber,
          motorcycle_name: motorcycle.motorcycle_name,
          cost_price: cost,
          sold_price: soldPrice,
          diff,
          winner_merchant_id: offer.merchant_id,
          winner_shop_name: offer.merchants?.shop_name || "",
          winner_contact_name: offer.merchants?.name || "",
          winner_phone: offer.merchants?.phone || "",
          sold_by_email: staffProfile?.email || null,
          note:
            mode === "winner"
              ? "ขายให้ที่ 1 จากหน้ารายละเอียดรอบเสนอราคา"
              : "ขายให้ที่ 2 จากหน้ารายละเอียดรอบเสนอราคา",
        });

      if (soldInsertError) {
        throw new Error(`บันทึกรถที่ขายแล้วไม่สำเร็จ: ${soldInsertError.message}`);
      }

      const soldAt = new Date().toISOString();
      const { error: motorcycleUpdateError } = await supabase
        .from("motorcycles")
        .update({
          active: false,
          lot_sale_status: "sold",
          sold_price: soldPrice,
          sold_to_merchant_id: offer.merchant_id,
          sold_at: soldAt,
          sold_by_email: staffProfile?.email || null,
        })
        .eq("id", motorcycle.id);

      if (motorcycleUpdateError) {
        throw new Error(`อัปเดต Lot ไม่สำเร็จ: ${motorcycleUpdateError.message}`);
      }

      if (motorcycle.stock_motorcycle_id) {
        const { error: stockUpdateError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "sold",
            current_auction_motorcycle_id: null,
            current_auction_round_id: null,
            updated_at: soldAt,
          })
          .eq("id", motorcycle.stock_motorcycle_id);

        if (stockUpdateError) {
          throw new Error(
            `อัปเดตรถในคลังไม่สำเร็จ: ${stockUpdateError.message}`
          );
        }
      }

      await createAuditLog({
        action: "lot_marked_sold",
        targetType: "motorcycle",
        targetId: String(motorcycle.id),
        targetName: `Lot ${displayLotNumber} • ${motorcycle.motorcycle_name}`,
        details: {
          motorcycle_id: motorcycle.id,
          stock_motorcycle_id: motorcycle.stock_motorcycle_id,
          auction_round_id: motorcycle.auction_round_id || roundId || null,
          lot_number: displayLotNumber,
          motorcycle_name: motorcycle.motorcycle_name,
          sold_price: soldPrice,
          cost_price: cost,
          diff,
          winner_merchant_id: offer.merchant_id,
          winner_shop_name: offer.merchants?.shop_name || "",
          winner_contact_name: offer.merchants?.name || "",
          winner_phone: offer.merchants?.phone || "",
          sold_from: mode,
        },
      });

      setWinnerChooser(null);
      alert(`บันทึกขาย Lot ${displayLotNumber} เรียบร้อยแล้ว`);
      await loadRoundDetail();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "บันทึกขายไม่สำเร็จ";

      setErrorMessage(message);
    }

    setActionMotorcycleId(null);
  }

  async function markLotUnsold(lot: LotResult) {
    const motorcycle = lot.motorcycle;

    if (!motorcycle) return;

    if (isRoundFinished) {
      alert("รอบนี้จบแล้ว ไม่สามารถแก้ไขผลได้");
      return;
    }

    if (motorcycle.lot_sale_status === "sold") {
      alert("Lot นี้ขายแล้ว ไม่สามารถส่งกลับเข้าสต็อกได้จากหน้านี้");
      return;
    }

    if (motorcycle.lot_sale_status === "unsold") {
      alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว");
      return;
    }

    const confirmUnsold = confirm("ยืนยันไม่ขายและส่งรถกลับเข้าสต็อก?");

    if (!confirmUnsold) return;

    setActionMotorcycleId(motorcycle.id);
    setErrorMessage("");

    try {
      const displayLotNumber = getArrangementLotNumber(motorcycle);
      const { data: existingUnsoldRecords, error: existingUnsoldError } =
        await supabase
          .from("unsold_motorcycles")
          .select("id")
          .eq("original_motorcycle_id", motorcycle.id)
          .limit(1);

      if (existingUnsoldError) {
        throw new Error(existingUnsoldError.message);
      }

      if (existingUnsoldRecords && existingUnsoldRecords.length > 0) {
        alert("Lot นี้ถูกส่งกลับเข้าสต็อกแล้ว");
        await loadRoundDetail();
        setActionMotorcycleId(null);
        return;
      }

      const staffProfile = getSavedStaffProfile();
      const cost = Number(motorcycle.cost_price || 0);
      const highestOffer = lot.offers[0] || null;
      const highestOfferPrice = highestOffer
        ? Number(highestOffer.offer_price || 0)
        : null;
      const diff =
        highestOfferPrice !== null ? highestOfferPrice - cost : null;

      const { error: unsoldInsertError } = await supabase
        .from("unsold_motorcycles")
        .insert({
          auction_round_id: motorcycle.auction_round_id || roundId || null,
          original_motorcycle_id: motorcycle.id,
          original_stock_motorcycle_id: motorcycle.stock_motorcycle_id || null,
          lot_number: displayLotNumber,
          motorcycle_name: motorcycle.motorcycle_name,
          cost_price: cost,
          highest_offer: highestOfferPrice,
          diff,
          highest_merchant_id: highestOffer?.merchant_id || null,
          highest_shop_name: highestOffer?.merchants?.shop_name || "",
          highest_contact_name: highestOffer?.merchants?.name || "",
          highest_phone: highestOffer?.merchants?.phone || "",
          returned_by_email: staffProfile?.email || null,
          note: "ไม่ขาย / กลับเข้าสต็อกจากหน้ารายละเอียดรอบเสนอราคา",
        });

      if (unsoldInsertError) {
        throw new Error(
          `บันทึกรถที่กลับเข้าสต็อกไม่สำเร็จ: ${unsoldInsertError.message}`
        );
      }

      const returnedAt = new Date().toISOString();
      const { error: motorcycleUpdateError } = await supabase
        .from("motorcycles")
        .update({
          active: false,
          lot_sale_status: "unsold",
          sold_price: null,
          sold_to_merchant_id: null,
          sold_at: null,
          sold_by_email: null,
        })
        .eq("id", motorcycle.id);

      if (motorcycleUpdateError) {
        throw new Error(`อัปเดต Lot ไม่สำเร็จ: ${motorcycleUpdateError.message}`);
      }

      if (motorcycle.stock_motorcycle_id) {
        const { error: stockUpdateError } = await supabase
          .from("stock_motorcycles")
          .update({
            stock_status: "ready_to_sell",
            current_auction_motorcycle_id: null,
            current_auction_round_id: null,
            updated_at: returnedAt,
          })
          .eq("id", motorcycle.stock_motorcycle_id);

        if (stockUpdateError) {
          throw new Error(
            `อัปเดตรถในคลังไม่สำเร็จ: ${stockUpdateError.message}`
          );
        }
      }

      await createAuditLog({
        action: "lot_marked_unsold",
        targetType: "motorcycle",
        targetId: String(motorcycle.id),
        targetName: `Lot ${displayLotNumber} • ${motorcycle.motorcycle_name}`,
        details: {
          motorcycle_id: motorcycle.id,
          stock_motorcycle_id: motorcycle.stock_motorcycle_id,
          auction_round_id: motorcycle.auction_round_id || roundId || null,
          lot_number: displayLotNumber,
          motorcycle_name: motorcycle.motorcycle_name,
          status_after: "unsold",
          stock_status_after: "ready_to_sell",
        },
      });

      alert(
        `ปิด Lot ${displayLotNumber} และส่งกลับเข้าสต็อกเรียบร้อยแล้ว`
      );
      await loadRoundDetail();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ส่งกลับเข้าสต็อกไม่สำเร็จ";

      setErrorMessage(message);
    }

    setActionMotorcycleId(null);
  }

  function exportRoundExcel() {
    if (!round) return;

    const rows = filteredLotResults.map((lot) => {
      const cost = Number(lot.motorcycle?.cost_price || 0);
      const profit = lot.highestPrice ? lot.highestPrice - cost : 0;

      return [
        getArrangementLotNumber(lot.motorcycle),
        lot.motorcycle?.motorcycle_name || "-",
        lot.highestPrice || "",
        cost || "",
        lot.highestPrice ? profit : "",
        lot.offers.length,
        lot.topOffers.map(getMerchantName).join(" / ") || "-",
        lot.topOffers.map(getMerchantPhone).join(" / ") || "-",
        round.round_name || `รอบ #${round.id}`,
      ];
    });

    const headers = [
      "ล็อต",
      "รุ่นรถ",
      "ราคาสูงสุด",
      "ต้นทุน",
      "กำไรขั้นต้น",
      "จำนวนราคา",
      "ผู้เสนอราคาสูงสุด",
      "เบอร์โทร",
      "รอบเสนอราคา",
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    sheet["!cols"] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 28 },
      { wch: 20 },
      { wch: 28 },
    ];

    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(rows.length, 1), c: headers.length - 1 },
      }),
    };

    XLSX.utils.book_append_sheet(workbook, sheet, "ราคาสูงสุดแต่ละล็อต");

    const roundFileName = (round.round_name || `round-${round.id}`)
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-");

    XLSX.writeFile(
      workbook,
      `ราคาสูงสุดแต่ละล็อต_${roundFileName}_${formatFileDate(new Date())}.xlsx`
    );
  }

  function exportArrangementExcel() {
    if (!round) return;

    const sortedMotorcycles = sortArrangementMotorcycles(arrangementMotorcycles);
    const headers = [
      "ลำดับ",
      "ล็อต",
      "ยี่ห้อ",
      "รุ่น",
      "เลขตัวถัง",
      "เลขเครื่อง",
      "สี",
      "แหล่งที่มา",
      "ต้นทุน",
      "หมายเหตุ",
      "รอบเสนอราคา",
      "วันที่ประมูล",
    ];

    const rows = sortedMotorcycles.map((motorcycle, index) => [
      index + 1,
      getArrangementLotNumber(motorcycle),
      motorcycle.brand || "",
      motorcycle.model || motorcycle.motorcycle_name || "",
      motorcycle.frame_number || "",
      motorcycle.engine_number || "",
      motorcycle.color || "",
      motorcycle.source_name || "",
      Number(motorcycle.cost_price || 0) || "",
      motorcycle.notes || "",
      round.round_name || `รอบ #${round.id}`,
      formatThaiDate(round.auction_date),
    ]);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    sheet["!cols"] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 22 },
      { wch: 20 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
    ];

    (sheet as XLSX.WorkSheet & { "!freeze"?: { ySplit: number } })[
      "!freeze"
    ] = { ySplit: 1 };

    XLSX.utils.book_append_sheet(workbook, sheet, "จัดเรียงล็อต");

    XLSX.writeFile(
      workbook,
      `จัดเรียงล็อต_${formatRoundFilePart(round)}.xlsx`
    );
  }

  return (
    <StaffGuard allowedRoles={["owner", "admin"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                รอบเสนอราคา
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                รายละเอียดรอบเสนอราคา
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                {round
                  ? `${round.round_name || `รอบ #${round.id}`} • ${formatThaiDate(
                      round.auction_date
                    )} • ID #${round.id}`
                  : "กำลังโหลดข้อมูลรอบเสนอราคา"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportArrangementExcel}
                disabled={!round || arrangementMotorcycles.length === 0}
                className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                ดาวน์โหลด Excel จัดเรียงล็อต
              </button>

              <button
                type="button"
                onClick={loadRoundDetail}
                className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
              >
                โหลดใหม่
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">เกิดข้อผิดพลาด</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {round && (
            <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อรอบ</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {round.round_name || `รอบ #${round.id}`}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">วันที่เสนอราคา</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {formatThaiDate(round.auction_date)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">สถานะ</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                      round.status
                    )}`}
                  >
                    {getRoundStatusLabel(round.status)}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">รหัสรอบ</p>
                  <p className="mt-1 font-bold text-gray-900">#{round.id}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={finishRound}
                  disabled={
                    isFinishingRound ||
                    round.status === "open" ||
                    isRoundFinished ||
                    !canFinishRound
                  }
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isFinishingRound ? "กำลังจบรอบ..." : "จบรอบเสนอราคา"}
                </button>

                {round.status === "open" && (
                  <p className="text-sm font-medium text-red-600">
                    กรุณาปิดรับราคาก่อนจบรอบเสนอราคา
                  </p>
                )}

                {round.status !== "open" && !isRoundFinished && !canFinishRound && (
                  <p className="text-sm font-medium text-orange-700">
                    ยังมีรถที่ยังไม่ได้ตัดสินผล กรุณาขายหรือไม่ขายให้ครบก่อนจบรอบ
                  </p>
                )}

                {isRoundFinished && (
                  <p className="text-sm font-medium text-purple-700">
                    รอบนี้จบแล้ว ข้อมูลถูกล็อกและยังดาวน์โหลด Excel ได้
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  ราคาสูงสุดแต่ละล็อต
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  แสดงผลเฉพาะรอบเสนอราคาที่เลือก
                </p>
              </div>

              <button
                type="button"
                onClick={exportRoundExcel}
                disabled={!round || lotResults.length === 0}
                className="rounded-xl bg-black px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                ดาวน์โหลด Excel ผลราคา
              </button>
            </div>

            <div className="mt-4">
              <input
                className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black md:w-96"
                placeholder="ค้นหาล็อต / รุ่นรถ / ร้านค้า"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-gray-600">
                กำลังโหลดข้อมูล...
              </div>
            )}

            {!isLoading && lotResults.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="font-semibold text-gray-900">
                  ยังไม่มีราคาสำหรับรอบนี้
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  เมื่อร้านค้าส่งราคาแล้ว รายการจะปรากฏในตารางนี้
                </p>
              </div>
            )}

            {!isLoading && lotResults.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-3">ล็อต</th>
                      <th className="border p-3">ยี่ห้อ</th>
                      <th className="border p-3">รุ่น</th>
                      <th className="border p-3">เลขตัวถัง</th>
                      <th className="border p-3">สถานะ</th>
                      <th className="border p-3 text-right">ราคาสูงสุด</th>
                      <th className="border p-3 text-right">ต้นทุน</th>
                      <th className="border p-3 text-right">กำไรขั้นต้น</th>
                      <th className="border p-3 text-right">จำนวนราคา</th>
                      <th className="border p-3">ผู้เสนอราคาสูงสุด</th>
                      <th className="border p-3">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLotResults.map((lot) => {
                      const cost = Number(lot.motorcycle?.cost_price || 0);
                      const profit = lot.highestPrice - cost;
                      const offerGroups = getOfferGroupsByPrice(lot.offers);
                      const winnerGroup = offerGroups[0] || [];
                      const runnerUpGroup = offerGroups[1] || [];
                      const saleStatus =
                        lot.motorcycle?.lot_sale_status || "in_auction";
                      const isFinalized =
                        saleStatus === "sold" || saleStatus === "unsold";
                      const isRowUpdating =
                        actionMotorcycleId === lot.motorcycle?.id;
                      const hasWinnerTie = winnerGroup.length > 1;

                      return (
                        <tr key={lot.lotKey} className="hover:bg-gray-50">
                          <td className="border p-3 font-bold text-gray-900">
                            {getArrangementLotNumber(lot.motorcycle)}
                          </td>

                          <td className="border p-3">
                            {lot.motorcycle?.brand || "-"}
                          </td>

                          <td className="border p-3">
                            {lot.motorcycle?.model ||
                              lot.motorcycle?.motorcycle_name ||
                              "-"}
                          </td>

                          <td className="border p-3">
                            {lot.motorcycle?.frame_number || "-"}
                          </td>

                          <td className="border p-3">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${getSaleStatusBadgeClass(
                                  saleStatus
                                )}`}
                              >
                                {getSaleStatusLabel(saleStatus)}
                              </span>

                              {hasWinnerTie && !isFinalized && (
                                <span className="inline-flex whitespace-nowrap rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                                  ราคาเท่ากัน
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="border p-3 text-right font-bold text-green-700">
                            {formatMoney(lot.highestPrice)}
                          </td>

                          <td className="border p-3 text-right">
                            {formatMoney(cost)}
                          </td>

                          <td
                            className={
                              profit >= 0
                                ? "border p-3 text-right font-bold text-green-700"
                                : "border p-3 text-right font-bold text-red-700"
                            }
                          >
                            {formatMoney(profit)}
                          </td>

                          <td className="border p-3 text-right font-bold">
                            {lot.offers.length.toLocaleString()}
                          </td>

                          <td className="border p-3">
                            {lot.topOffers.map(getMerchantName).join(" / ") ||
                              "-"}
                          </td>

                          <td className="border p-3">
                            <div className="flex min-w-[280px] flex-wrap gap-2">
                              {hasWinnerTie && !isFinalized ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWinnerChooser({
                                      lot,
                                      offers: winnerGroup,
                                      mode: "winner",
                                    })
                                  }
                                  disabled={isRoundFinished || isRowUpdating}
                                  className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  เลือกผู้ชนะ
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    winnerGroup[0] &&
                                    markLotSold(lot, winnerGroup[0], "winner")
                                  }
                                  disabled={
                                    isRoundFinished ||
                                    isFinalized ||
                                    isRowUpdating ||
                                    winnerGroup.length === 0
                                  }
                                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  ขายให้ที่ 1
                                </button>
                              )}

                              {runnerUpGroup.length > 1 && !isFinalized ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWinnerChooser({
                                      lot,
                                      offers: runnerUpGroup,
                                      mode: "runner-up",
                                    })
                                  }
                                  disabled={isRoundFinished || isRowUpdating}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  เลือกที่ 2
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runnerUpGroup[0] &&
                                    markLotSold(lot, runnerUpGroup[0], "runner-up")
                                  }
                                  disabled={
                                    isRoundFinished ||
                                    isFinalized ||
                                    isRowUpdating ||
                                    runnerUpGroup.length === 0
                                  }
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                  {runnerUpGroup.length === 0
                                    ? "ไม่มีที่ 2"
                                    : "ขายให้ที่ 2"}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => markLotUnsold(lot)}
                                disabled={isRoundFinished || isFinalized || isRowUpdating}
                                className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-800 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                              >
                                ไม่ขาย
                              </button>

                              {lot.motorcycle?.id ? (
                                <a
                                  href={`/admin/lots/${lot.motorcycle.id}`}
                                  className="inline-flex rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
                                >
                                  ดูรายละเอียด
                                </a>
                              ) : (
                                "-"
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>

        {winnerChooser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <section className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {winnerChooser.mode === "winner"
                      ? "เลือกผู้ชนะ"
                      : "เลือกผู้เสนอราคาอันดับ 2"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    Lot {getArrangementLotNumber(winnerChooser.lot.motorcycle)} •{" "}
                    {winnerChooser.lot.motorcycle?.motorcycle_name || "-"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWinnerChooser(null)}
                  className="rounded-xl border px-3 py-2 text-sm font-bold hover:bg-gray-100"
                >
                  ปิด
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {winnerChooser.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl border bg-gray-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {getMerchantName(offer)}
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          {offer.merchants?.name || "-"} •{" "}
                          {offer.merchants?.phone || "-"}
                        </p>

                        <p className="mt-2 text-lg font-bold text-green-700">
                          {formatMoney(Number(offer.offer_price || 0))} บาท
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          markLotSold(
                            winnerChooser.lot,
                            offer,
                            winnerChooser.mode
                          )
                        }
                        disabled={
                          actionMotorcycleId ===
                          winnerChooser.lot.motorcycle?.id
                        }
                        className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        เลือกร้านนี้
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </StaffGuard>
  );
}
