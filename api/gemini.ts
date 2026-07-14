export const config = { runtime: 'edge' };

// Modèle Gemini gratuit. Doit rester cohérent avec GEMINI_MODEL dans
// src/lib/ai-service.ts (utilisé côté client en développement).
const GEMINI_MODEL = 'gemini-flash-latest';

// Proxy vers l'API Google Gemini : évite les soucis de CORS et garde la clé de
// l'utilisateur côté requête (elle n'est jamais stockée sur le serveur).
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = request.headers.get('x-goog-api-key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing x-goog-api-key header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body,
    },
  );

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
