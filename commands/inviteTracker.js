import { Collection, Events, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path for storing invite data
const INVITE_DATA_PATH = path.join(__dirname, "..", "invite-data.json");

// Cache to track invites across guilds
const guildInvitesCache = new Collection();

/**
 * Loads invite data from file
 * @returns {Object} The invite data
 */
function loadInviteData() {
  try {
    if (fs.existsSync(INVITE_DATA_PATH)) {
      const data = fs.readFileSync(INVITE_DATA_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading invite data:", err);
  }
  return {};
}

/**
 * Saves invite data to file
 * @param {Object} data The invite data to save
 */
function saveInviteData(data) {
  try {
    fs.writeFileSync(INVITE_DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving invite data:", err);
  }
}

/**
 * Converts date to IST timezone
 * @param {Date} date The date to convert
 * @returns {string} Formatted date string in IST
 */
function convertToIST(date) {
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  return date.toLocaleString("en-IN", options) + " IST";
}

/**
 * Initializes the invite tracking system
 * @param {Client} client The Discord client
 */ 