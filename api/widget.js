// Serve the loan officer widget as an embedded iframe
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Frame-Options', 'ALLOWALL'); // Allow iframe embedding

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get loan officer ID from query params (default to david)
  const loanOfficerId = req.query.id || 'david';

  // Serve the widget HTML with dynamic API URL
  const widgetHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Your Loan Officer - LendWise Mortgage</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .contact-widget {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 100%;
            overflow: hidden;
            position: relative;
        }

        .widget-header {
            background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .officer-photo {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 4px solid white;
            margin: 0 auto 15px;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: #2e7d32;
        }

        .officer-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .officer-title {
            font-size: 14px;
            opacity: 0.9;
        }

        .officer-location {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.2);
            padding: 5px 12px;
            border-radius: 20px;
            margin-top: 10px;
            font-size: 12px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4caf50;
            animation: pulse 2s infinite;
        }

        .status-dot.offline {
            background: #f44336;
            animation: none;
        }

        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
            }
        }

        .contact-form {
            padding: 30px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-size: 14px;
            font-weight: 500;
        }

        input, textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: #2e7d32;
        }

        textarea {
            resize: vertical;
            min-height: 100px;
        }

        .contact-options {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-call {
            background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
            color: white;
        }

        .btn-call:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(46, 125, 50, 0.3);
        }

        .btn-text {
            background: #f5f5f5;
            color: #333;
        }

        .btn-text:hover {
            background: #e0e0e0;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .success-message, .error-message {
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-size: 14px;
        }

        .success-message {
            background: #e8f5e9;
            color: #2e7d32;
        }

        .error-message {
            background: #ffebee;
            color: #c62828;
        }

        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
    </style>
