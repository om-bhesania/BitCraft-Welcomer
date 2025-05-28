// slashCommands/SlashCommandsManager.js
import { REST, Routes, Collection } from "discord.js";
import { botConfig } from "../config/config.js";

export class SlashCommandsManager {
  constructor() {
    this.commands = new Collection();
    this.commandsData = [];
  }
  matching;
  // Register a single slash command
  registerCommand(commandConfig) {
    // Validate command structure
    if (
      !commandConfig.aliases ||
      typeof commandConfig.adminOnly !== "boolean"
    ) {
      console.error("Invalid command structure:", commandConfig);
      return false;
    }

    // Add to collections
    this.commands.set(commandConfig.name, commandConfig);
    this.commandsData.push(
      commandConfig.data || {
        name: commandConfig.name,
        description: commandConfig.description,
        options: commandConfig.options || [],
      }
    );

    console.log(`Registered slash command: /${commandConfig.name}`);
    return true;
  }

  // Register multiple commands from array
  registerCommands(commandsArray) {
    let successCount = 0;

    for (const command of commandsArray) {
      if (this.registerCommand(command)) {
        successCount++;
      }
    }

    console.log(
      `Successfully registered ${successCount}/${commandsArray.length} slash commands`
    );
    return successCount;
  }

  // Deploy commands to Discord
  async deployCommands(clientId, guildId = null) {
    const rest = new REST({ version: "10" }).setToken(botConfig.token);

    try {
      console.log(
        `Started refreshing ${this.commandsData.length} application (/) commands.`
      );

      let data;
      if (guildId) {
        // Deploy to specific guild (faster for testing)
        data = await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: this.commandsData }
        );
      } else {
        // Deploy globally (takes up to 1 hour to propagate)
        data = await rest.put(Routes.applicationCommands(clientId), {
          body: this.commandsData,
        });
      }

      console.log(
        `Successfully reloaded ${data.length} application (/) commands.`
      );
      return true;
    } catch (error) {
      console.error("Error deploying slash commands:", error);
      return false;
    }
  }

  // Handle slash command interactions
  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = this.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    // Check permissions if specified
    if (
      command.adminOnly &&
      !interaction.member.permissions.has("Administrator")
    ) {
      return interaction.reply({
        content: "You need administrator permissions to use this command!",
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);

      const errorMessage = "There was an error while executing this command!";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}
