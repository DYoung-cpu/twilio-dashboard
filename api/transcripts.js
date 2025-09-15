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
    if (supabase) {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return res.json({
          success: true,
          transcripts: {},
          count: 0,
          totalCost: 0
        });
      }

      // Convert to expected format
      const transcripts = {};
      let totalCost = 0;

      data.forEach(item => {
        if (item.recording_sid) {
          transcripts[item.recording_sid] = item.transcript_text || item;
          totalCost += 0.001; // Estimate cost per transcription
        }
      });

      return res.json({
        success: true,
        transcripts,
        count: Object.keys(transcripts).length,
        totalCost: totalCost.toFixed(4)
      });
    } else {
      // No Supabase configured
      return res.json({
        success: true,
        transcripts: {},
        count: 0,
        totalCost: 0
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