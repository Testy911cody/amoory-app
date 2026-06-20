/* Talk Board — vocabulary data
   Word shape: { id, emoji, labels: { localeCode: text, "ar-SD": "...", fr: "...", ... }, source?, status? }
   - labels keys: base locale ("ar", "fr") or dialect ("ar-SD", "ar-EG").
   - labelForWord(word, locale, dialect?) resolves dialect override -> base -> en.
   - Dialects fall back to base language translation if no specific entry.
   - Community words may be dialect-specific. */

export const CATEGORIES = [
  { id: "people",   labels: { en: "People",   ar: "ناس",   fr: "Personnes", es: "Personas", de: "Personen", hi: "लोग", sw: "Watu" }, color: "var(--c-people)" },
  { id: "feelings", labels: { en: "Feelings", ar: "إحساس", fr: "Sentiments", es: "Sentimientos", de: "Gefühle", hi: "भावनाएँ", sw: "Hisia" }, color: "var(--c-feelings)" },
  { id: "food",     labels: { en: "Food",     ar: "أكل",   fr: "Nourriture", es: "Comida", de: "Essen", hi: "खाना", sw: "Chakula" }, color: "var(--c-food)" },
  { id: "do",       labels: { en: "Actions",  ar: "أفعال", fr: "Actions",    es: "Acciones", de: "Aktionen", hi: "कार्य", sw: "Vitendo" }, color: "var(--c-do)" },
  { id: "need",     labels: { en: "I want",   ar: "عايز",  fr: "Je veux",    es: "Quiero", de: "Ich will", hi: "मैं चाहता हूँ", sw: "Nataka" }, color: "var(--c-need)" },
  { id: "describe", labels: { en: "Describe", ar: "وصف",   fr: "Décrire",    es: "Describir", de: "Beschreiben", hi: "वर्णन", sw: "Eleza" }, color: "#C58B5B" },
  { id: "social",   labels: { en: "Social",   ar: "كلام",  fr: "Social",     es: "Social", de: "Sozial", hi: "सामाजिक", sw: "Jamii" }, color: "#5BAA8F" },
  { id: "body",     labels: { en: "Body",     ar: "جسم",   fr: "Corps",      es: "Cuerpo", de: "Körper", hi: "शरीर", sw: "Mwili" }, color: "#7FB069" },
  { id: "colors",   labels: { en: "Colors",   ar: "ألوان", fr: "Couleurs",   es: "Colores", de: "Farben", hi: "रंग", sw: "Rangi" }, color: "#E06A8B" },
  { id: "numbers",  labels: { en: "Numbers",  ar: "أرقام", fr: "Nombres",    es: "Números", de: "Zahlen", hi: "संख्याएँ", sw: "Namba" }, color: "#6C8EBF" },
  { id: "animals",  labels: { en: "Animals",  ar: "حيوانات", fr: "Animaux",  es: "Animales", de: "Tiere", hi: "जानवर", sw: "Wanyama" }, color: "#D9A441" },
  { id: "clothes",  labels: { en: "Clothes",  ar: "هدوم",  fr: "Vêtements",  es: "Ropa", de: "Kleidung", hi: "कपड़े", sw: "Nguo" }, color: "#A98BC4" },
  { id: "weather",  labels: { en: "Weather & time", ar: "جو ووقت", fr: "Météo", es: "Clima", de: "Wetter", hi: "मौसम", sw: "Hali ya hewa" }, color: "#4FB0C6" },
  { id: "place",    labels: { en: "Places",   ar: "أماكن", fr: "Lieux",      es: "Lugares", de: "Orte", hi: "स्थान", sw: "Mahali" }, color: "var(--c-place)" }
];

function w(id, emoji, en, ar, extra = {}) {
  const { labels: extraLabels, ...rest } = extra;
  return { id, emoji, labels: { en, ar, ...extraLabels }, source: "builtin", ...rest };
}

/** Shorthand for tier/core metadata (used by kid-ui). */
function core(id, emoji, en, ar, extra = {}) {
  return w(id, emoji, en, ar, extra);
}

