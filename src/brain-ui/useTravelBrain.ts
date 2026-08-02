import { useContext } from 'react'
import { TravelBrainContext, type TravelBrainApi } from './BrainProvider'

/**
 * React hook for Brain ⇄ UI — TravelBrain mock session only.
 */
export function useTravelBrain(): TravelBrainApi {
  const ctx = useContext(TravelBrainContext)
  if (!ctx) {
    throw new Error('useTravelBrain() must be used within <BrainProvider>')
  }
  return ctx
}
