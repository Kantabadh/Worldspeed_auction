"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";

type Offer = {
  motorcycle_id: number;
  lot: string;
  motorcycle: string;
  photos?: {
    id: number;
    image_url: string;
  }[];
  price: string;
  wasEdited?: boolean;
};

type DraftSubmission = {
  merchantName: string;
  shopName: string;
  phone: string;
  offers: Offer[];
  auctionRoundId?: number | null;
  auctionRoundName?: string | null;
  isEditingSubmission?: boolean;
  submittedMerchantId?: number | null;
  merchantAccountId?: number | null;
  editableLotIds?: number[];
};

type MerchantSession = {
  merchantAccountId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode: string;
  expiresAt?: number;
};

type LotEditPermission = {
  motorcycle_id: number;
  can_edit: boolean;
};

type ExistingOfferRow = {
  motorcycle_id: number;
  offer_price: number;
  was_edited?: boolean | null;
  original_offer_price?: number | null;
};

type FinalOfferRow = {
  motorcycle_id: number;
  offer_price: number;
  auction_round_id?: number | null;
  was_edited?: boolean | null;
  motorcycles: {
    id: number;
    lot_number: string;
    motorcycle_name: string;
    motorcycle_photos?: {
      id: number;
      image_url: string;
    }[];
  } | null;
};

