module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // For now, return empty transcripts since we don't have a database
  // This will force fresh transcriptions from AssemblyAI
  return res.json({
    success: true,
    transcripts: {},
    count: 0,
    totalCost: 0
  });
};