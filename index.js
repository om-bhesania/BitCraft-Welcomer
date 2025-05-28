// BitCraft Official Bot - Refactored and Modularized
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Collection,
  Events,
  PermissionFlagsBits,
} from "discord.js";
import { config as dotenvConfig } from "dotenv";
import express from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

// Import modules
import { commands } from "./commands/commandsConfig.js";
import { botConfig } from "./config/config.js";
import { getBackgroundInfo, isAdmin, welcomeMember } from "./utils/utils.js";
import { SlashCommandsManager } from "./slashCommands/SlashCommandsManager.js";
import { ipConfig } from "./commands/ip.js";
import { helpConfig } from "./commands/help.js";
import { rulesConfig } from "./commands/rules.js";

// Load environment variables
dotenvConfig();

// Constants and Configuration
const app = express();
export const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create slash commands manager
const slashManager = new SlashCommandsManager();

// Register your commands
slashManager.registerCommand(ipConfig);
slashManager.registerCommand(helpConfig);

// ================== INVITE TRACKING SYSTEM ==================
class InviteTracker {
  constructor() {
    this.invitesCache = new Map();
    this.guildInvitesCache = new Map();
    this.INVITE_DATA_PATH = path.join(__dirname, "invite-data.json");
  }

  // Utility Methods
  loadInviteData() {
    try {
      if (fs.existsSync(this.INVITE_DATA_PATH)) {
        const data = fs.readFileSync(this.INVITE_DATA_PATH, "utf8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error loading invite data:", err);
    }
    return {};
  }

  saveInviteData(data) {
    try {
      fs.writeFileSync(this.INVITE_DATA_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Error saving invite data:", err);
    }
  }

  convertToIST(date) {
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

  // Initialize invite cache for all guilds
  async initializeInviteCache(client) {
    console.log("Caching guild invites for tracking...");

    for (const guild of client.guilds.cache.values()) {
      try {
        const guildInvites = await guild.invites.fetch();

        // Cache for old system
        this.invitesCache.set(
          guild.id,
          new Map(
            guildInvites.map((invite) => [
              invite.code,
              { uses: invite.uses, inviter: invite.inviter?.id },
            ])
          )
        );

        // Cache for new system
        this.guildInvitesCache.set(
          guild.id,
          new Collection(guildInvites.map((invite) => [invite.code, invite]))
        );

        console.log(
          `Cached ${guildInvites.size} invites for guild ${guild.name}`
        );
      } catch (err) {
        console.error(`Error fetching invites for guild ${guild.name}:`, err);
      }
    }

    console.log("Invite tracking system initialized successfully!");
  }

  // Handle new guild join
  async handleGuildCreate(guild) {
    try {
      const guildInvites = await guild.invites.fetch();
      this.invitesCache.set(
        guild.id,
        new Map(
          guildInvites.map((invite) => [
            invite.code,
            { uses: invite.uses, inviter: invite.inviter?.id },
          ])
        )
      );
      this.guildInvitesCache.set(
        guild.id,
        new Collection(guildInvites.map((invite) => [invite.code, invite]))
      );
      console.log(
        `Cached ${guildInvites.size} invites for new guild ${guild.name}`
      );
    } catch (err) {
      console.error(`Error fetching invites for new guild ${guild.name}:`, err);
    }
  }

  // Handle invite creation
  handleInviteCreate(invite) {
    // Update old cache
    const guildInvites = this.invitesCache.get(invite.guild.id) || new Map();
    guildInvites.set(invite.code, {
      uses: invite.uses,
      inviter: invite.inviter ? invite.inviter.id : null,
    });
    this.invitesCache.set(invite.guild.id, guildInvites);

    // Update new cache
    const invites =
      this.guildInvitesCache.get(invite.guild.id) || new Collection();
    invites.set(invite.code, invite);
    this.guildInvitesCache.set(invite.guild.id, invites);

    console.log(
      `Cached new invite ${invite.code} for guild ${invite.guild.name}`
    );
  }

  // Handle invite deletion
  handleInviteDelete(invite) {
    const invites = this.guildInvitesCache.get(invite.guild.id);
    if (invites) {
      invites.delete(invite.code);
    }
  }

  // Find which invite was used
  async findUsedInvite(member) {
    const { guild } = member;
    const cachedInvites = this.invitesCache.get(guild.id) || new Map();
    const cachedInvitesSnapshot = new Map(cachedInvites);

    try {
      const newInvites = await guild.invites.fetch();
      let usedInvite = null;
      let inviter = null;

      // Find invite with increased uses
      for (const invite of newInvites.values()) {
        const cachedInviteData = cachedInvitesSnapshot.get(invite.code);
        if (!cachedInviteData) continue;

        if (invite.uses > cachedInviteData.uses) {
          usedInvite = invite;
          try {
            const inviterId =
              cachedInviteData.inviter ||
              (invite.inviter ? invite.inviter.id : null);
            if (inviterId) {
              inviter = await member.client.users.fetch(inviterId);
            }
          } catch (err) {
            console.error(
              `Error fetching inviter for invite ${invite.code}:`,
              err
            );
          }
          break;
        }
      }

      // Check for new invites if not found
      if (!usedInvite) {
        for (const invite of newInvites.values()) {
          if (
            invite.code === "vanity" ||
            cachedInvitesSnapshot.has(invite.code)
          )
            continue;
          usedInvite = invite;
          inviter = invite.inviter;
          break;
        }
      }

      // Check vanity URL
      if (!usedInvite && guild.vanityURLCode) {
        try {
          const vanityData = await guild.fetchVanityData();
          if (vanityData) {
            usedInvite = { code: "vanity", uses: vanityData.uses };
          }
        } catch (err) {
          console.error(
            `Error fetching vanity URL data for guild ${guild.name}:`,
            err
          );
        }
      }

      // Update cache
      this.invitesCache.set(
        guild.id,
        new Map(
          newInvites.map((invite) => [
            invite.code,
            {
              uses: invite.uses,
              inviter: invite.inviter ? invite.inviter.id : null,
            },
          ])
        )
      );

      this.guildInvitesCache.set(
        guild.id,
        new Collection(newInvites.map((invite) => [invite.code, invite]))
      );

      return { usedInvite, inviter };
    } catch (err) {
      console.error("Error finding used invite:", err);
      return { usedInvite: null, inviter: null };
    }
  }

  // Handle member join and track invite
  async handleMemberJoin(member) {
    if (member.user.bot) return;

    const { guild } = member;
    const { usedInvite, inviter } = await this.findUsedInvite(member);
    const inviteData = this.loadInviteData();
    const timestamp = new Date();
    const timestampIST = this.convertToIST(timestamp);

    // Initialize guild data
    inviteData[guild.id] = inviteData[guild.id] || {};

    let inviterId = "unknown";
    let inviterUsername = "Unknown";
    let inviteCode = "unknown";

    if (usedInvite && inviter) {
      inviterId = inviter.id;
      inviterUsername = inviter.username;
      inviteCode = usedInvite.code;
    } else if (usedInvite?.code === "vanity") {
      inviteCode = "vanity";
      inviterUsername = "Vanity URL";
    }

    // Update invite data
    inviteData[guild.id][inviterId] = inviteData[guild.id][inviterId] || {
      inviteCount: 0,
      invitedUsers: [],
    };

    const inviteInfo = {
      userId: member.user.id,
      username: member.user.username,
      inviteCode: inviteCode,
      timestamp: timestamp.toISOString(),
      timestampIST: timestampIST,
    };

    inviteData[guild.id][inviterId].inviteCount++;
    inviteData[guild.id][inviterId].invitedUsers.push(inviteInfo);

    this.saveInviteData(inviteData);

    // Send log message
    await this.sendJoinLog(
      member,
      inviterId,
      inviterUsername,
      inviteCode,
      timestampIST,
      inviteData[guild.id][inviterId].inviteCount
    );

    console.log(
      `${member.user.username} joined using invite ${inviteCode} from ${inviterUsername}`
    );
  }

  // Send join log to channel
  async sendJoinLog(
    member,
    inviterId,
    inviterUsername,
    inviteCode,
    timestampIST,
    totalInvites
  ) {
    const logChannel =
      member.guild.channels.cache.get(process.env.LOG_CHANNEL_ID) ||
      member.guild.channels.cache.find((ch) => ch.name === "invite-logs");

    if (!logChannel) return;

    let embed;

    if (inviteCode === "vanity") {
      embed = new EmbedBuilder()
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
          { name: "Date & Time", value: timestampIST, inline: false }
        )
        .setTimestamp();
    } else if (inviteCode === "unknown") {
      embed = new EmbedBuilder()
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
          { name: "Date & Time", value: timestampIST, inline: false }
        )
        .setTimestamp();
    } else {
      embed = new EmbedBuilder()
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
            value: `${totalInvites}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Member ID: ${member.id}` });
    }

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Error sending join log:", err);
    }
  }

  // Command handlers
  async handleInvitesCommand(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
    }

    const inviteData = this.loadInviteData();
    const guildData = inviteData[message.guild.id] || {};
    const allInviters = Object.keys(guildData);

    if (allInviters.length === 0) {
      return message.reply("No invite data has been recorded yet.");
    }

    const sortedInviters = allInviters
      .filter((id) => id !== "unknown")
      .sort(
        (a, b) =>
          (guildData[b].inviteCount || 0) - (guildData[a].inviteCount || 0)
      );

    let description = "";
    let count = 0;

    for (const inviterId of sortedInviters.slice(0, 20)) {
      try {
        const inviter = await message.client.users.fetch(inviterId);
        const inviterData = guildData[inviterId];
        description += `**${inviter.username}**: ${inviterData.inviteCount} invite(s)\n`;
        count++;
      } catch (err) {
        console.error(`Could not fetch user ${inviterId}:`, err);
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("Server Invite Leaderboard")
      .setDescription(description || "No invite data available.");

    message.reply({ embeds: [embed] });
  }

  async handleUserInvitesCommand(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
    }

    const target = message.mentions.users.first() || message.author;
    const inviteData = this.loadInviteData();
    const guildData = inviteData[message.guild.id] || {};
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
  }

  async handleInviteStatsCommand(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
    }

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
          const inviter = invite.inviter ? invite.inviter.username : "Unknown";
          inviteList += `• Code: **${invite.code}** by ${inviter} (${invite.uses} uses)\n`;
        }
        statsEmbed.setDescription(inviteList);
      }

      message.reply({ embeds: [statsEmbed] });
    } catch (err) {
      console.error("Error fetching invite stats:", err);
      message.reply("There was an error fetching the invite stats.");
    }
  }
}

