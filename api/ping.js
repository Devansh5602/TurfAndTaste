export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Ping from Vercel serverless function',
    node: process.version,
    envKeys: Object.keys(process.env).filter(k => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('pass') && !k.toLowerCase().includes('key')),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasRazorpayKey: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpayKeyPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.slice(0, 8) : null
  });
}
