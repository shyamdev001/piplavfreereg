import { Schema, model, Document, Types } from 'mongoose';
import { QuotationCategory } from '../config/quotation';

export interface IQuotation extends Document {
  _id: Types.ObjectId;
  quotationNumber: string;
  customerName: string;
  address: string;
  mobileNumber: string;
  category: QuotationCategory;
  /** Price at the time the quotation was made (prices may change later). */
  amount: number;
  systemSizeKw: number;
  quotationDate: Date;
  expiryDate: Date;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    mobileNumber: { type: String, required: true, trim: true },
    category: { type: String, enum: Object.values(QuotationCategory), required: true },
    amount: { type: Number, required: true },
    systemSizeKw: { type: Number, required: true },
    quotationDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);

quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ createdBy: 1, createdAt: -1 });

export const Quotation = model<IQuotation>('Quotation', quotationSchema);
