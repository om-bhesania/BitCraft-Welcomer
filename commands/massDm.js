// massdm.js
const massDmConfig = {
  name: "massdm",
  aliases: ["mdm", "dm"],
  description:
    "Send a direct message to all server members or test with specific users",
  usage:
    "!massdm <message> or !massdm test @user1 @user2 <message> or !massdm embed <message> or !massdm test embed @user <message>",
  permissions: ["ADMINISTRATOR"], // Restrict to administrators only
  cooldown: 300, // 5 minute cooldown to prevent spam (reduced for test mode)

  async execute(message, args, client) {
    // Check if user has administrator permissions
    if (!message.member.permissions.has("ADMINISTRATOR")) {
      return message.reply(
        "❌ You need Administrator permissions to use this command."
      );
    }

    // Check if message content is provided
    if (!args.length) {
      return message.reply(
        "❌ Please provide a message to send.\n**Usage:**\n• `!massdm <message>` - Send to all members\n• `!massdm test @user1 @user2 <message>` - Test with specific users\n• `!massdm embed <message>` - Send as custom embed\n• `!massdm test embed @user <message>` - Test embed with specific users"
      );
    }

    // Check if this is test mode and/or embed mode
    const isTestMode = args.length > 0 && args[0].toLowerCase() === "test";
    let isEmbedMode = false;
    let targetUsers = new Map();
    let dmMessage = "";

    // Determine embed mode - can be either "embed" or "test embed"
    if (isTestMode) {
      isEmbedMode = args.length > 1 && args[1].toLowerCase() === "embed";
    } else {
      isEmbedMode = args.length > 0 && args[0].toLowerCase() === "embed";
    }

    if (isTestMode) {
      // Test mode logic
      const minArgsRequired = isEmbedMode ? 4 : 3; // test + (embed) + @user + message
      if (args.length < minArgsRequired) {
        const embedText = isEmbedMode ? " embed" : "";
        return message.reply(
          `❌ Test mode requires at least one user mention and a message.\nUsage: \`!massdm test${embedText} @user1 @user2 <message>\``
        );
      }

      // Extract mentioned users
      const mentionedUsers = message.mentions.users;
      if (mentionedUsers.size === 0) {
        const embedText = isEmbedMode ? " embed" : "";
        return message.reply(
          `❌ Please mention at least one user for testing.\nUsage: \`!massdm test${embedText} @user1 @user2 <message>\``
        );
      }

      // Copy mentioned users to targetUsers
      mentionedUsers.forEach((user, id) => {
        targetUsers.set(id, user);
      });

      // Find where the message starts (after mentions, 'test', and optionally 'embed')
      const messageStart = args.findIndex((arg, index) => {
        const skipWords = isEmbedMode ? ["test", "embed"] : ["test"];
        return (
          index > 0 &&
          !arg.startsWith("<@") &&
          !skipWords.includes(arg.toLowerCase())
        );
      });

      if (messageStart === -1 || messageStart >= args.length) {
        return message.reply(
          "❌ Please provide a message after the user mentions."
        );
      }

      dmMessage = args.slice(messageStart).join(" ");
    } else {
      // Regular mode (mass DM or embed)
      const startIndex = isEmbedMode ? 1 : 0; // Skip 'embed' if present
      dmMessage = args.slice(startIndex).join(" ");

      if (!dmMessage.trim()) {
        return message.reply("❌ Please provide a message to send.");
      }
    }

    const guild = message.guild;

    // Different confirmation prompts for test mode vs mass mode
    let confirmEmbed;

    if (isTestMode) {
      const userList = Array.from(targetUsers.values())
        .map((user) => user.tag)
        .join(", ");
      const modeText = isEmbedMode ? "Test Embed DM" : "Test DM";
      const iconEmoji = isEmbedMode ? "🧪📋" : "🧪";

      confirmEmbed = {
        color: 0x00ff99,
        title: `${iconEmoji} ${modeText} Confirmation`,
        description: `**Test Mode**: Send ${
          isEmbedMode ? "embed " : ""
        }message to **${
          targetUsers.size
        }** user(s)?\n**Users:** ${userList}\n\n**Message:**\n${dmMessage}`,
        footer: { text: "Click Confirm or Cancel below (30s timeout)" },
      };
    } else {
      const modeText = isEmbedMode ? "Mass Embed DM" : "Mass DM";
      const iconEmoji = isEmbedMode ? "⚠️📋" : "⚠️";
      const tipText = isEmbedMode ? "embed " : "";

      confirmEmbed = {
        color: 0xff9900,
        title: `${iconEmoji} ${modeText} Confirmation`,
        description: `Are you sure you want to send this ${
          isEmbedMode ? "embed " : ""
        }message to **${
          guild.members.cache.filter(member => !member.user.bot).size
        }** members?\n\n**Message:**\n${dmMessage}\n\n💡 **Tip:** Use \`!massdm test ${tipText}@user <message>\` to test first!`,
        footer: { text: "Click Confirm or Cancel below (30s timeout)" },
      };
    }

    // Create buttons for confirmation
    const confirmButton = {
      type: 2, // Button type
      style: 3, // Green button (Success)
      label: "Confirm",
      emoji: { name: "✅" },
      custom_id: "confirm_dm",
    };

    const cancelButton = {
      type: 2, // Button type
      style: 4, // Red button (Danger)
      label: "Cancel",
      emoji: { name: "❌" },
      custom_id: "cancel_dm",
    };

    const actionRow = {
      type: 1, // Action Row type
      components: [confirmButton, cancelButton],
    };

    const confirmMsg = await message.reply({
      embeds: [confirmEmbed],
      components: [actionRow],
    });

    // Wait for button interaction
    const filter = (interaction) => {
      return (
        ["confirm_dm", "cancel_dm"].includes(interaction.customId) &&
        interaction.user.id === message.author.id
      );
    };

    try {
      const interaction = await confirmMsg.awaitMessageComponent({
        filter,
        time: 30000,
      });

      // Acknowledge the interaction
      await interaction.deferUpdate();

      if (interaction.customId === "cancel_dm") {
        const cancelTitle = isTestMode
          ? isEmbedMode
            ? "❌ Test Embed DM Cancelled"
            : "❌ Test DM Cancelled"
          : isEmbedMode
          ? "❌ Mass Embed DM Cancelled"
          : "❌ Mass DM Cancelled";
        const cancelDesc = isTestMode
          ? isEmbedMode
            ? "Test embed DM operation has been cancelled."
            : "Test DM operation has been cancelled."
          : isEmbedMode
          ? "Mass embed DM operation has been cancelled."
          : "Mass DM operation has been cancelled.";

        return confirmMsg.edit({
          embeds: [
            {
              color: 0xff0000,
              title: cancelTitle,
              description: cancelDesc,
            },
          ],
          components: [], // Remove buttons
        });
      }

      // Proceed with DM sending
      const sendingTitle = isTestMode
        ? isEmbedMode
          ? "🧪📋 Sending Test Embed DM..."
          : "🧪 Sending Test DM..."
        : isEmbedMode
        ? "📤📋 Sending Mass Embed DM..."
        : "📤 Sending Mass DM...";
      const sendingDesc = isTestMode
        ? isEmbedMode
          ? "Sending test embed messages..."
          : "Sending test messages..."
        : isEmbedMode
        ? "Please wait while embed messages are being sent..."
        : "Please wait while messages are being sent...";

      await confirmMsg.edit({
        embeds: [
          {
            color: 0x00ff00,
            title: sendingTitle,
            description: sendingDesc,
          },
        ],
        components: [], // Remove buttons
      });

      // Determine target members
      let targetMembers = new Map();

      if (isTestMode) {
        // For test mode, get guild members from the mentioned users
        for (const [userId, user] of targetUsers) {
          const member = guild.members.cache.get(userId);
          if (member) {
            targetMembers.set(userId, member);
          }
        }
      } else {
        // Fetch all members for mass DM
        await guild.members.fetch();
        const allMembers = guild.members.cache.filter(
          (member) => !member.user.bot
        );
        targetMembers = allMembers;
      }

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      // Send DMs with rate limiting (faster for test mode)
      const delay = isTestMode ? 500 : 1000; // 0.5s for test, 1s for mass
      for (const [memberId, member] of targetMembers) {
        try {
          // Check if user has DMs enabled
          if (member.user.bot) {
            failCount++;
            errors.push(`${member.user.tag}: Is a bot`);
            continue;
          }
          const dmChannel = await member.createDM();
          if (!dmChannel) {
            failCount++;
            errors.push(`${member.user.tag}: DMs are disabled`);
            continue;
          }

          let messageContent;
          let mentionMessage = "";

          // Tag the user in the message if mention is provided
          if (args.includes("<@")) {
            const mention = args.find((arg) => arg.startsWith("<@"));
            mentionMessage = `${mention} `;
            dmMessage = dmMessage.replace(mention, ""); // remove mention from dmMessage
          }

          if (isEmbedMode) {
            // Create a custom embed for the DM
            const dmEmbed = {
              color: 0x5865f2, // Discord's brand color
              title: `📨 Message from ${guild.name}`,
              description: dmMessage,
              footer: {
                text: `${guild.name}${isTestMode ? " (TEST MODE)" : ""}`,
                icon_url: guild.iconURL() || undefined,
              },
              timestamp: new Date(),
            };

            if (mentionMessage) {
              // Send mention as text message before embed
              await dmChannel.send(mentionMessage);
              messageContent = { embeds: [dmEmbed] };
            } else {
              messageContent = { embeds: [dmEmbed] };
            }
          } else {
            // Send as regular message with basic embed wrapper
            const dmEmbed = {
              color: 0x0099ff,
              title: isTestMode
                ? `🧪 A Message from ${guild.name}`
                : `📨 A Message from ${guild.name}`,
              description: dmMessage,
              footer: {
                text: `Sent by: Bitcraft Network${
                  isTestMode ? " (TEST MODE)" : ""
                }`,
                icon_url: message.author.displayAvatarURL(),
              },
              timestamp: new Date(),
            };

            if (mentionMessage) {
              // Send mention as text message before embed
              await dmChannel.send(mentionMessage);
              messageContent = { embeds: [dmEmbed] };
            } else {
              messageContent = { embeds: [dmEmbed] };
            }
          }

          if (!mentionMessage) {
            await dmChannel.send(messageContent);
          }

          successCount++;

          // Rate limiting - shorter delay for test mode
          if (targetMembers.size > 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          failCount++;
          errors.push(`${member.user.tag}: ${error.message}`);
          continue;
        }
      }

      // Final result
      const resultTitle = isTestMode
        ? isEmbedMode
          ? "🧪📋 Test Embed DM Results"
          : "🧪 Test DM Results"
        : isEmbedMode
        ? "📊📋 Mass Embed DM Results"
        : "📊 Mass DM Results";

      const resultEmbed = {
        color: successCount > failCount ? 0x00ff00 : 0xff9900,
        title: resultTitle,
        fields: [
          {
            name: "✅ Successful",
            value: successCount.toString(),
            inline: true,
          },
          { name: "❌ Failed", value: failCount.toString(), inline: true },
          {
            name: "👥 Total Attempted",
            value: targetMembers.size.toString(),
            inline: true,
          },
        ],
        timestamp: new Date(),
      };

      if (isTestMode && successCount > 0) {
        const embedText = isEmbedMode ? " embed" : "";
        resultEmbed.description = `✅ Test completed! You can now use \`!massdm${embedText} <message>\` for the full server.`;
      }

      if (errors.length > 0 && errors.length <= 10) {
        resultEmbed.fields.push({
          name: "❌ Error Details",
          value: errors.slice(0, 10).join("\n") || "Various errors occurred",
          inline: false,
        });
      }

      await confirmMsg.edit({ embeds: [resultEmbed], components: [] });

      // Log the DM action
      const modeText = isEmbedMode ? "Embed " : "";
      const logMessage = isTestMode
        ? `Test ${modeText}DM executed by ${message.author.tag} in ${guild.name}: ${successCount} successful, ${failCount} failed (${targetMembers.size} users)`
        : `Mass ${modeText}DM executed by ${message.author.tag} in ${guild.name}: ${successCount} successful, ${failCount} failed`;

      console.log(logMessage);
    } catch (error) {
      const timeoutTitle = isTestMode
        ? isEmbedMode
          ? "⏰ Test Embed Confirmation Timeout"
          : "⏰ Test Confirmation Timeout"
        : isEmbedMode
        ? "⏰ Mass Embed Confirmation Timeout"
        : "⏰ Confirmation Timeout";
      const timeoutDesc = isTestMode
        ? isEmbedMode
          ? "Test embed DM cancelled due to no response within 30 seconds."
          : "Test DM cancelled due to no response within 30 seconds."
        : isEmbedMode
        ? "Mass embed DM cancelled due to no response within 30 seconds."
        : "Mass DM cancelled due to no response within 30 seconds.";

      await confirmMsg.edit({
        embeds: [
          {
            color: 0xff0000,
            title: timeoutTitle,
            description: timeoutDesc,
          },
        ],
        components: [], // Remove buttons on timeout
      });
    }
  },
};

export const mdmConfig = massDmConfig; // Alias export
export const dmConfig = massDmConfig; // Alias export
export default massDmConfig;
