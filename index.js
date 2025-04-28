// BitCraft Official Bot - ES Modules version with enhanced command system
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
    ctx.fillText(`${member.user.displayName}`, 450, 140);

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
    const message = await welcomeChannel.send(
      `Welcome to the server, <@${member.id}>! `
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle(`Welcome to BitCraft Network!`)
      .setDescription(
        `${welcomeLine}\n\nHey <@${member.id}>, you are the **${memberCount}th** member!`
      )
      .setImage("attachment://welcome-image.png");

    // Send welcome message with embed
    const sentMessage = await welcomeChannel.send({
      embeds: [embed],
      files: [attachment],
    });

    // Assign role to new member - with error handling and permissions check
    try {
      const roles = member.guild.roles.cache.filter((role) =>
        botConfig.defaultRoleIds.includes(role.id)
      );
      if (roles.size > 0) {
        // Check if bot has permission to manage roles
        const botMember = await member.guild.members.fetch(client.user.id);
        if (
          botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
          botMember.roles.highest.position >
            roles.reduce((max, role) => Math.max(max, role.position), 0)
        ) {
          await member.roles.add(roles);
          console.log(
            `Assigned roles ${roles.map((role) => role.name).join(", ")} to ${
              member.user.tag
            }`
          );
        } else {
          console.log(
            `Bot doesn't have permissions to assign the roles ${roles
              .map((role) => role.name)
              .join(", ")}. Check bot role hierarchy.`
          );
        }
      } else {
        console.error(
          `Default role(s) with ID(s) ${botConfig.defaultRoleIds.join(
            ","
          )} not found.`
        );
      }
    } catch (roleError) {
      console.error(`Failed to assign role to ${member.user.tag}:`, roleError);
    }
  } catch (error) {
    console.error("Error in welcomeMember function:", error);
  }
}

// Admin check helper function
const isAdmin = (member) => {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
};
let reminderIntervals = [];
let reminderTimeouts = [];
// Command handler system - centralized for easier additions
const commands = {
  // Test command to simulate a member joining
  test: {
    aliases: ["t", "tw"],
    adminOnly: true,
    execute: async (message, args) => {
      // Send typing indicator
      message.channel.sendTyping();

      // Delete the trigger message itself
      await message.delete().catch(console.error);

      // Store the current time before generating welcome messages
      const beforeTime = Date.now();

      // Use the message author as the test member
      await welcomeMember(message.member);

      // Set a short timeout to ensure messages are processed
      setTimeout(async () => {
        try {
          // Get the most recent messages in the channel
          const messages = await message.channel.messages.fetch({ limit: 5 });

          // Filter for only messages sent by the bot after the command was triggered
          const messagesToDelete = messages.filter(
            (msg) =>
              msg.author.id === client.user.id &&
              msg.content.startsWith("Welcome to BitCraft Network,") &&
              msg.createdTimestamp > beforeTime
          );

          if (messagesToDelete.size > 0) {
            // Delete these specific messages
            await message.channel
              .bulkDelete(messagesToDelete)
              .catch(console.error);
          }
        } catch (error) {
          console.error("Error cleaning up test welcome messages:", error);
        }
      }, 10000);

      console.log(
        `Test welcome triggered and cleaned up by ${message.author.tag}`
      );
    },
  },

  // Set background command
  bg: {
    aliases: ["setbackground", "background"],
    adminOnly: true,
    execute: async (message, args) => {
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
        return message.reply(
          "Please attach a valid image file (GIF, PNG, JPG)."
        );
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

        console.log(
          `Background updated to ${savePath} by ${message.author.tag}`
        );
      } catch (error) {
        console.error("Error saving background:", error);
        await message.reply(
          "❌ There was an error saving the background file."
        );
      }
    },
  },

  // Help command
  help: {
    aliases: ["commands", "info"],
    adminOnly: false,
    execute: async (message, args) => {
      const helpEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("BitCraft Official Bot Help")
        .setDescription("Available commands for the BitCraft official bot:")
        .addFields(
          {
            name: "🔧 Admin Commands",
            value:
              "**?test** - Triggers a test welcome message\n" +
              "**?bg** - Sets a new background image or GIF (attach file)\n" +
              "**?remind** - Sets a reminder (usage: `?remind <time>(s/m/h/d) <once/repeat> <mention> <message>`)",
          },
          {
            name: "📋 User Commands",
            value:
              "**?help** - Shows this help message\n" +
              "**?ip** - Get the server IP address\n" +
              "**?rules** - Shows server rules",
          },
          {
            name: "📝 Note",
            value: `All commands work with any of these prefixes: ${botConfig.prefixes.join(
              ", "
            )}`,
          }
        )
        .setFooter({
          text: "BitCraft Network Official Bot",
        });

      await message.reply({ embeds: [helpEmbed] });
    },
  },

  // Reminder Command
 // Track active reminders - Add this at the top level of your file (outside any functions)