export const WORDS = {
  people: [
    core("p_i", "👦", "I", "أنا", { labels: { "ar-SD": "أنا", fr: "Je", es: "Yo", de: "Ich", hi: "मैं", sw: "Mimi" } }),
    core("p_my", "🙋", "my", "بتاعي", { labels: { "ar-SD": "بتاعي", fr: "mon/ma", es: "mi", de: "mein", hi: "मेरा", sw: "wangu" } }),
    w("p_you", "🧑", "you", "إنت", { labels: { "ar-SD": "إنت", fr: "tu", es: "tú", de: "du", hi: "तुम", sw: "wewe" } }),
    core("p_mom", "👩", "mom", "ماما", { labels: { "ar-SD": "ماما", fr: "maman", es: "mamá", de: "Mama", hi: "माँ", sw: "mama" } }),
    core("p_dad", "👨", "dad", "بابا", { labels: { "ar-SD": "بابا", fr: "papa", es: "papá", de: "Papa", hi: "पापा", sw: "baba" } }),
    w("p_grandma", "👵", "grandma", "تيتة", { labels: { "ar-SD": "تيتة", fr: "grand-mère", es: "abuela", de: "Oma", hi: "दादी", sw: "bibi" } }),
    w("p_grandpa", "👴", "grandpa", "جدو", { labels: { "ar-SD": "جدو", fr: "grand-père", es: "abuelo", de: "Opa", hi: "दादा", sw: "babu" } }),
    w("p_brother", "🧒", "brother", "أخويا", { labels: { "ar-SD": "أخويا", fr: "frère", es: "hermano", de: "Bruder", hi: "भाई", sw: "kaka" } }),
    w("p_sister", "👧", "sister", "أختي", { labels: { "ar-SD": "أختي", fr: "sœur", es: "hermana", de: "Schwester", hi: "बहन", sw: "dada" } }),
    w("p_baby", "👶", "baby", "بيبي", { labels: { "ar-SD": "بيبي", fr: "bébé", es: "bebé", de: "Baby", hi: "बच्चा", sw: "mtoto" } }),
    w("p_boy", "👦🏽", "boy", "ولد", { labels: { "ar-SD": "ولد", fr: "garçon", es: "niño", de: "Junge", hi: "लड़का", sw: "mvulana" } }),
    w("p_girl", "👧🏽", "girl", "بنت", { labels: { "ar-SD": "بنت", fr: "fille", es: "niña", de: "Mädchen", hi: "लड़की", sw: "msichana" } }),
    core("p_teacher", "🧑‍🏫", "teacher", "مدرّس", { labels: { "ar-SD": "مدرّس", fr: "enseignant", es: "maestro", de: "Lehrer", hi: "शिक्षक", sw: "mwalimu" } }),
    w("p_doctor", "🧑‍⚕️", "doctor", "دكتور", { labels: { "ar-SD": "دكتور", fr: "médecin", es: "doctor", de: "Arzt", hi: "डॉक्टर", sw: "daktari" } }),
    w("p_friend", "🧑‍🤝‍🧑", "friend", "صاحب", { labels: { "ar-SD": "صاحب", fr: "ami", es: "amigo", de: "Freund", hi: "दोस्त", sw: "rafiki" } }),
    w("p_we", "👨‍👩‍👧", "everybody", "الكل", { labels: { "ar-SD": "الكل", fr: "tout le monde", es: "todos", de: "alle", hi: "सब", sw: "wote" } })
  ],
  feelings: [
    w("f_happy", "😊", "happy", "مبسوط", { labels: { "ar-SD": "مبسوط", fr: "content", es: "feliz", de: "glücklich", hi: "खुश", sw: "furahi" } }),
    w("f_sad", "😢", "sad", "زعلان", { labels: { "ar-SD": "زعلان", fr: "triste", es: "triste", de: "traurig", hi: "दुखी", sw: "huzuni" } }),
    w("f_angry", "😠", "angry", "غضبان", { labels: { "ar-SD": "غضبان", fr: "en colère", es: "enojado", de: "wütend", hi: "गुस्सा", sw: "kasirika" } }),
    w("f_scared", "😨", "scared", "خايف", { labels: { "ar-SD": "خايف", fr: "peur", es: "asustado", de: "ängstlich", hi: "डरा हुआ", sw: "ogopa" } }),
    core("f_tired", "😴", "tired", "تعبان", { labels: { "ar-SD": "تعبان", fr: "fatigué", es: "cansado", de: "müde", hi: "थका", sw: "choka" } }),
    core("f_hurt", "🤕", "hurt", "بوجعني", { labels: { "ar-SD": "بوجعني", fr: "mal", es: "dolor", de: "weh", hi: "दर्द", sw: "maumivu" } }),
    core("f_sick", "🤢", "sick", "عيّان", { labels: { "ar-SD": "عيّان", fr: "malade", es: "enfermo", de: "krank", hi: "बीमार", sw: "mgonjwa" } }),
    w("f_upset", "😖", "upset", "متضايق", { labels: { "ar-SD": "متضايق", fr: "contrarié", es: "molesto", de: "verärgert", hi: "परेशान", sw: "huzunika" } }),
    w("f_crying", "😭", "crying", "بعيّط", { labels: { "ar-SD": "بعيّط", fr: "pleure", es: "llorando", de: "weint", hi: "रो रहा", sw: "analia" } }),
    w("f_excited", "🤩", "excited", "متحمّس", { labels: { "ar-SD": "متحمّس", fr: "excité", es: "emocionado", de: "aufgeregt", hi: "उत्साहित", sw: "furahia" } }),
    w("f_surprised", "😲", "surprised", "متفاجئ", { labels: { "ar-SD": "متفاجئ", fr: "surpris", es: "sorprendido", de: "überrascht", hi: "हैरान", sw: "shangaa" } }),
    w("f_shy", "😳", "shy", "مكسوف", { labels: { "ar-SD": "مكسوف", fr: "timide", es: "tímido", de: "schüchtern", hi: "शर्मीला", sw: "aibu" } }),
    w("f_bored", "😒", "bored", "زهقان", { labels: { "ar-SD": "زهقان", fr: "ennuyé", es: "aburrido", de: "gelangweilt", hi: "बोर", sw: "choka" } }),
    w("f_silly", "🤪", "silly", "بهزّر", { labels: { "ar-SD": "بهزّر", fr: "bête", es: "tonto", de: "albern", hi: "मूर्ख", sw: "mjinga" } }),
    w("f_love", "😍", "love", "بحب", { labels: { "ar-SD": "بحب", fr: "aime", es: "amo", de: "liebe", hi: "प्यार", sw: "penda" } }),
    w("f_okay", "😐", "okay", "تمام", { labels: { "ar-SD": "تمام", fr: "d'accord", es: "bien", de: "okay", hi: "ठीक", sw: "sawa" } }),
    w("f_hug", "🤗", "hug", "حضن", { labels: { "ar-SD": "حضن", fr: "câlin", es: "abrazo", de: "Umarmung", hi: "गले लगाना", sw: "kumbatia" } }),
    core("f_yes", "👍", "yes", "أيوة", { labels: { "ar-SD": "أيوة", fr: "oui", es: "sí", de: "ja", hi: "हाँ", sw: "ndiyo" } }),
    core("f_no", "👎", "no", "لأ", { labels: { "ar-SD": "لأ", fr: "non", es: "no", de: "nein", hi: "नहीं", sw: "hapana" } })
  ],
  food: [
    w("fd_apple", "🍎", "apple", "تفاحة", { labels: { "ar-SD": "تفاحة", fr: "pomme", es: "manzana", de: "Apfel", hi: "सेब", sw: "tufaha" } }),
    w("fd_banana", "🍌", "banana", "موزة", { labels: { "ar-SD": "موزة", fr: "banane", es: "plátano", de: "Banane", hi: "केला", sw: "ndizi" } }),
    w("fd_strawberry", "🍓", "strawberry", "فراولة", { labels: { "ar-SD": "فراولة", fr: "fraise", es: "fresa", de: "Erdbeere", hi: "स्ट्रॉबेरी", sw: "strawberry" } }),
    w("fd_orange", "🍊", "orange", "برتقانة", { labels: { "ar-SD": "برتقانة", fr: "orange", es: "naranja", de: "Orange", hi: "संतरा", sw: "chungwa" } }),
    w("fd_grapes", "🍇", "grapes", "عنب", { labels: { "ar-SD": "عنب", fr: "raisin", es: "uvas", de: "Trauben", hi: "अंगूर", sw: "zabibu" } }),
    w("fd_watermelon", "🍉", "watermelon", "بطيخ", { labels: { "ar-SD": "بطيخ", fr: "pastèque", es: "sandía", de: "Wassermelone", hi: "तरबूज", sw: "tikiti" } }),
    w("fd_milk", "🥛", "milk", "لبن", { labels: { "ar-SD": "لبن", fr: "lait", es: "leche", de: "Milch", hi: "दूध", sw: "maziwa" } }),
    core("fd_water", "💧", "water", "ميّة", { labels: { "ar-SD": "موية", fr: "eau", es: "agua", de: "Wasser", hi: "पानी", sw: "maji" } }),
    w("fd_juice", "🧃", "juice", "عصير", { labels: { "ar-SD": "عصير", fr: "jus", es: "jugo", de: "Saft", hi: "रस", sw: "juisi" } }),
    w("fd_cookie", "🍪", "cookie", "بسكوت", { labels: { "ar-SD": "بسكوت", fr: "biscuit", es: "galleta", de: "Keks", hi: "बिस्किट", sw: "biskuti" } }),
    w("fd_bread", "🍞", "bread", "عيش", { labels: { "ar-SD": "عيش", fr: "pain", es: "pan", de: "Brot", hi: "रोटी", sw: "mkate" } }),
    w("fd_cheese", "🧀", "cheese", "جبنة", { labels: { "ar-SD": "جبنة", fr: "fromage", es: "queso", de: "Käse", hi: "पनीर", sw: "jibini" } }),
    w("fd_egg", "🥚", "egg", "بيضة", { labels: { "ar-SD": "بيضة", fr: "œuf", es: "huevo", de: "Ei", hi: "अंडा", sw: "yai" } }),
    w("fd_rice", "🍚", "rice", "رز", { labels: { "ar-SD": "رز", fr: "riz", es: "arroz", de: "Reis", hi: "चावल", sw: "wali" } }),
    w("fd_chicken", "🍗", "chicken", "فراخ", { labels: { "ar-SD": "فراخ", fr: "poulet", es: "pollo", de: "Hähnchen", hi: "चिकन", sw: "kuku" } }),
    w("fd_fish", "🐟", "fish", "سمك", { labels: { "ar-SD": "سمك", fr: "poisson", es: "pescado", de: "Fisch", hi: "मछली", sw: "samaki" } }),
    w("fd_soup", "🍲", "soup", "شوربة", { labels: { "ar-SD": "شوربة", fr: "soupe", es: "sopa", de: "Suppe", hi: "सूप", sw: "supu" } }),
    w("fd_pizza", "🍕", "pizza", "بيتزا", { labels: { "ar-SD": "بيتزا", fr: "pizza", es: "pizza", de: "Pizza", hi: "पिज़्ज़ा", sw: "pizza" } }),
    w("fd_pasta", "🍝", "pasta", "مكرونة", { labels: { "ar-SD": "مكرونة", fr: "pâtes", es: "pasta", de: "Pasta", hi: "पास्ता", sw: "pasta" } }),
    w("fd_sandwich", "🥪", "sandwich", "ساندويتش", { labels: { "ar-SD": "ساندويتش", fr: "sandwich", es: "sándwich", de: "Sandwich", hi: "सैंडविच", sw: "sandwich" } }),
    w("fd_salad", "🥗", "salad", "سلطة", { labels: { "ar-SD": "سلطة", fr: "salade", es: "ensalada", de: "Salat", hi: "सलाद", sw: "saladi" } }),
    w("fd_carrot", "🥕", "carrot", "جزر", { labels: { "ar-SD": "جزر", fr: "carotte", es: "zanahoria", de: "Karotte", hi: "गाजर", sw: "karoti" } }),
    w("fd_potato", "🥔", "potato", "بطاطس", { labels: { "ar-SD": "بطاطس", fr: "pomme de terre", es: "patata", de: "Kartoffel", hi: "आलू", sw: "viazi" } }),
    w("fd_icecream", "🍦", "ice cream", "آيس كريم", { labels: { "ar-SD": "آيس كريم", fr: "glace", es: "helado", de: "Eis", hi: "आइसक्रीम", sw: "aiskrimu" } }),
    w("fd_chocolate", "🍫", "chocolate", "شوكولاتة", { labels: { "ar-SD": "شوكولاتة", fr: "chocolat", es: "chocolate", de: "Schokolade", hi: "चॉकलेट", sw: "chokoleti" } }),
    w("fd_candy", "🍬", "candy", "حلاوة", { labels: { "ar-SD": "حلاوة", fr: "bonbon", es: "caramelo", de: "Bonbon", hi: "मिठाई", sw: "pipi" } }),
    w("fd_cake", "🎂", "cake", "تورتة", { labels: { "ar-SD": "تورتة", fr: "gâteau", es: "pastel", de: "Kuchen", hi: "केक", sw: "keki" } })
  ],
  do: [
    w("d_eat", "🍽️", "eat", "آكل", { labels: { "ar-SD": "آكل", fr: "manger", es: "comer", de: "essen", hi: "खाना", sw: "kula" } }),
    w("d_drink", "🥤", "drink", "أشرب", { labels: { "ar-SD": "أشرب", fr: "boire", es: "beber", de: "trinken", hi: "पीना", sw: "kunywa" } }),
    w("d_sleep", "😴", "sleep", "أنام", { labels: { "ar-SD": "أنام", fr: "dormir", es: "dormir", de: "schlafen", hi: "सोना", sw: "lala" } }),
    w("d_play", "▶️", "play", "ألعب", { labels: { "ar-SD": "ألعب", fr: "jouer", es: "jugar", de: "spielen", hi: "खेलना", sw: "kucheza" } }),
    w("d_walk", "🚶", "walk", "أمشي", { labels: { "ar-SD": "أمشي", fr: "marcher", es: "caminar", de: "gehen", hi: "चलना", sw: "tembea" } }),
    w("d_run", "🏃", "run", "أجري", { labels: { "ar-SD": "أجري", fr: "courir", es: "correr", de: "laufen", hi: "दौड़ना", sw: "kukimbia" } }),
    w("d_jump", "🤸", "jump", "أنطّ", { labels: { "ar-SD": "أنطّ", fr: "sauter", es: "saltar", de: "springen", hi: "कूदना", sw: "kuruka" } }),
    w("d_sit", "🪑", "sit", "أقعد", { labels: { "ar-SD": "أقعد", fr: "s'asseoir", es: "sentarse", de: "sitzen", hi: "बैठना", sw: "kaa" } }),
    w("d_stand", "🧍", "stand up", "أقوم", { labels: { "ar-SD": "أقوم", fr: "se lever", es: "levantarse", de: "stehen", hi: "खड़ा होना", sw: "simama" } }),
    w("d_come", "👐", "come", "تعالى", { labels: { "ar-SD": "تعالى", fr: "viens", es: "ven", de: "komm", hi: "आओ", sw: "njoo" } }),
    w("d_give", "🤝", "give", "إدّيني", { labels: { "ar-SD": "إدّيني", fr: "donne", es: "dar", de: "geben", hi: "दो", sw: "nipa" } }),
    w("d_open", "📂", "open", "افتح", { labels: { "ar-SD": "افتح", fr: "ouvrir", es: "abrir", de: "öffnen", hi: "खोलो", sw: "fungua" } }),
    w("d_close", "📕", "close", "اقفل", { labels: { "ar-SD": "اقفل", fr: "fermer", es: "cerrar", de: "schließen", hi: "बंद करो", sw: "funga" } }),
    w("d_read", "📖", "read", "أقرا", { labels: { "ar-SD": "أقرا", fr: "lire", es: "leer", de: "lesen", hi: "पढ़ो", sw: "soma" } }),
    w("d_write", "✍️", "write", "أكتب", { labels: { "ar-SD": "أكتب", fr: "écrire", es: "escribir", de: "schreiben", hi: "लिखो", sw: "andika" } }),
    w("d_draw", "✏️", "draw", "أرسم", { labels: { "ar-SD": "أرسم", fr: "dessiner", es: "dibujar", de: "zeichnen", hi: "चित्र बनाओ", sw: "chora" } }),
    w("d_music", "🎵", "music", "موسيقى", { labels: { "ar-SD": "موسيقى", fr: "musique", es: "música", de: "Musik", hi: "संगीत", sw: "muziki" } }),
    w("d_sing", "🎤", "sing", "أغنّي", { labels: { "ar-SD": "أغنّي", fr: "chanter", es: "cantar", de: "singen", hi: "गाओ", sw: "imba" } }),
    w("d_dance", "💃", "dance", "أرقص", { labels: { "ar-SD": "أرقص", fr: "danser", es: "bailar", de: "tanzen", hi: "नाचो", sw: "cheza" } }),
    w("d_clap", "👏", "clap", "أصفّق", { labels: { "ar-SD": "أصفّق", fr: "applaudir", es: "aplaudir", de: "klatschen", hi: "ताली", sw: "piga makofi" } }),
    w("d_swim", "🏊", "swim", "أعوم", { labels: { "ar-SD": "أعوم", fr: "nager", es: "nadar", de: "schwimmen", hi: "तैरना", sw: "ogelea" } }),
    w("d_bath", "🛁", "bath", "حمّام", { labels: { "ar-SD": "حمّام", fr: "bain", es: "baño", de: "Bad", hi: "नहाना", sw: "oga" } }),
    w("d_brush", "🪥", "brush teeth", "أغسل سناني", { labels: { "ar-SD": "أغسل سناني", fr: "se brosser les dents", es: "cepillarse", de: "Zähne putzen", hi: "दाँत साफ़ करो", sw: "sukuma meno" } }),
    w("d_wash", "🧼", "wash", "أغسل", { labels: { "ar-SD": "أغسل", fr: "laver", es: "lavar", de: "waschen", hi: "धोना", sw: "osha" } }),
    core("d_toilet", "🚽", "toilet", "تواليت", { labels: { "ar-SD": "تواليت", fr: "toilettes", es: "inodoro", de: "Toilette", hi: "शौचालय", sw: "choo" } }),
    core("d_stop", "✋", "stop", "قف", { labels: { "ar-SD": "قف", fr: "arrête", es: "para", de: "stopp", hi: "रुको", sw: "simama" } }),
    w("d_go", "🟢", "go", "يلا", { labels: { "ar-SD": "يلا", fr: "va", es: "ve", de: "los", hi: "जाओ", sw: "nenda" } }),
    w("d_look", "👀", "look", "بُص", { labels: { "ar-SD": "بُص", fr: "regarde", es: "mira", de: "schau", hi: "देखो", sw: "angalia" } }),
    w("d_listen", "👂", "listen", "اسمع", { labels: { "ar-SD": "اسمع", fr: "écoute", es: "escucha", de: "hör zu", hi: "सुनो", sw: "sikiliza" } })
  ],
  need: [
    w("n_please", "🙏", "please", "لو سمحت", { labels: { "ar-SD": "لو سمحت", fr: "s'il te plaît", es: "por favor", de: "bitte", hi: "कृपया", sw: "tafadhali" } }),
    core("n_help", "🤲", "help", "ساعدني", { labels: { "ar-SD": "ساعدني", fr: "aide-moi", es: "ayúdame", de: "hilf mir", hi: "मदद करो", sw: "nisaidie" } }),
    core("n_want", "🎁", "want", "عايز", { labels: { "ar-SD": "عايز", fr: "je veux", es: "quiero", de: "ich will", hi: "चाहिए", sw: "nataka" } }),
    core("n_need", "❗", "need", "محتاج", { labels: { "ar-SD": "محتاج", fr: "j'ai besoin", es: "necesito", de: "brauche", hi: "ज़रूरत", sw: "nahitaji" } }),
    core("n_more", "➕", "more", "كمان", { labels: { "ar-SD": "كمان", fr: "plus", es: "más", de: "mehr", hi: "और", sw: "zaidi" } }),
    core("n_done", "✅", "all done", "خلصت", { labels: { "ar-SD": "خلصت", fr: "fini", es: "terminado", de: "fertig", hi: "ख़त्म", sw: "kwisha" } }),
    core("n_hungry", "😋", "hungry", "جعان", { labels: { "ar-SD": "جعان", fr: "j'ai faim", es: "hambre", de: "hungrig", hi: "भूखा", sw: "njaa" } }),
    core("n_thirsty", "🫗", "thirsty", "عطشان", { labels: { "ar-SD": "عطشان", fr: "j'ai soif", es: "sed", de: "durstig", hi: "प्यासा", sw: "kiu" } }),
    w("n_hot", "🥵", "I'm hot", "حرّان", { labels: { "ar-SD": "حرّان", fr: "j'ai chaud", es: "tengo calor", de: "heiß", hi: "गर्मी लग रही", sw: "joto" } }),
    w("n_cold", "🥶", "I'm cold", "بردان", { labels: { "ar-SD": "بردان", fr: "j'ai froid", es: "tengo frío", de: "kalt", hi: "ठंड लग रही", sw: "baridi" } }),
    w("n_sleepy", "😪", "sleepy", "نعسان", { labels: { "ar-SD": "نعسان", fr: "j'ai sommeil", es: "sueño", de: "schläfrig", hi: "नींद आ रही", sw: "usingizi" } }),
    core("n_bathroom", "🚻", "bathroom", "الحمّام", { labels: { "ar-SD": "تواليت", fr: "salle de bain", es: "baño", de: "Badezimmer", hi: "बाथरूम", sw: "bafuni" } }),
    core("n_wait", "⏳", "wait", "استنى", { labels: { "ar-SD": "استنى", fr: "attends", es: "espera", de: "warte", hi: "इंतज़ार", sw: "subiri" } }),
    w("n_myturn", "🙋", "my turn", "دوري", { labels: { "ar-SD": "دوري", fr: "mon tour", es: "mi turno", de: "meine Reihe", hi: "मारी बारी", sw: "zamu yangu" } }),
    core("n_again", "🔁", "again", "تاني", { labels: { "ar-SD": "تاني", fr: "encore", es: "otra vez", de: "nochmal", hi: "फिर से", sw: "tena" } }),
    core("n_break", "⏸️", "break", "راحة", { labels: { "ar-SD": "راحة", fr: "pause", es: "descanso", de: "Pause", hi: "आराम", sw: "pumzika" } }),
    core("n_calm", "🧘", "calm", "هدّي", { labels: { "ar-SD": "هدّي", fr: "calme", es: "calma", de: "ruhig", hi: "शांत", sw: "tuliza" } }),
    w("n_medicine", "💊", "medicine", "دوا", { labels: { "ar-SD": "دوا", fr: "médicament", es: "medicina", de: "Medizin", hi: "दवा", sw: "dawa" } }),
    w("n_comfort", "🫂", "comfort me", "طمّني", { labels: { "ar-SD": "طمّني", fr: "console-moi", es: "consuélame", de: "tröste mich", hi: "सांत्वना दो", sw: "fariji" } }),
    core("n_quiet", "🤐", "quiet please", "هدوء", { labels: { "ar-SD": "هدوء", fr: "silence", es: "silencio", de: "ruhig", hi: "चुप", sw: "kimya" } }),
    w("n_wantthis", "👆", "want this", "عايز ده", { labels: { "ar-SD": "عايز ده", fr: "je veux ça", es: "quiero esto", de: "ich will das", hi: "यह चाहिए", sw: "nataka hii" } })
  ],
  describe: [
    w("ds_big", "🐘", "big", "كبير", { labels: { "ar-SD": "كبير", fr: "grand", es: "grande", de: "groß", hi: "बड़ा", sw: "kubwa" } }),
    w("ds_small", "🐭", "small", "صغير", { labels: { "ar-SD": "صغير", fr: "petit", es: "pequeño", de: "klein", hi: "छोटा", sw: "ndogo" } }),
    w("ds_hot", "🔥", "hot", "سخن", { labels: { "ar-SD": "سخن", fr: "chaud", es: "caliente", de: "heiß", hi: "गर्म", sw: "moto" } }),
    w("ds_cold", "❄️", "cold", "بارد", { labels: { "ar-SD": "بارد", fr: "froid", es: "frío", de: "kalt", hi: "ठंडा", sw: "baridi" } }),
    w("ds_fast", "🐇", "fast", "بسرعة", { labels: { "ar-SD": "بسرعة", fr: "vite", es: "rápido", de: "schnell", hi: "तेज़", sw: "haraka" } }),
    w("ds_slow", "🐢", "slow", "ببطء", { labels: { "ar-SD": "ببطء", fr: "lent", es: "lento", de: "langsam", hi: "धीमा", sw: "polepole" } }),
    core("ds_loud", "🔊", "loud", "عالي", { labels: { "ar-SD": "عالي", fr: "fort", es: "fuerte", de: "laut", hi: "ज़ोर", sw: "kubwa sauti" } }),
    w("ds_soft", "🔈", "quiet", "واطي", { labels: { "ar-SD": "واطي", fr: "doux", es: "suave", de: "leise", hi: "धीमा", sw: "kimya" } }),
    w("ds_clean", "✨", "clean", "نضيف", { labels: { "ar-SD": "نضيف", fr: "propre", es: "limpio", de: "sauber", hi: "साफ", sw: "safi" } }),
    w("ds_dirty", "🫧", "dirty", "وسخ", { labels: { "ar-SD": "وسخ", fr: "sale", es: "sucio", de: "schmutzig", hi: "गंदा", sw: "chafu" } }),
    w("ds_wet", "💦", "wet", "مبلول", { labels: { "ar-SD": "مبلول", fr: "mouillé", es: "mojado", de: "nass", hi: "गीला", sw: "nyevu" } }),
    w("ds_good", "👍", "good", "كويس", { labels: { "ar-SD": "كويس", fr: "bon", es: "bueno", de: "gut", hi: "अच्छा", sw: "nzuri" } }),
    w("ds_bad", "👎", "bad", "وحش", { labels: { "ar-SD": "وحش", fr: "mauvais", es: "malo", de: "schlecht", hi: "बुरा", sw: "mbaya" } }),
    w("ds_new", "🆕", "new", "جديد", { labels: { "ar-SD": "جديد", fr: "nouveau", es: "nuevo", de: "neu", hi: "नया", sw: "mpya" } }),
    w("ds_broken", "🛠️", "broken", "مكسور", { labels: { "ar-SD": "مكسور", fr: "cassé", es: "roto", de: "kaputt", hi: "टूटा", sw: "imevunjika" } }),
    w("ds_full", "🈵", "full", "اتملا", { labels: { "ar-SD": "اتملا", fr: "plein", es: "lleno", de: "voll", hi: "भरा", sw: "imejaa" } }),
    w("ds_empty", "🈳", "empty", "فاضي", { labels: { "ar-SD": "فاضي", fr: "vide", es: "vacío", de: "leer", hi: "खाली", sw: "tupu" } })
  ],
  social: [
    w("so_hi", "👋", "hi", "أهلاً", { labels: { "ar-SD": "أهلاً", fr: "salut", es: "hola", de: "hallo", hi: "नमस्ते", sw: "habari" } }),
    w("so_bye", "🫶", "bye", "مع السلامة", { labels: { "ar-SD": "مع السلامة", fr: "au revoir", es: "adiós", de: "tschüss", hi: "अलविदा", sw: "kwaheri" } }),
    w("so_thanks", "🙏", "thank you", "شكراً", { labels: { "ar-SD": "شكراً", fr: "merci", es: "gracias", de: "danke", hi: "धन्यवाद", sw: "asante" } }),
    w("so_sorry", "😔", "sorry", "آسف", { labels: { "ar-SD": "آسف", fr: "désolé", es: "lo siento", de: "entschuldigung", hi: "माफ़", sw: "samahani" } }),
    w("so_me", "🙋", "me / mine", "أنا / بتاعي", { labels: { "ar-SD": "أنا / بتاعي", fr: "moi", es: "yo", de: "ich", hi: "मैं", sw: "mimi" } }),
    w("so_like", "💚", "I like it", "بحبّه", { labels: { "ar-SD": "بحبّه", fr: "j'aime", es: "me gusta", de: "mag ich", hi: "मुझे पसंद", sw: "napenda" } }),
    w("so_dontlike", "💔", "I don't like it", "مش عاجبني", { labels: { "ar-SD": "مش عاجبني", fr: "je n'aime pas", es: "no me gusta", de: "mag ich nicht", hi: "नापसंद", sw: "sipendi" } }),
    w("so_what", "❓", "what", "إيه", { labels: { "ar-SD": "إيه", fr: "quoi", es: "qué", de: "was", hi: "क्या", sw: "nini" } }),
    w("so_where", "📍", "where", "فين", { labels: { "ar-SD": "فين", fr: "où", es: "dónde", de: "wo", hi: "कहाँ", sw: "wapi" } }),
    w("so_who", "👤", "who", "مين", { labels: { "ar-SD": "مين", fr: "qui", es: "quién", de: "wer", hi: "कौन", sw: "nani" } }),
    w("so_when", "🕐", "when", "إمتى", { labels: { "ar-SD": "إمتى", fr: "quand", es: "cuándo", de: "wann", hi: "कब", sw: "lini" } }),
    w("so_why", "💭", "why", "ليه", { labels: { "ar-SD": "ليه", fr: "pourquoi", es: "por qué", de: "warum", hi: "क्यों", sw: "kwa nini" } })
  ],
  body: [
    w("b_head", "🙂", "head", "راس", { labels: { "ar-SD": "راس", fr: "tête", es: "cabeza", de: "Kopf", hi: "सिर", sw: "kichwa" } }),
    w("b_hair", "💇", "hair", "شعر", { labels: { "ar-SD": "شعر", fr: "cheveux", es: "pelo", de: "Haare", hi: "बाल", sw: "nywele" } }),
    w("b_eyes", "👀", "eyes", "عيون", { labels: { "ar-SD": "عيون", fr: "yeux", es: "ojos", de: "Augen", hi: "आँखें", sw: "macho" } }),
    w("b_ear", "👂", "ear", "ودن", { labels: { "ar-SD": "ودن", fr: "oreille", es: "oreja", de: "Ohr", hi: "कान", sw: "sikio" } }),
    w("b_nose", "👃", "nose", "مناخير", { labels: { "ar-SD": "مناخير", fr: "nez", es: "nariz", de: "Nase", hi: "नाक", sw: "pua" } }),
    w("b_mouth", "👄", "mouth", "بقّ", { labels: { "ar-SD": "بقّ", fr: "bouche", es: "boca", de: "Mund", hi: "मुँह", sw: "mdomo" } }),
    w("b_teeth", "🦷", "teeth", "سنان", { labels: { "ar-SD": "سنان", fr: "dents", es: "dientes", de: "Zähne", hi: "दाँत", sw: "meno" } }),
    w("b_hand", "✋", "hand", "إيد", { labels: { "ar-SD": "إيد", fr: "main", es: "mano", de: "Hand", hi: "हाथ", sw: "mkono" } }),
    w("b_arm", "💪", "arm", "دراع", { labels: { "ar-SD": "دراع", fr: "bras", es: "brazo", de: "Arm", hi: "बाँह", sw: "mkono" } }),
    w("b_leg", "🦵", "leg", "رجل", { labels: { "ar-SD": "رجل", fr: "jambe", es: "pierna", de: "Bein", hi: "टांग", sw: "mguu" } }),
    w("b_foot", "🦶", "foot", "قدم", { labels: { "ar-SD": "قدم", fr: "pied", es: "pie", de: "Fuß", hi: "पैर", sw: "mguu" } }),
    w("b_tummy", "🍽️", "tummy", "بطن", { labels: { "ar-SD": "بطن", fr: "ventre", es: "vientre", de: "Bauch", hi: "पेट", sw: "tumbo" } }),
    w("b_back", "🔙", "back", "ضهر", { labels: { "ar-SD": "ضهر", fr: "dos", es: "espalda", de: "Rücken", hi: "पीठ", sw: "mgongo" } }),
    w("b_heart", "❤️", "heart", "قلب", { labels: { "ar-SD": "قلب", fr: "cœur", es: "corazón", de: "Herz", hi: "दिल", sw: "moyo" } })
  ],
  colors: [
    w("c_red", "🔴", "red", "أحمر"),
    w("c_blue", "🔵", "blue", "أزرق"),
    w("c_green", "🟢", "green", "أخضر"),
    w("c_yellow", "🟡", "yellow", "أصفر"),
    w("c_orange", "🟠", "orange", "برتقالي"),
    w("c_purple", "🟣", "purple", "بنفسجي"),
    w("c_pink", "🩷", "pink", "وردي"),
    w("c_brown", "🟤", "brown", "بنّي"),
    w("c_black", "⚫", "black", "أسود"),
    w("c_white", "⚪", "white", "أبيض")
  ],
  numbers: [
    w("num_1", "1️⃣", "one", "واحد"),
    w("num_2", "2️⃣", "two", "اتنين"),
    w("num_3", "3️⃣", "three", "تلاتة"),
    w("num_4", "4️⃣", "four", "أربعة"),
    w("num_5", "5️⃣", "five", "خمسة"),
    w("num_6", "6️⃣", "six", "ستة"),
    w("num_7", "7️⃣", "seven", "سبعة"),
    w("num_8", "8️⃣", "eight", "تمنية"),
    w("num_9", "9️⃣", "nine", "تسعة"),
    w("num_10", "🔟", "ten", "عشرة")
  ],
  animals: [
    w("a_dog", "🐕", "dog", "كلب"),
    w("a_cat", "🐈", "cat", "قطة"),
    w("a_bird", "🐦", "bird", "عصفور"),
    w("a_fish", "🐟", "fish", "سمكة"),
    w("a_rabbit", "🐰", "rabbit", "أرنب"),
    w("a_horse", "🐴", "horse", "حصان"),
    w("a_cow", "🐄", "cow", "بقرة"),
    w("a_sheep", "🐑", "sheep", "خروف"),
    w("a_duck", "🦆", "duck", "بطة"),
    w("a_chicken", "🐔", "chicken", "فرخة"),
    w("a_lion", "🦁", "lion", "أسد"),
    w("a_elephant", "🐘", "elephant", "فيل"),
    w("a_monkey", "🐒", "monkey", "قرد"),
    w("a_bee", "🐝", "bee", "نحلة"),
    w("a_butterfly", "🦋", "butterfly", "فراشة")
  ],
  clothes: [
    w("cl_shirt", "👕", "shirt", "قميص"),
    w("cl_pants", "👖", "pants", "بنطلون"),
    w("cl_dress", "👗", "dress", "فستان"),
    w("cl_shoes", "👟", "shoes", "جزمة"),
    w("cl_socks", "🧦", "socks", "شراب"),
    w("cl_hat", "🧢", "hat", "كاب"),
    w("cl_jacket", "🧥", "jacket", "جاكيت"),
    w("cl_pajamas", "👚", "pajamas", "بيجامة"),
    w("cl_diaper", "🧷", "diaper", "حفّاضة"),
    w("cl_glasses", "👓", "glasses", "نضّارة")
  ],
  weather: [
    w("we_sun", "☀️", "sunny", "شمس"),
    w("we_rain", "🌧️", "rain", "مطر"),
    w("we_cloud", "☁️", "cloudy", "غيم"),
    w("we_snow", "❄️", "snow", "تلج"),
    w("we_hot", "🥵", "hot", "حر"),
    w("we_cold", "🥶", "cold", "برد"),
    w("we_day", "🌞", "day", "نهار"),
    w("we_night", "🌙", "night", "ليل"),
    w("we_morning", "🌅", "morning", "الصبح"),
    w("we_now", "⏰", "now", "دلوقتي"),
    w("we_later", "⏳", "later", "بعدين"),
    w("we_today", "📅", "today", "النهارده")
  ],
  place: [
    w("pl_home", "🏠", "home", "البيت"),
    w("pl_school", "🏫", "school", "المدرسة"),
    w("pl_park", "🏞️", "park", "الجنينة"),
    w("pl_garden", "🌳", "garden", "الحديقة"),
    w("pl_store", "🛒", "store", "السوبر ماركت"),
    w("pl_bedroom", "🛏️", "bedroom", "أوضة النوم"),
    w("pl_kitchen", "🍴", "kitchen", "المطبخ"),
    w("pl_car", "🚗", "car", "العربية"),
    w("pl_doctor", "🏥", "doctor", "الدكتور"),
    w("pl_library", "📚", "library", "المكتبة"),
    w("pl_mosque", "🕌", "mosque", "الجامع"),
    w("pl_beach", "🏖️", "beach", "البحر"),
    w("pl_zoo", "🦁", "zoo", "حديقة الحيوان"),
    w("pl_outside", "🌤️", "outside", "بَرّه"),
    w("pl_playground", "🛝", "playground", "الملعب")
  ]
};

