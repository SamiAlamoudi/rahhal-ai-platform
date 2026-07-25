/**
 * Integration Sprint 5 — destination knowledge (cities / regions / seasonality / culture).
 * Additive overlays; reuses catalog ids where possible.
 */

import type { DestinationCulture, DestinationKnowledge, DestinationTheme } from './types'

function culture(partial: DestinationCulture): DestinationCulture {
  return partial
}

function knowledge(entry: DestinationKnowledge): DestinationKnowledge {
  return entry
}

const GCC_CULTURE_HINT = culture({
  language: 'Arabic / English',
  currency: 'AED',
  dressCodeEn: 'Modest dress in malls and public areas; beachwear at resorts.',
  dressCodeAr: 'لباس محتشم في الأماكن العامة؛ ملابس الشاطئ في المنتجعات.',
  safetyEn: 'Generally very safe for families and solo travelers.',
  safetyAr: 'آمنة عموماً للعائلات والمسافرين المنفردين.',
  etiquetteEn: 'Be polite in queues; avoid public displays of affection.',
  etiquetteAr: 'الهدوء في الطوابير؛ تجنب إظهار العاطفة علناً.',
  businessCustomsEn: 'Punctual meetings; business-casual often accepted.',
  businessCustomsAr: 'الالتزام بالمواعيد؛ لباس عمل شبه رسمي مقبول غالباً.',
  weekendDays: 'Saturday–Sunday',
  publicHolidaysNoteEn: 'Ramadan and National Day affect hours.',
  publicHolidaysNoteAr: 'رمضان واليوم الوطني يؤثران على المواعيد.',
})

