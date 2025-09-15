const twilio = require('twilio');
const { supabase } = require('../lib/supabase');

// In-memory storage for call data (to track incoming calls)
const callDataStore = {};

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

// Map Twilio numbers to loan officers
const twilioNumberToLoanOfficer = {
  '+18184771989': 'david',
  '18184771989': 'david',
  '8184771989': 'david',
  '+18189182433': 'tony',
  '18189182433': 'tony',
  '8189182433': 'tony'
};

module.exports = async (req, res) => {
  // Handle incoming voice calls
  console.log('📞 Incoming call webhook triggered');
  console.log('To:', req.body.To);
  console.log('From:', req.body.From);
  console.log('CallSid:', req.body.CallSid);

  const toNumber = req.body.To;
  const fromNumber = req.body.From;
  const callSid = req.body.CallSid;

  // Identify which loan officer this call is for
  const loanOfficerId = twilioNumberToLoanOfficer[toNumber] || twilioNumberToLoanOfficer[toNumber.replace('+1', '')];
  const loanOfficer = loanOfficerId ? loanOfficers[loanOfficerId] : null;

  console.log('Identified loan officer:', loanOfficer?.name || 'Unknown');

  // Store call data for later use
  if (loanOfficer) {
    callDataStore[callSid] = {
      customerPhone: fromNumber,
      customerName: 'Incoming Call',  // We don't know the name for incoming calls
      loanOfficer: loanOfficer.name,
      loanOfficerPhone: loanOfficer.phoneNumber,
      twilioNumber: loanOfficer.twilioNumber,
      startTime: new Date().toISOString()
    };

    // Save to Supabase immediately
    if (supabase) {
      try {
        await supabase
          .from('transcriptions')
          .upsert({
            call_sid: callSid,
            from_number: fromNumber,
            to_number: toNumber,
            customer_phone: fromNumber,
            customer_name: 'Incoming Call',
            status: 'initiated',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'call_sid'
          });
      } catch (error) {
        console.error('Error saving to Supabase:', error);
      }
    }
  }

  // Generate TwiML response
  res.setHeader('Content-Type', 'text/xml');

  if (!loanOfficer) {
    // No loan officer found for this number
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">Thank you for calling LendWise Mortgage. We're unable to route your call at this time. Please try again later.</Say>
      </Response>
    `);
    return;
  }

  // Check if loan officer is available
  const now = new Date();
  const currentHour = now.getHours();
  const businessStart = parseInt(loanOfficer.businessHours.start.split(':')[0]);
  const businessEnd = parseInt(loanOfficer.businessHours.end.split(':')[0]);
  const isBusinessHours = currentHour >= businessStart && currentHour < businessEnd;

  if (!loanOfficer.available || !isBusinessHours) {
    // Loan officer is not available
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">
          Thank you for calling ${loanOfficer.name} at LendWise Mortgage.
          ${!isBusinessHours ?
            `Our office hours are ${loanOfficer.businessHours.start} to ${loanOfficer.businessHours.end}.` :
            `${loanOfficer.name} is currently unavailable.`
          }
          Please leave a message after the beep, or call back during business hours.
        </Say>
        <Record
          action="/api/twilio-webhook-voicemail"
          method="POST"
          maxLength="120"
          finishOnKey="*"
          recordingStatusCallback="/api/twilio-webhook-recording"
          recordingStatusCallbackMethod="POST"
        />
      </Response>
    `);
    return;
  }

  // Get base URL for callbacks
  const baseUrl = `https://${req.headers.host}`;

  // Loan officer is available - connect the call with recording
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">
        Thank you for calling ${loanOfficer.name} at LendWise Mortgage.
        Please hold while we connect your call.
      </Say>
      <Dial
        timeout="30"
        record="record-from-answer-dual"
        recordingChannels="dual"
        recordingTrack="both_legs"
        recordingStatusCallback="${baseUrl}/api/twilio-webhook-recording"
        recordingStatusCallbackEvent="completed"
        action="/api/twilio-webhook-dial-status"
        method="POST">
        ${loanOfficer.phoneNumber}
      </Dial>
    </Response>
  `);
};