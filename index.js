// BitCraft Official Bot - ES Modules version with enhanced command system
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import express from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { commands } from "./commands/commandsConfig.js";
import { botConfig } from "./config/config.js";
import {
  setupInteractionHandler
} from "./slashCommands/SlashCommandsConfig.js";
import { getBackgroundInfo, isAdmin, welcomeMember } from "./utils/utils.js";

// Load environment variables
config();

const app = express();
export const PORT = process.env.PORT || 3000;
// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    GatewayIntentBits.GuildInvites,
  ],
});

// Event handler for when bot is ready
client.once("ready", async () => {
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
  // Register slash commands
  // await registerSlashCommands(client);

  // Setup interaction handler for slash commands
  setupInteractionHandler(client);
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
    if (typeof command.execute === "function") {
      await command.execute(message, args);
    } else {
      console.error(
        `Error executing command ${commandName}: command.execute is not a function`
      );
      message.reply("There was an error executing that command.");
    }
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


// =================Invite Logger=================
// Store for invite tracking
const invitesCache = new Map();

// Path for storing invite data
const INVITE_DATA_PATH = path.join(__dirname, "invite-data.json");

// Utility to load invite data from file
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

// Utility to save invite data to file
function saveInviteData(data) {
  try {
    fs.writeFileSync(INVITE_DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving invite data:", err);
  }
}

// Function to convert UTC to IST (Indian Standard Time)
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

// When the bot is ready
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Initialize the invite cache for all guilds
  for (const guild of client.guilds.cache.values()) {
    try {
      const guildInvites = await guild.invites.fetch();
      invitesCache.set(
        guild.id,
        new Map(guildInvites.map((invite) => [invite.code, { uses: invite.uses, inviter: invite.inviter?.id }]))
      );
      console.log(
        `Cached ${guildInvites.size} invites for guild ${guild.name}`
      );
    } catch (err) {
      console.error(`Error fetching invites for guild ${guild.name}:`, err);
    }
  }
});

// When the bot joins a new guild
client.on("guildCreate", async (guild) => {
  try {
    const guildInvites = await guild.invites.fetch();
    invitesCache.set(
      guild.id,
      new Map(guildInvites.map((invite) => [invite.code, { uses: invite.uses, inviter: invite.inviter.id }]))
    );
    console.log(
      `Cached ${guildInvites.size} invites for new guild ${guild.name}`
    );
  } catch (err) {
    console.error(`Error fetching invites for new guild ${guild.name}:`, err);
  }
});

// When a new invite is created
client.on("inviteCreate", (invite) => {
  const guildInvites = invitesCache.get(invite.guild.id) || new Map();
  guildInvites.set(invite.code, { 
    uses: invite.uses, 
    inviter: invite.inviter ? invite.inviter.id : null 
  });
  invitesCache.set(invite.guild.id, guildInvites);
  console.log(
    `Cached new invite ${invite.code} for guild ${invite.guild.name}`
  );
});

// When a new member joins
client.on("guildMemberAdd", async (member) => {
  // Skip bots
  if (member.user.bot) return;

  const { guild } = member;

  try {
    // Load the previous invite counts
    const cachedInvites = invitesCache.get(guild.id) || new Map();

    // Take a snapshot of the cached invites before updating
    const cachedInvitesSnapshot = new Map(cachedInvites);

    // Fetch the new invite counts
    const newInvites = await guild.invites.fetch();

    // Find the invite that was used
    let usedInvite = null;
    let inviter = null;

    // First approach: Find invite with increased uses
    for (const invite of newInvites.values()) {
      // Get the cached invite data
      const cachedInviteData = cachedInvitesSnapshot.get(invite.code);
      
      // Skip if we don't have cached data for this invite
      if (!cachedInviteData) continue;
      
      // If this invite has one more use than before, it's the one that was used
      if (invite.uses > cachedInviteData.uses) {
        usedInvite = invite;
        
        try {
          // Try to get the inviter from the cached data first, then from the invite itself
          const inviterId = cachedInviteData.inviter || (invite.inviter ? invite.inviter.id : null);
          if (inviterId) {
            inviter = await client.users.fetch(inviterId);
          }
        } catch (err) {
          console.error(`Error fetching inviter for invite ${invite.code}:`, err);
        }
        
        break;
      }
    }

    // Second approach: If we couldn't find the invite, check for any new invites
    if (!usedInvite) {
      for (const invite of newInvites.values()) {
        // If this invite doesn't exist in our cache or is a vanity URL, skip
        if (invite.code === 'vanity' || cachedInvitesSnapshot.has(invite.code)) continue;
        
        usedInvite = invite;
        inviter = invite.inviter;
        break;
      }
    }

    // Third approach: If we still couldn't find the invite, look for vanity URL
    if (!usedInvite && guild.vanityURLCode) {
      try {
        const vanityData = await guild.fetchVanityData();
        if (vanityData) {
          usedInvite = {
            code: 'vanity',
            uses: vanityData.uses
          };
        }
      } catch (err) {
        console.error(`Error fetching vanity URL data for guild ${guild.name}:`, err);
      }
    }

    // Update the cache with the new invite counts
    invitesCache.set(
      guild.id,
      new Map(newInvites.map((invite) => [invite.code, { 
        uses: invite.uses, 
        inviter: invite.inviter ? invite.inviter.id : null 
      }]))
    );

    // Find the log channel
    const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

    // Load saved invite data
    const inviteData = loadInviteData();

    // Prepare guild data
    inviteData[guild.id] = inviteData[guild.id] || {};

    if (usedInvite && inviter) {
      const inviterId = inviter.id;

      // Initialize inviter data if needed
      inviteData[guild.id][inviterId] = inviteData[guild.id][inviterId] || {
        inviteCount: 0,
        invitedUsers: [],
      };

      // Record the new invite
      const timestamp = new Date();
      const inviteInfo = {
        userId: member.user.id,
        username: member.user.username,
        inviteCode: usedInvite.code,
        timestamp: timestamp.toISOString(),
        timestampIST: convertToIST(timestamp),
      };

      inviteData[guild.id][inviterId].inviteCount++;
      inviteData[guild.id][inviterId].invitedUsers.push(inviteInfo);

      // Save updated invite data
      saveInviteData(inviteData);

      // Log to console
      console.log(
        `${member.user.username} joined using invite code ${usedInvite.code} from ${inviter.username}`
      );

      // Log to channel if available
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("New Member Joined")
          .setDescription(`${member.user} joined the server`)
          .addFields(
            { name: "Invited by", value: `${inviter.username}`, inline: true },
            { name: "Invite Code", value: `${usedInvite.code}`, inline: true },
            {
              name: "Date & Time",
              value: convertToIST(timestamp),
              inline: false,
            }
          )
          .setFooter({
            text: `Inviter now has ${
              inviteData[guild.id][inviterId].inviteCount
            } invites`,
          })
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }
    } else if (usedInvite && usedInvite.code === 'vanity') {
      // If the user joined using the vanity URL
      console.log(`${member.user.username} joined using the server's vanity URL`);
      
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("#3498DB")
          .setTitle("New Member Joined")
          .setDescription(`${member.user} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Joined using the server's vanity URL",
              inline: false,
            },
            {
              name: "Date & Time",
              value: convertToIST(new Date()),
              inline: false,
            }
          )
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }
    } else {
      // If we couldn't determine the invite used
      console.log(
        `${member.user.username} joined but the invite used couldn't be determined`
      );

      // Add to unknown invites tracking
      const unknownInviterId = "unknown";
      inviteData[guild.id][unknownInviterId] = inviteData[guild.id][unknownInviterId] || {
        inviteCount: 0,
        invitedUsers: [],
      };

      const timestamp = new Date();
      const inviteInfo = {
        userId: member.user.id,
        username: member.user.username,
        inviteCode: "unknown",
        timestamp: timestamp.toISOString(),
        timestampIST: convertToIST(timestamp),
      };

      inviteData[guild.id][unknownInviterId].inviteCount++;
      inviteData[guild.id][unknownInviterId].invitedUsers.push(inviteInfo);

      // Save updated invite data
      saveInviteData(inviteData);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("#E74C3C")
          .setTitle("New Member Joined")
          .setDescription(`${member.user} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Could not determine which invite was used",
              inline: false,
            },
            {
              name: "Date & Time",
              value: convertToIST(new Date()),
              inline: false,
            }
          )
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error(
      `Error handling new member join for ${member.user.username}:`,
      err
    );
  }
});

// Command handler
client.on("messageCreate", async (message) => {
  // Ignore messages from bots or messages that don't start with the prefix
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;

  // Parse the command and arguments
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Only process commands in guild context
  if (!message.guild) return;

  // Load invite data
  const inviteData = loadInviteData();
  const guildData = inviteData[message.guild.id] || {};

  switch (command) {
    case "invites":
      // Check if user has permission to use this command
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("You do not have permission to use this command.");
      }

      // Display invites for all users
      const allInviters = Object.keys(guildData);

      if (allInviters.length === 0) {
        return message.reply("No invite data has been recorded yet.");
      }

      const sortedInviters = allInviters.sort((a, b) => {
        const countA = guildData[a].inviteCount || 0;
        const countB = guildData[b].inviteCount || 0;
        return countB - countA; // Sort by invite count (descending)
      });

      const embed = new EmbedBuilder()
        .setColor("#3498DB")
        .setTitle("Server Invite Leaderboard")
        .setDescription(
          "Here are the members who have invited users to this server:"
        );

      let description = "";
      let count = 0;

      for (const inviterId of sortedInviters) {
        if (count >= 20) break; // Limit to top 20

        try {
          // Skip the "unknown" inviter entry in the leaderboard
          if (inviterId === "unknown") continue;

          const inviter = await client.users.fetch(inviterId);
          const inviterData = guildData[inviterId];
          description += `**${inviter.username}**: ${inviterData.inviteCount} invite(s)\n`;
          count++;
        } catch (err) {
          console.error(`Could not fetch user ${inviterId}:`, err);

          // Skip the "unknown" inviter entry in the leaderboard
          if (inviterId !== "unknown") {
            description += `**Unknown User**: ${guildData[inviterId].inviteCount} invite(s)\n`;
            count++;
          }
        }
      }

      embed.setDescription(description || "No invite data available.");
      message.reply({ embeds: [embed] });
      break;

    case "userinvites":
      // Check if user has permission to use this command
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("You do not have permission to use this command.");
      }

      // Get the mentioned user or use the message author
      const target = message.mentions.users.first() || message.author;
      const targetData = guildData[target.id];

      if (!targetData || targetData.inviteCount === 0) {
        return message.reply(`${target.username} hasn't invited anyone yet.`);
      }

      const userEmbed = new EmbedBuilder()
        .setColor("#9B59B6")
        .setTitle(`Invite Information for ${target.username}`)
        .addFields({
          name: "Total Invites",
          value: `${targetData.inviteCount}`,
          inline: false,
        });

      // Add details about the last 5 invited users
      const invitedUsers = targetData.invitedUsers.slice(-5).reverse();

      if (invitedUsers.length > 0) {
        let inviteDetails = "";

        for (const invite of invitedUsers) {
          inviteDetails += `• ${invite.username} (joined: ${invite.timestampIST}) using code: ${invite.inviteCode}\n`;
        }

        userEmbed.addFields({
          name: "Recent Invites",
          value: inviteDetails,
          inline: false,
        });
      }

      message.reply({ embeds: [userEmbed] });
      break;

    case "invitestats":
      // Check if user has permission to use this command
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("You do not have permission to use this command.");
      }

      // Get active invites
      try {
        const guildInvites = await message.guild.invites.fetch();

        const statsEmbed = new EmbedBuilder()
          .setColor("#F1C40F")
          .setTitle("Current Server Invite Stats");

        if (guildInvites.size === 0) {
          statsEmbed.setDescription(
            "There are no active invites for this server."
          );
        } else {
          let inviteList = "";

          for (const invite of guildInvites.values()) {
            const inviter = invite.inviter
              ? invite.inviter.username
              : "Unknown";
            inviteList += `• Code: **${invite.code}** by ${inviter} (${invite.uses} uses)\n`;
          }

          statsEmbed.setDescription(inviteList);
        }

        message.reply({ embeds: [statsEmbed] });
      } catch (err) {
        console.error("Error fetching invite stats:", err);
        message.reply("There was an error fetching the invite stats.");
      }
      break;

    case "allinvites":
      // Check if user has admin permission
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("You do not have permission to use this command.");
      }

      // Show all invites including who invited whom
      const allInviteData = [];

      for (const inviterId in guildData) {
        // Skip the "unknown" invites
        if (inviterId === "unknown") continue;

        const inviterData = guildData[inviterId];

        if (!inviterData.invitedUsers || inviterData.invitedUsers.length === 0)
          continue;

        for (const invite of inviterData.invitedUsers) {
          allInviteData.push({
            inviterId,
            inviteCode: invite.inviteCode,
            invitedUser: invite.username,
            timestamp: invite.timestampIST,
          });
        }
      }

      if (allInviteData.length === 0) {
        return message.reply("No invite data has been recorded yet.");
      }

      // Sort by most recent first
      allInviteData.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Create pages with 10 invites per page
      const itemsPerPage = 10;
      const pages = [];

      for (let i = 0; i < allInviteData.length; i += itemsPerPage) {
        const pageItems = allInviteData.slice(i, i + itemsPerPage);
        let pageContent = "";

        for (const item of pageItems) {
          try {
            const inviter = await client.users.fetch(item.inviterId);
            pageContent += `• **${inviter.username}** invited **${item.invitedUser}** (${item.timestamp}) with code: ${item.inviteCode}\n`;
          } catch (err) {
            pageContent += `• **Unknown User** invited **${item.invitedUser}** (${item.timestamp}) with code: ${item.inviteCode}\n`;
          }
        }

        pages.push(pageContent);
      }

      // Send the first page
      const allInvitesEmbed = new EmbedBuilder()
        .setColor("#16A085")
        .setTitle("All Server Invites")
        .setDescription(pages[0] || "No invite data available.")
        .setFooter({
          text: `Page 1/${pages.length} • Total: ${allInviteData.length} invites`,
        });

      message.reply({ embeds: [allInvitesEmbed] });
      break;

    case "createlogchannel":
      // Check if user has admin permission
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("You do not have permission to use this command.");
      }

      // Check if log channel already exists
      const existingChannel = message.guild.channels.cache.find(
        (channel) =>
          channel.name === config.logChannelName && channel.isTextBased()
      );

      if (existingChannel) {
        return message.reply(
          `Log channel #${config.logChannelName} already exists.`
        );
      }

      // Create log channel
      try {
        const newChannel = await message.guild.channels.create({
          name: config.logChannelName,
          type: 0, // Text channel
          permissionOverwrites: [
            {
              id: message.guild.id,
              deny: [PermissionFlagsBits.SendMessages],
              allow: [PermissionFlagsBits.ViewChannel],
            },
          ],
        });

        message.reply(`Created log channel ${newChannel} for invite tracking.`);
      } catch (err) {
        console.error("Error creating log channel:", err);
        message.reply("There was an error creating the log channel.");
      }
      break;

    case "help":
      const helpEmbed = new EmbedBuilder()
        .setColor("#1ABC9C")
        .setTitle("Invite Tracker Bot - Commands")
        .setDescription("Here are the available commands:")
        .addFields(
          {
            name: `${config.prefix}invites`,
            value: "View the invite leaderboard for the server",
            inline: false,
          },
          {
            name: `${config.prefix}userinvites [@user]`,
            value: "View detailed invite information for a specific user",
            inline: false,
          },
          {
            name: `${config.prefix}invitestats`,
            value: "View statistics for all active invite links",
            inline: false,
          },
          {
            name: `${config.prefix}allinvites`,
            value: "View complete list of all invites showing who invited whom",
            inline: false,
          },
          {
            name: `${config.prefix}createlogchannel`,
            value: "Create a channel for logging invite activity",
            inline: false,
          },
          {
            name: `${config.prefix}help`,
            value: "Display this help message",
            inline: false,
          }
        )
        .setFooter({
          text: "Note: Most commands require the Manage Server permission",
        });

      message.reply({ embeds: [helpEmbed] });
      break;
  }
  // When bot is ready, cache all guild invites
  client.on(Events.ClientReady, async () => {
    try {
      console.log("Caching guild invites for tracking...");
      for (const guild of client.guilds.cache.values()) {
        const invites = await guild.invites.fetch();
        guildInvitesCache.set(
          guild.id,
          new Collection(invites.map((invite) => [invite.code, invite]))
        );
      }
      console.log("Invite tracking system initialized successfully!");
    } catch (err) {
      console.error("Error initializing invite tracking:", err);
    }
  });

  // When a new invite is created, add it to our cache
  client.on(Events.InviteCreate, async (invite) => {
    try {
      const invites =
        guildInvitesCache.get(invite.guild.id) || new Collection();
      invites.set(invite.code, invite);
      guildInvitesCache.set(invite.guild.id, invites);
    } catch (err) {
      console.error("Error tracking new invite:", err);
    }
  });

  // When an invite is deleted, remove it from our cache
  client.on(Events.InviteDelete, (invite) => {
    try {
      const invites = guildInvitesCache.get(invite.guild.id);
      if (invites) {
        invites.delete(invite.code);
      }
    } catch (err) {
      console.error("Error tracking deleted invite:", err);
    }
  });

  // When a new member joins, find which invite they used
  client.on(Events.GuildMemberAdd, async (member) => {
    // Skip bots
    if (member.user.bot) return;

    try {
      // Get the invite data from file
      const inviteData = loadInviteData();
      if (!inviteData[member.guild.id]) {
        inviteData[member.guild.id] = {};
      }
      const guildData = inviteData[member.guild.id];

      // Get cached invites for the guild
      const cachedInvites =
        guildInvitesCache.get(member.guild.id) || new Collection();

      // Fetch current invites to compare with cached ones
      const newInvites = await member.guild.invites.fetch();

      // Find the invite that was used by comparing uses count
      let usedInvite = null;
      let inviter = null;

      newInvites.forEach((invite) => {
        const cachedInvite = cachedInvites.get(invite.code);
        if (cachedInvite && cachedInvite.uses < invite.uses) {
          usedInvite = invite;
          inviter = invite.inviter;
        }
      });

      // Update our cache with the new invites
      guildInvitesCache.set(
        member.guild.id,
        new Collection(newInvites.map((invite) => [invite.code, invite]))
      );

      // Default values if invite can't be determined
      let inviterId = "unknown";
      let inviterUsername = "Unknown";
      let inviteCode = "unknown";

      // Update with actual values if we found the used invite
      if (usedInvite && inviter) {
        inviterId = inviter.id;
        inviterUsername = inviter.username;
        inviteCode = usedInvite.code;
      } else if (member.guild.vanityURLCode) {
        // Check if they used a vanity URL
        try {
          const vanityData = await member.guild.fetchVanityData();
          if (vanityData) {
            inviteCode = "vanity";
            inviterUsername = "Vanity URL";
          }
        } catch (err) {
          console.error("Error checking vanity URL:", err);
        }
      }

      // Create/update inviter's data
      if (!guildData[inviterId]) {
        guildData[inviterId] = {
          inviteCount: 0,
          invitedUsers: [],
        };
      }

      // Increment invite count
      guildData[inviterId].inviteCount += 1;

      // Add new invited user to inviter's record
      const timestamp = new Date();
      const timestampIST = convertToIST(timestamp);

      guildData[inviterId].invitedUsers.push({
        id: member.id,
        username: member.user.username,
        inviteCode: inviteCode,
        timestamp: timestamp.toISOString(),
        timestampIST: timestampIST,
      });

      // Save updated invite data
      saveInviteData(inviteData);

      // Find the invite-logs channel or use the configured log channel
      const logChannel =
        member.guild.channels.cache.get(process.env.LOG_CHANNEL_ID) ||
        member.guild.channels.cache.find((ch) => ch.name === "invite-logs");

      if (!logChannel) return; // No log channel found, silently return

      // Create the embed based on invite type
      let logEmbed;

      if (inviteCode === "vanity") {
        // Vanity URL embed
        logEmbed = new EmbedBuilder()
          .setColor("#3498DB")
          .setTitle("New Member Joined")
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`${member.user} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Joined using the server's vanity URL",
              inline: false,
            },
            {
              name: "Date & Time",
              value: timestampIST,
              inline: false,
            }
          )
          .setTimestamp();
      } else if (inviteCode === "unknown") {
        // Unknown invite embed
        logEmbed = new EmbedBuilder()
          .setColor("#E74C3C")
          .setTitle("New Member Joined")
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`${member.user} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Could not determine which invite was used",
              inline: false,
            },
            {
              name: "Date & Time",
              value: timestampIST,
              inline: false,
            }
          )
          .setTimestamp();
      } else {
        // Normal invite embed
        logEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("New Member Joined")
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`${member.user} joined the server`)
          .addFields(
            {
              name: "Member",
              value: `${member.user.username} (<@${member.id}>)`,
              inline: true,
            },
            {
              name: "Invited By",
              value: `${inviterUsername} (<@${inviterId}>)`,
              inline: true,
            },
            { name: "Invite Code", value: inviteCode, inline: true },
            { name: "Joined At", value: timestampIST, inline: true },
            {
              name: `${inviterUsername}'s Total Invites`,
              value: `${guildData[inviterId].inviteCount}`,
              inline: true,
            }
          )
          .setTimestamp()
          .setFooter({ text: `Member ID: ${member.id}` });
      }

      // Send the embed to the log channel
      await logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
      console.error("Error tracking member join:", err);
    }
  });
});

