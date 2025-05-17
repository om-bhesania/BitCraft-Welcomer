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
const INVITE_DATA_PATH = path.join(__dirname, "..", "invite-data.json");

// Global collection to track guild invites
const guildInvites = new Map();

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
  aliases: ["myinvites", "inviter", "uit"],
  adminOnly: true,
  execute: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("You do not have permission to use this command.");
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
          m.displayName.toLowerCase() === search
      );

      if (memberFromCache) {
        target = memberFromCache.user;
      } else {
        // Try to fetch user from guild if not in cache
        try {
          const memberFromFetch = await message.guild.members.fetch(search);
          if (memberFromFetch) {
            target = memberFromFetch.user;
          }
        } catch (err) {
          // Ignore fetch error (likely user not found)
        }
      }
    }

    if (!target) {
      target = message.author;
    }

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
      const inviteDetails = invitedUsers
        .map(
          (invite) =>
            `• ${invite.username} (joined: ${invite.timestampIST}) using code: ${invite.inviteCode}`
        )
        .join("\n");

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

// Enhanced command to create log channel for invites
export const createLogChannelConfig = {
  aliases: ["setupinvitelogs", "createinvitelog","cti"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if user has admin permission
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("You do not have permission to use this command.");
    }

    const channelName = "invite-logs";
    const channelId = "1373272863355965472";

    // Check if a channel with this name already exists
    const existingChannel = message.guild.channels.cache.find(
      (ch) => ch.id === channelId
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
        .addFields(
          {
            name: "Features",
            value:
              "• Records who invited each new member\n• Tracks which invite codes are used\n• Keeps detailed timestamps of joins\n• Maintains invitation history",
            inline: false,
          },
        )
        .setFooter({
          text: "All new member joins will now be logged automatically in this channel",
        })
        .setTimestamp();

      await newChannel.send({ embeds: [setupEmbed] });

      // Load existing invite data from the file to show history
      const inviteData = loadInviteData();
      const guildData = inviteData[message.guild.id] || {};

      // Show recent invite history if available
      const allInviteData = [];
      for (const inviterId in guildData) {
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

      // // If we have past invite data, show the most recent ones
      // if (allInviteData.length > 0) {
      //   // Sort by most recent first
      //   allInviteData.sort(
      //     (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      //   );

      //   // Get the 10 most recent invites
      //   const recentInvites = allInviteData.slice(0, 10);
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
      //           allInviteData.length
      //         )} most recent invites out of ${allInviteData.length} total`,
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
      // Skip bots
      if (member.user.bot) return;

      // Get the invite data
      const inviteData = loadInviteData();
      if (!inviteData[member.guild.id]) {
        inviteData[member.guild.id] = {};
      }
      const guildData = inviteData[member.guild.id];

      // Get the cached invites
      const cachedInvites =
        guildInvites.get(member.guild.id) || new Collection();

      // Get the current invites
      const currentInvites = await member.guild.invites.fetch();

      // Find the invite that was used
      let usedInvite = null;
      // Compare the current invites with the cached ones to find which one was used
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);
        if (cachedInvite && invite.uses > cachedInvite.uses) {
          usedInvite = invite;
          break;
        }
      }

      // Update the cache with the new invites
      guildInvites.set(
        member.guild.id,
        new Collection(currentInvites.map((invite) => [invite.code, invite]))
      );

      // Create invite log data
      let inviterId = "unknown";
      let inviterUsername = "Unknown";
      let inviteCode = "unknown";

      if (usedInvite && usedInvite.inviter) {
        inviterId = usedInvite.inviter.id;
        inviterUsername = usedInvite.inviter.username;
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

      // Initialize inviter data if not exists
      if (!guildData[inviterId]) {
        guildData[inviterId] = {
          inviteCount: 0,
          invitedUsers: [],
        };
      }

      // Update inviter data
      guildData[inviterId].inviteCount += 1;

      // Record the invited user
      const timestamp = new Date();
      const timestampIST = convertToIST(timestamp);

      guildData[inviterId].invitedUsers.push({
        id: member.id,
        username: member.user.username,
        inviteCode: inviteCode,
        timestamp: timestamp.toISOString(),
        timestampIST: timestampIST,
      });

      // Save the updated invite data
      saveInviteData(inviteData);

      // Find the invite-logs channel
      const logChannel =
        member.guild.channels.cache.find(
          (ch) => ch.id === "1373272863355965472"
        ) || member.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

      if (!logChannel) return;

      // Create and send embed to log channel based on invite type
      let inviteEmbed;

      if (inviteCode === "vanity") {
        // Vanity URL embed
        inviteEmbed = new EmbedBuilder()
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
          .setTimestamp()
          .setFooter({
            text: `Member ID: ${member.id}`,
          });
      } else if (inviteCode === "unknown") {
        // Unknown invite embed
        inviteEmbed = new EmbedBuilder()
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
          .setTimestamp()
          .setFooter({
            text: `Member ID: ${member.id}`,
          });
      } else {
        // Normal invite embed with full details and both avatars
        inviteEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("New Member Joined")
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`${member.user} was invited by ${inviterUsername}`)
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
            {
              name: "Invite Code",
              value: inviteCode,
              inline: true,
            },
            {
              name: "Joined At",
              value: timestampIST,
              inline: true,
            },
            {
              name: "Total Invites",
              value: `${guildData[inviterId].inviteCount}`,
              inline: true,
            }
          )
          .setTimestamp()
          .setImage(
            client.users.cache
              .get(inviterId)
              ?.displayAvatarURL({ dynamic: true })
          )
          .setFooter({
            text: `Inviter ID: ${inviterId}`,
            iconURL: client.users.cache
              .get(inviterId)
              ?.displayAvatarURL({ dynamic: true }),
          });
      }

      // Send the embed to the log channel
      await logChannel.send({ embeds: [inviteEmbed] });
    } catch (err) {
      console.error("Error handling member join event:", err);
    }
  });
}
