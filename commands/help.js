import { EmbedBuilder } from "discord.js";
import CommandsList from "./CommandsList.js";

export const helpConfig = {
  name: "help",
  adminOnly: false,
  aliases: ["help", "h"],
  execute(message) {
    const categories = {};

    // Group commands by category
    CommandsList.forEach((cmd) => {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(`**/${cmd.name}** - ${cmd.description}`);
    });

    // Build description string
    let helpDescription = "";
    for (const [category, cmds] of Object.entries(categories)) {
      helpDescription += `**__${category.toUpperCase()}__**\n${cmds.join(
        "\n"
      )}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#9c7fe6") // your brand color
      .setTitle("📜 Available Commands")
      .setDescription(helpDescription)
      .setFooter({
        text: "Use the slash commands directly or type /help to see this menu again.",
      });

    message.reply({ embeds: [embed] });
  },
};
