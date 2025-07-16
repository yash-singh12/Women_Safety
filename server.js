require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3001; // Use port 3001 for the backend

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(bodyParser.json());

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
    res.json({ priority });
  } catch (error) {
    console.error("Failed to generate priority:", error);
    res.status(500).json({ error: "Failed to generate priority." });
  }
});

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('Gemini Proxy Server is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Gemini Proxy Server listening at http://localhost:${port}`);
}); 