export default async function handler(req, res) {
  try {
    const { default: app } = await import('../server/index.js');
    return app(req, res);
  } catch (error) {
    console.error('[Vercel Serverless Function Crash]:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      envDiagnostic: {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        dbProtocol: process.env.DATABASE_URL ? process.env.DATABASE_URL.split(':')[0] : null,
        hasJwtSecret: Boolean(process.env.JWT_SECRET),
        hasRazorpayKey: Boolean(process.env.RAZORPAY_KEY_ID),
        nodeVersion: process.version
      }
    });
  }
}