/** Curated advisor knowledge — not an encyclopedia dump. */
export const DESTINATION_KNOWLEDGE: DestinationKnowledge[] = [
  knowledge({
    id: 'casablanca',
    kind: 'city',
    nameEn: 'Casablanca',
    nameAr: 'الدار البيضاء',
    country: 'Morocco',
    region: 'North Africa',
    neighborhoods: ['Corniche', 'Maarif', 'Habous', 'Anfa'],
    themes: ['business', 'culture', 'food', 'city'],
    seasonality: {
      bestMonths: [3, 4, 5, 9, 10, 11],
      avoidMonths: [7, 8],
      noteEn: 'Spring and autumn are most comfortable; summer can be humid.',
      noteAr: 'الربيع والخريف الأجمل؛ الصيف قد يكون رطباً.',
    },
    culture: culture({
      language: 'Arabic / French',
      currency: 'MAD',
      dressCodeEn: 'Smart-casual; modest in traditional areas.',
      dressCodeAr: 'أنيق عملي؛ محتشم في الأحياء التقليدية.',
      safetyEn: 'Use official taxis at night; keep valuables discreet.',
      safetyAr: 'استخدم تاكسي رسمي ليلاً؛ احفظ مقتنياتك.',
      etiquetteEn: 'French greetings help; bargaining is for souks, not hotels.',
      etiquetteAr: 'التحية بالفرنسية مفيدة؛ المساومة في الأسواق لا الفنادق.',
      businessCustomsEn: 'Business hubs around Anfa / city center; schedule buffer for traffic.',
      businessCustomsAr: 'مراكز الأعمال حول أنفا/الوسط؛ احسب زحمة السير.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Friday prayers slow midday business.',
      publicHolidaysNoteAr: 'صلاة الجمعة تبطئ الأعمال ظهراً.',
    }),
    prosEn: ['Strong business + coastal vibe', 'Gateway for Morocco itineraries', 'Excellent seafood'],
    prosAr: ['مزيج أعمال وساحل', 'بوابة لمسارات المغرب', 'مأكولات بحرية ممتازة'],
    consEn: ['Less “postcard medina” than Marrakech', 'Traffic'],
    consAr: ['أقل سحراً بصرياً من مراكش', 'ازدحام'],
    hiddenTipsEn: ['Sunset walk on the Corniche', 'Visit Hassan II Mosque early'],
    hiddenTipsAr: ['مشية الغروب على الكورنيش', 'مسجد الحسن الثاني مبكراً'],
    touristTrapAvoidEn: ['Overpriced airport taxis without meter', 'Rushing past Habous artisan quarter'],
    touristTrapAvoidAr: ['تاكسي المطار الغالي بدون عداد', 'تفويت حي الأحباس للحرف'],
    dailyBudgetSar: { low: 380, mid: 620, high: 1050 },
    flightHoursFromRiyadh: 7,
  }),
  knowledge({
    id: 'marrakech',
    kind: 'city',
    nameEn: 'Marrakech',
    nameAr: 'مراكش',
    country: 'Morocco',
    region: 'North Africa',
    neighborhoods: ['Medina', 'Gueliz', 'Hivernage', 'Palmeriae'],
    themes: ['culture', 'food', 'adventure', 'luxury'],
    seasonality: {
      bestMonths: [3, 4, 5, 10, 11],
      avoidMonths: [7, 8],
      noteEn: 'Avoid peak summer heat in the medina.',
      noteAr: 'تجنّب ذروة حر الصيف في المدينة القديمة.',
    },
    culture: culture({
      language: 'Arabic / French / Amazigh',
      currency: 'MAD',
      dressCodeEn: 'Cover shoulders in medina; comfortable shoes.',
      dressCodeAr: 'غطِّ الكتفين في المدينة القديمة؛ حذاء مريح.',
      safetyEn: 'Busy squares — agree taxi fares before riding.',
      safetyAr: 'الساحات مزدحمة — اتفق على الأجرة قبل الركوب.',
      etiquetteEn: 'Ask before photos of people; soft bargaining.',
      etiquetteAr: 'استأذن قبل التصوير؛ مساومة لطيفة.',
      businessCustomsEn: 'More leisure than corporate — meetings often late morning.',
      businessCustomsAr: 'أجواء ترفيه أكثر من أعمال — اجتماعات غالباً صباحاً متأخراً.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Ramadan evenings transform Jemaa el-Fnaa.',
      publicHolidaysNoteAr: 'أمسيات رمضان تغيّر جامع الفنا.',
    }),
    prosEn: ['Iconic souks & riads', 'Day trips to Atlas / desert', 'Rich food scene'],
    prosAr: ['أسواق ورياض أيقونية', 'رحلات للأطلس/الصحراء', 'مطبخ غني'],
    consEn: ['Can feel intense for first-timers', 'Summer heat'],
    consAr: ['قد تكون مزدحمة للمبتدئين', 'حر الصيف'],
    hiddenTipsEn: ['Stay a night in a quiet riad side street', 'Sunrise at Majorelle area'],
    hiddenTipsAr: ['ليلة في رياض بهدوء', 'شروق قرب حديقة ماجوريل'],
    touristTrapAvoidEn: ['Aggressive “guides” at square edges', 'Fake argan stalls'],
    touristTrapAvoidAr: ['مرشدون مزعجون حول الساحة', 'أكشاك أرغان مبالغ فيها'],
    dailyBudgetSar: { low: 400, mid: 650, high: 1100 },
    flightHoursFromRiyadh: 7,
  }),
  knowledge({
    id: 'paris',
    kind: 'city',
    nameEn: 'Paris',
    nameAr: 'باريس',
    country: 'France',
    region: 'Europe',
    neighborhoods: ['Le Marais', 'Saint-Germain', 'Montmartre', 'Latin Quarter'],
    themes: ['culture', 'food', 'shopping', 'romance', 'luxury'],
    seasonality: {
      bestMonths: [4, 5, 6, 9, 10],
      avoidMonths: [8],
      noteEn: 'Shoulder seasons beat August crowds.',
      noteAr: 'مواسم الكتف أفضل من زحام أغسطس.',
    },
    culture: culture({
      language: 'French / English',
      currency: 'EUR',
      dressCodeEn: 'Smart casual; avoid athletic wear in fine restaurants.',
      dressCodeAr: 'أنيق عملي؛ تجنّب الرياضي في المطاعم الراقية.',
      safetyEn: 'Watch pickpockets on metro lines 1/4 and near landmarks.',
      safetyAr: 'انتبه للنشل في المترو والمعالم.',
      etiquetteEn: 'Greet with bonjour before asking; tip modestly.',
      etiquetteAr: 'حيِّ بـ bonjour قبل السؤال؛ بقشيش بسيط.',
      businessCustomsEn: 'Formal emails; lunch meetings common.',
      businessCustomsAr: 'رسائل رسمية؛ غداء عمل شائع.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Many shops close Sundays outside tourist cores.',
      publicHolidaysNoteAr: 'كثير من المحلات تغلق الأحد خارج مناطق السياح.',
    }),
    prosEn: ['World-class museums', 'Food & fashion', 'Walkable arrondissements'],
    prosAr: ['متاحف عالمية', 'طعام وأزياء', 'أحياء مشّاية'],
    consEn: ['Schengen visa + cost', 'Crowds at icons'],
    consAr: ['تأشيرة شنغن وتكلفة', 'ازدحام المعالم'],
    hiddenTipsEn: ['Picnic along Canal Saint-Martin', 'Museum pass for 2–3 days'],
    hiddenTipsAr: ['نزهة على قناة سان مارتن', 'بطاقة متاحف ليومين–ثلاثة'],
    touristTrapAvoidEn: ['Eiffel picnic scams', 'Restaurant touts near Sacré-Cœur'],
    touristTrapAvoidAr: ['احتيالات نزهة برج إيفل', 'مندوبو مطاعم قرب الساكري كور'],
    dailyBudgetSar: { low: 850, mid: 1350, high: 2100 },
    flightHoursFromRiyadh: 7,
  }),
  knowledge({
    id: 'rome',
    kind: 'city',
    nameEn: 'Rome',
    nameAr: 'روما',
    country: 'Italy',
    region: 'Europe',
    neighborhoods: ['Trastevere', 'Centro Storico', 'Prati', 'Monti'],
    themes: ['culture', 'food', 'family', 'romance'],
    seasonality: {
      bestMonths: [4, 5, 6, 9, 10],
      avoidMonths: [7, 8],
      noteEn: 'Spring/autumn for ruins without extreme heat.',
      noteAr: 'الربيع/الخريف للآثار بدون حر قاسٍ.',
    },
    culture: culture({
      language: 'Italian / English',
      currency: 'EUR',
      dressCodeEn: 'Cover shoulders/knees in churches.',
      dressCodeAr: 'غطِّ الكتفين والركب في الكنائس.',
      safetyEn: 'Crowded transit — secure bags; skip unofficial taxis.',
      safetyAr: 'ازدحام المواصلات — احفظ الحقائب؛ تجنّب التاكسي غير الرسمي.',
      etiquetteEn: 'Coperto is normal; espresso standing is local style.',
      etiquetteAr: 'رسوم الخدمة معتادة؛ إسبريسو واقفاً أسلوب محلي.',
      businessCustomsEn: 'Relationship-first; expect longer lunches.',
      businessCustomsAr: 'العلاقات أولاً؛ غداء أطول متوقع.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Ferragosto (mid-August) empties the city.',
      publicHolidaysNoteAr: 'فيرأغوستو (منتصف أغسطس) يفرّغ المدينة.',
    }),
    prosEn: ['Layered history in walkable core', 'Incredible casual food', 'Day trips to Tivoli / coast'],
    prosAr: ['تاريخ كثيف في مركز مشّاء', 'طعام يومي رائع', 'رحلات لتيفولي/الساحل'],
    consEn: ['Heat + queues in summer', 'Schengen logistics'],
    consAr: ['حر وطوابير صيفاً', 'لوجستيات شنغن'],
    hiddenTipsEn: ['Early Colosseum slot', 'Aperitivo in Monti'],
    hiddenTipsAr: ['موعد كولوسيوم مبكر', 'أبيريتيفو في مونتي'],
    touristTrapAvoidEn: ['Gladiator photo hustlers', 'Menu-tourist traps near Vatican exit'],
    touristTrapAvoidAr: ['مصورو المصارعين', 'قوائم سياحية عند خروج الفاتيكان'],
    dailyBudgetSar: { low: 700, mid: 1100, high: 1800 },
    flightHoursFromRiyadh: 6.5,
  }),
  knowledge({
    id: 'tokyo',
    kind: 'city',
    nameEn: 'Tokyo',
    nameAr: 'طوكيو',
    country: 'Japan',
    region: 'East Asia',
    neighborhoods: ['Shinjuku', 'Shibuya', 'Asakusa', 'Ginza', 'Odaiba'],
    themes: ['culture', 'food', 'shopping', 'city', 'family'],
    seasonality: {
      bestMonths: [3, 4, 5, 10, 11],
      avoidMonths: [6, 8],
      noteEn: 'Cherry blossom & autumn color are peak; rainy June / humid August.',
      noteAr: 'الربيع والخريف الأجمل؛ يونيو ممطر وأغسطس رطب.',
    },
    culture: culture({
      language: 'Japanese / English (tourist zones)',
      currency: 'JPY',
      dressCodeEn: 'Neat casual; remove shoes indoors when asked.',
      dressCodeAr: 'عملي أنيق؛ اخلع الحذاء داخل المنازل عند الطلب.',
      safetyEn: 'Extremely safe; still keep IC card and cash handy.',
      safetyAr: 'آمنة جداً؛ احتفظ ببطاقة المواصلات ونقد.',
      etiquetteEn: 'Quiet trains; no eating while walking in many areas.',
      etiquetteAr: 'هدوء في القطار؛ تجنّب الأكل أثناء المشي غالباً.',
      businessCustomsEn: 'Punctuality critical; exchange cards with care.',
      businessCustomsAr: 'الالتزام بالوقت حاسم؛ تبادل البطاقات بأدب.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Golden Week is crowded and pricey.',
      publicHolidaysNoteAr: 'الأسبوع الذهبي مزدحم وغالي.',
    }),
    prosEn: ['Transit excellence', 'Food from bowls to Michelin', 'Neighborhood variety'],
    prosAr: ['مواصلات ممتازة', 'طعام من بسيط إلى فاخر', 'تنوع أحياء'],
    consEn: ['Long haul + visa for many', 'Language barrier outside hubs'],
    consAr: ['رحلة طويلة وتأشيرة', 'حاجز لغة خارج المراكز'],
    hiddenTipsEn: ['IC card day-one', 'Early Tsukiji outer market'],
    hiddenTipsAr: ['بطاقة IC من أول يوم', 'سوق تسوكيجي الخارجي مبكراً'],
    touristTrapAvoidEn: ['Overpriced “airport sim” stalls', 'Rush-hour Shibuya scramble photos only'],
    touristTrapAvoidAr: ['شرائح مطار مبالغ فيها', 'الاكتفاء بصور شيبويا في الذروة'],
    dailyBudgetSar: { low: 700, mid: 1100, high: 1800 },
    flightHoursFromRiyadh: 12,
  }),
  knowledge({
    id: 'seoul',
    kind: 'city',
    nameEn: 'Seoul',
    nameAr: 'سيول',
    country: 'South Korea',
    region: 'East Asia',
    neighborhoods: ['Myeongdong', 'Hongdae', 'Gangnam', 'Bukchon', 'Itaewon'],
    themes: ['shopping', 'food', 'culture', 'city', 'family'],
    seasonality: {
      bestMonths: [4, 5, 9, 10],
      avoidMonths: [7, 8],
      noteEn: 'Spring blossoms & autumn foliage; humid rainy summer.',
      noteAr: 'زهور الربيع وألوان الخريف؛ صيف رطب ممطر.',
    },
    culture: culture({
      language: 'Korean / English (tourist zones)',
      currency: 'KRW',
      dressCodeEn: 'Trendy casual; temples require modest cover.',
      dressCodeAr: 'عملي عصري؛ المعابد تتطلب احتشاماً.',
      safetyEn: 'Very safe; late-night metro is common.',
      safetyAr: 'آمنة جداً؛ المترو الليلي شائع.',
      etiquetteEn: 'Two-hand exchanges; remove shoes in traditional spaces.',
      etiquetteAr: 'التسليم باليدين؛ اخلع الحذاء في الأماكن التقليدية.',
      businessCustomsEn: 'Hierarchy matters; after-work dinners build trust.',
      businessCustomsAr: 'التسلسل مهم؛ عشاء بعد العمل يبني الثقة.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Chuseok / Seollal shut many shops.',
      publicHolidaysNoteAr: 'تشوسيوك/سوللال يغلقان كثيراً من المحلات.',
    }),
    prosEn: ['K-culture + shopping', 'Palaces beside modern towers', 'Superb transit'],
    prosAr: ['ثقافة كورية وتسوق', 'قصور بجانب ناطحات', 'مواصلات ممتازة'],
    consEn: ['Air quality days', 'Spicy-food learning curve'],
    consAr: ['أيام جودة هواء', 'تأقلم مع الطعام الحار'],
    hiddenTipsEn: ['Han river sunset bike', 'Palace with hanbok rental nearby'],
    hiddenTipsAr: ['دراجة غروب نهر هان', 'قصر مع تأجير هانبوك قريب'],
    touristTrapAvoidEn: ['Street “free” portrait upsells', 'Fake luxury in alley stalls'],
    touristTrapAvoidAr: ['عروض صور مجانية ثم بيع', 'ماركات مقلدة في الأزقة'],
    dailyBudgetSar: { low: 550, mid: 900, high: 1500 },
    flightHoursFromRiyadh: 11,
  }),
  knowledge({
    id: 'dubai',
    kind: 'city',
    nameEn: 'Dubai',
    nameAr: 'دبي',
    country: 'UAE',
    region: 'GCC',
    neighborhoods: ['Downtown', 'Marina', 'JBR', 'Old Dubai', 'Palm'],
    themes: ['shopping', 'family', 'beach', 'luxury', 'business', 'city'],
    seasonality: {
      bestMonths: [11, 12, 1, 2, 3],
      avoidMonths: [6, 7, 8],
      noteEn: 'Winter is prime; summer is extreme heat.',
      noteAr: 'الشتاء المثالي؛ الصيف حر شديد.',
    },
    culture: GCC_CULTURE_HINT,
    prosEn: ['Easy flights from KSA', 'Family attractions', 'Business + leisure mix'],
    prosAr: ['طيران سهل من السعودية', 'أنشطة عائلية', 'مزيج أعمال وترفيه'],
    consEn: ['Summer outdoor limits', 'Can feel generic if you stay only in malls'],
    consAr: ['قيود الصيف في الخارج', 'قد تبدو عامة إن بقيت في المولات فقط'],
    hiddenTipsEn: ['Al Fahidi historic district morning', 'Desert evening over midday'],
    hiddenTipsAr: ['حي الفهيدي صباحاً', 'الصحراء مساءً لا ظهراً'],
    touristTrapAvoidEn: ['Unlicensed desert tour hawkers', 'Timeshare pitch meetings'],
    touristTrapAvoidAr: ['عروض صحراء غير مرخصة', 'عروض تايم شير'],
    dailyBudgetSar: { low: 500, mid: 900, high: 1600 },
    flightHoursFromRiyadh: 1.5,
  }),
  knowledge({
    id: 'istanbul',
    kind: 'city',
    nameEn: 'Istanbul',
    nameAr: 'إسطنبول',
    country: 'Turkey',
    region: 'Europe/Asia',
    neighborhoods: ['Sultanahmet', 'Karaköy', 'Beyoğlu', 'Kadıköy'],
    themes: ['culture', 'food', 'shopping', 'city', 'family'],
    seasonality: {
      bestMonths: [4, 5, 6, 9, 10],
      avoidMonths: [7, 8],
      noteEn: 'Shoulder months for weather + fewer cruise crowds.',
      noteAr: 'أشهر الكتف للطقس وأقل زحاماً.',
    },
    culture: culture({
      language: 'Turkish / English',
      currency: 'TRY',
      dressCodeEn: 'Cover for mosques; smart casual evenings.',
      dressCodeAr: 'غطاء للمساجد؛ أنيق مساءً.',
      safetyEn: 'Busy tourist zones — standard pickpocket caution.',
      safetyAr: 'مناطق سياحية — حذر معتاد من النشل.',
      etiquetteEn: 'Tea offers are hospitality; decline politely if needed.',
      etiquetteAr: 'عرض الشاي ضيافة؛ اعتذر بلطف إن رفضت.',
      businessCustomsEn: 'Warm rapport first; flexible timing.',
      businessCustomsAr: 'بناء علاقة أولاً؛ مرونة في المواعيد.',
      weekendDays: 'Saturday–Sunday',
      publicHolidaysNoteEn: 'Religious holidays shift opening hours.',
      publicHolidaysNoteAr: 'العطل الدينية تغيّر مواعيد العمل.',
    }),
    prosEn: ['Two continents', 'Food density', 'Shortish flights from Riyadh'],
    prosAr: ['قارتان', 'كثافة طعام', 'طيران قصير نسبياً من الرياض'],
    consEn: ['Summer crowds', 'Hills + walking load'],
    consAr: ['زحام الصيف', 'تلال ومشي كثير'],
    hiddenTipsEn: ['Ferry to Kadıköy for dinner', 'Early Hagia Sophia'],
    hiddenTipsAr: ['عبارة لكاديكوي للعشاء', 'آيا صوفيا مبكراً'],
    touristTrapAvoidEn: ['Carpet hard-sells near Blue Mosque', 'Shoe-shine distraction scams'],
    touristTrapAvoidAr: ['بيع سجاد ضاغط قرب السلطان أحمد', 'حيل تلميع الأحذية'],
    dailyBudgetSar: { low: 450, mid: 700, high: 1200 },
    flightHoursFromRiyadh: 4,
  }),
  knowledge({
    id: 'maldives',
    kind: 'region',
    nameEn: 'Maldives',
    nameAr: 'المالديف',
    country: 'Maldives',
    region: 'Indian Ocean',
    neighborhoods: ['North Malé Atoll', 'South Malé Atoll', 'Baa Atoll'],
    themes: ['beach', 'luxury', 'romance'],
    seasonality: {
      bestMonths: [12, 1, 2, 3, 4],
      avoidMonths: [6, 7, 8],
      noteEn: 'Dry season for beaches; monsoon reduces visibility.',
      noteAr: 'الموسم الجاف للشاطئ؛ الموسم المطير يقلل الرؤية.',
    },
    culture: culture({
      language: 'Dhivehi / English',
      currency: 'USD / MVR',
      dressCodeEn: 'Resort wear on islands; modest in Malé.',
      dressCodeAr: 'ملابس منتجع في الجزر؛ محتشم في ماليه.',
      safetyEn: 'Resorts are controlled environments; follow lagoon flags.',
      safetyAr: 'المنتجعات بيئة مضبوطة؛ اتبع أعلام البحيرة.',
      etiquetteEn: 'Alcohol usually resort-only.',
      etiquetteAr: 'الكحول عادة داخل المنتجع فقط.',
      businessCustomsEn: 'Leisure-first destination — limited corporate cadence.',
      businessCustomsAr: 'وجهة ترفيه أساساً — إيقاع أعمال محدود.',
      weekendDays: 'Friday–Saturday',
      publicHolidaysNoteEn: 'Friday is the main weekly holiday.',
      publicHolidaysNoteAr: 'الجمعة العطلة الأسبوعية الرئيسية.',
    }),
    prosEn: ['Overwater calm', 'Honeymoon classic', 'Snorkel-ready lagoons'],
    prosAr: ['هدوء فوق الماء', 'كلاسيكية شهر العسل', 'بحيرات مناسبة للسنوركل'],
    consEn: ['High cost', 'Island hopping logistics'],
    consAr: ['تكلفة عالية', 'تنقل بين الجزر'],
    hiddenTipsEn: ['House reef check before booking', 'Sunset dolphin cruise'],
    hiddenTipsAr: ['افحص الشعاب المنزلية قبل الحجز', 'رحلة دلافين عند الغروب'],
    touristTrapAvoidEn: ['Opaque “all-inclusive” fine print', 'Pressure speedboat upsells'],
    touristTrapAvoidAr: ['تفاصيل الكل شامل الغامضة', 'عروض قوارب سريعة ضاغطة'],
    dailyBudgetSar: { low: 900, mid: 1500, high: 2800 },
    flightHoursFromRiyadh: 6,
  }),
]

