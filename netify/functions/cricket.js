// netlify/functions/cricket.js
// ═══════════════════════════════════════════════════════════════
//  CricketBazar — Netlify Serverless Proxy
//
//  WHY THIS EXISTS:
//  CricketData.org blocks direct browser calls with
//  "Host not in allowlist". This function runs on Netlify's
//  SERVER (not browser), so the restriction doesn't apply.
//
//  HOW IT WORKS:
//  Browser → calls /api/cricket?endpoint=currentMatches
//         → Netlify function adds your secret API key
//         → calls api.cricapi.com on server side
//         → returns data to browser
//
//  YOUR API KEY IS NEVER EXPOSED TO USERS ✅
//
//  SETUP:
//  Netlify dashboard → Environment Variables → Add:
//  CRICKETDATA_KEY = d7ef00e2-f81b-484e-abd8-f448f8d7b07b
// ═══════════════════════════════════════════════════════════════

const CRICAPI_BASE = 'https://api.cricapi.com/v1'

exports.handler = async (event) => {

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Get API key from Netlify environment (never exposed to browser)
  const API_KEY = process.env.CRICKETDATA_KEY
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    }
  }

  // Get which endpoint to call from query params
  // e.g. /api/cricket?endpoint=currentMatches&offset=0
  const params  = event.queryStringParameters || {}
  const endpoint = params.endpoint || 'currentMatches'
  const offset  = params.offset   || '0'
  const id      = params.id       || ''

  // Build the CricketData URL
  let url = `${CRICAPI_BASE}/${endpoint}?apikey=${API_KEY}&offset=${offset}`
  if (id) url += `&id=${id}`

  try {
    // Make the API call from SERVER side (no allowlist issue!)
    const response = await fetch(url)
    const data     = await response.json()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Allow your app to call this function
        'Access-Control-Allow-Origin': '*',
        // Cache live scores for 20 seconds
        'Cache-Control': 'public, max-age=20',
      },
      body: JSON.stringify(data),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch cricket data',
        message: error.message,
      }),
    }
  }
}
