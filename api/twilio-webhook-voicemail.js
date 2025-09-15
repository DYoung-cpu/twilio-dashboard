module.exports = async (req, res) => {
  console.log('📧 Voicemail recorded');
  console.log('RecordingUrl:', req.body.RecordingUrl);
  console.log('RecordingDuration:', req.body.RecordingDuration);

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">
        Thank you for your message. We'll get back to you as soon as possible. Goodbye!
      </Say>
    </Response>
  `);
};