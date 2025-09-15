const twilio = require('twilio');
const { supabase } = require('../lib/supabase');

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
    const { loanOfficerId, customerPhone, customerName, customerEmail } = req.body;

    const loanOfficer = loanOfficers[loanOfficerId];
    if (!loanOfficer) {
      return res.status(404).json({ error: 'Loan officer not found' });
    }

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Get base URL for callbacks
    const baseUrl = `https://${req.headers.host}`;

    // Create a call that connects customer to loan officer
    const call = await twilioClient.calls.create({
      twiml: `<Response>
        <Say voice="alice">We will be connecting you with ${loanOfficer.name} at LendWise Mortgage.</Say>
        <Dial timeout="30"
              record="record-from-answer-dual"
              recordingChannels="dual"
              recordingTrack="both_legs"
              recordingStatusCallback="${baseUrl}/api/twilio-webhook-recording"
              recordingStatusCallbackEvent="completed">
          ${loanOfficer.phoneNumber}
        </Dial>
      </Response>`,
      to: customerPhone,
      from: loanOfficer.twilioNumber,
      statusCallback: `${baseUrl}/api/twilio-webhook-call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    // Store customer data in Supabase immediately
    if (supabase) {
      try {
        await supabase
          .from('transcriptions')
          .upsert({
            call_sid: call.sid,
            customer_name: customerName || 'Unknown',
            customer_email: customerEmail || null,
            customer_phone: customerPhone,
            from_number: loanOfficer.twilioNumber,
            to_number: customerPhone,
            status: 'initiated',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'call_sid'
          });

        console.log(`✅ Customer data saved to Supabase for ${call.sid}`);
      } catch (error) {
        console.error('Error saving to Supabase:', error);
      }
    }

    console.log(`📞 Call initiated: ${call.sid}`);
    console.log(`   Customer: ${customerName} (${customerPhone})`);
    console.log(`   Loan Officer: ${loanOfficer.name}`);

    res.json({
      success: true,
      callSid: call.sid,
      message: `Connecting you with ${loanOfficer.name}`
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
};