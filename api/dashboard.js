const twilio = require('twilio');
const { supabase } = require('../lib/supabase');

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

    // Fetch customer data from Supabase
    let customerDataMap = {};
    if (supabase) {
      try {
        const { data: transcriptionData, error } = await supabase
          .from('transcriptions')
          .select('call_sid, customer_name, customer_email, customer_phone, from_number, to_number');

        if (!error && transcriptionData) {
          transcriptionData.forEach(item => {
            if (item.call_sid) {
              customerDataMap[item.call_sid] = {
                name: item.customer_name,
                email: item.customer_email,
                phone: item.customer_phone || item.from_number,
                source: item.customer_name ? 'widget' : 'direct'
              };
            }
          });
          console.log(`Loaded customer data for ${Object.keys(customerDataMap).length} calls from Supabase`);
        }
      } catch (err) {
        console.error('Error fetching customer data from Supabase:', err);
      }
    }

    // Loan Officer Phone Number Mapping
    // Maps Twilio phone numbers to loan officers
    // Use multiple formats to ensure matching
    const loanOfficerNumbers = {
      '+18184771989': {  // David's Twilio number
        name: 'David Young',
        email: 'david@lendwise.com',
        title: 'Senior Loan Officer',
        nmls: '123456'
      },
      '18184771989': {  // Without +
        name: 'David Young',
        email: 'david@lendwise.com',
        title: 'Senior Loan Officer',
        nmls: '123456'
      },
      '8184771989': {  // Just 10 digits
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
      },
      '18189182433': {  // Without +
        name: 'Tony Nasim',
        email: 'tony.nasim@lendwisemortgage.com',
        title: 'Loan Officer',
        nmls: '789012'
      },
      '8189182433': {  // Just 10 digits
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
      '+18054048056': {
        name: 'Test Contact 1',
        email: 'contact1@example.com',
        source: 'direct'
      },
      '8054048056': {
        name: 'Test Contact 1',
        email: 'contact1@example.com',
        source: 'direct'
      },
      '+14242726952': {
        name: 'Test Contact 2',
        email: 'contact2@example.com',
        source: 'direct'
      },
      '4242726952': {
        name: 'Test Contact 2',
        email: 'contact2@example.com',
        source: 'direct'
      },
      '+19548286704': {
        name: 'David Young',
        email: 'david@lendwise.com',
        source: 'direct'
      },
      '+13109547772': {
        name: 'David Cell',
        email: 'david@lendwise.com',
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

        // Find matching loan officer - try direct lookup first
        console.log(`Checking loan officer for ${call.direction} call:`, loanOfficerPhone);

        // Direct lookup with the exact format
        loanOfficerInfo = loanOfficerNumbers[loanOfficerPhone];

        // If no direct match, try with just digits
        if (!loanOfficerInfo) {
          loanOfficerInfo = loanOfficerNumbers[cleanLOPhone];
        }

        // If still no match, try last 10 digits
        if (!loanOfficerInfo) {
          const last10 = cleanLOPhone.slice(-10);
          loanOfficerInfo = loanOfficerNumbers[last10];
        }

        if (loanOfficerInfo) {
          console.log(`  ✓ Matched: ${loanOfficerInfo.name}`);
        } else {
          console.log(`  ✗ No match found for ${loanOfficerPhone} (cleaned: ${cleanLOPhone})`);
        }

        // Identify the customer - first check Supabase data
        let customerInfo = null;
        const customerPhone = call.direction === 'inbound' ? call.from : call.to;
        const cleanCustomerPhone = customerPhone.replace(/\D/g, '');

        // Check if we have customer data from Supabase for this call
        if (customerDataMap[call.sid]) {
          customerInfo = {
            ...customerDataMap[call.sid],
            isKnown: true
          };
          console.log(`Found customer data from Supabase for call ${call.sid}: ${customerInfo.name}`);
        } else {
          // Fall back to checking known customers list
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
        }

        // If still not found, create basic info
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