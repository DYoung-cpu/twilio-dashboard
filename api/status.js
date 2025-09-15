module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check if environment variables are configured
  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );

  const assemblyAIConfigured = !!process.env.ASSEMBLYAI_API_KEY;

  return res.json({
    success: true,
    twilio: twilioConfigured ? 'configured' : 'not configured',
    assemblyai: assemblyAIConfigured ? 'configured' : 'not configured',
    openai: 'not required',
    status: twilioConfigured && assemblyAIConfigured ? 'ready' : 'partial'
  });
};