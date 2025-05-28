import { EmbedBuilder } from "discord.js";

export const ipConfig = {
  name: "ip",
  description: "Get the server IP and port for BitCraft.",
  options: [],
  category: "Information",
  aliases: ["server", "connect", "ip"],
  adminOnly: false,
  execute: async (interaction) => {
    const { SERVER_IP, SERVER_PORT, SERVER_BEDROCK_PORT } = process.env;

    const ipEmbed = new EmbedBuilder()
      .setColor("#00D4AA") // Modern teal color
      .setTitle("🌐 BitCraft Server Connection")
      .setDescription(
        "**Ready to join the adventure? Connect using the details below!**"
      )
      .addFields({ 
        name: "Server IP & Ports",
        value: `\n\n**☕ Java Edition:** \`\`\`${SERVER_IP}:${SERVER_PORT}\`\`\` \n**📱 Bedrock Edition:** \`\`\`${SERVER_IP}:${SERVER_BEDROCK_PORT}\`\`\``,
        inline: false,
      })
      .setFooter({
        text: "BitCraft Official • Server Status: Online",
        iconURL: "https://i.imgur.com/OMqZfgz.png",
      })
      .setThumbnail("https://i.imgur.com/OMqZfgz.png")
      .setTimestamp();

    // Send ephemeral reply - only visible to command user with dismiss option
    try {
      await interaction.reply({
        embeds: [ipEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error sending ephemeral reply:", error);
      // Fallback to regular reply if ephemeral fails
      await interaction.reply({
        embeds: [ipEmbed],
      });
    }
  },
};
