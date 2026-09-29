export default async function handler(req, res) {
  try {
    const { default: app } = await import('../server/index.js');
    return app(req, res);
  } catch (error) {
    console.error('[Vercel Serverless Function Crash]:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected serverless error occurred. Please retry later.'
    });
  }
}

