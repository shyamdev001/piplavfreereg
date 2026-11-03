import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuditAction } from '../types/enums';

interface RecordAuditParams {
  action: AuditAction;
  actor: { id: string; name: string; role: string };
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  req?: Request;
}

/**
 * Persists an audit trail entry. Never pass raw document contents, full
 * Aadhaar/bank numbers, passwords, or tokens in `details` - only
 * human-readable summaries of what changed.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const { action, actor, targetType, targetId, targetLabel, details, req } = params;
  try {
    await AuditLog.create({
      action,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetType,
      targetId,
      targetLabel,
      details,
      ipAddress: req?.ip,
    });
  } catch (err) {
    console.error('[audit] failed to record audit log:', (err as Error).message);
  }
}
