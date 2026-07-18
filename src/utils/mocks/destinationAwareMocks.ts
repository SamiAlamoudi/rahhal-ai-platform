/**
 * Destination-aware mock travel recommendations.
 *
 * When no live provider is connected, recommendations are generated from the
 * parsed TravelSearchRequest (destination + departureCity) instead of static
 * Tokyo/Japan data.
 */

import type { TravelSearchRequest } from '../travelSearchRequest'
import type { FlightOffer } from '../contracts/models/flight'
import type { HotelOffer } from '../contracts/models/hotel'
import type { ActivityOffer, ActivityType } from '../contracts/models/activity'
import type { TransferOffer } from '../contracts/models/transfer'
import type { DestinationInsight, PointOfInterest } from '../contracts/models/destination'
import type { Vehicle } from '../contracts/models/rentalCar'
import type { ProviderSearchResult } from '../searchOrchestrator'
import {
  flightOfferToSearchResult,
  hotelOfferToSearchResult,
  activityOfferToSearchResult,
  transferOfferToSearchResult,
} from '../contracts/bridge/toSearchResult'

// ── Destination catalog ────────────────────────────────────────────────────

interface DestinationProfile {
  /** Canonical display name (city or country). */
  label: string
  country: string
  city: string
  airportCode: string
  airportName: string
  hubAreas: string[]
  timezone: string
  language: string
  localCurrency: string
  attractions: Array<{ name: string; category: ActivityType; location: string }>
  hotels: Array<{ brand: string; area: string; stars: number }>
  pois: PointOfInterest[]
  tips: string[]
}

