<div align="center">

# 🔋 Battery Central

**ระบบติดตามแบตเตอรี่แบบเรียลไทม์สำหรับหลายอุปกรณ์**  
**Real-time Multi-Device Battery Monitoring Dashboard**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)

</div>

---

## ภาษาไทย

### 📖 ภาพรวมระบบ

Battery Central คือแดชบอร์ดสำหรับติดตามสถานะแบตเตอรี่ของหลายอุปกรณ์พร้อมกันแบบเรียลไทม์ รองรับ Windows, macOS, iOS, Android, ESP32 และอุปกรณ์ IoT ทั่วไป ข้อมูลถูกส่งผ่าน HTTP REST API และแสดงผลบน Dashboard ที่อัปเดตตัวเองอัตโนมัติทุก 5 วินาที

### ✨ คุณสมบัติหลัก

#### แดชบอร์ดหลัก
- 📊 **เรียลไทม์** — อัปเดตอัตโนมัติทุก 5 วินาที ไม่ต้อง refresh หน้า
- 🔋 **แสดงระดับแบตเตอรี่** พร้อม progress bar สี (เขียว/เหลือง/แดง) ตามสถานะ
- ⚡ **ตรวจจับสถานะชาร์จ** พร้อมแอนิเมชัน pulse เมื่อกำลังชาร์จ
- ⏱️ **ประมาณเวลา** ชาร์จเต็ม หรือเหลือเวลาใช้งาน พร้อมแสดงนาฬิกาเป้าหมาย
- 📱 **รองรับหลายแพลตฟอร์ม** — Windows, macOS/iOS, Android, ESP32/IoT พร้อมไอคอนประจำแพลตฟอร์ม
- 🔴 **ตรวจสอบอุปกรณ์ออฟไลน์** — แสดงสีเทาและเวลาที่ขาดการติดต่อ
- 🧭 **เรียงลำดับอุปกรณ์** ด้วย drag & drop (modal)
- ✏️ **เปลี่ยนชื่ออุปกรณ์** ในระบบ
- 🗑️ **ลบอุปกรณ์** ออกจากระบบ
- 🔔 **แจ้งเตือนทดสอบ** Webhook/LINE Notify

#### กราฟแบตเตอรี่รายวัน
- 📈 **Area Chart** แสดงระดับแบตเตอรี่ตลอด 24 ชั่วโมง
- 🟢 **แยกสีเส้น** — เขียว = กำลังชาร์จ, น้ำเงิน = ใช้งานปกติ
- 🔍 **ขยายกราฟแบบ Full-screen** ด้วยปุ่ม expand สำหรับดูรายละเอียด
- 📌 **Reference Lines** แสดงจุดสำคัญ เช่น เริ่มชาร์จ, ถอดสาย, เต็ม 100%, แบตต่ำ
- 💬 **Tooltip อัจฉริยะ** เปลี่ยนสีตาม context (ชาร์จ, ต่ำ, เต็ม ฯลฯ)

#### ประวัติเหตุการณ์รายวัน
- 📋 แสดงรายการ event วันนี้ทั้งหมด: เสียบสาย, ถอดสาย, ชาร์จเต็ม, แบตต่ำ
- ⏳ สรุประยะเวลาชาร์จแต่ละครั้ง และพลังงานที่ได้รับ (+X%)

#### หน้าประวัติการเรียกใช้ API (/logs)
- 📜 **ดูประวัติ API** ทุก request/response พร้อม method, path, status, duration, IP
- 📊 **สถิติรวม** — คำขอทั้งหมด, สำเร็จ (2xx), ข้อผิดพลาด (4xx/5xx), เวลาเฉลี่ย
- 🔎 **ค้นหา/กรอง** ตาม Method, Status, Path, IP, User-Agent
- 🗂️ **Pagination** สำหรับข้อมูลจำนวนมาก
- 🧹 **ล้างประวัติ** ทั้งหมดได้
- ♻️ **ลบข้อมูล BatteryLog เก่ากว่า 90 วัน** อัตโนมัติ

#### ระบบตั้งค่า
- 🔐 **ป้องกันด้วยรหัสผ่าน** (password hash)
- ⚙️ **ตั้งค่า Webhook** URL สำหรับการแจ้งเตือน
- 🔑 **เปลี่ยนรหัสผ่าน** ระบบ
- 📝 **ลงทะเบียนอุปกรณ์ใหม่** พร้อม API Key

### 🛠️ Tech Stack

