import { prisma } from '@/lib/prisma';

export const DEFAULT_SETTINGS: Record<string, string> = {
  telegram_enabled: 'true',
  telegram_bot_token: '',
  telegram_chat_id: '',
  offline_threshold_minutes: '60',
  alert_near_full_levels: '80, 90, 95',
  alert_low_battery_levels: '20, 15, 10, 5, 0',
  msg_template_plugged_in: '⚡ เริ่มเสียบสายชาร์จแล้ว\nระดับแบตเตอรี่: {battery}%\nเวลา: {time}',
  msg_template_unplugged: '🔋 ถอดสายชาร์จแล้ว\nระดับแบตเตอรี่: {battery}%\nเวลา: {time}',
  msg_template_full_charge: '✨ ชาร์จแบตเตอรี่เต็ม 100% เรียบร้อยแล้ว!\nเวลา: {time}',
  msg_template_near_full: '⚡ แบตเตอรี่ใกล้เต็ม ({battery}%)\nเวลา: {time}',
  msg_template_low_battery: '⚠️ แบตเตอรี่ต่ำ ({battery}%)\nเวลา: {time}',
  msg_template_battery_empty: '🚨 แบตเตอรี่หมดวิกฤต (0%)\nเวลา: {time}',
  msg_template_reconnected: '🌐 กลับมาออนไลน์แล้ว\nขาดการติดต่อไปประมาณ {duration}\nระดับแบตเตอรี่: {battery}%\nเวลา: {time}',
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
    duration?: string;
  }
): string {
  let text = template;
  if (params.device !== undefined) text = text.replace(/\{device\}/g, String(params.device));
  if (params.battery !== undefined) text = text.replace(/\{battery\}/g, String(params.battery));
  if (params.time !== undefined) text = text.replace(/\{time\}/g, String(params.time));
  if (params.duration !== undefined) text = text.replace(/\{duration\}/g, String(params.duration));
  return text;
}
