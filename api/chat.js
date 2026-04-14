/**
 * Serverless proxy for OpenAI chat. Keeps OPENAI_API_KEY on the server.
 * Used when deployed (e.g. Vercel). For local dev, use server.js.
 *
 * Request body:
 * { messages: [{ role, content }, ...], systemPrompt: string }
 *
 * Response body:
 * { content: string } or { error: string }
 */
export default {
    async fetch(request) {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const key = process.env.OPENAI_API_KEY;
        if (!key || !key.trim()) {
            return new Response(
                JSON.stringify({ error: 'OPENAI_API_KEY is not set on the server.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { messages, systemPrompt } = body || {};
        if (!Array.isArray(messages) || !systemPrompt) {
            return new Response(
                JSON.stringify({
                    error: 'Body must include messages (array) and systemPrompt (string).'
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const payload = {
            model: 'gpt-4o',
            temperature: 0.3,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            max_tokens: 600,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.filter(m => m.role === 'user' || m.role === 'assistant')
            ]
        };

        async function readUpstreamBody(response) {
            const contentType = response.headers.get('content-type') || '';
            const raw = await response.text();

            if (!raw) {
                return { data: null, text: '' };
            }

            if (contentType.includes('application/json')) {
                try {
                    return { data: JSON.parse(raw), text: raw };
                } catch (e) {
                    // Fall back to plain text when the upstream claims JSON but sends malformed content.
                }
            }

            return { data: null, text: raw };
        }

        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key.trim()}`
                },
                body: JSON.stringify(payload)
            });

            const { data, text } = await readUpstreamBody(res);
            if (!res.ok) {
                const upstreamMessage =
                    data?.error?.message || (text && text.trim()) || `OpenAI error (${res.status})`;
                const errorMessage = data?.error?.message
                    ? upstreamMessage
                    : `OpenAI upstream unavailable (${res.status}).`;
                return new Response(JSON.stringify({ error: errorMessage }), {
                    status: res.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const content =
                data?.choices?.[0]?.message?.content ?? 'I could not generate a response.';
            return new Response(JSON.stringify({ content }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e?.message || 'Request failed.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};
