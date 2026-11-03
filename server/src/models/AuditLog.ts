import { Schema, model, Document, Types } from 'mongoose';
import { AuditAction } from '../types/enums';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  action: AuditAction;
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, enum: Object.values(AuditAction), required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    targetLabel: { type: String },
    details: { type: String, maxlength: 500 },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ targetId: 1 });
auditLogSchema.index({ action: 1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
