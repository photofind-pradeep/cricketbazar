// netlify/functions/cricket.js
// Standard Netlify Function (CommonJS)

const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const API_KEY = process.env.CRICKETDATA_KEY
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CRICKETDATA_KEY not set in Netlify environment variables' })
    }
  }

  const params   = event.queryStringParameters || {}
  const endpoint = params.endpoint || 'currentMatches'
  const offset   = params.offset   || '0'
  const id       = params.id       || ''

  let url = `https://api.cricapi.com/v1/${endpoint}?apikey=${API_KEY}&offset=${offset}`
  if (id) url += `&id=${id}`

  try {
    const res  = await fetch(url)
    const data = await res.json()
    return {
      statusCode: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=20',
      },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}

module.exports = { handler }
