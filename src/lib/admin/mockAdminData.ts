export type AdminUserStatus = 'active' | 'suspended' | 'pending'
export type AdminUserRole = 'user' | 'admin'

export interface AdminUserRecord {
  id: string
  email: string
  fullName: string
  role: AdminUserRole
  status: AdminUserStatus
  createdAt: string
  lastSignInAt: string | null
}

export type AdminTripStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface AdminTripRecord {
  id: string
  userEmail: string
  title: string
  destination: string
  status: AdminTripStatus
  itemCount: number
  createdAt: string
}

export type AdminBookingStatus =
  | 'draft'
  | 'ready'
  | 'redirected'
  | 'confirmed'
  | 'expired'
  | 'cancelled'

export interface AdminBookingRecord {
  id: string
  userEmail: string
  destination: string
  status: AdminBookingStatus
  total: number
  currency: string
  createdAt: string
}

export type AdminPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled'

/** Read-only mock payment row — never from Moyasar/Stripe live APIs. */
export interface AdminPaymentRecord {
  id: string
  orderNumber: string
  userEmail: string
  amount: number
  currency: string
  status: AdminPaymentStatus
  provider: 'mock'
  createdAt: string
}

export const ADMIN_USER_STATUS_LABELS: Record<AdminUserStatus, string> = {
  active: 'نشط',
  suspended: 'موقوف',
  pending: 'بانتظار التفعيل',
}

export const ADMIN_TRIP_STATUS_LABELS: Record<AdminTripStatus, string> = {
  draft: 'مسودة',
  active: 'نشطة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}

export const ADMIN_BOOKING_STATUS_LABELS: Record<AdminBookingStatus, string> = {
  draft: 'مسودة',
  ready: 'جاهز',
  redirected: 'تم التوجيه',
  confirmed: 'مؤكد',
  expired: 'منتهي',
  cancelled: 'ملغي',
}

export const ADMIN_PAYMENT_STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  pending: 'بانتظار الدفع',
  paid: 'مدفوع',
  failed: 'فشل',
  refunded: 'مسترد',
  cancelled: 'ملغي',
}

export function getMockAdminUsers(): AdminUserRecord[] {
  return [
    {
      id: 'usr-1001',
      email: 'sara@example.com',
      fullName: 'سارة الأحمد',
      role: 'user',
      status: 'active',
      createdAt: '2026-05-12T09:20:00.000Z',
      lastSignInAt: '2026-07-14T18:10:00.000Z',
    },
    {
      id: 'usr-1002',
      email: 'omar@example.com',
      fullName: 'عمر الدوسري',
      role: 'user',
      status: 'active',
      createdAt: '2026-04-03T11:00:00.000Z',
      lastSignInAt: '2026-07-13T08:45:00.000Z',
    },
    {
      id: 'usr-1003',
      email: 'admin@rahhal.app',
      fullName: 'مدير النظام',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-15T10:00:00.000Z',
      lastSignInAt: '2026-07-15T07:00:00.000Z',
    },
    {
      id: 'usr-1004',
      email: 'lina@example.com',
      fullName: 'لينا العتيبي',
      role: 'user',
      status: 'pending',
      createdAt: '2026-07-10T14:30:00.000Z',
      lastSignInAt: null,
    },
    {
      id: 'usr-1005',
      email: 'khaled@example.com',
      fullName: 'خالد المالكي',
      role: 'user',
      status: 'suspended',
      createdAt: '2026-03-22T16:15:00.000Z',
      lastSignInAt: '2026-06-01T12:00:00.000Z',
    },
    {
      id: 'usr-1006',
      email: 'noura@example.com',
      fullName: 'نورة القحطاني',
      role: 'user',
      status: 'active',
      createdAt: '2026-02-18T08:40:00.000Z',
      lastSignInAt: '2026-07-12T21:05:00.000Z',
    },
    {
      id: 'usr-1007',
      email: 'faisal@example.com',
      fullName: 'فيصل الشمري',
      role: 'user',
      status: 'active',
      createdAt: '2026-06-05T13:25:00.000Z',
      lastSignInAt: '2026-07-11T09:55:00.000Z',
    },
    {
      id: 'usr-1008',
      email: 'hind@example.com',
      fullName: 'هند الزهراني',
      role: 'user',
      status: 'pending',
      createdAt: '2026-07-14T19:00:00.000Z',
      lastSignInAt: null,
    },
  ]
}

