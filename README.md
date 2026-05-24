# VisionPark – Otopark Yönetim Sistemi

YOLO tabanlı park alanı tespiti + REST API + Yönetici web paneli + Mobil müşteri uygulaması.

> **Not:** Bu proje [computervisioneng/parking-space-counter](https://github.com/computervisioneng/parking-space-counter) reposundan başlatılmıştır. Orijinal OpenCV demosu üzerine **backend (FastAPI)**, **admin panel (React)**, **mobil uygulama (React Native/Expo)** ve **özel eğitilmiş YOLO modelleri** eklenmiştir. Krediler için aşağıya bakın.

## Proje Yapısı

```
VisionPark/
├── backend/              # FastAPI REST API (auth, parking sessions, pricing, WebSocket)
├── admin-panel/          # React (Vite) - yönetici paneli
├── mobile/               # React Native (Expo) - müşteri uygulaması
├── main.py               # Orijinal OpenCV + YOLO demo (standalone)
├── yolo_detector.py      # YOLO araç tespit modülü (backend de kullanıyor)
├── util.py               # Park alanı mask yardımcıları
├── mask_1920_1080.png    # Park alanı maskesi
├── samples/              # Demo video
├── data/                 # Eğitim verisi (yolo/Yolo12, slots.json, frames)
├── runs/train/           # Eğitilmiş YOLO modelleri (fine_tune_11n/11s/12n/12s)
├── tez/                  # Bitirme tezi materyalleri
└── check_gpu.py          # CUDA/GPU kontrol scripti
```

## Hızlı Başlangıç

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed
.\dev.ps1                     # veya: uvicorn app.main:app --reload --port 8000 --reload-dir app
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Admin: `admin@carparking.com` / `Admin1234`

CV (YOLO) işleme backend içinde `app/api/video_stream.py` endpoint'i üzerinden çalışır — ayrı bir worker süreci gerekmez.

### 2. Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

http://localhost:5173 — dashboard, park haritası, oturumlar.

### 3. Mobil Uygulama

```bash
cd mobile
npm install
npm start
```

Expo Go ile QR kodu tarayın. **Fiziksel cihazda:** `mobile/src/api.ts` içindeki `API_BASE`'i bilgisayarınızın IP adresi ile değiştirin (örn. `http://192.168.1.100:8000/api/v1`).

### 4. Standalone OpenCV Demo (opsiyonel)

Sadece YOLO + mask ile park alanı tespitini görmek için:

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install opencv-python ultralytics numpy
python main.py
```

- **Q** tuşu = çıkış
- Yeşil = boş, Kırmızı = dolu, Mavi (opsiyonel) = YOLO araç tespitleri

## Özellikler

- **Backend:** JWT auth, Spots, Parking Sessions, Pricing, Admin API, WebSocket, simüle ödeme
- **Admin Panel:** Dashboard, park haritası (yeşil/kırmızı), oturum listesi
- **Mobil:** Giriş/Kayıt, park yerleri, park başlat/bitir, geçmiş
- **CV:** YOLO ile özel eğitilmiş model (car, truck), her N framede bir doluluk güncelleme

## Ödeme (simüle)

Gerçek ödeme sağlayıcısı yoktur. Kullanıcı park oturumunu bitirdiğinde (`POST /api/v1/parking/end`) ücret hesaplanır ve kayıtlı kart bilgisiyle birlikte ödeme kaydı **completed** olarak oluşturulur. Admin panelindeki gelir ve oturum listesi bu kayıtlardan beslenir.

## CV Ayarları (`main.py`)

| Değişken | Açıklama |
|----------|----------|
| `MASK_PATH` | Park alanı maskesi |
| `VIDEO_PATH` | Video dosyası |
| `CUSTOM_MODEL_PATH` | YOLO modeli (varsayılan: `runs/train/fine_tune_11n/weights/best.pt`) |
| `IOU_THRESHOLD` | Araç–park örtüşme eşiği |
| `CONFIDENCE` | YOLO güven eşiği |
| `USE_GPU` | `'cuda'` / `'cpu'` |

## Dataset

- **Sınıflar:** car (0), truck (1)
- **Kaynak:** Roboflow → `data/yolo/Yolo12`

## Krediler

- Orijinal OpenCV demo & mask yaklaşımı: [computervisioneng/parking-space-counter](https://github.com/computervisioneng/parking-space-counter) (MIT, © 2022 computervisiondeveloper)
- Bitirme projesi eklemeleri (backend, web, mobil, custom YOLO eğitimi, sistem entegrasyonu): Muhammed Enes Karasan (2026)

Lisans: MIT (bkz. `LICENSE.md`).
