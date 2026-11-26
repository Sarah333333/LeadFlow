// Versions of the legal documents users must accept. Bump a version when the text changes materially;
// users are then asked to accept again (see requireCurrentAgreements). DRAFTS — require lawyer review.
export const LEGAL_VERSIONS = {
  terms: "2026-11-draft-1",
  privacy: "2026-11-draft-1",
  business_responsibilities: "2026-11-draft-1",
} as const;
export type LegalDocument = keyof typeof LEGAL_VERSIONS;
export const LEGAL_DOCS_ARE_DRAFTS = true;

export const BUSINESS_RESPONSIBILITIES = [
  "LeadFlow is a software tool. It is not my legal representative, agent or adviser.",
  "I am responsible for the accuracy of the business information, prices and policies I give LeadFlow.",
  "I am responsible for my offers, pricing, services and customer relationships.",
  "I am responsible for having the permissions and consents required to message each person, in each country I operate in.",
  "I am responsible for my messaging practices and for complying with the laws that apply to my business.",
  "I will review the assistant's messages (Review mode) before switching on automatic sending.",
];

/** Recorded as evidence when the owner attests that a person asked to be texted. */
export const OWNER_CONSENT_STATEMENT = "This person asked us to contact them by text message about their enquiry.";