| ส่วนประกอบ | เทคโนโลยี |
|------------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| UI | Tailwind CSS v4 |
| Charts | Recharts |
| Runtime | Node.js |

### 🚀 การติดตั้งและรัน

#### ต้องการ
- Node.js >= 18
- PostgreSQL database

#### ขั้นตอน

```bash
# 1. Clone project
git clone <repo-url>
cd battery_central

# 2. ติดตั้ง dependencies
npm install

# 3. ตั้งค่า environment variables
cp .env.example .env
# แก้ไข DATABASE_URL ใน .env

# 4. รัน database migration
npx prisma migrate deploy

# 5. รัน development server
npm run dev

# 6. หรือ build สำหรับ production
npm run build && npm run start
```

#### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/battery_central"
```

#### Docker Compose

```bash
docker-compose up -d
```

### 📡 API Reference

#### อัปเดตสถานะแบตเตอรี่

```http
POST /api/battery/update
Content-Type: application/json
x-api-key: YOUR_DEVICE_API_KEY

{
  "batteryLevel": 85,
  "isCharging": true,
  "platform": "Android"
}
```

**Response:**
```json
{
  "success": true,
  "device": {
    "id": "uuid",
    "name": "My Phone",
    "batteryLevel": 85,
    "isCharging": true,
    "timeRemaining": 42
  }
}
```

#### ดูรายการอุปกรณ์ทั้งหมด

```http
GET /api/devices
```

#### ดูประวัติ API Logs

```http
GET /api/logs?page=1&limit=20&method=POST&status=SUCCESS
```

### 📲 การตั้งค่าบนแอป Android (MacroDroid / Tasker)

**MacroDroid — Trigger: ทุก X นาที หรือเมื่อแบตเปลี่ยน:**

```
HTTP Request:
  URL: https://your-domain.com/api/battery/update
  Method: POST
  Headers: x-api-key: YOUR_KEY
  Body: {"batteryLevel": [bat_level], "isCharging": [is_charging], "platform": "Android"}
```

### 🔄 Data Retention

- **BatteryLog** — ลบข้อมูลเก่ากว่า **90 วัน** อัตโนมัติ ทุกครั้งที่มีการเรียก /api/logs

---

## English

### 📖 Overview

Battery Central is a real-time multi-device battery monitoring dashboard. It supports Windows, macOS, iOS, Android, ESP32, and generic IoT devices. Devices push battery data via a simple HTTP REST API, and the dashboard auto-refreshes every 5 seconds.

### ✨ Features

#### Main Dashboard
- 📊 **Real-time updates** every 5 seconds — no manual refresh needed
- 🔋 **Battery level display** with color-coded progress bar (green/yellow/red)
- ⚡ **Charging detection** with animated pulse indicator
- ⏱️ **Time estimation** — time to full charge or remaining battery life with target clock
- 📱 **Multi-platform support** — Windows, macOS/iOS, Android, ESP32/IoT with platform icons
- 🔴 **Offline device detection** — grayed out with duration since last contact
- 🧭 **Device reordering** via drag & drop modal
- ✏️ **Rename devices** in-app
- 🗑️ **Delete devices** from system
- 🔔 **Test webhook notification** via Webhook/LINE Notify

#### Daily Battery Graph
- 📈 **Area Chart** showing 24-hour battery history
- 🟢 **Color-coded lines** — green = charging, blue = discharging
- 🔍 **Full-screen expand mode** for detailed inspection
- 📌 **Reference Lines** marking key events: charge start, unplug, full, low battery
- 💬 **Context-aware tooltip** with color themes per event type

#### Daily Event History
- 📋 Full event log for today: plug-in, unplug, full charge, low battery
- ⏳ Charge session summaries with duration and energy gained (+X%)

#### API Log Page (/logs)
- 📜 **View all API requests** with method, path, status, duration, IP, user-agent
- 📊 **Aggregate stats** — total requests, success (2xx), errors (4xx/5xx), avg response time
- 🔎 **Search & filter** by Method, Status, Path, IP, User-Agent
- 🗂️ **Pagination** for large datasets
- 🧹 **Clear all logs** button
- ♻️ **Auto-delete BatteryLog entries older than 90 days**

#### Settings System
- 🔐 **Password-protected** settings panel (hashed password)
- ⚙️ **Webhook URL** configuration for notifications
- 🔑 **Change system password**
- 📝 **Register new devices** with generated API Key

### 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| UI | Tailwind CSS v4 |
| Charts | Recharts |
| Runtime | Node.js |

### 🚀 Getting Started

#### Prerequisites
- Node.js >= 18
- PostgreSQL database

#### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd battery_central

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit DATABASE_URL in .env

# 4. Run database migration
npx prisma migrate deploy

# 5. Start development server
npm run dev

# 6. Or build for production
npm run build && npm run start
```

#### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/battery_central"
```

#### Docker Compose

```bash
docker-compose up -d
```

### 📡 API Reference

#### Update Device Battery

```http
POST /api/battery/update
Content-Type: application/json
x-api-key: YOUR_DEVICE_API_KEY

{
  "batteryLevel": 85,
  "isCharging": true,
  "platform": "Android"
}
```

**Response:**
```json
{
  "success": true,
  "device": {
    "id": "uuid",
    "name": "My Phone",
    "batteryLevel": 85,
    "isCharging": true,
    "timeRemaining": 42
  }
}
```

#### List All Devices

```http
GET /api/devices
```

#### Get API Logs

```http
GET /api/logs?page=1&limit=20&method=POST&status=SUCCESS
```

### 📲 Android Setup (MacroDroid / Tasker)

**MacroDroid — Trigger: Every X minutes or on battery change:**

```
HTTP Request:
  URL: https://your-domain.com/api/battery/update
  Method: POST
  Headers: x-api-key: YOUR_KEY
  Body: {"batteryLevel": [bat_level], "isCharging": [is_charging], "platform": "Android"}
```

### 🔄 Data Retention

- **BatteryLog** — entries older than **90 days** are automatically purged (both on every `/api/battery/update` call for that device, and globally on each `/api/logs` call). This single retention window (see `lib/retention.ts`) is what makes the 7/30-day graph, health score, and charging profile features below possible — an earlier version purged a device's own logs after just 7 days, which silently broke multi-day history.

---

## 💡 Feature Roadmap / แนะนำ Feature เพิ่มเติม

| # | Feature | Status |
|---|---------|--------|
| 1 | **LINE / Telegram Alerts** | ✅ Implemented (Settings → Telegram) |
| 2 | **Battery Health Score** | ✅ Implemented |
| 3 | **Multi-day Graph** | ✅ Implemented |
| 4 | **Scheduled Report** | Not implemented |
| 5 | **Public Embed Widget** | ✅ Implemented |
| 6 | **Charging Profile Analysis** | ✅ Implemented |
| 7 | **Device Groups / Tags** | Not implemented |
| 8 | **Dark Mode** | Not implemented |
| 9 | **PWA / Mobile App** | ✅ Implemented (installable PWA; no push notifications) |
| 10 | **API Rate Limiting** | ✅ Implemented |
| 11 | **Geolocation Tagging** | ✅ Implemented |
| 12 | **Export CSV/PDF** | ✅ Implemented (CSV only, no PDF) |
| 13 | **MQTT Support** | ✅ Implemented |
| 14 | **Custom Thresholds per Device** | ✅ Implemented |
| 15 | **Battery Comparison View** | ✅ Implemented |

---

## 🆕 New Features Guide

> **Upgrading an existing installation:** these features add new columns to `Device`, a new `ShareToken` table, and two new npm dependencies (`mqtt`, `leaflet`). After pulling this update, run:
>
> ```bash
> npm install
> npx prisma db push   # or: npx prisma migrate dev --name add_thresholds_geolocation_sharing
> npm run build
> ```
>

### Battery Health Score & Charging Profile Analysis (#2, #6)

Expand any device card to see a 0–100 health score (deep-discharge frequency, time spent sitting at 100%, and charge-cycle churn over the last 7 or 30 days) plus a plain-language summary of charging habits (overnight charging %, average session length, full-charge rate). Computed on demand by `GET /api/devices/[id]/analysis?days=7|30` — not on the 5-second dashboard poll — so it never slows down the main view. Logic lives in `lib/analysis.ts`.

### Multi-day Graph (#3)

The existing daily graph inside each device card now has a **1 วัน / 7 วัน / 30 วัน** toggle. 7/30-day ranges are fetched from `GET /api/devices/[id]/history?days=N`.

### Custom Thresholds per Device (#14)

Click the gear icon on any device card to set a per-device low-battery %, offline timeout (minutes), and an alert on/off switch. These override the global values from Settings for that device only (`Device.lowBatteryThreshold`, `Device.offlineTimeoutMinutes`, `Device.alertEnabled` in the schema).

### Battery Comparison View (#15)

`/compare` — pick any set of devices and see their battery history overlaid on one chart, for 7 or 30 days.

### Public Embed Widget (#5)

Click **"แชร์/ฝัง"** in the header (or **"แชร์"** on a device card) to generate a share link. It lists existing links too, with copy-link / copy-embed-code / revoke actions. The generated `/share/[token]` page has no login and no navigation chrome, so it's safe to embed:

```html
<iframe src="https://your-domain.com/share/<token>" width="360" height="220" style="border:0;border-radius:16px;"></iframe>
```

Share links can optionally expire after N hours. Revoking a link immediately invalidates it (`DELETE /api/share?token=...`).

### Export CSV (#12)

Each device card has a **"CSV"** button that downloads its full battery-log history (up to the 90-day retention window) as a CSV file (`GET /api/devices/[id]/export?days=N`).

### Geolocation (#11)

Devices with GPS (e.g. an ESP32 + GPS module) can include `lat`/`lng` (or `latitude`/`longitude`) in their `POST /api/battery/update` payload to record location automatically. For devices without their own GPS, an admin can click **"ใช้ตำแหน่งปัจจุบัน"** on the expanded card to record the browser's current location instead. Locations render on an OpenStreetMap/Leaflet map — no API key required.

### Installable PWA (#9)

The dashboard can be added to a phone or desktop home screen (`public/manifest.json`, `public/sw.js`). No offline caching and no push notifications — just an installable, standalone window. iOS: Safari → Share → "Add to Home Screen". Android/desktop Chrome: the browser's own install prompt.

### API Rate Limiting (#10)

`proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) rate-limits every `/api/*` route using the in-memory limiter in `lib/security.ts`. Defaults: 120 req/min per IP for most routes, 180 req/min for `/api/battery/update` (devices get their own bucket so a handful of them behind one NAT don't trip the general dashboard limit). Tune via `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_BATTERY_MAX`, `RATE_LIMIT_BATTERY_WINDOW_MS` in `.env`. This is a single-process in-memory limiter — fine for one server instance, not shared across multiple instances behind a load balancer.

### MQTT Support (#13)

See **"MQTT (Mosquitto) Setup"** below for the broker; then run the worker that bridges MQTT → the existing `/api/battery/update` endpoint:

```bash
# .env
MQTT_BROKER_URL="mqtt://your-vps-ip:1883"
MQTT_USERNAME="myuser"
MQTT_PASSWORD="..."
API_SECRET_KEY="..."       # sent as x-api-key when calling /api/battery/update
APP_BASE_URL="http://localhost:3000"

npm run mqtt
```

Publish JSON like `{"batteryLevel": 87, "isCharging": true, "platform": "ESP32"}` to `battery-central/<deviceId>/status` and the worker forwards it to the API (reusing all existing validation, debounce, and notification logic). Run it as a systemd service, pm2 process, or a second `docker-compose` service alongside the app — see `scripts/mqtt-listener.js` for full env var docs.

---

## 🌩️ MQTT (Mosquitto) Setup on a Cloud VPS

For low-power IoT devices (ESP32), run Mosquitto on a Cloud VPS (DigitalOcean, AWS EC2, Linode, ...) with Docker installed.

**On the VPS (Ubuntu/Debian):**

1. Create the config:

   ```bash
   mkdir -p /opt/mosquitto/config /opt/mosquitto/data /opt/mosquitto/log
   nano /opt/mosquitto/config/mosquitto.conf
   ```

   ```conf
   allow_anonymous false
   password_file /mosquitto/config/pwfile
   listener 1883
   # listener 9001
   # protocol websockets
   ```

2. Create a username/password (replace `myuser`):

   ```bash
   docker run -it --rm -v /opt/mosquitto/config:/mosquitto/config eclipse-mosquitto mosquitto_passwd -c /mosquitto/config/pwfile myuser
   ```

3. Run Mosquitto via Docker Compose:

   ```yaml
   # docker-compose.yml
   services:
     mosquitto:
       image: eclipse-mosquitto
       container_name: mosquitto_broker
       restart: always
       ports:
         - "1883:1883"
         - "9001:9001"
       volumes:
         - /opt/mosquitto/config:/mosquitto/config
         - /opt/mosquitto/data:/mosquitto/data
         - /opt/mosquitto/log:/mosquitto/log
   ```

   ```bash
   docker-compose up -d
   ```

4. Open the firewall:

   ```bash
   sudo ufw allow 1883/tcp
   ```

Then point `MQTT_BROKER_URL=mqtt://<VPS-IP>:1883` at it and run `npm run mqtt` next to (or on) the machine running this app.

---

## 📄 License

MIT License — Free for personal and commercial use.
