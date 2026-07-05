import { prisma } from '@/lib/prisma';

export const DEFAULT_SETTINGS: Record<string, string> = {
  telegram_enabled: 'true',
  telegram_bot_token: '',
  telegram_chat_id: '',
  offline_threshold_minutes: '60',
  alert_near_full_levels: '80, 90, 95',
  alert_low_battery_levels: '20, 15, 10, 5, 0',
  msg_template_plugged_in: '<b>[แจ้งเตือน: เสียบสายชาร์จ]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> เริ่มเสียบสายชาร์จแล้ว\n<b>ระดับแบตเตอรี่:</b> <b>{battery}%</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_unplugged: '<b>[แจ้งเตือน: ถอดสายชาร์จ]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> ถอดสายชาร์จแล้ว\n<b>ระดับแบตเตอรี่:</b> <b>{battery}%</b>\n<b>ชาร์จตั้งแต่:</b> <b>{start_time} ({start_battery}%)</b>\n<b>ได้แบตเพิ่ม:</b> <b>{gained}</b>\n<b>ใช้เวลาชาร์จ:</b> <b>{duration}</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_full_charge: '<b>[แจ้งเตือน: แบตเตอรี่ชาร์จเต็ม]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> ชาร์จเต็ม 100% เรียบร้อยแล้ว\n<b>ระดับแบตเตอรี่:</b> <b>100%</b>\n<b>ชาร์จตั้งแต่:</b> <b>{start_time} ({start_battery}%)</b>\n<b>ได้แบตเพิ่ม:</b> <b>{gained}</b>\n<b>ใช้เวลาชาร์จ:</b> <b>{duration}</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_near_full: '<b>[แจ้งเตือน: แบตเตอรี่ใกล้เต็ม]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> ชาร์จถึงระดับแจ้งเตือน ({battery}%)\n<b>ระดับปัจจุบัน:</b> <b>{battery}%</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_low_battery: '<b>[แจ้งเตือน: แบตเตอรี่ต่ำ]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> ลดต่ำกว่าจุดแจ้งเตือน ({battery}%)\n<b>เหลือแบตเตอรี่:</b> <b>{battery}%</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_battery_empty: '<b>[แจ้งเตือน: แบตเตอรี่หมดวิกฤต]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> แบตเตอรี่เหลือ 0%\n<b>คำแนะนำ:</b> <b>อุปกรณ์อาจดับหรือหยุดทำงาน</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  msg_template_reconnected: '<b>[แจ้งเตือน: กลับมาเชื่อมต่อระบบ]</b>\n--------------------------------\n<b>อุปกรณ์:</b> <code>{device}</code>\n<b>สถานะ:</b> กลับมาออนไลน์\n<b>ขาดการติดต่อไป:</b> <b>ประมาณ {duration}</b>\n--------------------------------\n<i>เวลา: {datetime}</i>',
  api_secret_key: 'secret_batt_2026',
  dashboard_password: 'battery123',
};

export async function getSystemSettings(): Promise<Record<string, string>> {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const s of settings) {
      result[s.key] = s.value;
    }
    if (!result.telegram_bot_token && process.env.TELEGRAM_BOT_TOKEN) {
      result.telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (!result.telegram_chat_id && process.env.TELEGRAM_CHAT_ID) {
      result.telegram_chat_id = process.env.TELEGRAM_CHAT_ID;
    }
    return result;
  } catch (error) {
    console.error('Failed to get system settings from db:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function formatTemplateMessage(
  template: string,
  params: {
    device?: string;
    battery?: number | string;
    time?: string;
    date?: string;
    datetime?: string;
    duration?: string;
    start_time?: string;
    start_battery?: number | string;
    gained?: string;
  }
): string {
  let text = template;
  if (params.device !== undefined) text = text.replace(/\{device\}/g, String(params.device));
  if (params.battery !== undefined) text = text.replace(/\{battery\}/g, String(params.battery));
  if (params.time !== undefined) text = text.replace(/\{time\}/g, String(params.time));
  if (params.date !== undefined) text = text.replace(/\{date\}/g, String(params.date));
  if (params.datetime !== undefined) text = text.replace(/\{datetime\}/g, String(params.datetime));
  if (params.duration !== undefined) text = text.replace(/\{duration\}/g, String(params.duration));
  if (params.start_time !== undefined) text = text.replace(/\{start_time\}/g, String(params.start_time));
  if (params.start_battery !== undefined) text = text.replace(/\{start_battery\}/g, String(params.start_battery));
  if (params.gained !== undefined) text = text.replace(/\{gained\}/g, String(params.gained));
  return text;
}
