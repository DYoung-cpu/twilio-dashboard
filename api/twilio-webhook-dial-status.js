module.exports = async (req, res) => {
  const { DialCallStatus, DialCallDuration } = req.body;

  console.log('📞 Dial Status:', DialCallStatus);
  console.log('Duration:', DialCallDuration, 'seconds');

  res.setHeader('Content-Type', 'text/xml');

  if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">
          The loan officer is unavailable right now.
          Please leave a message after the beep.
        </Say>
        <Record
          action="/api/twilio-webhook-voicemail"
          method="POST"
          maxLength="120"
          finishOnKey="*"
        />
      </Response>
    `);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">Thank you for calling LendWise Mortgage. Goodbye!</Say>
      </Response>
    `);
  }
};