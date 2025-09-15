module.exports = async (req, res) => {
  // This endpoint is an alias for the dashboard endpoint
  // Redirect to the dashboard API
  const dashboard = require('./dashboard');
  return dashboard(req, res);
};