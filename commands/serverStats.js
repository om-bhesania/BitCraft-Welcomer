import mcstatus from "node-mcstatus";
import { ActivityType, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { Client } from "discord.js";
import { configDotenv } from "dotenv";

// Load environment variables from .env file
configDotenv();

// Cache for server data to avoid too many requests
let serverCache = {
  status: false,
  players: { online: 0, max: 0 },
  playerList: [],
  tps: 0,
  memUsage: 0,
  lastUpdate: 0,
};

// Configuration for the status channels
const STATUS_CONFIG = {
  updateInterval: 10000, // 10 seconds
  statusChannelId: "1368861071040974848", // <- actual voice/text channel ID
  statusChannelNames: {
    online: "🟢 Online",
    offline: "🔴 Offline",
  },
  playerCountChannelId: "1368861075889590356",
  playerCountFormat: "👥 Players: {online}/{max}",
  performanceChannelId: "1368861078523482185",
  performanceFormat: "⚙️ TPS: {tps} | RAM: {ram}%",
  serverIp: "play.bitcraftnetwork.fun",
  serverPort: "25571",
};

// Function to fetch server data
async function fetchServerData() {
  //   console.log("Running update... ⏱ Updating server stats...");
  try {
    const result = await mcstatus.statusJava(
      STATUS_CONFIG.serverIp,
      STATUS_CONFIG.serverPort
    );
    // console.log("===============>", result);
    let tps = 20.0;
    let memUsage = 0;
    const motdText = result.description
      ? typeof result.description === "string"
        ? result.description
        : result.description.text ||
          result.description.extra?.map((e) => e.text).join("") ||
          ""
      : "";

    if (motdText.includes("TPS:")) {
      const tpsMatch = motdText.match(/TPS:\s*([\d.]+)/);
      if (tpsMatch && tpsMatch[1]) {
        tps = parseFloat(tpsMatch[1]);
      }
    }

    if (motdText.includes("RAM:")) {
      const ramMatch = motdText.match(/RAM:\s*([\d.]+)/);
      if (ramMatch && ramMatch[1]) {
        memUsage = parseFloat(ramMatch[1]);
      }
    }

    let playerList = [];
    if (result?.players?.sample && Array.isArray(result?.players?.sample)) {
      playerList = result?.players?.sample.map((p) => p?.name);
    }
    serverCache = {
      status: true,
      players: {
        online: result.players.online,
        max: result.players.max,
      },
      playerList: playerList,
      tps: tps,
      memUsage: memUsage,
      lastUpdate: Date.now(),
    };
    return serverCache;
  } catch (error) {
    console.error("Failed to fetch server data:", error);

    serverCache = {
      status: false,
      players: { online: 0, max: 0 },
      playerList: [],
      tps: 0,
      memUsage: 0,
      lastUpdate: Date.now(),
    };
    return serverCache;
  }
}

// Create a rich embed for server status
function createStatusEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(
      `${serverCache.status ? "🟢" : "🔴"} Server Status: ${
        serverCache.status ? "Online" : "Offline"
      }`
    )
    .setColor(serverCache.status ? "#00ff00" : "#ff0000")
    .setDescription(`Information about **${STATUS_CONFIG.serverAddress}**`)
    .setTimestamp()
    .setFooter({ text: "Last updated" });

  if (serverCache.status) {
    embed.addFields(
      {
        name: "👥 Players",
        value: `${serverCache.players.online}/${serverCache.players.max}`,
        inline: true,
      },
      {
        name: "⚡ TPS",
        value: `${serverCache.tps.toFixed(1)}/20.0`,
        inline: true,
      },
      {
        name: "💾 Memory",
        value: `${serverCache.memUsage.toFixed(1)} GB`,
        inline: true,
      }
    );

    if (serverCache.playerList.length > 0) {
      embed.addFields({
        name: "Online Players",
        value: serverCache.playerList.join(", "),
      });
    }
  }

  return embed;
}

