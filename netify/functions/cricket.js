// netlify/functions/cricket.js
const CRICAPI = 'https://api.cricapi.com/v1'

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const API_KEY = process.env.CRICKETDATA_KEY
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) }
  }

  const params   = event.queryStringParameters || {}
  const endpoint = params.endpoint || 'currentMatches'
  const offset   = params.offset   || '0'
  const id       = params.id       || ''

  let url = `${CRICAPI}/${endpoint}?apikey=${API_KEY}&offset=${offset}`
  if (id) url += `&id=${id}`

  try {
    const response = await fetch(url)
    const data     = await response.json()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=20',
      },
      body: JSON.stringify(data),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch', message: error.message }),
    }
  }
}
