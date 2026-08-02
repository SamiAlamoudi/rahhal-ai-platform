import {
  DsFlightCard,
  DsHotelCard,
  DsPackageCard,
  DsRecommendationCard,
} from '../../design-system/components/travel'
import { DsText } from '../../design-system/components/primitives'
import type { BrainRecommendationsBundle } from '../../brain'
import type { TimelineItem } from '../../brain/timeline/TimelineBuilder'

export function RecommendationDeck({
  recommendations,
  timeline,
}: {
  recommendations: BrainRecommendationsBundle | null
  timeline: TimelineItem[]
}) {
  if (!recommendations) return null
  const flight = recommendations.flights[0]?.item
  const hotel = recommendations.hotels[0]?.item
  const pkg = recommendations.packages[0]?.item

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <DsText variant="heading">Recommendations</DsText>
      {flight ? (
        <DsFlightCard
          from={flight.origin}
          to={flight.destination}
          price={`${flight.currency} ${flight.price.toLocaleString()}`}
          meta={`${flight.airline} · ${flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop`} · ${flight.durationHours}h`}
          time={`${flight.airline}`}
        />
      ) : null}
      {hotel ? (
        <DsHotelCard
          name={hotel.name}
          area={`${hotel.city} · ${hotel.stars}★`}
          price={`${hotel.currency} ${hotel.pricePerNight} / night`}
        />
      ) : null}
      {pkg ? (
        <DsPackageCard
          title={pkg.title}
          nights={`${pkg.nights} nights`}
          price={`${pkg.currency} ${pkg.totalPrice.toLocaleString()}`}
        />
      ) : null}
      {recommendations.activities.slice(0, 1).map((a) => (
        <DsRecommendationCard key={a.id} title={a.title} body={a.body} />
      ))}
      {recommendations.restaurants.slice(0, 1).map((r) => (
        <DsRecommendationCard key={r.id} title={r.title} body={r.body} />
      ))}
      {timeline.length > 0 ? (
        <div className="rh-float-layer" style={{ padding: 14, display: 'grid', gap: 8 }}>
          <DsText variant="micro" tone="primary">
            Timeline
          </DsText>
          {timeline.slice(0, 5).map((item, idx) => (
            <DsText key={`${item.day}-${idx}`} variant="caption" tone="secondary">
              {item.dateLabel} — {item.title}
            </DsText>
          ))}
        </div>
      ) : null}
    </div>
  )
}
