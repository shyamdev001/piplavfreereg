import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, UserStatus } from '../types/enums';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, 'Phone must be a 10-digit number'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), required: true, default: UserRole.AGENT },
    status: { type: String, enum: Object.values(UserStatus), required: true, default: UserStatus.ACTIVE },
    mustChangePassword: { type: Boolean, default: false },
    refreshTokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });

export const User = model<IUser>('User', userSchema);
