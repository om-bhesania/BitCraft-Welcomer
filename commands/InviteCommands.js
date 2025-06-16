import {
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  Collection,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path for storing invite data
const INVITE_DATA_PATH = path.join(__dirname, "../data/invites.json");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory at ${dataDir}`);
  } catch (dirError) {
    console.error(`Error creating data directory: ${dirError.message}`);
  }
}

// Global collection to track guild invites
export const guildInvites = new Map();

// Utility to load invite data from file
export function loadInviteData() {
  try {
    if (fs.existsSync(INVITE_DATA_PATH)) {
      const data = fs.readFileSync(INVITE_DATA_PATH, "utf8");
      return JSON.parse(data);
    } else {
      console.log(
        `Invite data file not found at ${INVITE_DATA_PATH}, will create when needed`
      );
    }
  } catch (error) {
    console.error(`Error loading invite data: ${error.message}`);
  }
  return {};
}

// Utility to save invite data to file
export function saveInviteData(data) {
  try {
    // Ensure data directory exists before saving
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(INVITE_DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`Successfully saved invite data to ${INVITE_DATA_PATH}`);
  } catch (error) {
    console.error(`Error saving invite data: ${error.message}`);
  }
}

// Function to convert UTC to IST (Indian Standard Time)
function convertToIST(date) {
  try {
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
  } catch (error) {
    console.error(`Error converting timestamp: ${error.message}`);
    return "Unknown Date";
  }
}

// Command to view invites leaderboard
export const invitesConfig = {
  name: "invites",
  aliases: ["leaderboard", "invitelist", "inviteslb"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Validate message and guild
      if (!message || !message.guild) {
        console.error("Invalid message or guild object in invites command");
        return;
      }

      // Check if user has permission to use this command
      if (
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return message.reply(
          "You need the 'Manage Server' permission to use this command."
        );
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

          if (!inviterData || typeof inviterData.inviteCount === "undefined") {
            console.log(`Missing invite data for user ${inviterId}, skipping`);
            continue;
          }

          description += `**${inviter.username || "Unknown User"}**: ${
            inviterData.inviteCount
          } invite(s)\n`;
          count++;
        } catch (err) {
          console.error(`Could not fetch user ${inviterId}: ${err.message}`);

          // Skip the "unknown" inviter entry in the leaderboard
          if (
            inviterId !== "unknown" &&
            guildData[inviterId] &&
            guildData[inviterId].inviteCount
          ) {
            description += `**Unknown User (${inviterId.slice(0, 6)}...)**: ${
              guildData[inviterId].inviteCount
            } invite(s)\n`;
            count++;
          }
        }
      }

      embed.setDescription(description || "No invite data available.");
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error in invites command: ${error.message}`);
      message.reply(
        "An error occurred while processing the invites command. Please try again later."
      );
    }
  },
};

