const twilio = require('twilio');
const { supabase } = require('../lib/supabase');

// CORS headers - Allow all origins including local files
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Credentials': 'false'
};

// Tony's configuration
const TONY_CONFIG = {
  name: 'Tony Nasim',
  cellPhone: '+18183919142',  // Tony's actual cell phone
  twilioNumber: '+18189182433', // Tony's Twilio number for replies
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
    const { conversationId, customerName, customerPhone, message, isSystem } = req.body;

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Store message in Supabase
    if (supabase && conversationId) {
      try {
        await supabase
          .from('conversations')
          .insert({
            conversation_id: conversationId,
            customer_name: customerName,
            customer_phone: customerPhone,
            message: message,
            sender: 'customer',
            created_at: new Date().toISOString()
          });
      } catch (dbError) {
        console.error('Error saving to Supabase:', dbError);
      }
    }

    // Send SMS to Tony's cell phone
    const sms = await twilioClient.messages.create({
      body: message,
      to: TONY_CONFIG.cellPhone,
      from: TONY_CONFIG.twilioNumber
    });

    console.log(`SMS sent to Tony: ${sms.sid}`);

    res.json({
      success: true,
      messageSid: sms.sid,
      message: 'Message sent to Tony'
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};