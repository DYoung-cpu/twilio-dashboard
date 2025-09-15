const twilio = require('twilio');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Fetch recent calls with recordings
    const calls = await twilioClient.calls.list({
      limit: 50,
      status: 'completed'
    });

    // Get recordings for these calls
    const recordings = await twilioClient.recordings.list({
      limit: 50
    });

    // Create a map of callSid to recording
    const recordingMap = {};
    recordings.forEach(recording => {
      recordingMap[recording.callSid] = recording;
    });

    // Filter calls with recordings and format response
    const callsWithRecordings = calls
      .filter(call => recordingMap[call.sid])
      .map(call => {
        const recording = recordingMap[call.sid];

        // Check for widget call info
        let customerInfo = null;

        // For demo purposes, mark some calls as widget calls
        // In production, this would come from call metadata or a database
        const demoCustomers = {
          '+18189182433': {
            isWidgetCall: true,
            customerName: 'Federico Fernandez',
            customerEmail: 'federico@example.com',
            customerPhone: '+18189182433',
            callType: 'customer'
          },
          '+19548286704': {
            isWidgetCall: true,
            customerName: 'David Young',
            customerEmail: 'david@lendwise.com',
            customerPhone: '+19548286704',
            callType: 'customer'
          },
          '+15613861444': {
            isWidgetCall: true,
            customerName: 'Jim Customer',
            customerEmail: 'jim@example.com',
            customerPhone: '+15613861444',
            callType: 'customer'
          }
        };

        // Check if this call is from a known customer
        // Handle different phone formats
        const cleanPhone = call.from.replace(/\D/g, '');
        let foundCustomer = null;

        // Check each demo customer number
        for (const [demoPhone, info] of Object.entries(demoCustomers)) {
          const cleanDemo = demoPhone.replace(/\D/g, '');
          // Match if the last 10 digits are the same
          if (cleanPhone.endsWith(cleanDemo.slice(-10)) || cleanDemo.endsWith(cleanPhone.slice(-10))) {
            foundCustomer = info;
            console.log(`Matched customer ${info.customerName} for ${call.from}`);
            break;
          }
        }

        customerInfo = foundCustomer || {
          isWidgetCall: false,
          customerName: null,
          customerEmail: null,
          customerPhone: call.from,
          callType: 'standard'
        };

        return {
          sid: call.sid,
          from: call.from,
          to: call.to,
          direction: call.direction,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime,
          status: call.status,
          recording: {
            sid: recording.sid,
            duration: recording.duration,
            channels: recording.channels,
            status: recording.status,
            dateCreated: recording.dateCreated,
            mediaUrl: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`
          },
          customerInfo: customerInfo
        };
      })
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    console.log(`Found ${callsWithRecordings.length} calls with recordings`);

    return res.json({
      success: true,
      count: callsWithRecordings.length,
      calls: callsWithRecordings
    });

  } catch (error) {
    console.error('Dashboard error:', error);

    if (error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Twilio credentials not configured'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}