// BitCraft Official Bot - Slash Commands Module
import { REST, Routes } from "discord.js";
import { musicSlashCommand } from "../commands/music/music.js";
import { botConfig } from "../config/config.js";
 

// Register all slash commands here
const slashCommands = [
  musicSlashCommand,
  {
    name: "help",
    description: "Shows the bot help message",
  },
  {
    name: "ip",
    description: "Get the BitCraft server IP address",
  },
  {
    name: "rules",
    description: "Shows the server rules",
  },
  // {
  //   name: "skip",
  //   description: "Skip the current song",
  // },
  // {
  //   name: "queue",
  //   description: "View the current music queue",
  // },
  // {
  //   name: "stop",
  //   description: "Stop the music and disconnect the bot",
  // },
];

// Function to register slash commands
export async function registerSlashCommands(client) {
  try {
    console.log("Started refreshing application (/) commands.");

    const rest = new REST({ version: "10" }).setToken(botConfig.token);

    // Register commands for all guilds the bot is in
    const guilds = client.guilds.cache.map((guild) => guild.id);

    for (const guildId of guilds) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
        body: slashCommands,
      });
      console.log(`Registered slash commands for guild ${guildId}`);
    }

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
}

// Handle interaction create events
export function setupInteractionHandler(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    // Get the command name
    const { commandName } = interaction;

    // // Handle music command
    // if (commandName === "p") {
    //   await musicSlashCommand.execute(interaction);
    //   return;
    // }

    // // Handle skip command
    // if (commandName === "skip") {
    //   const { skipConfig } = await import("./music.js");
    //   await skipConfig.execute(
    //     {
    //       member: interaction.member,
    //       guild: interaction.guild,
    //       reply: async (content) => interaction.reply(content),
    //     },
    //     []
    //   );
    //   return;
    // }

    // // Handle queue command
    // if (commandName === "queue") {
    //   const { queueConfig } = await import("./music.js");
    //   await queueConfig.execute(
    //     {
    //       member: interaction.member,
    //       guild: interaction.guild,
    //       reply: async (content) => interaction.reply(content),
    //     },
    //     []
    //   );
    //   return;
    // }

    // // Handle stop command
    // if (commandName === "stop") {
    //   const { stopConfig } = await import("../commands/music/music.js");
    //   await stopConfig.execute(
    //     {
    //       member: interaction.member,
    //       guild: interaction.guild,
    //       reply: async (content) => interaction.reply(content),
    //     },
    //     []
    //   );
    //   return;
    // }

    // Handle help command
    if (commandName === "help") {
      const { helpConfig } = await import("./help.js");
      await helpConfig.execute(
        {
          reply: async (content) => interaction.reply(content),
        },
        []
      );
      return;
    }

    // Handle ip command
    if (commandName === "ip") {
      const { ipConfig } = await import("./ip.js");
      await ipConfig.execute(
        {
          reply: async (content) => interaction.reply(content),
        },
        []
      );
      return;
    }

    // Handle rules command
    if (commandName === "rules") {
      const { rulesConfig } = await import("./rules.js");
      await rulesConfig.execute(
        {
          reply: async (content) => interaction.reply(content),
        },
        []
      );
      return;
    }

    // If the command is not found
    await interaction.reply({ content: "Unknown command!", ephemeral: true });
  });
}