export const serverStatusConfig = {
  aliases: ["status", "server"],
  execute: async (message, args) => {
    // Get fresh data
    await fetchServerData();

    const embed = createStatusEmbed();
    return message.reply({ embeds: [embed] });
  },
};

export const playersConfig = {
  aliases: ["online", "who"],
  execute: async (message, args) => {
    // Get fresh data
    await fetchServerData();

    const embed = new EmbedBuilder()
      .setTitle(`${serverCache.status ? "👥" : "🔴"} Online Players`)
      .setColor(serverCache.status ? "#3498db" : "#ff0000")
      .setTimestamp()
      .setFooter({ text: `Server: ${STATUS_CONFIG.serverAddress}` });

    if (serverCache.status) {
      embed.setDescription(
        `**Player Count:** ${serverCache.players.online}/${serverCache.players.max}\n\n` +
          (serverCache.playerList.length > 0
            ? `**Online Players:**\n${serverCache.playerList.join(", ")}`
            : "No players are currently online.")
      );
    } else {
      embed.setDescription("The server is currently offline.");
    }

    return message.reply({ embeds: [embed] });
  },
};

export const performanceConfig = {
  aliases: ["perf", "tps", "lag"],
  execute: async (message, args) => {
    // Get fresh data
    await fetchServerData();

    const embed = new EmbedBuilder()
      .setTitle(`${serverCache.status ? "⚡" : "🔴"} Server Performance`)
      .setColor(serverCache.status ? "#f39c12" : "#ff0000")
      .setTimestamp()
      .setFooter({ text: `Server: ${STATUS_CONFIG.serverAddress}` });

    if (serverCache.status) {
      // Determine performance status
      let tpsStatus = "❌ Poor";
      let tpsColor = "#e74c3c";

      if (serverCache.tps >= 18) {
        tpsStatus = "✅ Excellent";
        tpsColor = "#2ecc71";
      } else if (serverCache.tps >= 15) {
        tpsStatus = "⚠️ Good";
        tpsColor = "#f39c12";
      }

      embed.setColor(tpsColor);
      embed.addFields(
        {
          name: "TPS (Ticks Per Second)",
          value: `${serverCache.tps.toFixed(1)}/20.0`,
          inline: true,
        },
        {
          name: "Memory Usage",
          value: `${serverCache.memUsage.toFixed(1)} GB`,
          inline: true,
        },
        { name: "Status", value: tpsStatus, inline: true }
      );
    } else {
      embed.setDescription("The server is currently offline.");
    }

    return message.reply({ embeds: [embed] });
  },
};

