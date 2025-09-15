const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const { From, To, Body } = req.body;

  console.log('📱 Incoming SMS');
  console.log('From:', From);
  console.log('To:', To);
  console.log('Message:', Body);

  // Check if this is Tony replying
  const isTonyReply = From === '+18183919142' || From === '18183919142' || From === '8183919142';

  if (isTonyReply && supabase) {
    // Extract conversation ID from message if present
    // Tony's messages might include [conv_id] or just be plain replies
    let conversationId = null;
    let cleanMessage = Body;

    // Check for conversation ID in format [xxxxx]
    const convMatch = Body.match(/\[([^\]]+)\]/);
    if (convMatch) {
      conversationId = convMatch[1];
      // If it's just the last 6 chars, try to find full conversation ID
      if (conversationId.length === 6) {
        // Search for recent conversation with this suffix
        try {
          const { data } = await supabase
            .from('conversations')
            .select('conversation_id')
            .like('conversation_id', `%${conversationId}`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            conversationId = data[0].conversation_id;
          }
        } catch (err) {
          console.error('Error finding conversation:', err);
        }
      }
      // Remove the ID from the message
      cleanMessage = Body.replace(convMatch[0], '').trim();
    }

    // If we have a conversation ID, save Tony's reply
    if (conversationId) {
      try {
        await supabase
          .from('conversations')
          .insert({
            conversation_id: conversationId,
            message: cleanMessage,
            sender: 'tony',
            created_at: new Date().toISOString()
          });

        console.log(`✅ Saved Tony's reply to conversation ${conversationId}`);
      } catch (error) {
        console.error('Error saving Tony\'s reply:', error);
      }
    } else {
      // Try to match with recent conversation based on timing
      try {
        // Get the most recent conversation from last 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('conversations')
          .select('conversation_id')
          .gte('created_at', thirtyMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          conversationId = data[0].conversation_id;

          await supabase
            .from('conversations')
            .insert({
              conversation_id: conversationId,
              message: cleanMessage,
              sender: 'tony',
              created_at: new Date().toISOString()
            });

          console.log(`✅ Saved Tony's reply to recent conversation ${conversationId}`);
        }
      } catch (error) {
        console.error('Error saving Tony\'s reply:', error);
      }
    }
  }

  // Send TwiML response (empty to acknowledge receipt)
  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response></Response>
  `);
};