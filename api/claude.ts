export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing x-api-key header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': request.headers.get('anthropic-version') ?? '2023-06-01',
    },
    body,
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