const DESTINATION_PROFILES: Record<string, DestinationProfile> = {
  japan: {
    label: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    airportCode: 'HND',
    airportName: 'Haneda Airport',
    hubAreas: ['Shinjuku', 'Shibuya', 'Asakusa', 'Odaiba'],
    timezone: 'Asia/Tokyo (UTC+9)',
    language: 'Japanese',
    localCurrency: 'JPY',
    attractions: [
      { name: 'Tokyo Disneyland Family Package', category: 'entertainment', location: 'Maihama, Tokyo' },
      { name: 'Mount Fuji Day Tour', category: 'nature', location: 'Mount Fuji Area' },
      { name: 'Tokyo Cultural City Tour', category: 'culture', location: 'Various, Tokyo' },
    ],
    hotels: [
      { brand: 'Hilton', area: 'Odaiba', stars: 5 },
      { brand: 'Courtyard by Marriott', area: 'Shinjuku', stars: 4 },
      { brand: 'Toyoko Inn', area: 'Asakusa', stars: 3 },
    ],
    pois: [
      { name: 'Senso-ji Temple', category: 'temple', lat: 35.7148, lng: 139.7967, rating: 4.7 },
      { name: 'Tokyo Skytree', category: 'landmark', lat: 35.7101, lng: 139.8107, rating: 4.6 },
      { name: 'Shibuya Crossing', category: 'landmark', lat: 35.6595, lng: 139.7005, rating: 4.5 },
      { name: 'Tsukiji Outer Market', category: 'shopping', lat: 35.6654, lng: 139.7707, rating: 4.4 },
    ],
    tips: [
      'Carry some cash — many shops still prefer it',
      'Trains are the best way to get around Tokyo',
      'Tap water is safe to drink',
    ],
  },
  morocco: {
    label: 'Morocco',
    country: 'Morocco',
    city: 'Marrakech',
    airportCode: 'RAK',
    airportName: 'Marrakech Menara Airport',
    hubAreas: ['Medina', 'Gueliz', 'Hivernage', 'Palmerie'],
    timezone: 'Africa/Casablanca (UTC+1)',
    language: 'Arabic / French',
    localCurrency: 'MAD',
    attractions: [
      { name: 'Jemaa el-Fnaa Evening Experience', category: 'culture', location: 'Medina, Marrakech' },
      { name: 'Atlas Mountains Day Trip', category: 'nature', location: 'High Atlas' },
      { name: 'Majorelle Garden & Medina Walk', category: 'culture', location: 'Gueliz, Marrakech' },
    ],
    hotels: [
      { brand: 'La Mamounia', area: 'Hivernage', stars: 5 },
      { brand: 'Riad Kniza', area: 'Medina', stars: 4 },
      { brand: 'Hotel Toulousain', area: 'Gueliz', stars: 3 },
    ],
    pois: [
      { name: 'Jemaa el-Fnaa', category: 'landmark', lat: 31.6258, lng: -7.9891, rating: 4.7 },
      { name: 'Koutoubia Mosque', category: 'landmark', lat: 31.624, lng: -7.9936, rating: 4.6 },
      { name: 'Majorelle Garden', category: 'park', lat: 31.6417, lng: -8.0031, rating: 4.6 },
      { name: 'Bahia Palace', category: 'museum', lat: 31.6217, lng: -7.9836, rating: 4.5 },
    ],
    tips: [
      'Negotiate politely in souks',
      'Dress modestly in medina areas',
      'Try tagine and mint tea',
    ],
  },
  paris: {
    label: 'Paris',
    country: 'France',
    city: 'Paris',
    airportCode: 'CDG',
    airportName: 'Charles de Gaulle Airport',
    hubAreas: ['Le Marais', 'Montmartre', 'Latin Quarter', 'Champs-Élysées'],
    timezone: 'Europe/Paris (UTC+1)',
    language: 'French',
    localCurrency: 'EUR',
    attractions: [
      { name: 'Louvre Museum Guided Visit', category: 'culture', location: '1st Arrondissement, Paris' },
      { name: 'Seine River Evening Cruise', category: 'entertainment', location: 'Seine, Paris' },
      { name: 'Montmartre Walking Tour', category: 'culture', location: 'Montmartre, Paris' },
    ],
    hotels: [
      { brand: 'Hôtel Plaza Athénée', area: 'Champs-Élysées', stars: 5 },
      { brand: 'Hotel des Grands Boulevards', area: 'Le Marais', stars: 4 },
      { brand: 'Ibis Paris Centre', area: 'Latin Quarter', stars: 3 },
    ],
    pois: [
      { name: 'Eiffel Tower', category: 'landmark', lat: 48.8584, lng: 2.2945, rating: 4.7 },
      { name: 'Louvre Museum', category: 'museum', lat: 48.8606, lng: 2.3376, rating: 4.8 },
      { name: 'Notre-Dame', category: 'landmark', lat: 48.853, lng: 2.3499, rating: 4.7 },
    ],
    tips: [
      'Validate metro tickets before boarding',
      'Book major museums in advance',
      'Many restaurants close between lunch and dinner',
    ],
  },
  london: {
    label: 'London',
    country: 'United Kingdom',
    city: 'London',
    airportCode: 'LHR',
    airportName: 'Heathrow Airport',
    hubAreas: ['Westminster', 'South Bank', 'Shoreditch', 'Kensington'],
    timezone: 'Europe/London (UTC+0)',
    language: 'English',
    localCurrency: 'GBP',
    attractions: [
      { name: 'Westminster Highlights Tour', category: 'culture', location: 'Westminster, London' },
      { name: 'British Museum Visit', category: 'culture', location: 'Bloomsbury, London' },
      { name: 'Thames River Cruise', category: 'entertainment', location: 'South Bank, London' },
    ],
    hotels: [
      { brand: 'The Savoy', area: 'Strand', stars: 5 },
      { brand: 'Premier Inn', area: 'South Bank', stars: 4 },
      { brand: 'Travelodge', area: 'Shoreditch', stars: 3 },
    ],
    pois: [
      { name: 'Big Ben', category: 'landmark', lat: 51.5007, lng: -0.1246, rating: 4.7 },
      { name: 'British Museum', category: 'museum', lat: 51.5194, lng: -0.127, rating: 4.8 },
      { name: 'Tower Bridge', category: 'landmark', lat: 51.5055, lng: -0.0754, rating: 4.7 },
    ],
    tips: [
      'Use an Oyster card or contactless for transit',
      'Stand on the right on escalators',
      'Book popular attractions ahead of weekends',
    ],
  },
  dubai: {
    label: 'Dubai',
    country: 'United Arab Emirates',
    city: 'Dubai',
    airportCode: 'DXB',
    airportName: 'Dubai International Airport',
    hubAreas: ['Downtown', 'Marina', 'Jumeirah', 'Old Dubai'],
    timezone: 'Asia/Dubai (UTC+4)',
    language: 'Arabic / English',
    localCurrency: 'AED',
    attractions: [
      { name: 'Burj Khalifa Observation Deck', category: 'entertainment', location: 'Downtown Dubai' },
      { name: 'Desert Safari Evening', category: 'adventure', location: 'Dubai Desert' },
      { name: 'Dubai Marina Yacht Cruise', category: 'entertainment', location: 'Dubai Marina' },
    ],
    hotels: [
      { brand: 'Address Downtown', area: 'Downtown', stars: 5 },
      { brand: 'Hilton Dubai', area: 'Jumeirah', stars: 4 },
      { brand: 'Rove Downtown', area: 'Downtown', stars: 3 },
    ],
    pois: [
      { name: 'Burj Khalifa', category: 'landmark', lat: 25.1972, lng: 55.2744, rating: 4.8 },
      { name: 'Dubai Mall', category: 'shopping', lat: 25.1985, lng: 55.2796, rating: 4.7 },
      { name: 'Palm Jumeirah', category: 'landmark', lat: 25.1124, lng: 55.139, rating: 4.6 },
    ],
    tips: [
      'Dress modestly in public areas',
      'Friday is the weekly holiday',
      'Metro is efficient for Downtown and Marina',
    ],
  },
  istanbul: {
    label: 'Istanbul',
    country: 'Turkey',
    city: 'Istanbul',
    airportCode: 'IST',
    airportName: 'Istanbul Airport',
    hubAreas: ['Sultanahmet', 'Karaköy', 'Kadıköy', 'Beyoğlu'],
    timezone: 'Europe/Istanbul (UTC+3)',
    language: 'Turkish',
    localCurrency: 'TRY',
    attractions: [
      { name: 'Hagia Sophia & Blue Mosque Tour', category: 'culture', location: 'Sultanahmet, Istanbul' },
      { name: 'Bosphorus Ferry Cruise', category: 'entertainment', location: 'Bosphorus, Istanbul' },
      { name: 'Grand Bazaar Shopping Walk', category: 'shopping', location: 'Beyazıt, Istanbul' },
    ],
    hotels: [
      { brand: 'Four Seasons Sultanahmet', area: 'Sultanahmet', stars: 5 },
      { brand: 'The Stay Boulevard', area: 'Karaköy', stars: 4 },
      { brand: 'Sirkeci Hotel', area: 'Sultanahmet', stars: 3 },
    ],
    pois: [
      { name: 'Hagia Sophia', category: 'landmark', lat: 41.0086, lng: 28.9802, rating: 4.8 },
      { name: 'Blue Mosque', category: 'landmark', lat: 41.0054, lng: 28.9768, rating: 4.7 },
      { name: 'Grand Bazaar', category: 'shopping', lat: 41.0106, lng: 28.968, rating: 4.5 },
    ],
    tips: [
      'Get an Istanbulkart for transit',
      'Try a ferry ride across the Bosphorus',
      'Bargaining is common in bazaars',
    ],
  },
  cairo: {
    label: 'Cairo',
    country: 'Egypt',
    city: 'Cairo',
    airportCode: 'CAI',
    airportName: 'Cairo International Airport',
    hubAreas: ['Zamalek', 'Giza', 'Downtown', 'Islamic Cairo'],
    timezone: 'Africa/Cairo (UTC+2)',
    language: 'Arabic',
    localCurrency: 'EGP',
    attractions: [
      { name: 'Pyramids of Giza Tour', category: 'culture', location: 'Giza, Cairo' },
      { name: 'Egyptian Museum Visit', category: 'culture', location: 'Tahrir, Cairo' },
      { name: 'Nile Dinner Cruise', category: 'entertainment', location: 'Nile Corniche, Cairo' },
    ],
    hotels: [
      { brand: 'Marriott Mena House', area: 'Giza', stars: 5 },
      { brand: 'Cairo Marriott', area: 'Zamalek', stars: 4 },
      { brand: 'Steigenberger Hotel El Tahrir', area: 'Downtown', stars: 4 },
    ],
    pois: [
      { name: 'Great Pyramid of Giza', category: 'landmark', lat: 29.9792, lng: 31.1342, rating: 4.8 },
      { name: 'Egyptian Museum', category: 'museum', lat: 30.0478, lng: 31.2336, rating: 4.6 },
      { name: 'Khan el-Khalili', category: 'shopping', lat: 30.0477, lng: 31.2625, rating: 4.4 },
    ],
    tips: [
      'Hire licensed guides at major sites',
      'Carry small bills for tips',
      'Plan pyramid visits for early morning',
    ],
  },
  bali: {
    label: 'Bali',
    country: 'Indonesia',
    city: 'Ubud',
    airportCode: 'DPS',
    airportName: 'Ngurah Rai International Airport',
    hubAreas: ['Ubud', 'Canggu', 'Seminyak', 'Uluwatu'],
    timezone: 'Asia/Makassar (UTC+8)',
    language: 'Indonesian / English',
    localCurrency: 'IDR',
    attractions: [
      { name: 'Tegallalang Rice Terrace Walk', category: 'nature', location: 'Ubud, Bali' },
      { name: 'Uluwatu Temple Sunset Tour', category: 'culture', location: 'Uluwatu, Bali' },
      { name: 'Canggu Surf Lesson', category: 'adventure', location: 'Canggu, Bali' },
    ],
    hotels: [
      { brand: 'Four Seasons Sayan', area: 'Ubud', stars: 5 },
      { brand: 'Potato Head Suites', area: 'Seminyak', stars: 4 },
      { brand: 'Ubud Village Hotel', area: 'Ubud', stars: 3 },
    ],
    pois: [
      { name: 'Tegallalang Rice Terrace', category: 'park', lat: -8.4312, lng: 115.2793, rating: 4.6 },
      { name: 'Uluwatu Temple', category: 'temple', lat: -8.8291, lng: 115.0849, rating: 4.7 },
      { name: 'Seminyak Beach', category: 'beach', lat: -8.6919, lng: 115.157, rating: 4.5 },
    ],
    tips: [
      'Respect temple dress codes',
      'Scooters are common but drive carefully',
      'Rainy season can affect outdoor plans',
    ],
  },
  maldives: {
    label: 'Maldives',
    country: 'Maldives',
    city: 'Malé',
    airportCode: 'MLE',
    airportName: 'Velana International Airport',
    hubAreas: ['Resort Island', 'House Reef', 'Sandbank'],
    timezone: 'Indian/Maldives (UTC+5)',
    language: 'Dhivehi / English',
    localCurrency: 'MVR',
    attractions: [
      { name: 'House Reef Snorkeling', category: 'beach', location: 'Resort Island' },
      { name: 'Sunset Dolphin Cruise', category: 'nature', location: 'Malé Atoll' },
      { name: 'Sandbank Picnic Experience', category: 'entertainment', location: 'Sandbank' },
    ],
    hotels: [
      { brand: 'Overwater Villa Resort', area: 'North Malé Atoll', stars: 5 },
      { brand: 'Beach Villa Resort', area: 'South Malé Atoll', stars: 4 },
      { brand: 'Island Guesthouse', area: 'Maafushi', stars: 3 },
    ],
    pois: [
      { name: 'House Reef', category: 'beach', lat: 4.1755, lng: 73.5093, rating: 4.8 },
      { name: 'Local Island Market', category: 'shopping', lat: 4.175, lng: 73.509, rating: 4.3 },
    ],
    tips: [
      'Confirm seaplane or speedboat transfers',
      'Reef-safe sunscreen is preferred',
      'Many resorts are all-inclusive',
    ],
  },
  riyadh: {
    label: 'Riyadh',
    country: 'Saudi Arabia',
    city: 'Riyadh',
    airportCode: 'RUH',
    airportName: 'King Khalid International Airport',
    hubAreas: ['Diriyah', 'Olaya', 'Boulevard World', 'Diplomatic Quarter'],
    timezone: 'Asia/Riyadh (UTC+3)',
    language: 'Arabic',
    localCurrency: 'SAR',
    attractions: [
      { name: 'Diriyah Heritage Tour', category: 'culture', location: 'Diriyah, Riyadh' },
      { name: 'Boulevard World Evening', category: 'entertainment', location: 'Boulevard World' },
      { name: 'National Museum Visit', category: 'culture', location: 'Murabba, Riyadh' },
    ],
    hotels: [
      { brand: 'Four Seasons Riyadh', area: 'Olaya', stars: 5 },
      { brand: 'Hilton Riyadh', area: 'Diplomatic Quarter', stars: 4 },
      { brand: 'Holiday Inn Riyadh', area: 'Olaya', stars: 3 },
    ],
    pois: [
      { name: 'Diriyah', category: 'landmark', lat: 24.737, lng: 46.574, rating: 4.7 },
      { name: 'Kingdom Centre', category: 'landmark', lat: 24.7112, lng: 46.6743, rating: 4.5 },
      { name: 'National Museum', category: 'museum', lat: 24.647, lng: 46.711, rating: 4.6 },
    ],
    tips: [
      'Ride-hailing apps work well across the city',
      'Plan outdoor activities for cooler evenings',
      'Many attractions open later in the day',
    ],
  },
  jeddah: {
    label: 'Jeddah',
    country: 'Saudi Arabia',
    city: 'Jeddah',
    airportCode: 'JED',
    airportName: 'King Abdulaziz International Airport',
    hubAreas: ['Historic Jeddah', 'Corniche', 'Al Balad', 'Obhur'],
    timezone: 'Asia/Riyadh (UTC+3)',
    language: 'Arabic',
    localCurrency: 'SAR',
    attractions: [
      { name: 'Al Balad Walking Tour', category: 'culture', location: 'Historic Jeddah' },
      { name: 'Corniche Sunset Walk', category: 'nature', location: 'Jeddah Corniche' },
      { name: 'Red Sea Beach Day', category: 'beach', location: 'Obhur, Jeddah' },
    ],
    hotels: [
      { brand: 'Jeddah Hilton', area: 'Corniche', stars: 5 },
      { brand: 'Rosewood Jeddah', area: 'Corniche', stars: 5 },
      { brand: 'Movenpick Jeddah', area: 'Al Balad', stars: 4 },
    ],
    pois: [
      { name: 'Historic Jeddah', category: 'landmark', lat: 21.4858, lng: 39.1925, rating: 4.6 },
      { name: 'Jeddah Corniche', category: 'park', lat: 21.55, lng: 39.12, rating: 4.5 },
    ],
    tips: [
      'Evenings on the Corniche are popular',
      'Al Balad is best explored on foot',
      'Book Red Sea activities in advance',
    ],
  },
}

