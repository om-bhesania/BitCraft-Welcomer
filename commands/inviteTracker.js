import { EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path for storing invite data
const INVITE_DATA_PATH = path.join(__dirname, "..", "invite-data.json");

// Store for invite tracking
const invitesCache = new Map();

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

// Initialize invite tracker
export function initInviteTracker(client) {
  // When the bot is ready, initialize invite cache
  client.on("ready", async () => {
    // Initialize the invite cache for all guilds
    for (const guild of client.guilds.cache.values()) {
      try {
        const guildInvites = await guild.invites.fetch();
        invitesCache.set(
          guild.id,
          new Map(
            guildInvites.map((invite) => [
              invite.code,
              { uses: invite.uses, inviter: invite.inviter?.id },
            ])
          )
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
        new Map(
          guildInvites.map((invite) => [
            invite.code,
            { uses: invite.uses, inviter: invite.inviter.id },
          ])
        )
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
      inviter: invite.inviter ? invite.inviter.id : null,
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
            const inviterId =
              cachedInviteData.inviter ||
              (invite.inviter ? invite.inviter.id : null);
            if (inviterId) {
              inviter = await client.users.fetch(inviterId);
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

      // Second approach: If we couldn't find the invite, check for any new invites
      if (!usedInvite) {
        for (const invite of newInvites.values()) {
          // If this invite doesn't exist in our cache or is a vanity URL, skip
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

      // Third approach: If we still couldn't find the invite, look for vanity URL
      if (!usedInvite && guild.vanityURLCode) {
        try {
          const vanityData = await guild.fetchVanityData();
          if (vanityData) {
            usedInvite = {
              code: "vanity",
              uses: vanityData.uses,
            };
          }
        } catch (err) {
          console.error(
            `Error fetching vanity URL data for guild ${guild.name}:`,
            err
          );
        }
      }

      // Update the cache with the new invite counts
      invitesCache.set(
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
              {
                name: "Invited by",
                value: `${inviter.username}`,
                inline: true,
              },
              {
                name: "Invite Code",
                value: `${usedInvite.code}`,
                inline: true,
              },
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
      } else if (usedInvite && usedInvite.code === "vanity") {
        // If the user joined using the vanity URL
        console.log(
          `${member.user.username} joined using the server's vanity URL`
        );

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
        inviteData[guild.id][unknownInviterId] = inviteData[guild.id][
          unknownInviterId
        ] || {
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
}
