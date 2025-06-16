import { EmbedBuilder } from "discord.js";
import CommandsList from "./CommandsList.js";
import { botConfig } from "../config/config.js";

export const helpConfig = {
  name: "help",
  adminOnly: false,
  aliases: ["help", "h"],
  execute(message) {
    try {
      const categories = {};

      // Group commands by category
      CommandsList.forEach((cmd) => {
        if (!categories[cmd.category]) {
          categories[cmd.category] = [];
        }
        
        // Use prefix for regular commands instead of slash
        const prefix = botConfig.prefixes[0];
        categories[cmd.category].push(`**${prefix}${cmd.name}** - ${cmd.description}`);
      });

      // Build description string
      let helpDescription = "";
      for (const [category, cmds] of Object.entries(categories)) {
        helpDescription += `**__${category.toUpperCase()}__**\n${cmds.join(
          "\n"
        )}\n\n`;
      }

      // Add note about prefixes
      const prefixesText = botConfig.prefixes.map(p => `\`${p}\``).join(', ');
      helpDescription += `**Note:** You can use any of these prefixes: ${prefixesText}\n`;

      const embed = new EmbedBuilder()
        .setColor("#9c7fe6") // your brand color
        .setTitle("📜 Available Commands")
        .setDescription(helpDescription)
        .setFooter({
          text: `BitCraft Network Bot | Use ${botConfig.prefixes[0]}help to see this menu again`,
        });

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error executing help command:", error);
      message.reply("There was an error displaying the help menu. Please try again later.");
    }
  },
  // Add data for slash command registration
  data: {
    name: "help",
    description: "List all available commands and their usage."
  }
};
