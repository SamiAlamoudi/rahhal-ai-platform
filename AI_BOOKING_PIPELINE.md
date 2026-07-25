# Booking Pipeline — Phase 7 Stage 11

**Source:** `TRAVEL_BOOKING_PIPELINE_STAGES` in `src/lib/orchestration/travelBookingOrchestrator/types.ts`  
**Flag:** `brain.booking_orchestrator`

Ordered stages (`execution: 'none'`):

1. attach_offer_decision  
2. build_booking_request  
3. map_provider_candidates  
4. open_booking_session  
5. plan_booking_steps  
6. apply_strategy  
7. validate_request  
8. draft_confirmation  
9. score_confidence  
10. plan_rollback  
11. plan_retry  
12. audit_prepare  
13. snapshot  

Declarative stage list only — no provider dispatch, booking execution, or payment.
