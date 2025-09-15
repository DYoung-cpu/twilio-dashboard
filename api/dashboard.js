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

        // Check for widget call info in call tags/properties
        let customerInfo = null;

        // Try to parse customer info from call properties if available
        if (call.subresourceUris?.user_defined_messages) {
          // This would need to be implemented based on how you store customer info
          customerInfo = {
            isWidgetCall: false,
            customerName: null,
            customerEmail: null,
            customerPhone: call.from,
            callType: 'standard'
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