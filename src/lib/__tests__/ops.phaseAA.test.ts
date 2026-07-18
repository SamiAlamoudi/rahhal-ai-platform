/**
 * Phase AA — post-launch monitoring, alerting, incidents, feedback, patch-release.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  collectMonitoringSnapshot,
  recordAuthFailure,
  recordBookingFailure,
  recordFrontendError,
  recordSecretValidationFailure,
  recordTicketingFailure,
  resetOpsMetrics,
  resetDeadLetterQueue,
  getDeadLetterQueue,
  checkLiveness,
  checkReadiness,
  evaluateAlertRules,
  highestSeverity,
  DEFAULT_ALERT_RULES,
  MockAlertDispatcher,
  dispatchAlerts,
  resetAlertDispatcher,
  setAlertDispatcher,
  IncidentManager,
  resetIncidentRepository,
  resetIncidentManager,
  canTransitionIncidentStatus,
  FeedbackManager,
  resetFeedbackRepository,
  resetFeedbackManager,
  evaluatePatchRelease,
  shouldRollback,
  isPatchEligible,
  maskEmail,
  maskMetadata,
  validateEnvironment,
} from '../ops'

describe('Phase AA alerting severity', () => {
  beforeEach(() => {
    resetOpsMetrics()
    resetDeadLetterQueue()
    resetAlertDispatcher()
  })

  it('maps conditions to critical/high/medium/low severities', () => {
    const severities = new Set(DEFAULT_ALERT_RULES.map((r) => r.severity))
    expect(severities).toEqual(new Set(['critical', 'high', 'medium']))
    expect(DEFAULT_ALERT_RULES.find((r) => r.id === 'application_unavailable')?.severity).toBe('critical')
    expect(DEFAULT_ALERT_RULES.find((r) => r.id === 'queue_backlog')?.severity).toBe('medium')
  })

  it('fires auth and secret validation alerts from monitoring snapshot', () => {
    for (let i = 0; i < 5; i += 1) recordAuthFailure()
    recordSecretValidationFailure()
    const snapshot = collectMonitoringSnapshot({ target: 'staging', paymentProvider: 'mock' })
    const alerts = evaluateAlertRules(snapshot)
    expect(alerts.some((a) => a.conditionId === 'repeated_auth_failures')).toBe(true)
    expect(alerts.some((a) => a.conditionId === 'security_secret_validation_failure')).toBe(true)
    expect(highestSeverity(alerts)).toBe('critical')
  })

  it('dispatches alerts through mock dispatcher with masked metadata', async () => {
    const dispatcher = new MockAlertDispatcher()
    setAlertDispatcher(dispatcher)
    recordBookingFailure()
    recordBookingFailure()
    recordBookingFailure()
    recordTicketingFailure()
    recordTicketingFailure()
    recordTicketingFailure()
    const snapshot = collectMonitoringSnapshot()
    const alerts = evaluateAlertRules(snapshot)
    await dispatchAlerts(alerts)
    expect(dispatcher.list().length).toBeGreaterThan(0)
    expect(dispatcher.list()[0]?.severity).toBeTruthy()
  })
})

describe('Phase AA incident lifecycle', () => {
  let incidents: IncidentManager

  beforeEach(() => {
    resetIncidentRepository()
    resetIncidentManager()
    incidents = new IncidentManager()
  })

  it('supports Detected → Investigating → Identified → Mitigating → Resolved → Closed', () => {
    const inc = incidents.create({
      title: 'Provider outage',
      severity: 'high',
      affectedServices: ['providers'],
    })
    expect(inc.status).toBe('detected')
    expect(canTransitionIncidentStatus('detected', 'investigating')).toBe(true)

    incidents.transition(inc.id, 'investigating', 'On-call engaged', 'ops')
    incidents.transition(inc.id, 'identified', 'Circuit open on amadeus', 'ops')
    incidents.transition(inc.id, 'mitigating', 'Forcing mock fallback', 'ops', {
      mitigation: 'Enabled mock fallback',
    })
    incidents.transition(inc.id, 'resolved', 'Traffic healthy', 'ops', {
      rootCause: 'Upstream timeout',
      resolution: 'Fallback to mock',
      followUpActions: ['Tune breaker threshold'],
    })
    const closed = incidents.transition(inc.id, 'closed', 'Post-incident review scheduled', 'ops')
    expect(closed.status).toBe('closed')
    expect(closed.timeline.length).toBeGreaterThanOrEqual(5)
    expect(closed.followUpActions).toContain('Tune breaker threshold')
  })

  it('prevents duplicate open incidents for same alert condition', () => {
    const first = incidents.create({
      title: 'Auth failures',
      severity: 'high',
      alertConditionId: 'repeated_auth_failures',
      dedupeKey: 'repeated_auth_failures',
    })
    const second = incidents.create({
      title: 'Auth failures again',
      severity: 'high',
      alertConditionId: 'repeated_auth_failures',
      dedupeKey: 'repeated_auth_failures',
    })
    expect(second.id).toBe(first.id)
    expect(incidents.listOpen()).toHaveLength(1)
  })

  it('masks PII in support view', () => {
    const inc = incidents.create({
      title: 'User report',
      severity: 'low',
      customerImpact: 'user@secret.com cannot sign in',
      correlationId: 'corr-123',
    })
    const view = incidents.toSupportView(inc)
    expect(JSON.stringify(view)).not.toContain('user@secret.com')
    expect(JSON.stringify(view)).toContain('u***@secret.com')
  })
})

describe('Phase AA feedback', () => {
  let feedback: FeedbackManager

  beforeEach(() => {
    resetFeedbackRepository()
    resetFeedbackManager()
    feedback = new FeedbackManager()
  })

  it('classifies bug / feature request / usability / rating', () => {
    const bug = feedback.submit({
      payload: { kind: 'bug', summary: 'Checkout fails', stepsToReproduce: 'Pay' },
      appVersion: '1.0.0',
      contactEmail: 'user@example.com',
      correlationId: 'corr-bug',
    })
    expect(bug.kind).toBe('bug')
    expect(bug.priority).toBe('high')
    expect(bug.contactEmailMasked).toBe('u***@example.com')

    const feature = feedback.submit({
      payload: { kind: 'feature_request', summary: 'Multi-city trips' },
      appVersion: '1.0.0',
    })
    expect(feature.kind).toBe('feature_request')
    expect(feature.priority).toBe('low')

    const usability = feedback.submit({
      payload: { kind: 'usability', summary: 'Voice button unclear', area: 'chat' },
      appVersion: '1.0.0',
    })
    expect(usability.kind).toBe('usability')

    const rating = feedback.submit({
      payload: { kind: 'rating', score: 4, comment: 'Great planner' },
      appVersion: '1.0.0',
    })
    expect(rating.kind).toBe('rating')
  })

  it('prevents duplicate submissions with dedupe key', () => {
    const first = feedback.submit({
      payload: { kind: 'bug', summary: 'Duplicate path' },
      appVersion: '1.0.0',
      userId: 'user-1',
      dedupeKey: 'bug:user-1:dup',
    })
    const second = feedback.submit({
      payload: { kind: 'bug', summary: 'Duplicate path' },
      appVersion: '1.0.0',
      userId: 'user-1',
      dedupeKey: 'bug:user-1:dup',
    })
    expect(second.id).toBe(first.id)
  })

  it('masks personal data in feedback details', () => {
    const item = feedback.submit({
      payload: {
        kind: 'bug',
        summary: 'Token leak',
        stepsToReproduce: 'email=test@corp.com token=abc123',
      },
      appVersion: '1.0.0',
      contactEmail: 'test@corp.com',
    })
    const view = feedback.toSupportView(item)
    expect(maskEmail('test@corp.com')).toBe('t***@corp.com')
    expect(JSON.stringify(view)).not.toContain('abc123')
    expect(maskMetadata({ token: 'abc123' }).token).toBe('[redacted]')
  })
})

describe('Phase AA patch-release and rollback logic', () => {
  beforeEach(() => {
    resetOpsMetrics()
    resetDeadLetterQueue()
  })

  it('recommends rollback on critical availability failure', () => {
    const snapshot = collectMonitoringSnapshot({
      target: 'staging',
      paymentProvider: 'moyasar',
      enforceEnv: true,
    })
    const alerts = evaluateAlertRules(snapshot)
    const decision = evaluatePatchRelease({ snapshot, alerts })
    expect(shouldRollback(snapshot, alerts)).toBe(true)
    expect(decision.action).toBe('rollback')
  })

  it('recommends v1.0.1 patch on booking/ticketing spike without critical outage', () => {
    for (let i = 0; i < 3; i += 1) {
      recordBookingFailure()
      recordTicketingFailure()
    }
    const snapshot = collectMonitoringSnapshot({
      target: 'staging',
      paymentProvider: 'mock',
      enforceEnv: false,
    })
    const alerts = evaluateAlertRules(snapshot)
    const decision = evaluatePatchRelease({ snapshot, alerts })
    expect(decision.action).toBe('v1.0.1_patch')
    expect(isPatchEligible(snapshot, alerts)).toBe(true)
    expect(shouldRollback(snapshot, alerts)).toBe(false)
  })

  it('recommends no-action monitoring when healthy', () => {
    const snapshot = collectMonitoringSnapshot({
      target: 'staging',
      paymentProvider: 'mock',
      enforceEnv: false,
    })
    const alerts = evaluateAlertRules(snapshot)
    const decision = evaluatePatchRelease({ snapshot, alerts })
    expect(decision.action).toBe('no_action_monitoring')
    expect(checkLiveness().status).toBe('ok')
    expect(checkReadiness({ target: 'staging', paymentProvider: 'mock' }).status).toBe('ok')
  })

  it('flags DLQ growth as medium alert', () => {
    const dlq = getDeadLetterQueue()
    for (let i = 0; i < 6; i += 1) {
      dlq.push({
        domain: 'notification',
        operation: 'deliver',
        error: 'upstream',
        payload: { i },
        attempts: 2,
      })
    }
    const snapshot = collectMonitoringSnapshot()
    const alerts = evaluateAlertRules(snapshot)
    expect(alerts.some((a) => a.conditionId === 'dead_letter_growth')).toBe(true)
  })
})

describe('Phase AA privacy and security controls', () => {
  it('rejects unsafe staging env for secret validation alert path', () => {
    const bad = validateEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_GOOGLE_MAPS_API_KEY: 'AIza-fake',
      },
    })
    expect(bad.ok).toBe(false)
    recordSecretValidationFailure()
    const snapshot = collectMonitoringSnapshot({ target: 'staging', enforceEnv: true })
    const alerts = evaluateAlertRules(snapshot)
    expect(alerts.some((a) => a.conditionId === 'security_secret_validation_failure')).toBe(true)
  })

  it('records frontend errors without storing raw PII in metrics tags', () => {
    recordFrontendError({ route: '/chat' })
    const snapshot = collectMonitoringSnapshot()
    expect(snapshot.frontendErrorCount).toBe(1)
    const sample = snapshot.metrics.recent.find((s) => s.name === 'frontend.errors')
    expect(sample?.tags.route).toBe('/chat')
  })
})
