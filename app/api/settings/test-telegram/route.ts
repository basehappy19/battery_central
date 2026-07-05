import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token, chatId, message } = await req.json();
    if (!token || !chatId) {
      return NextResponse.json({ error: 'กรุณาระบุ Bot Token และ Chat ID' }, { status: 400 });
    }

    const testMsg = message || '<b>[ข้อความทดสอบจาก Battery Central]</b>\nการเชื่อมต่อ Telegram Bot ของคุณทำงานได้อย่างถูกต้องแล้ว!';
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMsg,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return NextResponse.json({ error: data.description || 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Token หรือ Chat ID' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'ส่งข้อความทดสอบเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Failed to test telegram:', error);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อ Telegram API ได้' }, { status: 500 });
  }
}
