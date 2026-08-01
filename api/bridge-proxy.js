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
    // Extract endpoint path from query param or URL
    let path = req.query.path;
    if (Array.isArray(path)) {
      path = path.join('/');
    } else if (!path) {
      const match = req.url.match(/\/api\/bridge-proxy\/?(.*)/);
      path = match ? match[1] : '';
    }

    const pathWithoutQuery = path.split('?')[0];
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `https://api.bridgeapi.io/v2/${pathWithoutQuery}${queryString}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (req.headers['client-id']) headers['Client-Id'] = req.headers['client-id'];
    if (req.headers['client-secret']) headers['Client-Secret'] = req.headers['client-secret'];
    headers['Bridge-Version'] = req.headers['bridge-version'] || '2025-01-15';
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (typeof req.body === 'string') {
        fetchOptions.body = req.body;
      } else if (req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      } else {
        fetchOptions.body = '{}';
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