// Then update your commands:
remind: {
  aliases: ["reminder", "remindme"],
  adminOnly: true,
  execute: async (message, args) => {
    if (args.length < 4) {
      return message.reply(
        "Usage: `?remind <time> <once/repeat> <mention> <your message> [embed] [embed message]`"
      );
    }

    const timeArg = args[0].toLowerCase();
    const mode = args[1].toLowerCase();
    const mention = args[2];

    let messagePart = args.slice(3);

    let embedMode = false;
    let reminderMessage = "";
    let embedMessage = "";

    // Check if "embed" keyword is used
    const embedIndex = messagePart.findIndex(
      (arg) => arg.toLowerCase() === "embed"
    );
    if (embedIndex !== -1) {
      embedMode = true;
      reminderMessage = messagePart.slice(0, embedIndex).join(" ");
      embedMessage = messagePart.slice(embedIndex + 1).join(" ");
    } else {
      reminderMessage = messagePart.join(" ");
    }

    let timeInSeconds = 0;
    const timeRegex = /^(\d+)([mshd])$/;
    const match = timeRegex.exec(timeArg);

    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];

      switch (unit) {
        case "m":
          timeInSeconds = value * 60;
          break;
        case "s":
          timeInSeconds = value;
          break;
        case "h":
          timeInSeconds = value * 60 * 60;
          break;
        case "d":
          timeInSeconds = value * 60 * 60 * 24;
          break;
        default:
          return message.reply("Invalid time unit. Please use m/s/h/d.");
      }
    } else {
      return message.reply(
        "Invalid time format. Use `<value><unit>` like `10m` or `5h`."
      );
    }

    if (isNaN(timeInSeconds) || timeInSeconds <= 0) {
      return message.reply("Please provide a valid positive time.");
    }

    if (!["once", "repeat"].includes(mode)) {
      return message.reply("Mode must be either `once` or `repeat`.");
    }

    await message.reply(
      `✅ Reminder set! I will ${
        mode === "once" ? "send once" : "send repeatedly"
      } after **${timeArg}**.`
    );

    const sendReminder = async () => {
      try {
        if (embedMode) {
          const embed = new EmbedBuilder()
            .setColor("#F9A825")
            .setTitle("⏰ Reminder")
            .setDescription(embedMessage || "No embed message provided.");

          await message.channel.send({
            content: `Hey ${mention} ${reminderMessage}`,
            embeds: [embed],
          });
        } else {
          await message.channel.send(`Hey ${mention} ${reminderMessage}`);
        }
      } catch (err) {
        console.error("Failed to send reminder:", err);
      }
    };

    if (mode === "once") {
      const timeout = setTimeout(sendReminder, timeInSeconds * 1000);
      reminderTimeouts.push(timeout);
    } else if (mode === "repeat") {
      const interval = setInterval(sendReminder, timeInSeconds * 1000);
      reminderIntervals.push(interval);
    }
  },
},

