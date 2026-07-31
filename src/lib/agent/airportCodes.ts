/**
 * Shared place → IATA mapping for search / mocks.
 * Never fabricate an IATA by slicing Arabic destination names (e.g. لبنان → لبن).
 */

const PLACE_TO_IATA: Array<{ keys: string[]; code: string }> = [
  { keys: ['tokyo', 'طوكيو', 'japan', 'اليابان'], code: 'HND' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], code: 'KIX' },
  { keys: ['lebanon', 'لبنان', 'beirut', 'بيروت'], code: 'BEY' },
  { keys: ['amman', 'عمّان', 'عمان', 'jordan', 'الأردن', 'الاردن'], code: 'AMM' },
  { keys: ['london', 'لندن'], code: 'LHR' },
  { keys: ['bali', 'بالي'], code: 'DPS' },
  { keys: ['rome', 'روما'], code: 'FCO' },
  { keys: ['paris', 'باريس', 'france', 'فرنسا'], code: 'CDG' },
  { keys: ['dubai', 'دبي'], code: 'DXB' },
  { keys: ['riyadh', 'الرياض'], code: 'RUH' },
  { keys: ['morocco', 'المغرب', 'marrakech', 'مراكش'], code: 'RAK' },
  { keys: ['casablanca', 'الدار البيضاء', 'الدار'], code: 'CMN' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'turkey', 'تركيا'], code: 'IST' },
  { keys: ['cairo', 'القاهرة', 'egypt', 'مصر'], code: 'CAI' },
  { keys: ['maldives', 'المالديف'], code: 'MLE' },
  { keys: ['jeddah', 'جدة'], code: 'JED' },
  { keys: ['new york', 'nyc'], code: 'JFK' },
  { keys: ['singapore'], code: 'SIN' },
  { keys: ['bangkok', 'بانكوك'], code: 'BKK' },
  { keys: ['phuket', 'بوكيت'], code: 'HKT' },
]

const ARABIC_RE = /[\u0600-\u06FF]/

/**
 * Resolve a city/country label to an IATA code.
 * Unknown Latin places may use a 3-letter slice; Arabic unknowns never do.
 */
export function resolveAirportCode(place: string): string {
  const trimmed = (place || '').trim()
  if (!trimmed) return 'XXX'
  if (/^[a-z]{3}$/i.test(trimmed)) return trimmed.toUpperCase()

  const key = trimmed.toLowerCase()
  for (const row of PLACE_TO_IATA) {
    if (row.keys.some((k) => key.includes(k.toLowerCase()) || trimmed.includes(k))) {
      return row.code
    }
  }

  // Never truncate Arabic country/city names into fake IATA (لبنان → لبن).
  if (ARABIC_RE.test(trimmed)) return 'XXX'

  const latin = trimmed.replace(/[^A-Za-z]/g, '')
  if (latin.length >= 3) return latin.slice(0, 3).toUpperCase()
  return 'XXX'
}
