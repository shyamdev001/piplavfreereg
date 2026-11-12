import { Schema, model, Document, Types } from 'mongoose';
import { QuotationCategory, QuotationVillage } from '../config/quotation';

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
  /** STANDARD: Mukt's form (Piplav/Other, add-ons). STAFF: Other village with the fixed policy tick. */
  kind: 'STANDARD' | 'STAFF';
  /** STAFF quotations only: false prints the "policy not included" note. */
  policyIncluded?: boolean;
  category: QuotationCategory;
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
    kind: { type: String, enum: ['STANDARD', 'STAFF'], default: 'STANDARD' },
    policyIncluded: { type: Boolean },
    category: { type: String, enum: Object.values(QuotationCategory), required: true },
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
