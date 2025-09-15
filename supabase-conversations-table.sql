-- Create conversations table for real-time SMS chat
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    message TEXT NOT NULL,
    sender VARCHAR(20) NOT NULL, -- 'customer' or 'tony'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Index for faster queries
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at)
);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous reads (for the widget)
CREATE POLICY "Allow anonymous read" ON conversations
    FOR SELECT
    USING (true);

-- Create policy to allow anonymous inserts (for the widget and webhooks)
CREATE POLICY "Allow anonymous insert" ON conversations
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE conversations IS 'Stores real-time SMS conversations between customers and loan officers';