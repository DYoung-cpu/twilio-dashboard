// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Loan officers configuration
const loanOfficers = {
  'david': {
    id: 'david',
    name: 'David Young',
    phoneNumber: '+19544703737',
    twilioNumber: '+18184771989',
    businessHours: { start: '09:00', end: '18:00' },
    available: true,
    location: 'Northridge, CA'
  },
  'tony': {
    id: 'tony',
    name: 'Tony Nasim',
    phoneNumber: '+18182009933',
    twilioNumber: '+18189182433',
    businessHours: { start: '09:00', end: '18:00' },
    available: true,
    location: 'Canoga Park, CA'
  }
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

  // Get loan officer ID from query params
  const loanOfficerId = req.query.loanOfficerId || 'david';
  const loanOfficer = loanOfficers[loanOfficerId];

  if (!loanOfficer) {
    return res.status(404).json({ error: 'Loan officer not found' });
  }

  const now = new Date();
  const currentHour = now.getHours();
  const businessStart = parseInt(loanOfficer.businessHours.start.split(':')[0]);
  const businessEnd = parseInt(loanOfficer.businessHours.end.split(':')[0]);

  const isBusinessHours = currentHour >= businessStart && currentHour < businessEnd;

  res.json({
    id: loanOfficer.id,
    name: loanOfficer.name,
    location: loanOfficer.location,
    available: loanOfficer.available && isBusinessHours,
    businessHours: loanOfficer.businessHours
  });
};