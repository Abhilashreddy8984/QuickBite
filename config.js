/**
 * QuickBite — Frontend Configuration
 * 
 * Deployment Instructions for Render:
 * ----------------------------------------------------
 * Option 1 (Single Web Service on Render):
 *   Leave API_BASE_URL as null or "".
 *   QuickBite will automatically use the current domain (e.g. "/api").
 * 
 * Option 2 (Separate Render Services - Static Site + Web Service):
 *   Set API_BASE_URL to your deployed backend Render URL, for example:
 *   API_BASE_URL: "https://your-quickbite-api.onrender.com/api"
 * 
 * Option 3 (Local Development):
 *   Leave as null or "" -> automatically connects to "http://localhost:5000/api".
 */

window.QUICKBITE_CONFIG = {
  // Set your deployed Render backend URL here if deploying as separate frontend and backend services:
  API_BASE_URL: null
};
