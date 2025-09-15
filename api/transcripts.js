const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // For now, return empty transcripts since Supabase isn't configured
    // The frontend will use localStorage for existing transcripts
    console.log('Transcripts API called - Supabase configured:', !!supabase);

    if (supabase) {
      try {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from('transcriptions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          // Return empty but still successful
          return res.json({
            success: true,
            transcripts: {},
            count: 0,
            totalCost: 0,
            message: 'Supabase not available, using localStorage'
          });
        }

        // Convert to expected format
        const transcripts = {};
        let totalCost = 0;

        if (data && data.length > 0) {
          data.forEach(item => {
            if (item.recording_sid) {
              // Parse the transcript text if it's a JSON string
              try {
                transcripts[item.recording_sid] = typeof item.transcript_text === 'string'
                  ? JSON.parse(item.transcript_text)
                  : item.transcript_text;
              } catch (e) {
                transcripts[item.recording_sid] = item.transcript_text;
              }
              totalCost += 0.001; // Estimate cost per transcription
            }
          });
        }

        return res.json({
          success: true,
          transcripts,
          count: Object.keys(transcripts).length,
          totalCost: totalCost.toFixed(4)
        });
      } catch (supabaseError) {
        console.error('Supabase query failed:', supabaseError);
        return res.json({
          success: true,
          transcripts: {},
          count: 0,
          totalCost: 0,
          message: 'Using localStorage fallback'
        });
      }
    } else {
      // No Supabase configured - rely on localStorage
      console.log('No Supabase configured - frontend will use localStorage');
      return res.json({
        success: true,
        transcripts: {},
        count: 0,
        totalCost: 0,
        message: 'Using localStorage for transcripts'
      });
    }
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return res.json({
      success: false,
      error: error.message,
      transcripts: {},
      count: 0,
      totalCost: 0
    });
  }
};