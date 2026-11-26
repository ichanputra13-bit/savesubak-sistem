// Telegram bot untuk logbook petani (Technical Design §3.7)
// TELEGRAM_BOT_TOKEN perlu ditambahkan ke .env.local setelah bot dibuat

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN tidak ditemukan di environment')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendMessage gagal (${res.status}): ${err}`)
  }
}
