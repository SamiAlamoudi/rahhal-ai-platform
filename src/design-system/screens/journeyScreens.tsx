/**
 * Premium UI shells — details, booking, trips, profile, system states.
 */

import {
  IconBell,
  IconClock,
  IconHeart,
  IconHome,
  IconPackage,
  IconPlane,
  IconSettings,
  IconUser,
  IconWallet,
} from '../icons/OutlinedIcons'
import {
  DsAvatar,
  DsBottomNav,
  DsButton,
  DsChip,
  DsInput,
  DsSkeleton,
  DsSnackbar,
  DsSurface,
  DsTabs,
  DsText,
} from '../components/primitives'
import { DsDialog } from '../components/overlays'
import {
  DsFlightCard,
  DsHotelCard,
  DsMetaRow,
  DsPackageCard,
  DsPriceCard,
  DsTimeline,
} from '../components/travel'
import {
  DsBookingProgress,
  DsMapExperience,
  DsPremiumEmpty,
  DsTravelIllustration,
  DsTrustStrip,
} from '../components/premium'
import { ScreenFrame } from './ScreenFrame'

export function FlightDetailsScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            Select flight
          </DsButton>
        </div>
      }
    >
      <DsText as="h1" variant="display">
        RUH → DXB
      </DsText>
      <DsMetaRow
        items={[
          { icon: <IconClock />, label: '2h 25m' },
          { icon: <IconPlane />, label: 'Nonstop' },
        ]}
      />
      <DsSurface elevated padding={18}>
        <DsTimeline
          items={[
            { time: '08:40', title: 'Depart Riyadh', detail: 'Terminal 1' },
            { time: '11:05', title: 'Arrive Dubai', detail: 'Terminal 3' },
          ]}
        />
      </DsSurface>
      <DsPriceCard label="Fare" amount="SAR 1,280" note="Includes taxes · seat selection later" />
    </ScreenFrame>
  )
}

export function HotelDetailsScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            Reserve stay
          </DsButton>
        </div>
      }
    >
      <div
        aria-hidden
        style={{
          height: 160,
          margin: '0 -20px',
          background:
            'linear-gradient(145deg, rgba(15,76,117,0.75), rgba(42,157,143,0.5)), #8eb6cc',
        }}
      />
      <DsText as="h1" variant="display">
        Coastal Quiet Hotel
      </DsText>
      <DsText variant="callout" tone="secondary">
        Corniche · sea-facing rooms · calm evenings
      </DsText>
      <div style={{ display: 'flex', gap: 8 }}>
        <DsChip active>Quiet</DsChip>
        <DsChip>Breakfast</DsChip>
        <DsChip>Pool</DsChip>
      </div>
      <DsMapExperience />
      <DsPriceCard amount="SAR 620 / night" note="Free cancellation until Wed" />
    </ScreenFrame>
  )
}

export function PackageDetailsScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            Review package
          </DsButton>
        </div>
      }
    >
      <DsText as="h1" variant="display">
        Marrakech Calm Escape
      </DsText>
      <DsText variant="callout" tone="secondary">
        A composed four-night rhythm — flight, riad, and soft transfer.
      </DsText>
      <DsFlightCard />
      <DsHotelCard name="Riad Light Courtyard" />
      <DsPriceCard amount="SAR 4,900" note="For two · package total" />
    </ScreenFrame>
  )
}

export function BookingReviewScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))', display: 'grid', gap: 12 }}>
          <DsTrustStrip />
          <DsButton fullWidth size="lg">
            Continue to payment
          </DsButton>
        </div>
      }
    >
      <DsBookingProgress step={1} steps={['Review', 'Pay', 'Confirm']} />
      <DsText as="h1" variant="title">
        Review with confidence
      </DsText>
      <DsText variant="callout" tone="secondary">
        Every line is clear before you commit — no surprises.
      </DsText>
      <DsPackageCard />
      <DsSurface padding={16} className="ds-float-card">
        <DsText variant="heading">Travelers</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
          2 adults · details confirmed
        </DsText>
      </DsSurface>
      <DsPriceCard note="Transparent total · taxes included · hold available" />
    </ScreenFrame>
  )
}

