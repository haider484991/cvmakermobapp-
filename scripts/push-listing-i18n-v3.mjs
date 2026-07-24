/**
 * Localized listing v3 — job-search positioning for the remaining locales.
 *
 * IMPORTANT: one locale per Play edit, committed sequentially.
 * A previous run tried 21 locales × 17 images in a single edit (~350 uploads)
 * and Google returned INTERNAL/backendError partway through. Play also allows
 * only ONE active edit at a time, so nothing else may touch the API while
 * this runs. Small edits + sequential commits is the reliable shape.
 *
 * Run: node scripts/push-listing-i18n-v3.mjs            (dry run)
 *      node scripts/push-listing-i18n-v3.mjs --push     (live)
 *      node scripts/push-listing-i18n-v3.mjs --push --only=id,pt-BR
 */
import { readdirSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PKG = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const SHOTS = path.join(process.cwd(), 'store-assets', 'screenshots-v3');
const PUSH = process.argv.includes('--push');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '');

/* Job-search-first copy per locale. Title ≤30, short ≤80, full ≤4000. */
const L = {
  'ar': {
    title: 'وظائف وصانع سيرة ذاتية AI',
    short: 'ابحث عن وظائف، خصّص سيرتك الذاتية بالذكاء الاصطناعي وقدّم. متوافق مع ATS.',
    full: `ابحث عن وظيفة وقدّم بسيرة ذاتية مصممة لها — في تطبيق واحد.

🔎 البحث عن وظائف
• آلاف الوظائف الحقيقية من شركات حقيقية
• وظائف عن بُعد، هجينة، وفي الموقع
• ابحث بالمسمى الوظيفي أو الكلمة المفتاحية أو المدينة
• وصف كامل للوظيفة وتقديم بنقرة واحدة

🎯 خصّص سيرتك لأي وظيفة
يقيّم الذكاء الاصطناعي مدى توافقك، ويُظهر الكلمات المفتاحية الناقصة، ويعيد صياغة سيرتك لتناسب الإعلان — بصدق ودون تلفيق.

✉️ خطابات تعريف بالذكاء الاصطناعي
خطاب شخصي من خبرتك الحقيقية بنقرة واحدة.

✨ منشئ السيرة الذاتية بالذكاء الاصطناعي
صِف نفسك بجملة واحدة ليبني الذكاء الاصطناعي سيرتك، أو ارفع سيرتك القديمة (PDF/Word/صورة) ليعيد بناءها، مع تقييم فوري وتحسينات عملية.

📄 26 قالبًا احترافيًا
تصاميم عصرية واحترافية وإبداعية وبسيطة — أشرطة مهارات وصور شخصية. غيّر الألوان وأضف صورتك.

🤖 مصمم لاجتياز أنظمة ATS
كل قالب مُقيَّم: تخطيط نظيف ونص حقيقي يمكن للأنظمة قراءته.

📱 مجاني للاستخدام
احفظ ملف PDF مباشرة على هاتفك. النسخة المدفوعة تفتح تخصيص الوظائف وخطابات التعريف وكل القوالب وتصدير بلا علامة مائية.

حمّل FreeResume AI: البحث عن وظائف وصانع السيرة الذاتية معًا.`,
  },
  'cs-CZ': {
    title: 'Práce a AI životopis',
    short: 'Najděte práci, přizpůsobte životopis pomocí AI a odešlete. ATS šablony.',
    full: `Najděte práci a pošlete životopis vytvořený přesně pro danou pozici.

🔎 HLEDÁNÍ PRÁCE
• Tisíce reálných nabídek od skutečných firem
• Práce na dálku, hybridní i na místě
• Hledejte podle pozice, klíčového slova nebo města
• Celý popis pozice a odeslání jedním klepnutím

🎯 PŘIZPŮSOBTE CV KAŽDÉ NABÍDCE
AI vyhodnotí shodu, ukáže chybějící klíčová slova a přepíše váš životopis pro danou pozici — pravdivě, bez vymýšlení.

✉️ MOTIVAČNÍ DOPISY OD AI
Osobní dopis z vašich skutečných zkušeností jediným klepnutím.

✨ AI TVŮRCE ŽIVOTOPISU
Popište se jednou větou a AI sestaví životopis. Nebo nahrajte staré PDF a nechte ho přepsat. Okamžité AI skóre s konkrétními tipy.

📄 26 PROFESIONÁLNÍCH ŠABLON
Moderní, profesionální, kreativní i minimalistické — pruhy dovedností, fotky. Přebarvěte šablonu a přidejte foto.

🤖 PŘIPRAVENO PRO ATS
Každá šablona má ATS skóre: čisté rozvržení a skutečný text, který systémy přečtou.

📱 ZDARMA
Uložte PDF přímo do telefonu. Pro odemkne přizpůsobení nabídkám, motivační dopisy, všechny šablony a export bez vodoznaku.

Stáhněte FreeResume AI: hledání práce i tvůrce životopisu.`,
  },
  'da-DK': {
    title: 'Jobsøgning & AI CV-bygger',
    short: 'Find job, tilpas dit CV med AI og søg. Jobportal + ATS CV-bygger.',
    full: `Find et job, og søg med et CV bygget til netop den stilling.

🔎 JOBSØGNING
• Tusindvis af rigtige jobopslag fra rigtige virksomheder
• Remote, hybride og fysiske stillinger
• Søg på jobtitel, nøgleord eller by
• Fuld jobbeskrivelse og ansøg med ét tryk

🎯 TILPAS DIT CV TIL ETHVERT JOB
AI vurderer dit match, viser de manglende nøgleord og omskriver dit CV til jobbet — ærligt, uden opdigt.

✉️ AI-ANSØGNINGER
En personlig ansøgning fra din rigtige erfaring med ét tryk.

✨ AI CV-BYGGER
Beskriv dig selv i én sætning, og AI bygger dit CV. Eller upload dit gamle PDF og få det genopbygget. Øjeblikkelig AI-score med konkrete forbedringer.

📄 26 PROFESSIONELLE SKABELONER
Moderne, professionel, kreativ og minimalistisk — kompetencebjælker, fotos. Skift farve og tilføj dit billede.

🤖 BYGGET TIL AT KLARE ATS
Hver skabelon er ATS-vurderet: rent layout og rigtig tekst, som systemerne kan læse.

📱 GRATIS AT BRUGE
Gem din PDF direkte på telefonen. Pro låser op for jobtilpasning, ansøgninger, alle skabeloner og eksport uden vandmærke.

Download FreeResume AI: jobsøgning og CV-bygger i én app.`,
  },
  'de-DE': {
    title: 'Jobsuche & KI Lebenslauf',
    short: 'Jobs finden, Lebenslauf mit KI anpassen und bewerben. ATS-Vorlagen & PDF.',
    full: `Finde einen Job und bewirb dich mit einem Lebenslauf, der genau dazu passt.

🔎 JOBSUCHE
• Tausende echte Stellenangebote von echten Unternehmen
• Remote, hybrid und vor Ort
• Suche nach Jobtitel, Stichwort oder Stadt
• Vollständige Stellenbeschreibung, Bewerbung mit einem Tipp

🎯 LEBENSLAUF AN JEDEN JOB ANPASSEN
Die KI bewertet deine Übereinstimmung, zeigt fehlende Keywords und schreibt deinen Lebenslauf passend um — ehrlich, ohne Erfindungen.

✉️ KI-ANSCHREIBEN
Ein persönliches Anschreiben aus deiner echten Erfahrung, mit einem Tipp.

✨ KI-LEBENSLAUF-GENERATOR
Beschreibe dich in einem Satz und die KI baut deinen Lebenslauf. Oder lade dein altes PDF hoch und lass es neu erstellen. Sofortiger KI-Score mit konkreten Verbesserungen.

📄 26 PROFESSIONELLE VORLAGEN
Modern, professionell, kreativ, minimalistisch — Skill-Balken, Foto-Header. Vorlage umfärben, Foto hinzufügen.

🤖 FÜR ATS GEMACHT
Jede Vorlage ist ATS-bewertet: klares Layout und echter Text, den Bewerbersysteme lesen.

📱 KOSTENLOS NUTZBAR
Speichere dein PDF direkt aufs Handy. Pro schaltet Job-Anpassung, Anschreiben, alle Vorlagen und Export ohne Wasserzeichen frei.

Lade FreeResume AI: Jobsuche und Lebenslauf-Generator in einer App.`,
  },
  'es-419': {
    title: 'Empleos y CV con IA',
    short: 'Busca empleo, adapta tu currículum con IA y postula. Plantillas ATS y PDF.',
    full: `Encuentra empleo y postula con un currículum hecho para ese puesto.

🔎 BÚSQUEDA DE EMPLEO
• Miles de vacantes reales de empresas reales
• Trabajo remoto, híbrido y presencial
• Busca por puesto, palabra clave o ciudad
• Descripción completa y postulación con un toque

🎯 ADAPTA TU CV A CUALQUIER VACANTE
La IA califica tu compatibilidad, muestra las palabras clave que faltan y reescribe tu currículum para ese puesto — con honestidad, sin inventar.

✉️ CARTAS DE PRESENTACIÓN CON IA
Una carta personal basada en tu experiencia real, con un toque.

✨ CREADOR DE CURRÍCULUM CON IA
Descríbete en una frase y la IA crea tu currículum. O sube tu CV antiguo y míralo reconstruirse. Puntaje IA al instante con mejoras concretas.

📄 26 PLANTILLAS PROFESIONALES
Modernas, profesionales, creativas y minimalistas — barras de habilidades, foto. Cambia el color y agrega tu foto.

🤖 DISEÑADO PARA SUPERAR EL ATS
Cada plantilla tiene puntaje ATS: diseño limpio y texto real que los sistemas leen.

📱 GRATIS
Guarda tu PDF directo en el teléfono. Pro desbloquea adaptación a vacantes, cartas, todas las plantillas y exportación sin marca de agua.

Descarga FreeResume AI: búsqueda de empleo y creador de CV en una app.`,
  },
  'es-ES': {
    title: 'Empleo y CV con IA',
    short: 'Busca empleo, adapta tu CV con IA y apúntate. Plantillas ATS y PDF gratis.',
    full: `Encuentra empleo y apúntate con un currículum hecho para esa oferta.

🔎 BÚSQUEDA DE EMPLEO
• Miles de ofertas reales de empresas reales
• Trabajo en remoto, híbrido y presencial
• Busca por puesto, palabra clave o ciudad
• Descripción completa e inscripción con un toque

🎯 ADAPTA TU CV A CUALQUIER OFERTA
La IA puntúa tu compatibilidad, muestra las palabras clave que faltan y reescribe tu CV para ese puesto — con honestidad, sin inventar.

✉️ CARTAS DE PRESENTACIÓN CON IA
Una carta personal a partir de tu experiencia real, con un toque.

✨ CREADOR DE CV CON IA
Descríbete en una frase y la IA crea tu currículum. O sube tu CV antiguo y míralo reconstruirse. Puntuación IA al instante con mejoras concretas.

📄 26 PLANTILLAS PROFESIONALES
Modernas, profesionales, creativas y minimalistas — barras de aptitudes, foto. Cambia el color y añade tu foto.

🤖 DISEÑADO PARA SUPERAR EL ATS
Cada plantilla tiene puntuación ATS: diseño limpio y texto real que los sistemas leen.

📱 GRATIS
Guarda tu PDF directo en el móvil. Pro desbloquea la adaptación a ofertas, cartas, todas las plantillas y exportación sin marca de agua.

Descarga FreeResume AI: búsqueda de empleo y creador de CV en una app.`,
  },
  'fi-FI': {
    title: 'Työnhaku & AI-ansioluettelo',
    short: 'Etsi töitä, räätälöi CV tekoälyllä ja hae. Työpaikat + ATS-ansioluettelo.',
    full: `Löydä työpaikka ja hae ansioluettelolla, joka on tehty juuri siihen rooliin.

🔎 TYÖNHAKU
• Tuhansia oikeita työpaikkailmoituksia oikeilta yrityksiltä
• Etätyö, hybridi ja paikan päällä tehtävät työt
• Hae tehtävänimikkeellä, avainsanalla tai kaupungilla
• Koko työpaikkailmoitus ja haku yhdellä napautuksella

🎯 RÄÄTÄLÖI CV MIHIN TAHANSA TYÖHÖN
Tekoäly pisteyttää osumasi, näyttää puuttuvat avainsanat ja kirjoittaa ansioluettelosi kyseiseen työhön — rehellisesti, mitään keksimättä.

✉️ TEKOÄLYN SAATEKIRJEET
Henkilökohtainen saatekirje oikeasta kokemuksestasi yhdellä napautuksella.

✨ TEKOÄLY-ANSIOLUETTELO
Kuvaile itsesi yhdellä lauseella ja tekoäly rakentaa CV:si. Tai lataa vanha PDF ja anna sen rakentua uudelleen. Välitön tekoälypistemäärä konkreettisin parannuksin.

📄 26 AMMATTIMAISTA MALLIA
Moderni, ammattimainen, luova ja pelkistetty — taitopalkit, valokuvat. Vaihda väri ja lisää kuvasi.

🤖 SUUNNITELTU LÄPÄISEMÄÄN ATS
Jokaisella mallilla on ATS-pisteet: selkeä asettelu ja aito teksti, jonka järjestelmät lukevat.

📱 ILMAINEN KÄYTTÄÄ
Tallenna PDF suoraan puhelimeen. Pro avaa työräätälöinnin, saatekirjeet, kaikki mallit ja vesileimattoman viennin.

Lataa FreeResume AI: työnhaku ja ansioluettelon tekijä yhdessä.`,
  },
  'fr-FR': {
    title: 'Emploi & CV par IA',
    short: 'Trouvez un emploi, adaptez votre CV avec l\'IA et postulez. Modèles ATS.',
    full: `Trouvez un emploi et postulez avec un CV conçu pour ce poste précis.

🔎 RECHERCHE D'EMPLOI
• Des milliers d'offres réelles d'entreprises réelles
• Télétravail, hybride et sur site
• Recherchez par intitulé, mot-clé ou ville
• Description complète et candidature en un geste

🎯 ADAPTEZ VOTRE CV À CHAQUE OFFRE
L'IA évalue votre correspondance, montre les mots-clés manquants et réécrit votre CV pour ce poste — honnêtement, sans rien inventer.

✉️ LETTRES DE MOTIVATION PAR IA
Une lettre personnelle issue de votre vraie expérience, en un geste.

✨ CRÉATEUR DE CV PAR IA
Décrivez-vous en une phrase et l'IA crée votre CV. Ou importez votre ancien PDF et regardez-le se reconstruire. Score IA instantané avec améliorations concrètes.

📄 26 MODÈLES PROFESSIONNELS
Moderne, professionnel, créatif et minimaliste — barres de compétences, photo. Changez la couleur et ajoutez votre photo.

🤖 CONÇU POUR PASSER L'ATS
Chaque modèle a un score ATS : mise en page claire et vrai texte que les systèmes lisent.

📱 GRATUIT
Enregistrez votre PDF directement sur le téléphone. Pro débloque l'adaptation aux offres, les lettres, tous les modèles et l'export sans filigrane.

Téléchargez FreeResume AI : recherche d'emploi et créateur de CV.`,
  },
  'hi-IN': {
    title: 'नौकरी खोज और AI रिज्यूमे',
    short: 'नौकरी खोजें, AI से रिज्यूमे तैयार करें और अप्लाई करें। ATS टेम्पलेट और PDF।',
    full: `नौकरी खोजें और उसी पद के लिए बने रिज्यूमे के साथ अप्लाई करें।

🔎 नौकरी खोज
• असली कंपनियों की हज़ारों वास्तविक नौकरियाँ
• रिमोट, हाइब्रिड और ऑन-साइट जॉब
• जॉब टाइटल, कीवर्ड या शहर से खोजें
• पूरा जॉब विवरण और एक टैप में आवेदन

🎯 किसी भी नौकरी के लिए रिज्यूमे तैयार करें
AI आपका मैच स्कोर बताता है, छूटे हुए कीवर्ड दिखाता है और उस नौकरी के लिए रिज्यूमे फिर से लिखता है — सच्चाई के साथ, बिना कुछ बनाए।

✉️ AI कवर लेटर
आपके असली अनुभव से बना पर्सनल कवर लेटर, एक टैप में।

✨ AI रिज्यूमे बिल्डर
एक वाक्य में खुद का परिचय दें और AI आपका रिज्यूमे बना देगा। या पुराना PDF अपलोड करें और उसे फिर से बनते देखें। तुरंत AI स्कोर और ठोस सुझाव।

📄 26 प्रोफेशनल टेम्पलेट
मॉडर्न, प्रोफेशनल, क्रिएटिव और मिनिमल — स्किल बार, फोटो हेडर। रंग बदलें और अपनी फोटो जोड़ें।

🤖 ATS पास करने के लिए बना
हर टेम्पलेट ATS-स्कोर्ड है: साफ़ लेआउट और असली टेक्स्ट जिसे सिस्टम पढ़ सकें।

📱 उपयोग में मुफ़्त
अपनी PDF सीधे फ़ोन में सेव करें। Pro में जॉब टेलरिंग, कवर लेटर, सभी टेम्पलेट और बिना वॉटरमार्क एक्सपोर्ट मिलता है।

FreeResume AI डाउनलोड करें: नौकरी खोज और रिज्यूमे मेकर एक साथ।`,
  },
  'id': {
    title: 'Cari Kerja & CV AI',
    short: 'Cari lowongan kerja, sesuaikan CV dengan AI, dan lamar. Template ATS & PDF.',
    full: `Cari lowongan kerja dan lamar dengan CV yang dibuat khusus untuk posisi itu.

🔎 CARI LOWONGAN KERJA
• Ribuan lowongan asli dari perusahaan nyata
• Kerja remote, hybrid, dan di kantor
• Cari berdasarkan posisi, kata kunci, atau kota
• Deskripsi lowongan lengkap, lamar dalam satu ketukan

🎯 SESUAIKAN CV DENGAN SETIAP LOWONGAN
AI menilai kecocokan Anda, menampilkan kata kunci yang kurang, dan menulis ulang CV untuk lowongan itu — jujur, tanpa mengada-ada.

✉️ SURAT LAMARAN AI
Surat lamaran personal dari pengalaman asli Anda, satu ketukan.

✨ PEMBUAT CV DENGAN AI
Jelaskan diri dalam satu kalimat dan AI menyusun CV Anda. Atau unggah CV lama dan biarkan dibangun ulang. Skor AI instan dengan perbaikan konkret.

📄 26 TEMPLATE PROFESIONAL
Modern, profesional, kreatif, dan minimalis — bar keterampilan, foto. Ubah warna dan tambahkan foto Anda.

🤖 DIRANCANG LOLOS ATS
Setiap template diberi skor ATS: tata letak bersih dan teks asli yang bisa dibaca sistem.

📱 GRATIS DIGUNAKAN
Simpan PDF langsung ke ponsel. Pro membuka penyesuaian lowongan, surat lamaran, semua template, dan ekspor tanpa watermark.

Unduh FreeResume AI: cari kerja dan pembuat CV dalam satu aplikasi.`,
  },
  'it-IT': {
    title: 'Offerte lavoro & CV con IA',
    short: 'Trova lavoro, adatta il CV con l\'IA e candidati. Modelli ATS e PDF gratis.',
    full: `Trova lavoro e candidati con un curriculum creato per quella posizione.

🔎 RICERCA LAVORO
• Migliaia di offerte reali da aziende reali
• Lavoro da remoto, ibrido e in sede
• Cerca per posizione, parola chiave o città
• Descrizione completa e candidatura con un tocco

🎯 ADATTA IL CV A OGNI ANNUNCIO
L'IA valuta la compatibilità, mostra le parole chiave mancanti e riscrive il CV per quel ruolo — con onestà, senza inventare.

✉️ LETTERE DI PRESENTAZIONE CON IA
Una lettera personale dalla tua esperienza reale, con un tocco.

✨ CREATORE DI CV CON IA
Descriviti in una frase e l'IA crea il tuo CV. Oppure carica il vecchio PDF e guardalo ricostruirsi. Punteggio IA immediato con miglioramenti concreti.

📄 26 MODELLI PROFESSIONALI
Moderni, professionali, creativi e minimal — barre delle competenze, foto. Cambia colore e aggiungi la tua foto.

🤖 PROGETTATO PER SUPERARE L'ATS
Ogni modello ha un punteggio ATS: layout pulito e testo reale leggibile dai sistemi.

📱 GRATIS
Salva il PDF direttamente sul telefono. Pro sblocca l'adattamento agli annunci, le lettere, tutti i modelli e l'export senza filigrana.

Scarica FreeResume AI: ricerca lavoro e creatore di CV in un'app.`,
  },
  'ja-JP': {
    title: '求人検索 & AI履歴書作成',
    short: '求人を探し、AIが職務経歴書を最適化。ATS対応テンプレートとPDF出力。',
    full: `求人を見つけて、その仕事に合わせた履歴書で応募できます。

🔎 求人検索
• 実在企業の求人を多数掲載
• リモート・ハイブリッド・出社勤務
• 職種、キーワード、勤務地から検索
• 求人詳細をそのまま確認し、ワンタップで応募

🎯 求人ごとに履歴書を最適化
AIがマッチ度を採点し、不足しているキーワードを表示、その求人向けに履歴書を書き換えます — 事実に基づき、誇張なし。

✉️ AIカバーレター
あなたの実際の経歴から、パーソナルなカバーレターをワンタップで。

✨ AI履歴書作成
一文で自己紹介すればAIが履歴書を作成。古いPDFをアップロードして再構築も可能。即時のAIスコアと具体的な改善点。

📄 プロ仕様の26テンプレート
モダン・プロフェッショナル・クリエイティブ・ミニマル — スキルバー、写真付き。色を変えて顔写真も追加。

🤖 ATS通過を前提に設計
全テンプレートがATSスコア付き。クリーンなレイアウトと、システムが読める実テキストPDF。

📱 無料で利用可能
PDFをスマホに直接保存。Proで求人最適化・カバーレター・全テンプレート・透かしなし出力が解放。

FreeResume AIをダウンロード：求人検索と履歴書作成をひとつに。`,
  },
  'ko-KR': {
    title: '채용정보 & AI 이력서',
    short: '채용 공고를 찾고 AI로 이력서를 맞춤 작성해 지원하세요. ATS 템플릿·PDF.',
    full: `채용 공고를 찾고, 그 자리에 맞춰 만든 이력서로 지원하세요.

🔎 채용 정보 검색
• 실제 기업의 수천 건의 채용 공고
• 재택, 하이브리드, 출근 근무
• 직무, 키워드, 도시로 검색
• 전체 공고 내용 확인 후 한 번의 탭으로 지원

🎯 공고마다 이력서 맞춤화
AI가 매칭 점수를 매기고, 빠진 키워드를 보여주며, 그 공고에 맞게 이력서를 다시 씁니다 — 사실 기반, 과장 없이.

✉️ AI 자기소개서
실제 경력에서 뽑아낸 맞춤 자기소개서를 한 번의 탭으로.

✨ AI 이력서 작성
한 문장으로 자신을 설명하면 AI가 이력서를 만듭니다. 기존 PDF를 올려 재구성할 수도 있어요. 즉시 AI 점수와 구체적 개선점 제공.

📄 26개 전문 템플릿
모던·프로페셔널·크리에이티브·미니멀 — 스킬 바, 사진 헤더. 색상 변경과 사진 추가 가능.

🤖 ATS 통과를 위해 설계
모든 템플릿은 ATS 점수 기반: 깔끔한 레이아웃과 시스템이 읽는 실제 텍스트 PDF.

📱 무료 사용
PDF를 휴대폰에 바로 저장. Pro는 채용 맞춤, 자기소개서, 모든 템플릿, 워터마크 없는 내보내기를 제공합니다.

FreeResume AI 다운로드: 채용 정보와 이력서 제작을 한 번에.`,
  },
  'nl-NL': {
    title: 'Vacatures & AI CV-maker',
    short: 'Vind vacatures, stem je cv af met AI en solliciteer. ATS-sjablonen & PDF.',
    full: `Vind een baan en solliciteer met een cv dat op die functie is gebouwd.

🔎 VACATURES ZOEKEN
• Duizenden echte vacatures van echte bedrijven
• Remote, hybride en op locatie
• Zoek op functietitel, trefwoord of stad
• Volledige vacaturetekst en solliciteren met één tik

🎯 STEM JE CV AF OP ELKE VACATURE
AI scoort je match, toont de ontbrekende trefwoorden en herschrijft je cv voor die functie — eerlijk, zonder verzinsels.

✉️ AI-MOTIVATIEBRIEVEN
Een persoonlijke brief uit je echte ervaring, met één tik.

✨ AI CV-MAKER
Beschrijf jezelf in één zin en AI bouwt je cv. Of upload je oude PDF en laat het herbouwen. Directe AI-score met concrete verbeteringen.

📄 26 PROFESSIONELE SJABLONEN
Modern, professioneel, creatief en minimalistisch — vaardigheidsbalken, foto's. Verander de kleur en voeg je foto toe.

🤖 GEMAAKT OM ATS TE DOORSTAAN
Elk sjabloon heeft een ATS-score: strakke opmaak en echte tekst die systemen lezen.

📱 GRATIS TE GEBRUIKEN
Sla je PDF direct op je telefoon op. Pro ontgrendelt vacature-afstemming, brieven, alle sjablonen en export zonder watermerk.

Download FreeResume AI: vacatures zoeken en cv maken in één app.`,
  },
  'pl-PL': {
    title: 'Oferty pracy & CV z AI',
    short: 'Znajdź pracę, dopasuj CV z pomocą AI i aplikuj. Szablony ATS i eksport PDF.',
    full: `Znajdź pracę i aplikuj z CV stworzonym pod konkretne stanowisko.

🔎 SZUKANIE PRACY
• Tysiące prawdziwych ofert od prawdziwych firm
• Praca zdalna, hybrydowa i stacjonarna
• Szukaj po stanowisku, słowie kluczowym lub mieście
• Pełny opis oferty i aplikowanie jednym dotknięciem

🎯 DOPASUJ CV DO KAŻDEJ OFERTY
AI ocenia dopasowanie, pokazuje brakujące słowa kluczowe i przepisuje CV pod tę ofertę — zgodnie z prawdą, bez zmyślania.

✉️ LISTY MOTYWACYJNE OD AI
Osobisty list z Twojego prawdziwego doświadczenia, jednym dotknięciem.

✨ KREATOR CV Z AI
Opisz się jednym zdaniem, a AI zbuduje Twoje CV. Albo wgraj stare PDF i pozwól je odtworzyć. Natychmiastowy wynik AI z konkretnymi poprawkami.

📄 26 PROFESJONALNYCH SZABLONÓW
Nowoczesne, profesjonalne, kreatywne i minimalistyczne — paski umiejętności, zdjęcia. Zmień kolor i dodaj swoje zdjęcie.

🤖 STWORZONE, BY PRZEJŚĆ ATS
Każdy szablon ma wynik ATS: czysty układ i prawdziwy tekst, który systemy odczytają.

📱 ZA DARMO
Zapisz PDF bezpośrednio w telefonie. Pro odblokowuje dopasowanie do ofert, listy, wszystkie szablony i eksport bez znaku wodnego.

Pobierz FreeResume AI: oferty pracy i kreator CV w jednej aplikacji.`,
  },
  'pt-BR': {
    title: 'Vagas de emprego & CV IA',
    short: 'Busque vagas, adapte seu currículo com IA e candidate-se. Modelos ATS e PDF.',
    full: `Encontre uma vaga e candidate-se com um currículo feito para aquela posição.

🔎 BUSCA DE VAGAS
• Milhares de vagas reais de empresas reais
• Trabalho remoto, híbrido e presencial
• Busque por cargo, palavra-chave ou cidade
• Descrição completa da vaga e candidatura com um toque

🎯 ADAPTE SEU CURRÍCULO A CADA VAGA
A IA pontua sua compatibilidade, mostra as palavras-chave que faltam e reescreve seu currículo para aquela vaga — com honestidade, sem inventar.

✉️ CARTAS DE APRESENTAÇÃO COM IA
Uma carta pessoal a partir da sua experiência real, com um toque.

✨ CRIADOR DE CURRÍCULO COM IA
Descreva-se em uma frase e a IA cria seu currículo. Ou envie seu PDF antigo e veja-o ser refeito. Pontuação IA na hora com melhorias concretas.

📄 26 MODELOS PROFISSIONAIS
Moderno, profissional, criativo e minimalista — barras de habilidades, foto. Mude a cor e adicione sua foto.

🤖 FEITO PARA PASSAR NO ATS
Cada modelo tem pontuação ATS: layout limpo e texto real que os sistemas leem.

📱 GRÁTIS PARA USAR
Salve seu PDF direto no celular. O Pro libera adaptação a vagas, cartas, todos os modelos e exportação sem marca d'água.

Baixe o FreeResume AI: busca de vagas e criador de currículo em um app.`,
  },
  'th': {
    title: 'หางาน & สร้าง Resume AI',
    short: 'หางาน ปรับเรซูเม่ด้วย AI แล้วสมัคร บอร์ดงาน + เรซูเม่ผ่าน ATS และ PDF',
    full: `หางานและสมัครด้วยเรซูเม่ที่สร้างมาเพื่อตำแหน่งนั้นโดยเฉพาะ

🔎 หางาน
• ประกาศงานจริงหลายพันตำแหน่งจากบริษัทจริง
• งานรีโมท ไฮบริด และงานประจำออฟฟิศ
• ค้นหาด้วยตำแหน่งงาน คีย์เวิร์ด หรือเมือง
• อ่านรายละเอียดงานเต็ม และสมัครได้ในแตะเดียว

🎯 ปรับเรซูเม่ให้ตรงทุกตำแหน่ง
AI ให้คะแนนความตรง แสดงคีย์เวิร์ดที่ขาด และเขียนเรซูเม่ใหม่ให้เหมาะกับงานนั้น — ตามจริง ไม่กุเรื่อง

✉️ จดหมายสมัครงานด้วย AI
จดหมายส่วนตัวจากประสบการณ์จริงของคุณ เพียงแตะเดียว

✨ สร้างเรซูเม่ด้วย AI
บอกเล่าตัวเองหนึ่งประโยค แล้ว AI จะสร้างเรซูเม่ให้ หรืออัปโหลด PDF เดิมแล้วให้สร้างใหม่ พร้อมคะแนน AI ทันที

📄 26 เทมเพลตระดับมืออาชีพ
โมเดิร์น มืออาชีพ ครีเอทีฟ และมินิมอล — แถบทักษะ รูปถ่าย เปลี่ยนสีและเพิ่มรูปได้

🤖 ออกแบบให้ผ่าน ATS
ทุกเทมเพลตมีคะแนน ATS เลย์เอาต์สะอาดและข้อความจริงที่ระบบอ่านได้

📱 ใช้งานฟรี
บันทึก PDF ลงมือถือได้ทันที Pro ปลดล็อกการปรับตามงาน จดหมายสมัครงาน ทุกเทมเพลต และส่งออกแบบไร้ลายน้ำ

ดาวน์โหลด FreeResume AI: หางานและสร้างเรซูเม่ในแอปเดียว`,
  },
  'tr-TR': {
    title: 'İş İlanları & AI CV',
    short: 'İş ara, CV\'ni yapay zekâ ile uyarla ve başvur. ATS şablonları ve PDF.',
    full: `İş bul ve tam o pozisyon için hazırlanmış bir CV ile başvur.

🔎 İŞ ARAMA
• Gerçek şirketlerden binlerce gerçek iş ilanı
• Uzaktan, hibrit ve ofiste çalışma
• Pozisyon, anahtar kelime veya şehre göre ara
• İlanın tamamını gör, tek dokunuşla başvur

🎯 CV'Nİ HER İLANA UYARLA
Yapay zekâ uyumunu puanlar, eksik anahtar kelimeleri gösterir ve CV'ni o iş için yeniden yazar — dürüstçe, uydurmadan.

✉️ YAPAY ZEKA ÖN YAZILARI
Gerçek deneyiminden kişisel bir ön yazı, tek dokunuşla.

✨ YAPAY ZEKÂ CV OLUŞTURUCU
Kendini bir cümleyle anlat, yapay zekâ CV'ni oluştursun. Ya da eski PDF'ini yükle, yeniden oluşturulsun. Anında yapay zekâ puanı ve somut iyileştirmeler.

📄 26 PROFESYONEL ŞABLON
Modern, profesyonel, yaratıcı ve sade — beceri çubukları, fotoğraf. Rengi değiştir, fotoğrafını ekle.

🤖 ATS'Yİ GEÇMEK İÇİN TASARLANDI
Her şablon ATS puanlıdır: temiz düzen ve sistemlerin okuyabildiği gerçek metin.

📱 ÜCRETSİZ
PDF'ini doğrudan telefona kaydet. Pro; işe uyarlamayı, ön yazıları, tüm şablonları ve filigransız dışa aktarmayı açar.

FreeResume AI'yi indir: iş arama ve CV oluşturma tek uygulamada.`,
  },
  'vi': {
    title: 'Tìm việc làm & CV bằng AI',
    short: 'Tìm việc, tùy chỉnh CV bằng AI và ứng tuyển. Mẫu CV chuẩn ATS, xuất PDF.',
    full: `Tìm việc và ứng tuyển bằng CV được xây dựng riêng cho vị trí đó.

🔎 TÌM VIỆC LÀM
• Hàng nghìn tin tuyển dụng thật từ công ty thật
• Việc làm từ xa, kết hợp và tại văn phòng
• Tìm theo chức danh, từ khóa hoặc thành phố
• Xem mô tả công việc đầy đủ, ứng tuyển chỉ một chạm

🎯 TÙY CHỈNH CV CHO TỪNG TIN TUYỂN DỤNG
AI chấm điểm độ phù hợp, chỉ ra từ khóa còn thiếu và viết lại CV cho công việc đó — trung thực, không bịa đặt.

✉️ THƯ XIN VIỆC BẰNG AI
Một lá thư cá nhân từ kinh nghiệm thật của bạn, chỉ một chạm.

✨ TẠO CV BẰNG AI
Mô tả bản thân trong một câu và AI dựng CV cho bạn. Hoặc tải CV cũ lên để dựng lại. Điểm AI tức thì kèm gợi ý cải thiện cụ thể.

📄 26 MẪU CHUYÊN NGHIỆP
Hiện đại, chuyên nghiệp, sáng tạo và tối giản — thanh kỹ năng, ảnh đại diện. Đổi màu và thêm ảnh của bạn.

🤖 THIẾT KẾ ĐỂ VƯỢT ATS
Mỗi mẫu đều có điểm ATS: bố cục gọn gàng và văn bản thật mà hệ thống đọc được.

📱 MIỄN PHÍ SỬ DỤNG
Lưu PDF thẳng vào điện thoại. Pro mở khóa điều chỉnh theo việc làm, thư xin việc, mọi mẫu và xuất không hình mờ.

Tải FreeResume AI: tìm việc làm và tạo CV trong một ứng dụng.`,
  },
  'zh-CN': {
    title: '找工作 & AI简历制作',
    short: '搜索职位、用AI定制简历并投递。招聘信息 + ATS简历模板与PDF导出。',
    full: `找到职位，并用专为该岗位打造的简历投递。

🔎 职位搜索
• 来自真实企业的数千条真实招聘信息
• 远程、混合办公与到岗工作
• 按职位名称、关键词或城市搜索
• 查看完整职位描述，一键投递

🎯 针对每个职位定制简历
AI 评估匹配度、显示缺失关键词，并针对该职位重写你的简历——真实可信，绝不虚构。

✉️ AI 求职信
基于你的真实经历，一键生成个性化求职信。

✨ AI 简历生成
用一句话描述自己，AI 即可生成简历；也可上传旧版 PDF 自动重建。即时 AI 评分并给出具体改进建议。

📄 26 款专业模板
现代、专业、创意与极简——技能条、照片版式。可更改配色并添加照片。

🤖 专为通过 ATS 而设计
每款模板均带 ATS 评分：版面清晰、文字真实，可被申请人筛选系统识别。

📱 免费使用
将 PDF 直接保存到手机。Pro 解锁职位定制、求职信、全部模板及无水印导出。

下载 FreeResume AI：找工作与简历制作，一个应用搞定。`,
  },
};