export function getMockAdminTrips(): AdminTripRecord[] {
  return [
    {
      id: 'trip-2001',
      userEmail: 'sara@example.com',
      title: 'طوكيو صيف 2026',
      destination: 'Japan',
      status: 'active',
      itemCount: 4,
      createdAt: '2026-07-01T10:00:00.000Z',
    },
    {
      id: 'trip-2002',
      userEmail: 'omar@example.com',
      title: 'دبي عطلة نهاية الأسبوع',
      destination: 'Dubai',
      status: 'completed',
      itemCount: 2,
      createdAt: '2026-06-18T12:30:00.000Z',
    },
    {
      id: 'trip-2003',
      userEmail: 'noura@example.com',
      title: 'إسطنبول الربيع',
      destination: 'Turkey',
      status: 'draft',
      itemCount: 1,
      createdAt: '2026-07-08T09:15:00.000Z',
    },
    {
      id: 'trip-2004',
      userEmail: 'faisal@example.com',
      title: 'باريس عائلية',
      destination: 'France',
      status: 'cancelled',
      itemCount: 3,
      createdAt: '2026-05-20T15:45:00.000Z',
    },
    {
      id: 'trip-2005',
      userEmail: 'sara@example.com',
      title: 'بانكوك استكشاف',
      destination: 'Thailand',
      status: 'active',
      itemCount: 5,
      createdAt: '2026-07-12T07:20:00.000Z',
    },
    {
      id: 'trip-2006',
      userEmail: 'khaled@example.com',
      title: 'القاهرة الثقافية',
      destination: 'Egypt',
      status: 'completed',
      itemCount: 2,
      createdAt: '2026-04-11T11:10:00.000Z',
    },
    {
      id: 'trip-2007',
      userEmail: 'omar@example.com',
      title: 'لندن عمل',
      destination: 'UK',
      status: 'draft',
      itemCount: 0,
      createdAt: '2026-07-14T16:00:00.000Z',
    },
  ]
}

export function getMockAdminBookings(): AdminBookingRecord[] {
  return [
    {
      id: 'bk-3001',
      userEmail: 'sara@example.com',
      destination: 'Japan',
      status: 'confirmed',
      total: 8420,
      currency: 'SAR',
      createdAt: '2026-07-02T11:00:00.000Z',
    },
    {
      id: 'bk-3002',
      userEmail: 'omar@example.com',
      destination: 'Dubai',
      status: 'ready',
      total: 2100,
      currency: 'SAR',
      createdAt: '2026-06-19T09:40:00.000Z',
    },
    {
      id: 'bk-3003',
      userEmail: 'noura@example.com',
      destination: 'Turkey',
      status: 'draft',
      total: 0,
      currency: 'SAR',
      createdAt: '2026-07-08T10:00:00.000Z',
    },
    {
      id: 'bk-3004',
      userEmail: 'faisal@example.com',
      destination: 'France',
      status: 'cancelled',
      total: 5400,
      currency: 'SAR',
      createdAt: '2026-05-21T08:15:00.000Z',
    },
    {
      id: 'bk-3005',
      userEmail: 'sara@example.com',
      destination: 'Thailand',
      status: 'redirected',
      total: 3650,
      currency: 'SAR',
      createdAt: '2026-07-12T18:30:00.000Z',
    },
    {
      id: 'bk-3006',
      userEmail: 'lina@example.com',
      destination: 'Malaysia',
      status: 'expired',
      total: 1900,
      currency: 'SAR',
      createdAt: '2026-07-01T14:00:00.000Z',
    },
  ]
}

/** Static demo payments — provider always mock; no live PSP calls. */
export function getMockAdminPayments(): AdminPaymentRecord[] {
  return [
    {
      id: 'pay-4001',
      orderNumber: 'RH-20260712-A1B2C',
      userEmail: 'sara@example.com',
      amount: 8420,
      currency: 'SAR',
      status: 'paid',
      provider: 'mock',
      createdAt: '2026-07-02T11:05:00.000Z',
    },
    {
      id: 'pay-4002',
      orderNumber: 'RH-20260619-D3E4F',
      userEmail: 'omar@example.com',
      amount: 2100,
      currency: 'SAR',
      status: 'pending',
      provider: 'mock',
      createdAt: '2026-06-19T09:45:00.000Z',
    },
    {
      id: 'pay-4003',
      orderNumber: 'RH-20260521-G5H6I',
      userEmail: 'faisal@example.com',
      amount: 5400,
      currency: 'SAR',
      status: 'refunded',
      provider: 'mock',
      createdAt: '2026-05-22T10:00:00.000Z',
    },
    {
      id: 'pay-4004',
      orderNumber: 'RH-20260712-J7K8L',
      userEmail: 'sara@example.com',
      amount: 3650,
      currency: 'SAR',
      status: 'failed',
      provider: 'mock',
      createdAt: '2026-07-12T18:35:00.000Z',
    },
    {
      id: 'pay-4005',
      orderNumber: 'RH-20260701-M9N0O',
      userEmail: 'lina@example.com',
      amount: 1900,
      currency: 'SAR',
      status: 'cancelled',
      provider: 'mock',
      createdAt: '2026-07-01T14:10:00.000Z',
    },
    {
      id: 'pay-4006',
      orderNumber: 'RH-20260710-P1Q2R',
      userEmail: 'noura@example.com',
      amount: 2750,
      currency: 'SAR',
      status: 'paid',
      provider: 'mock',
      createdAt: '2026-07-10T16:20:00.000Z',
    },
  ]
}

export function summarizeMockPayments(payments: AdminPaymentRecord[]) {
  const paid = payments.filter((p) => p.status === 'paid')
  return {
    totalPayments: payments.length,
    paidCount: paid.length,
    pendingCount: payments.filter((p) => p.status === 'pending').length,
    failedCount: payments.filter((p) => p.status === 'failed').length,
    refundedCount: payments.filter((p) => p.status === 'refunded').length,
    totalRevenue: paid.reduce((sum, p) => sum + p.amount, 0),
  }
}