export const setupStatusChannelsConfig = {
  aliases: ["setupstatus", "createstatus"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Create embed for response
      const embed = new EmbedBuilder()
        .setTitle("📊 Server Status Channels")
        .setColor("#3498db")
        .setTimestamp();

      // Create category for status channels
      const statusCategory = await message.guild.channels.create({
        name: "📊 Server Status",
        type: 4, // CategoryChannel type
      });

      // Create status channels
      const statusChannel = await message.guild.channels.create({
        name: STATUS_CONFIG.statusChannelNames.offline,
        type: 2, // VoiceChannel type
        parent: statusCategory.id,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      const playerCountChannel = await message.guild.channels.create({
        name: STATUS_CONFIG.playerCountFormat
          .replace("{online}", "0")
          .replace("{max}", "0"),
        type: 2, // VoiceChannel type
        parent: statusCategory.id,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      const performanceChannel = await message.guild.channels.create({
        name: STATUS_CONFIG.performanceFormat
          .replace("{tps}", "0")
          .replace("{ram}", "0"),
        type: 2, // VoiceChannel type
        parent: statusCategory.id,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      // Update config with new channel IDs
      STATUS_CONFIG.statusChannelId = statusChannel.id;
      STATUS_CONFIG.playerCountChannelId = playerCountChannel.id;
      STATUS_CONFIG.performanceChannelId = performanceChannel.id;

      // Perform initial update
      await fetchServerData();
      await updateStatusChannels(message.client);

      embed.setDescription(
        `✅ Status channels created successfully!\n\n` +
          `The following voice channels have been created:\n` +
          `• ${statusChannel.name}\n` +
          `• ${playerCountChannel.name}\n` +
          `• ${performanceChannel.name}\n\n` +
          `The channels will update automatically every ${
            STATUS_CONFIG.updateInterval / 60000
          } minutes.`
      );

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error setting up status channels:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Setup Failed")
        .setColor("#e74c3c")
        .setDescription(`Failed to create status channels: ${error.message}`)
        .setTimestamp();

      return message.reply({ embeds: [errorEmbed] });
    }
  },
};

// Enhanced dynamic channels setup configuration
export const enhancedDynamicChannelsConfig = {
  aliases: ["setupstatchannels", "statschannels"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Create a category for server stats
      const statsCategory = await message.guild.channels.create({
        name: "🖥️ Server Statistics",
        type: 4, // CategoryChannel type
      });

      // Create individual channels for different stats
      const statusChannel = await message.guild.channels.create({
        name: "❓ server-status",
        type: 2, // Voice channel type
        parent: statsCategory.id,
        topic: "", // Server online/offline status
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      const playerCountChannel = await message.guild.channels.create({
        name: "❓ player-count",
        type: 2, // Voice channel type
        parent: statsCategory.id,
        topic: "", // Current player count
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      const tpsChannel = await message.guild.channels.create({
        name: "❓ server-tps",
        type: 2, // Voice channel type
        parent: statsCategory.id,
        topic: "", // Server TPS (Ticks Per Second)
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      const memoryChannel = await message.guild.channels.create({
        name: "❓ memory-usage",
        type: 2, // Voice channel type
        parent: statsCategory.id,
        topic: "", // Server memory usage
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: ["Connect"], // Prevent users from joining
          },
        ],
      });

      // Store all channel IDs
      const dynamicChannels = {
        status: statusChannel.id,
        playerCount: playerCountChannel.id,
        tps: tpsChannel.id,
        memory: memoryChannel.id,
      };

      // Add this to the global status config
      STATUS_CONFIG.dynamicChannels = dynamicChannels;

      // Initial update
      await fetchServerData();
      await updateDynamicChannels(message.client);

      const embed = new EmbedBuilder()
        .setTitle("📊 Server Statistics Channels")
        .setColor("#2ecc71")
        .setDescription(
          `✅ Server stats channels created successfully!\n\n` +
            `The following channels will update automatically:\n` +
            `• <#${statusChannel.id}> - Server Status\n` +
            `• <#${playerCountChannel.id}> - Player Count\n` +
            `• <#${tpsChannel.id}> - Server TPS\n` +
            `• <#${memoryChannel.id}> - Memory Usage\n\n` +
            `Updates will occur every ${
              STATUS_CONFIG.updateInterval / 60000
            } minutes.`
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error setting up dynamic stat channels:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Setup Failed")
        .setColor("#e74c3c")
        .setDescription(
          `Failed to create server stat channels: ${error.message}`
        )
        .setTimestamp();

      return message.reply({ embeds: [errorEmbed] });
    }
  },
};

// New function to update all dynamic channels
async function updateDynamicChannels(client) {
  try {
    // Check if we have dynamic channels configured
    if (!STATUS_CONFIG.dynamicChannels) {
      return; // No dynamic channels set up
    }

    // Get fresh data if needed
    if (Date.now() - serverCache.lastUpdate > 60000) {
      await fetchServerData();
    }

    // Get all channels
    const statusChannel = client.channels.cache.get(
      STATUS_CONFIG.dynamicChannels.status
    );
    const playerCountChannel = client.channels.cache.get(
      STATUS_CONFIG.dynamicChannels.playerCount
    );
    const tpsChannel = client.channels.cache.get(
      STATUS_CONFIG.dynamicChannels.tps
    );
    const memoryChannel = client.channels.cache.get(
      STATUS_CONFIG.dynamicChannels.memory
    );

    // Update server status channel
    if (statusChannel) {
      const statusName = serverCache.status
        ? "🟢 server-status: Online"
        : "🔴 server-status: Offline";

      if (statusChannel.name !== statusName) {
        await statusChannel.setName(statusName);
      }
    }

    // Update player count channel
    if (playerCountChannel && serverCache.status) {
      const playerCountName = `👥 players: ${serverCache.players.online}/${serverCache.players.max}`;

      if (playerCountChannel.name !== playerCountName) {
        await playerCountChannel.setName(playerCountName);
      }
    } else if (playerCountChannel) {
      const offlineName = "👥 players: Offline";

      if (playerCountChannel.name !== offlineName) {
        await playerCountChannel.setName(offlineName);
      }
    }

    // Update TPS channel
    if (tpsChannel && serverCache.status) {
      const tpsName = `⚡ tps: ${serverCache.tps.toFixed(1)}/20.0`;

      if (tpsChannel.name !== tpsName) {
        await tpsChannel.setName(tpsName);
      }
    } else if (tpsChannel) {
      const offlineName = "⚡ tps: Offline";

      if (tpsChannel.name !== offlineName) {
        await tpsChannel.setName(offlineName);
      }
    }

    // Update memory usage channel
    if (memoryChannel && serverCache.status) {
      const memName = `💾 ram: ${serverCache.memUsage.toFixed(1)}GB`;

      if (memoryChannel.name !== memName) {
        await memoryChannel.setName(memName);
      }
    } else if (memoryChannel) {
      const offlineName = "💾 ram: Offline";

      if (memoryChannel.name !== offlineName) {
        await memoryChannel.setName(offlineName);
      }
    }

    console.log(
      `Dynamic stat channels updated at ${new Date().toLocaleString()}`
    );
  } catch (error) {
    console.error("Error updating dynamic stat channels:", error);
  }
}

// Modify the existing updateStatusChannels function to include our new function
async function updateStatusChannels(client) {
  try {
    // Get fresh data if it's older than 1 minute
    if (Date.now() - serverCache.lastUpdate > 1000) {
      await fetchServerData();
    }

    // Get the channels
    const statusChannel = client.channels.cache.get(
      STATUS_CONFIG.statusChannelId
    );
    const playerCountChannel = client.channels.cache.get(
      STATUS_CONFIG.playerCountChannelId
    );
    const performanceChannel = client.channels.cache.get(
      STATUS_CONFIG.performanceChannelId
    );
    const dynamicTextChannel = client.channels.cache.get(
      STATUS_CONFIG.dynamicTextChannelId
    );

    // Update voice channels if they exist
    if (statusChannel && playerCountChannel && performanceChannel) {
      // Update status channel name
      const statusName = serverCache.status
        ? STATUS_CONFIG.statusChannelNames.online
        : STATUS_CONFIG.statusChannelNames.offline;

      const res = await statusChannel.setName(statusName);

      // Update player count channel
      const playerCountName = STATUS_CONFIG.playerCountFormat
        .replace("{online}", serverCache.players.online)
        .replace("{max}", serverCache.players.max);

      await playerCountChannel.setName(playerCountName);

      // Update performance channel
      const performanceName = STATUS_CONFIG.performanceFormat
        .replace("{tps}", serverCache.tps.toFixed(1))
        .replace("{ram}", serverCache.memUsage.toFixed(1));

      if (performanceChannel.name !== performanceName) {
        const rest = await performanceChannel.setName(performanceName);
        console.log("rest", rest);
      }
    }

    // Update dynamic text channel if it exists
    if (dynamicTextChannel) {
      try {
        // Create a dynamic status name
        let statusText = serverCache.status
          ? `🟢 BitCraft Network: ${serverCache.players.online}/${
              serverCache.players.max
            } players | TPS: ${serverCache.tps.toFixed(1)}`
          : "🔴 BitCraft Network: Offline";

        // Update the channel name

        await dynamicTextChannel.setName(statusText);
      } catch (error) {
        console.error("Error updating dynamic text channel:", error);
      }
    }

    // Update our new dynamic stat channels
    await updateDynamicChannels(client);

    // Update bot status/presence
    client.user.setActivity(`${serverCache.players.online} players online`, {
      type: ActivityType.Watching,
    });

    console.log(`Status channels updated at ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error("Error updating status channels:", error);
  }
}

// Modify the initialization function to include our updates

// Set existing channel as dynamic status channel
export const useDynamicChannelConfig = {
  aliases: ["usechannel", "trackthischannel"],
  adminOnly: true,
  execute: async (message, args) => {
    try {
      // Set current channel as the dynamic status channel
      STATUS_CONFIG.dynamicTextChannelId = message.channel.id;

      // Initial update
      await fetchServerData();
      await updateStatusChannels(message.client);

      const embed = new EmbedBuilder()
        .setTitle("📝 Dynamic Status Channel")
        .setColor("#2ecc71")
        .setDescription(
          `✅ This channel will now update its name with live server status!\n\n` +
            `Updates will occur every ${
              STATUS_CONFIG.updateInterval / 60000
            } minutes.`
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error setting dynamic channel:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Setup Failed")
        .setColor("#e74c3c")
        .setDescription(
          `Failed to set dynamic status channel: ${error.message}`
        )
        .setTimestamp();

      return message.reply({ embeds: [errorEmbed] });
    }
  },
};

export const setServerAddressConfig = {
  aliases: ["setserver", "changeserver"],
  adminOnly: true,
  execute: async (message, args) => {
    if (args.length < 1) {
      const usageEmbed = new EmbedBuilder()
        .setTitle("⚙️ Set Server Address")
        .setColor("#3498db")
        .setDescription(
          "Usage: `?setserver <server_address> [port]`\n" +
            "Example: `?setserver play.bitcraftnetwork.fun 25571`"
        );
      return message.reply({ embeds: [usageEmbed] });
    }

    const newAddress = args[0];
    const newPort = args.length >= 2 ? parseInt(args[1]) : 25571;

    if (isNaN(newPort) || newPort <= 0 || newPort > 65535) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Port")
        .setColor("#e74c3c")
        .setDescription("Port must be between 1 and 65535.");
      return message.reply({ embeds: [errorEmbed] });
    }

    // Update the configuration
    STATUS_CONFIG.serverAddress = newAddress;
    STATUS_CONFIG.serverPort = newPort;

    // Fetch new data immediately
    await fetchServerData();
    await updateStatusChannels(message.client);

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Server Address Updated")
      .setColor("#2ecc71")
      .setDescription(
        `✅ Now monitoring server: **${newAddress}:${newPort}**\n\n` +
          `Status: ${serverCache.status ? "🟢 Online" : "🔴 Offline"}`
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};

export const setUpdateIntervalConfig = {
  aliases: ["setinterval", "updatetime"],
  adminOnly: true,
  execute: async (message, args) => {
    if (args.length < 1) {
      const usageEmbed = new EmbedBuilder()
        .setTitle("⚙️ Set Update Interval")
        .setColor("#3498db")
        .setDescription(
          "Usage: `?setinterval <seconds>`\n" + "Example: `?setinterval 10`"
        );
      return message.reply({ embeds: [usageEmbed] });
    }

    const seconds = parseInt(args[0]);

    if (isNaN(seconds) || seconds <= 0) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Interval")
        .setColor("#e74c3c")
        .setDescription("Please provide a valid positive number of seconds.");
      return message.reply({ embeds: [errorEmbed] });
    }

    // Update the configuration
    STATUS_CONFIG.updateInterval = seconds * 1000;

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Update Interval Changed")
      .setColor("#2ecc71")
      .setDescription(
        `✅ Update interval set to **${seconds} second${
          seconds === 1 ? "" : "s"
        }**.\n\n` +
          `Status channels will now update every ${seconds} second${
            seconds === 1 ? "" : "s"
          }.`
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};

export const forceUpdateConfig = {
  aliases: ["updatestatus", "refresh"],
  adminOnly: true,
  execute: async (message, args) => {
    const loadingEmbed = new EmbedBuilder()
      .setTitle("🔄 Updating Server Status")
      .setColor("#3498db")
      .setDescription("Fetching latest server information, please wait...")
      .setTimestamp();

    const reply = await message.reply({ embeds: [loadingEmbed] });

    try {
      // Fetch new data immediately
      await fetchServerData();
      await updateStatusChannels(message.client);

      const embed = new EmbedBuilder()
        .setTitle("✅ Status Updated")
        .setColor("#2ecc71")
        .setDescription(
          `Server status updated successfully!\n\n` +
            `Status: ${serverCache.status ? "🟢 Online" : "🔴 Offline"}\n` +
            `Players: ${serverCache.players.online}/${serverCache.players.max}`
        )
        .setTimestamp();

      return reply.edit({ embeds: [embed] });
    } catch (error) {
      console.error("Error in force update:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Update Failed")
        .setColor("#e74c3c")
        .setDescription(`Failed to update status: ${error.message}`)
        .setTimestamp();

      return reply.edit({ embeds: [errorEmbed] });
    }
  },
};

// Initialize the status system
export function initServerStatus(client) {
  console.log("Initializing server status system...");

  // Initial update
  fetchServerData().then(() => updateStatusChannels(client));

  // Set interval for updates
  setInterval(() => {
    updateStatusChannels(client);
  }, STATUS_CONFIG.updateInterval);

  console.log(
    `Server status will update every ${
      STATUS_CONFIG.updateInterval / 60000
    } minutes`
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  setInterval(async () => {
    const serverStats = await fetchServerData();

    const guildStats = Object.entries(serverStats);
    for (const [guildId, guildData] of guildStats) {
      const guild = client.guilds.cache.get(guildData.id);
      if (!guild) continue;

      for (const statChannel of guildData.channels) {
        const channel = guild.channels.cache.get(statChannel.id);
        if (!channel || !channel.isVoiceBased()) continue; // voice channel stat names

        if (channel.name !== statChannel.name) {
          try {
            await channel.setName(statChannel.name);
            console.log(`Updated ${channel.id} to ${statChannel.name}`);
          } catch (err) {
            console.error(`Failed to update ${channel.name}:`, err);
          }
        }
      }
    }
  }, 10000); // update every minute
});

client.login(process.env.BOT_TOKEN);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  // start interval here
});
setInterval(async () => {
  //   console.log("Running update..."); // <-- this should show every 10s
  // rest of your logic...
}, STATUS_CONFIG.updateInterval);

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!serverstats") {
    let countdown = 10;
    const guild = message.guild;

    const updateEmbed = () => {
      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(
        (m) => m.presence?.status !== "offline"
      ).size;
      const botCount = guild.members.cache.filter((m) => m.user.bot).size;
      const channelCount = guild.channels.cache.size;
      const serverName = guild.name;
      const creationDate = `<t:${Math.floor(
        guild.createdAt.getTime() / 1000
      )}:F>`;

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle("📊 Server Statistics")
        .addFields(
          { name: "🧑‍🤝‍🧑 Total Members", value: `${totalMembers}`, inline: true },
          {
            name: "🟢 Online Members",
            value: `${onlineMembers}`,
            inline: true,
          },
          { name: "🤖 Bot Count", value: `${botCount}`, inline: true },
          { name: "💬 Channels", value: `${channelCount}`, inline: true },
          { name: "🏷️ Server Name", value: `${serverName}`, inline: true },
          { name: "📅 Created On", value: `${creationDate}`, inline: true }
        )
        .setFooter({ text: `Updating in ${countdown}s...` })
        .setTimestamp();

      return embed;
    };

    const sentMessage = await message.channel.send({ embeds: [updateEmbed()] });

    const interval = setInterval(async () => {
      countdown--;
      if (countdown <= 0) countdown = 10;

      const embed = updateEmbed();
      embed.setFooter({ text: `Updating in ${countdown}s...` });

      try {
        await sentMessage.edit({ embeds: [embed] });
      } catch (err) {
        console.error("Failed to update embed:", err);
        clearInterval(interval);
      }
    }, 1000);
  }
});

const getServerData = async () => {
  //   console.log("Running update... ⏱ Updating server stats...");
  try {
    const result = await mcstatus.statusJava(
      STATUS_CONFIG.serverIp,
      STATUS_CONFIG.serverPort
    );
    // console.log("===============>", result);
    let tps = 20.0;
    let memUsage = 0;
    const motdText = result.description
      ? typeof result.description === "string"
        ? result.description
        : result.description.text ||
          result.description.extra?.map((e) => e.text).join("") ||
          ""
      : "";

    if (motdText.includes("TPS:")) {
      const tpsMatch = motdText.match(/TPS:\s*([\d.]+)/);
      if (tpsMatch && tpsMatch[1]) {
        tps = parseFloat(tpsMatch[1]);
      }
    }

    if (motdText.includes("RAM:")) {
      const ramMatch = motdText.match(/RAM:\s*([\d.]+)/);
      if (ramMatch && ramMatch[1]) {
        memUsage = parseFloat(ramMatch[1]);
      }
    }

    let playerList = [];
    if (result?.players?.sample && Array.isArray(result?.players?.sample)) {
      playerList = result?.players?.sample.map((p) => p?.name);
    }
    serverCache = {
      status: true,
      players: {
        online: result.players.online,
        max: result.players.max,
      },
      playerList: playerList,
      tps: tps,
      memUsage: memUsage,
      lastUpdate: Date.now(),
    };
    return serverCache;
  } catch (error) {
    console.error("Failed to fetch server data:", error);

    serverCache = {
      status: false,
      players: { online: 0, max: 0 },
      playerList: [],
      tps: 0,
      memUsage: 0,
      lastUpdate: Date.now(),
    };
    return serverCache;
  }
};

// Store status information in a module-level object to persist between calls
const statusConfig = {
  messageId: null,
  lastUpdate: 0,
  serverData: {
    host: "unknown",
    port: "unknown",
    status: false,
    players: { online: 0, max: 0 },
    tps: 0,
    memUsage: 0,
  },
};

// Global interval reference
let statusInterval = null;
export const result = await mcstatus.statusJava(
  STATUS_CONFIG.serverIp,
  STATUS_CONFIG.serverPort
);
export const status = {
  aliases: ["serverstats", "status"],
  adminOnly: false,

  execute: async (message, args) => {
    // Get the specific channel to send the status to
    const targetChannel = message.client.channels.cache.get(
      "1369022307464380628"
    );

    if (!targetChannel) {
      console.error("Could not find target channel");
      return;
    }
    console.log("result=====>", result);

    // Create initial embed with any existing data we might have
    const statusEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`Bitcraft Networks Stats`)
      .setDescription(
        `**Panel Status**\nStatus: ${
          result.online ? "🟢 Online" : "🔴 Offline"
        }`
      )
      .setThumbnail("https://i.imgur.com/OMqZfgz.png")
      .addFields(
        {
          name: "Users",
          value: `${result.players.online}/${result.players.max}`,
          inline: true,
        },
        {
          name: "Tps",
          value: `${statusConfig.serverData.tps}`,
          inline: true,
        },
        {
          name: "Memory",
          value: `${statusConfig.serverData.memUsage}%`,
          inline: true,
        }
      )
      .setFooter({
        text: `Updating in 10s... | Made With ❤️ by BitcraftNetworks`,
      })
      .setTimestamp();

    try {
      // Check if we already have a status message in the channel
      let statusMessage;

      // Try to fetch the existing message if we have an ID
      if (statusConfig.messageId) {
        try {
          statusMessage = await targetChannel.messages
            .fetch(statusConfig.messageId)
            .catch(() => null);
        } catch (err) {
          console.log("Previous status message not found, creating new one");
          statusMessage = null;
        }
      }

      // If no message found or error occurred, send a new one
      if (!statusMessage) {
        statusMessage = await targetChannel.send({ embeds: [statusEmbed] });
        statusConfig.messageId = statusMessage.id;
        console.log(
          `Created new status message with ID: ${statusConfig.messageId}`
        );
      } else {
        // Update existing message
        await statusMessage.edit({ embeds: [statusEmbed] });
        console.log(
          `Updated existing status message with ID: ${statusConfig.messageId}`
        );
      }

      // Function to update only the necessary data in the embed
      const updateStatusData = async () => {
        try {
          // Safety check - ensure the message still exists before updating
          let currentMsg;
          try {
            currentMsg = await targetChannel.messages.fetch(
              statusConfig.messageId
            );
          } catch (fetchErr) {
            // Message doesn't exist anymore, create a new one
            console.log("Status message no longer exists, creating new one");
            const newMsg = await targetChannel.send({ embeds: [statusEmbed] });
            statusConfig.messageId = newMsg.id;
            currentMsg = newMsg;
          }

          console.log("Fetching server data...");
          try {
            // Actually fetch the server data
            const newData = await fetchServerData();
            console.log("Server data received:", newData);

            // Update our stored data with the new data
            if (newData) {
              statusConfig.serverData = {
                host: newData.host || statusConfig.serverData.host,
                port: newData.port || statusConfig.serverData.port,
                status:
                  newData.status !== undefined
                    ? newData.status
                    : statusConfig.serverData.status,
                players: newData.players || statusConfig.serverData.players,
                tps: newData.tps || statusConfig.serverData.tps,
                memUsage: newData.memUsage || statusConfig.serverData.memUsage,
              };
            }
          } catch (dataErr) {
            console.error("Error fetching server data:", dataErr);
            // Keep using existing data, don't update
          }

          // Create a new embed with the latest data we have
          const updatedEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              `Bitcraft Networks Stats: ${statusConfig.serverData.host}:${statusConfig.serverData.port}`
            )
            .setDescription(
              `**Panel Status**\nStatus: ${
                statusConfig.serverData.status ? "🟢 Online" : "🔴 Offline"
              }`
            )
            .setThumbnail("https://i.imgur.com/OMqZfgz.png")
            .addFields(
              {
                name: "Users",
                value: `${statusConfig.serverData.players.online}/${statusConfig.serverData.players.max}`,
                inline: true,
              },
              {
                name: "Tps",
                value: `${statusConfig.serverData.tps}`,
                inline: true,
              },
            )
            .setFooter({
              text: `Updating in 10s... | Made With ❤️ by BitcraftNetworks`,
            })
            .setTimestamp();

          await currentMsg.edit({ embeds: [updatedEmbed] });
          statusConfig.lastUpdate = Date.now();
          console.log("Status message updated successfully");
        } catch (error) {
          console.error("Failed to update server stats:", error);
        }
      };

      // Update data initially
      updateStatusData();

      // Set up countdown timer - don't update too frequently to avoid rate limits
      const countdown = 10;
      let count = countdown;

      // Clear any existing interval first
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      // Set the new interval - use a 1 second interval for the countdown
      statusInterval = setInterval(async () => {
        count--;

        if (count <= 0) {
          // Reset counter and update data
          count = countdown;
          await updateStatusData(); // This will fetch new server data
        } else {
          try {
            // Just update the countdown timer, not the actual data
            let currentMsg;
            try {
              currentMsg = await targetChannel.messages.fetch(
                statusConfig.messageId
              );
              const currentEmbeds = currentMsg.embeds;

              if (currentEmbeds && currentEmbeds.length > 0) {
                const newEmbed = EmbedBuilder.from(currentEmbeds[0]).setFooter({
                  text: `Updating in ${count}s... | Made With ❤️ by BitcraftNetworks`,
                });

                await currentMsg.edit({ embeds: [newEmbed] });
              }
            } catch (editError) {
              if (editError.code === 10008) {
                console.log(
                  "Message no longer exists, will create new on next cycle"
                );
              } else {
                console.error("Error during countdown update:", editError);
              }
            }
          } catch (error) {
            console.error("General error during status update:", error);
          }
        }
      }, 1000);

      // Clean up on process exit
      process.on("exit", () => {
        if (statusInterval) {
          clearInterval(statusInterval);
        }
      });
    } catch (setupError) {
      console.error("Error setting up status display:", setupError);
    }
  },
};