const phone = readdirSync(SHOTS).filter((f) => /^phone-\d+\.png$/.test(f)).sort();
const tab7 = readdirSync(SHOTS).filter((f) => /^tab7-\d+\.png$/.test(f)).sort();
const tab10 = readdirSync(SHOTS).filter((f) => /^tab10-\d+\.png$/.test(f)).sort();
const feature = path.join(SHOTS, 'feature-graphic.png');

let langs = Object.keys(L);
if (ONLY) langs = langs.filter((l) => ONLY.split(',').includes(l));

console.log(`\nLocalized listing v3 — ${langs.length} locales  ${PUSH ? '** LIVE **' : '(dry run)'}\n`);
let bad = 0;
for (const lang of langs) {
  const c = L[lang];
  const errs = [];
  if (c.title.length > 30) errs.push(`title ${c.title.length}`);
  if (c.short.length > 80) errs.push(`short ${c.short.length}`);
  if (c.full.length > 4000) errs.push(`full ${c.full.length}`);
  console.log(`  ${lang.padEnd(7)} t:${String(c.title.length).padStart(2)} s:${String(c.short.length).padStart(2)} f:${c.full.length}${errs.length ? '  ⚠ ' + errs.join(', ') : ''}`);
  if (errs.length) bad++;
}
if (bad) { console.error(`\n${bad} locale(s) over limit`); process.exit(1); }
if (!PUSH) { console.log('\nDry run OK. Re-run with --push.'); process.exit(0); }

