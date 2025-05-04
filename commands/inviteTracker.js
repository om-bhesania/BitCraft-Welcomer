import {
    EmbedBuilder,
    PermissionFlagsBits
} from "discord.js";
import fs from "fs";
import path from "path";

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
        new Map(guildInvites.map((invite) => [invite.code, invite.uses]))
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
      new Map(guildInvites.map((invite) => [invite.code, invite.uses]))
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
  guildInvites.set(invite.code, invite.uses);
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

    // Fetch the new invite counts
    const newInvites = await guild.invites.fetch();

    // Find the invite that was used
    let usedInvite = null;
    let inviter = null;

    for (const [code, uses] of newInvites) {
      // Get the cached invite count
      const cachedUses = cachedInvites.get(code) || 0;

      // If this invite has one more use than before, it's the one that was used
      if (uses > cachedUses) {
        usedInvite = newInvites.get(code);
        inviter = usedInvite.inviter;
        break;
      }
    }

    // Update the cache with the new invite counts
    invitesCache.set(
      guild.id,
      new Map(newInvites.map((invite) => [invite.code, invite.uses]))
    );

    // Load saved invite data
    const inviteData = loadInviteData();

    // Prepare guild data
    if (!inviteData[guild.id]) {
      inviteData[guild.id] = {};
    }

    // Find the log channel
    const logChannel = guild.channels.cache.find(
      (channel) =>
        channel.name === config.logChannelName && channel.isTextBased()
    );

    // If we found an invite that was used
    if (usedInvite && inviter) {
      const inviterId = inviter.id;

      // Initialize inviter data if needed
      if (!inviteData[guild.id][inviterId]) {
        inviteData[guild.id][inviterId] = {
          inviteCount: 0,
          invitedUsers: [],
        };
      }

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
    } else {
      // If we couldn't determine the invite used
      console.log(
        `${member.user.username} joined but the invite used couldn't be determined`
      );

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
          const inviter = await client.users.fetch(inviterId);
          const inviterData = guildData[inviterId];
          description += `**${inviter.username}**: ${inviterData.inviteCount} invite(s)\n`;
          count++;
        } catch (err) {
          console.error(`Could not fetch user ${inviterId}:`, err);
          description += `**Unknown User**: ${guildData[inviterId].inviteCount} invite(s)\n`;
          count++;
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
});