// Command to view invites for a specific user
export const userInvitesConfig = {
  name: "userinvites",
  aliases: ["myinvites", "inviter", "uit"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Validate message and guild
      if (!message || !message.guild) {
        console.error("Invalid message or guild object in userinvites command");
        return;
      }

      // Check permissions
      if (
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return message.reply(
          "You need the 'Manage Server' permission to use this command."
        );
      }

      const inviteData = loadInviteData();
      const guildData = inviteData[message.guild.id] || {};

      let target = message.mentions.users.first();

      if (!target && args.length > 0) {
        const search = args.join(" ").toLowerCase();

        // Try to find user in cache by ID, username, or display name
        const memberFromCache = message.guild.members.cache.find(
          (m) =>
            m.user.id === search ||
            m.user.username.toLowerCase() === search ||
            (m.displayName && m.displayName.toLowerCase() === search)
        );

        if (memberFromCache) {
          target = memberFromCache.user;
        } else {
          // Try to fetch user from guild if not in cache
          try {
            // Check if search is a valid user ID
            if (/^\d{17,19}$/.test(search)) {
              const memberFromFetch = await message.guild.members.fetch(search);
              if (memberFromFetch) {
                target = memberFromFetch.user;
              }
            } else {
              // Try to fetch by username
              const members = await message.guild.members.fetch();
              const foundMember = members.find(
                (m) =>
                  m.user.username.toLowerCase() === search ||
                  (m.displayName && m.displayName.toLowerCase() === search)
              );
              if (foundMember) {
                target = foundMember.user;
              }
            }
          } catch (err) {
            console.error(`Error fetching member: ${err.message}`);
            // Continue with default (message author)
          }
        }
      }

      if (!target) {
        target = message.author;
      }

      const targetData = guildData[target.id];

      if (
        !targetData ||
        !targetData.inviteCount ||
        targetData.inviteCount === 0
      ) {
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

      // Check if invitedUsers exists and is an array
      if (
        targetData.invitedUsers &&
        Array.isArray(targetData.invitedUsers) &&
        targetData.invitedUsers.length > 0
      ) {
        const invitedUsers = targetData.invitedUsers.slice(-5).reverse(); // Get last 5 invites

        const inviteDetails = invitedUsers
          .map((invite) => {
            const username = invite.username || "Unknown User";
            const timestamp = invite.timestampIST || "Unknown Time";
            const inviteCode = invite.inviteCode || "Unknown Code";
            return `• ${username} (joined: ${timestamp}) using code: ${inviteCode}`;
          })
          .join("\n");

        userEmbed.addFields({
          name: "Recent Invites",
          value: inviteDetails,
          inline: false,
        });
      } else {
        userEmbed.addFields({
          name: "Recent Invites",
          value: "No detailed invite information available.",
          inline: false,
        });
      }

      await message.reply({ embeds: [userEmbed] });
    } catch (error) {
      console.error(`Error in userinvites command: ${error.message}`);
      message.reply(
        "An error occurred while processing the userinvites command. Please try again later."
      );
    }
  },
};

// Command to view stats for active invites
export const inviteStatsConfig = {
  name: "invitestats",
  aliases: ["activeinvites", "currentinvites"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Validate message and guild
      if (!message || !message.guild) {
        console.error("Invalid message or guild object in invitestats command");
        return;
      }

      // Check if user has permission to use this command
      if (
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return message.reply(
          "You need the 'Manage Server' permission to use this command."
        );
      }

      // Get active invites
      try {
        const guildInvites = await message.guild.invites.fetch();

        const statsEmbed = new EmbedBuilder()
          .setColor("#F1C40F")
          .setTitle("Current Server Invite Stats")
          .setTimestamp();

        if (!guildInvites || guildInvites.size === 0) {
          statsEmbed.setDescription(
            "There are no active invites for this server."
          );
        } else {
          let inviteList = "";

          for (const invite of guildInvites.values()) {
            try {
              const inviter = invite.inviter
                ? invite.inviter.username
                : "Unknown";
              const uses = invite.uses || 0;
              const maxUses = invite.maxUses ? `/${invite.maxUses}` : "";
              const expiresAt = invite.expiresAt
                ? `(Expires: ${new Date(invite.expiresAt).toLocaleString()})`
                : "(Never expires)";

              inviteList += `• Code: **${invite.code}** by ${inviter} (${uses}${maxUses} uses) ${expiresAt}\n`;
            } catch (inviteError) {
              console.error(`Error processing invite: ${inviteError.message}`);
              // Continue with next invite
            }
          }

          statsEmbed.setDescription(
            inviteList || "Error processing invite information."
          );
        }

        await message.reply({ embeds: [statsEmbed] });
      } catch (fetchError) {
        console.error(`Error fetching invite stats: ${fetchError.message}`);
        message.reply(
          "There was an error fetching the invite stats. Make sure the bot has the 'Manage Server' permission."
        );
      }
    } catch (error) {
      console.error(`Error in invitestats command: ${error.message}`);
      message.reply(
        "An error occurred while processing the invitestats command. Please try again later."
      );
    }
  },
};

