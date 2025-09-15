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

    // Loan Officer Phone Number Mapping
    // Maps Twilio phone numbers to loan officers
    const loanOfficerNumbers = {
      '+18184771989': {  // David's Twilio number
        name: 'David Young',
        email: 'david@lendwise.com',
        title: 'Senior Loan Officer',
        nmls: '123456'
      },
      '+18189182433': {  // Tony's Twilio number
        name: 'Tony Nasim',
        email: 'tony.nasim@lendwisemortgage.com',
        title: 'Loan Officer',
        nmls: '789012'
      }
      // Add more loan officer numbers as needed
    };

    // Customer information for known customers
    // In production, this would come from CRM or widget metadata
    const knownCustomers = {
      '+18189182433': {
        name: 'Federico Fernandez',
        email: 'federico@example.com',
        source: 'widget'
      },
      '+19548286704': {
        name: 'Test Customer',
        email: 'test@example.com',
        source: 'direct'
      }
    };

    // Filter calls with recordings and format response
    const callsWithRecordings = calls
      .filter(call => recordingMap[call.sid])
      .map(call => {
        const recording = recordingMap[call.sid];

        // Identify the loan officer who received/made the call
        let loanOfficerInfo = null;

        // For inbound calls, check the 'to' field
        // For outbound calls, check the 'from' field
        const loanOfficerPhone = call.direction === 'inbound' ? call.to : call.from;

        // Clean phone number for matching
        const cleanLOPhone = loanOfficerPhone.replace(/\D/g, '');

        // Find matching loan officer
        for (const [phone, info] of Object.entries(loanOfficerNumbers)) {
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanLOPhone.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(cleanLOPhone.slice(-10))) {
            loanOfficerInfo = {
              ...info,
              phone: phone
            };
            break;
          }
        }

        // Identify the customer
        let customerInfo = null;
        const customerPhone = call.direction === 'inbound' ? call.from : call.to;
        const cleanCustomerPhone = customerPhone.replace(/\D/g, '');

        // Check if this is a known customer
        for (const [phone, info] of Object.entries(knownCustomers)) {
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanCustomerPhone.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(cleanCustomerPhone.slice(-10))) {
            customerInfo = {
              ...info,
              phone: customerPhone,
              isKnown: true
            };
            break;
          }
        }

        // If not a known customer, create basic info
        if (!customerInfo) {
          customerInfo = {
            name: null,
            email: null,
            phone: customerPhone,
            isKnown: false,
            source: 'phone'
          };
        }

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
          loanOfficerInfo: loanOfficerInfo,
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