// BitCraft Official Bot - ES Modules version with enhanced command system
import { EmbedBuilder } from "discord.js";
import { botConfig } from "../config/config.js";

export const helpConfig = {
  aliases: ["commands", "info"],
  adminOnly: false,
  execute: async (message, args) => {
    const helpEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("BitCraft Official Bot Help")
      .setDescription("Available commands for the BitCraft official bot:")
      .addFields(
        {
          name: "🔧 Admin Commands",
          value:
            "**?test** - Triggers a test welcome message\n" +
            "**?bg** - Sets a new background image or GIF (attach file)\n" +
            "**?remind** - Sets a reminder (usage: `?remind <time>(s/m/h/d) <once/repeat> <mention> <message>`)",
        },
        {
          name: "📋 User Commands",
          value:
            "**?help** - Shows this help message\n" +
            "**?ip** - Get the server IP address\n" +
            "**?rules** - Shows server rules",
        },
        {
          name: "🎵 Music Commands",
          value:
            "**?play <query>** - Play music from YouTube (URL or search)\n" +
            "**?skip** - Skip the current song\n" +
            "**?queue** - View the current music queue\n" +
            "**?leave** - Stop the music and disconnect the bot",
        },
        {
          name: "🤖 Slash Commands",
          value:
            "**/p query:<name/URL>** - Play music from YouTube\n" +
            "**/skip** - Skip the current song\n" +
            "**/queue** - View the current music queue\n" +
            "**/stop** - Stop the music and disconnect the bot\n" +
            "**/help** - Shows this help message\n" +
            "**/ip** - Get the server IP address\n" +
            "**/rules** - Shows server rules",
        },
        {
          name: "📝 Note",
          value: `All commands work with any of these prefixes: ${botConfig.prefixes.join(
            ", "
          )}`,
        }
      )
      .setFooter({
        text: "BitCraft Network Official Bot",
      });

    await message.reply({ embeds: [helpEmbed] });
  },
};
