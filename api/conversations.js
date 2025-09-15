const { supabase } = require('../lib/supabase');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversationId, lastMessageId } = req.query;

  if (!conversationId) {
    return res.status(400).json({ error: 'Conversation ID required' });
  }

  try {
    if (!supabase) {
      return res.json({ messages: [] });
    }

    // Build query
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // If we have a lastMessageId, only get newer messages
    if (lastMessageId) {
      // Get the timestamp of the last message
      const { data: lastMsg } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('id', lastMessageId)
        .single();

      if (lastMsg) {
        query = query.gt('created_at', lastMsg.created_at);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Format messages for the widget
    const messages = (data || []).map(msg => ({
      id: msg.id,
      text: msg.message,
      sender: msg.sender,
      timestamp: msg.created_at
    }));

    res.json({ messages });

  } catch (error) {
    console.error('Error in conversations endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};