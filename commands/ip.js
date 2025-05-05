import { EmbedBuilder } from "discord.js";

export const ipConfig = {
  aliases: ["server", "connect"],
  adminOnly: false,
  execute: async (message, args) => {
    const ipEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("🎮 BitCraft Server Connection Info")
      .setDescription(
        "Connect to our Minecraft server using the following details:"
      )
      .addFields(
        {
          name: "🌐 Server Address (JAVA)",
          value: "```play.bitcraftnetwork.fun```",
          inline: true,
        },
        {
          name: "🛠️ Port (BEDROCK)",
          value: "```25571```",
        },
        {
          name: "🌐 Server Address (BEDROCK)",
          value: "```play.bitcraftnetwork.fun:25582```",
        }
      )
      .setFooter({
        text: "Simply copy the server address and paste it in your Minecraft client!",
      });

    await message.reply({ embeds: [ipEmbed] });
  },
};
