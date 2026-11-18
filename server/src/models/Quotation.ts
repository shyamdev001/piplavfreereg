import { Schema, model, Document, Types } from 'mongoose';
import { PackageBrand, QuotationCategory, QuotationVillage } from '../config/quotation';

/** Add-on copied onto the quotation, so later price changes don't alter it. */
export interface IQuotationLineExtra {
  name: string;
  description?: string;
  price: number;
  /** true only on quotations saved while add-ons were carved out of a fixed total. */
  includedInPrice?: boolean;
}

export interface IQuotation extends Document {
  _id: Types.ObjectId;
  quotationNumber: string;
  customerName: string;
  address: string;
  mobileNumber: string;
  village: QuotationVillage;
  /**
   * STANDARD: Mukt's 2.18 kW form (Piplav/Other, add-ons). STAFF: 2.18 kW Other village
   * with the policy tick. PACKAGE: bigger APS/Adani/Waaree system, no village or category.
   */
  kind: 'STANDARD' | 'STAFF' | 'PACKAGE';
  /** STAFF quotations only: false prints the "policy not included" note. */
  policyIncluded?: boolean;
  /** Missing on PACKAGE quotations. */
  category?: QuotationCategory;
  /** PACKAGE quotations only. */
  brand?: PackageBrand;
  panelCount?: number;
  /** Panel type id within the company, e.g. MONO_540 or TOPCON_610. */
  panelType?: string;
  /** Price of the 2.18 kW system alone (missing on quotations made before add-ons existed). */
  basePrice?: number;
  /** System row on the PDF. */
  systemPrice?: number;
  /** 'ON_TOP': add-ons/policy added to the system price. Missing: older fixed-total pricing. */
  pricingMode?: 'ON_TOP';
  extras: IQuotationLineExtra[];
  /** Grand total at the time the quotation was made (prices may change later). */
  amount: number;
  systemSizeKw: number;
  quotationDate: Date;
  expiryDate: Date;
  createdBy: Types.ObjectId;
  createdByName: string;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    mobileNumber: { type: String, required: true, trim: true },
    // Quotations made before villages existed were all for Piplav.
    village: { type: String, enum: Object.values(QuotationVillage), default: QuotationVillage.PIPLAV },
    kind: { type: String, enum: ['STANDARD', 'STAFF', 'PACKAGE'], default: 'STANDARD' },
    policyIncluded: { type: Boolean },
    category: {
      type: String,
      enum: Object.values(QuotationCategory),
      required: function (this: IQuotation) {
        return this.kind !== 'PACKAGE';
      },
    },
    brand: { type: String, enum: Object.values(PackageBrand) },
    panelCount: { type: Number },
    panelType: { type: String },
    basePrice: { type: Number },
    systemPrice: { type: Number },
    pricingMode: { type: String, enum: ['ON_TOP'] },
    extras: {
      type: [
        new Schema<IQuotationLineExtra>(
          {
            name: { type: String, required: true },
            description: String,
            price: { type: Number, required: true },
            includedInPrice: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    amount: { type: Number, required: true },
    systemSizeKw: { type: Number, required: true },
    quotationDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    updatedByName: { type: String },
  },
  { timestamps: true },
);

quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ createdBy: 1, createdAt: -1 });

export const Quotation = model<IQuotation>('Quotation', quotationSchema);
