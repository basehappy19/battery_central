import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('กำลังล้างข้อมูลเดิม...');
  await prisma.apiLog.deleteMany();
  await prisma.batteryLog.deleteMany();
  await prisma.device.deleteMany();
  await prisma.setting.deleteMany();

  console.log('กำลังตั้งค่ารหัสผ่านและ API Secret Key ในฐานข้อมูล...');
  await prisma.setting.createMany({
    data: [
      { key: 'dashboard_password', value: 'battery123' },
      { key: 'api_secret_key', value: 'secret_batt_2026' },
    ],
  });

  const now = new Date();
  const getTodayTime = (hoursAgo: number, minutesAgo = 0) => {
    const d = new Date(now);
    d.setHours(d.getHours() - hoursAgo);
    d.setMinutes(d.getMinutes() - minutesAgo);
    return d;
  };

  const mockDevices = [
    {
      id: 'bat-win001',
      name: 'พีซีทำงานหลัก (Windows)',
      platform: 'Windows',
      batteryLevel: 100,
      isCharging: true,
      timeRemaining: null,
      acceptingUpdates: true,
      prevBattery: 100,
      updatedAt: getTodayTime(0, 2),
      logs: [
        { batteryLevel: 60, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(14) },
        { batteryLevel: 50, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(10) },
        { batteryLevel: 45, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(8) },
        { batteryLevel: 75, isCharging: true, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(4) },
        { batteryLevel: 100, isCharging: true, eventType: 'FULL_CHARGE', createdAt: getTodayTime(1) },
      ]
    },
    {
      id: 'bat-ipad02',
      name: 'ไอแพดโปร 11 นิ้ว (iPadOS)',
      platform: 'iPadOS',
      batteryLevel: 82,
      isCharging: false,
      timeRemaining: 310,
      acceptingUpdates: true,
      prevBattery: 85,
      updatedAt: getTodayTime(0, 5),
      logs: [
        { batteryLevel: 60, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(14) },
        { batteryLevel: 100, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(12) },
        { batteryLevel: 95, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(9) },
        { batteryLevel: 88, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(5) },
        { batteryLevel: 82, isCharging: false, eventType: 'RECONNECTED', createdAt: getTodayTime(1, 30) },
      ]
    },
    {
      id: 'bat-and003',
      name: 'มือถือ Galaxy S24 Ultra',
      platform: 'Android',
      batteryLevel: 45,
      isCharging: true,
      timeRemaining: 35,
      acceptingUpdates: true,
      prevBattery: 40,
      updatedAt: getTodayTime(0, 1),
      logs: [
        { batteryLevel: 90, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(16) },
        { batteryLevel: 38, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(3, 30) },
        { batteryLevel: 80, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(2) },
        { batteryLevel: 55, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(1) },
        { batteryLevel: 40, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(0, 45) },
        { batteryLevel: 45, isCharging: true, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(0, 30) },
      ]
    },
    {
      id: 'bat-esp004',
      name: 'เซนเซอร์ตรวจวัดสภาพอากาศ (ESP32)',
      platform: 'ESP32',
      batteryLevel: 18,
      isCharging: false,
      timeRemaining: null,
      acceptingUpdates: true,
      prevBattery: 20,
      updatedAt: getTodayTime(3, 0),
      logs: [
        { batteryLevel: 30, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(18) },
        { batteryLevel: 25, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(12) },
        { batteryLevel: 21, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(6) },
        { batteryLevel: 18, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(3) },
      ]
    },
    {
      id: 'bat-mac005',
      name: 'แมคบุ๊กโปร M3 (macOS)',
      platform: 'macOS',
      batteryLevel: 94,
      isCharging: true,
      timeRemaining: 15,
      acceptingUpdates: false,
      prevBattery: 90,
      updatedAt: getTodayTime(0, 3),
      logs: [
        { batteryLevel: 60, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(15) },
        { batteryLevel: 100, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(13) },
        { batteryLevel: 80, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(5) },
        { batteryLevel: 85, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(2) },
        { batteryLevel: 94, isCharging: true, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(0, 15) },
      ]
    },
  ];

  console.log('กำลังเพิ่มข้อมูลจำลองพร้อมประวัติกราฟ 24 ชั่วโมง...');
  for (const deviceData of mockDevices) {
    const { logs, ...device } = deviceData;
    await prisma.device.create({
      data: {
        ...device,
        logs: {
          create: logs.map(l => ({
            batteryLevel: l.batteryLevel,
            isCharging: l.isCharging,
            eventType: l.eventType,
            createdAt: l.createdAt,
          }))
        }
      },
    });
  }

  console.log('กำลังสร้างข้อมูลจำลองประวัติคำขอ API (API Logs)...');
  const mockApiLogs = [
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 45, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 100, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 100%', time_remaining: null }), createdAt: getTodayTime(0, 5) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 62, ip: '192.168.1.105', userAgent: 'MacroDroid/Android (Galaxy S24 Ultra)', requestBody: JSON.stringify({ device_id: 'bat-and003', battery_level: 45, is_charging: true, time_remaining: 35, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 45%', time_remaining: 35 }), createdAt: getTodayTime(0, 10) },
    { method: 'GET', path: '/api/devices', status: 200, durationMs: 28, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, count: 5 }), createdAt: getTodayTime(0, 15) },
    { method: 'GET', path: '/api/settings', status: 200, durationMs: 18, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, settings_count: 14 }), createdAt: getTodayTime(0, 20) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 85, ip: '192.168.1.201', userAgent: 'ESP32-HTTP-Client/1.0 (Weather Sensor)', requestBody: JSON.stringify({ device_id: 'bat-esp004', battery_level: 18, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 18%' }), createdAt: getTodayTime(1, 0) },
    { method: 'POST', path: '/api/battery/update', status: 401, durationMs: 12, ip: '10.0.0.45', userAgent: 'Tasker/6.3.0 (Android 14)', requestBody: JSON.stringify({ device_id: 'bat-unknown', battery_level: 50, is_charging: false, secret_key: 'wrong_key_123' }), responseBody: JSON.stringify({ error: 'Unauthorized: Invalid API secret key' }), createdAt: getTodayTime(1, 30) },
    { method: 'POST', path: '/api/battery/update', status: 400, durationMs: 15, ip: '192.168.1.110', userAgent: 'MacroDroid/Android', requestBody: JSON.stringify({ device_id: 'bat-and003' }), responseBody: JSON.stringify({ error: 'Missing required fields: battery_level, is_charging' }), createdAt: getTodayTime(2, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 51, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 75, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 75%' }), createdAt: getTodayTime(4, 0) },
    { method: 'GET', path: '/api/devices', status: 200, durationMs: 33, ip: '192.168.1.108', userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/605.1.15', requestBody: null, responseBody: JSON.stringify({ success: true, count: 5 }), createdAt: getTodayTime(5, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 48, ip: '192.168.1.108', userAgent: 'Shortcuts/iOS 17.4 (iPad Pro)', requestBody: JSON.stringify({ device_id: 'bat-ipad02', battery_level: 88, is_charging: false, time_remaining: 320, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 88%' }), createdAt: getTodayTime(5, 10) },
    { method: 'POST', path: '/api/settings', status: 200, durationMs: 110, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: JSON.stringify({ offline_timeout_hours: '1', enable_telegram: 'true' }), responseBody: JSON.stringify({ success: true, message: 'Settings saved successfully' }), createdAt: getTodayTime(6, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 39, ip: '192.168.1.201', userAgent: 'ESP32-HTTP-Client/1.0 (Weather Sensor)', requestBody: JSON.stringify({ device_id: 'bat-esp004', battery_level: 21, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 21%' }), createdAt: getTodayTime(6, 30) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 55, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 45, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 45%' }), createdAt: getTodayTime(8, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 59, ip: '192.168.1.108', userAgent: 'Shortcuts/iOS 17.4 (iPad Pro)', requestBody: JSON.stringify({ device_id: 'bat-ipad02', battery_level: 95, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 95%' }), createdAt: getTodayTime(9, 0) },
    { method: 'GET', path: '/api/devices', status: 200, durationMs: 25, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, count: 5 }), createdAt: getTodayTime(9, 15) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 42, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 50, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 50%' }), createdAt: getTodayTime(10, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 68, ip: '192.168.1.201', userAgent: 'ESP32-HTTP-Client/1.0 (Weather Sensor)', requestBody: JSON.stringify({ device_id: 'bat-esp004', battery_level: 25, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 25%' }), createdAt: getTodayTime(12, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 50, ip: '192.168.1.108', userAgent: 'Shortcuts/iOS 17.4 (iPad Pro)', requestBody: JSON.stringify({ device_id: 'bat-ipad02', battery_level: 100, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 100%' }), createdAt: getTodayTime(12, 30) },
    { method: 'POST', path: '/api/battery/update', status: 500, durationMs: 145, ip: '192.168.1.115', userAgent: 'Custom-Python-Script/3.11', requestBody: JSON.stringify({ device_id: 'bat-test', battery_level: 50, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ error: 'Internal Server Error: Database connection timeout' }), createdAt: getTodayTime(13, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 44, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 60, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 60%' }), createdAt: getTodayTime(14, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 61, ip: '192.168.1.108', userAgent: 'Shortcuts/iOS 17.4 (iPad Pro)', requestBody: JSON.stringify({ device_id: 'bat-ipad02', battery_level: 60, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 60%' }), createdAt: getTodayTime(14, 30) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 53, ip: '192.168.1.150', userAgent: 'MacBook-Pro-Daemon/1.2 (macOS 14)', requestBody: JSON.stringify({ device_id: 'bat-mac005', battery_level: 60, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 60%' }), createdAt: getTodayTime(15, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 47, ip: '192.168.1.105', userAgent: 'MacroDroid/Android (Galaxy S24 Ultra)', requestBody: JSON.stringify({ device_id: 'bat-and003', battery_level: 90, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 90%' }), createdAt: getTodayTime(16, 0) },
    { method: 'GET', path: '/api/devices', status: 200, durationMs: 22, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, count: 5 }), createdAt: getTodayTime(17, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 72, ip: '192.168.1.201', userAgent: 'ESP32-HTTP-Client/1.0 (Weather Sensor)', requestBody: JSON.stringify({ device_id: 'bat-esp004', battery_level: 30, is_charging: false, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 30%' }), createdAt: getTodayTime(18, 0) },
    { method: 'POST', path: '/api/battery/update', status: 401, durationMs: 14, ip: '172.16.0.5', userAgent: 'curl/7.88.1', requestBody: JSON.stringify({ device_id: 'bat-test', battery_level: 100 }), responseBody: JSON.stringify({ error: 'Unauthorized: Invalid API secret key' }), createdAt: getTodayTime(19, 0) },
    { method: 'GET', path: '/api/logs', status: 200, durationMs: 31, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, total: 26 }), createdAt: getTodayTime(20, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 49, ip: '192.168.1.105', userAgent: 'MacroDroid/Android (Galaxy S24 Ultra)', requestBody: JSON.stringify({ device_id: 'bat-and003', battery_level: 95, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 95%' }), createdAt: getTodayTime(21, 0) },
    { method: 'POST', path: '/api/battery/update', status: 200, durationMs: 56, ip: '192.168.1.102', userAgent: 'MacroDroid/v5.40 (Windows PC)', requestBody: JSON.stringify({ device_id: 'bat-win001', battery_level: 90, is_charging: true, secret_key: 'secret_batt_2026' }), responseBody: JSON.stringify({ success: true, message: 'Updated battery level to 90%' }), createdAt: getTodayTime(22, 0) },
    { method: 'GET', path: '/api/devices', status: 200, durationMs: 29, ip: '192.168.1.50', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', requestBody: null, responseBody: JSON.stringify({ success: true, count: 5 }), createdAt: getTodayTime(23, 0) },
  ];

  await prisma.apiLog.createMany({
    data: mockApiLogs,
  });

  console.log('เพิ่มข้อมูลจำลองเข้าสู่ฐานข้อมูลสำเร็จ!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
