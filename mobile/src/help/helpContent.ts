/**
 * Mobil uygulama yardım içeriği.
 * Anahtar = mantıksal ekran adı (route path'i değil, sabit bir etiket).
 * Header'daki "?" butonu ya da Yardım sayfası bu sözlükten içeriği çeker.
 */

export type HelpSection = { heading: string; body: string }

export type HelpEntry = {
  title: string
  intro: string
  sections: HelpSection[]
}

export type HelpKey =
  | 'home'
  | 'parking'
  | 'profile'
  | 'park-now'
  | 'reserve-now'
  | 'park-entry-qr'
  | 'park-exit-qr'
  | 'parking-detail'
  | 'my-cars'
  | 'payment-cards'
  | 'parking-history'
  | 'settings'

export const helpContent: Record<HelpKey, HelpEntry> = {
  home: {
    title: 'Ana Sayfa',
    intro:
      'Ana sayfa, VisionPark uygulamasını ilk açtığınızda gördüğünüz karşılama ekranıdır. Burada otoparkın güncel doluluk durumu, akıllı park önerisi, varsa aktif park oturumunuz, ücret tarifeleri, geçmiş park kayıtlarınız, kayıtlı araç ve kartlarınız tek bir akışta listelenir. Sayfa her açıldığında veriler arka planda yenilenir.',
    sections: [
      {
        heading: 'Hoşgeldin başlığı',
        body:
          'Üst kısımda günün saatine göre (Günaydın / İyi günler / İyi akşamlar) bir karşılama mesajı ve ekran üstündeki logo görünür. Giriş yaptıysanız adınız, henüz giriş yapmadıysanız "Misafir" olarak hitap edilir.',
      },
      {
        heading: 'Aktif Park Banner',
        body:
          'Şu anda devam eden bir park oturumunuz varsa, hemen başlıkın altında yeşil bir banner görünür. Banner üzerinde park ettiğiniz alanın numarası, başlangıç saati ve süre yer alır. Dokunarak çıkış QR ekranına atlayabilirsiniz.',
      },
      {
        heading: 'Akıllı Park Önerisi',
        body:
          'Sistem, otoparktaki ilk uygun (boş ve rezerve edilmemiş) park alanını otomatik olarak öne çıkarır. "Şuraya park et" kartına dokunduğunuzda doğrudan park başlatma akışına yönlendirilirsiniz. Sayfa açıldığı sırada müsait alan yoksa öneri görünmez.',
      },
      {
        heading: 'Doluluk Durumu',
        body:
          'Otoparkın toplam alan sayısı, boş alan, dolu alan ve rezerve sayıları renkli kutucuklarda gösterilir. Bu bilgiler /spots endpoint\'inden alınır ve sayfa her yenilendiğinde güncellenir.',
      },
      {
        heading: 'Fiyat Tarifesi',
        body:
          'Ücretsiz dakika + saatlik kademeli tarife dilimleri otomatik kayan kartlar şeklinde sunulur. 10 saniyede bir bir sonraki dilime geçer; isterseniz parmakla kaydırarak inceleyebilirsiniz. Fiyatlar yöneticinin son yaptığı güncellemeye göre değişir.',
      },
      {
        heading: 'Park Geçmişiniz',
        body:
          'Son 20 park oturumunuz yatay olarak sıralanır. Her kart üzerinde alan numarası, tarih, süre ve ödenen ücret yer alır. Tam liste için "Park Geçmişi" sayfasına geçebilirsiniz.',
      },
      {
        heading: 'Araçlarım ve Kartlarım',
        body:
          'Kayıtlı araçlarınız ve ödeme kartlarınız yatay listelerde gösterilir. Hızlı bakış sağlar; ekleme/düzenleme için Profil sekmesinden ilgili sayfalara gidersiniz.',
      },
      {
        heading: 'Yenileme',
        body:
          'Ekranı aşağı çekerek (pull-to-refresh) verileri manuel yenileyebilirsiniz. Çoğu veri kendi başına da arka planda güncellenir.',
      },
    ],
  },

  parking: {
    title: 'Park / Rezervasyon',
    intro:
      'Park sekmesi, otoparkta yer ayırtmak veya hemen park etmek için kullanacağınız iki ana akışın giriş noktasıdır. Sekmenin ortasındaki iki büyük kart sizi ilgili akışa götürür. Giriş yapmadıysanız önce hesabınıza giriş yapmanız (veya kayıt olmanız) istenir.',
    sections: [
      {
        heading: 'Hemen Park Et',
        body:
          'Şu an boş bir alana anında park etmek için kullanılır. Kart üzerine dokunduğunuzda alan seçimi → araç seçimi → ödeme yöntemi → özet → giriş QR akışı başlar. Tüm akış yaklaşık 30 saniye sürer.',
      },
      {
        heading: 'Rezervasyon Yap',
        body:
          'Gün içi belirli bir saat için yer ayırtmak istediğinizde bu kart kullanılır. Aynı seçim adımlarına ek olarak rezervasyon başlangıç saati seçeceksiniz. Rezervasyonunuzdan en geç 10 dakika sonra giriş QR\'ını okutmazsanız rezervasyon iptal olur.',
      },
      {
        heading: 'Giriş Doğrulaması',
        body:
          'Her iki akış da kayıtlı araçlarınız ve ödeme kartlarınızdan en az birine sahip olmanızı bekler. Eksikseniz akış sırasında ilgili eklemeye yönlendirilirsiniz.',
      },
      {
        heading: 'Misafir kullanım',
        body:
          'Giriş yapmamış kullanıcılar bu sekmeyi görür ancak kartlara dokununca otomatik olarak kayıt/giriş ekranına yönlendirilir. Kayıt sonrasında kaldıkları yerden devam ederler.',
      },
    ],
  },

  profile: {
    title: 'Profil',
    intro:
      'Profil sekmesi, hesabınızla ilgili tüm bilgilere ulaşacağınız merkezdir. Buradan park geçmişinize, kayıtlı araçlarınıza, ödeme kartlarınıza, ayarlarınıza ve yardım rehberine geçiş yapabilirsiniz. Misafir kullanıcılar için bu sekme aynı zamanda giriş/kayıt ekranını barındırır.',
    sections: [
      {
        heading: 'Hesap kartı',
        body:
          'Ekranın üstünde adınız, e-postanız ve hesap baş harfinizden oluşan bir avatar görünür. Bu kart sizin hesap bağlamınızı gösterir.',
      },
      {
        heading: 'Park Geçmişim',
        body:
          'Tüm geçmiş park oturumlarınızı tarih sırasında listeleyen sayfaya götürür. Aktif, biten ve iptal edilen kayıtlar filtre ile ayrılır.',
      },
      {
        heading: 'Araçlarım',
        body:
          'Sisteme kayıtlı plaka(lar)ınızı yönetir. Park ederken otomatik seçim için bir aracı "tercih edilen" olarak işaretleyebilirsiniz.',
      },
      {
        heading: 'Ödeme Yöntemleri',
        body:
          'Park ücretinin çekileceği kredi/banka kartlarınızı kaydeder. Yalnızca son 4 hane + marka tutulur; tam kart numarası saklanmaz.',
      },
      {
        heading: 'Ayarlar',
        body:
          'Profil güncelleme, şifre değiştirme, hesap silme gibi işlemler için Ayarlar sayfasına geçer.',
      },
      {
        heading: 'Yardım ve Rehber',
        body:
          'Şu an okuduğunuz tam kılavuza ulaşırsınız. Tüm ekranların detaylı açıklaması burada toplanmıştır.',
      },
      {
        heading: 'Çıkış',
        body:
          'En altta yer alan kırmızı "Çıkış yap" butonu oturumunuzu sonlandırır. Token cihazınızdan silinir; bir sonraki açılışta tekrar giriş yapmanız istenir.',
      },
    ],
  },

  'park-now': {
    title: 'Hemen Park Et',
    intro:
      'Bu ekran, anında boş bir park alanına yerleşmek için kullanılır. 4 adımdan oluşan bir akıştır: alan → araç → ödeme kartı → özet ve giriş QR. Akış boyunca 5 dakika işlem yapmazsanız (idle), otomatik olarak ana sayfaya dönersiniz ve seçimleriniz sıfırlanır.',
    sections: [
      {
        heading: '1) Park Alanı Seçimi',
        body:
          'Ekranın üst kısmında otoparkın bölümleri (A, B, C ...) sekmeler halinde görünür. Her sekmedeki sayılar o bölümün toplam/boş/dolu durumunu özetler. Bir bölüme dokunduğunuzda altında alan numaralı kareler belirir: yeşil = boş, kırmızı = dolu, sarı = rezerveli. Yeşil bir kareye dokunarak seçim yaparsınız.',
      },
      {
        heading: '2) Araç Seçimi',
        body:
          'Tercih edilen olarak işaretlediğiniz araç otomatik seçili gelir. Birden fazla aracınız varsa "Değiştir" diyerek başka birini seçebilirsiniz. Kayıtlı aracınız yoksa "Yeni araç ekle" yoluyla Araçlarım sayfasında plaka eklersiniz, ardından akışa geri dönersiniz.',
      },
      {
        heading: '3) Ödeme Kartı Seçimi',
        body:
          'Tercih edilen kart varsayılan olarak seçilidir. "Değiştir" ile başka kart seçebilir veya yeni kart ekleme akışına geçebilirsiniz. Park ücreti çıkışta otomatik bu karttan çekilecektir.',
      },
      {
        heading: '4) Plan Özeti',
        body:
          'Önceki adımdaki seçimleriniz tek ekranda özetlenir: araç, kart, alan, tahmini fiyat. "Fiyat listesini gör" düğmesi ile saatlik tarife detayını gözden geçirebilirsiniz. Uyarı bilgisi olarak QR taranana kadar oturumun başlamayacağı belirtilir.',
      },
      {
        heading: '5) Giriş QR Ekranı',
        body:
          '"Devam et" dokunulduğunda Giriş QR ekranına geçersiniz. Bu QR\'ı otopark kapısındaki cihaza okuttuğunuzda oturumunuz başlar ve ücretlendirme tetiklenir.',
      },
      {
        heading: 'İdle koruması',
        body:
          'Yanlışlıkla ekranı açıp bırakırsanız 5 dakika sonra sistem akışı iptal eder. Bu sayede başkalarının alanı bloke etmesi engellenir.',
      },
      {
        heading: 'Hata durumları',
        body:
          'Seçtiğiniz alan başka bir kullanıcı tarafından alınırsa veya rezerve edilirse uyarı belirir ve farklı bir alan seçmeniz istenir. Aynı anda birden fazla aktif oturum açılamaz.',
      },
    ],
  },

  'reserve-now': {
    title: 'Rezervasyon Yap',
    intro:
      'Hemen Park Et akışına benzer fakat alan seçiminin yanında rezervasyon başlangıç saatini de seçersiniz. Bu sayede yola çıkmadan önce kendinize yer ayırırsınız. Rezervasyon kuralı: belirlenen saatten itibaren 10 dakika içinde giriş QR\'ı taranmazsa rezervasyon iptal olur ve ihlal sayacınız artar.',
    sections: [
      {
        heading: '1) Alan Seçimi',
        body:
          'Park-Now ile aynıdır; bölümler ve renkli kareler. Yalnızca boş alanlar (yeşil) rezerve edilebilir; rezerve edilen alanlar artık sarı görünür ve başkaları tarafından seçilemez.',
      },
      {
        heading: '2) Saat Seçimi',
        body:
          'Varsayılan olarak şu andan 15 dakika sonrası önerilir. iOS ve Android\'de yerel saat seçici açılır, web sürümünde HH:MM formatlı metin kutusu görünür. En geç o günün 23:59\'una kadar bir saat seçebilirsiniz.',
      },
      {
        heading: '3) Araç ve Kart',
        body:
          'Park-Now ile aynıdır. Rezervasyon esnasında ücret çekilmez; ücret giriş QR\'ı taradığınızda başlatılan oturumun çıkışında alınır.',
      },
      {
        heading: 'Geç Giriş Kuralı',
        body:
          'Rezervasyon başlangıç saatinden 10 dakika sonra hâlâ otoparka girmemişseniz, rezervasyon "expired" durumuna geçer ve kayıt edilir. İki kez tekrar ettiğinde hesabınız otomatik olarak silinir — bu uyarı plan özeti ekranında size hatırlatılır.',
      },
      {
        heading: 'Erken Giriş',
        body:
          'Rezervasyon saatinizden önce de gelebilirsiniz; rezervasyonunuz aktif olduğu sürece alan sizin için tutulur. Mobil app\'in çıkış QR\'ını okuttuğunuzda mevcut oturum biter ve aynı kullanıcı yeni bir oturum açabilir.',
      },
    ],
  },

  'park-entry-qr': {
    title: 'Giriş QR Kodu',
    intro:
      'Park oturumunuzu başlatacak kişiye özel benzersiz QR kodudur. Akışın son adımıdır: bu QR otopark girişindeki tarayıcı tarafından okunduğunda kayıt sistemde "aktif" hale gelir ve ücretlendirme başlar. QR kodu 10 dakika geçerlidir; süre dolarsa yenisini oluşturabilirsiniz.',
    sections: [
      {
        heading: 'QR\'ı Nereye Okutmalıyım',
        body:
          'Otoparkın giriş noktasında bulunan kamera/tarayıcı cihazına ekranınızı yaklaştırın. Sistem kodu tanır tanımaz alanınız "dolu" duruma geçer, bu ekran otomatik kapanır ve aktif oturum bildirimi görürsünüz.',
      },
      {
        heading: 'Geçerlilik Süresi',
        body:
          'QR kodunun 10 dakikalık bir TTL\'si vardır. Geri sayım sayacı ekranda görünür. Süreniz dolarsa altta "Yeni QR Oluştur" butonu görünür; bir önceki niyet iptal edilip yenisi oluşturulur.',
      },
      {
        heading: 'İptal',
        body:
          '"İptal et" dokunulduğunda QR ekranı kapanır ve henüz başlatılmamış niyet kaydı (parking_intent) iptal edilir. Park oturumu açılmadığı için ücret de çekilmez.',
      },
      {
        heading: 'Sorun Yaşarsanız',
        body:
          'QR taranmıyor veya ekran kararıyorsa: ekran parlaklığını artırın, kamera lensine doğru ve yaklaşık 15-20 cm mesafede tutun. Sorun devam ederse otopark personeline başvurun.',
      },
      {
        heading: 'KVKK Bilgisi',
        body:
          'QR kodunda kişisel bilgileriniz yoktur. Sadece sistem tarafından üretilmiş rastgele bir token bulunur. Token tarandığında backend hangi kullanıcıya/alana ait olduğunu kendi veritabanından çıkarır.',
      },
    ],
  },

  'park-exit-qr': {
    title: 'Çıkış QR Kodu',
    intro:
      'Aktif park oturumunuzu sonlandırmak için kullanılır. Çıkış kamerasına okuttuğunuzda toplam süre, ücret hesabı ve kartınızdan tahsilat otomatik gerçekleşir. Ardından bu ekran otomatik kapanır ve ana sayfada başarı bildirimi belirir.',
    sections: [
      {
        heading: 'Çıkış Süreci',
        body:
          'QR\'ı kameraya tutun. Sistem oturumu kapatır, ücretinizi hesaplar (geçen süre × tarife), kayıtlı kartınızdan otomatik tahsil eder ve makbuzu Park Geçmişiniz\'e ekler. Süre uzamaması için QR\'ı çıkıştan hemen önce oluşturmanız önerilir.',
      },
      {
        heading: 'Geçerlilik',
        body:
          'Çıkış QR\'ı da 10 dakika geçerlidir. Süre dolduktan sonra okutulursa "Yeni QR Oluştur" diyerek yenisini alırsınız; aktif oturumunuz kapanmadığı için endişe etmeyin.',
      },
      {
        heading: 'Otomatik Geri Dönüş',
        body:
          'Sistem tarafında oturum kapanır kapanmaz mobil uygulama bunu poll ile fark eder ve sizi otomatik olarak ana sayfaya yönlendirir.',
      },
      {
        heading: 'Ödeme Sorunu',
        body:
          'Kartınızdan ödeme alınamazsa size bildirilir ve manuel olarak başka bir kart seçmeniz istenir. Demo sürümünde gerçek ödeme entegrasyonu yoktur; ücret kayıt amaçlı tutulur.',
      },
    ],
  },

  'parking-detail': {
    title: 'Aktif Park Detayı',
    intro:
      'Aktif park oturumunuzun canlı detayları. Hangi alandasınız, ne kadar süredir park ettiniz, anlık tahmini ücretiniz nedir — hepsi bir ekranda. Sayaç saniye saniye günceller.',
    sections: [
      {
        heading: 'Hero kart (canlı sayaç)',
        body:
          'Üstteki lacivert kartta CANLI etiketi yanıp söner. Büyük olarak park ettiğiniz alanın numarası ve geçen süreniz saat:dakika:saniye olarak gösterilir.',
      },
      {
        heading: 'Giriş zamanı',
        body:
          'Park oturumunuzun başlangıç saati. Otopark kamerası QR\'ı okuduğu an kaydedilen tarih/saattir; geçmiş kayıtlarınızda da görüntülenir.',
      },
      {
        heading: 'Anlık tahmini ücret',
        body:
          'Geçen süre + güncel tarifeye göre o anki olası ücretiniz. Ücretsiz dilim içindeyseniz "Ücretsiz" yeşil rozeti görünür. Süre arttıkça otomatik güncellenir; kesin ücret çıkışta belirlenir.',
      },
      {
        heading: 'Parkı Bitir',
        body:
          'Kırmızı "Parkı Bitir · Çıkış QR\'ı" butonu sizi çıkış QR ekranına götürür. Orada gösterilen QR\'ı kameraya okuttuğunuzda oturum kapanır, ücret tahsil edilir.',
      },
      {
        heading: 'Yenileme',
        body:
          'Bir saniyelik gecikme yaşanırsa ekranı aşağı çekerek (pull-to-refresh) manuel yenileyebilirsiniz.',
      },
    ],
  },

  'my-cars': {
    title: 'Araçlarım',
    intro:
      'Park sırasında plaka olarak kullanılacak araçlarınızı yönettiğiniz sayfadır. En az bir araç kaydı olmadan park başlatamazsınız. İstediğiniz aracı "tercih edilen" olarak işaretleyerek park akışında otomatik seçili gelmesini sağlayabilirsiniz.',
    sections: [
      {
        heading: 'Araç Ekleme',
        body:
          'Sayfanın altındaki "Yeni araç ekle" alanına plakayı girin (büyük/küçük harf farkı önemli değildir, sistem otomatik düzeltir). İsterseniz bir etiket (örn. "Günlük araç", "Eşin arabası") ekleyebilirsiniz. Aynı plaka iki kez eklenemez.',
      },
      {
        heading: 'Tercih Edilen Araç',
        body:
          'Her aracın yanındaki yıldız simgesine dokunarak o aracı varsayılan yapabilirsiniz. Park-Now ve Rezervasyon akışlarında bu araç otomatik seçili gelir; ihtiyaç halinde "Değiştir" ile diğerlerine geçebilirsiniz.',
      },
      {
        heading: 'Silme',
        body:
          'Çöp ikonuna dokunarak aracı silebilirsiniz. Geçmiş park kayıtlarındaki plaka bilgisi etkilenmez; sadece yeni park için kullanılamaz hale gelir.',
      },
      {
        heading: 'Limit',
        body:
          'Kullanıcı başına araç sayısı limiti şu anda uygulanmamaktadır, ancak makul bir sayıda tutmanız önerilir.',
      },
    ],
  },

  'payment-cards': {
    title: 'Ödeme Yöntemleri',
    intro:
      'Park ücretinin otomatik olarak çekileceği kredi/banka kartlarınızı kaydeder. Güvenlik açısından yalnızca **son 4 hane + marka + son kullanım tarihi** saklanır; tam PAN (16 hane) sistemde tutulmaz. Bu sayede kart bilgileriniz KVKK uyumlu şekilde korunur.',
    sections: [
      {
        heading: 'Kart Ekleme',
        body:
          'PAN (16 haneli kart numarası), kart sahibi adı, son kullanım tarihi (MM/YY) bilgilerini girip kaydedin. Sistem markayı (Visa, Mastercard, Amex, Troy) ilk haneye göre otomatik tespit eder. Eklerken arka planda kart numarasının ilk 6 ve son 4 hanesi hariç kalan kısmı kayda alınmaz.',
      },
      {
        heading: 'Tercih Edilen Kart',
        body:
          'Birden fazla kart eklediyseniz birini "tercih edilen" olarak işaretleyebilirsiniz. Park başlatma ekranlarında bu kart varsayılan olarak gelir.',
      },
      {
        heading: 'Silme',
        body:
          'Çöp ikonuna dokunarak kartı silebilirsiniz. Bu işlem sadece kayıtlı meta veriyi kaldırır; geçmiş ödemeler etkilenmez.',
      },
      {
        heading: 'Güvenlik ve KVKK',
        body:
          'Sistem PCI-DSS uyumluluğu hedefler. Demo sürümde gerçek ödeme entegrasyonu olmadığı için CVV asla istenmez; production\'da ödeme sağlayıcı (örn. iyzico, Stripe) entegrasyonu eklenecektir.',
      },
      {
        heading: 'Kart Türü Renkleri',
        body:
          'Marka algılaması başarılıysa karta uygun bir renk (Visa: mavi, Mastercard: turuncu, Amex: yeşil, Troy: kırmızı) atanır. Bilinmeyen markalar gri olarak gösterilir.',
      },
    ],
  },

  'parking-history': {
    title: 'Park Geçmişi',
    intro:
      'Sistemde başlattığınız tüm park oturumlarınızın tarih sırasında listelendiği sayfadır. En yeni kayıt en üstte yer alır. Geçmişiniz finansal kayıt, anlaşmazlık çözümü ve kişisel takip için kullanılabilir.',
    sections: [
      {
        heading: 'Durum Filtresi',
        body:
          'Üst sekmelerle kayıtları filtreleyin: Tümü, Devam Eden, Tamamlananlar, İptaller. Filtre değiştiğinde liste anında güncellenir.',
      },
      {
        heading: 'Kart Detayları',
        body:
          'Her satırda alan numarası, başlangıç saati, süre, ücret ve durum görüntülenir. Aktif oturumlarda ücret yerine "Devam ediyor" yazısı görünür.',
      },
      {
        heading: 'Detay Görüntüleme',
        body:
          'Bir kayda dokunarak ayrıntı sayfasına geçebilirsiniz: tam başlangıç-bitiş zamanı, kullanılan araç plakası, ödeme kart bilgisi (son 4 hane), oturum ID. Bu sayfa anlaşmazlık durumunda işletmeye gösterebileceğiniz makbuzu içerir.',
      },
      {
        heading: 'Kayıt sayısı',
        body:
          'Şu anda son 50 kayıt görüntülenir. Daha eski kayıt sorgulamak için işletmeye başvurabilirsiniz.',
      },
    ],
  },

  settings: {
    title: 'Ayarlar',
    intro:
      'Hesap profilinizi yönetmek, şifrenizi değiştirmek veya hesabınızı silmek için kullanılan sayfadır. Aynı zamanda uygulama versiyonu, kullanım koşulları ve KVKK bilgilerine de buradan erişebilirsiniz.',
    sections: [
      {
        heading: 'Profil Bilgileri',
        body:
          'Ad, soyad ve e-posta adresinizi günceleyebilirsiniz. E-posta değişikliği yaparsanız sistemde başka kullanıcının zaten aldığı bir e-posta olmamalıdır.',
      },
      {
        heading: 'Şifre Değiştir',
        body:
          'Mevcut şifrenizi doğrulayıp yeni bir şifre belirleyin. Yeni şifre en az 8 karakter olmalı ve eski şifreyle aynı olamaz. Şifre değişikliği sonrası mevcut token geçerliliğini korur, yeniden giriş gerekmez.',
      },
      {
        heading: 'Hesabı Sil',
        body:
          'Hesabınızı kalıcı olarak silmek için şifrenizi tekrar girmeniz istenir. Bu işlem geri alınamaz; geçmiş kayıtlarınız anonimleştirilir (kullanıcı adı yerine "Silindi" yazılır), park geçmişiniz finansal kayıtlar olarak sistemde kalır.',
      },
      {
        heading: 'Bildirimler',
        body:
          'İleride: park hatırlatma, rezervasyon yaklaşma, ödeme onayı gibi bildirimleri açıp kapatma imkanı eklenecektir. Şu an için tüm bildirimler arka planda otomatik gönderilir.',
      },
      {
        heading: 'Hakkında',
        body:
          'Uygulama versiyonu, geliştirici bilgisi, kullanım koşulları (Terms of Service) ve KVKK aydınlatma metni bu bölümden okunabilir.',
      },
    ],
  },
}

/** Bilinmeyen ekran için fallback. */
export const helpFallback: HelpEntry = {
  title: 'Yardım',
  intro:
    'Bu ekran için özel yardım metni yok. Profil > Yardım ve Rehber yolundan tam kılavuza ulaşabilirsiniz.',
  sections: [],
}

export const helpOrder: HelpKey[] = [
  'home',
  'parking',
  'park-now',
  'reserve-now',
  'park-entry-qr',
  'park-exit-qr',
  'parking-detail',
  'my-cars',
  'payment-cards',
  'parking-history',
  'profile',
  'settings',
]