// Command to view all invites with details
export const allInvitesConfig = {
  name: "allinvites",
  aliases: ["invitehistory", "invitelogs"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Validate message and guild
      if (!message || !message.guild) {
        console.error("Invalid message or guild object in allinvites command");
        return;
      }

      // Check if user has admin permission
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(
          "You need Administrator permission to use this command."
        );
      }

      // Load invite data
      const inviteData = loadInviteData();
      const guildData = inviteData[message.guild.id] || {};

      // Show all invites including who invited whom
      const loadInviteData = [];

      for (const inviterId in guildData) {
        try {
          // Skip the "unknown" invites
          if (inviterId === "unknown") continue;

          const inviterData = guildData[inviterId];

          if (
            !inviterData ||
            !inviterData.invitedUsers ||
            !Array.isArray(inviterData.invitedUsers) ||
            inviterData.invitedUsers.length === 0
          ) {
            continue;
          }

          for (const invite of inviterData.invitedUsers) {
            if (!invite) continue;

            loadInviteData.push({
              inviterId,
              inviteCode: invite.inviteCode || "Unknown",
              invitedUser: invite.username || "Unknown User",
              timestamp: invite.timestampIST || "Unknown Time",
            });
          }
        } catch (inviterError) {
          console.error(
            `Error processing inviter ${inviterId}: ${inviterError.message}`
          );
          // Continue with next inviter
        }
      }

      if (loadInviteData.length === 0) {
        return message.reply("No invite data has been recorded yet.");
      }
    } catch (error) {
      console.error(`Error collecting invite data: ${error.message}`);
      message.reply(
        "An error occurred while collecting invite data. Please try again later."
      );
      return;
    }

    try {
      // Sort by most recent first
      loadInviteData.sort((a, b) => {
        try {
          return new Date(b.timestamp) - new Date(a.timestamp);
        } catch (dateError) {
          console.error(`Error comparing dates: ${dateError.message}`);
          return 0; // Keep original order if date comparison fails
        }
      });

      // Create pages with 10 invites per page
      const itemsPerPage = 10;
      const pages = [];

      for (let i = 0; i < loadInviteData.length; i += itemsPerPage) {
        const pageItems = loadInviteData.slice(i, i + itemsPerPage);
        let pageContent = "";

        for (const item of pageItems) {
          try {
            let inviterName = "Unknown User";

            // Try to fetch the inviter's username
            try {
              const inviter = await message.client.users.fetch(item.inviterId);
              inviterName = inviter.username || inviter.tag || "Unknown User";
            } catch (fetchError) {
              console.error(
                `Could not fetch user ${item.inviterId}: ${fetchError.message}`
              );
              // Use default inviterName
            }

            pageContent += `• **${inviterName}** invited **${item.invitedUser}** (${item.timestamp}) with code: ${item.inviteCode}\n`;
          } catch (inviteError) {
            console.error(
              `Error processing invite entry: ${inviteError.message}`
            );
            pageContent += `• **Error processing invite entry**\n`;
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
          text: `Page 1/${pages.length} • Total: ${loadInviteData.length} invites`,
        });

      await message.reply({ embeds: [allInvitesEmbed] });
    } catch (error) {
      console.error(`Error in allinvites command: ${error.message}`);
      message.reply(
        "An error occurred while processing the allinvites command. Please try again later."
      );
    }
  },
};

