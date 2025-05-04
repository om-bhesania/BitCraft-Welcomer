// ffmpeg-fix.js - ES Modules compatible version - IMPROVED
// Run this before starting your bot
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegStatic from "ffmpeg-static";
import { promisify } from "util";
import { exec as execCallback } from "child_process";

// ES Modules compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exec = promisify(execCallback);

console.log("Running FFmpeg configuration setup...");

// Get the path to ffmpeg-static
try {
  console.log(`Found ffmpeg-static at: ${ffmpegStatic}`);

  // Test if the path is accessible and valid
  try {
    // Proper quoting for Windows paths
    const { stdout } = await exec(`"${ffmpegStatic}" -version`);
    console.log(`FFmpeg test successful: ${stdout.split("\n")[0]}`);
  } catch (testError) {
    console.warn(`⚠️ Warning: FFmpeg test failed: ${testError.message}`);
    console.log(
      "The path may still work when used by the Discord voice connection."
    );
  }

  // Create a simple configuration file with the correct path
  // FIXED: Don't double-escape backslashes - this causes issues on Windows
  const configContent = {
    ffmpegPath: ffmpegStatic, // Store the path directly, don't escape backslashes
  };

  // Write to a config file
  const configPath = path.join(__dirname, "ffmpeg-config.json");
  fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

  console.log(`✅ FFmpeg configuration saved to ${configPath}`);
  console.log("Now restart your bot to use this configuration.");
} catch (error) {
  console.error("❌ Error configuring FFmpeg path:", error);
  console.log("Please make sure ffmpeg-static is installed correctly.");
  console.log("Try running: npm install ffmpeg-static --save");
}
