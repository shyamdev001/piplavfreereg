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
  OTHER: { GENERAL: 110000, SC_ST: 102695, PASHUPALAK: 108000 },
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
  OTHER: { GENERAL: 110700, SC_ST: 103395, PASHUPALAK: 108700 },
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
  categories: ['GENERAL', 'SC_ST', 'PASHUPALAK'] as QuotationCategory[],
  policy: { name: 'Policy', price: 700 },
  policyNotIncludedNote: 'Note: Policy is not included in this quotation.',
};

/**
 * Bigger systems (6-10 panels) from three companies. One price for everyone - no
 * village or category. Insurance and the WiFi dongle are always included: the total is
 * panels + inverter + insurance + dongle.
 */
export const PackageBrand = {
  APS: 'APS',
  ADANI: 'ADANI',
  WAAREE: 'WAAREE',
} as const;
export type PackageBrand = (typeof PackageBrand)[keyof typeof PackageBrand];

export const PACKAGE_PANEL_COUNTS = [6, 7, 8, 9, 10] as const;

/**
 * Each company offers two panel types. The first one listed is the default (and is what
 * quotations saved before panel types existed used). Prices are panels + inverter only;
 * insurance (3,000) and the WiFi dongle (1,700) are always added on top.
 */
export interface PackageVariant {
  id: string;
  /** Shown in the app, e.g. "Mono Bifacial 540W". */
  label: string;
  /** Added to the PDF title, e.g. "MONO BIFACIAL". */
  titleSuffix: string;
  panelName: string;
  panelWatt: number;
  prices: Record<number, number>;
}

export const PACKAGE_BRANDS: Record<PackageBrand, { label: string; variants: PackageVariant[] }> = {
  APS: {
    label: 'APS',
    variants: [
      {
        // Id kept from when this was listed as TOPCon, so saved quotations still match.
        id: 'TOPCON_550',
        label: 'Mono Bifacial 550W',
        titleSuffix: 'MONO BIFACIAL',
        panelName: 'APS Mono Bifacial Solar Panel',
        panelWatt: 550,
        prices: { 6: 162000, 7: 182000, 8: 209000, 9: 232000, 10: 260000 },
      },
      {
        id: 'TOPCON_600',
        label: 'TOPCon 600W',
        titleSuffix: 'TOPCON',
        panelName: 'APS TOPCon Solar Panel',
        panelWatt: 600,
        prices: { 6: 166000, 7: 187000, 8: 214000, 9: 238000, 10: 265000 },
      },
    ],
  },
  ADANI: {
    label: 'ADANI',
    variants: [
      {
        id: 'MONO_540',
        label: 'Mono Bifacial 540W',
        titleSuffix: 'MONO BIFACIAL',
        panelName: 'ADANI Mono Bifacial Solar Panel',
        panelWatt: 540,
        // 6 panels: priced so the full total (with insurance and dongle) is Rs 1,70,700.
        prices: { 6: 166000, 7: 198000, 8: 226000, 9: 249000, 10: 280000 },
      },
      {
        id: 'TOPCON_610',
        label: 'TOPCon 610W',
        titleSuffix: 'TOPCON',
        panelName: 'ADANI TOPCon Solar Panel',
        panelWatt: 610,
        prices: { 6: 184000, 7: 214900, 8: 240600, 9: 273000, 10: 297900 },
      },
    ],
  },
  WAAREE: {
    label: 'WAAREE',
    variants: [
      {
        id: 'MONO_540',
        label: 'Mono Bifacial 540W',
        titleSuffix: 'MONO BIFACIAL',
        panelName: 'WAAREE Mono Bifacial Solar Panel',
        panelWatt: 540,
        prices: { 6: 164000, 7: 186000, 8: 212000, 9: 238700, 10: 265600 },
      },
      {
        id: 'TOPCON_580',
        label: 'TOPCon 580W',
        titleSuffix: 'TOPCON',
        panelName: 'WAAREE TOPCon Solar Panel',
        panelWatt: 580,
        prices: { 6: 180000, 7: 210000, 8: 235000, 9: 265500, 10: 290600 },
      },
    ],
  },
};

/** Every panel type id, for validation. */
export const PACKAGE_PANEL_TYPES = [
  ...new Set(Object.values(PACKAGE_BRANDS).flatMap((b) => b.variants.map((v) => v.id))),
] as [string, ...string[]];

/** The company's panel type, or its first (default) one when none is given. Undefined if it doesn't offer it. */
export function packageVariant(brand: PackageBrand, panelType?: string): PackageVariant | undefined {
  const variants = PACKAGE_BRANDS[brand]?.variants ?? [];
  return panelType ? variants.find((v) => v.id === panelType) : variants[0];
}

export const PACKAGE_QUOTATION = {
  inverter: 'APS / SOLARYAAN / VELOX',
  insurance: { name: 'INSURANCE', description: '5 YEAR ON SITE INSURANCE', price: 3000 },
  dongle: { name: 'WIFI DONGLE', description: 'GSM DONGLE + 1 YEAR RECHARGE SUBSCRIPTION', price: 1700 },
};

/** System size in kW, e.g. 8 x 540W = 4.32. */
export function packageSizeKw(variant: PackageVariant, panels: number): number {
  return Math.round(panels * variant.panelWatt) / 1000;
}

/** e.g. "4.32 kW WAAREE Mono Bifacial 540W" (history and logs). */
export function packageLabel(brand: PackageBrand, panelType: string | undefined, panels: number): string {
  const v = packageVariant(brand, panelType);
  if (!v) return `${PACKAGE_BRANDS[brand]?.label ?? brand}`;
  return `${packageSizeKw(v, panels).toFixed(2)} kW ${PACKAGE_BRANDS[brand].label} ${v.label}`;
}

/** Row 1 on the PDF for a package quotation. */
export function packageSystemText(brand: PackageBrand, panelType: string | undefined, panels: number) {
  const v = packageVariant(brand, panelType)!;
  return {
    title: `${packageSizeKw(v, panels).toFixed(2)} KW ${PACKAGE_BRANDS[brand].label} ${v.titleSuffix}`,
    description: `(1) PV Modules - ${v.panelName} (${v.panelWatt}W) - ${panels} Nos\n(2) Inverter - ${PACKAGE_QUOTATION.inverter} - 1 Nos`,
  };
}

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
  'BANK NAME : THE KHEDA DISTRICT CENTRAL CO-OPERATIVE BANK LTD.',
  'ACCOUNT NAME : PETLAD-SOJITRA TALUKA SAURAUJA UTPADAK SAHKARI. MANDALI. LTD.',
  'ACCOUNT NO : 306050213395',
  'IFSC CODE : GSCB0KDC006',
  'BANK BRANCH : PETLAD - 388 450',
];