// Enhanced command to create log channel for invites
export const createLogChannelConfig = {
  name: "createlogchannel",
  aliases: ["setupinvitelogs", "createinvitelog", "cti"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Validate message and guild
      if (!message || !message.guild) {
        console.error(
          "Invalid message or guild object in createlogchannel command"
        );
        return;
      }

      // Check if user has admin permission
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("You do not have permission to use this command.");
      }

      const channelName = "invite-logs";

      // Check if a channel with this name already exists
      const existingChannel = message.guild.channels.cache.find(
        (ch) => ch.name === channelName
      );

      if (existingChannel) {
        return message.reply(
          `Log channel <#${existingChannel.id}> already exists.`
        );
      }

      // Create the log channel with proper permissions
      try {
        const newChannel = await message.guild.channels.create({
          name: channelName,
          type: 0, // 0 = GUILD_TEXT
          permissionOverwrites: [
            {
              id: message.guild.id, // @everyone
              deny: [PermissionFlagsBits.SendMessages], // Prevent general users from sending messages
              allow: [PermissionFlagsBits.ViewChannel], // Allow everyone to view the channel
            },
            {
              id: message.client.user.id, // Bot user
              allow: [
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ViewChannel,
              ],
            },
          ],
          reason: "Created invite log channel by admin command.",
        });

        // Add creation notification embed to the new channel
        const setupEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("Invite Logging System Activated")
          .setDescription(
            "This channel has been set up to log all invite-related activities."
          )
          .addFields({
            name: "Features",
            value:
              "• Records who invited each new member\n• Tracks which invite codes are used\n• Keeps detailed timestamps of joins\n• Maintains invitation history",
            inline: false,
          })
          .setFooter({
            text: "All new member joins will now be logged automatically in this channel",
          })
          .setTimestamp();

        await newChannel.send({ embeds: [setupEmbed] });

        // Load existing invite data from the file to show history
        const inviteData = loadInviteData();
        const guildData = inviteData[message.guild.id] || {};

        // Show recent invite history if available
        const loadInviteData = [];
        for (const inviterId in guildData) {
          if (inviterId === "unknown") continue;

          const inviterData = guildData[inviterId];
          if (
            !inviterData.invitedUsers ||
            inviterData.invitedUsers.length === 0
          )
            continue;

          for (const invite of inviterData.invitedUsers) {
            loadInviteData.push({
              inviterId,
              inviteCode: invite.inviteCode,
              invitedUser: invite.username,
              timestamp: invite.timestampIST,
            });
          }
        }

        // // If we have past invite data, show the most recent ones
        // if (loadInviteData.length > 0) {
        //   // Sort by most recent first
        //   loadInviteData.sort(
        //     (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        //   );

        //   // Get the 10 most recent invites
        //   const recentInvites = loadInviteData.slice(0, 10);
        //   let recentInvitesContent = "";

        //   for (const item of recentInvites) {
        //     try {
        //       const inviter = await message.client.users.fetch(item.inviterId);
        //       recentInvitesContent += `• **${inviter.username}** invited **${item.invitedUser}** (${item.timestamp}) with code: ${item.inviteCode}\n`;
        //     } catch (err) {
        //       recentInvitesContent += `• **Unknown User** invited **${item.invitedUser}** (${item.timestamp}) with code: ${item.inviteCode}\n`;
        //     }
        //   }

        //   if (recentInvitesContent) {
        //     const historyEmbed = new EmbedBuilder()
        //       .setColor("#3498DB")
        //       .setTitle("Recent Invite History")
        //       .setDescription(recentInvitesContent)
        //       .setFooter({
        //         text: `Showing ${Math.min(
        //           10,
        //           loadInviteData.length
        //         )} most recent invites out of ${loadInviteData.length} total`,
        //       });

        //     await newChannel.send({ embeds: [historyEmbed] });
        //   }
        // }

        message.reply(
          `✅ Successfully created invite log channel: <#${newChannel.id}> and configured it for automatic logging!`
        );

        // Store the channel ID in environment variable or config
        // Note: In a real implementation, you'd want to persist this to a config file
        process.env.LOG_CHANNEL_ID = newChannel.id;
      } catch (err) {
        console.error("Error creating log channel:", err);
        message.reply("❌ There was an error while creating the log channel.");
      }
    } catch (error) {
      console.error(`Error in createlogchannel command: ${error.message}`);
      message.reply(
        "An error occurred while processing the command. Please try again later."
      );
    }
  },
};

// Command for viewing invite help
export const inviteHelpConfig = {
  name: "invitehelp",
  aliases: ["invitecommands", "helpinvite"],
  adminOnly: false,
  execute: async (message, args) => {
    try {
      // Validate message object
      if (!message) {
        console.error("Invalid message object in invitehelp command");
        return;
      }

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

      await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error(`Error in invitehelp command: ${error.message}`);
      if (message && message.channel) {
        message.reply(
          "An error occurred while displaying the help information. Please try again later."
        );
      }
    }
  },
};