const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });

/** One locale per edit, committed before the next starts. */
async function pushLocale(language) {
  const c = L[language];
  const { data: edit } = await publisher.edits.insert({ packageName: PKG });
  const editId = edit.id;
  await publisher.edits.listings.update({
    packageName: PKG, editId, language,
    requestBody: { language, title: c.title, shortDescription: c.short, fullDescription: c.full },
  });
  for (const [imageType, files] of [['phoneScreenshots', phone], ['sevenInchScreenshots', tab7], ['tenInchScreenshots', tab10]]) {
    await publisher.edits.images.deleteall({ packageName: PKG, editId, language, imageType });
    for (const f of files) {
      await publisher.edits.images.upload({
        packageName: PKG, editId, language, imageType,
        media: { mimeType: 'image/png', body: createReadStream(path.join(SHOTS, f)) },
      });
    }
  }
  await publisher.edits.images.deleteall({ packageName: PKG, editId, language, imageType: 'featureGraphic' });
  await publisher.edits.images.upload({
    packageName: PKG, editId, language, imageType: 'featureGraphic',
    media: { mimeType: 'image/png', body: createReadStream(feature) },
  });
  await publisher.edits.commit({ packageName: PKG, editId });
}

const failed = [];
for (const lang of langs) {
  try {
    await pushLocale(lang);
    console.log(`  ✓ ${lang}`);
  } catch (e) {
    failed.push(lang);
    console.log(`  ✖ ${lang}: ${String(e.message).slice(0, 70)}`);
  }
}
console.log(`\nDone. ${langs.length - failed.length}/${langs.length} locales updated.`);
if (failed.length) console.log(`Retry these: node scripts/push-listing-i18n-v3.mjs --push --only=${failed.join(',')}`);
