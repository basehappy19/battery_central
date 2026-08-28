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

- **BatteryLog** — entries older than **90 days** are automatically purged on each /api/logs call.

---

## 💡 Feature Roadmap / แนะนำ Feature เพิ่มเติม

| # | Feature | Description |
|---|---------|-------------|
| 1 | **LINE / Telegram Alerts** | แจ้งเตือนเมื่อแบตต่ำกว่า threshold หรือออฟไลน์นานเกิน X นาที |
| 2 | **Battery Health Score** | คำนวณสุขภาพแบตเตอรี่จากพฤติกรรมการชาร์จ (cycle count, deep discharge) |
| 3 | **Multi-day Graph** | กราฟย้อนหลัง 7/30 วัน เพื่อดูแนวโน้ม |
| 4 | **Scheduled Report** | ส่ง daily/weekly summary ทาง email หรือ LINE |
| 5 | **Public Embed Widget** | iframe widget + shareable link |
| 6 | **Charging Profile Analysis** | วิเคราะห์นิสัยการชาร์จ เช่น ชาร์จค้างคืนบ่อยแค่ไหน |
| 7 | **Device Groups / Tags** | จัดกลุ่มอุปกรณ์ตาม location หรือ owner |
| 8 | **Dark Mode** | รองรับ dark/light mode toggle |
| 9 | **PWA / Mobile App** | Progressive Web App + push notification |
| 10 | **API Rate Limiting** | ป้องกัน spam ด้วย rate limit per API key |
| 11 | **Geolocation Tagging** | บันทึก location ที่ชาร์จ |
| 12 | **Export CSV/PDF** | Export ประวัติแบตเตอรี่ |
| 13 | **MQTT Support** | รองรับ MQTT protocol สำหรับ IoT/ESP32 |
| 14 | **Custom Thresholds per Device** | ตั้ง threshold แจ้งเตือนแยกตามอุปกรณ์ |
| 15 | **Battery Comparison View** | เปรียบเทียบกราฟหลายอุปกรณ์ในหน้าเดียว |

---

## 📄 License

MIT License — Free for personal and commercial use.
