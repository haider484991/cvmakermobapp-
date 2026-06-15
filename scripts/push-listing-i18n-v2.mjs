/**
 * Localized store listing v2 — push keyword-tuned, HONEST copy + the new
 * real-template screenshots to all 21 locales in ONE atomic edit.
 *
 * Fixes carried over from en-US v2: outcome-led (tailor + cover letter),
 * "26 templates", and removes the false "no subscription / no paywall" claim
 * (policy risk since v1.8). Also fixes fi-FI, which had Portuguese text.
 *
 * Run: node scripts/push-listing-i18n-v2.mjs          (dry run — validates)
 *      node scripts/push-listing-i18n-v2.mjs --push   (live)
 */
import { readFileSync, readdirSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PKG = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const SHOTS = path.join(process.cwd(), 'store-assets', 'screenshots-v2');
const PUSH = process.argv.includes('--push');

// title ≤30, short ≤80, full ≤4000. Tight full descriptions (~800-1200) keep
// quality high and error surface low while staying keyword-rich.
const L = {
  'en-US': {
    title: 'AI Resume Builder: FreeResume',
    short: 'AI resume builder & CV maker. ATS templates, job match score, PDF export.',
    full: `Build a resume that gets interviews — right from your phone.

🎯 TAILOR YOUR RESUME TO ANY JOB (NEW)
Paste a job posting. AI scores your match, shows the keywords you're missing, and rewrites your resume for that job — truthfully, no fabrication.

✉️ AI COVER LETTERS (NEW)
A personal cover letter from your real experience, in one tap.

✨ AI DOES THE WRITING
Describe yourself in a sentence and AI builds your resume. Or upload your old PDF and watch it get rebuilt. Instant AI score with concrete fixes.

📄 26 RECRUITER-READY TEMPLATES
Modern, professional, creative, and minimal — skill bars, photo headers, executive serif. Recolor any template, add your headshot.

🤖 BUILT TO PASS ATS
Every template is ATS-scored: clean layouts, standard headings, real-text PDFs that applicant tracking systems can read.

📱 FREE TO BUILD
Save your PDF straight to your phone (US Letter or A4), in 12 languages. Pro unlocks job tailoring, cover letters, all templates, and watermark-free exports.

Download FreeResume AI and apply with confidence.`,
  },
  'ar': {
    title: 'منشئ سيرة ذاتية AI: ATS CV',
    short: 'منشئ سيرة ذاتية بالذكاء الاصطناعي. قوالب ATS، تقييم الوظيفة، تصدير PDF.',
    full: `أنشئ سيرة ذاتية تحصل على المقابلات — من هاتفك مباشرة.

🎯 خصّص سيرتك لأي وظيفة (جديد)
الصق إعلان الوظيفة. يقيّم الذكاء الاصطناعي مدى توافقك، ويُظهر الكلمات المفتاحية الناقصة، ويعيد صياغة سيرتك لتناسب الوظيفة — بصدق ودون تلفيق.

✉️ خطابات تعريف بالذكاء الاصطناعي (جديد)
خطاب تعريف شخصي من خبرتك الحقيقية بنقرة واحدة.

✨ الذكاء الاصطناعي يكتب نيابة عنك
صِف نفسك بجملة واحدة ليبني الذكاء الاصطناعي سيرتك. أو ارفع سيرتك القديمة (PDF/Word/صورة) ليعيد بناءها. واحصل على تقييم فوري مع تحسينات عملية.

📄 26 قالبًا احترافيًا
عصري، احترافي، إبداعي، وبسيط — أشرطة مهارات، صور شخصية. غيّر الألوان وأضف صورتك.

🤖 مصمم لاجتياز أنظمة ATS
كل قالب مُقيَّم لاجتياز أنظمة تتبع المتقدمين: تخطيط نظيف ونص حقيقي قابل للقراءة.

📱 مجاني للإنشاء
احفظ ملف PDF على هاتفك مباشرة. النسخة المدفوعة تفتح تخصيص الوظائف وخطابات التعريف وكل القوالب وتصدير بلا علامة مائية.

حمّل FreeResume AI وتقدّم بثقة.`,
  },
  'cs-CZ': {
    title: 'AI Životopis: tvůrce CV ATS',
    short: 'AI tvůrce životopisů a CV. ATS šablony, skóre shody s prací, export PDF.',
    full: `Vytvořte životopis, který získá pohovory — přímo z telefonu.

🎯 PŘIZPŮSOBTE CV KONKRÉTNÍ PRÁCI (NOVÉ)
Vložte inzerát. AI vyhodnotí shodu, ukáže chybějící klíčová slova a přepíše váš životopis pro danou pozici — pravdivě, bez vymýšlení.

✉️ MOTIVAČNÍ DOPISY OD AI (NOVÉ)
Osobní dopis z vašich skutečných zkušeností jediným klepnutím.

✨ AI PÍŠE ZA VÁS
Popište se jednou větou a AI sestaví životopis. Nebo nahrajte staré PDF a nechte ho přepsat. Okamžité AI skóre s konkrétními tipy.

📄 26 PROFESIONÁLNÍCH ŠABLON
Moderní, profesionální, kreativní i minimalistické — pruhy dovedností, fotky. Přebarvěte šablonu a přidejte foto.

🤖 PŘIPRAVENO PRO ATS
Každá šablona má ATS skóre: čisté rozvržení a skutečný text, který systémy přečtou.

📱 ZDARMA
Uložte PDF přímo do telefonu. Pro odemkne přizpůsobení nabídkám, motivační dopisy, všechny šablony a export bez vodoznaku.

Stáhněte FreeResume AI a hlaste se s jistotou.`,
  },
  'da-DK': {
    title: 'AI CV-bygger: ATS CV-maker',
    short: 'AI CV-bygger og resumé-maker. ATS-skabeloner, job-match-score, PDF-eksport.',
    full: `Lav et CV, der giver samtaler — direkte fra din telefon.

🎯 TILPAS DIT CV TIL ETHVERT JOB (NYT)
Indsæt et jobopslag. AI vurderer dit match, viser de manglende nøgleord og omskriver dit CV til jobbet — ærligt, uden opdigt.

✉️ AI-ANSØGNINGER (NYT)
En personlig ansøgning fra din rigtige erfaring med ét tryk.

✨ AI SKRIVER FOR DIG
Beskriv dig selv i én sætning, og AI bygger dit CV. Eller upload dit gamle PDF og få det genopbygget. Øjeblikkelig AI-score med konkrete forbedringer.

📄 26 PROFESSIONELLE SKABELONER
Moderne, professionel, kreativ og minimalistisk — kompetencebjælker, fotos. Skift farve og tilføj dit billede.

🤖 BYGGET TIL AT KLARE ATS
Hver skabelon er ATS-vurderet: rent layout og rigtig tekst, som systemerne kan læse.

📱 GRATIS AT BYGGE
Gem din PDF direkte på telefonen. Pro låser op for jobtilpasning, ansøgninger, alle skabeloner og eksport uden vandmærke.

Download FreeResume AI og søg med selvtillid.`,
  },
  'de-DE': {
    title: 'KI Lebenslauf: CV Builder',
    short: 'KI-Lebenslauf-Generator & CV-Maker. ATS-Vorlagen, Job-Match-Score, PDF.',
    full: `Erstelle einen Lebenslauf, der zu Vorstellungsgesprächen führt — direkt vom Handy.

🎯 LEBENSLAUF AN JEDEN JOB ANPASSEN (NEU)
Stellenanzeige einfügen. Die KI bewertet deine Übereinstimmung, zeigt fehlende Keywords und schreibt deinen Lebenslauf passend um — ehrlich, ohne Erfindungen.

✉️ KI-ANSCHREIBEN (NEU)
Ein persönliches Anschreiben aus deiner echten Erfahrung, mit einem Tipp.

✨ DIE KI SCHREIBT FÜR DICH
Beschreibe dich in einem Satz und die KI baut deinen Lebenslauf. Oder lade dein altes PDF hoch und lass es neu erstellen. Sofortiger KI-Score mit konkreten Verbesserungen.

📄 26 PROFESSIONELLE VORLAGEN
Modern, professionell, kreativ, minimalistisch — Skill-Balken, Foto-Header. Vorlage umfärben, Foto hinzufügen.

🤖 FÜR ATS GEMACHT
Jede Vorlage ist ATS-bewertet: klares Layout und echter Text, den Bewerbersysteme lesen.

📱 KOSTENLOS ERSTELLEN
Speichere dein PDF direkt aufs Handy. Pro schaltet Job-Anpassung, Anschreiben, alle Vorlagen und Export ohne Wasserzeichen frei.

Lade FreeResume AI und bewirb dich mit Selbstvertrauen.`,
  },
  'es-419': {
    title: 'Currículum con IA: CV ATS',
    short: 'Creador de currículum con IA. Plantillas ATS, puntaje de empleo, PDF.',
    full: `Crea un currículum que consigue entrevistas — desde tu teléfono.

🎯 ADAPTA TU CV A CUALQUIER EMPLEO (NUEVO)
Pega una oferta de trabajo. La IA califica tu compatibilidad, muestra las palabras clave que faltan y reescribe tu CV para ese puesto — con honestidad, sin inventar.

✉️ CARTAS DE PRESENTACIÓN CON IA (NUEVO)
Una carta personal basada en tu experiencia real, con un toque.

✨ LA IA ESCRIBE POR TI
Descríbete en una frase y la IA crea tu currículum. O sube tu CV antiguo y míralo reconstruirse. Puntaje IA al instante con mejoras concretas.

📄 26 PLANTILLAS PROFESIONALES
Modernas, profesionales, creativas y minimalistas — barras de habilidades, foto. Cambia el color y agrega tu foto.

🤖 DISEÑADO PARA SUPERAR EL ATS
Cada plantilla tiene puntaje ATS: diseño limpio y texto real que los sistemas leen.

📱 GRATIS PARA CREAR
Guarda tu PDF directo en el teléfono. Pro desbloquea adaptación a empleos, cartas, todas las plantillas y exportación sin marca de agua.

Descarga FreeResume AI y postula con confianza.`,
  },
  'es-ES': {
    title: 'Currículum con IA: CV ATS',
    short: 'Creador de currículum con IA. Plantillas ATS, puntuación de empleo, PDF.',
    full: `Crea un currículum que consigue entrevistas — desde tu móvil.

🎯 ADAPTA TU CV A CUALQUIER OFERTA (NUEVO)
Pega una oferta de empleo. La IA puntúa tu compatibilidad, muestra las palabras clave que faltan y reescribe tu CV para ese puesto — con honestidad, sin inventar.

✉️ CARTAS DE PRESENTACIÓN CON IA (NUEVO)
Una carta personal a partir de tu experiencia real, con un toque.

✨ LA IA ESCRIBE POR TI
Descríbete en una frase y la IA crea tu currículum. O sube tu CV antiguo y míralo reconstruirse. Puntuación IA al instante con mejoras concretas.

📄 26 PLANTILLAS PROFESIONALES
Modernas, profesionales, creativas y minimalistas — barras de aptitudes, foto. Cambia el color y añade tu foto.

🤖 DISEÑADO PARA SUPERAR EL ATS
Cada plantilla tiene puntuación ATS: diseño limpio y texto real que los sistemas leen.

📱 GRATIS PARA CREAR
Guarda tu PDF directo en el móvil. Pro desbloquea la adaptación a ofertas, cartas, todas las plantillas y exportación sin marca de agua.

Descarga FreeResume AI y postúlate con confianza.`,
  },
  'fi-FI': {
    title: 'AI CV-tekijä: ansioluettelo',
    short: 'Tekoäly-CV-työkalu ja ansioluettelon tekijä. ATS-mallit, osumapisteet, PDF.',
    full: `Tee ansioluettelo, joka tuo haastatteluja — suoraan puhelimellasi.

🎯 RÄÄTÄLÖI CV MIHIN TAHANSA TYÖHÖN (UUSI)
Liitä työpaikkailmoitus. Tekoäly pisteyttää osumasi, näyttää puuttuvat avainsanat ja kirjoittaa CV:si kyseiseen työhön — rehellisesti, mitään keksimättä.

✉️ TEKOÄLYN SAATEKIRJEET (UUSI)
Henkilökohtainen saatekirje oikeasta kokemuksestasi yhdellä napautuksella.

✨ TEKOÄLY KIRJOITTAA PUOLESTASI
Kuvaile itsesi yhdellä lauseella ja tekoäly rakentaa CV:si. Tai lataa vanha PDF ja anna sen rakentua uudelleen. Välitön tekoälypistemäärä konkreettisin parannuksin.

📄 26 AMMATTIMAISTA MALLIA
Moderni, ammattimainen, luova ja pelkistetty — taitopalkit, valokuvat. Vaihda väri ja lisää kuvasi.

🤖 SUUNNITELTU LÄPÄISEMÄÄN ATS
Jokaisella mallilla on ATS-pisteet: selkeä asettelu ja aito teksti, jonka järjestelmät lukevat.

📱 ILMAINEN TEHDÄ
Tallenna PDF suoraan puhelimeen. Pro avaa työräätälöinnin, saatekirjeet, kaikki mallit ja vesileimattoman viennin.

Lataa FreeResume AI ja hae itsevarmasti.`,
  },
  'fr-FR': {
    title: 'CV par IA: créateur de CV',
    short: 'Créateur de CV par IA. Modèles ATS, score de correspondance, export PDF.',
    full: `Créez un CV qui décroche des entretiens — depuis votre téléphone.

🎯 ADAPTEZ VOTRE CV À CHAQUE OFFRE (NOUVEAU)
Collez une offre d'emploi. L'IA évalue votre correspondance, montre les mots-clés manquants et réécrit votre CV pour ce poste — honnêtement, sans rien inventer.

✉️ LETTRES DE MOTIVATION PAR IA (NOUVEAU)
Une lettre personnelle issue de votre vraie expérience, en un geste.

✨ L'IA ÉCRIT POUR VOUS
Décrivez-vous en une phrase et l'IA crée votre CV. Ou importez votre ancien PDF et regardez-le se reconstruire. Score IA instantané avec améliorations concrètes.

📄 26 MODÈLES PROFESSIONNELS
Moderne, professionnel, créatif et minimaliste — barres de compétences, photo. Changez la couleur et ajoutez votre photo.

🤖 CONÇU POUR PASSER L'ATS
Chaque modèle a un score ATS : mise en page claire et vrai texte que les systèmes lisent.

📱 GRATUIT À CRÉER
Enregistrez votre PDF directement sur le téléphone. Pro débloque l'adaptation aux offres, les lettres, tous les modèles et l'export sans filigrane.

Téléchargez FreeResume AI et postulez en confiance.`,
  },
  'hi-IN': {
    title: 'AI Resume Builder: CV Maker',
    short: 'AI रिज्यूमे बिल्डर और CV मेकर। ATS टेम्पलेट, जॉब मैच स्कोर, PDF एक्सपोर्ट।',
    full: `ऐसा रिज्यूमे बनाएं जो इंटरव्यू दिलाए — सीधे अपने फ़ोन से।

🎯 किसी भी जॉब के लिए रिज्यूमे तैयार करें (नया)
जॉब पोस्टिंग पेस्ट करें। AI आपका मैच स्कोर बताता है, छूटे हुए कीवर्ड दिखाता है और उस जॉब के लिए रिज्यूमे फिर से लिखता है — सच्चाई के साथ, बिना कुछ बनाए।

✉️ AI कवर लेटर (नया)
आपके असली अनुभव से बना पर्सनल कवर लेटर, एक टैप में।

✨ AI आपके लिए लिखता है
एक वाक्य में खुद का परिचय दें और AI आपका रिज्यूमे बना देगा। या अपना पुराना PDF अपलोड करें और उसे फिर से बनते देखें। तुरंत AI स्कोर और ठोस सुझाव।

📄 26 प्रोफेशनल टेम्पलेट
मॉडर्न, प्रोफेशनल, क्रिएटिव और मिनिमल — स्किल बार, फोटो हेडर। रंग बदलें और अपनी फोटो जोड़ें।

🤖 ATS पास करने के लिए बना
हर टेम्पलेट ATS-स्कोर्ड है: साफ़ लेआउट और असली टेक्स्ट जिसे सिस्टम पढ़ सकें।

📱 बनाना मुफ़्त
अपनी PDF सीधे फ़ोन में सेव करें। Pro में जॉब टेलरिंग, कवर लेटर, सभी टेम्पलेट और बिना वॉटरमार्क एक्सपोर्ट मिलता है।

FreeResume AI डाउनलोड करें और आत्मविश्वास से अप्लाई करें।`,
  },
  'id': {
    title: 'Pembuat CV AI: Resume ATS',
    short: 'Pembuat CV & resume dengan AI. Template ATS, skor kecocokan kerja, ekspor PDF.',
    full: `Buat CV yang mendatangkan panggilan interview — langsung dari ponsel.

🎯 SESUAIKAN CV DENGAN LOWONGAN (BARU)
Tempel iklan lowongan. AI menilai kecocokan, menampilkan kata kunci yang kurang, dan menulis ulang CV untuk pekerjaan itu — jujur, tanpa mengada-ada.

✉️ SURAT LAMARAN AI (BARU)
Surat lamaran personal dari pengalaman asli Anda, satu ketukan.

✨ AI YANG MENULIS UNTUK ANDA
Jelaskan diri dalam satu kalimat dan AI menyusun CV Anda. Atau unggah CV lama dan biarkan dibangun ulang. Skor AI instan dengan perbaikan konkret.

📄 26 TEMPLATE PROFESIONAL
Modern, profesional, kreatif, dan minimalis — bar keterampilan, foto. Ubah warna dan tambahkan foto Anda.

🤖 DIRANCANG LOLOS ATS
Setiap template diberi skor ATS: tata letak bersih dan teks asli yang bisa dibaca sistem.

📱 GRATIS MEMBUAT
Simpan PDF langsung ke ponsel. Pro membuka penyesuaian lowongan, surat lamaran, semua template, dan ekspor tanpa watermark.

Unduh FreeResume AI dan melamar dengan percaya diri.`,
  },
  'it-IT': {
    title: 'Curriculum con IA: CV ATS',
    short: 'Creatore di curriculum con IA. Modelli ATS, punteggio di match, export PDF.',
    full: `Crea un curriculum che ottiene colloqui — direttamente dal telefono.

🎯 ADATTA IL CV A QUALSIASI ANNUNCIO (NUOVO)
Incolla un annuncio di lavoro. L'IA valuta la compatibilità, mostra le parole chiave mancanti e riscrive il CV per quel ruolo — con onestà, senza inventare.

✉️ LETTERE DI PRESENTAZIONE CON IA (NUOVO)
Una lettera personale dalla tua esperienza reale, con un tocco.

✨ L'IA SCRIVE PER TE
Descriviti in una frase e l'IA crea il tuo CV. Oppure carica il vecchio PDF e guardalo ricostruirsi. Punteggio IA immediato con miglioramenti concreti.

📄 26 MODELLI PROFESSIONALI
Moderni, professionali, creativi e minimal — barre delle competenze, foto. Cambia colore e aggiungi la tua foto.

🤖 PROGETTATO PER SUPERARE L'ATS
Ogni modello ha un punteggio ATS: layout pulito e testo reale leggibile dai sistemi.

📱 GRATIS DA CREARE
Salva il PDF direttamente sul telefono. Pro sblocca l'adattamento agli annunci, le lettere, tutti i modelli e l'export senza filigrana.

Scarica FreeResume AI e candidati con sicurezza.`,
  },
  'ja-JP': {
    title: 'AI履歴書作成: ATS & PDF',
    short: 'AI履歴書・職務経歴書メーカー。ATS対応テンプレート、求人マッチ度、PDF出力。',
    full: `面接につながる履歴書を、スマホで作成。

🎯 求人に合わせて最適化（新機能）
求人情報を貼り付けるだけ。AIがマッチ度を採点し、不足キーワードを表示、その求人向けに履歴書を書き換えます — 事実に基づき、誇張なし。

✉️ AIカバーレター（新機能）
あなたの実際の経歴から、パーソナルなカバーレターをワンタップで。

✨ AIが代わりに書く
一文で自己紹介すればAIが履歴書を作成。古いPDFをアップロードして再構築も可能。即時のAIスコアと具体的な改善点。

📄 プロ仕様の26テンプレート
モダン・プロフェッショナル・クリエイティブ・ミニマル — スキルバー、写真付き。色を変えて顔写真も追加。

🤖 ATS通過を前提に設計
全テンプレートがATSスコア付き。クリーンなレイアウトと、システムが読める実テキストPDF。

📱 作成は無料
PDFをスマホに直接保存。Proで求人最適化・カバーレター・全テンプレート・透かしなし出力が解放。

FreeResume AIをダウンロードして、自信を持って応募しましょう。`,
  },
  'ko-KR': {
    title: 'AI 이력서 제작: ATS & PDF',
    short: 'AI 이력서·자소서 메이커. ATS 템플릿, 채용 매칭 점수, PDF 내보내기.',
    full: `면접으로 이어지는 이력서를 휴대폰에서 바로 만드세요.

🎯 어떤 채용공고에도 맞춤 최적화 (신규)
채용공고를 붙여넣으세요. AI가 매칭 점수를 매기고, 빠진 키워드를 보여주며, 그 공고에 맞게 이력서를 다시 씁니다 — 사실 기반, 과장 없이.

✉️ AI 자기소개서 (신규)
실제 경력에서 뽑아낸 맞춤 자기소개서를 한 번의 탭으로.

✨ AI가 대신 작성
한 문장으로 자신을 설명하면 AI가 이력서를 만듭니다. 기존 PDF를 올려 재구성할 수도 있어요. 즉시 AI 점수와 구체적 개선점 제공.

📄 26개 전문 템플릿
모던·프로페셔널·크리에이티브·미니멀 — 스킬 바, 사진 헤더. 색상 변경과 사진 추가 가능.

🤖 ATS 통과를 위해 설계
모든 템플릿은 ATS 점수 기반: 깔끔한 레이아웃과 시스템이 읽는 실제 텍스트 PDF.

📱 제작은 무료
PDF를 휴대폰에 바로 저장. Pro는 채용 맞춤, 자기소개서, 모든 템플릿, 워터마크 없는 내보내기를 제공합니다.

FreeResume AI를 받고 자신 있게 지원하세요.`,
  },
  'nl-NL': {
    title: 'AI CV-maker: ATS & PDF',
    short: 'AI CV-maker en resumébouwer. ATS-sjablonen, vacaturematch-score, PDF-export.',
    full: `Maak een cv dat sollicitatiegesprekken oplevert — direct vanaf je telefoon.

🎯 STEM JE CV AF OP ELKE VACATURE (NIEUW)
Plak een vacature. AI scoort je match, toont de ontbrekende trefwoorden en herschrijft je cv voor die functie — eerlijk, zonder verzinsels.

✉️ AI-MOTIVATIEBRIEVEN (NIEUW)
Een persoonlijke brief uit je echte ervaring, met één tik.

✨ AI SCHRIJFT VOOR JE
Beschrijf jezelf in één zin en AI bouwt je cv. Of upload je oude PDF en laat het herbouwen. Directe AI-score met concrete verbeteringen.

📄 26 PROFESSIONELE SJABLONEN
Modern, professioneel, creatief en minimalistisch — vaardigheidsbalken, foto's. Verander de kleur en voeg je foto toe.

🤖 GEMAAKT OM ATS TE DOORSTAAN
Elk sjabloon heeft een ATS-score: strakke opmaak en echte tekst die systemen lezen.

📱 GRATIS TE MAKEN
Sla je PDF direct op je telefoon op. Pro ontgrendelt vacature-afstemming, brieven, alle sjablonen en export zonder watermerk.

Download FreeResume AI en solliciteer met vertrouwen.`,
  },
  'pl-PL': {
    title: 'Kreator CV z AI: ATS',
    short: 'Kreator CV i życiorysu z AI. Szablony ATS, wynik dopasowania, eksport PDF.',
    full: `Stwórz CV, które zaprasza na rozmowy — prosto z telefonu.

🎯 DOPASUJ CV DO KAŻDEJ OFERTY (NOWOŚĆ)
Wklej ogłoszenie. AI ocenia dopasowanie, pokazuje brakujące słowa kluczowe i przepisuje CV pod tę ofertę — zgodnie z prawdą, bez zmyślania.

✉️ LISTY MOTYWACYJNE OD AI (NOWOŚĆ)
Osobisty list z Twojego prawdziwego doświadczenia, jednym dotknięciem.

✨ AI PISZE ZA CIEBIE
Opisz się jednym zdaniem, a AI zbuduje Twoje CV. Albo wgraj stare PDF i pozwól je odtworzyć. Natychmiastowy wynik AI z konkretnymi poprawkami.

📄 26 PROFESJONALNYCH SZABLONÓW
Nowoczesne, profesjonalne, kreatywne i minimalistyczne — paski umiejętności, zdjęcia. Zmień kolor i dodaj swoje zdjęcie.

🤖 STWORZONE, BY PRZEJŚĆ ATS
Każdy szablon ma wynik ATS: czysty układ i prawdziwy tekst, który systemy odczytają.

📱 DARMOWE TWORZENIE
Zapisz PDF bezpośrednio w telefonie. Pro odblokowuje dopasowanie do ofert, listy, wszystkie szablony i eksport bez znaku wodnego.

Pobierz FreeResume AI i aplikuj z pewnością siebie.`,
  },
  'pt-BR': {
    title: 'Currículo com IA: CV ATS',
    short: 'Criador de currículo com IA. Modelos ATS, pontuação de vaga, exportar PDF.',
    full: `Crie um currículo que consegue entrevistas — direto do celular.

🎯 ADAPTE SEU CURRÍCULO A QUALQUER VAGA (NOVO)
Cole uma vaga. A IA pontua sua compatibilidade, mostra as palavras-chave que faltam e reescreve seu currículo para aquela vaga — com honestidade, sem inventar.

✉️ CARTAS DE APRESENTAÇÃO COM IA (NOVO)
Uma carta pessoal a partir da sua experiência real, com um toque.

✨ A IA ESCREVE POR VOCÊ
Descreva-se em uma frase e a IA cria seu currículo. Ou envie seu PDF antigo e veja-o ser refeito. Pontuação IA na hora com melhorias concretas.

📄 26 MODELOS PROFISSIONAIS
Moderno, profissional, criativo e minimalista — barras de habilidades, foto. Mude a cor e adicione sua foto.

🤖 FEITO PARA PASSAR NO ATS
Cada modelo tem pontuação ATS: layout limpo e texto real que os sistemas leem.

📱 GRÁTIS PARA CRIAR
Salve seu PDF direto no celular. O Pro libera adaptação a vagas, cartas, todos os modelos e exportação sem marca d'água.

Baixe o FreeResume AI e candidate-se com confiança.`,
  },
  'th': {
    title: 'สร้าง Resume ด้วย AI: ATS',
    short: 'สร้างเรซูเม่และ CV ด้วย AI เทมเพลต ATS คะแนนตรงงาน ส่งออก PDF',
    full: `สร้างเรซูเม่ที่ได้สัมภาษณ์ — จากมือถือของคุณ

🎯 ปรับเรซูเม่ให้ตรงทุกตำแหน่งงาน (ใหม่)
วางประกาศงาน AI จะให้คะแนนความตรง แสดงคีย์เวิร์ดที่ขาด และเขียนเรซูเม่ใหม่ให้เหมาะกับงานนั้น — ตามจริง ไม่กุเรื่อง

✉️ จดหมายสมัครงานด้วย AI (ใหม่)
จดหมายส่วนตัวจากประสบการณ์จริงของคุณ เพียงแตะเดียว

✨ AI เขียนให้คุณ
บอกเล่าตัวเองหนึ่งประโยค แล้ว AI จะสร้างเรซูเม่ให้ หรืออัปโหลด PDF เดิมแล้วให้สร้างใหม่ พร้อมคะแนน AI ทันทีและคำแนะนำที่ชัดเจน

📄 26 เทมเพลตระดับมืออาชีพ
โมเดิร์น มืออาชีพ ครีเอทีฟ และมินิมอล — แถบทักษะ รูปถ่าย เปลี่ยนสีและเพิ่มรูปได้

🤖 ออกแบบให้ผ่าน ATS
ทุกเทมเพลตมีคะแนน ATS เลย์เอาต์สะอาดและข้อความจริงที่ระบบอ่านได้

📱 สร้างฟรี
บันทึก PDF ลงมือถือได้ทันที Pro ปลดล็อกการปรับตามงาน จดหมายสมัครงาน ทุกเทมเพลต และส่งออกแบบไร้ลายน้ำ

ดาวน์โหลด FreeResume AI แล้วสมัครงานอย่างมั่นใจ`,
  },
  'tr-TR': {
    title: 'AI CV Oluşturucu: ATS',
    short: 'AI özgeçmiş ve CV oluşturucu. ATS şablonları, iş uyum puanı, PDF dışa aktarma.',
    full: `Mülakat getiren bir özgeçmiş oluştur — doğrudan telefonundan.

🎯 CV'Nİ HER İŞE GÖRE UYARLA (YENİ)
Bir iş ilanı yapıştır. Yapay zeka uyumunu puanlar, eksik anahtar kelimeleri gösterir ve CV'ni o iş için yeniden yazar — dürüstçe, uydurmadan.

✉️ YAPAY ZEKA ÖN YAZILARI (YENİ)
Gerçek deneyiminden kişisel bir ön yazı, tek dokunuşla.

✨ YAPAY ZEKA SENİN YERİNE YAZAR
Kendini bir cümleyle anlat, yapay zeka CV'ni oluştursun. Ya da eski PDF'ini yükle, yeniden oluşturulsun. Anında yapay zeka puanı ve somut iyileştirmeler.

📄 26 PROFESYONEL ŞABLON
Modern, profesyonel, yaratıcı ve sade — beceri çubukları, fotoğraf. Rengi değiştir, fotoğrafını ekle.

🤖 ATS'Yİ GEÇMEK İÇİN TASARLANDI
Her şablon ATS puanlıdır: temiz düzen ve sistemlerin okuyabildiği gerçek metin.

📱 OLUŞTURMASI ÜCRETSİZ
PDF'ini doğrudan telefona kaydet. Pro; işe uyarlamayı, ön yazıları, tüm şablonları ve filigransız dışa aktarmayı açar.

FreeResume AI'yi indir ve kendinden emin başvur.`,
  },
  'vi': {
    title: 'Tạo CV bằng AI: Resume ATS',
    short: 'Tạo CV & resume bằng AI. Mẫu ATS, điểm phù hợp công việc, xuất PDF.',
    full: `Tạo một CV giúp bạn được phỏng vấn — ngay trên điện thoại.

🎯 ĐIỀU CHỈNH CV CHO MỌI CÔNG VIỆC (MỚI)
Dán tin tuyển dụng. AI chấm điểm độ phù hợp, chỉ ra từ khóa còn thiếu và viết lại CV cho công việc đó — trung thực, không bịa đặt.

✉️ THƯ XIN VIỆC BẰNG AI (MỚI)
Một lá thư cá nhân từ kinh nghiệm thật của bạn, chỉ một chạm.

✨ AI VIẾT THAY BẠN
Mô tả bản thân trong một câu và AI dựng CV cho bạn. Hoặc tải CV cũ lên để dựng lại. Điểm AI tức thì kèm gợi ý cải thiện cụ thể.

📄 26 MẪU CHUYÊN NGHIỆP
Hiện đại, chuyên nghiệp, sáng tạo và tối giản — thanh kỹ năng, ảnh đại diện. Đổi màu và thêm ảnh của bạn.

🤖 THIẾT KẾ ĐỂ VƯỢT ATS
Mỗi mẫu đều có điểm ATS: bố cục gọn gàng và văn bản thật mà hệ thống đọc được.

📱 MIỄN PHÍ TẠO
Lưu PDF thẳng vào điện thoại. Pro mở khóa điều chỉnh theo việc làm, thư xin việc, mọi mẫu và xuất không hình mờ.

Tải FreeResume AI và ứng tuyển tự tin.`,
  },
  'zh-CN': {
    title: 'AI简历制作: ATS简历PDF',
    short: 'AI简历与履历制作器。ATS模板、职位匹配评分、PDF导出。',
    full: `打造能拿到面试的简历——就在手机上完成。

🎯 针对任意职位定制简历（全新）
粘贴招聘信息，AI 即可评估匹配度、显示缺失关键词，并针对该职位重写你的简历——真实可信，绝不虚构。

✉️ AI 求职信（全新）
基于你的真实经历，一键生成个性化求职信。

✨ AI 替你撰写
用一句话描述自己，AI 即可生成简历；也可上传旧版 PDF 自动重建。即时 AI 评分并给出具体改进建议。

📄 26 款专业模板
现代、专业、创意与极简——技能条、照片版式。可更改配色并添加照片。

🤖 专为通过 ATS 而设计
每款模板均带 ATS 评分：版面清晰、文字真实，可被申请人筛选系统识别。

📱 免费制作
将 PDF 直接保存到手机。Pro 解锁职位定制、求职信、全部模板及无水印导出。

下载 FreeResume AI，自信投递每一份简历。`,
  },
};

// ---- validate ----
const SCREENSHOTS = readdirSync(SHOTS).filter((f) => /^0\d-.*\.png$/.test(f)).sort();
const FEATURE = path.join(SHOTS, 'feature-graphic.png');
let bad = 0;
console.log(`\nLocalized listing v2 — ${Object.keys(L).length} locales  ${PUSH ? '** LIVE PUSH **' : '(dry run)'}\n`);
for (const [lang, c] of Object.entries(L)) {
  const errs = [];
  if (c.title.length > 30) errs.push(`title ${c.title.length}>30`);
  if (c.short.length > 80) errs.push(`short ${c.short.length}>80`);
  if (c.full.length > 4000) errs.push(`full ${c.full.length}>4000`);
  console.log(`  ${lang.padEnd(7)} t:${String(c.title.length).padStart(2)} s:${String(c.short.length).padStart(2)} f:${c.full.length}${errs.length ? '  ⚠ ' + errs.join(', ') : ''}`);
  if (errs.length) bad++;
}
console.log(`\nScreenshots: ${SCREENSHOTS.length} + feature graphic`);
if (bad) { console.error(`\n${bad} locale(s) exceed limits — fix before pushing.`); process.exit(1); }
if (!PUSH) { console.log('\nDry run OK. Re-run with --push.'); process.exit(0); }

// ---- push (single atomic edit) ----
const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });
const { data: edit } = await publisher.edits.insert({ packageName: PKG });
const editId = edit.id;
console.log(`\nEdit ${editId} opened`);

