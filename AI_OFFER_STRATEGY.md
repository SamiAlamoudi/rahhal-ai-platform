# Offer Strategy — Phase 7 Stage 10

**Source:** `TRAVEL_OFFER_STRATEGY_HINTS` · `OfferStrategyContract`

## Strategy hints

| Strategy | Intent |
|----------|--------|
| `best_overall` | Balance price, quality, preferences, and rules |
| `best_value` | Prefer value-oriented tradeoffs |
| `prefer_quality` | Weight quality signals higher |
| `prefer_price` | Weight price signals higher |
| `prefer_preferences` | Weight traveler preferences higher |
| `business_rules_first` | Apply business rules before soft fits |

## Blueprint defaults

| Contract | Defaults |
|----------|----------|
| `OfferStrategyContract` | all strategyHints listed; `activeStrategyHint: null`; `execution: 'none'` |

Multiple strategies are declared for future extensibility — none are executed in this stage.
