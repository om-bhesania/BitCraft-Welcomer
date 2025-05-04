import { EmbedBuilder } from "discord.js";

export const rulesConfig = {
  aliases: ["rule", "guidelines" ,"r"],
  adminOnly: false,
  execute: async (message, args) => {
    // General Rules Embed
    const generalRulesEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("🔧・General Rules")
      .setDescription(
        "Please follow these rules to ensure a positive experience for everyone:"
      )
      .addFields(
        {
          name: "🔹 Be Respectful – No hate speech, harassment, discrimination, or toxic behavior.",
          value: "This is a no-brainer. Be kind to each other.",
        },
        {
          name: "🔹 No Spam or Flooding – Avoid repeated messages, excessive caps, or meaningless content.",
          value: "Keep the chat clean and avoid annoying people.",
        },
        {
          name: "🔹 Follow Discord & Minecraft TOS – Violating these may lead to punishment.",
          value: "This includes Minecraft's EULA and Discord's TOS.",
        },
        {
          name: "🔹 Keep It SFW – No NSFW, offensive memes, or inappropriate usernames.",
          value: "Keep the server family-friendly.",
        },
        {
          name: "🔹 Use the Correct Channels – Post appropriately (e.g., don't drop memes in ⁠🚨・support).",
          value: "Use the correct channels to avoid spamming.",
        }
      );

    // Chat Rules Embed
    const chatRulesEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("💬・Chat Rules")
      .setDescription(
        "Follow these rules to keep the chat clean and enjoyable:"
      )
      .addFields(
        {
          name: "💬 Stay On Topic – Keep convos relevant to the channel.",
          value: "Keep the chat clean and avoid derailing conversations.",
        },
        {
          name: "🚫 No Advertising or Server Promotion – This includes in chat, DMs, or Minecraft.",
          value: "No self-promotion allowed.",
        },
        {
          name: "⏱️ Report in Time – All issues must be reported within 2 days of occurrence.",
          value: "Report any issues in time.",
        },
        {
          name: "🎖️ Respect Staff – Staff are here to help! Contact them respectfully via ⁠😤・complains.",
          value:
            "Be respectful to staff and contact them via the correct channels.",
        },
        {
          name: "🧠 No Heated Topics – Avoid politics, religion, or controversial subjects unless staff allows.",
          value: "Avoid heated topics unless staff explicitly allows it.",
        },
        {
          name: "🗣️ English or Hinglish Only – So everyone can understand.",
          value: "Speak in English or Hinglish to avoid confusion.",
        },
        {
          name: "🔔 Avoid Random Pings – Tag only when necessary.",
          value: "Only tag when necessary to avoid spamming.",
        },
        {
          name: "🧾 File Complaints Privately – Use ⁠unknown to open a ticket.",
          value: "File complaints privately.",
        },
        {
          name: "😄 Playful Banter is Cool – Double meanings are fine, just don't cross the line.",
          value: "Playful banter is cool, but don't cross the line.",
        },
        {
          name: "🤬 Swearing is Okay – But don't go overboard or direct it at anyone.",
          value: "Swearing is okay, but don't go overboard.",
        }
      );

    // Media Sharing Rules Embed
    const mediaRulesEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("📷・Media Sharing Rules")
      .setDescription("Follow these rules when sharing media:")
      .addFields(
        {
          name: "📸 Post Relevant Content Only – No off-topic images or random spam.",
          value: "Post relevant content only.",
        },
        {
          name: "🧾 Respect Copyright – Share only content you own or have rights to.",
          value: "Respect copyright laws.",
        },
        {
          name: "🚫 No NSFW or Shock Media – Keep everything safe and friendly.",
          value: "Keep the server family-friendly.",
        },
        {
          name: "🎨 Credit Creators – Always credit when sharing artwork, edits, or videos.",
          value: "Credit creators when sharing their work.",
        },
        {
          name: "📤 Don't Flood Channels – Avoid posting tons of images all at once.",
          value: "Don't flood channels.",
        }
      );

    await message.reply({
      embeds: [generalRulesEmbed, chatRulesEmbed, mediaRulesEmbed],
    });
  },
};
