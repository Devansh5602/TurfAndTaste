import crypto from 'crypto';

const signingSecret = () => process.env.QUOTE_TOKEN_SECRET || process.env.JWT_SECRET;
const sign = (body) => crypto.createHmac('sha256', signingSecret()).update(body).digest('base64url');

export const createQuoteToken = (quote) => {
  if (!signingSecret()) throw new Error('Quote signing is not configured.');
  const payload = { ...quote, quoteId: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + Number(process.env.QUOTE_TTL_SECONDS || 600) };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
};

export const verifyQuoteToken = (token) => {
  if (!signingSecret() || typeof token !== 'string') return { error: 'A current booking quote is required.' };
  const [body, signature] = token.split('.');
  if (!body || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(body)))) return { error: 'Booking quote is invalid.' };
  try {
    const quote = JSON.parse(Buffer.from(body, 'base64url').toString());
    return quote?.quoteId && quote.exp >= Math.floor(Date.now() / 1000) ? { quote } : { error: 'Booking quote has expired. Please refresh your slot.' };
  } catch { return { error: 'Booking quote is invalid.' }; }
};