// ================== SERVER STATUS MONITOR ==================
class ServerStatusMonitor {
  constructor() {
    this.lastServerState = null;
  }

  async fetchServerStatus() {
    const { BASE_URL, SERVER_ID, API_KEY } = process.env;
    if (!BASE_URL || !SERVER_ID || !API_KEY) {
      console.error("Missing required environment variable(s).");
      return null;
    }

    try {
      console.log(
        `Fetching status from ${BASE_URL}/api/client/servers/${SERVER_ID}/resources`
      );
      const response = await fetch(
        `${BASE_URL}/api/client/servers/${SERVER_ID}/resources`,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error(`API returned status ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(
        `Server status received: current_state=${data.attributes.current_state}`
      );
      return data.attributes;
    } catch (error) {
      console.error("Error fetching server status:", error.message);
      return null;
    }
  }

  getStatusMessage(state) {
    switch (state) {
      case "running":
        return "**ONLINE** ✅";
      case "stopping":
        return "**STOPPING** ⏳";
      case "installing":
        return "**INSTALLING** ⏳";
      case "starting":
        return "**STARTING** ⏳";
      default:
        return "**OFFLINE** ❌";
    }
  }

  async monitorServerStatus(client, roleId, channelId) {
    try {
      console.log("Starting server status check");

      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        console.error(`Invalid channel: ${channelId}`);
        return;
      }

      const guild = channel.guild;
      const role = await guild.roles.fetch(roleId);
      if (!role) {
        console.error(`Role not found: ${roleId}`);
        return;
      }

      const serverStatus = await this.fetchServerStatus();
      if (!serverStatus) {
        console.error("Failed to fetch server status");
        return;
      }

      const { current_state } = serverStatus;
      console.log(`Current server state: ${current_state}`);

      if (this.lastServerState !== current_state) {
        console.log(
          `Server state changed from ${this.lastServerState} to ${current_state}`
        );

        this.lastServerState = current_state;
        const messageContent = `<@&${roleId}>, the server is ${this.getStatusMessage(
          current_state
        )}`;

        try {
          await channel.send(messageContent);
          console.log("Status notification sent successfully");
        } catch (err) {
          console.error("Could not send status message:", err);
        }
      } else {
        console.log("Server state unchanged");
      }
    } catch (error) {
      console.error("Error in server status monitor:", error);
    }

    // Schedule next check
    setTimeout(
      () => this.monitorServerStatus(client, roleId, channelId),
      120000
    ); // 2 minutes
  }
}

// ================== MAIN BOT CLASS ==================
class BitCraftBot {
  constructor() {
    this.client = null;
    this.inviteTracker = new InviteTracker();
    this.statusMonitor = new ServerStatusMonitor();
    this.initializeBot();
  }

  initializeBot() {
    // Validate token
    if (!botConfig.token) {
      console.error(
        "Bot token is missing! Make sure to set BOT_TOKEN in your environment variables."
      );
      process.exit(1);
    }

    // Create client with intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildIntegrations,
      ],
    });
    this.client.commands = new Collection();
    this.client.slashCommands = slashManager.commands;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Bot ready event
    this.client.once("ready", async () => {
      console.log(`Logged in as ${this.client.user.tag}!`);

      // Check background file
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

      // Initialize systems
      await this.inviteTracker.initializeInviteCache(this.client);

      // Set bot status
      this.client.user.setPresence({
        activities: [{ name: "the BitCraft Network", type: 3 }],
        status: "online",
      });
      // Event: Handle slash command interactions
      this.client.on("interactionCreate", async (interaction) => {
        await slashManager.handleInteraction(interaction);
      });

      const { CHANNELID_FOR_ON_OFF_PINGER, ROLEID_FOR_PINGER,GUILD_ID } = process.env;
      this.client.on("ready", async () => {
        // Set Slash Commands
        await slashManager.deployCommands(this.client.user.id, GUILD_ID);
      });

      // Start server status monitoring

      // this.statusMonitor.monitorServerStatus(
      //   this.client,
      //   ROLEID_FOR_PINGER,
      //   CHANNELID_FOR_ON_OFF_PINGER
      // );

      console.log("BitCraft Official Bot is online and ready!");
    });

    // Guild member events
    this.client.on("guildMemberAdd", async (member) => {
      await welcomeMember(member);
      await this.inviteTracker.handleMemberJoin(member);
    });

    // Guild events
    this.client.on("guildCreate", (guild) => {
      this.inviteTracker.handleGuildCreate(guild);
    });

    // Invite events
    this.client.on("inviteCreate", (invite) => {
      this.inviteTracker.handleInviteCreate(invite);
    });

    this.client.on("inviteDelete", (invite) => {
      this.inviteTracker.handleInviteDelete(invite);
    });

    // Message events
    this.client.on("messageCreate", async (message) => {
      await this.handleMessage(message);
    });

    // Error handling
    this.client.on("error", console.error);
    process.on("unhandledRejection", (error) => {
      console.error("Unhandled promise rejection:", error);
    });
  }

  async handleMessage(message) {
    if (message.author.bot) return;

    // Handle prefix commands
    let usedPrefix = null;
    for (const prefix of botConfig.prefixes) {
      if (message.content.startsWith(prefix)) {
        usedPrefix = prefix;
        break;
      }
    }

    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Handle invite tracking commands
    if (await this.handleInviteCommands(message, commandName, args)) {
      return;
    }

    // Handle regular bot commands
    const command = Object.values(commands).find(
      (cmd) =>
        commandName ===
          Object.keys(commands).find((key) => commands[key] === cmd) ||
        (cmd.aliases && cmd.aliases.includes(commandName))
    );

    if (!command) return;

    if (command.adminOnly && !isAdmin(message.member)) {
      return message.reply(
        "You need administrator or manage server permissions to use this command!"
      );
    }

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
  }

  async handleInviteCommands(message, commandName, args) {
    if (!message.guild) return false;

    switch (commandName) {
      case "invites":
        await this.inviteTracker.handleInvitesCommand(message);
        return true;
      case "userinvites":
        await this.inviteTracker.handleUserInvitesCommand(message);
        return true;
      case "invitestats":
        await this.inviteTracker.handleInviteStatsCommand(message);
        return true;
      case "help":
        await this.sendHelpMessage(message);
        return true;
      default:
        return false;
    }
  }

  async sendHelpMessage(message) {
    const helpEmbed = new EmbedBuilder()
      .setColor("#1ABC9C")
      .setTitle("Invite Tracker Bot - Commands")
      .setDescription("Here are the available commands:")
      .addFields(
        {
          name: `${botConfig.prefixes[0]}invites`,
          value: "View the invite leaderboard for the server",
          inline: false,
        },
        {
          name: `${botConfig.prefixes[0]}userinvites [@user]`,
          value: "View detailed invite information for a specific user",
          inline: false,
        },
        {
          name: `${botConfig.prefixes[0]}invitestats`,
          value: "View statistics for all active invite links",
          inline: false,
        },
        {
          name: `${botConfig.prefixes[0]}help`,
          value: "Display this help message",
          inline: false,
        }
      )
      .setFooter({
        text: "Note: Most commands require the Manage Server permission",
      });

    message.reply({ embeds: [helpEmbed] });
  }

  async start() {
    console.log("Attempting to log in to Discord...");
    try {
      await this.client.login(botConfig.token);
    } catch (error) {
      console.error("Failed to login:", error);
      console.error("Please check your bot token and try again.");
      process.exit(1);
    }
  }
}

// ================== WEB SERVER ==================
function startWebServer() {
  app.get("/", (req, res) => res.send("BitCraft Official Bot is running!"));

  app.listen(PORT, () => {
    console.log(`Web server is running on port ${PORT}`);
  });
}

// ================== INITIALIZE APPLICATION ==================
async function main() {
  // Start web server
  startWebServer();

  // Start bot
  const bot = new BitCraftBot();
  await bot.start();
}

// Start the application
main().catch(console.error);
