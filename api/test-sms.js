const twilio = require('twilio');

module.exports = async (req, res) => {
  // Allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize Twilio
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Simple test message
    const message = `Test SMS at ${new Date().toLocaleTimeString()}. Reply to confirm.`;

    // Send to Tony's cell
    const result = await client.messages.create({
      body: message,
      to: '+18183919142', // Tony's cell
      from: '+18189182433' // Tony's Twilio number
    });

    res.json({
      success: true,
      messageSid: result.sid,
      to: result.to,
      status: result.status
    });
  } catch (error) {
    console.error('SMS Error:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
};