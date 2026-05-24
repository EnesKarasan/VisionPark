<div align="center">

# 🅿️ VisionPark

**YOLO tabanlı bilgisayarlı görü + Full-stack otopark yönetim sistemi**

Park alanlarını gerçek zamanlı tespit eden, kullanıcıların mobil uygulamadan park yapıp ödeme yaptığı, yöneticilerin web panelden yönettiği uçtan uca bir sistem.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-Expo-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![YOLO](https://img.shields.io/badge/YOLO-v11_/_v12-00FFFF?logo=yolo&logoColor=black)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## 📌 Proje Hakkında

VisionPark, **bilgisayarlı görü (YOLO)** ile otopark alanlarının doluluk durumunu kameradan gerçek zamanlı tespit eder, bu veriyi bir **REST API + WebSocket** üzerinden hem **müşterilere mobil uygulama** hem **işletmeciye web yönetim paneli** ile sunan **full-stack** bir sistemdir.

Kullanıcı mobil uygulamadan müsait yeri görür, park başlatır; sistem park süresini ölçer, bitişte ücretlendirme yapar ve kayıtlı kart üzerinden ödemeyi tamamlar. Yönetici web panelden canlı park haritasını, aktif oturumları, geliri ve fiyatlandırmayı yönetir.

---

## ✨ Özellikler

### 🎥 Computer Vision
- Custom-trained **YOLOv11 / YOLOv12** modelleri (car, truck sınıfları)
- Mask + connected components ile park alanı segmentasyonu
- IoU eşiğine göre doluluk kararı
- GPU (CUDA) / CPU otomatik fallback
- HTTP üzerinden canlı MJPEG video stream

### 🔧 Backend (FastAPI)
- **JWT** tabanlı kimlik doğrulama (access + refresh token)
- Park oturumu yaşam döngüsü (rezerve → aktif → tamamlandı)
- Dinamik fiyatlandırma (admin tarafından güncellenebilir)
- Simüle ödeme akışı (kayıtlı kart ile otomatik tahsilat)
- **WebSocket** ile park doluluk durumunun anlık yayını
- Alembic ile veritabanı şema migration'ları
- Rol bazlı yetkilendirme (user / admin)

### 💻 Admin Panel (React + Vite + Tailwind)
- Dashboard: anlık doluluk, gelir, aktif oturum sayısı
- Canlı park haritası (yeşil = boş, kırmızı = dolu)
- Oturum geçmişi ve gelir raporu
- Fiyatlandırma ve kullanıcı yönetimi

### 📱 Mobile App (React Native + Expo)
- Giriş / Kayıt
- Canlı park yerleri görünümü
- Park başlat / bitir akışı
- Geçmiş ve ödeme makbuzları

---

## 🏗️ Sistem Mimarisi

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Kamera /   │     │  CV Pipeline     │     │  Veritabanı │
│  Video      │────▶│  (YOLO + Mask)   │────▶│  (SQLite /  │
│             │     │  video_stream.py │     │   Postgres) │
└─────────────┘     └────────┬─────────┘     └──────┬──────┘
                             │                      │
                             ▼                      ▼
                    ┌────────────────────────────────────┐
                    │      FastAPI Backend (REST + WS)   │
                    │   JWT • Sessions • Pricing • Pay   │
                    └─────────────┬──────────────────────┘
                                  │
                  ┌───────────────┴────────────────┐
                  ▼                                ▼
         ┌─────────────────┐              ┌──────────────────┐
         │  Admin Panel    │              │  Mobile App      │
         │  (React + Vite) │              │  (React Native)  │
         └─────────────────┘              └──────────────────┘
```

---

## 🛠️ Tech Stack

| Katman | Teknolojiler |
|---|---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Uvicorn, python-jose (JWT), passlib (bcrypt) |
| **Computer Vision** | Ultralytics YOLO (v11n/11s/12n/12s), OpenCV, PyTorch, NumPy |
| **Web (Admin)** | React 18, TypeScript, Vite, TailwindCSS, React Router |
| **Mobile** | React Native, Expo, TypeScript |
| **Veritabanı** | SQLite (dev), PostgreSQL-uyumlu (prod-ready) |
| **Realtime** | WebSocket (FastAPI), MJPEG video streaming |
| **DevOps** | Alembic migrations, .env config, ayrı dev script (`dev.ps1`) |

---

## 📂 Proje Yapısı

```
VisionPark/
├── backend/                # FastAPI REST API + WebSocket + CV endpoint
│   ├── app/
│   │   ├── api/            # Route'lar (auth, parking, admin, video_stream, ws)
│   │   ├── core/           # Settings, security, JWT
│   │   ├── cv/             # Computer vision (YOLO detector + mask util)
│   │   ├── db/             # Session, seed
│   │   ├── models/         # SQLAlchemy modelleri
│   │   ├── schemas/        # Pydantic şemaları
│   │   └── services/       # İş mantığı (pricing, payment, vs.)
│   ├── alembic/            # DB migration'ları
│   └── scripts/            # Maintenance script'leri
│
├── admin-panel/            # React (Vite) yönetici paneli
│   └── src/
│       ├── components/     # Dashboard, ParkingMap, Sessions, vs.
│       ├── pages/          # Login, Dashboard, Admin
│       └── api/            # Backend client
│
├── mobile/                 # React Native (Expo) müşteri uygulaması
│   ├── app/                # Expo Router ekranları
│   ├── src/                # Hooks, API client, akış mantığı
│   └── components/         # Paylaşılan UI bileşenleri
│
├── mask_1920_1080.png      # Park alanı segmentasyon maskesi
├── runs/train/             # Kendi eğittiğim YOLO modelleri (best.pt)
│   ├── fine_tune_11n/      # YOLOv11 nano
│   ├── fine_tune_11s/      # YOLOv11 small
│   ├── fine_tune_12n/      # YOLOv12 nano
│   └── fine_tune_12s/      # YOLOv12 small
└── check_gpu.py            # CUDA kontrol script'i
```

> **Not:** Demo videoları (`samples/`) ve eğitim dataseti (`data/yolo/`) repo dışında tutuluyor (boyut nedeniyle). Lokal kurulumda `samples/` klasörüne kendi videonuzu koyabilirsiniz; dataset Roboflow üzerinden indirilebilir.

---

## 🚀 Hızlı Başlangıç

### 1. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1     # Windows  (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed
.\dev.ps1                        # veya: uvicorn app.main:app --reload --port 8000
```

- API → http://localhost:8000
- Interactive docs (Swagger) → http://localhost:8000/docs
- Default admin → `admin@carparking.com` / `Admin1234`

### 2. Admin Panel

```bash
cd admin-panel
npm install
npm run dev          # → http://localhost:5173
```

### 3. Mobile App

```bash
cd mobile
npm install
npm start            # Expo Go ile QR kodu tara
```

> Fiziksel cihazdan erişim için `mobile/src/api.ts` içindeki `API_BASE`'i bilgisayarınızın LAN IP'si ile değiştirin (örn. `http://192.168.1.100:8000/api/v1`).

> CV pipeline (YOLO + mask) artık backend içinde `app/cv/` paketi olarak yaşar ve `app/api/video_stream.py` üzerinden HTTP MJPEG endpoint'i ile yayınlanır. Ayrıca standalone bir worker gerekmez.

---

## 🧠 Öne Çıkan Teknik Detaylar

- **Eğitim:** YOLOv11 ve YOLOv12 mimarileri kendi datasetimle (car, truck) fine-tune edildi. Performans karşılaştırması için 4 farklı varyant eğitildi.
- **Performans:** YOLO her frame'de değil, parametrik aralıkla (`step=30`) çalıştırılır → CPU'da bile akıcı çalışır.
- **Doluluk kararı:** Klasik confidence yerine *Intersection over Spot* (IoS) metriği kullanılır — araç kutusunun park alanını ne kadar kapladığına bakar, alan büyüklüğü farklılıklarına dayanıklıdır.
- **Mimari ayrımı:** CV pipeline backend ile aynı süreçte (`app/cv/` paketi + `app/api/video_stream.py` endpoint'i) çalışır → ayrı worker / message broker gerekmez. Üretimde Celery / Redis ile ayrılması mümkün.
- **Auth:** Stateless JWT; refresh token rotation ile uzun oturum.
- **Realtime:** WebSocket üzerinden doluluk durumu push'lanır → polling yok.

---

## 📸 Ekran Görüntüleri

> Ekran görüntüleri yakında eklenecek. Lokalde çalıştırıp inceleyebilirsiniz.

---

## 📚 Krediler

Bu proje, [computervisioneng/parking-space-counter](https://github.com/computervisioneng/parking-space-counter) reposundaki OpenCV + mask demosundan ilham alınarak başlatılmış; üzerine **backend (FastAPI)**, **admin panel (React)**, **mobile app (React Native)**, **JWT auth**, **WebSocket**, **simüle ödeme akışı**, **custom YOLOv11/12 eğitimi** ve tam **sistem entegrasyonu** geliştirilmiştir.

## 📄 Lisans

MIT — detaylar için [LICENSE.md](LICENSE.md).

---

<div align="center">

**Muhammed Enes Karasan** • [GitHub](https://github.com/EnesKarasan)

</div>
