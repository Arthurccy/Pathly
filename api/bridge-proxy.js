export default async function handler(req, res) {
  // Set CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Client-Id, Client-Secret, Bridge-Version, Authorization'
  );

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract endpoint path from path parameter or URL query
    let path = req.query.path;
    if (Array.isArray(path)) {
      path = path.join('/');
    } else if (!path) {
      const match = req.url.match(/\/api\/bridge-proxy\/?(.*)/);
      path = match ? match[1] : '';
    }

    // Strip out query string from path if present
    const pathWithoutQuery = path.split('?')[0];
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';

    const targetUrl = `https://api.bridgeapi.io/v2/${pathWithoutQuery}${queryString}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (req.headers['client-id']) headers['Client-Id'] = req.headers['client-id'];
    if (req.headers['client-secret']) headers['Client-Secret'] = req.headers['client-secret'];
    if (req.headers['bridge-version']) headers['Bridge-Version'] = req.headers['bridge-version'];
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
