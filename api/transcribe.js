const axios = require('axios');
const twilio = require('twilio');

// CORS headers for Vercel
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recordingSid, callSid, from, to } = req.body;

    if (!recordingSid) {
      return res.status(400).json({ error: 'Recording SID required' });
    }

    console.log(`🎙️ Starting transcription for ${recordingSid}`);

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Get recording details
    const recording = await twilioClient.recordings(recordingSid).fetch();
    const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

    console.log(`📞 Recording Details:`);
    console.log(`   Duration: ${recording.duration} seconds`);
    console.log(`   Status: ${recording.status}`);
    console.log(`   Channels: ${recording.channels}`);

    // Download audio with proper timeout and size limits
    const audioResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      },
      timeout: 30000, // 30 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024
    });

    const audioSizeKB = audioResponse.data.byteLength / 1024;
    console.log(`   Downloaded: ${audioSizeKB.toFixed(2)} KB`);

    // Check for truncation
    const expectedMinSizeKB = recording.duration * 8; // Conservative estimate
    if (audioSizeKB < expectedMinSizeKB) {
      console.warn(`⚠️ Audio might be truncated! Expected at least ${expectedMinSizeKB}KB, got ${audioSizeKB}KB`);
    }

    // Upload to AssemblyAI
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioResponse.data,
      {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream',
          'transfer-encoding': 'chunked'
        }
      }
    );

    const audioUrl = uploadResponse.data.upload_url;

    // Request transcription with enhanced settings
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: audioUrl,
        speaker_labels: true,
        speakers_expected: 2,
        auto_highlights: true,
        entity_detection: true,
        sentiment_analysis: true,
        auto_chapters: true,
        language_detection: true,
        punctuate: true,
        format_text: true
      },
      {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptResponse.data.id;
    console.log(`   Transcript ID: ${transcriptId}`);

    // Poll for completion (max 30 seconds for Vercel timeout)
    let attempts = 0;
    const maxAttempts = 25; // Slightly less than Vercel's timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'authorization': process.env.ASSEMBLYAI_API_KEY
          }
        }
      );

      const transcript = statusResponse.data;

      if (transcript.status === 'completed') {
        console.log(`✅ Transcription completed`);
        console.log(`   Duration: ${transcript.audio_duration}s`);
        console.log(`   Text length: ${transcript.text?.length || 0} chars`);

        // Check for quality issues
        if (transcript.audio_duration < recording.duration * 0.5) {
          console.warn(`⚠️ Possible truncation: Only ${transcript.audio_duration}s of ${recording.duration}s transcribed`);
        }

        // Format transcript with speakers
        const formattedTranscript = formatTranscript(transcript);

        return res.json({
          success: true,
          transcript: formattedTranscript,
          duration: transcript.audio_duration,
          expectedDuration: recording.duration,
          insights: extractInsights(transcript)
        });
      } else if (transcript.status === 'error') {
        console.error('❌ Transcription failed:', transcript.error);
        return res.json({
          success: false,
          error: transcript.error
        });
      }

      attempts++;
    }

    // Timeout
    console.warn('⚠️ Transcription timeout');
    return res.json({
      success: false,
      error: 'Transcription timeout - try again'
    });

  } catch (error) {
    console.error('Transcription error:', error.message);

    // Return a simpler fallback if AssemblyAI fails
    if (error.response?.status === 401) {
      return res.json({
        success: false,
        error: 'AssemblyAI API key not configured'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Format transcript with speaker labels
function formatTranscript(transcript) {
  if (!transcript.utterances || transcript.utterances.length === 0) {
    return [{
      speaker: 'Full Recording',
      text: transcript.text || '',
      start: 0,
      end: transcript.audio_duration || 0
    }];
  }

  return transcript.utterances.map(utterance => ({
    speaker: `Speaker ${utterance.speaker}`,
    text: utterance.text,
    start: utterance.start / 1000, // Convert to seconds
    end: utterance.end / 1000,
    confidence: utterance.confidence
  }));
}

// Extract insights from transcript
function extractInsights(transcript) {
  const insights = [];

  // Sentiment analysis
  if (transcript.sentiment_analysis_results) {
    const sentiments = transcript.sentiment_analysis_results;
    const avgSentiment = sentiments.reduce((acc, s) => {
      if (s.sentiment === 'POSITIVE') return acc + 1;
      if (s.sentiment === 'NEGATIVE') return acc - 1;
      return acc;
    }, 0) / sentiments.length;

    if (avgSentiment > 0.3) {
      insights.push('😊 Positive conversation tone');
    } else if (avgSentiment < -0.3) {
      insights.push('😟 Negative tone - may need follow-up');
    }
  }

  // Check for key mortgage topics
  const text = (transcript.text || '').toLowerCase();
  if (text.includes('rate') || text.includes('interest')) {
    insights.push('💰 Interest rates discussed');
  }
  if (text.includes('refinance') || text.includes('refi')) {
    insights.push('🏠 Refinancing inquiry');
  }
  if (text.includes('purchase') || text.includes('buy')) {
    insights.push('🏡 Home purchase inquiry');
  }
  if (text.includes('schedule') || text.includes('appointment')) {
    insights.push('📅 Follow-up appointment discussed');
  }
  if (text.includes('document') || text.includes('paperwork')) {
    insights.push('📄 Documentation mentioned');
  }

  return insights;
}