const CITY_AIRPORTS: Record<string, { code: string; name: string; label: string }> = {
  riyadh: { code: 'RUH', name: 'King Khalid International Airport', label: 'Riyadh' },
  jeddah: { code: 'JED', name: 'King Abdulaziz International Airport', label: 'Jeddah' },
  dammam: { code: 'DMM', name: 'King Fahd International Airport', label: 'Dammam' },
  dubai: { code: 'DXB', name: 'Dubai International Airport', label: 'Dubai' },
  'abu dhabi': { code: 'AUH', name: 'Abu Dhabi International Airport', label: 'Abu Dhabi' },
  doha: { code: 'DOH', name: 'Hamad International Airport', label: 'Doha' },
  kuwait: { code: 'KWI', name: 'Kuwait International Airport', label: 'Kuwait' },
  cairo: { code: 'CAI', name: 'Cairo International Airport', label: 'Cairo' },
  istanbul: { code: 'IST', name: 'Istanbul Airport', label: 'Istanbul' },
  london: { code: 'LHR', name: 'Heathrow Airport', label: 'London' },
  paris: { code: 'CDG', name: 'Charles de Gaulle Airport', label: 'Paris' },
  tokyo: { code: 'HND', name: 'Haneda Airport', label: 'Tokyo' },
  japan: { code: 'HND', name: 'Haneda Airport', label: 'Tokyo' },
  morocco: { code: 'RAK', name: 'Marrakech Menara Airport', label: 'Marrakech' },
  marrakech: { code: 'RAK', name: 'Marrakech Menara Airport', label: 'Marrakech' },
  casablanca: { code: 'CMN', name: 'Mohammed V International Airport', label: 'Casablanca' },
  bali: { code: 'DPS', name: 'Ngurah Rai International Airport', label: 'Bali' },
  maldives: { code: 'MLE', name: 'Velana International Airport', label: 'Malé' },
  newyork: { code: 'JFK', name: 'John F. Kennedy International Airport', label: 'New York' },
  'new york': { code: 'JFK', name: 'John F. Kennedy International Airport', label: 'New York' },
}