export function getDestinationKnowledge(id: string): DestinationKnowledge | null {
  return DESTINATION_KNOWLEDGE.find((d) => d.id === id) ?? null
}

export function listDestinationKnowledge(): DestinationKnowledge[] {
  return DESTINATION_KNOWLEDGE.slice()
}

export function findKnowledgeByName(name: string): DestinationKnowledge | null {
  const raw = name.trim()
  const key = raw.toLowerCase()
  if (!key) return null
  const aliases: Record<string, string> = {
    casa: 'casablanca',
    'الدار البيضاء': 'casablanca',
    'مراكش': 'marrakech',
    marrakesh: 'marrakech',
    'باريس': 'paris',
    'روما': 'rome',
    'طوكيو': 'tokyo',
    'سيول': 'seoul',
    'دبي': 'dubai',
    'إسطنبول': 'istanbul',
    istanbul: 'istanbul',
    'المالديف': 'maldives',
  }
  const aliasId = aliases[key] ?? aliases[raw]
  if (aliasId) {
    return getDestinationKnowledge(aliasId)
  }
  return (
    DESTINATION_KNOWLEDGE.find(
      (d) =>
        d.id === key
        || d.nameEn.toLowerCase() === key
        || d.nameAr.includes(raw)
        || d.country.toLowerCase() === key
        || d.region.toLowerCase() === key,
    ) ?? null
  )
}

