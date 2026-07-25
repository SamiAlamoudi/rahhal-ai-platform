# Conversation Pipeline — Phase 7 Stage 12

**Source:** `CONVERSATION_BRAIN_PIPELINE_STAGES` in `src/lib/orchestration/conversationBrain/types.ts`  
**Flag:** `brain.conversation_brain`

Ordered stages (`execution: 'none'`):

1. receive_user_message  
2. personalization  
3. preference_extraction  
4. traveler_context  
5. intent_recognition  
6. travel_planning  
7. travel_search  
8. recommendation  
9. offer_decision  
10. booking_draft  
11. emit_conversation_brain_result  

Declarative stage list only — engines are referenced by contract hints, never invoked.
