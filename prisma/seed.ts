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
      prevBattery: 100,
      updatedAt: getTodayTime(0, 2),
      logs: [
        { batteryLevel: 85, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(5) },
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
      prevBattery: 85,
      updatedAt: getTodayTime(0, 5),
      logs: [
        { batteryLevel: 100, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(6) },
      ]
    },
    {
      id: 'dev-3-android',
      name: 'มือถือ Galaxy S24 Ultra',
      platform: 'Android',
      batteryLevel: 45,
      isCharging: true,
      timeRemaining: 35,
      prevBattery: 40,
      updatedAt: getTodayTime(0, 1),
      logs: [
        { batteryLevel: 80, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(7) },
        { batteryLevel: 38, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(1) },
      ]
    },
    {
      id: 'dev-4-esp32',
      name: 'เซนเซอร์ตรวจวัดสภาพอากาศ (ESP32)',
      platform: 'ESP32',
      batteryLevel: 18,
      isCharging: false,
      timeRemaining: 120,
      prevBattery: 20,
      updatedAt: getTodayTime(0, 10),
      logs: []
    },
    {
      id: 'dev-5-mac',
      name: 'แมคบุ๊กโปร M3 (macOS)',
      platform: 'macOS',
      batteryLevel: 94,
      isCharging: true,
      timeRemaining: 15,
      prevBattery: 90,
      updatedAt: getTodayTime(0, 3),
      logs: [
        { batteryLevel: 60, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(6) },
        { batteryLevel: 100, isCharging: false, eventType: 'UNPLUGGED', createdAt: getTodayTime(4) },
        { batteryLevel: 85, isCharging: true, eventType: 'PLUGGED_IN', createdAt: getTodayTime(1) },
      ]
    },
  ];

  console.log('กำลังเพิ่มข้อมูลจำลองและประวัติเหตุการณ์ของวันนี้...');
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
