export type MerchantOfferDraft = {
  roundId: string;
  merchantId: string;
  updatedAt: string;
  prices: Record<string, string>;
};

export function getMerchantOfferDraftKey(
  merchantId: number | string | null | undefined,
  roundId: number | string | null | undefined
) {
  if (!merchantId || !roundId) return null;

  return `merchant_offer_draft_${merchantId}_${roundId}`;
}

export function loadMerchantOfferDraft(
  merchantId: number | string | null | undefined,
  roundId: number | string | null | undefined
) {
  const draftKey = getMerchantOfferDraftKey(merchantId, roundId);

  if (!draftKey || typeof window === "undefined") return null;

  try {
    const savedDraft = localStorage.getItem(draftKey);

    if (!savedDraft) return null;

    const parsedDraft = JSON.parse(savedDraft) as MerchantOfferDraft;

    return String(parsedDraft.roundId) === String(roundId) &&
      String(parsedDraft.merchantId) === String(merchantId)
      ? parsedDraft
      : null;
  } catch {
    return null;
  }
}

export function saveMerchantOfferDraft(
  merchantId: number | string | null | undefined,
  roundId: number | string | null | undefined,
  prices: Record<string, string>
) {
  const draftKey = getMerchantOfferDraftKey(merchantId, roundId);

  if (!draftKey || typeof window === "undefined") return null;

  const draft: MerchantOfferDraft = {
    roundId: String(roundId),
    merchantId: String(merchantId),
    updatedAt: new Date().toISOString(),
    prices,
  };

  localStorage.setItem(draftKey, JSON.stringify(draft));

  return draft;
}

export function clearMerchantOfferDraft(
  merchantId: number | string | null | undefined,
  roundId: number | string | null | undefined
) {
  const draftKey = getMerchantOfferDraftKey(merchantId, roundId);

  if (!draftKey || typeof window === "undefined") return;

  localStorage.removeItem(draftKey);
}