// Initialize invite tracking system
export async function setupInviteTracker(client) {
  // When bot is ready, cache all guild invites
  client.on(Events.ClientReady, async () => {
    try {
      // For each guild the bot is in, cache its invites
      for (const guild of client.guilds.cache.values()) {
        // Fetch all guild invites
        const invites = await guild.invites.fetch();
        // Store the invites for each guild
        guildInvites.set(
          guild.id,
          new Collection(invites.map((invite) => [invite.code, invite]))
        );
      }
      console.log("Invite tracking system initialized!");
    } catch (err) {
      console.error("Error setting up invite tracker:", err);
    }
  });

  // Update cache when new invites are created
  client.on(Events.InviteCreate, async (invite) => {
    try {
      // Add new invite to the cache
      const guildInviteCache =
        guildInvites.get(invite.guild.id) || new Collection();
      guildInviteCache.set(invite.code, invite);
      guildInvites.set(invite.guild.id, guildInviteCache);
    } catch (err) {
      console.error("Error handling invite create event:", err);
    }
  });

  // Update cache when invites are deleted
  client.on(Events.InviteDelete, (invite) => {
    try {
      // Remove the invite from the cache
      const guildInviteCache = guildInvites.get(invite.guild.id);
      if (guildInviteCache) {
        guildInviteCache.delete(invite.code);
      }
    } catch (err) {
      console.error("Error handling invite delete event:", err);
    }
  });

  // Track invites when new members join
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      // Validate member object
      if (!member || !member.guild) {
        console.error("Invalid member or guild object in GuildMemberAdd event");
        return;
      }

      // Skip bots
      if (member.user.bot) {
        console.log(`Bot ${member.user.tag} joined, skipping invite tracking`);
        return;
      }

      console.log(
        `Member joined: ${member.user.tag} (${member.id}) in guild: ${member.guild.name} (${member.guild.id})`
      );

      // Load or initialize invite data for this guild
      const inviteData = loadInviteData();
      if (!inviteData[member.guild.id]) {
        inviteData[member.guild.id] = {};
        console.log(`Initialized invite data for guild: ${member.guild.name}`);
      }

      // Get cached invites and fetch current invites
      const cachedInvites =
        guildInvites.get(member.guild.id) || new Collection();
      let currentInvites;
      try {
        currentInvites = await member.guild.invites.fetch();
        console.log(
          `Fetched ${currentInvites.size} current invites for guild: ${member.guild.name}`
        );
      } catch (inviteError) {
        console.error(
          `Error fetching invites for guild ${member.guild.id}: ${inviteError.message}`
        );
        currentInvites = new Collection();
      }

      // Find which invite was used
      let usedInvite = null;
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);
        if (cachedInvite && invite.uses > cachedInvite.uses) {
          usedInvite = invite;
          console.log(`Found used invite: ${code} with ${invite.uses} uses`);
          break;
        }
      }

      // Update the cached invites
      guildInvites.set(
        member.guild.id,
        new Collection(currentInvites.map((invite) => [invite.code, invite]))
      );

      // Get timestamp in IST
      const timestamp = new Date();
      let timestampIST;
      try {
        timestampIST = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
        }).format(timestamp);
      } catch (dateError) {
        console.error(`Error formatting date: ${dateError.message}`);
        timestampIST = timestamp.toISOString();
      }

      // Get member information safely
      const simulatedMemberName = member.user.username || "Unknown User";
      const simulatedMemberId = member.user.id;
      let simulatedMemberAvatar;
      try {
        simulatedMemberAvatar = member.user.displayAvatarURL({ dynamic: true });
      } catch (avatarError) {
        console.error(`Error getting avatar URL: ${avatarError.message}`);
        simulatedMemberAvatar = null;
      }
      const memberMention = `<@${simulatedMemberId}>`;

      let inviteEmbed;

      // Create appropriate embed based on invite information
      if (!usedInvite && member.guild.vanityURLCode) {
        // Vanity URL embed
        inviteEmbed = new EmbedBuilder()
          .setColor("#3498DB")
          .setTitle("New Member Joined")
          .setDescription(`${memberMention} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Joined using the server's vanity URL",
              inline: false,
            },
            { name: "Date & Time", value: timestampIST, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: `Member ID: ${simulatedMemberId}` });

        // Add thumbnail if avatar URL is available
        if (simulatedMemberAvatar) {
          inviteEmbed.setThumbnail(simulatedMemberAvatar);
        }
      } else if (!usedInvite) {
        // Unknown invite embed
        inviteEmbed = new EmbedBuilder()
          .setColor("#E74C3C")
          .setTitle("New Member Joined")
          .setDescription(`${memberMention} joined the server`)
          .addFields(
            {
              name: "Invite Info",
              value: "Could not determine which invite was used",
              inline: false,
            },
            { name: "Date & Time", value: timestampIST, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: `Member ID: ${simulatedMemberId}` });

        // Add thumbnail if avatar URL is available
        if (simulatedMemberAvatar) {
          inviteEmbed.setThumbnail(simulatedMemberAvatar);
        }
      } else {
        // Regular invite embed with inviter information
        try {
          const inviter = usedInvite.inviter;
          if (!inviter) {
            throw new Error("Inviter information not available");
          }

          const inviterUsername = inviter.username || "Unknown User";
          const inviterId = inviter.id;
          const simulatedInviteCount = usedInvite.uses || 0;
          let inviterAvatarURL;

          try {
            inviterAvatarURL = inviter.displayAvatarURL({ dynamic: true });
          } catch (inviterAvatarError) {
            console.error(
              `Error getting inviter avatar: ${inviterAvatarError.message}`
            );
            inviterAvatarURL = null;
          }

          inviteEmbed = new EmbedBuilder()
            .setColor("#2ECC71")
            .setTitle("New Member Joined")
            .setDescription(
              `${memberMention} was invited by ${inviterUsername}`
            )
            .addFields(
              {
                name: "Member",
                value: `${simulatedMemberName} \n (<@${simulatedMemberId}>)`,
                inline: true,
              },
              {
                name: "Invited By",
                value: `${inviterUsername} \n (<@${inviterId}>)`,
                inline: true,
              },
              { name: "Invite Code", value: usedInvite.code, inline: true },
              { name: "Joined At", value: timestampIST, inline: true },
              {
                name: "Total Invites",
                value: `${simulatedInviteCount}`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: `Inviter ID: ${inviterId}`,
            });

          // Add thumbnails if avatar URLs are available
          if (simulatedMemberAvatar) {
            inviteEmbed.setThumbnail(simulatedMemberAvatar);
          }

          if (inviterAvatarURL) {
            inviteEmbed.setFooter({
              text: `Inviter ID: ${inviterId}`,
              iconURL: inviterAvatarURL,
            });
          }

          // Update invite data in our tracking system
          if (!inviteData[member.guild.id][inviterId]) {
            inviteData[member.guild.id][inviterId] = {
              inviteCount: 0,
              invitedUsers: [],
            };
          }

          // Increment invite count
          inviteData[member.guild.id][inviterId].inviteCount =
            (inviteData[member.guild.id][inviterId].inviteCount || 0) + 1;

          // Add to invited users list
          if (!inviteData[member.guild.id][inviterId].invitedUsers) {
            inviteData[member.guild.id][inviterId].invitedUsers = [];
          }

          inviteData[member.guild.id][inviterId].invitedUsers.push({
            userId: simulatedMemberId,
            username: simulatedMemberName,
            timestamp: timestamp.toISOString(),
            timestampIST: timestampIST,
            inviteCode: usedInvite.code,
          });

          // Save updated invite data
          saveInviteData(inviteData);
          console.log(
            `Updated invite data for inviter ${inviterUsername} (${inviterId})`
          );
        } catch (inviterError) {
          console.error(
            `Error processing inviter information: ${inviterError.message}`
          );

          // Fallback embed without inviter details
          inviteEmbed = new EmbedBuilder()
            .setColor("#F39C12")
            .setTitle("New Member Joined")
            .setDescription(`${memberMention} joined the server`)
            .addFields(
              {
                name: "Member",
                value: `${simulatedMemberName} \n (<@${simulatedMemberId}>)`,
                inline: true,
              },
              {
                name: "Invite Code",
                value: usedInvite.code || "Unknown",
                inline: true,
              },
              { name: "Joined At", value: timestampIST, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Member ID: ${simulatedMemberId}` });

          // Add thumbnail if avatar URL is available
          if (simulatedMemberAvatar) {
            inviteEmbed.setThumbnail(simulatedMemberAvatar);
          }
        }
      }

      // Send the embed to the log channel
      try {
        // Find the log channel
        const logChannel = member.guild.channels.cache.find(
          (ch) => ch.name === "invite-logs" || ch.name === "logs"
        );

        if (!logChannel) {
          console.log(
            `No invite log channel found in guild: ${member.guild.name}`
          );
          return;
        }

        if (!logChannel.isTextBased()) {
          console.error(
            `Log channel in guild ${member.guild.id} is not text-based`
          );
          return;
        }

        await logChannel.send({ embeds: [inviteEmbed] });
        console.log(
          `Sent invite log to channel: ${logChannel.name} (${logChannel.id})`
        );
      } catch (channelError) {
        console.error(`Error sending to log channel: ${channelError.message}`);
      }
    } catch (err) {
      console.error(`Error handling new member join: ${err.message}`);
    }
  });
}
