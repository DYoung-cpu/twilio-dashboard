const twilio = require('twilio');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Loan officers configuration
const loanOfficers = {
  'david': {
    id: 'david',
    name: 'David Young',
    phoneNumber: '+19544703737',  // David's personal phone
    twilioNumber: '+18184771989',
    businessHours: { start: '09:00', end: '18:00' },
    available: true,
    location: 'Northridge, CA'
  },
  'tony': {
    id: 'tony',
    name: 'Tony Nasim',
    phoneNumber: '+18182009933',  // Tony's personal phone
    twilioNumber: '+18189182433',
    businessHours: { start: '09:00', end: '18:00' },
    available: true,
    location: 'Canoga Park, CA'
  }
};

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { loanOfficerId, message, customerPhone, customerName } = req.body;

    const loanOfficer = loanOfficers[loanOfficerId];
    if (!loanOfficer) {
      return res.status(404).json({ error: 'Loan officer not found' });
    }

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Forward message to loan officer with customer info
    const sms = await twilioClient.messages.create({
      body: `New message from ${customerName} (${customerPhone}):\n\n${message}`,
      to: loanOfficer.phoneNumber,
      from: loanOfficer.twilioNumber
    });

    // Send confirmation to customer
    await twilioClient.messages.create({
      body: `Your message has been sent to ${loanOfficer.name}. They will respond shortly.`,
      to: customerPhone,
      from: loanOfficer.twilioNumber
    });

    res.json({
      success: true,
      messageSid: sms.sid,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};