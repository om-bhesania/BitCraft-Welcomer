// BitCraft Welcomer Bot - ES Modules version with GIF background support
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionsBitField,
} from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";
import express from "express";

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;
// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bot configuration
const botConfig = {
  // Token must be set in .env file or environment variables
  token: process.env.BOT_TOKEN,
  // Channel ID where welcome messages will be sent
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
  // Role ID to assign to new members
  defaultRoleId: process.env.DEFAULT_ROLE_ID,
  // Command prefix for testing
  prefix: "!",
  // Background file path - can be either GIF or image
  // The function will automatically detect the file type
  backgroundPath:
    process.env.BACKGROUND_PATH || path.join(process.cwd(), "banner.gif"),
};

// Check if token is available
if (!botConfig.token) {
  console.error(
    "Bot token is missing! Make sure to set BOT_TOKEN in your environment variables."
  );
  process.exit(1);
}

// Create client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Humorous welcome lines
const welcomeLines = [
  "Hold onto your bits, a new crafter has entered the server!",
  "Another pixel artist joins the canvas of BitCraft!",
  "A wild new member appeared! BitCraft used Welcome... It's super effective!",
  "Breaking news: BitCraft Network just got more awesome!",
  "Looks like someone found the secret entrance to BitCraft!",
  "Alert! Alert! Cool person detected in the BitCraft Network!",
  "The BitCraft family just grew by one amazing human!",
  "Plot twist: BitCraft Network just gained an awesome new character!",
  "The BitCraft Council has approved your application. Welcome aboard!",
  "New member unlocked! Achievement: Joining the best community ever!",
];

// Function to check if file exists and get file info
function getBackgroundInfo() {
  if (!fs.existsSync(botConfig.backgroundPath)) {
    console.error(`Background file not found at: ${botConfig.backgroundPath}`);
    return { exists: false };
  }

  // Get file extension to determine type
  const ext = path.extname(botConfig.backgroundPath).toLowerCase();

  return {
    exists: true,
    path: botConfig.backgroundPath,
    isGif: ext === ".gif",
    type: ext === ".gif" ? "GIF" : "Image",
  };
}

// Function to create welcome card
async function createWelcomeImage(member, memberCount) {
  try {
    // Canvas setup
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // Get background info
    const bgInfo = getBackgroundInfo();

    // Try to load background image
    try {
      if (bgInfo.exists) {
        console.log(`Loading background ${bgInfo.type} from: ${bgInfo.path}`);
        const background = await loadImage(bgInfo.path);
        // Draw background image
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Add semi-transparent overlay for better text visibility
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Set default background color
        ctx.fillStyle = "#2C2F33";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add pattern for visual interest
        ctx.fillStyle = "#1f1f1f";
        for (let i = 0; i < 20; i++) {
          for (let j = 0; j < 20; j++) {
            if ((i + j) % 2 === 0) {
              ctx.fillRect(i * 40, j * 40, 40, 40);
            }
          }
        }
      }
    } catch (imgError) {
      console.error("Error loading background:", imgError);
      // Set default background color
      ctx.fillStyle = "#2C2F33";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add pattern for visual interest
      ctx.fillStyle = "#1f1f1f";
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillRect(i * 40, j * 40, 40, 40);
          }
        }
      }
    }

    // Save context state
    ctx.save();

    // Draw a circle for the avatar
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // Load and draw avatar
    const avatar = await loadImage(
      member.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.drawImage(avatar, 45, 45, 160, 160);

    // Reset the clipping
    ctx.restore();

    // Add text with INCREASED SIZE
    ctx.font = "bold 34px Arial"; // Increased from 28px
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(`Welcome to BitCraft Network`, 450, 100);

    ctx.font = "bold 28px Arial"; // Increased from 22px
    ctx.fillStyle = "#F9A825";
    ctx.fillText(`${member.user.tag}`, 450, 140);

    ctx.font = "24px Arial"; // Increased from 18px
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`You are the ${memberCount}th member!`, 450, 180);

    // Return the canvas as a buffer
    return canvas.toBuffer();
  } catch (error) {
    console.error("Error creating welcome image:", error);
    throw error;
  }
}

