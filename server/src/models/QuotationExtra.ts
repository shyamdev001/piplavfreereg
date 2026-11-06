import { Schema, model, Document, Types } from 'mongoose';

/**
 * An optional add-on (e.g. a policy) that can be ticked on a quotation. The
 * package total never changes: the add-on's price is shown as its own row and
 * taken out of the panels + inverter row. Admins manage the list and prices; inactive add-ons stay in old
 * quotations but are no longer offered.
 */
export interface IQuotationExtra extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  /** Default amount filled in on the form; it can be changed on each quotation. */
  price: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const quotationExtraSchema = new Schema<IQuotationExtra>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const QuotationExtra = model<IQuotationExtra>('QuotationExtra', quotationExtraSchema);