export function PaymentScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))', display: 'grid', gap: 12 }}>
          <DsTrustStrip />
          <DsButton fullWidth size="lg" leadingIcon={<IconWallet />}>
            Pay SAR 6,420
          </DsButton>
        </div>
      }
    >
      <DsBookingProgress step={2} steps={['Review', 'Pay', 'Confirm']} />
      <DsText as="h1" variant="title">
        Secure payment
      </DsText>
      <DsText variant="callout" tone="secondary">
        Encrypted checkout shell — reassuring, never technical.
      </DsText>
      <DsInput label="Name on card" placeholder="Placeholder" name="card-name" />
      <DsInput label="Card number" placeholder="•••• •••• •••• ••••" name="card-number" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <DsInput label="Expiry" placeholder="MM/YY" name="exp" />
        <DsInput label="CVC" placeholder="•••" name="cvc" />
      </div>
      <DsPriceCard />
    </ScreenFrame>
  )
}

export function TripTimelineScreen() {
  return (
    <ScreenFrame>
      <DsText as="h1" variant="title">
        Trip timeline
      </DsText>
      <DsTabs
        value="day1"
        items={[
          { id: 'day1', label: 'Day 1' },
          { id: 'day2', label: 'Day 2' },
          { id: 'day3', label: 'Day 3' },
        ]}
      />
      <DsSurface elevated padding={18}>
        <DsTimeline
          items={[
            { time: '09:30', title: 'Arrive', detail: 'Private transfer to riad' },
            { time: '13:00', title: 'Quiet lunch', detail: 'Reservation held nearby' },
            { time: '17:30', title: 'Medina walk', detail: 'Golden hour · unguided' },
          ]}
        />
      </DsSurface>
    </ScreenFrame>
  )
}

export function MyTripsScreen() {
  return (
    <ScreenFrame
      footer={
        <DsBottomNav
          activeId="trips"
          items={[
            { id: 'home', label: 'Home', icon: <IconHome /> },
            { id: 'trips', label: 'Trips', icon: <IconPackage /> },
            { id: 'saved', label: 'Saved', icon: <IconHeart /> },
            { id: 'profile', label: 'You', icon: <IconUser /> },
          ]}
        />
      }
    >
      <DsText as="h1" variant="title">
        My trips
      </DsText>
      <DsTabs
        value="upcoming"
        items={[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past' },
        ]}
      />
      <DsPackageCard title="Dubai calm weekend" nights="3 nights" price="SAR 3,400" />
      <DsPackageCard title="Marrakech Escape" nights="4 nights" price="SAR 4,900" />
    </ScreenFrame>
  )
}

export function SavedScreen() {
  return (
    <ScreenFrame>
      <DsText as="h1" variant="title">
        Saved
      </DsText>
      <DsHotelCard />
      <DsFlightCard />
      <DsPackageCard title="Muscat soft coast" nights="3 nights" price="SAR 2,850" />
    </ScreenFrame>
  )
}

export function NotificationsScreen() {
  return (
    <ScreenFrame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconBell />
        <DsText as="h1" variant="title">
          Notifications
        </DsText>
      </div>
      <DsSurface padding={16}>
        <DsText variant="heading">Price held</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
          Your Dubai fare remains available for 18 hours.
        </DsText>
      </DsSurface>
      <DsSurface padding={16}>
        <DsText variant="heading">Itinerary refined</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
          Rahhal softened Day 2 after your preference for quieter afternoons.
        </DsText>
      </DsSurface>
    </ScreenFrame>
  )
}