/** Label for a locale (and optional dialect) with fallback:
 *  dialect-key ("ar-SD") -> base locale ("ar") -> "en" -> any.
 *  Dialects without own entry fall back to the base language text. */
export function labelForWord(word, localeCode, dialectId = null) {
  if (!word?.labels) return "";
  const L = word.labels;
  if (dialectId && dialectId !== "default") {
    const d = String(dialectId);
    const k1 = `${localeCode}-${d.toUpperCase()}`;
    const k2 = `${localeCode}-${d}`;
    if (L[k1]) return L[k1];
    if (L[k2]) return L[k2];
  }
  return L[localeCode] || L.en || Object.values(L)[0] || "";
}

export function labelForCategory(cat, localeCode, dialectId = null) {
  if (!cat?.labels) return cat?.id || "";
  const L = cat.labels;
  if (dialectId && dialectId !== "default") {
    const d = String(dialectId);
    const k1 = `${localeCode}-${d.toUpperCase()}`;
    const k2 = `${localeCode}-${d}`;
    if (L[k1]) return L[k1];
    if (L[k2]) return L[k2];
  }
  return L[localeCode] || L.en || cat.id;
}

/** Back-compat exports used by older code paths */
export const DIALECTS = [
  { id: "sd", name: "Sudanese", ar: "سوداني" },
  { id: "juba", name: "Juba Arabic", ar: "عربي جوبا" },
  { id: "eg", name: "Egyptian", ar: "مصري" },
  { id: "msa", name: "Standard Arabic", ar: "فصحى" }
];

export const UI = {
  en:   { title: "Talk Board", say: "Say", hint: "Tap pictures to build a sentence" },
  ar:   { title: "لوحة الكلام", say: "قول", hint: "دوس على الصور عشان تكوّن جملة" },
  both: { title: "Talk Board · لوحة الكلام", say: "Say", hint: "Tap pictures · دوس على الصور" }
};