// Stop reminders command
stop: {
  aliases: ["stopreminder", "stoprm"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if there are active reminders
    if ((reminderIntervals.length === 0) && (reminderTimeouts.length === 0)) {
      return message.reply("⚠️ There are no active reminders to stop.");
    }
    
    // Clear all active intervals
    reminderIntervals.forEach(interval => clearInterval(interval));
    reminderTimeouts.forEach(timeout => clearTimeout(timeout));
    
    // Reset the arrays
    reminderIntervals = [];
    reminderTimeouts = [];
    
    await message.reply("✅ All reminders have been stopped!");
    console.log(`Reminders stopped by ${message.author.tag}`);
  },
},
  // IP command
  ip: {
    aliases: ["server", "connect"],
    adminOnly: false,
    execute: async (message, args) => {
      const ipEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("🎮 BitCraft Server Connection Info")
        .setDescription(
          "Connect to our Minecraft server using the following details:"
        )
        .addFields(
          {
            name: "🌐 Server Address (JAVA)",
            value: "```play.bitcraftnetwork.fun```",
            inline: true,
          },
          {
            name: "🛠️ Port (BEDROCK)",
            value: "```25571```",
          },
          {
            name: "🌐 Server Address (BEDROCK)",
            value: "```play.bitcraftnetwork.fun:25582```",
          }
        )
        .setFooter({
          text: "Simply copy the server address and paste it in your Minecraft client!",
        });

      await message.reply({ embeds: [ipEmbed] });
    },
  },

  // Rules command (new example command)
  rules: {
    aliases: ["rule", "guidelines"],
    adminOnly: false,
    execute: async (message, args) => {
      // General Rules Embed
      const generalRulesEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("🔧・General Rules")
        .setDescription(
          "Please follow these rules to ensure a positive experience for everyone:"
        )
        .addFields(
          {
            name: "🔹 Be Respectful – No hate speech, harassment, discrimination, or toxic behavior.",
            value: "This is a no-brainer. Be kind to each other.",
          },
          {
            name: "🔹 No Spam or Flooding – Avoid repeated messages, excessive caps, or meaningless content.",
            value: "Keep the chat clean and avoid annoying people.",
          },
          {
            name: "🔹 Follow Discord & Minecraft TOS – Violating these may lead to punishment.",
            value: "This includes Minecraft's EULA and Discord's TOS.",
          },
          {
            name: "🔹 Keep It SFW – No NSFW, offensive memes, or inappropriate usernames.",
            value: "Keep the server family-friendly.",
          },
          {
            name: "🔹 Use the Correct Channels – Post appropriately (e.g., don't drop memes in ⁠🚨・support).",
            value: "Use the correct channels to avoid spamming.",
          }
        );

      // Chat Rules Embed
      const chatRulesEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("💬・Chat Rules")
        .setDescription(
          "Follow these rules to keep the chat clean and enjoyable:"
        )
        .addFields(
          {
            name: "💬 Stay On Topic – Keep convos relevant to the channel.",
            value: "Keep the chat clean and avoid derailing conversations.",
          },
          {
            name: "🚫 No Advertising or Server Promotion – This includes in chat, DMs, or Minecraft.",
            value: "No self-promotion allowed.",
          },
          {
            name: "⏱️ Report in Time – All issues must be reported within 2 days of occurrence.",
            value: "Report any issues in time.",
          },
          {
            name: "🎖️ Respect Staff – Staff are here to help! Contact them respectfully via ⁠😤・complains.",
            value:
              "Be respectful to staff and contact them via the correct channels.",
          },
          {
            name: "🧠 No Heated Topics – Avoid politics, religion, or controversial subjects unless staff allows.",
            value: "Avoid heated topics unless staff explicitly allows it.",
          },
          {
            name: "🗣️ English or Hinglish Only – So everyone can understand.",
            value: "Speak in English or Hinglish to avoid confusion.",
          },
          {
            name: "🔔 Avoid Random Pings – Tag only when necessary.",
            value: "Only tag when necessary to avoid spamming.",
          },
          {
            name: "🧾 File Complaints Privately – Use ⁠unknown to open a ticket.",
            value: "File complaints privately.",
          },
          {
            name: "😄 Playful Banter is Cool – Double meanings are fine, just don't cross the line.",
            value: "Playful banter is cool, but don't cross the line.",
          },
          {
            name: "🤬 Swearing is Okay – But don't go overboard or direct it at anyone.",
            value: "Swearing is okay, but don't go overboard.",
          }
        );

      // Media Sharing Rules Embed
      const mediaRulesEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("📷・Media Sharing Rules")
        .setDescription("Follow these rules when sharing media:")
        .addFields(
          {
            name: "📸 Post Relevant Content Only – No off-topic images or random spam.",
            value: "Post relevant content only.",
          },
          {
            name: "🧾 Respect Copyright – Share only content you own or have rights to.",
            value: "Respect copyright laws.",
          },
          {
            name: "🚫 No NSFW or Shock Media – Keep everything safe and friendly.",
            value: "Keep the server family-friendly.",
          },
          {
            name: "🎨 Credit Creators – Always credit when sharing artwork, edits, or videos.",
            value: "Credit creators when sharing their work.",
          },
          {
            name: "📤 Don't Flood Channels – Avoid posting tons of images all at once.",
            value: "Don't flood channels.",
          }
        );

      await message.reply({
        embeds: [generalRulesEmbed, chatRulesEmbed, mediaRulesEmbed],
      });
    },
  },
};

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

  console.log("BitCraft Official Bot is online and ready!");

  // Set bot status
  client.user.setPresence({
    activities: [{ name: "the BitCraft Network", type: 3 }], // 3 is "WATCHING"
    status: "online",
  });
});

// Event handler for new guild members
client.on("guildMemberAdd", async (member) => {
  await welcomeMember(member);
});

// Message handler with improved command system
client.on("messageCreate", async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if message starts with any of the allowed prefixes
  let usedPrefix = null;
  for (const prefix of botConfig.prefixes) {
    if (message.content.startsWith(prefix)) {
      usedPrefix = prefix;
      break;
    }
  }

  // If no valid prefix found, return
  if (!usedPrefix) return;

  // Get the command and arguments
  const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Find the command in our commands object (checking aliases too)
  const command = Object.values(commands).find(
    (cmd) =>
      commandName ===
        Object.keys(commands).find((key) => commands[key] === cmd) ||
      (cmd.aliases && cmd.aliases.includes(commandName))
  );

  // If command not found, return
  if (!command) return;

  // Check if user has permission to use this command
  if (command.adminOnly && !isAdmin(message.member)) {
    return message.reply(
      "You need administrator or manage server permissions to use this command!"
    );
  }

  // Execute the command
  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    message.reply("There was an error executing that command.");
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

app.get("/", (req, res) => res.send("BitCraft Official Bot is running!"));

app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
});