const ARABIC_ALIASES: Record<string, string> = {
  'اليابان': 'japan',
  'طوكيو': 'japan',
  'المغرب': 'morocco',
  'مراكش': 'morocco',
  'الدار البيضاء': 'morocco',
  'باريس': 'paris',
  'فرنسا': 'paris',
  'لندن': 'london',
  'دبي': 'dubai',
  'اسطنبول': 'istanbul',
  'إسطنبول': 'istanbul',
  'تركيا': 'istanbul',
  'القاهرة': 'cairo',
  'مصر': 'cairo',
  'بالي': 'bali',
  'المالديف': 'maldives',
  'مالديف': 'maldives',
  'الرياض': 'riyadh',
  'جدة': 'jeddah',
  'جده': 'jeddah',
  'الدمام': 'dammam',
}

function normalizeKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const arabic = ARABIC_ALIASES[trimmed] ?? ARABIC_ALIASES[trimmed.toLowerCase()]
  if (arabic) return arabic
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'dest'
}

function resolveAirport(raw: string): { code: string; name: string; label: string } {
  const key = normalizeKey(raw)
  if (CITY_AIRPORTS[key]) return CITY_AIRPORTS[key]
  if (DESTINATION_PROFILES[key]) {
    const p = DESTINATION_PROFILES[key]
    return { code: p.airportCode, name: p.airportName, label: p.city }
  }
  // Compact IATA already provided
  if (/^[A-Za-z]{3}$/.test(raw.trim())) {
    const code = raw.trim().toUpperCase()
    return { code, name: `${code} Airport`, label: code }
  }
  const label = raw.trim() || 'Destination'
  const code = label.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX'
  return { code, name: `${label} International Airport`, label }
}

