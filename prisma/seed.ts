import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('กำลังล้างข้อมูลเดิม...');
  await prisma.batteryLog.deleteMany();
  await prisma.device.deleteMany();
  await prisma.setting.deleteMany();

  console.log('กำลังตั้งค่ารหัสผ่านในฐานข้อมูล...');
  await prisma.setting.create({
    data: {
      key: 'dashboard_password',
      value: 'battery123',
    },
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
      id: 'dev-1-win',
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
      id: 'dev-2-ipad',
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
        { batteryLevel: 82, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(1) },
      ]
    },
    {
      id: 'dev-3-android',
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
      id: 'dev-4-esp32',
      name: 'เซนเซอร์ตรวจวัดสภาพอากาศ (ESP32)',
      platform: 'ESP32',
      batteryLevel: 18,
      isCharging: false,
      timeRemaining: 120,
      acceptingUpdates: true,
      prevBattery: 20,
      updatedAt: getTodayTime(0, 10),
      logs: [
        { batteryLevel: 30, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(18) },
        { batteryLevel: 25, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(12) },
        { batteryLevel: 21, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(6) },
        { batteryLevel: 18, isCharging: false, eventType: 'LEVEL_UPDATE', createdAt: getTodayTime(1) },
      ]
    },
    {
      id: 'dev-5-mac',
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
