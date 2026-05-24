/**
 * VisionPark Yönetim Paneli yardım içeriği.
 * Anahtar = route path. F1 / yardım butonu mevcut yola göre buradan içerik alır.
 * Eksik anahtar için fallback "generic" girişi kullanılır.
 */

export type HelpSection = { heading: string; body: string }

export type HelpEntry = {
  title: string
  intro: string
  sections: HelpSection[]
}

export const helpContent: Record<string, HelpEntry> = {
  '/': {
    title: 'Genel Bakış',
    intro:
      'Otoparkın anlık durumunu tek ekranda gösteren ana panodur. Üstteki istatistik kartları otopark doluluk bilgisini, ortadaki canlı kamera/harita modülü YOLO tabanlı araç tespitini, altındaki tablo en son park oturumlarını ve en altta sayfalara hızlı erişim kartları sunar. Veriler 5 saniyede bir otomatik yenilenir.',
    sections: [
      {
        heading: 'İstatistik kartları',
        body:
          'Toplam alan, boş alan, dolu alan ve doluluk oranı kartları üstte yer alır. Bu değerler /admin/stats endpoint\'inden alınır ve her 5 saniyede bir güncellenir. Doluluk oranı yüzdesel olarak ifade edilir; %90 üstü durumlarda yeni gelen müşteri yönlendirmesi için uyarı düşünülmelidir.',
      },
      {
        heading: 'Canlı kamera akışı',
        body:
          'Sekmeli görünümde "Canlı kamera" seçilince MJPEG akışı üzerinden YOLOv11n modelinin çizdiği renkli kutular görünür: yeşil boş, kırmızı dolu, sarı rezerveli. Üstteki HUD çubuğu toplam/boş/dolu sayılarını canlı gösterir. Akış kesilirse "Tekrar Dene" düğmesiyle yeniden bağlanılır; sürekli kesiliyorsa backend\'in çalıştığını ve YOLO modelinin yüklenebildiğini kontrol edin.',
      },
      {
        heading: 'Park haritası',
        body:
          '"Park haritası" sekmesi kameradan bağımsız olarak DB\'deki spot bilgilerini şematik bir grid üzerinde gösterir. Internet bağlantısı veya kamera erişimi olmadığında bu görünüm daima çalışır.',
      },
      {
        heading: 'Son oturumlar tablosu',
        body:
          'Sayfanın orta bölümünde en son 8 park oturumu (alan numarası, başlangıç saati, bitiş saati, ücret, durum) listelenir. Tam liste ve filtreleme için sol menüden "Raporlar ve İstatistikler" sayfasına geçin.',
      },
      {
        heading: 'Hızlı Erişim kartları',
        body:
          'Sayfanın en altındaki kartlar diğer panel sayfalarının özetini sunar ve tıklandığında doğrudan o sayfaya gider. Yönetici rolündeyseniz tüm kartları, operatör rolündeyseniz sadece Kullanıcı Kılavuzu ve Ayarlar kartlarını görürsünüz.',
      },
      {
        heading: 'Rol notu',
        body:
          'Bu sayfa hem Yönetici hem Operatör rollerine açıktır. Operatörler diğer sayfaları (park alanı editörü, raporlar, fiyatlandırma) göremez; yalnızca Genel Bakış, Kullanıcı Kılavuzu ve Ayarlar üzerinden çalışır.',
      },
    ],
  },

  '/park-alanlari': {
    title: 'Park Alanlarını Düzenle',
    intro:
      'Otopark sahasındaki fiziksel park alanlarının kamera görüntüsü üzerinde dikdörtgen çizilerek tanımlandığı editördür. YOLO tabanlı doluluk tespiti bu dikdörtgen koordinatlarına göre çalışır; doğru çizilmiş alanlar = doğru doluluk verisi. Bu sayfaya yalnızca Yönetici rolü erişebilir.',
    sections: [
      {
        heading: 'Çalışma mantığı',
        body:
          'Video akışından alınan tek bir kare üzerinde çizdiğiniz her dikdörtgen, bir Spot kaydı olarak DB\'ye yazılır. YOLO her döngüde tespit ettiği araç bounding box\'larını bu spot bbox\'larıyla karşılaştırır (IoU eşiği 0.30) ve sonuçları "boş/dolu" olarak yayınlar.',
      },
      {
        heading: 'Yeni alan çizme',
        body:
          'Sağ üstte "Çizim Modu" düğmesine basın, ardından arka plandaki video karesi üzerinde fareyle bir köşeden çekerek dikdörtgen oluşturun. Çizim tamamlanınca panelde bir form açılır: bölüm (A–H) ve sıra numarası varsayılan olarak otomatik atanır, gerekirse manuel değiştirilir.',
      },
      {
        heading: 'Düzenleme ve taşıma',
        body:
          'Bir alanın üzerine tıkladığınızda seçili hale gelir; köşelerinden tutup sürükleyerek yeniden boyutlandırın, ortasından tutup taşıyın. Sağ paneldeki form üzerinden spot numarası, bölüm veya sıra etiketini güncelleyin.',
      },
      {
        heading: 'Toplu kaydet',
        body:
          'Sayfa üstündeki "Kaydet" düğmesi tüm çizimleri tek bir POST /admin/spots/bulk isteğiyle DB\'ye yazar. Mevcut tüm spotlar silinir ve yenisiyle değiştirilir — bu yüzden silmek istediğiniz spotları kaldırarak kaydetmek yeterlidir, "Sil" akışı çoğunlukla gerekmez.',
      },
      {
        heading: 'Tümünü Sil',
        body:
          '"Tümünü Sil" düğmesi onayınızla aktif otoparkın tüm park alanlarını kaldırır — geri alınamaz, dikkatli kullanın. Kaza ile silerseniz, Ayarlar > Yedek Geri Yükle yoluyla son aldığınız .db yedeğinden geri dönebilirsiniz.',
      },
      {
        heading: 'Otomatik pipeline yenilemesi',
        body:
          'Değişiklikler kaydedildikten sonra arka planda çalışan video stream pipeline\'ı yeni spot listesini otomatik olarak yeniden yükler (reload_spots fonksiyonu tetiklenir). Mobil uygulamadaki park haritası da WebSocket / GET /spots üzerinden anında günceller.',
      },
      {
        heading: 'İpuçları',
        body:
          'Dikdörtgenleri olabildiğince gerçek park alanı sınırlarına yakın çizin. Aşırı büyük çizilmiş bir alan, geçen aracı yanlışlıkla "dolu" olarak işaretleyebilir. Çok küçük alanlar ise gerçek aracı gözden kaçırır. Her bölüm için (A, B, C...) sıra numaralarını 1\'den başlayarak sıralı tutun; raporlamada bu numara müşteriye gösterilir.',
      },
    ],
  },

  '/oturumlar': {
    title: 'Raporlar ve İstatistikler',
    intro:
      'Tüm park oturumlarının listelendiği, gelir/oturum sayısı grafiklerinin gösterildiği ve gün sonu (Z) raporunun çıkarıldığı sayfadır. Operasyonel raporlama, ciro takibi ve müşteri sorgulama bu sayfadan yapılır. Yalnızca Yönetici rolü erişebilir.',
    sections: [
      {
        heading: 'Oturum tablosu',
        body:
          'Tüm geçmiş park oturumları varsayılan olarak başlama saatine göre tersten (en yeni üstte) sıralı listelenir. Tablo sütunları: oturum ID, alan numarası, plaka, müşteri adı/e-postası, başlangıç, bitiş, ücret, durum, ödeme yöntemi.',
      },
      {
        heading: 'Arama ve filtreleme',
        body:
          'Üstteki arama kutusu ID, alan numarası, müşteri adı, e-posta ve plaka alanlarında geniş arama yapar. Durum filtresi aktif/biten/iptal olarak sınıflandırır. Tarih aralığı filtresi (başlangıç ve bitiş tarihi) ile belli bir döneme odaklanın.',
      },
      {
        heading: 'Gelir/Oturum grafiği',
        body:
          'Tablonun üstündeki grafik bölümünde dönem seçici (günlük, haftalık, aylık, yıllık) ile çift eksenli bir grafik açılır: sol eksende gelir (TRY), sağ eksende oturum sayısı. Veriler /admin/reports/timeseries endpoint\'inden alınır ve seçili dönem boyunca toplulaştırılır.',
      },
      {
        heading: 'Z raporu (gün sonu)',
        body:
          'Sayfanın "Z raporu" bölümünden tarih seçip o gün için kapanış raporu üretirsiniz: toplam tahsil edilen ücret, biten oturum sayısı, ortalama park süresi, en uzun ve en kısa oturum. "Yazdır" düğmesi tarayıcının yazdırma diyaloğunu açar; çıktıda yalnızca rapor görünür (sidebar ve top bar otomatik gizlenir — print: Tailwind sınıfları).',
      },
      {
        heading: 'CSV dışa aktarım',
        body:
          'Filtrelenmiş oturum listesini CSV olarak "CSV indir" düğmesiyle çekebilirsiniz. Dosya Excel, LibreOffice veya muhasebe yazılımıyla açılır. Sütun başlıkları Türkçe ve UTF-8 BOM ile başlar (Excel\'de bozulmaz).',
      },
      {
        heading: 'Komisyon raporu notu',
        body:
          'Bitirme tezi komisyonunun "Raporlama" maddesi için Z raporu ve CSV dışa aktarımı birlikte yeterlidir. Aylık özetler için dönem seçici "Aylık" konumuna alınıp ekran görüntüsü veya yazdırma yapılır.',
      },
    ],
  },

  '/kullanicilar': {
    title: 'Kullanıcılar',
    intro:
      'Sisteme kayıtlı tüm yönetici, operatör ve müşteri hesaplarının listelendiği yönetim sayfasıdır. Bu sayfaya yalnızca Yönetici rolü erişebilir. Roller anında değiştirilir, hesaplar pasifleştirilir veya kalıcı olarak silinir.',
    sections: [
      {
        heading: 'Rol türleri',
        body:
          'Yönetici: tüm panele erişir, yedekleme/restore yapabilir, kullanıcı yönetir. Operatör: yalnızca Genel Bakış, Kullanıcı Kılavuzu ve Sistem (sınırlı) sayfalarını görür; yönetim eylemleri yapamaz. Müşteri: yalnızca mobil uygulamayı kullanır, panel girişi yapamaz.',
      },
      {
        heading: 'Yeni kullanıcı ekleme',
        body:
          'Sağ üstteki "Yeni Kullanıcı" düğmesiyle e-posta, opsiyonel ad-soyad, en az 8 karakter şifre ve rol seçerek hesap oluşturursunuz. Eklenen kullanıcı varsayılan olarak aktif konumdadır.',
      },
      {
        heading: 'Rol değiştirme',
        body:
          'Tablodaki rol etiketi bir açılır listedir; tıklayarak Yönetici / Operatör / Müşteri arasında geçiş yaparsınız. Son aktif yöneticinin rolü değiştirilemez (sistemden kilitlenmemek için).',
      },
      {
        heading: 'Aktif / Pasif durumu',
        body:
          'Durum rozetine tıklayarak hesabı aktive/pasifize edersiniz. Pasif kullanıcı giriş yapamaz; ancak geçmiş kayıtları ve oturumları sistemde kalır. Son aktif yönetici pasifleştirilemez.',
      },
      {
        heading: 'Filtreleme ve arama',
        body:
          'Üst chip\'lerle role göre filtreleme, arama kutusuyla e-posta veya ad araması yaparsınız. Her chip o role ait kullanıcı sayısını gösterir.',
      },
      {
        heading: 'İhlal sayacı',
        body:
          '"İhlal" sütunu müşterinin geç gelen rezervasyon sayısını gösterir. 2 ihlal sonrasında müşteri hesabı otomatik silinir (mobil tarafta uyarı görüntülenir).',
      },
      {
        heading: 'Silme',
        body:
          'Çöp ikonuyla bir hesap kalıcı olarak silinir; onay alınır. Kendi hesabınızı bu yoldan silemezsiniz; ayrıca son yönetici silinemez.',
      },
    ],
  },

  '/sistem': {
    title: 'Sistem',
    intro:
      'Fiyatlandırma, genel ayarlar ve sistem sağlığı kontrolleri tek sayfada üç sekme altında toplanmıştır. URL\'nin sonundaki hash (#pricing, #general, #health) doğrudan ilgili sekmeye atlamayı sağlar.',
    sections: [
      {
        heading: 'Fiyatlandırma sekmesi',
        body:
          'Ücretsiz dakika + 6 kademeli tarife yapısı (0–1, 1–2, 2–4, 4–8, 8–12, 12+ saat) burada düzenlenir. Değişiklikler kaydedildiği an mobil uygulamadaki fiyat listesi ve yeni park oturumları için geçerli olur.',
      },
      {
        heading: 'Genel Ayarlar sekmesi',
        body:
          'Bildirim tercihleri (e-posta, doluluk uyarısı, gelir raporu — şu anda görsel), hesap durumu görüntüleme, oturum kapatma ve veritabanı yedekleme bu sekmededir. Yedekleme yalnızca Yönetici rolüne görünür.',
      },
      {
        heading: 'Sistem Sağlığı sekmesi',
        body:
          'Backend Python sürümü, platform, veritabanı tipi/boyutu/yolu, YOLO model durumu/cihazı ve aktif oturum sayısı gibi durum bilgileri gösterilir. Sayfa her 10 saniyede bir otomatik yenilenir.',
      },
      {
        heading: 'Veritabanı yedekleme',
        body:
          '"Yedeği İndir" sistem çalışırken bile tutarlı bir SQLite snapshot indirir; arka planda sqlite3 .backup API\'si çalışır. "Geri Yükle" daha önce indirilmiş bir .db dosyasını sisteme yükler; mevcut DB otomatik olarak zaman damgalı yedeklenir, sonrasında backend\'i yeniden başlatmanız gerekir.',
      },
      {
        heading: 'Son yedekler',
        body:
          'Sistem Sağlığı sekmesindeki "Son Yedekler" listesi, geri yükleme sırasında oluşturulmuş pre_restore yedek dosyalarını gösterir. Bunlar manuel kurtarma için tutulur; geçersiz bir geri yüklemeden sonra bu dosyalardan birini tekrar yükleyerek eski hale dönebilirsiniz.',
      },
      {
        heading: 'Rol erişimi',
        body:
          'Operatör bu sayfayı görür ancak Fiyatlandırma sekmesindeki kaydet düğmeleri arka uç tarafından reddedilir; yedekleme alanları görünmez. Yönetici tüm sekmelere ve eylemlere erişir.',
      },
    ],
  },

  '/fiyatlandirma': {
    title: 'Fiyatlandırma',
    intro:
      'Park ücretlendirmesinin tanımlandığı sayfadır. Ücretsiz dakika + 6 kademeli (saat dilimli) tarife yapısı kullanılır. Para birimi sabit olarak Türk Lirası (TRY). Değişiklikler hem mobil uygulamada hem yeni park oturumlarında anında etkili olur. Yalnızca Yönetici rolü erişebilir.',
    sections: [
      {
        heading: 'Ücretsiz dakika',
        body:
          'Park başlangıcından itibaren ücret hesaplanmadan geçen süre. 0–1440 (24 saat) arasında değer kabul edilir. Örneğin 10 dakika tanımlanırsa, 10 dakika içinde çıkış yapan kullanıcı ücret ödemez. Bu özellik kısa süreli "indir-bindir" amaçlı durdurmalar için faydalıdır.',
      },
      {
        heading: 'Kademeli tarife sistemi',
        body:
          'Süre 6 dilime ayrılır: 0–1 saat, 1–2 saat, 2–4 saat, 4–8 saat, 8–12 saat ve 12 saat üzeri (tam gün). Her dilim için ayrı bir fiyat tanımlanır. Hesaplama kümülatif değildir: müşterinin toplam park süresi hangi dilime denk geliyorsa o dilim için belirlenen ücret çekilir.',
      },
      {
        heading: 'Örnek hesaplama',
        body:
          '0–1 saat: 25₺ / 1–2 saat: 45₺ / 2–4 saat: 80₺ tanımladığınızda: 45 dakika park eden 25₺ öder. 1 saat 30 dakika park eden 45₺ öder. 3 saat park eden 80₺ öder.',
      },
      {
        heading: 'Kaydet ve anında etki',
        body:
          'Form aşağıdaki "Kaydet" düğmesi PUT /admin/pricing isteğini gönderir. Yanıt başarılıysa: (1) Mobil uygulama GET /pricing çağırınca yeni tarifeyi alır, (2) Devam eden oturumların ücreti çıkışta yeni tarifeden hesaplanır, (3) Geçmişe etkili değildir, daha önce kapanmış oturumlar değişmez.',
      },
      {
        heading: 'Stratejik notlar',
        body:
          'Düşük doluluk saatlerinde (gece) tarifeyi indirmek, yüksek doluluk saatlerinde tarifeyi artırmak gibi dinamik fiyatlandırma için bu sayfayı sezgisel olarak kullanın. İleri sürümlerde "saat dilimine göre otomatik tarife" özelliği planlanmaktadır.',
      },
    ],
  },

  '/ayarlar': {
    title: 'Ayarlar',
    intro:
      'Hesap, bildirim tercihleri, veritabanı yedekleme ve oturum işlemleri bu sayfadan yönetilir. Hem yönetici hem operatör erişebilir; fakat yedekleme ve geri yükleme yalnızca yönetici tarafından kullanılabilir.',
    sections: [
      {
        heading: 'Hesap',
        body:
          'Mevcut oturum sahibinin rolü (Yönetici / Operatör) ve hesap durumu (Aktif / Pasif) gösterilir. Şifre değiştirme ve hesap düzeyinde profil güncelleme ileri sürümde eklenecektir.',
      },
      {
        heading: 'Bildirim ayarları',
        body:
          'E-posta bildirimleri, doluluk uyarıları ve günlük gelir raporu seçenekleri toggleler halinde gösterilir. NOT: Bu toggleler şu anda yerel görseldir; arka planda bir bildirim servisine bağlı değildir. İleri sürümde SMTP veya push servisine bağlanacaktır.',
      },
      {
        heading: 'Veritabanı yedeği indir',
        body:
          'Sistem aktifken bile tutarlı bir SQLite snapshot indirir. Arka planda sqlite3 .backup API\'si çalışır; canlı yazımlar bozulmaz. Dosya adı: carparking_<tarih>_<saat>.db. İndirilen dosyayı bulut depolama (Drive, Dropbox) veya harici diske kopyalayarak yedek stratejinizi tamamlayın.',
      },
      {
        heading: 'Veritabanı geri yükleme',
        body:
          'Daha önce indirilmiş bir .db dosyasını sisteme yükler. Üç aşamalı onay vardır (dosya seç → devam et → geri yükle). Yüklenen dosya SQLite imzası ve "PRAGMA integrity_check" ile doğrulanır. Doğrulama geçerse: mevcut DB, *_pre_restore_<zaman>.db adıyla otomatik yedeklenir, yeni dosya yerine konur, bağlantı havuzu kapatılır. SONRA backend\'i yeniden başlatmanız gerekir.',
      },
      {
        heading: 'Geri yükleme uyarıları',
        body:
          'Geri yükleme tüm mevcut veriyi (kullanıcılar, oturumlar, ödemeler, spotlar) değiştirir. Yanlış dosya seçerseniz ve onaylarsanız mevcut DB otomatik yedeklenir; yine de "pre_restore" dosyasını silmeyin. Hatalı geri yükleme sonrasında pre_restore dosyasını manuel olarak yeniden geri yükleyerek eski hale dönebilirsiniz.',
      },
      {
        heading: 'Oturumu kapat',
        body:
          '"Tehlikeli Bölge" altında yer alan kırmızı düğme oturumu sonlandırır ve sizi giriş sayfasına yönlendirir. JWT token tarayıcının localStorage\'ından silinir; başka kullanıcılarla paylaşılan bilgisayarlarda kullanım sonrası mutlaka çıkış yapın.',
      },
    ],
  },

  '/kilavuz': {
    title: 'Kullanıcı Kılavuzu',
    intro:
      'VisionPark Yönetim Panelinin tüm bölümlerine ilişkin kapsamlı rehberdir. Her sayfada F1 tuşuyla veya üst bardaki "?" simgesiyle o sayfaya özel kısa yardım açılabilir. Bu sayfa tüm bölümleri tek yerde toplu olarak gösterir ve yazıcıdan kâğıt çıktı almaya uygundur.',
    sections: [
      {
        heading: 'Hızlı erişim',
        body:
          'Sayfanın üst kısmındaki içindekiler listesi kullanılarak ilgili bölüme atlanır. Ctrl+P (Cmd+P) ile yazıcıya gönderilir; çıktıda sidebar/top bar gizlenir, yalnızca kılavuz içeriği basılır.',
      },
      {
        heading: 'Roller',
        body:
          'Sistem iki rol tanır: Yönetici (her şeye erişir) ve Operatör (yalnızca Genel Bakış, Kullanıcı Kılavuzu ve Ayarlar sayfalarını görür). Operatörün Ayarlar sayfasında yedekleme/geri yükleme alanı erişilemez konumdadır.',
      },
      {
        heading: 'Klavye kısayolları',
        body:
          'F1 → bulunduğunuz sayfaya özel yardım çekmecesini açar/kapatır. Esc → açık çekmeceyi kapatır. Üst bardaki "Yardım" düğmesi F1 ile aynı işlevi görür.',
      },
      {
        heading: 'Mobil uygulama bağlantısı',
        body:
          'Yönetim paneli ile aynı backend\'e bağlı VisionPark mobil uygulaması müşteriler için kullanılır. Mobil tarafta da her ekranın sağ üstündeki "?" simgesinden o ekrana özel yardım açılır; Profil > "Yardım ve Rehber" yolundan tam kılavuza ulaşılır.',
      },
      {
        heading: 'Komisyon değerlendirme listesi',
        body:
          'Bu sistem bitirme projesi komisyonunun belirlediği gereksinim maddelerini karşılar: (2) F1 + Kullanıcı Kılavuzu, (5) Yönetim paneli + Yetkilendirme, (6) Yedekleme/Geri alma, (7) Raporlama. Diğer maddeler (kurulum uygulaması, mobil APK, hosting) ya devre dışı bırakıldı (web/mobil mimari) ya da deploy aşamasında ele alınacaktır.',
      },
      {
        heading: 'Destek',
        body:
          'Sorularınız için sistem yöneticinizle iletişime geçin. Hata raporlarken sayfa adı, hatanın yaşandığı saat, ekran görüntüsü ve mümkünse tarayıcı konsol logu ekleyin.',
      },
    ],
  },
}

/** Bilinmeyen route için fallback. */
export const helpFallback: HelpEntry = {
  title: 'Yardım',
  intro:
    'Bu sayfa için henüz özel yardım metni yazılmadı. Sol menüden "Kullanıcı Kılavuzu" üzerinden tam rehbere ulaşabilirsiniz.',
  sections: [],
}

/** Sıralı liste — UserGuidePage tablo-of-contents için kullanılır. */
export const helpOrder: string[] = [
  '/',
  '/park-alanlari',
  '/oturumlar',
  '/kullanicilar',
  '/sistem',
  '/kilavuz',
]
