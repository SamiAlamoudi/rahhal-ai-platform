import { supabase } from '../supabaseClient'
import type { SessionRow } from '../types'
import type { TravelSession } from '../../utils/travelSession'
import { ALL_TRACKED_FIELDS } from '../../utils/travelSession'

function sessionToData(session: TravelSession): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of ALL_TRACKED_FIELDS) {
    data[f] = session[f]
  }
  data['lastUpdatedAt'] = session.lastUpdatedAt
  return data
}

function dataToSession(data: Record<string, unknown>): TravelSession {
  return data as unknown as TravelSession
}

export const sessionRepository = {
  async create(session: TravelSession): Promise<SessionRow | null> {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        destination: session.destination || '',
        departure_city: session.departureCity || '',
        session_data: sessionToData(session),
        completion_percentage: session.completionPercentage,
        decision_confirmed: session.decisionProfileConfirmed,
      })
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, session: TravelSession): Promise<SessionRow | null> {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        destination: session.destination || '',
        departure_city: session.departureCity || '',
        session_data: sessionToData(session),
        completion_percentage: session.completionPercentage,
        decision_confirmed: session.decisionProfileConfirmed,
      })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<SessionRow | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 20): Promise<SessionRow[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw error
    return true
  },

  async getSessionData(id: string): Promise<TravelSession | null> {
    const row = await this.getById(id)
    if (!row) return null
    return dataToSession(row.session_data)
  },

  dataToSession,
  sessionToData,
}
