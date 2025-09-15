const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const { RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration, CallSid, Channels } = req.body;

  console.log('🎙️ Recording Status Update');
  console.log('CallSid:', CallSid);
  console.log('RecordingSid:', RecordingSid);
  console.log('Status:', RecordingStatus);
  console.log('Duration:', RecordingDuration, 'seconds');
  console.log('Channels:', Channels);
  console.log('URL:', RecordingUrl);

  // Validate recording completeness
  if (RecordingStatus === 'completed') {
    if (parseInt(RecordingDuration) < 1) {
      console.warn('⚠️ Warning: Recording duration is less than 1 second!');
    }
    if (Channels !== '2') {
      console.warn('⚠️ Warning: Recording is not dual-channel! Channels:', Channels);
    }

    // Save/update in Supabase
    if (supabase) {
      try {
        // First try to get existing record
        const { data: existing } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('call_sid', CallSid)
          .single();

        const updateData = {
          call_sid: CallSid,
          recording_sid: RecordingSid,
          duration: parseInt(RecordingDuration),
          status: 'recorded',
          recording_url: RecordingUrl,
          transcript_status: 'pending'
        };

        // If we have existing customer data, preserve it
        if (existing) {
          updateData.customer_name = existing.customer_name;
          updateData.customer_email = existing.customer_email;
          updateData.customer_phone = existing.customer_phone;
          updateData.from_number = existing.from_number;
          updateData.to_number = existing.to_number;
        }

        const { error } = await supabase
          .from('transcriptions')
          .upsert(updateData, {
            onConflict: 'call_sid'
          });

        if (error) {
          console.error('Supabase error:', error);
        } else {
          console.log(`✅ Recording data saved to Supabase for ${RecordingSid}`);
        }
      } catch (error) {
        console.error('Error saving recording to Supabase:', error);
      }
    }
  }

  res.status(200).send('OK');
};