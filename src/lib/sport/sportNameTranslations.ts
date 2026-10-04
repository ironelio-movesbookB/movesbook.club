import type { EntitySportOption } from '@/lib/sport/entitySportOptions';

/** Language order of the rows below. */
const LANGS = ['fr', 'de', 'it', 'es', 'pt', 'ru', 'hi', 'zh', 'ar', 'ja', 'id'] as const;

/**
 * Sport names translated by hand: machine translation reads short names literally
 * (Squash → pumpkin, Cricket → insect, Basket → basket).
 */
const ROWS: Record<EntitySportOption, readonly string[]> = {
  'American Football': ['Football américain', 'American Football', 'Football americano', 'Fútbol americano', 'Futebol americano', 'Американский футбол', 'अमेरिकी फ़ुटबॉल', '美式橄榄球', 'كرة القدم الأمريكية', 'アメリカンフットボール', 'Sepak bola Amerika'],
  'Artistic Gymnastics': ['Gymnastique artistique', 'Kunstturnen', 'Ginnastica artistica', 'Gimnasia artística', 'Ginástica artística', 'Спортивная гимнастика', 'कलात्मक जिम्नास्टिक', '竞技体操', 'الجمباز الفني', '体操競技', 'Senam artistik'],
  Badminton: ['Badminton', 'Badminton', 'Badminton', 'Bádminton', 'Badminton', 'Бадминтон', 'बैडमिंटन', '羽毛球', 'كرة الريشة', 'バドミントン', 'Bulu tangkis'],
  Baseball: ['Baseball', 'Baseball', 'Baseball', 'Béisbol', 'Beisebol', 'Бейсбол', 'बेसबॉल', '棒球', 'البيسبول', '野球', 'Bisbol'],
  Basket: ['Basket-ball', 'Basketball', 'Pallacanestro', 'Baloncesto', 'Basquete', 'Баскетбол', 'बास्केटबॉल', '篮球', 'كرة السلة', 'バスケットボール', 'Bola basket'],
  'Beach Volley': ['Beach-volley', 'Beachvolleyball', 'Beach volley', 'Vóley playa', 'Vôlei de praia', 'Пляжный волейбол', 'बीच वॉलीबॉल', '沙滩排球', 'الكرة الطائرة الشاطئية', 'ビーチバレー', 'Voli pantai'],
  Bodybuilding: ['Culturisme', 'Bodybuilding', 'Bodybuilding', 'Culturismo', 'Fisiculturismo', 'Бодибилдинг', 'बॉडीबिल्डिंग', '健美', 'كمال الأجسام', 'ボディビル', 'Binaraga'],
  Boxing: ['Boxe', 'Boxen', 'Pugilato', 'Boxeo', 'Boxe', 'Бокс', 'मुक्केबाज़ी', '拳击', 'الملاكمة', 'ボクシング', 'Tinju'],
  Calisthenics: ['Callisthénie', 'Calisthenics', 'Calisthenics', 'Calistenia', 'Calistenia', 'Калистеника', 'कैलिस्थेनिक्स', '自重训练', 'كاليستينكس', 'カリステニクス', 'Kalistenik'],
  'Canoe\\Kayak': ['Canoë\\Kayak', 'Kanu\\Kajak', 'Canoa\\Kayak', 'Piragüismo\\Kayak', 'Canoagem\\Caiaque', 'Каноэ\\Каяк', 'कैनो\\कयाक', '皮划艇', 'الكانوي\\الكاياك', 'カヌー\\カヤック', 'Kano\\Kayak'],
  Cricket: ['Cricket', 'Cricket', 'Cricket', 'Críquet', 'Críquete', 'Крикет', 'क्रिकेट', '板球', 'الكريكيت', 'クリケット', 'Kriket'],
  Curling: ['Curling', 'Curling', 'Curling', 'Curling', 'Curling', 'Кёрлинг', 'कर्लिंग', '冰壶', 'الكيرلنغ', 'カーリング', 'Curling'],
  Cycling: ['Cyclisme', 'Radsport', 'Ciclismo', 'Ciclismo', 'Ciclismo', 'Велоспорт', 'साइकिलिंग', '自行车', 'ركوب الدراجات', '自転車競技', 'Balap sepeda'],
  'Fitness\\Gym': ['Fitness\\Salle de sport', 'Fitness\\Fitnessstudio', 'Fitness\\Palestra', 'Fitness\\Gimnasio', 'Fitness\\Academia', 'Фитнес\\Тренажёрный зал', 'फिटनेस\\जिम', '健身\\健身房', 'اللياقة\\الصالة الرياضية', 'フィットネス\\ジム', 'Kebugaran\\Gym'],
  Football: ['Football', 'Fußball', 'Calcio', 'Fútbol', 'Futebol', 'Футбол', 'फ़ुटबॉल', '足球', 'كرة القدم', 'サッカー', 'Sepak bola'],
  Golf: ['Golf', 'Golf', 'Golf', 'Golf', 'Golfe', 'Гольф', 'गोल्फ़', '高尔夫', 'الغولف', 'ゴルフ', 'Golf'],
  Gymnastic: ['Gymnastique', 'Turnen', 'Ginnastica', 'Gimnasia', 'Ginástica', 'Гимнастика', 'जिम्नास्टिक', '体操', 'الجمباز', '体操', 'Senam'],
  Handball: ['Handball', 'Handball', 'Pallamano', 'Balonmano', 'Handebol', 'Гандбол', 'हैंडबॉल', '手球', 'كرة اليد', 'ハンドボール', 'Bola tangan'],
  'Ice\\Field Hockey': ['Hockey sur glace\\sur gazon', 'Eishockey\\Feldhockey', 'Hockey su ghiaccio\\su prato', 'Hockey sobre hielo\\hierba', 'Hóquei no gelo\\em campo', 'Хоккей с шайбой\\на траве', 'आइस\\फ़ील्ड हॉकी', '冰球\\曲棍球', 'هوكي الجليد\\الميدان', 'アイスホッケー\\フィールドホッケー', 'Hoki es\\lapangan'],
  'Jiu-Jitsu': ['Jiu-jitsu', 'Jiu-Jitsu', 'Jiu-jitsu', 'Jiu-jitsu', 'Jiu-jítsu', 'Джиу-джитсу', 'जुजुत्सु', '柔术', 'الجوجيتسو', '柔術', 'Jiu-jitsu'],
  Judo: ['Judo', 'Judo', 'Judo', 'Judo', 'Judô', 'Дзюдо', 'जूडो', '柔道', 'الجودو', '柔道', 'Judo'],
  Karate: ['Karaté', 'Karate', 'Karate', 'Kárate', 'Caratê', 'Карате', 'कराटे', '空手道', 'الكاراتيه', '空手', 'Karate'],
  Kickboxing: ['Kickboxing', 'Kickboxen', 'Kickboxing', 'Kickboxing', 'Kickboxing', 'Кикбоксинг', 'किकबॉक्सिंग', '自由搏击', 'الكيك بوكسينغ', 'キックボクシング', 'Kickboxing'],
  'Motor Sports': ['Sports mécaniques', 'Motorsport', 'Sport motoristici', 'Deportes de motor', 'Automobilismo', 'Автоспорт', 'मोटर स्पोर्ट्स', '赛车运动', 'رياضة السيارات', 'モータースポーツ', 'Olahraga motor'],
  Netball: ['Netball', 'Netball', 'Netball', 'Netball', 'Netball', 'Нетбол', 'नेटबॉल', '无挡板篮球', 'كرة الشبكة', 'ネットボール', 'Bola jaring'],
  Padel: ['Padel', 'Padel', 'Padel', 'Pádel', 'Padel', 'Падел', 'पैडल', '板式网球', 'البادل', 'パデル', 'Padel'],
  Pilates: ['Pilates', 'Pilates', 'Pilates', 'Pilates', 'Pilates', 'Пилатес', 'पिलेट्स', '普拉提', 'البيلاتس', 'ピラティス', 'Pilates'],
  Polo: ['Polo', 'Polo', 'Polo', 'Polo', 'Polo', 'Конное поло', 'पोलो', '马球', 'البولو', 'ポロ', 'Polo'],
  'Roller Sports': ['Sports de roller', 'Rollsport', 'Sport rotellistici', 'Patinaje sobre ruedas', 'Patinagem', 'Роллер-спорт', 'रोलर स्पोर्ट्स', '轮滑运动', 'رياضات التزلج على العجلات', 'ローラースポーツ', 'Olahraga sepatu roda'],
  Rowing: ['Aviron', 'Rudern', 'Canottaggio', 'Remo', 'Remo', 'Академическая гребля', 'रोइंग', '赛艇', 'التجديف', 'ボート競技', 'Dayung'],
  Rugby: ['Rugby', 'Rugby', 'Rugby', 'Rugby', 'Rúgbi', 'Регби', 'रग्बी', '橄榄球', 'الرجبي', 'ラグビー', 'Rugbi'],
  Sailing: ['Voile', 'Segeln', 'Vela', 'Vela', 'Vela', 'Парусный спорт', 'पाल नौकायन', '帆船', 'الإبحار الشراعي', 'セーリング', 'Layar'],
  Skiing: ['Ski', 'Skisport', 'Sci', 'Esquí', 'Esqui', 'Лыжный спорт', 'स्कीइंग', '滑雪', 'التزلج', 'スキー', 'Ski'],
  Squash: ['Squash', 'Squash', 'Squash', 'Squash', 'Squash', 'Сквош', 'स्क्वैश', '壁球', 'الإسكواش', 'スカッシュ', 'Squash'],
  Surf: ['Surf', 'Surfen', 'Surf', 'Surf', 'Surfe', 'Сёрфинг', 'सर्फिंग', '冲浪', 'ركوب الأمواج', 'サーフィン', 'Selancar'],
  Swim: ['Natation', 'Schwimmen', 'Nuoto', 'Natación', 'Natação', 'Плавание', 'तैराकी', '游泳', 'السباحة', '水泳', 'Renang'],
  'Table Tennis': ['Tennis de table', 'Tischtennis', 'Tennistavolo', 'Tenis de mesa', 'Tênis de mesa', 'Настольный теннис', 'टेबल टेनिस', '乒乓球', 'كرة الطاولة', '卓球', 'Tenis meja'],
  Tennis: ['Tennis', 'Tennis', 'Tennis', 'Tenis', 'Tênis', 'Теннис', 'टेनिस', '网球', 'التنس', 'テニス', 'Tenis'],
  'Track & Fields': ['Athlétisme', 'Leichtathletik', 'Atletica leggera', 'Atletismo', 'Atletismo', 'Лёгкая атлетика', 'एथलेटिक्स', '田径', 'ألعاب القوى', '陸上競技', 'Atletik'],
  Triathlon: ['Triathlon', 'Triathlon', 'Triathlon', 'Triatlón', 'Triatlo', 'Триатлон', 'ट्रायथलॉन', '铁人三项', 'الترياثلون', 'トライアスロン', 'Triatlon'],
  Volley: ['Volley-ball', 'Volleyball', 'Pallavolo', 'Voleibol', 'Voleibol', 'Волейбол', 'वॉलीबॉल', '排球', 'الكرة الطائرة', 'バレーボール', 'Bola voli'],
  Weightlifting: ['Haltérophilie', 'Gewichtheben', 'Sollevamento pesi', 'Halterofilia', 'Levantamento de peso', 'Тяжёлая атлетика', 'भारोत्तोलन', '举重', 'رفع الأثقال', 'ウエイトリフティング', 'Angkat besi'],
  Wrestling: ['Lutte', 'Ringen', 'Lotta', 'Lucha', 'Luta olímpica', 'Борьба', 'कुश्ती', '摔跤', 'المصارعة', 'レスリング', 'Gulat'],
};

/** Hand-made translation of a sport name, or `undefined` for other texts / languages. */
export function sportNameTranslation(english: string, lang: string): string | undefined {
  const row = ROWS[english as EntitySportOption];
  const index = LANGS.indexOf(lang as (typeof LANGS)[number]);
  return row && index >= 0 ? row[index] : undefined;
}
