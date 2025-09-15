const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

  console.log(`📞 Call Status Update - SID: ${CallSid}`);
  console.log(`   Status: ${CallStatus}`);
  console.log(`   Duration: ${CallDuration}s`);

  if (RecordingUrl) {
    console.log(`   🎙️ Recording Available: ${RecordingUrl}`);
  }

  // Update call status in Supabase
  if (supabase && CallStatus === 'completed') {
    try {
      await supabase
        .from('transcriptions')
        .update({
          status: 'completed',
          duration: parseInt(CallDuration) || 0
        })
        .eq('call_sid', CallSid);

      console.log(`✅ Call status updated in Supabase for ${CallSid}`);
    } catch (error) {
      console.error('Error updating call status:', error);
    }
  }

  res.status(200).send('OK');
};