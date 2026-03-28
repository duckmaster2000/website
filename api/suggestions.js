// Serverless-style suggestion endpoint.
// Works on platforms that expose req/res with JSON body support (e.g. Vercel Node runtime).

const MAX_TEXT = 5000;

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sanitize(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

async function maybeGenerateAiTriage(suggestion) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const prompt = [
    'You are triaging a website suggestion. Return concise plain text with these sections:',
    'Summary:',
    'Feasibility:',
    'Recommended next steps:',
    '',
    `Topic: ${suggestion.topic}`,
    `Name: ${suggestion.name || 'Anonymous'}`,
    `Email: ${suggestion.email || 'Not provided'}`,
    `Suggestion: ${suggestion.text}`
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: prompt,
      max_output_tokens: 400
    })
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  return data.output_text || null;
}

async function maybeSendEmail(subject, textBody) {
  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.SUGGEST_TO_EMAIL;
  const fromEmail = process.env.SUGGEST_FROM_EMAIL || 'Suggestions <onboarding@resend.dev>';

  if (!resendKey || !toEmail) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text: textBody
    })
  });

  return { sent: resp.ok, reason: resp.ok ? null : 'email_send_failed' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const mode = sanitize(body.mode).toLowerCase() || 'email';
    const suggestion = {
      name: sanitize(body.name),
      email: sanitize(body.email),
      topic: sanitize(body.topic) || 'Suggestion',
      text: String(body.text || '').trim()
    };

    if (!suggestion.text) {
      return json(res, 400, { ok: false, error: 'missing_text' });
    }
    if (suggestion.text.length > MAX_TEXT) {
      return json(res, 400, { ok: false, error: 'text_too_long' });
    }

    const aiTriage = mode === 'ai' ? await maybeGenerateAiTriage(suggestion) : null;

    const subjectPrefix = mode === 'ai' ? '[AI Suggestion]' : '[Website Suggestion]';
    const subject = `${subjectPrefix} ${suggestion.topic}`;
    const emailBody = [
      `Topic: ${suggestion.topic}`,
      `From: ${suggestion.name || 'Anonymous'}`,
      `Email: ${suggestion.email || 'Not provided'}`,
      `Mode: ${mode}`,
      '',
      'Suggestion:',
      suggestion.text,
      '',
      aiTriage ? `AI triage:\n${aiTriage}` : 'AI triage: not generated'
    ].join('\n');

    const emailResult = await maybeSendEmail(subject, emailBody);

    if (!emailResult.sent && !aiTriage) {
      return json(res, 501, {
        ok: false,
        error: 'backend_not_fully_configured',
        detail: 'Configure RESEND and optionally OPENAI env vars.'
      });
    }

    return json(res, 200, {
      ok: true,
      message: mode === 'ai' ? 'Suggestion triaged and forwarded.' : 'Suggestion forwarded.',
      aiGenerated: Boolean(aiTriage),
      emailed: emailResult.sent
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
