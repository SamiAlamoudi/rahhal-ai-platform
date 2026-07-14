import { supabase } from '../supabaseClient'
import type { AuditLogRow, CreateAuditLogInput } from '../types'

export const auditLogRepository = {
  async create(input: CreateAuditLogInput): Promise<AuditLogRow | null> {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        action: input.action,
        entity_type: input.entity_type ?? '',
        entity_id: input.entity_id ?? '',
        metadata: input.metadata ?? {},
      })
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 100): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async listByAction(action: string, limit: number = 50): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },
}
