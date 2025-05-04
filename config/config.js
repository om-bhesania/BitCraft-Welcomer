// Bot configuration
import { config } from "dotenv";
import path from "path";

// Load environment variables
config();
export const botConfig = {
  // Token must be set in .env file or environment variables
  token: process.env.BOT_TOKEN,
  // Channel ID where welcome messages will be sent
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
  // Role IDs to assign to new members
  defaultRoleIds:
    [process.env.DEFAULT_ROLE_ID, process.env.DEFAULT_ROLE_ID_2] || [],
  // Command prefixes for the bot - can be extended easily
  prefixes: ["?", "!", "."],
  // Background file path - can be either GIF or image
  // The function will automatically detect the file type
  backgroundPath:
    process.env.BACKGROUND_PATH || path.join(process.cwd(), "banner.gif"),
};
