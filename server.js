require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001; // Use port 3001 for the backend

// Supabase client setup
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Endpoint to get facility details by id from Supabase
app.get('/facility/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('facilities')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (error || !data) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch facility' });
    }
});

// File path for reports data
const REPORTS_FILE = path.join(__dirname, 'reports.json');

// In-memory storage for reports (for demonstration)
let reports = [];

// Function to load reports from file
const loadReports = () => {
    if (fs.existsSync(REPORTS_FILE)) {
        const data = fs.readFileSync(REPORTS_FILE, 'utf8');
        reports = JSON.parse(data);
    } else {
        reports = [];
    }
};

// Function to save reports to file
const saveReports = () => {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
};

// Load reports on server start
loadReports();

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(bodyParser.json());

// Middleware to protect admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (token === 'fake-admin-token') { // Replace with actual token validation (e.g., JWT.verify)
    next();
  } else {
    return res.status(403).json({ message: 'Forbidden: Invalid token' });
  }
};

// Admin Login Endpoint
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  // Simple authentication (for demonstration purposes)
  if (username === 'admin' && password === 'password123') {
    // In a real application, you would generate a JWT or a session token here
    const token = 'fake-admin-token';
    return res.json({ message: 'Login successful', token });
  } else {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Configure Gemini API
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY is not set in the .env file. Please set it.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Define a map for issue types to be used in prompts if needed, or rely on frontend labels
const issueTypeMapping = {
  dirty_restroom: "Dirty restroom",
  overflowing_bin: "Overflowing bin",
  no_dispenser: "No dispenser",
  no_water: "No water",
  safety_concern: "Safety concern",
  other: "Other",
};

/**
 * Helper function to generate priority using Gemini API
 * @param {string} issueType
 * @param {string} location
 * @param {string} description
 * @returns {Promise<string>}
 */
async function generatePriority(issueType, location, description) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Given an issue report with the following details:
Issue Type: ${issueTypeMapping[issueType] || issueType}
Location: ${location}
Description: ${description || 'N/A'}

Please categorize the priority of this issue as either 'Green', 'RED', or 'Blue'. Only output one of these three words.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().toUpperCase();

    // Check if the response contains any of the expected priorities
    if (text.includes("RED")) {
      return "RED";
    } else if (text.includes("GREEN")) {
      return "GREEN";
    } else if (text.includes("BLUE")) {
      return "BLUE";
    } else {
      console.warn(`Gemini returned an unexpected priority: ${text}. Defaulting to BLUE.`);
      return "BLUE"; // Default to a low priority if unexpected output
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "BLUE"; // Default to a low priority on error
  }
}

// API endpoint for generating priority
app.post('/generate-priority', async (req, res) => {
  const { issueType, location, description } = req.body;

  if (!issueType || !location) {
    return res.status(400).json({ error: "Issue type and location are required." });
  }

  try {
    const priority = await generatePriority(issueType, location, description);
    const newReport = {
        id: crypto.randomUUID(), // Node.js crypto module for UUID
        timestamp: new Date().toISOString(),
        issueType,
        location,
        description,
        priority
    };
    reports.unshift(newReport); // Add to the beginning
    saveReports(); // Save reports after adding new one
    res.json({ priority });
  } catch (error) {
    console.error("Failed to generate priority:", error);
    res.status(500).json({ error: "Failed to generate priority." });
  }
});

// Admin Reports Endpoint
app.get('/admin/reports', authenticateAdmin, (req, res) => {
    res.json(reports);
});

// Public Reports Endpoint
app.get('/public/reports', (req, res) => {
    res.json(reports.map(report => ({
        id: report.id,
        issueType: report.issueType,
        location: report.location,
        priority: report.priority,
        timestamp: report.timestamp
    })));
});

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('Gemini Proxy Server is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Gemini Proxy Server listening at http://localhost:${port}`);
}); 
