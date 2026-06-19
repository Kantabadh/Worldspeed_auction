"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  IDetectedBarcode,
  IScannerError,
  IScannerProps,
} from "@yudiel/react-qr-scanner";
import { handleInvalidRefreshToken } from "@/lib/authRecovery";
import { supabase } from "@/lib/supabase";
import {
  formatAuctionDisplayOrder,
  getAuctionDisplayLabel,
  sortBySavedAuctionDisplayOrder,
} from "@/lib/auctionDisplayOrder";
import {
  loadMerchantOfferDraft,
  saveMerchantOfferDraft,
} from "@/lib/merchantOfferDraft";

const QrScanner = dynamic<IScannerProps>(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-2xl bg-gray-900 text-sm font-semibold text-white">
        กำลังเปิดกล้อง...
      </div>
    ),
  }
);

type MotorcyclePhoto = {
  id: number;
  motorcycle_id: number;
  image_url: string;
};

function getMerchantCardImageUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const isSupabaseStorageImage = url.pathname.includes(
      "/storage/v1/object/public/"
    );
    const isSupabaseTransformedImage = url.pathname.includes(
      "/storage/v1/render/image/public/"
    );

    if (!isSupabaseStorageImage && !isSupabaseTransformedImage) {
      return imageUrl;
    }

    if (isSupabaseStorageImage) {
      url.pathname = url.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
    }

    url.searchParams.set("width", "700");
    url.searchParams.set("quality", "70");
    url.searchParams.set("resize", "contain");

    return url.toString();
  } catch {
    return imageUrl;
  }
}

type Motorcycle = {
  id: number;
  display_order: number | null;
  auction_round_id: number | null;
  stock_motorcycle_id: number | null;
  lot_number: string;
  motorcycle_name: string;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  license_plate: string | null;
  frame_number: string | null;
  engine_number: string | null;
  registration_status: string | null;
  tax_expiry: string | null;
  condition: string | null;
  notes: string | null;
  motorcycle_photos?: MotorcyclePhoto[];
};

type StockMotorcycleSnapshot = {
  id: number;
  current_auction_motorcycle_id: number | null;
  current_auction_round_id: number | null;
  display_order: number | null;
  motorcycle_name: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  license_plate: string | null;
  frame_number: string | null;
  engine_number?: string | null;
  registration_status: string | null;
  tax_expiry?: string | null;
  notes: string | null;
};

type Offer = {
  motorcycle_id: number;
  stock_motorcycle_id: number | null;
  display_order: number | null;
  lot: string;
  sortOrder: number | null;
  motorcycle: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  license_plate: string;
  frame_number: string;
  engine_number: string;
  registration_status: string;
  tax_expiry: string;
  condition: string;
  notes: string;
  photos: MotorcyclePhoto[];
  price: string;
};

type MerchantSession = {
  merchantAccountId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
  loginAt?: number;
  expiresAt?: number;
};

type ExistingSubmissionOffer = {
  id: number;
  offer_price: number;
  motorcycle_id: number | string;
};

type LotEditPermission = {
  motorcycle_id: number | string;
  can_edit: boolean;
};

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
};

type OfferFilter = "all" | "empty" | "priced" | "editable" | "starred";

type RoundLotMapping = {
  original_motorcycle_id: number | null;
  lot_number: string | null;
  round_lot_number?: string | null;
  sort_order?: number | null;
};

const MERCHANT_SESSION_KEY = "merchantSession";
const MERCHANT_TIMEOUT_MS = 2 * 24 * 60 * 60 * 1000;
const ITEMS_PER_PAGE = 5;
const INVALID_QR_MESSAGE = "QR ไม่ถูกต้อง";
const CAMERA_ERROR_MESSAGE =
  "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือใช้กล้องมือถือสแกน QR แทน";

function buildMerchantLoginUrl() {
  const next = `${window.location.pathname}${window.location.search}`;

  return `/merchant-login?next=${encodeURIComponent(next)}`;
}

function isValidMerchantSession(session: MerchantSession | null) {
  return Boolean(
    session?.merchantAccountId &&
      session.expiresAt &&
      Date.now() <= session.expiresAt
  );
}

function extractMotorcycleIdFromQr(value: string) {
  const text = value.trim();

  if (!text) return null;

  try {
    const url = new URL(text, window.location.origin);
    const motorcycleId = url.searchParams.get("motorcycleId")?.trim();

    return motorcycleId || null;
  } catch {
    return null;
  }
}

