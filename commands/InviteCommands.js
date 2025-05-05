import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path for storing invite data
const INVITE_DATA_PATH = path.join(__dirname, "..", "invite-data.json");

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

// Command to view invites leaderboard
export const invitesConfig = {
  aliases: ["leaderboard", "invitelist"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if user has permission to use this command
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
    }

    // Load invite data
    const inviteData = loadInviteData();
    const guildData = inviteData[message.guild.id] || {};

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

        const inviter = await message.client.users.fetch(inviterId);
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
  },
};

// Command to view invites for a specific user
export const userInvitesConfig = {
  aliases: ["myinvites", "inviter"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if user has permission to use this command
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
    }

    // Load invite data
    const inviteData = loadInviteData();
    const guildData = inviteData[message.guild.id] || {};

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
  },
};

// Command to view stats for active invites
export const inviteStatsConfig = {
  aliases: ["activeinvites", "currentinvites"],
  adminOnly: true,
  execute: async (message, args) => {
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
  },
};

// Command to view all invites with details
export const allInvitesConfig = {
  aliases: ["invitehistory", "invitelogs"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if user has admin permission
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("You do not have permission to use this command.");
    }

    // Load invite data
    const inviteData = loadInviteData();
    const guildData = inviteData[message.guild.id] || {};

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
    allInviteData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Create pages with 10 invites per page
    const itemsPerPage = 10;
    const pages = [];

    for (let i = 0; i < allInviteData.length; i += itemsPerPage) {
      const pageItems = allInviteData.slice(i, i + itemsPerPage);
      let pageContent = "";

      for (const item of pageItems) {
        try {
          const inviter = await message.client.users.fetch(item.inviterId);
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
  },
};

// Command to create log channel for invites
export const createLogChannelConfig = {
  aliases: ["setupinvitelogs", "createinvitelog"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if user has admin permission
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("You do not have permission to use this command.");
    }

    const logChannelId = "1368535128468357142";

    // Check if log channel already exists
    const existingChannel = message.guild.channels.cache.get(logChannelId);

    if (existingChannel) {
      return message.reply(`Log channel <#${logChannelId}> already exists.`);
    }

    // Create log channel
    try {
      const newChannel = await message.guild.channels.create({
        id: logChannelId,
        name: "invite-logs",
        type: 0, // Text channel
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: [PermissionFlagsBits.SendMessages],
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      message.reply(`Created log channel <#${logChannelId}> for invite tracking.`);
    } catch (err) {
      console.error("Error creating log channel:", err);
      message.reply("There was an error creating the log channel.");
    }
  },
};

// Command for viewing invite help
export const inviteHelpConfig = {
  aliases: ["invitehelp", "invitecommands"],
  adminOnly: false,
  execute: async (message, args) => {
    const prefix = "?"; // Default prefix, you might want to get this from config

    const helpEmbed = new EmbedBuilder()
      .setColor("#1ABC9C")
      .setTitle("Invite Tracker - Commands")
      .setDescription("Here are the available invite tracking commands:")
      .addFields(
        {
          name: `${prefix}invites`,
          value: "View the invite leaderboard for the server",
          inline: true,
        },
        {
          name: `${prefix}userinvites [@user]`,
          value: "View detailed invite information for a specific user",
          inline: true,
        },
        {
          name: `${prefix}invitestats`,
          value: "View statistics for all active invite links",
          inline: true,
        },
        {
          name: `${prefix}allinvites`,
          value: "View complete list of all invites showing who invited whom",
          inline: true,
        },
        {
          name: `${prefix}createlogchannel`,
          value: "Create a channel for logging invite activity",
          inline: true,
        },
        {
          name: `${prefix}invitehelp`,
          value: "Display this help message",
          inline: true,
        }
      )
      .setFooter({
        text: "Note: Most commands require the Manage Server permission",
      });

    message.reply({ embeds: [helpEmbed] });
  },
};
