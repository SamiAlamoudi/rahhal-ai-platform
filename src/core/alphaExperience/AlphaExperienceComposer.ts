/**
 * Sprint 99 — AlphaExperienceComposer
 * Assembles existing conversation / concierge / engine snapshots into one DTO.
 */

import type {
  AlphaExperienceComposeInput,
  AlphaExperienceDTO,
} from './AlphaExperienceDTO'
import { SPRINT99_ALPHA_ASSEMBLY_VERSION } from './AlphaExperienceDTO'
import { buildAlphaExperienceDTO } from './TravelerResponseBuilder'

export class AlphaExperienceComposer {
  compose(
    input: AlphaExperienceComposeInput,
    options?: { enabled?: boolean },
  ): AlphaExperienceDTO {
    return buildAlphaExperienceDTO(input, { enabled: options?.enabled })
  }
}

export function createAlphaExperienceComposer(): AlphaExperienceComposer {
  return new AlphaExperienceComposer()
}

export function composeAlphaTravelerExperience(
  input: AlphaExperienceComposeInput,
  options?: { enabled?: boolean },
): AlphaExperienceDTO {
  return createAlphaExperienceComposer().compose(input, options)
}

export { SPRINT99_ALPHA_ASSEMBLY_VERSION }