function buildGenericProfile(destination: string): DestinationProfile {
  const airport = resolveAirport(destination)
  const label = destination.trim() || 'Destination'
  const city = airport.label || label
  return {
    label,
    country: label,
    city,
    airportCode: airport.code,
    airportName: airport.name,
    hubAreas: [`Central ${city}`, `${city} Old Town`, `${city} Waterfront`, `${city} District`],
    timezone: 'Local time',
    language: 'Local language',
    localCurrency: 'USD',
    attractions: [
      { name: `${city} Cultural City Tour`, category: 'culture', location: `Various, ${city}` },
      { name: `${city} Nature Day Trip`, category: 'nature', location: `${city} Outskirts` },
      { name: `${city} Family Experience`, category: 'entertainment', location: `Central ${city}` },
    ],
    hotels: [
      { brand: 'Grand Hotel', area: `Central ${city}`, stars: 5 },
      { brand: 'City Suites', area: `${city} Old Town`, stars: 4 },
      { brand: 'Traveler Inn', area: `${city} District`, stars: 3 },
    ],
    pois: [
      { name: `${city} Landmark`, category: 'landmark', lat: 0, lng: 0, rating: 4.5 },
      { name: `${city} Museum`, category: 'museum', lat: 0, lng: 0, rating: 4.4 },
      { name: `${city} Market`, category: 'shopping', lat: 0, lng: 0, rating: 4.3 },
    ],
    tips: [
      `Explore the main districts of ${city}`,
      'Keep arrival day light for jet lag',
      'Confirm local transit options before booking',
    ],
  }
}