function getStockMotorcycleId(item: {
  stock_motorcycle_id?: number | null;
  stock_motorcycles?: { id?: number | null } | null;
  stock_motorcycle?: { id?: number | null } | null;
}) {
  const id = Number(
    item.stock_motorcycle_id ??
      item.stock_motorcycles?.id ??
      item.stock_motorcycle?.id
  );

  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function MerchantPage() {
  const listSectionRef = useRef<HTMLElement | null>(null);
  const hasHandledQrJumpRef = useRef(false);
  const qrSortedOffersRef = useRef<Offer[]>([]);
  const qrPaginatedOffersRef = useRef<Offer[]>([]);

  const [merchantName, setMerchantName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [merchantAccountId, setMerchantAccountId] = useState<number | null>(
    null
  );

  const [offers, setOffers] = useState<Offer[]>([]);
  const [starredLotIds, setStarredLotIds] = useState<number[]>([]);
  const [openDetailIds, setOpenDetailIds] = useState<number[]>([]);
  const [editableLotIds, setEditableLotIds] = useState<number[]>([]);

  const [searchText, setSearchText] = useState("");
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [errorMessage, setErrorMessage] = useState("");
  const [auctionStatus, setAuctionStatus] = useState("closed");
  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(null);
  const [isLoadingCurrentRound, setIsLoadingCurrentRound] = useState(true);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [targetMotorcycleId, setTargetMotorcycleId] = useState<string | null>(
    null
  );
  const [highlightedMotorcycleId, setHighlightedMotorcycleId] =
    useState<number | null>(null);
  const [qrJumpPlanVersion, setQrJumpPlanVersion] = useState(0);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScannerErrorMessage, setQrScannerErrorMessage] = useState("");
  const [hasHandledQrScan, setHasHandledQrScan] = useState(false);

  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedMerchantId, setSubmittedMerchantId] = useState<number | null>(
    null
  );

  const [galleryPhotos, setGalleryPhotos] = useState<MotorcyclePhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [loadedThumbnailIds, setLoadedThumbnailIds] = useState<
    Record<number, boolean>
  >({});
  const [failedThumbnailIds, setFailedThumbnailIds] = useState<
    Record<number, boolean>
  >({});
  const [cardPhotosByMotorcycleId, setCardPhotosByMotorcycleId] = useState<
    Record<number, MotorcyclePhoto[]>
  >({});
  const [cardPhotoCountsByMotorcycleId, setCardPhotoCountsByMotorcycleId] =
    useState<Record<number, number>>({});
  const [loadingCardPhotoIds, setLoadingCardPhotoIds] = useState<
    Record<number, boolean>
  >({});

  function saveMerchantSession(session: MerchantSession) {
    localStorage.setItem(
      MERCHANT_SESSION_KEY,
      JSON.stringify({
        ...session,
        loginAt: session.loginAt || Date.now(),
        expiresAt: Date.now() + MERCHANT_TIMEOUT_MS,
      })
    );
  }

  function logoutMerchant() {
    localStorage.removeItem(MERCHANT_SESSION_KEY);
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");
    localStorage.removeItem("draftSubmission");
    window.location.href = "/merchant-login";
  }

  function redirectToMerchantLogin() {
    window.location.href = buildMerchantLoginUrl();
  }

  async function handleMerchantAuthError(error: unknown) {
    return handleInvalidRefreshToken(
      error,
      supabase,
      "merchant",
      buildMerchantLoginUrl()
    );
  }

  function refreshMerchantActivity() {
    const savedSession = localStorage.getItem(MERCHANT_SESSION_KEY);

    if (!savedSession) return;

    try {
      const session = JSON.parse(savedSession) as MerchantSession;
      if (isValidMerchantSession(session)) {
        saveMerchantSession(session);
      }
    } catch {
      localStorage.removeItem(MERCHANT_SESSION_KEY);
    }
  }

  function getActiveMerchantAccountId() {
    if (merchantAccountId) return merchantAccountId;

    try {
      const savedSession = localStorage.getItem(MERCHANT_SESSION_KEY);
      const session = savedSession
        ? (JSON.parse(savedSession) as MerchantSession)
        : null;

      return session?.merchantAccountId ? Number(session.merchantAccountId) : null;
    } catch {
      return null;
    }
  }

  function getRoundStatusLabel(status?: string | null) {
    if (status === "draft") return "ยังไม่เปิดรับราคา";
    if (status === "open") return "เปิดรับราคา";
    if (status === "closed") return "ปิดรับราคาแล้ว";
    if (status === "finished") return "จบรอบแล้ว";
    if (status === "archived") return "บันทึกประวัติแล้ว";
    return status || "-";
  }

  function formatThaiDate(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getRoundDisplayName(round: CurrentAuctionRound) {
    return round.round_name || `รอบ #${round.id}`;
  }

  function getRoundDateText(round: CurrentAuctionRound) {
    return round.auction_date
      ? `วันที่ ${formatThaiDate(round.auction_date)}`
      : "ยังไม่ได้ระบุวันที่";
  }

  function getRoundClosedMessage(status?: string | null) {
    if (status === "draft") return "รอบนี้ยังไม่เปิดรับราคา";
    if (status === "closed") return "รอบนี้ปิดรับราคาแล้ว";
    if (status === "finished") return "รอบนี้จบรอบแล้ว";
    if (status === "archived") return "รอบนี้บันทึกประวัติแล้ว";
    return "รอบนี้ยังไม่เปิดให้เสนอราคา";
  }

  function getRoundClosedDetail(status?: string | null) {
    if (status === "draft") return "กรุณารอเจ้าหน้าที่เปิดรับราคา";
    if (status === "closed") return "กรุณารอรอบถัดไป";
    if (status === "finished") return "กรุณารอรอบถัดไป";
    if (status === "archived") return "กรุณารอรอบถัดไป";
    return "กรุณารอเจ้าหน้าที่เปิดรับราคา";
  }

  function getEmptyLotMessage() {
    if (isLoadingCurrentRound) {
      return {
        title: "กำลังโหลดข้อมูลรอบเสนอราคา...",
        detail: "กรุณารอสักครู่",
      };
    }

    if (!currentRound) {
      return {
        title: "ยังไม่มีรอบเสนอราคาปัจจุบัน",
        detail: "กรุณารอเจ้าหน้าที่เปิดรอบใหม่",
      };
    }

    if (auctionStatus !== "open") {
      return {
        title: getRoundClosedMessage(currentRound.status),
        detail: getRoundClosedDetail(currentRound.status),
      };
    }

    return {
      title: "ยังไม่มีลำดับในรอบนี้",
      detail: `${getRoundDisplayName(currentRound)} • ${getRoundDateText(currentRound)}`,
    };
  }

  function toggleStarLot(motorcycleId: number) {
    const id = Number(motorcycleId);

    const updatedStarredLotIds = starredLotIds.includes(id)
      ? starredLotIds.filter((savedId) => Number(savedId) !== id)
      : [...starredLotIds, id];

    setStarredLotIds(updatedStarredLotIds);

    localStorage.setItem(
      "merchantStarredLotIds",
      JSON.stringify(updatedStarredLotIds)
    );
  }

  function toggleDetail(motorcycleId: number) {
    const id = Number(motorcycleId);

    setOpenDetailIds((currentIds) =>
      currentIds.map(Number).includes(id)
        ? currentIds.filter((savedId) => Number(savedId) !== id)
        : [...currentIds, id]
    );
  }

  async function checkExistingSubmission(accountId: number) {
    const { data: merchantRows, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("merchant_account_id", Number(accountId))
      .limit(1);

    if (merchantError) {
      if (await handleMerchantAuthError(merchantError)) return;

      setErrorMessage(merchantError.message);
      return;
    }

    if (!merchantRows || merchantRows.length === 0) {
      setHasSubmitted(false);
      setSubmittedMerchantId(null);
      setEditableLotIds([]);
      return;
    }

    const merchantRowId = Number(merchantRows[0].id);

    setHasSubmitted(true);
    setSubmittedMerchantId(merchantRowId);

    const { data: existingOffers, error: offersError } = await supabase
      .from("offers")
      .select("id, offer_price, motorcycle_id")
      .eq("merchant_id", merchantRowId);

    if (offersError) {
      if (await handleMerchantAuthError(offersError)) return;

      setErrorMessage(offersError.message);
      return;
    }

    const { data: permissionData, error: permissionError } = await supabase
      .from("merchant_lot_edit_permissions")
      .select("motorcycle_id, can_edit")
      .eq("merchant_account_id", Number(accountId))
      .eq("can_edit", true);

    if (permissionError) {
      if (await handleMerchantAuthError(permissionError)) return;

      setErrorMessage(permissionError.message);
      return;
    }

    const allowedLotIds =
      (permissionData as LotEditPermission[] | null)?.map((permission) =>
        Number(permission.motorcycle_id)
      ) || [];

    setEditableLotIds(allowedLotIds);

    const submittedPrices: Record<number, string> = {};

    (existingOffers as ExistingSubmissionOffer[] | null)?.forEach((offer) => {
      submittedPrices[Number(offer.motorcycle_id)] = String(offer.offer_price);
    });

    localStorage.setItem("merchantOfferPrices", JSON.stringify(submittedPrices));
    const draft = loadMerchantOfferDraft(
      Number(accountId),
      currentRound?.id
    );
    const pricesToApply = draft?.prices || submittedPrices;

    if (draft?.updatedAt) {
      setDraftSavedAt(draft.updatedAt);
    }

    setOffers((currentOffers) =>
      currentOffers.map((offer) => ({
        ...offer,
        price:
          pricesToApply[Number(offer.motorcycle_id)] || offer.price || "",
      }))
    );
  }

  useEffect(() => {
    setTargetMotorcycleId(
      new URLSearchParams(window.location.search).get("motorcycleId")
    );

    const savedSession = localStorage.getItem(MERCHANT_SESSION_KEY);

    if (!savedSession) {
      redirectToMerchantLogin();
      return;
    }

    let session: MerchantSession | null = null;

    try {
      session = JSON.parse(savedSession) as MerchantSession;
    } catch {
      localStorage.removeItem(MERCHANT_SESSION_KEY);
      redirectToMerchantLogin();
      return;
    }

    if (!isValidMerchantSession(session)) {
      localStorage.removeItem(MERCHANT_SESSION_KEY);
      redirectToMerchantLogin();
      return;
    }

    const savedStarredLots = localStorage.getItem("merchantStarredLotIds");

    if (savedStarredLots) {
      setStarredLotIds(
        JSON.parse(savedStarredLots).map((id: number | string) => Number(id))
      );
    }

    setMerchantName(session.merchantName || "");
    setShopName(session.shopName || "");
    setPhone(session.phone || "");
    setMerchantAccountId(Number(session.merchantAccountId));
    setIsMerchantLoggedIn(true);

    saveMerchantSession(session);
    checkExistingSubmission(Number(session.merchantAccountId));
  }, []);

  useEffect(() => {
    if (!isMerchantLoggedIn) return;

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, refreshMerchantActivity);
    });

    const interval = setInterval(() => {
      const savedSession = localStorage.getItem(MERCHANT_SESSION_KEY);

      if (!savedSession) {
        redirectToMerchantLogin();
        return;
      }

      let session: MerchantSession | null = null;

      try {
        session = JSON.parse(savedSession) as MerchantSession;
      } catch {
        localStorage.removeItem(MERCHANT_SESSION_KEY);
        redirectToMerchantLogin();
        return;
      }

      if (!isValidMerchantSession(session)) {
        localStorage.removeItem(MERCHANT_SESSION_KEY);
        redirectToMerchantLogin();
      }
    }, 5000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refreshMerchantActivity);
      });

      clearInterval(interval);
    };
  }, [isMerchantLoggedIn]);

  function jumpToMotorcycle(motorcycleId: string) {
    hasHandledQrJumpRef.current = false;
    setTargetMotorcycleId(motorcycleId);

    const url = new URL(window.location.href);
    url.searchParams.set("motorcycleId", motorcycleId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function handleQrScan(detectedCodes: IDetectedBarcode[]) {
    if (hasHandledQrScan) return;

    const rawValue = detectedCodes[0]?.rawValue || "";
    const motorcycleId = extractMotorcycleIdFromQr(rawValue);

    if (!motorcycleId) {
      setQrScannerErrorMessage(INVALID_QR_MESSAGE);
      return;
    }

    setHasHandledQrScan(true);
    setQrScannerErrorMessage("");
    setIsQrScannerOpen(false);
    jumpToMotorcycle(motorcycleId);
  }

  function handleQrScannerError(error: IScannerError) {
    if (
      error.kind === "permission-denied" ||
      error.kind === "no-camera" ||
      error.kind === "in-use" ||
      error.kind === "insecure-context" ||
      error.kind === "unsupported" ||
      error.kind === "security"
    ) {
      setQrScannerErrorMessage(CAMERA_ERROR_MESSAGE);
      return;
    }

    setQrScannerErrorMessage(INVALID_QR_MESSAGE);
  }

  function openQrScanner() {
    setHasHandledQrScan(false);
    setQrScannerErrorMessage("");
    setIsQrScannerOpen(true);
  }

  function closeQrScanner() {
    setIsQrScannerOpen(false);
    setHasHandledQrScan(false);
  }

  useEffect(() => {
    async function loadCurrentRoundAndMotorcycles() {
      setIsLoadingCurrentRound(true);
      setErrorMessage("");

      const { data: roundData, error: roundError } = await supabase
        .from("auction_rounds")
        .select("id, round_name, auction_date, status, is_current")
        .eq("is_current", true)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roundError) {
        if (await handleMerchantAuthError(roundError)) {
          setIsLoadingCurrentRound(false);
          return;
        }

        setErrorMessage(roundError.message);
        setIsLoadingCurrentRound(false);
        return;
      }

      const loadedRound = (roundData as CurrentAuctionRound) || null;

      setCurrentRound(loadedRound);

      if (!loadedRound) {
        setAuctionStatus("closed");
        setOffers([]);
        setIsLoadingCurrentRound(false);
        return;
      }

      setAuctionStatus(loadedRound.status === "open" ? "open" : "closed");

      if (loadedRound.status !== "open") {
        setOffers([]);
        setIsLoadingCurrentRound(false);
        return;
      }

      const { data: stockData, error: stockError } = await supabase
        .from("stock_motorcycles")
        .select(
          `
          id,
          current_auction_motorcycle_id,
          current_auction_round_id,
          display_order,
          motorcycle_name,
          brand,
          model,
          year,
          color,
          license_plate,
          frame_number,
          engine_number,
          registration_status,
          tax_expiry,
          notes
        `
        )
        .eq("current_auction_round_id", loadedRound.id)
        .not("current_auction_motorcycle_id", "is", null);

      if (stockError) {
        if (await handleMerchantAuthError(stockError)) {
          setIsLoadingCurrentRound(false);
          return;
        }

        setErrorMessage(stockError.message);
        setIsLoadingCurrentRound(false);
        return;
      }

      const stockRows = (stockData as StockMotorcycleSnapshot[] | null) || [];
      const auctionMotorcycleIds = stockRows
        .map((stock) => stock.current_auction_motorcycle_id)
        .filter((id): id is number => typeof id === "number");
      let auctionRows: Motorcycle[] = [];

      if (auctionMotorcycleIds.length > 0) {
        const { data: auctionData, error: auctionError } = await supabase
          .from("motorcycles")
          .select(
            `
            id,
            display_order,
            auction_round_id,
            stock_motorcycle_id,
            lot_number,
            motorcycle_name,
            brand,
            model,
            year,
            color,
            license_plate,
            frame_number,
            engine_number,
            registration_status,
            tax_expiry,
            condition,
            notes
          `
          )
          .in("id", auctionMotorcycleIds);

        if (auctionError) {
          if (await handleMerchantAuthError(auctionError)) {
            setIsLoadingCurrentRound(false);
            return;
          }

          setErrorMessage(auctionError.message);
          setIsLoadingCurrentRound(false);
          return;
        }

        auctionRows = (auctionData as Motorcycle[] | null) || [];
      }

      let mappingRows: RoundLotMapping[] = [];
      const mappingResult = await supabase
        .from("auction_round_lots")
        .select("original_motorcycle_id, lot_number, round_lot_number, sort_order")
        .eq("auction_round_id", loadedRound.id);

      if (!mappingResult.error) {
        mappingRows = (mappingResult.data as unknown as RoundLotMapping[]) || [];
      } else {
        if (await handleMerchantAuthError(mappingResult.error)) {
          setIsLoadingCurrentRound(false);
          return;
        }

        const fallbackMappingResult = await supabase
          .from("auction_round_lots")
          .select("original_motorcycle_id, lot_number")
          .eq("auction_round_id", loadedRound.id);

        if (!fallbackMappingResult.error) {
          mappingRows =
            (fallbackMappingResult.data as unknown as RoundLotMapping[]) || [];
        } else {
          if (await handleMerchantAuthError(fallbackMappingResult.error)) {
            setIsLoadingCurrentRound(false);
            return;
          }
        }
      }

      const mappingByMotorcycleId = new Map<number, RoundLotMapping>();
      mappingRows.forEach((mapping) => {
        if (mapping.original_motorcycle_id) {
          mappingByMotorcycleId.set(mapping.original_motorcycle_id, mapping);
        }
      });

      const auctionById = new Map<number, Motorcycle>();
      auctionRows.forEach((bike) => {
        auctionById.set(Number(bike.id), bike);
      });

      const motorcycleOffers =
        stockRows.map((stockSnapshot) => {
          const auctionMotorcycleId = Number(
            stockSnapshot.current_auction_motorcycle_id
          );
          const bike = auctionById.get(auctionMotorcycleId);
          const mapping = mappingByMotorcycleId.get(auctionMotorcycleId);
          const brand = stockSnapshot?.brand || bike?.brand || "";
          const model = stockSnapshot?.model || bike?.model || "";
          const motorcycleName =
            stockSnapshot?.motorcycle_name ||
            bike?.motorcycle_name ||
            [brand, model].filter(Boolean).join(" ");

          return {
            motorcycle_id: auctionMotorcycleId,
            stock_motorcycle_id: stockSnapshot.id,
            display_order: bike?.display_order ?? stockSnapshot.display_order ?? null,
            lot:
              mapping?.round_lot_number ||
              mapping?.lot_number ||
              bike?.lot_number ||
              String(auctionMotorcycleId),
            sortOrder: null,
            motorcycle: motorcycleName,
            brand,
            model,
            year: stockSnapshot?.year || bike?.year || "",
            color: stockSnapshot?.color || bike?.color || "",
            license_plate:
              stockSnapshot?.license_plate || bike?.license_plate || "",
            frame_number: stockSnapshot?.frame_number || bike?.frame_number || "",
            engine_number: stockSnapshot?.engine_number || bike?.engine_number || "",
            registration_status:
              stockSnapshot?.registration_status ||
              bike?.registration_status ||
              "",
            tax_expiry: stockSnapshot?.tax_expiry || bike?.tax_expiry || "",
            condition: bike?.condition || "",
            notes: stockSnapshot?.notes || bike?.notes || "",
            photos: [],
            price: "",
          };
        }) || [];

      const sortedMotorcycleOffers =
        sortBySavedAuctionDisplayOrder(motorcycleOffers);

      const draft = loadMerchantOfferDraft(
        getActiveMerchantAccountId(),
        loadedRound.id
      );
      const savedPricesText = localStorage.getItem("merchantOfferPrices");
      const legacySavedPrices = savedPricesText ? JSON.parse(savedPricesText) : {};
      const savedPrices = draft?.prices || legacySavedPrices;

      if (draft?.updatedAt) {
        setDraftSavedAt(draft.updatedAt);
      }

      const motorcycleOffersWithSavedPrices = sortedMotorcycleOffers.map((offer) => ({
        ...offer,
        price: savedPrices[Number(offer.motorcycle_id)] || "",
      }));

      setOffers(motorcycleOffersWithSavedPrices);
      setCardPhotosByMotorcycleId({});
      setCardPhotoCountsByMotorcycleId({});
      setLoadedThumbnailIds({});
      setFailedThumbnailIds({});
      setIsLoadingCurrentRound(false);
    }

    loadCurrentRoundAndMotorcycles();
  }, []);

  useEffect(() => {
    if (merchantAccountId) {
      checkExistingSubmission(Number(merchantAccountId));
    }
  }, [offers.length, merchantAccountId]);

  useEffect(() => {
    if (!merchantAccountId) return;

    function refreshPermission() {
      checkExistingSubmission(Number(merchantAccountId));
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshPermission();
      }
    }

    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    const interval = setInterval(refreshPermission, 10000);

    return () => {
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      clearInterval(interval);
    };
  }, [merchantAccountId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, offerFilter]);

  function updatePrice(index: number, value: string) {
    if (index < 0) return;

    const cleanValue = value.replace(/[^\d]/g, "");

    const newOffers = [...offers];
    newOffers[index].price = cleanValue;
    setOffers(newOffers);

    const pricesToSave: Record<number, string> = {};

    newOffers.forEach((offer) => {
      pricesToSave[Number(offer.motorcycle_id)] = offer.price;
    });

    localStorage.setItem("merchantOfferPrices", JSON.stringify(pricesToSave));

    const savedDraft = saveMerchantOfferDraft(
      getActiveMerchantAccountId(),
      currentRound?.id,
      pricesToSave
    );

    if (savedDraft?.updatedAt) {
      setDraftSavedAt(savedDraft.updatedAt);
    }
  }

  async function openGallery(
    motorcycleId: number,
    photos: MotorcyclePhoto[],
    startIndex: number
  ) {
    setGalleryPhotos(photos);
    setGalleryIndex(startIndex);

    const { data, error } = await supabase
      .from("motorcycle_photos")
      .select("id, motorcycle_id, image_url")
      .eq("motorcycle_id", motorcycleId)
      .order("id", { ascending: true });

    if (error) {
      if (await handleMerchantAuthError(error)) return;

      console.error("โหลดรูปภาพรถไม่สำเร็จ", error);
      return;
    }

    const allPhotos = (data as MotorcyclePhoto[] | null) || [];

    if (allPhotos.length > 0) {
      setGalleryPhotos(allPhotos);
      setGalleryIndex(Math.min(startIndex, allPhotos.length - 1));
    }
  }

  function closeGallery() {
    setGalleryPhotos([]);
    setGalleryIndex(0);
  }

  function showPreviousPhoto() {
    setGalleryIndex((currentIndex) =>
      currentIndex === 0 ? galleryPhotos.length - 1 : currentIndex - 1
    );
  }

  function showNextPhoto() {
    setGalleryIndex((currentIndex) =>
      currentIndex === galleryPhotos.length - 1 ? 0 : currentIndex + 1
    );
  }

  function canEditThisLot(motorcycleId: number) {
    if (!hasSubmitted) return true;

    return editableLotIds.map(Number).includes(Number(motorcycleId));
  }

  function handleSubmit() {
    if (auctionStatus === "closed") {
      alert("ปิดรับราคาแล้ว");
      return;
    }

    if (!merchantName || !shopName || !phone || !merchantAccountId) {
      alert("ไม่พบข้อมูลร้านค้า กรุณาเข้าสู่ระบบใหม่");
      redirectToMerchantLogin();
      return;
    }

    if (hasSubmitted && editableLotIds.length === 0) {
      alert("ส่งราคาแล้ว หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลให้เปิดลำดับที่ต้องการแก้");
      return;
    }

    const editableLotIdNumbers = editableLotIds.map(Number);

    const submittedOffers = hasSubmitted
      ? offers.filter(
          (offer) =>
            editableLotIdNumbers.includes(Number(offer.motorcycle_id)) &&
            offer.price !== ""
        )
      : offers.filter((offer) => offer.price !== "");

    if (submittedOffers.length === 0) {
      alert(
        hasSubmitted
          ? "กรุณาใส่ราคาในลำดับที่ได้รับอนุญาตให้แก้ไข"
          : "กรุณาใส่ราคาอย่างน้อย 1 รายการ"
      );
      return;
    }

    const data = {
      merchantName,
      shopName,
      phone,
      auctionRoundId: currentRound?.id || null,
      auctionRoundName: currentRound?.round_name || "",
      offers: submittedOffers,
      isEditingSubmission: hasSubmitted,
      submittedMerchantId,
      merchantAccountId,
      editableLotIds: editableLotIdNumbers,
    };

    localStorage.setItem("draftSubmission", JSON.stringify(data));
    window.location.href = "/summary";
  }

  const enteredOfferCount = offers.filter((offer) => offer.price !== "").length;
  const editableLotCount = editableLotIds.length;

  const isLockedAfterSubmission = hasSubmitted && editableLotCount === 0;
  const canSubmit =
    auctionStatus === "open" &&
    Boolean(currentRound) &&
    !isLoadingCurrentRound &&
    (!hasSubmitted || editableLotCount > 0);

  const sortedOffers = useMemo(() => {
    return sortBySavedAuctionDisplayOrder(offers);
  }, [offers]);
  qrSortedOffersRef.current = sortedOffers;

  const starredOffers = useMemo(() => {
    return sortedOffers.filter((offer) =>
      starredLotIds.map(Number).includes(Number(offer.motorcycle_id))
    );
  }, [sortedOffers, starredLotIds]);

  const filteredOffers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return sortedOffers.filter((offer) => {
      const isStarred = starredLotIds
        .map(Number)
        .includes(Number(offer.motorcycle_id));

      const lotCanEdit = canEditThisLot(Number(offer.motorcycle_id));

      const searchableText = [
        formatAuctionDisplayOrder(offer.display_order),
        offer.lot,
        offer.motorcycle,
        offer.brand,
        offer.model,
        offer.year,
        offer.color,
        offer.license_plate,
        offer.frame_number,
        offer.engine_number,
        offer.registration_status,
        offer.tax_expiry,
        offer.condition,
        offer.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = !keyword || searchableText.includes(keyword);

      const matchFilter =
        offerFilter === "all" ||
        (offerFilter === "empty" && offer.price === "") ||
        (offerFilter === "priced" && offer.price !== "") ||
        (offerFilter === "editable" && hasSubmitted && lotCanEdit) ||
        (offerFilter === "starred" && isStarred);

      return matchSearch && matchFilter;
    });
  }, [
    sortedOffers,
    searchText,
    offerFilter,
    starredLotIds,
    editableLotIds,
    hasSubmitted,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOffers.length / ITEMS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOffers = filteredOffers.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );
  qrPaginatedOffersRef.current = paginatedOffers;

  useEffect(() => {
    if (hasHandledQrJumpRef.current) return;
    if (!targetMotorcycleId || isLoadingCurrentRound) return;

    const sortedQrOffers = qrSortedOffersRef.current;
    if (sortedQrOffers.length === 0) return;

    const targetId = Number(targetMotorcycleId);
    if (!Number.isFinite(targetId)) {
      setErrorMessage(INVALID_QR_MESSAGE);
      return;
    }

    const targetIndex = sortedQrOffers.findIndex(
      (offer) => getStockMotorcycleId(offer) === targetId
    );

    if (targetIndex < 0) {
      setErrorMessage(INVALID_QR_MESSAGE);
      return;
    }

    setSearchText("");
    setOfferFilter("all");
    setCurrentPage(Math.floor(targetIndex / ITEMS_PER_PAGE) + 1);
    setQrJumpPlanVersion((current) => current + 1);
  }, [targetMotorcycleId, isLoadingCurrentRound]);

  useEffect(() => {
    if (hasHandledQrJumpRef.current) return;
    if (!targetMotorcycleId || isLoadingCurrentRound) return;

    const paginatedQrOffers = qrPaginatedOffersRef.current;
    if (paginatedQrOffers.length === 0) return;

    const targetId = Number(targetMotorcycleId);
    if (!Number.isFinite(targetId)) return;

    const targetOffer = paginatedQrOffers.find(
      (offer) => getStockMotorcycleId(offer) === targetId
    );

    if (!targetOffer) return;

    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-motorcycle-card-id="${targetId}"]`
      );
      const input = document.querySelector<HTMLInputElement>(
        `[data-price-input-id="${targetId}"]`
      );

      if (!card) return;

      hasHandledQrJumpRef.current = true;
      const rect = card.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const targetTop =
        absoluteTop - window.innerHeight / 2 + rect.height / 2;

      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: "smooth",
      });
      input?.focus({ preventScroll: true });
      setHighlightedMotorcycleId(targetId);

      window.setTimeout(() => {
        setHighlightedMotorcycleId((current) =>
          current === targetId ? null : current
        );
      }, 1800);
    }, 150);
  }, [targetMotorcycleId, currentPage, isLoadingCurrentRound, qrJumpPlanVersion]);

  const paginatedMotorcycleIds = useMemo(
    () => paginatedOffers.map((offer) => Number(offer.motorcycle_id)),
    [paginatedOffers]
  );

  const paginatedMotorcycleIdKey = paginatedMotorcycleIds.join(",");

  useEffect(() => {
    if (paginatedMotorcycleIds.length === 0) return;

    const motorcycleIdsToLoad = paginatedMotorcycleIds.filter(
      (motorcycleId) =>
        !cardPhotosByMotorcycleId[motorcycleId] &&
        !loadingCardPhotoIds[motorcycleId]
    );

    if (motorcycleIdsToLoad.length === 0) return;

    let isCancelled = false;

    setLoadingCardPhotoIds((currentIds) => {
      const nextIds = { ...currentIds };

      motorcycleIdsToLoad.forEach((motorcycleId) => {
        nextIds[motorcycleId] = true;
      });

      return nextIds;
    });

    async function loadCardPhotos() {
      try {
        const { data, error } = await supabase
          .from("motorcycle_photos")
          .select("id, motorcycle_id, image_url")
          .in("motorcycle_id", motorcycleIdsToLoad)
          .order("motorcycle_id", { ascending: true })
          .order("id", { ascending: true });

        if (error) throw error;

        const photosByMotorcycleId = new Map<number, MotorcyclePhoto[]>();

        ((data as MotorcyclePhoto[] | null) || []).forEach((photo) => {
          const photos = photosByMotorcycleId.get(photo.motorcycle_id) || [];
          photos.push(photo);
          photosByMotorcycleId.set(photo.motorcycle_id, photos);
        });

        const photoResults = motorcycleIdsToLoad.map((motorcycleId) => {
          const photos = photosByMotorcycleId.get(motorcycleId) || [];

          return {
            motorcycleId,
            photos: photos.slice(0, 2),
            count: photos.length,
          };
        });

        if (isCancelled) return;

        setCardPhotosByMotorcycleId((currentPhotosById) => {
          const nextPhotosById = { ...currentPhotosById };

          photoResults.forEach((result) => {
            nextPhotosById[result.motorcycleId] = result.photos;
          });

          return nextPhotosById;
        });

        setCardPhotoCountsByMotorcycleId((currentCountsById) => {
          const nextCountsById = { ...currentCountsById };

          photoResults.forEach((result) => {
            nextCountsById[result.motorcycleId] = result.count;
          });

          return nextCountsById;
        });
      } catch (error) {
        if (await handleMerchantAuthError(error)) return;

        console.error("โหลดรูปภาพรถไม่สำเร็จ", error);
      } finally {
        if (isCancelled) return;

        setLoadingCardPhotoIds((currentIds) => {
          const nextIds = { ...currentIds };

          motorcycleIdsToLoad.forEach((motorcycleId) => {
            delete nextIds[motorcycleId];
          });

          return nextIds;
        });
      }
    }

    loadCardPhotos();

    return () => {
      isCancelled = true;
    };
  }, [paginatedMotorcycleIdKey]);

  const emptyLotMessage = getEmptyLotMessage();

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((page) => {
      return (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - safeCurrentPage) <= 2
      );
    });

  function goToPage(page: number) {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(safePage);

    setTimeout(() => {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function showOnlyStarredLots() {
    setSearchText("");
    setOfferFilter("starred");
    setCurrentPage(1);

    setTimeout(() => {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function jumpToStarredLot(motorcycleId: number) {
    const sortedIndex = sortedOffers.findIndex(
      (offer) => Number(offer.motorcycle_id) === Number(motorcycleId)
    );

    setOfferFilter("all");
    setSearchText("");
    setCurrentPage(
      sortedIndex >= 0 ? Math.floor(sortedIndex / ITEMS_PER_PAGE) + 1 : 1
    );
  }

  function renderPaginationControls() {
    if (filteredOffers.length <= ITEMS_PER_PAGE) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-100 p-3">
        <p className="text-sm text-gray-600">
          หน้า {safeCurrentPage} / {totalPages} • แสดงทีละ {ITEMS_PER_PAGE} รายการ
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => goToPage(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ก่อนหน้า
          </button>

          {pageNumbers.map((page, index) => {
            const previousPage = pageNumbers[index - 1];
            const showDots =
              previousPage !== undefined && page - previousPage > 1;

            return (
              <div key={page} className="flex items-center gap-2">
                {showDots && (
                  <span className="px-1 text-sm text-gray-400">...</span>
                )}

                <button
                  type="button"
                  onClick={() => goToPage(page)}
                  className={
                    page === safeCurrentPage
                      ? "rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
                  }
                >
                  {page}
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => goToPage(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      </div>
    );
  }

  if (!isMerchantLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">กำลังเปิดหน้า...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl">
              {shopName}
            </h1>
          </div>

          <button
            onClick={logoutMerchant}
            className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100 sm:px-4 sm:text-sm"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-5">
        {isLoadingCurrentRound ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-gray-700 sm:p-4">
            <p className="font-semibold">กำลังโหลดรอบเสนอราคา...</p>
          </div>
        ) : currentRound ? (
          auctionStatus === "open" ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-green-800 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{getRoundDisplayName(currentRound)}</p>
                </div>

                <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                  {getRoundStatusLabel(currentRound.status)}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-800 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{getRoundDisplayName(currentRound)}</p>
                </div>

                <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                  {getRoundStatusLabel(currentRound.status)}
                </span>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 sm:p-4">
            <p className="font-semibold">ยังไม่มีรอบเสนอราคาปัจจุบัน</p>
          </div>
        )}

        {hasSubmitted && editableLotCount === 0 && (
          <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 sm:p-4">
            <p className="font-semibold">ส่งราคาแล้ว</p>
            <p className="text-sm">ดูราคาที่ส่งไว้ได้ แต่แก้ไขไม่ได้</p>
          </div>
        )}

        {hasSubmitted && editableLotCount > 0 && (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-800 sm:p-4">
            <p className="font-semibold">แก้ไขราคาได้บางลำดับ</p>
            <p className="text-sm">
              แก้ไขได้เฉพาะลำดับที่ผู้ดูแลเปิดสิทธิ์ให้
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 sm:p-4">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        <section
          ref={listSectionRef}
          className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">รายการรถ</h2>
            </div>

            <div className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-sm font-medium text-white">
              {enteredOfferCount}/{offers.length}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <label className="text-sm font-medium text-gray-700">ค้นหา</label>

              <input
                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="ค้นหาลำดับ / ชื่อรถ / รุ่น / ทะเบียน"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                ตัวกรอง
              </label>

              <select
                value={offerFilter}
                onChange={(event) =>
                  setOfferFilter(event.target.value as OfferFilter)
                }
                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">ทั้งหมด</option>
                <option value="empty">ยังไม่ใส่ราคา</option>
                <option value="priced">ใส่ราคาแล้ว</option>
                <option value="editable">แก้ไขได้</option>
                <option value="starred">ปักดาว</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-2 py-2 text-center">
              <p className="text-xs text-gray-500">รถทั้งหมด</p>
              <p className="mt-1 text-lg font-bold leading-none text-gray-900">
                {offers.length}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 px-2 py-2 text-center">
              <p className="text-xs text-green-700">ใส่ราคาแล้ว</p>
              <p className="mt-1 text-lg font-bold leading-none text-green-700">
                {enteredOfferCount}
              </p>
            </div>
          </div>

          {starredOffers.length > 0 && (
            <section className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-yellow-900">
                    ⭐ รายการที่ปักดาว
                  </h3>

                  <p className="mt-1 text-sm text-yellow-800">
                    เก็บลำดับที่สนใจไว้ตรงนี้ โดยไม่เปลี่ยนลำดับรายการหลัก
                  </p>
                </div>

                <button
                  type="button"
                  onClick={showOnlyStarredLots}
                  className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-600"
                >
                  ดูเฉพาะปักดาว
                </button>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {starredOffers.map((offer) => {
                  const starredVisibleNumber =
                    formatAuctionDisplayOrder(offer.display_order);

                  return (
                    <button
                      key={offer.motorcycle_id}
                      type="button"
                      onClick={() =>
                        jumpToStarredLot(Number(offer.motorcycle_id))
                      }
                      className="shrink-0 rounded-2xl border border-yellow-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-yellow-100"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                        ลำดับ {starredVisibleNumber}
                      </p>

                      <p className="mt-1 max-w-[180px] truncate text-sm font-bold text-gray-900">
                        {getAuctionDisplayLabel(offer)}
                      </p>

                      {offer.price ? (
                        <p className="mt-1 text-xs font-semibold text-green-700">
                          {Number(offer.price).toLocaleString()} บาท
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          ยังไม่ใส่ราคา
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {offers.length === 0 && !errorMessage && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-5">
              <p className="font-semibold text-gray-900">{emptyLotMessage.title}</p>
              <p className="mt-1 text-sm text-gray-600">{emptyLotMessage.detail}</p>
            </div>
          )}

          {offers.length > 0 && filteredOffers.length === 0 && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-5">
              <p className="font-semibold text-gray-900">
                ไม่พบรายการที่ค้นหา
              </p>
              <p className="mt-1 text-sm text-gray-600">
                ลองเปลี่ยนคำค้นหาหรือตัวกรอง
              </p>
            </div>
          )}

          {paginatedOffers.length > 0 && (
            <>
              <div className="mt-4">{renderPaginationControls()}</div>

              <div className="mt-4 space-y-4">
                {paginatedOffers.map((offer, index) => {
                  const displayVisibleNumber =
                    formatAuctionDisplayOrder(offer.display_order);
                  const originalIndex = offers.findIndex(
                    (item) =>
                      Number(item.motorcycle_id) === Number(offer.motorcycle_id)
                  );

                  const isStarred = starredLotIds
                    .map(Number)
                    .includes(Number(offer.motorcycle_id));

                  const isDetailOpen = openDetailIds
                    .map(Number)
                    .includes(Number(offer.motorcycle_id));

                  const motorcycleId = Number(offer.motorcycle_id);
                  const offerPhotos =
                    cardPhotosByMotorcycleId[motorcycleId] || offer.photos;
                  const hasLoadedCardPhotos = Object.prototype.hasOwnProperty.call(
                    cardPhotosByMotorcycleId,
                    motorcycleId
                  );
                  const visiblePhotos = offerPhotos.slice(0, 2);
                  const photoCount =
                    cardPhotoCountsByMotorcycleId[motorcycleId] ??
                    offerPhotos.length;
                  const hasMorePhotos = photoCount > visiblePhotos.length;
                  const isLoadingCardPhotos =
                    (!hasLoadedCardPhotos || loadingCardPhotoIds[motorcycleId]) &&
                    visiblePhotos.length === 0;

                  const lotCanEdit = canEditThisLot(
                    Number(offer.motorcycle_id)
                  );

                  const inputDisabled = auctionStatus !== "open" || !lotCanEdit;
                  const qrStockMotorcycleId = getStockMotorcycleId(offer);
                  const isQrHighlighted =
                    highlightedMotorcycleId === qrStockMotorcycleId;

                  return (
                    <article
                      key={offer.motorcycle_id}
                      data-motorcycle-card-id={qrStockMotorcycleId ?? undefined}
                      className={
                        isQrHighlighted
                          ? "overflow-hidden rounded-3xl bg-white shadow-sm ring-4 ring-blue-300"
                          : isStarred
                            ? "overflow-hidden rounded-3xl border border-yellow-300 bg-yellow-50 shadow-sm"
                            : "overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200"
                      }
                    >
                      {visiblePhotos.length > 0 ? (
                        <div
                          className={
                            visiblePhotos.length === 1
                              ? "grid grid-cols-1 gap-2 bg-gray-100 p-2"
                              : "grid grid-cols-2 gap-2 bg-gray-100 p-2"
                          }
                        >
                          {visiblePhotos.map((photo, photoIndex) => {
                            const isThumbnailLoaded =
                              loadedThumbnailIds[photo.id] || false;
                            const hasThumbnailFailed =
                              failedThumbnailIds[photo.id] || false;
                            const thumbnailUrl = getMerchantCardImageUrl(
                              photo.image_url
                            );

                            return (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() =>
                                  openGallery(
                                    motorcycleId,
                                    offerPhotos,
                                    photoIndex
                                  )
                                }
                                className={
                                  visiblePhotos.length === 1
                                    ? "relative block aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gray-200"
                                    : "relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200"
                                }
                              >
                                {!isThumbnailLoaded && !hasThumbnailFailed && (
                                  <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-500">
                                    กำลังโหลดรูป
                                  </span>
                                )}

                                {hasThumbnailFailed ? (
                                  <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-500">
                                    ไม่มีรูป
                                  </span>
                                ) : (
                                  <img
                                    src={thumbnailUrl}
                                    alt={`${offer.motorcycle} photo ${photoIndex + 1}`}
                                    loading={
                                      safeCurrentPage === 1 && index < 2
                                        ? "eager"
                                        : "lazy"
                                    }
                                    decoding="async"
                                    width={700}
                                    height={525}
                                    onLoad={() =>
                                      setLoadedThumbnailIds((currentIds) => ({
                                        ...currentIds,
                                        [photo.id]: true,
                                      }))
                                    }
                                    onError={() =>
                                      setFailedThumbnailIds((currentIds) => ({
                                        ...currentIds,
                                        [photo.id]: true,
                                      }))
                                    }
                                    className={
                                      isThumbnailLoaded
                                        ? "h-full w-full object-contain opacity-100 transition-opacity"
                                        : "h-full w-full object-contain opacity-0 transition-opacity"
                                    }
                                  />
                                )}

                                {hasMorePhotos && photoIndex === 1 && (
                                  <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
                                    +{photoCount - 2} รูป
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : isLoadingCardPhotos ? (
                        <div className="flex h-32 items-center justify-center bg-gray-100 text-sm font-medium text-gray-500">
                          กำลังโหลดรูป
                        </div>
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-gray-100 text-sm text-gray-500">
                          ไม่มีรูป
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-slate-900">
                              {isStarred ? "⭐ " : ""}
                              ลำดับ {displayVisibleNumber}
                            </p>

                            <h3 className="mt-1 text-lg font-bold text-gray-900">
                              {getAuctionDisplayLabel(offer)}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleStarLot(Number(offer.motorcycle_id))
                            }
                            className={
                              isStarred
                                ? "shrink-0 rounded-full bg-yellow-200 px-3 py-2 text-sm font-semibold text-yellow-800"
                                : "shrink-0 rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-yellow-50"
                            }
                          >
                            {isStarred ? "⭐" : "☆"}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {offer.price && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              {hasSubmitted ? "ราคาที่ส่ง" : "ใส่ราคาแล้ว"}
                            </span>
                          )}

                          {!offer.price && !hasSubmitted && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              ยังไม่ใส่ราคา
                            </span>
                          )}

                          {hasSubmitted && lotCanEdit && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                              แก้ไขลำดับนี้ได้
                            </span>
                          )}

                          {hasSubmitted && !lotCanEdit && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              ล็อก
                            </span>
                          )}

                          {isStarred && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                              ปักดาว
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleDetail(Number(offer.motorcycle_id))
                            }
                            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            {isDetailOpen ? "ซ่อนรายละเอียด ▲" : "ดูรายละเอียด ▼"}
                          </button>

                        </div>

                        {isDetailOpen && (
                          <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="font-semibold text-gray-900">ลำดับ</p>
                                <p>{displayVisibleNumber}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  ยี่ห้อ
                                </p>
                                <p>{offer.brand || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  รุ่น
                                </p>
                                <p>{offer.model || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">ปี</p>
                                <p>{offer.year || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">สี</p>
                                <p>{offer.color || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  ทะเบียน
                                </p>
                                <p>{offer.license_plate || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  เลขตัวถัง
                                </p>
                                <p>{offer.frame_number || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  สถานะเล่ม
                                </p>
                                <p>{offer.registration_status || "-"}</p>
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  ภาษีหมดอายุ
                                </p>
                                <p>{offer.tax_expiry || "-"}</p>
                              </div>

                              <div className="sm:col-span-2">
                                <p className="font-semibold text-gray-900">
                                  หมายเหตุ
                                </p>
                                <p className="whitespace-pre-line">
                                  {offer.notes || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">
                            ราคา
                          </label>

                          <div className="mt-2 flex items-center overflow-hidden rounded-2xl border bg-white focus-within:ring-2 focus-within:ring-black">
                            <input
                              data-price-input-id={qrStockMotorcycleId ?? undefined}
                              inputMode="numeric"
                              disabled={inputDisabled}
                              className="w-full p-4 text-xl font-semibold outline-none disabled:bg-gray-100 disabled:text-gray-700"
                              placeholder="ใส่ราคา"
                              value={
                                offer.price
                                  ? Number(offer.price).toLocaleString()
                                  : ""
                              }
                              onChange={(event) =>
                                updatePrice(originalIndex, event.target.value)
                              }
                            />

                            <span className="border-l bg-gray-50 px-4 py-4 text-sm font-medium text-gray-600">
                              บาท
                            </span>
                          </div>

                          {hasSubmitted && !lotCanEdit && (
                            <p className="mt-2 text-xs text-gray-500">
                              หากต้องการแก้ลำดับนี้ กรุณาติดต่อผู้ดูแล
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4">{renderPaginationControls()}</div>
            </>
          )}
        </section>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white p-3 shadow-lg sm:p-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              ใส่ราคาแล้ว {enteredOfferCount} / {offers.length} รายการ
            </p>

            {draftSavedAt && (
              <p className="mt-0.5 text-xs font-medium text-green-700">
                บันทึกอัตโนมัติแล้ว
              </p>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:shrink-0">
            <button
              type="button"
              onClick={openQrScanner}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 sm:px-6 sm:text-base"
            >
              สแกน QR
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow disabled:bg-gray-400 sm:px-6 sm:text-base"
            >
              {isLockedAfterSubmission
                ? "ส่งแล้ว"
                : hasSubmitted && editableLotCount > 0
                  ? "ตรวจสอบราคาใหม่"
                  : "ตรวจสอบราคา"}
            </button>
          </div>
        </div>
      </div>

      {galleryPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            type="button"
            onClick={closeGallery}
            aria-label="ปิดรูปภาพ"
            className="fixed right-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-base font-semibold text-white shadow-lg hover:bg-red-700"
          >
            <span className="text-xl leading-none">×</span>
          </button>

          {galleryPhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="fixed left-3 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-3xl text-white"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={showNextPhoto}
                className="fixed right-3 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/60 px-4 py-3 text-3xl text-white"
              >
                ›
              </button>
            </>
          )}

          <div className="flex h-screen w-screen items-center justify-center overflow-auto bg-black p-2">
          <img
           src={galleryPhotos[galleryIndex].image_url}
           alt="Motorcycle photo"
            loading="lazy"
            decoding="async"
            width={1200}
            height={900}
            className="max-h-[92vh] max-w-full bg-white object-contain"
           style={{
             width: "auto",
             height: "auto",
              touchAction: "pinch-zoom",
    }}
  />
</div>
        </div>
      )}

      {isQrScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">สแกน QR</h2>
              </div>

              <button
                type="button"
                onClick={closeQrScanner}
                className="rounded-xl border px-3 py-2 text-sm font-bold hover:bg-gray-100"
              >
                ปิด
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-gray-900">
              <QrScanner
                onScan={handleQrScan}
                onError={handleQrScannerError}
                constraints={{ facingMode: "environment" }}
                formats={["qr_code"]}
                paused={!isQrScannerOpen || hasHandledQrScan}
                sound={false}
                styles={{
                  container: { width: "100%" },
                  video: { width: "100%", height: "320px", objectFit: "cover" },
                }}
              />
            </div>

            {qrScannerErrorMessage && (
              <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {qrScannerErrorMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