const imgFails = [];
for (const [language, c] of Object.entries(L)) {
  await publisher.edits.listings.update({
    packageName: PKG, editId, language,
    requestBody: { language, title: c.title, shortDescription: c.short, fullDescription: c.full },
  });
  // screenshots + feature graphic (best-effort per locale)
  try {
    await publisher.edits.images.deleteall({ packageName: PKG, editId, language, imageType: 'phoneScreenshots' });
    for (const f of SCREENSHOTS) {
      await publisher.edits.images.upload({
        packageName: PKG, editId, language, imageType: 'phoneScreenshots',
        media: { mimeType: 'image/png', body: createReadStream(path.join(SHOTS, f)) },
      });
    }
    await publisher.edits.images.deleteall({ packageName: PKG, editId, language, imageType: 'featureGraphic' });
    await publisher.edits.images.upload({
      packageName: PKG, editId, language, imageType: 'featureGraphic',
      media: { mimeType: 'image/png', body: createReadStream(FEATURE) },
    });
    console.log(`  ✓ ${language}  (text + ${SCREENSHOTS.length} shots + feature)`);
  } catch (e) {
    imgFails.push(`${language}: ${e.message}`);
    console.log(`  ~ ${language}  (text ok, images failed: ${e.message.slice(0, 50)})`);
  }
}

await publisher.edits.commit({ packageName: PKG, editId });
console.log(`\n✅ Committed ${Object.keys(L).length} locales — Google will review.`);
if (imgFails.length) console.log(`\n⚠ image upload issues:\n  ${imgFails.join('\n  ')}`);