export function ProfileScreen() {
  return (
    <ScreenFrame>
      <div className="ds-animate-enter" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DsAvatar initials="س" size={72} alt="Profile" />
        <div>
          <DsText as="h1" variant="display">
            سامي
          </DsText>
          <DsText variant="caption" tone="secondary">
            Calm traveler · Arabic & English
          </DsText>
        </div>
      </div>

      <div
        className="ds-animate-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        {[
          ['12', 'Trips'],
          ['8', 'Countries'],
          ['Gold', 'Loyalty'],
        ].map(([value, label]) => (
          <DsSurface key={label} className="ds-float-card" padding={14} style={{ textAlign: 'center' }}>
            <DsText variant="title">{value}</DsText>
            <DsText variant="micro" tone="tertiary">
              {label}
            </DsText>
          </DsSurface>
        ))}
      </div>

      <DsSurface elevated padding={16} className="ds-float-card">
        <DsText variant="heading">Upcoming</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
          Marrakech · 12 Oct · courtyard week
        </DsText>
      </DsSurface>

      <DsSurface padding={16}>
        <DsText variant="heading">Achievements</DsText>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {['First journey', 'Night owl', 'Coast collector'].map((a) => (
            <DsChip key={a}>{a}</DsChip>
          ))}
        </div>
      </DsSurface>

      <DsSurface padding={16}>
        <DsText variant="heading">Preferences</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
          Quiet hotels · morning flights · aisle seat
        </DsText>
      </DsSurface>
      <DsButton variant="soft" fullWidth leadingIcon={<IconSettings />}>
        Open settings
      </DsButton>
    </ScreenFrame>
  )
}

export function SettingsScreen() {
  return (
    <ScreenFrame>
      <DsText as="h1" variant="title">
        Settings
      </DsText>
      {[
        ['Appearance', 'Light / Dark follows system'],
        ['Language', 'العربية · English'],
        ['Voice', 'Companion microphone sensitivity'],
        ['Privacy', 'Memory & conversation controls'],
      ].map(([title, body]) => (
        <DsSurface key={title} padding={16}>
          <DsText variant="heading">{title}</DsText>
          <DsText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {body}
          </DsText>
        </DsSurface>
      ))}
    </ScreenFrame>
  )
}

export function ErrorStateScreen() {
  return (
    <ScreenFrame>
      <DsPremiumEmpty
        kind="offline"
        title="Something went quiet"
        body="We couldn’t finish that step. Your trip details are safe — take a breath and try again when you’re ready."
        action={<DsButton>Try again</DsButton>}
      />
      <DsDialog
        title="Prefer another path?"
        body="Continue in text while voice settles. Nothing is lost."
        primaryLabel="Continue in chat"
      />
    </ScreenFrame>
  )
}

export function OfflineStateScreen() {
  return (
    <ScreenFrame>
      <DsPremiumEmpty
        kind="offline"
        title="You’re offline"
        body="Saved journeys stay with you. Live search returns the moment you’re connected."
        action={<DsButton variant="soft">View saved</DsButton>}
      />
      <DsSnackbar tone="warning">Waiting for network — calmly</DsSnackbar>
    </ScreenFrame>
  )
}

export function EmptyStateScreen() {
  return (
    <ScreenFrame>
      <DsPremiumEmpty
        kind="empty"
        title="Your atlas is waiting"
        body="Speak to Rahhal when inspiration arrives — your first journey will live here with quiet elegance."
        action={<DsButton>Start a conversation</DsButton>}
      />
    </ScreenFrame>
  )
}

export function LoadingStateScreen() {
  return (
    <ScreenFrame>
      <div style={{ display: 'grid', gap: 16, paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DsTravelIllustration kind="journey" size={48} />
          <div>
            <DsText variant="heading">Composing calm options</DsText>
            <DsText variant="caption" tone="secondary">
              Intelligent skeletons — not restless spinners
            </DsText>
          </div>
        </div>
        <DsSkeleton height={96} radius="var(--ds-radius-lg)" />
        <DsSkeleton height={96} radius="var(--ds-radius-lg)" />
        <DsSkeleton height={160} radius="var(--ds-radius-xl)" />
      </div>
    </ScreenFrame>
  )
}

export function SuccessStateScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            View timeline
          </DsButton>
        </div>
      }
    >
      <DsPremiumEmpty
        kind="success"
        title="You’re set"
        body="Your Marrakech escape is confirmed. The timeline stays clear — celebration, quietly."
      />
      <DsSnackbar tone="success">Saved to My Trips</DsSnackbar>
    </ScreenFrame>
  )
}