// Function to welcome a member
async function welcomeMember(member) {
  try {
    const welcomeChannel = member.guild.channels.cache.get(
      botConfig.welcomeChannelId
    );

    if (!welcomeChannel) {
      console.error(
        `Welcome channel with ID ${botConfig.welcomeChannelId} not found.`
      );
      return;
    }

    // Get random welcome line
    const welcomeLine =
      welcomeLines[Math.floor(Math.random() * welcomeLines.length)];

    // Get member count
    const memberCount = member.guild.memberCount;

    // Create welcome image
    const welcomeImage = await createWelcomeImage(member, memberCount);
    const attachment = new AttachmentBuilder(welcomeImage, {
      name: "welcome-image.png",
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle(`Welcome to BitCraft Network!`)
      .setDescription(
        `${welcomeLine}\n\nHey <@${member.id}>, you are the **${memberCount}th** member!`
      )
      .setImage("attachment://welcome-image.png");

    // Send welcome message with embed
    await welcomeChannel.send({
      embeds: [embed],
      files: [attachment],
    });

    // Assign role to new member - with error handling and permissions check
    try {
      const role = member.guild.roles.cache.get(botConfig.defaultRoleId);
      if (role) {
        // Check if bot has permission to manage roles
        const botMember = await member.guild.members.fetch(client.user.id);
        if (
          botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
          botMember.roles.highest.position > role.position
        ) {
          await member.roles.add(role);
          console.log(`Assigned role ${role.name} to ${member.user.tag}`);
        } else {
          console.log(
            `Bot doesn't have permissions to assign the role ${role.name}. Check bot role hierarchy.`
          );
        }
      } else {
        console.error(
          `Default role with ID ${botConfig.defaultRoleId} not found.`
        );
      }
    } catch (roleError) {
      console.error(`Failed to assign role to ${member.user.tag}:`, roleError);
    }
  } catch (error) {
    console.error("Error in welcomeMember function:", error);
  }
}

// Event handler for when bot is ready
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Check background file on startup
  const bgInfo = getBackgroundInfo();
  if (bgInfo.exists) {
    console.log(`Background ${bgInfo.type} found at: ${bgInfo.path}`);
    if (bgInfo.isGif) {
      console.log(
        "Note: When using a GIF as background, only the first frame will be visible in the welcome image."
      );
    }
  } else {
    console.warn("Background file not found, will use default pattern.");
  }

  console.log("BitCraft Welcomer is online and ready to greet new members!");

  // Set bot status
  client.user.setPresence({
    activities: [{ name: "for new members", type: 3 }], // 3 is "WATCHING"
    status: "online",
  });
});

// Event handler for new guild members
client.on("guildMemberAdd", async (member) => {
  await welcomeMember(member);
});

// Command handler for messages
client.on("messageCreate", async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if message starts with the prefix
  if (!message.content.startsWith(botConfig.prefix)) return;

  // Get the command and arguments
  const args = message.content
    .slice(botConfig.prefix.length)
    .trim()
    .split(/ +/);
  const command = args.shift().toLowerCase();

  // Admin check helper function
  const isAdmin = (member) => {
    return (
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    );
  };

  // Test command to simulate a member joining
  if (command === "test") {
    // Check if user has permission to use this command
    if (!isAdmin(message.member)) {
      return message.reply(
        "You need administrator or manage server permissions to use this command!"
      );
    }

    // Send typing indicator
    message.channel.sendTyping();

    // Send quick acknowledgment
    const ack = await message.reply("🚀 Testing welcome message...");

    // Use the message author as the test member
    await welcomeMember(message.member);

    console.log(`Test welcome triggered by ${message.author.tag}`);
  }

  // Set background command
  if (command === "setbackground") {
    // Check if user has permission
    if (!isAdmin(message.member)) {
      return message.reply(
        "You need administrator or manage server permissions to use this command!"
      );
    }

    // Check if a file was attached
    if (message.attachments.size === 0) {
      return message.reply(
        "Please attach a GIF or image file to use as the background."
      );
    }

    const attachment = message.attachments.first();
    const fileExt = path.extname(attachment.name).toLowerCase();

    // Check if it's a valid image type
    if (![".gif", ".png", ".jpg", ".jpeg"].includes(fileExt)) {
      return message.reply("Please attach a valid image file (GIF, PNG, JPG).");
    }

    try {
      // Download the file
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Save the file
      const savePath = path.join(process.cwd(), `banner${fileExt}`);
      fs.writeFileSync(savePath, buffer);

      // Update config
      botConfig.backgroundPath = savePath;

      await message.reply(
        `✅ Background ${
          fileExt === ".gif" ? "GIF" : "image"
        } updated! Remember that when using a GIF, only the first frame will be visible in welcome cards.`
      );

      console.log(`Background updated to ${savePath} by ${message.author.tag}`);
    } catch (error) {
      console.error("Error saving background:", error);
      await message.reply("❌ There was an error saving the background file.");
    }
  }

  // Help command
  if (command === "welcomehelp") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("BitCraft Welcomer Help")
      .setDescription("Commands available for the BitCraft welcomer bot:")
      .addFields(
        {
          name: "!test",
          value: "Triggers a test welcome message for yourself",
        },
        {
          name: "!setbackground",
          value:
            "Sets a new background image or GIF (attach the file to your message)",
        },
        {
          name: "!welcomehelp",
          value: "Shows this help message",
        }
      );

    await message.reply({ embeds: [helpEmbed] });
  }
});

// Error handling
client.on("error", console.error);
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Login to Discord with the token
console.log("Attempting to log in to Discord...");
try {
  await client.login(botConfig.token);
} catch (error) {
  console.error("Failed to login:", error);
  console.error("Please check your bot token and try again.");
  process.exit(1);
}


app.get("/", (req, res) => res.send("Bot is running!"));

app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
});