export function themesFromRequirements(input: {
  interests: string[]
  tripPurpose: string | null
  travelerType: string | null
  budgetStyle: string | null
  weatherPreference: string | null
  userText?: string
}): DestinationTheme[] {
  const themes = new Set<DestinationTheme>()
  const lower = (input.userText ?? '').toLowerCase()
  for (const interest of input.interests) {
    const i = interest.toLowerCase()
    if (i.includes('beach')) themes.add('beach')
    if (i.includes('food')) themes.add('food')
    if (i.includes('culture')) themes.add('culture')
    if (i.includes('shop')) themes.add('shopping')
    if (i.includes('nature')) themes.add('nature')
    if (i.includes('adventure')) themes.add('adventure')
    if (i.includes('romance') || i.includes('honeymoon')) themes.add('romance')
    if (i.includes('city')) themes.add('city')
  }
  if (input.tripPurpose === 'business' || input.travelerType === 'business') themes.add('business')
  if (input.tripPurpose === 'family' || input.travelerType === 'family') themes.add('family')
  if (input.tripPurpose === 'honeymoon') {
    themes.add('romance')
    themes.add('beach')
  }
  if (input.budgetStyle === 'luxury') themes.add('luxury')
  if (/\bbeach\b|شاطئ/.test(lower)) themes.add('beach')
  if (/\badventure\b|مغامر/.test(lower)) themes.add('adventure')
  if (/\bshop/.test(lower) || /تسوق/.test(lower)) themes.add('shopping')
  if (/\bfood\b|مأكول|طعام/.test(lower)) themes.add('food')
  if (themes.size === 0) themes.add('culture')
  return [...themes]
}
