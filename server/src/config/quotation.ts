/**
 * Fixed content of the Piplav 2.18 kW solar quotation. The quotation user only
 * enters the customer's name, address, mobile, village and category; everything else
 * (system, price, seller, bank, notes) comes from here.
 */

export const QuotationVillage = {
  PIPLAV: 'PIPLAV',
  OTHER: 'OTHER',
} as const;
export type QuotationVillage = (typeof QuotationVillage)[keyof typeof QuotationVillage];

export const QUOTATION_VILLAGE_LABELS: Record<QuotationVillage, string> = {
  PIPLAV: 'Piplav',
  OTHER: 'Other',
};

export const QuotationCategory = {
  GENERAL: 'GENERAL',
  SC_ST: 'SC_ST',
  PASHUPALAK: 'PASHUPALAK',
} as const;
export type QuotationCategory = (typeof QuotationCategory)[keyof typeof QuotationCategory];

export const QUOTATION_CATEGORY_LABELS: Record<QuotationCategory, string> = {
  GENERAL: 'General',
  SC_ST: 'SC/ST',
  PASHUPALAK: 'Pashupalak',
};

/**
 * Price of the 2.18 kW system alone (panels + inverter) in rupees, per village and
 * customer category. Policy and other add-ons are added on top of this.
 * Each village only offers the categories listed for it.
 */
export const QUOTATION_PRICES: Record<QuotationVillage, Partial<Record<QuotationCategory, number>>> = {
  PIPLAV: { GENERAL: 97290, SC_ST: 102695 },
  OTHER: { GENERAL: 110000, PASHUPALAK: 108000 },
};

export function quotationPrice(village: QuotationVillage, category: QuotationCategory): number | undefined {
  return QUOTATION_PRICES[village][category];
}

/**
 * Old fixed package totals (policy included). Only used to recalculate quotations
 * saved before add-ons were charged on top, so editing them keeps their old total.
 */
const LEGACY_PACKAGE_PRICES: Record<QuotationVillage, Partial<Record<QuotationCategory, number>>> = {
  PIPLAV: { GENERAL: 97290, SC_ST: 102695 },
  OTHER: { GENERAL: 110700, PASHUPALAK: 108700 },
};

export function legacyPackagePrice(village: QuotationVillage, category: QuotationCategory): number | undefined {
  return LEGACY_PACKAGE_PRICES[village][category];
}

export const QUOTATION_SYSTEM = {
  sizeKw: 2.18,
  title: '2.18 KW APS',
  description: '(1) PV Modules - APS Solar Panel (545W) - 4 Nos\n(2) Inverter - APS / SOLARYAAN / VELOX - 1 Nos',
};

/**
 * Staff quotations (QUOTATION_STAFF role): always Other village, same system and
 * prices, with a policy that is ticked by default and added on top of the system
 * price. Unticked, it is left out and the PDF prints a "not included" note.
 */
export const STAFF_QUOTATION = {
  village: 'OTHER' as QuotationVillage,
  categories: ['GENERAL', 'PASHUPALAK'] as QuotationCategory[],
  policy: { name: 'Policy', price: 700 },
  policyNotIncludedNote: 'Note: Policy is not included in this quotation.',
};

/** Days a quotation stays valid. */
export const QUOTATION_VALIDITY_DAYS = 30;

export const QUOTATION_SELLER = {
  name: 'Petlad Sojitra Taluka Sauraurja Utpadak Sahkari Mandali Limited',
  address: 'B-22, Sardar Patel Anaj Market Yard, College Crossing, Petlad, Petlad, Gujarat, India',
  createdBy: 'Mukt Patel',
  contact: '+91 81409 68999',
};

export const QUOTATION_NOTES = [
  'REQUIRED DOCUMENTS :',
  '1) LATEST ELECTRICITY BILL',
  '2) INDEX COPY',
  '3) CORPORATION TAX RECEIPT',
  '4) PHOTO ID PROOF (PAN CARD & ADHAR CARD)',
  '5) CUSTOMER & 2 WITNESS ADHAR CARD ZEROX COPIES',
  '6) BANK DETAIL WITH CANCELLED CHEQUE',
];

export const QUOTATION_BANK = [
  'BANK NAME : THE KAIRA DISTRICT CENTRAL COOP. BANK LTD.',
  'ACCOUNT NAME : PETLAD-SOJITRA TALUKA SAURAUJA UTPADAK SAHKARI. MANDALI. LTD.',
  'ACCOUNT NO : 306050213395',
  'IFSC CODE : GSCB0KDC006',
  'BANK BRANCH : PETLAD - 388 450',
];