</head>
<body>
    <div class="contact-widget">
        <div class="widget-header">
            <div class="officer-photo" id="officerPhoto">👤</div>
            <div class="officer-name" id="officerName">Loading...</div>
            <div class="officer-title" id="officerTitle">Loan Officer</div>
            <div class="officer-location" id="officerLocation">LendWise Mortgage</div>
            <div class="status-indicator">
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Checking availability...</span>
            </div>
        </div>

        <div class="contact-form">
            <div class="form-group">
                <label for="customerName">Your Name *</label>
                <input type="text" id="customerName" placeholder="John Smith" required>
            </div>

            <div class="form-group">
                <label for="customerPhone">Phone Number *</label>
                <input type="tel" id="customerPhone" placeholder="(555) 123-4567" required>
            </div>

            <div class="form-group">
                <label for="customerEmail">Email Address</label>
                <input type="email" id="customerEmail" placeholder="john@example.com">
            </div>

            <div class="form-group">
                <label for="message">Message (for text)</label>
                <textarea id="message" placeholder="Hello, I'm interested in learning about mortgage options..."></textarea>
            </div>

            <div class="contact-options">
                <button class="btn btn-call" id="callBtn" onclick="initiateCall()">
                    📞 Call Now
                </button>
                <button class="btn btn-text" id="textBtn" onclick="sendText()">
                    💬 Send Text
                </button>
            </div>

            <div id="statusMessage"></div>
        </div>
    </div>

    <script>
        // Use relative API URL that works on Vercel
        const API_BASE_URL = '/api';
        const LOAN_OFFICER_ID = '${loanOfficerId}';

        // Loan officer data
        const loanOfficers = {
            'david': {
                name: 'David Young',
                title: 'Senior Loan Officer',
                location: 'Northridge, CA',
                phoneNumber: '+18184771989',
                businessHours: { start: '09:00', end: '18:00' },
                available: true
            },
            'tony': {
                name: 'Tony Nasim',
                title: 'Loan Officer',
                location: 'Canoga Park, CA',
                phoneNumber: '+18189182433',
                businessHours: { start: '09:00', end: '18:00' },
                available: true
            }
        };

        // Initialize widget
        async function initWidget() {
            const officer = loanOfficers[LOAN_OFFICER_ID];
            if (officer) {
                document.getElementById('officerName').textContent = officer.name;
                document.getElementById('officerTitle').textContent = officer.title;
                document.getElementById('officerLocation').textContent = officer.location;
                document.getElementById('officerPhoto').textContent = officer.name.split(' ').map(n => n[0]).join('');
            }

            await checkAvailability();
        }

        // Format phone number
        function formatPhoneNumber(phone) {
            const cleaned = phone.replace(/\\D/g, '');
            if (cleaned.length === 10) {
                return '+1' + cleaned;
            } else if (cleaned.length === 11 && cleaned[0] === '1') {
                return '+' + cleaned;
            }
            return phone;
        }

        // Initiate call
        async function initiateCall() {
            const customerName = document.getElementById('customerName').value.trim();
            const customerPhone = formatPhoneNumber(document.getElementById('customerPhone').value.trim());
            const customerEmail = document.getElementById('customerEmail').value.trim();

            if (!customerName || !customerPhone) {
                showMessage('Please enter your name and phone number', 'error');
                return;
            }

            const callBtn = document.getElementById('callBtn');
            callBtn.disabled = true;
            callBtn.innerHTML = '<span class="loading"></span> Connecting...';

            try {
                const response = await fetch(\`\${API_BASE_URL}/twilio-call\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        loanOfficerId: LOAN_OFFICER_ID,
                        customerName,
                        customerPhone,
                        customerEmail
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showMessage('Call initiated! Your phone will ring shortly.', 'success');
                    setTimeout(() => {
                        document.getElementById('statusMessage').innerHTML = '';
                    }, 5000);
                } else {
                    showMessage(result.error || 'Failed to initiate call', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Failed to connect. Please try again.', 'error');
            } finally {
                callBtn.disabled = false;
                callBtn.innerHTML = '📞 Call Now';
            }
        }

        // Send text message
        async function sendText() {
            const customerName = document.getElementById('customerName').value.trim();
            const customerPhone = formatPhoneNumber(document.getElementById('customerPhone').value.trim());
            const message = document.getElementById('message').value.trim();

            if (!customerName || !customerPhone || !message) {
                showMessage('Please fill in all fields for text message', 'error');
                return;
            }

            const textBtn = document.getElementById('textBtn');
            textBtn.disabled = true;
            textBtn.innerHTML = '<span class="loading"></span> Sending...';

            try {
                const response = await fetch(\`\${API_BASE_URL}/twilio-sms\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        loanOfficerId: LOAN_OFFICER_ID,
                        customerName,
                        customerPhone,
                        message
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showMessage('Message sent successfully!', 'success');
                    document.getElementById('message').value = '';
                    setTimeout(() => {
                        document.getElementById('statusMessage').innerHTML = '';
                    }, 5000);
                } else {
                    showMessage(result.error || 'Failed to send message', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Failed to send message. Please try again.', 'error');
            } finally {
                textBtn.disabled = false;
                textBtn.innerHTML = '💬 Send Text';
            }
        }

        // Check loan officer availability
        async function checkAvailability() {
            try {
                const response = await fetch(\`\${API_BASE_URL}/twilio-status?loanOfficerId=\${LOAN_OFFICER_ID}\`);
                const data = await response.json();

                const statusDot = document.getElementById('statusDot');
                const statusText = document.getElementById('statusText');

                if (data.available) {
                    statusDot.classList.remove('offline');
                    statusText.textContent = 'Available Now';
                } else {
                    statusDot.classList.add('offline');
                    statusText.textContent = \`Available \${data.businessHours.start} - \${data.businessHours.end}\`;
                }
            } catch (error) {
                console.error('Error checking availability:', error);
                document.getElementById('statusText').textContent = 'Status Unknown';
            }
        }

        // Show message
        function showMessage(message, type) {
            const statusMessage = document.getElementById('statusMessage');
            statusMessage.className = type === 'error' ? 'error-message' : 'success-message';
            statusMessage.textContent = message;
        }

        // Initialize on load
        initWidget();
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(widgetHTML);
};