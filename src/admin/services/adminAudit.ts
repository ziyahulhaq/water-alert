import { supabase } from '../../lib/supabase';

export async function logAudit(
  action: string,
  actorId: string,
  actorEmail: string,
  targetId?: string,
  targetType?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      action,
      actor_id: actorId,
      actor_email: actorEmail,
      target_id: targetId,
      target_type: targetType,
      details,
    });
  } catch {
    // Non-fatal — audit logging should never block main operations
    console.warn('[audit] Failed to log:', action);
  }
}
