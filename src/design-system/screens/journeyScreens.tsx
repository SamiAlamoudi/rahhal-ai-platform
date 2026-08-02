/**
 * Premium UI shells — details, booking, trips, profile, system states.
 */

import {
  IconBell,
  IconCheck,
  IconClock,
  IconHeart,
  IconHome,
  IconPackage,
  IconPlane,
  IconSettings,
  IconUser,
  IconWallet,
  IconWifiOff,
} from '../icons/OutlinedIcons'
import {
  DsAvatar,
  DsBottomNav,
  DsButton,
  DsChip,
  DsInput,
  DsSkeleton,
  DsSnackbar,
  DsSpinner,
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
  DsStatePanel,
  DsTimeline,
} from '../components/travel'
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
          height: 180,
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
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            Continue to payment
          </DsButton>
        </div>
      }
    >
      <DsText as="h1" variant="title">
        Review
      </DsText>
      <DsPackageCard />
      <DsSurface padding={16}>
        <DsText variant="heading">Travelers</DsText>
        <DsText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
          2 adults · details confirmed
        </DsText>
      </DsSurface>
      <DsPriceCard />
    </ScreenFrame>
  )
}

export function PaymentScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg" leadingIcon={<IconWallet />}>
            Pay SAR 6,420
          </DsButton>
        </div>
      }
    >
      <DsText as="h1" variant="title">
        Payment
      </DsText>
      <DsText variant="callout" tone="secondary">
        Secure checkout shell — no live payment logic in this foundation.
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DsAvatar initials="س" size={64} alt="Profile" />
        <div>
          <DsText as="h1" variant="title">
            سامي
          </DsText>
          <DsText variant="caption" tone="secondary">
            Calm traveler · Arabic & English
          </DsText>
        </div>
      </div>
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
      <DsStatePanel
        icon={<IconWifiOff />}
        title="Something went quiet"
        body="Rahhal could not finish that step. Your trip details are safe — try again when ready."
        action={<DsButton>Try again</DsButton>}
      />
      <DsDialog
        title="Need a different path?"
        body="You can continue in text while we recover voice."
        primaryLabel="Continue in chat"
      />
    </ScreenFrame>
  )
}

export function OfflineStateScreen() {
  return (
    <ScreenFrame>
      <DsStatePanel
        icon={<IconWifiOff />}
        title="You’re offline"
        body="Browse saved trips and recent plans. Live search resumes with connection."
        action={<DsButton variant="soft">View saved</DsButton>}
      />
      <DsSnackbar tone="warning">Waiting for network…</DsSnackbar>
    </ScreenFrame>
  )
}

export function EmptyStateScreen() {
  return (
    <ScreenFrame>
      <DsStatePanel
        icon={<IconPackage />}
        title="No trips yet"
        body="When you’re ready, speak to Rahhal — your first journey will appear here."
        action={<DsButton>Start a conversation</DsButton>}
      />
    </ScreenFrame>
  )
}

export function LoadingStateScreen() {
  return (
    <ScreenFrame>
      <div style={{ display: 'grid', gap: 16, paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DsSpinner label="Loading trip ideas" />
          <DsText variant="callout" tone="secondary">
            Composing calm options…
          </DsText>
        </div>
        <DsSkeleton height={88} radius="var(--ds-radius-lg)" />
        <DsSkeleton height={88} radius="var(--ds-radius-lg)" />
        <DsSkeleton height={140} radius="var(--ds-radius-lg)" />
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
      <DsStatePanel
        icon={<IconCheck />}
        title="You’re set"
        body="Your Marrakech escape is confirmed. Rahhal will keep the timeline clear and quiet."
      />
      <DsSnackbar tone="success">Confirmation saved to My Trips</DsSnackbar>
    </ScreenFrame>
  )
}
