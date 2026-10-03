# SILA / صلة — App Store & Play Store Release Kit

> Draft only. Do not publish until name clearance and mobile-identity strategy are approved.

## Display identity

**App name:** صلة — SILA  
**Arabic short promise:** اعرف قبل أن تختار  
**Category:** Travel

## Short description

قارن عروض السفر وتعرّف على الوكيل الموثوق والتفاصيل قبل أن تبدأ التواصل.

## Full description

**صلة** تساعدك تشوف الصورة قبل قرار السفر.

تصفّح عروض السفر المنشورة، اعرف الوكيل الذي يقف خلف العرض، راجع ما يشمله السعر وما لا يشمله، وشاهد حالة التوثيق ومؤشرات الاستجابة قبل أن تبدأ التواصل.

داخل صلة:
- عروض سفر بعد مراجعة قبل النشر.
- ملفات لوكلاء السفر وحالة التوثيق.
- تفاصيل السعر والمشمولات والمستثنيات.
- تواصل مباشر مع الوكيل من خلال طلب واضح.
- لا نتوسّط في السعر ولا في الدفع النهائي.

التوثيق يوضح هوية ونطاق المراجعة، لكنه لا يعني ضمان نتيجة كل رحلة. راجع تفاصيل العرض واتفاقك النهائي مع الوكيل قبل الدفع.

## Store artwork mapping

Use separate production assets:
- App icon: `SILA_APP_ICON_1024.png`
- Android adaptive foreground: `SILA_ANDROID_ADAPTIVE_FOREGROUND_1024.png`
- Splash mark: `SILA_SPLASH_MARK_1024.png`
- Apple touch icon: `SILA_APPLE_ICON_180.png`

Source package:
`SILA_PROJECT_CUTOVER_ASSETS.zip`

## Screenshot narrative

Do not create a generic collage. Each screenshot is a separate store asset.

1. **Search**
   - Headline: اعرف قبل أن تختار
   - Show real search/filter surface.

2. **Offer clarity**
   - Headline: السعر واضح. والمشمولات أوضح.
   - Show offer detail with includes/excludes.

3. **Verified agent**
   - Headline: اعرف مين الطرف الثاني
   - Show verified-agent identity + response metrics.

4. **Trust scope**
   - Headline: نوضح ما راجعناه وما لا نضمنه
   - Show verification scope.

5. **Direct inquiry**
   - Headline: اسأل الوكيل مباشرة
   - Show contact-request flow.

## Mobile identifier decision

### Preserve existing app identity
Use this route if current installed builds must update in place:
- keep Expo slug
- keep URI scheme
- keep iOS bundle identifier
- keep Android package
- update display name/artwork/store listing only

### New app identity
Only if deliberately launching a new app record:
- new slug
- new scheme
- new bundle identifier
- new Android package
- new universal/app links
- new analytics/store configuration

Do not mix the two strategies.

## Release gates

- formal name clearance
- store-name availability
- icon/splash binary assets wired into `mobile/app.json`
- real-device iOS QA
- real-device Android QA
- privacy/legal copy review
- support email on verified domain
- production API origin
- `npm run mobile:verify`
