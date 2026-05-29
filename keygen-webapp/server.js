const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = "admin";

const keysPath = path.join(__dirname, 'keys.json');
const licensesPath = path.join(__dirname, 'licenses.json');

const LICENSE_SECRET = 'FeesFoundry_Offline_Secret_2026';

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "demo-token-123" });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

app.post('/api/generate-key', (req, res) => {
  const { token, machineId, clientName } = req.body;
  if (token !== "demo-token-123") return res.status(401).json({ error: "Unauthorized" });
  if (!machineId) return res.status(400).json({ error: "Machine ID is required" });
  if (!clientName) return res.status(400).json({ error: "Client Name is required" });

  try {
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
    hmac.update(machineId);
    const rawKey = hmac.digest('hex').substring(0, 16).toUpperCase();
    const parts = [];
    for (let i = 0; i < 16; i += 4) {
      parts.push(rawKey.substring(i, i + 4));
    }
    const licenseKey = parts.join('-');
    
    // Save to licenses.json
    let licenses = [];
    if (fs.existsSync(licensesPath)) {
      licenses = JSON.parse(fs.readFileSync(licensesPath, 'utf8'));
    }
    licenses.push({
      clientName,
      machineId,
      licenseKey,
      generatedAt: new Date().toISOString()
    });
    fs.writeFileSync(licensesPath, JSON.stringify(licenses, null, 2));

    res.json({ licenseKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate key" });
  }
});

app.get('/api/licenses', (req, res) => {
  const token = req.headers.authorization;
  if (token !== "demo-token-123") return res.status(401).json({ error: "Unauthorized" });
  
  let licenses = [];
  if (fs.existsSync(licensesPath)) {
    licenses = JSON.parse(fs.readFileSync(licensesPath, 'utf8'));
  }
  res.json({ licenses });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Keygen server running on http://localhost:${PORT}`);
});
