let cachedToken: { token: string; expiresAt: number } | null = null

export async function getSentinelToken(): Promise<string> {
  const now = Date.now()

  // Kembalikan token yang masih valid (dengan buffer 60 detik sebelum expired)
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const res = await fetch(
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SENTINEL_CLIENT_ID!,
        client_secret: process.env.SENTINEL_CLIENT_SECRET!,
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sentinel Hub auth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }

  return cachedToken.token
}