export function resolveDestinationProfile(destination: string): DestinationProfile {
  const key = normalizeKey(destination)
  if (DESTINATION_PROFILES[key]) return DESTINATION_PROFILES[key]
  // Country aliases that map to city profiles
  if (key.includes('japan') || key.includes('tokyo')) return DESTINATION_PROFILES.japan
  if (key.includes('morocco') || key.includes('marrakech') || key.includes('casablanca')) {
    return DESTINATION_PROFILES.morocco
  }
  if (key.includes('paris') || key.includes('france')) return DESTINATION_PROFILES.paris
  if (key.includes('london') || key.includes('uk') || key.includes('britain')) {
    return DESTINATION_PROFILES.london
  }
  if (key.includes('dubai') || key.includes('uae')) return DESTINATION_PROFILES.dubai
  if (key.includes('istanbul') || key.includes('turkey')) return DESTINATION_PROFILES.istanbul
  if (key.includes('cairo') || key.includes('egypt')) return DESTINATION_PROFILES.cairo
  if (key.includes('bali') || key.includes('indonesia')) return DESTINATION_PROFILES.bali
  if (key.includes('maldives')) return DESTINATION_PROFILES.maldives
  if (key.includes('riyadh')) return DESTINATION_PROFILES.riyadh
  if (key.includes('jeddah')) return DESTINATION_PROFILES.jeddah
  return buildGenericProfile(destination)
}

export interface TripMockContext {
  destination: string
  departureCity: string
  departureDate: string
  returnDate: string
  durationDays: number
  currency: string
  profile: DestinationProfile
  originAirport: { code: string; name: string; label: string }
  destAirport: { code: string; name: string; label: string }
}

export function buildTripMockContext(
  req: Pick<
    TravelSearchRequest,
    'destination' | 'departureCity' | 'departureDate' | 'returnDate' | 'durationDays' | 'budgetCurrency'
  >,
): TripMockContext {
  const destination = (req.destination || '').trim() || 'Destination'
  const departureCity = (req.departureCity || '').trim() || 'Origin'
  const profile = resolveDestinationProfile(destination)
  return {
    destination,
    departureCity,
    departureDate: req.departureDate || '2026-10-15',
    returnDate: req.returnDate || '',
    durationDays: req.durationDays > 0 ? req.durationDays : 7,
    currency: req.budgetCurrency || 'SAR',
    profile,
    originAirport: resolveAirport(departureCity),
    destAirport: {
      code: profile.airportCode,
      name: profile.airportName,
      label: profile.city,
    },
  }
}

