import { supabase } from '../supabaseClient'
import type { NotificationRow, CreateNotificationInput } from '../types'

export const notificationRepository = {
  async create(input: CreateNotificationInput): Promise<NotificationRow | null> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(includeArchived: boolean = false): Promise<NotificationRow[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },

  async listUnread(): Promise<NotificationRow[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async markAsRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return true
  },

  async markAllAsRead(): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false)
    if (error) throw error
    return true
  },

  async archive(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_archived: true })
      .eq('id', id)
    if (error) throw error
    return true
  },

  async unarchive(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_archived: false })
      .eq('id', id)
    if (error) throw error
    return true
  },

  async dismiss(id: string): Promise<boolean> {
    return this.archive(id)
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) throw error
    return true
  },

  async countUnread(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('is_archived', false)
    if (error) throw error
    return count ?? 0
  },
}
