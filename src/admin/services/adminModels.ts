import { supabase } from '../../lib/supabase';
import type { AdminModel, CreateModelPayload } from '../types/admin';
import { logAudit } from './adminAudit';

export async function listModels(): Promise<AdminModel[]> {
  const { data: models, error } = await supabase
    .from('models')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Count paired devices per model
  const { data: devices } = await supabase.from('devices').select('mac_id');
  const deviceList = devices ?? [];

  return (models ?? []).map(m => ({
    ...m,
    paired_count: deviceList.filter(d => d.mac_id?.startsWith(m.model_id)).length,
  })) as AdminModel[];
}

export async function createModel(payload: CreateModelPayload, actorId: string, actorEmail: string): Promise<AdminModel> {
  const { data, error } = await supabase
    .from('models')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  await logAudit('MODEL_CREATED', actorId, actorEmail, data.id, 'model', { model_id: payload.model_id });
  return data as AdminModel;
}

export async function updateModel(id: string, updates: Partial<CreateModelPayload>, actorId: string, actorEmail: string): Promise<void> {
  const { error } = await supabase.from('models').update(updates).eq('id', id);
  if (error) throw error;
  await logAudit('MODEL_UPDATED', actorId, actorEmail, id, 'model', updates);
}

export async function deleteModel(id: string, actorId: string, actorEmail: string): Promise<void> {
  const { data: model } = await supabase.from('models').select('model_id').eq('id', id).single();
  const { error } = await supabase.from('models').delete().eq('id', id);
  if (error) throw error;
  await logAudit('MODEL_DELETED', actorId, actorEmail, id, 'model', { model_id: model?.model_id });
}

export function generateModelId(existing: string[]): string {
  // Try sequential WM001, WM002 ...
  for (let i = 1; i <= 999; i++) {
    const candidate = `WM${String(i).padStart(3, '0')}`;
    if (!existing.includes(candidate)) return candidate;
  }
  // Fallback: random 8 char alphanumeric
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