function addDays(isoDate: string, days: number): string {
  const ms = Date.parse(isoDate)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

function addHours(isoLocal: string, hours: number): string {
  const ms = Date.parse(isoLocal)
  if (!Number.isFinite(ms)) return isoLocal
  return new Date(ms + hours * 3_600_000).toISOString().slice(0, 16)
}

// ── Offer builders ─────────────────────────────────────────────────────────

export function buildDestinationAwareFlightOffers(
  req: TravelSearchRequest,
  providerId = 'mock-flight-001',
): FlightOffer[] {
  const ctx = buildTripMockContext(req)
  const origin = ctx.originAirport.code
  const dest = ctx.destAirport.code
  const fromLabel = ctx.originAirport.label
  const toLabel = ctx.profile.city
  const depDate = ctx.departureDate
  const seed = stableHash(`${origin}-${dest}-${depDate}`)
  const basePrice = 3200 + (seed % 2500)
  const durationBase = 300 + (seed % 400)

  const flights: Array<{
    airline: string
    code: string
    number: string
    stops: number
    cabin: 'business' | 'economy'
    priceFactor: number
    durationFactor: number
    baggage: boolean
    cancel: string
  }> = [
    {
      airline: 'Premium Air',
      code: 'PA',
      number: String(100 + (seed % 800)),
      stops: 0,
      cabin: 'business',
      priceFactor: 1.55,
      durationFactor: 1,
      baggage: true,
      cancel: 'free cancellation 24h',
    },
    {
      airline: 'Qatar Airways',
      code: 'QR',
      number: String(200 + (seed % 700)),
      stops: 1,
      cabin: 'economy',
      priceFactor: 1.05,
      durationFactor: 1.35,
      baggage: true,
      cancel: 'non-refundable',
    },
    {
      airline: 'Saudia',
      code: 'SV',
      number: String(300 + (seed % 600)),
      stops: 1,
      cabin: 'economy',
      priceFactor: 0.9,
      durationFactor: 1.45,
      baggage: false,
      cancel: 'free cancellation 48h',
    },
  ]

  return flights.map((f, index) => {
    const price = Math.round(basePrice * f.priceFactor)
    const duration = Math.round(durationBase * f.durationFactor)
    const depHour = 6 + index * 3
    const departure = `${depDate}T${String(depHour).padStart(2, '0')}:00`
    const arrival = addHours(departure, duration / 60)
    const stopLabel = f.stops === 0 ? 'مباشر' : 'توقف واحد'
    const id = `${f.code}-${f.number}`
    return {
      id,
      providerId,
      title: `${f.code} ${f.number}: ${fromLabel} → ${toLabel} (${stopLabel})`,
      currency: ctx.currency,
      price,
      originalPrice: index === 0 ? Math.round(price * 1.15) : index === 1 ? Math.round(price * 1.2) : null,
      rating: 4.7 - index * 0.2,
      familyFriendly: true,
      cancellationPolicy: f.cancel,
      bookingUrl: `https://www.example.com/book/mock-flight/${id}`,
      itinerary: {
        segments: [
          {
            origin,
            destination: dest,
            departure,
            arrival,
            carrier: f.airline,
            flightNumber: `${f.code}${f.number}`,
            aircraft: null,
            cabin: f.cabin,
            durationMinutes: duration,
          },
        ],
        totalDuration: duration,
        stops: f.stops,
        refundable: f.cancel !== 'non-refundable',
        baggageIncluded: f.baggage,
      },
    } satisfies FlightOffer
  })
}

export function buildDestinationAwareHotelOffers(
  req: TravelSearchRequest,
  providerId = 'mock-hotel-001',
): HotelOffer[] {
  const ctx = buildTripMockContext(req)
  const checkIn = ctx.departureDate
  const checkOut = ctx.returnDate || addDays(checkIn, Math.max(1, ctx.durationDays))
  const seed = stableHash(ctx.profile.city)
  const prices = [850, 600, 350].map((p, i) => p + (seed % 80) - i * 10)

  return ctx.profile.hotels.map((hotel, index) => {
    const title = `${hotel.brand} ${ctx.profile.city} ${hotel.area}`
    const id = `${slug(hotel.brand)}-${slug(ctx.profile.city)}-${slug(hotel.area)}`.toUpperCase()
    const family = index < 2
    return {
      id,
      providerId,
      title,
      currency: ctx.currency,
      price: prices[index] ?? 400,
      originalPrice: index === 0 ? Math.round((prices[0] ?? 850) * 1.25) : null,
      rating: 4.8 - index * 0.3,
      hotelStars: hotel.stars,
      location: `${hotel.area}, ${ctx.profile.city}`,
      area: hotel.area,
      checkIn,
      checkOut,
      familyFriendly: family,
      breakfastIncluded: index !== 1,
      freeCancellation: index !== 2,
      amenities: family
        ? ['family-rooms', 'crib', 'pool', 'spa', 'gym', 'wifi']
        : ['wifi', 'restaurant'],
      roomTypes: [
        {
          name: index === 0 ? 'King Suite' : index === 1 ? 'Double Room' : 'Single Room',
          capacity: index === 0 ? 4 : index === 1 ? 3 : 1,
          bedType: index === 0 ? 'king' : index === 1 ? 'double' : 'single',
          count: 1,
        },
      ],
    } satisfies HotelOffer
  })
}

export function buildDestinationAwareActivityOffers(
  req: TravelSearchRequest,
  providerId = 'mock-activity-001',
): ActivityOffer[] {
  const ctx = buildTripMockContext(req)
  const prices = [600, 450, 300]
  const cancels = [
    'free cancellation 72h',
    'free cancellation 48h',
    'free cancellation 24h',
  ]

  return ctx.profile.attractions.map((attraction, index) => {
    const id = `${slug(ctx.profile.city)}-${slug(attraction.name)}`.toUpperCase()
    return {
      id,
      providerId,
      title: attraction.name,
      currency: ctx.currency,
      price: prices[index] ?? 300,
      originalPrice: index === 0 ? Math.round((prices[0] ?? 600) * 1.2) : null,
      rating: 4.9 - index * 0.1,
      location: attraction.location,
      durationMinutes: 480 - index * 60,
      activityType: attraction.category,
      familyFriendly: true,
      cancellationPolicy: cancels[index] ?? 'free cancellation 24h',
      destination: ctx.profile.city,
    } satisfies ActivityOffer
  })
}

export function buildDestinationAwareTransferOffers(
  req: TravelSearchRequest,
  providerId = 'mock-transportation-001',
): TransferOffer[] {
  const ctx = buildTripMockContext(req)
  const airport = ctx.destAirport.code
  const city = ctx.profile.city
  const station = `${city} Station`

  return [
    {
      id: `${airport}-EXPRESS`.toUpperCase(),
      providerId,
      title: `Airport Express — المطار إلى وسط ${city}`,
      currency: ctx.currency,
      price: 120,
      rating: 4.5,
      location: `${ctx.destAirport.name} → ${station}`,
      durationMinutes: 60,
      transferType: 'train',
      origin: airport,
      destination: station,
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 24h',
    },
    {
      id: `PRIVATE-TRANSFER-${slug(city)}`.toUpperCase(),
      providerId,
      title: 'نقل خاص — المطار إلى الفندق',
      currency: ctx.currency,
      price: 280,
      rating: 4.7,
      location: `${ctx.destAirport.name} → Hotel`,
      durationMinutes: 90,
      transferType: 'private-transfer',
      origin: airport,
      destination: 'Hotel',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 12h',
    },
  ]
}

export function buildDestinationAwareInsight(
  req: TravelSearchRequest,
  providerId = 'mock-destination-001',
): DestinationInsight {
  const ctx = buildTripMockContext(req)
  return {
    id: `MOCK-DESTINATION-${slug(ctx.profile.city)}`.toUpperCase(),
    providerId,
    destination: ctx.destination,
    country: ctx.profile.country,
    timezone: ctx.profile.timezone,
    language: ctx.profile.language,
    currency: ctx.profile.localCurrency,
    safetyLevel: 'low',
    pointsOfInterest: ctx.profile.pois,
    travelTips: ctx.profile.tips,
  }
}

export function buildDestinationAwareVehicles(
  req: TravelSearchRequest,
  providerId = 'mock-rental-001',
): Vehicle[] {
  const ctx = buildTripMockContext(req)
  const pickup = `${ctx.destAirport.code} Airport`
  const dropoffDate = ctx.returnDate || addDays(ctx.departureDate, Math.max(1, ctx.durationDays))

  return [
    {
      provider: 'mock',
      providerId,
      company: `${ctx.profile.city} Rent a Car`,
      vehicleName: 'Toyota Corolla',
      category: 'compact',
      transmission: 'automatic',
      fuelType: 'petrol',
      seats: 5,
      doors: 4,
      airConditioning: true,
      luggageLarge: 2,
      luggageSmall: 2,
      price: 180,
      currency: ctx.currency,
      pickupLocation: pickup,
      dropoffLocation: pickup,
      pickupDate: ctx.departureDate,
      dropoffDate,
      unlimitedMileage: true,
      insuranceIncluded: true,
      rating: 4.5,
      image: '',
      bookingUrl: '',
    },
    {
      provider: 'mock',
      providerId,
      company: 'Hertz',
      vehicleName: 'Nissan X-Trail',
      category: 'suv',
      transmission: 'automatic',
      fuelType: 'hybrid',
      seats: 7,
      doors: 5,
      airConditioning: true,
      luggageLarge: 3,
      luggageSmall: 3,
      price: 320,
      currency: ctx.currency,
      pickupLocation: pickup,
      dropoffLocation: pickup,
      pickupDate: ctx.departureDate,
      dropoffDate,
      unlimitedMileage: false,
      insuranceIncluded: false,
      rating: 4.3,
      image: '',
      bookingUrl: '',
    },
    {
      provider: 'mock',
      providerId,
      company: 'Avis',
      vehicleName: 'Mercedes C-Class',
      category: 'luxury',
      transmission: 'automatic',
      fuelType: 'diesel',
      seats: 5,
      doors: 4,
      airConditioning: true,
      luggageLarge: 2,
      luggageSmall: 2,
      price: 550,
      currency: ctx.currency,
      pickupLocation: `${ctx.profile.city} Station`,
      dropoffLocation: pickup,
      pickupDate: ctx.departureDate,
      dropoffDate,
      unlimitedMileage: true,
      insuranceIncluded: true,
      rating: 4.8,
      image: '',
      bookingUrl: '',
    },
  ]
}

// ── ProviderSearchResult adapters (for searchOrchestrator / providers/) ────

function withProviderName(
  result: ProviderSearchResult,
  providerName: string,
  description: string,
): ProviderSearchResult {
  return { ...result, providerName, description }
}

export function buildDestinationAwareFlightSearchResults(
  req: TravelSearchRequest,
  providerName = 'Mock Flight Provider',
): ProviderSearchResult[] {
  return buildDestinationAwareFlightOffers(req).map((offer) => {
    const seg = offer.itinerary.segments[0]
    const stopLabel = offer.itinerary.stops === 0 ? 'مباشر' : 'توقف واحد'
    return withProviderName(
      flightOfferToSearchResult(offer),
      providerName,
      `رحلة ${stopLabel} على ${seg?.carrier ?? 'airline'} درجة ${seg?.cabin ?? 'economy'}`,
    )
  })
}

export function buildDestinationAwareHotelSearchResults(
  req: TravelSearchRequest,
  providerName = 'Mock Hotel Provider',
): ProviderSearchResult[] {
  return buildDestinationAwareHotelOffers(req).map((offer) =>
    withProviderName(
      hotelOfferToSearchResult(offer),
      providerName,
      `فندق ${offer.hotelStars} نجوم في ${offer.area ?? offer.location}`,
    ),
  )
}

export function buildDestinationAwareActivitySearchResults(
  req: TravelSearchRequest,
  providerName = 'Mock Activity Provider',
): ProviderSearchResult[] {
  return buildDestinationAwareActivityOffers(req).map((offer) =>
    withProviderName(
      activityOfferToSearchResult(offer),
      providerName,
      `${offer.title} في ${offer.destination}`,
    ),
  )
}

export function buildDestinationAwareTransferSearchResults(
  req: TravelSearchRequest,
  providerName = 'Mock Transportation Provider',
): ProviderSearchResult[] {
  return buildDestinationAwareTransferOffers(req).map((offer) =>
    withProviderName(
      transferOfferToSearchResult(offer),
      providerName,
      `${offer.title}`,
    ),
  )
}