export default function SummaryPage() {
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [merchantSession, setMerchantSession] =
    useState<MerchantSession | null>(null);

  const [acceptedSubmitPolicy, setAcceptedSubmitPolicy] = useState(false);
  const [showSubmitPolicy, setShowSubmitPolicy] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedDraft = localStorage.getItem("draftSubmission");
    const savedSession = localStorage.getItem("merchantSession");

    if (savedDraft) {
      setDraft(JSON.parse(savedDraft));
    }

    if (savedSession) {
      setMerchantSession(JSON.parse(savedSession));
    }
  }, []);

  function buildFinalOfferList(rows: FinalOfferRow[]): Offer[] {
    return rows
      .map((row) => {
        const motorcycle = row.motorcycles;
        const motorcycleId = Number(row.motorcycle_id);

        return {
          motorcycle_id: motorcycleId,
          lot: motorcycle?.lot_number || "-",
          motorcycle: motorcycle?.motorcycle_name || "-",
          photos: motorcycle?.motorcycle_photos || [],
          price: String(Number(row.offer_price || 0)),
          wasEdited: Boolean(row.was_edited),
        };
      })
      .sort((a, b) =>
        a.lot.localeCompare(b.lot, "th", {
          numeric: true,
          sensitivity: "base",
        })
      );
  }

  async function fetchFinalSubmittedOffers(
    submittedMerchantId: number,
    auctionRoundId?: number | null
  ) {
    let query = supabase
      .from("offers")
      .select(`
        motorcycle_id,
        auction_round_id,
        offer_price,
        was_edited,
        motorcycles (
          id,
          lot_number,
          motorcycle_name,
          motorcycle_photos (
            id,
            image_url
          )
        )
      `)
      .eq("merchant_id", submittedMerchantId)
      .order("motorcycle_id", { ascending: true });

    if (auctionRoundId) {
      query = query.eq("auction_round_id", auctionRoundId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return buildFinalOfferList((data as unknown as FinalOfferRow[]) || []);
  }

  async function confirmSubmit() {
    if (!draft) return;

    if (!acceptedSubmitPolicy) {
      setErrorMessage("กรุณายืนยันเงื่อนไขก่อนส่งราคา");
      return;
    }

    const accountId =
      draft.merchantAccountId || merchantSession?.merchantAccountId;

    const auctionRoundId = draft.auctionRoundId ? Number(draft.auctionRoundId) : null;

    if (!accountId) {
      setErrorMessage("ไม่พบข้อมูลเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    if (!auctionRoundId) {
      setErrorMessage("ไม่พบรอบเสนอราคาปัจจุบัน กรุณากลับไปหน้าเสนอราคาใหม่");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const offersToSave = draft.offers.map((offer) => ({
      motorcycle_id: Number(offer.motorcycle_id),
      auction_round_id: auctionRoundId,
      offer_price: Number(offer.price),
    }));

    if (draft.isEditingSubmission && draft.submittedMerchantId) {
      const editableLotIds = (draft.editableLotIds || []).map((id) =>
        Number(id)
      );

      const submittedMotorcycleIds = offersToSave.map((offer) =>
        Number(offer.motorcycle_id)
      );

      if (submittedMotorcycleIds.length === 0) {
        setErrorMessage("ไม่พบล็อตที่ต้องการแก้ไข");
        setIsSubmitting(false);
        return;
      }

      const notAllowedLots = submittedMotorcycleIds.filter(
        (motorcycleId) => !editableLotIds.includes(Number(motorcycleId))
      );

      if (notAllowedLots.length > 0) {
        setErrorMessage(
          "มีบางล็อตที่ไม่ได้รับอนุญาตให้แก้ไข กรุณากลับไปตรวจสอบใหม่"
        );
        setIsSubmitting(false);
        return;
      }

      const { data: merchantRows, error: merchantCheckError } = await supabase
        .from("merchants")
        .select("id, merchant_account_id")
        .eq("id", draft.submittedMerchantId)
        .eq("merchant_account_id", accountId)
        .eq("auction_round_id", auctionRoundId)
        .limit(1);

      if (merchantCheckError) {
        setErrorMessage(merchantCheckError.message);
        setIsSubmitting(false);
        return;
      }

      if (!merchantRows || merchantRows.length === 0) {
        setErrorMessage("ตรวจสอบรายการเดิมไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
        setIsSubmitting(false);
        return;
      }

      const { data: permissionData, error: permissionError } = await supabase
        .from("merchant_lot_edit_permissions")
        .select("motorcycle_id, can_edit")
        .eq("merchant_account_id", accountId)
        .eq("can_edit", true)
        .in("motorcycle_id", submittedMotorcycleIds);

      if (permissionError) {
        setErrorMessage(permissionError.message);
        setIsSubmitting(false);
        return;
      }

      const allowedPermissionIds = (
        (permissionData as LotEditPermission[] | null) || []
      ).map((permission) => Number(permission.motorcycle_id));

      const missingPermissionIds = submittedMotorcycleIds.filter(
        (motorcycleId) => !allowedPermissionIds.includes(Number(motorcycleId))
      );

      if (missingPermissionIds.length > 0) {
        setErrorMessage(
          "สิทธิ์แก้ไขล็อตนี้หมดแล้วหรือไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแล"
        );
        setIsSubmitting(false);
        return;
      }

      const { data: existingOfferRows, error: existingOfferError } =
        await supabase
          .from("offers")
          .select(
            "motorcycle_id, offer_price, was_edited, original_offer_price"
          )
          .eq("merchant_id", draft.submittedMerchantId)
          .eq("auction_round_id", auctionRoundId)
          .in("motorcycle_id", submittedMotorcycleIds);

      if (existingOfferError) {
        setErrorMessage(existingOfferError.message);
        setIsSubmitting(false);
        return;
      }

      const existingOfferMap = new Map<number, ExistingOfferRow>();

      ((existingOfferRows as ExistingOfferRow[] | null) || []).forEach(
        (row) => {
          existingOfferMap.set(Number(row.motorcycle_id), row);
        }
      );

      for (const offer of offersToSave) {
        const oldOffer = existingOfferMap.get(Number(offer.motorcycle_id));
        const oldPrice = Number(oldOffer?.offer_price || 0);
        const newPrice = Number(offer.offer_price || 0);
        const priceChanged = oldPrice !== newPrice;

        const originalOfferPrice =
          oldOffer?.original_offer_price !== null &&
          oldOffer?.original_offer_price !== undefined
            ? Number(oldOffer.original_offer_price)
            : oldPrice;

        const { error: updateOfferError } = await supabase
          .from("offers")
          .update({
            offer_price: newPrice,
            was_edited: Boolean(oldOffer?.was_edited) || priceChanged,
            original_offer_price:
              Boolean(oldOffer?.was_edited) || priceChanged
                ? originalOfferPrice
                : oldOffer?.original_offer_price || null,
            updated_at: priceChanged ? new Date().toISOString() : null,
          })
          .eq("merchant_id", draft.submittedMerchantId)
          .eq("auction_round_id", auctionRoundId)
          .eq("motorcycle_id", offer.motorcycle_id);

        if (updateOfferError) {
          setErrorMessage(updateOfferError.message);
          setIsSubmitting(false);
          return;
        }
      }

      const { error: lockLotError } = await supabase
        .from("merchant_lot_edit_permissions")
        .update({
          can_edit: false,
        })
        .eq("merchant_account_id", accountId)
        .in("motorcycle_id", submittedMotorcycleIds);

      if (lockLotError) {
        setErrorMessage(lockLotError.message);
        setIsSubmitting(false);
        return;
      }

      await supabase
        .from("merchant_accounts")
        .update({
          can_edit_submission: false,
        })
        .eq("id", accountId);

      let finalOffers: Offer[] = [];

      try {
        finalOffers = await fetchFinalSubmittedOffers(
          Number(draft.submittedMerchantId),
          auctionRoundId
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "บันทึกราคาแล้ว แต่ดึงใบยืนยันไม่สำเร็จ กรุณาติดต่อผู้ดูแล"
        );
        setIsSubmitting(false);
        return;
      }

      const finalSubmission = {
        ...draft,
        offers: finalOffers,
        submittedAt: new Date().toLocaleString("th-TH"),
        receiptNo: "S-" + Date.now(),
        isUpdatedSubmission: true,
      };

      localStorage.setItem("latestSubmission", JSON.stringify(finalSubmission));

      localStorage.removeItem("draftSubmission");
      localStorage.removeItem("merchantPageDraft");
      localStorage.removeItem("merchantOfferPrices");

      window.location.href = "/success";
      return;
    }

    const { data: existingMerchant, error: existingMerchantError } =
      await supabase
        .from("merchants")
        .select("id")
        .eq("merchant_account_id", accountId)
        .eq("auction_round_id", auctionRoundId)
        .limit(1);

    if (existingMerchantError) {
      setErrorMessage(existingMerchantError.message);
      setIsSubmitting(false);
      return;
    }

    if (existingMerchant && existingMerchant.length > 0) {
      setErrorMessage(
        "บัญชีร้านค้านี้ส่งราคาไปแล้ว หากต้องการแก้ไข กรุณาติดต่อผู้ดูแล"
      );
      setIsSubmitting(false);
      return;
    }

    const { data: merchantData, error: merchantError } = await supabase
      .from("merchants")
      .insert({
        name: draft.merchantName,
        shop_name: draft.shopName,
        phone: draft.phone,
        merchant_account_id: accountId,
        auction_round_id: auctionRoundId,
      })
      .select()
      .limit(1);

    if (merchantError) {
      setErrorMessage(merchantError.message);
      setIsSubmitting(false);
      return;
    }

    if (!merchantData || merchantData.length === 0) {
      setErrorMessage("สร้างรายการเสนอราคาไม่สำเร็จ");
      setIsSubmitting(false);
      return;
    }

    const newMerchantId = merchantData[0].id;

    const newOffersToInsert = offersToSave.map((offer) => ({
      ...offer,
      merchant_id: newMerchantId,
      was_edited: false,
      original_offer_price: null,
      updated_at: null,
    }));

    const { error: offersError } = await supabase
      .from("offers")
      .insert(newOffersToInsert);

    if (offersError) {
      setErrorMessage(offersError.message);
      setIsSubmitting(false);
      return;
    }

    const finalSubmission = {
      ...draft,
      offers: draft.offers.map((offer) => ({
        ...offer,
        wasEdited: false,
      })),
      submittedAt: new Date().toLocaleString("th-TH"),
      receiptNo: "S-" + Date.now(),
      isUpdatedSubmission: false,
    };

    localStorage.setItem("latestSubmission", JSON.stringify(finalSubmission));

    localStorage.removeItem("draftSubmission");
    localStorage.removeItem("merchantPageDraft");
    localStorage.removeItem("merchantOfferPrices");

    window.location.href = "/success";
  }

  if (!draft) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6">
        <section className="mx-auto max-w-3xl">
          <BackButton />

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              ไม่พบรายการราคา
            </h1>

            <p className="mt-3 text-gray-600">
              กรุณากลับไปหน้าเสนอราคา แล้วใส่ราคาอีกครั้ง
            </p>

            <a
              href="/merchant"
              className="mt-6 inline-block rounded-2xl bg-black px-5 py-3 font-semibold text-white"
            >
              กลับไปหน้าเสนอราคา
            </a>
          </div>
        </section>
      </main>
    );
  }

  const total = draft.offers.reduce((sum, offer) => {
    return sum + Number(offer.price || 0);
  }, 0);

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <section className="mx-auto max-w-4xl px-4 py-6">
        <BackButton />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            {draft.isEditingSubmission ? "ตรวจสอบราคาที่แก้ไข" : "ตรวจสอบราคา"}
          </h1>

          {draft.auctionRoundName && (
            <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              รอบ: {draft.auctionRoundName}
            </p>
          )}

        </div>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">ส่งราคาไม่ได้</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {draft.isEditingSubmission && (
          <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
            <p className="font-semibold">แก้ไขเฉพาะล็อตที่ได้รับอนุญาต</p>
            <p className="text-sm">
              เมื่อยืนยันแล้ว ระบบจะบันทึกราคาใหม่เฉพาะล็อตนี้ และล็อกการแก้ไขอีกครั้ง
            </p>
          </div>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">ร้านค้า</p>
            <p className="mt-2 font-bold text-gray-900">{draft.shopName}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">ผู้ติดต่อ</p>
            <p className="mt-2 font-bold text-gray-900">
              {draft.merchantName}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">โทร</p>
            <p className="mt-2 font-bold text-gray-900">{draft.phone}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {draft.isEditingSubmission ? "รายการที่แก้ไข" : "รายการที่จะส่ง"}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                ทั้งหมด {draft.offers.length} รายการ
              </p>
            </div>

            <div className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              รวม {total.toLocaleString()} บาท
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {draft.offers.map((offer) => (
              <div
                key={offer.motorcycle_id}
                className="rounded-2xl border bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      ลำดับ {offer.lot}
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

        <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedSubmitPolicy}
              onChange={(e) => setAcceptedSubmitPolicy(e.target.checked)}
              className="mt-1 h-4 w-4"
            />

            <span className="text-sm leading-6 text-gray-700">
              ข้าพเจ้ายืนยันว่าได้ตรวจสอบรายการรถและราคาเสนอเรียบร้อยแล้ว
              และยอมรับว่าราคาที่กดยืนยันเป็นราคาที่ส่งผ่านระบบ
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowSubmitPolicy(true)}
            className="mt-3 text-sm font-semibold text-gray-900 underline underline-offset-4"
          >
            อ่านเงื่อนไขการส่งราคา
          </button>
        </section>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <a
            href="/merchant"
            className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
          >
            กลับไปแก้ไข
          </a>

          <button
            onClick={confirmSubmit}
            disabled={isSubmitting}
            className="rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
          >
            {isSubmitting
              ? "กำลังส่ง..."
              : draft.isEditingSubmission
              ? "ยืนยันราคาใหม่"
              : "ยืนยันส่งราคา"}
          </button>
        </div>
      </div>

      {showSubmitPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  เงื่อนไขการส่งราคา
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  กรุณาอ่านก่อนกดยืนยัน
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitPolicy(false)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xl font-bold text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-7 text-gray-700">
              <p>
                1. ผู้ใช้งานต้องตรวจสอบรายการรถ รายละเอียดรถ และราคาให้ถูกต้องก่อนกดยืนยัน
              </p>

              <p>
                2. เมื่อกดยืนยัน ระบบจะบันทึกราคาตามที่แสดงในหน้านี้
              </p>

              <p>
                3. หลังส่งราคาแล้ว อาจไม่สามารถแก้ไขได้ เว้นแต่ผู้ดูแลระบบเปิดสิทธิ์ให้แก้ไข
              </p>

              <p>
                4. บริษัทมีสิทธิ์ตรวจสอบ ยกเลิก หรือปฏิเสธราคา หากพบข้อผิดพลาด การใช้งานผิดปกติ หรือเหตุจำเป็นทางธุรกิจ
              </p>

              <p>
                5. หากมีผู้เสนอราคาสูงสุดเท่ากัน บริษัทจะเป็นผู้พิจารณาขั้นตอนต่อไป
              </p>

              <p>
                6. การแสดงราคาสูงสุดในระบบไม่ได้หมายความว่าการซื้อขายเสร็จสมบูรณ์ทันที
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setAcceptedSubmitPolicy(true);
                  setShowSubmitPolicy(false);
                }}
                className="rounded-2xl bg-black px-5 py-3 font-semibold text-white"
              >
                ยอมรับ
              </button>

              <button
                type="button"
                onClick={() => setShowSubmitPolicy(false)}
                className="rounded-2xl border px-5 py-3 font-semibold hover:bg-gray-100"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
