  // massdm.js - Enhanced with error logging and debugging
  const massDmConfig = {
    name: "massdm",
    aliases: ["mdm", "dm"],
    description:
      "Send a direct message to all server members, specific users, or test with specific users",
    usage:
      "!massdm <message> or !massdm @user1 @user2 <message> or !massdm test @user1 @user2 <message> or !massdm embed title:<title> body:<message> or !massdm test embed title:<title> body:<message> @user",
    permissions: ["ADMINISTRATOR"], // Restrict to administrators only
    cooldown: 300, // 5 minute cooldown to prevent spam (reduced for test mode)

    // Enhanced logging function
    log: function (level, message, error = null, context = {}) {
      const timestamp = new Date().toISOString();
      const contextStr =
        Object.keys(context).length > 0 ? JSON.stringify(context) : "";
      const errorStr = error
        ? `\nError: ${error.stack || error.message || error}`
        : "";

      const logMessage = `[${timestamp}] [${level.toUpperCase()}] MassDM: ${message}${
        contextStr ? ` | Context: ${contextStr}` : ""
      }${errorStr}`;

      switch (level.toLowerCase()) {
        case "error":
          console.error(logMessage);
          break;
        case "warn":
          console.warn(logMessage);
          break;
        case "info":
          console.info(logMessage);
          break;
        case "debug":
          console.log(logMessage);
          break;
        default:
          console.log(logMessage);
      }
    },

    async execute(message, args, client) {
      const debugContext = {
        userId: message.author.id,
        username: message.author.tag,
        guildId: message.guild?.id,
        guildName: message.guild?.name,
        channelId: message.channel?.id,
        argsLength: args.length,
        timestamp: new Date().toISOString(),
      };

      this.log("info", "Mass DM command initiated", null, debugContext);

      try {
        // Check if user has administrator permissions
        if (!message.member.permissions.has("ADMINISTRATOR")) {
          this.log("warn", "Unauthorized access attempt", null, {
            ...debugContext,
            permissions: message.member.permissions.toArray(),
          });
          return message.reply(
            "❌ You need Administrator permissions to use this command."
          );
        }

        this.log("debug", "Permission check passed");

        // Check if message content is provided
        if (!args.length) {
          this.log("warn", "No arguments provided");
          return message.reply(
            "❌ Please provide a message to send.\n**Usage:**\n• `!massdm <message>` - Send to all members\n• `!massdm @user1 @user2 <message>` - Send to specific users\n• `!massdm test @user1 @user2 <message>` - Test with specific users\n• `!massdm embed title:<title> body:<message>` - Send as custom embed\n• `!massdm embed title:<title> body:<message> @user1 @user2` - Send custom embed to specific users\n• `!massdm test embed title:<title> body:<message> @user` - Test embed with specific users"
          );
        }

        // Check if this is test mode and/or embed mode
        const isTestMode = args.length > 0 && args[0].toLowerCase() === "test";
        let isEmbedMode = false;
        let targetUsers = new Map();
        let dmMessage = "";
        let embedTitle = "";
        let embedBody = "";

        this.log("debug", "Initial parsing complete", null, {
          isTestMode,
          firstArg: args[0],
          argsPreview: args.slice(0, 3),
        });

        // Determine embed mode - can be either "embed" or "test embed"
        if (isTestMode) {
          isEmbedMode = args.length > 1 && args[1].toLowerCase() === "embed";
        } else {
          isEmbedMode = args.length > 0 && args[0].toLowerCase() === "embed";
        }

        this.log("debug", "Mode detection complete", null, {
          isTestMode,
          isEmbedMode,
          secondArg: args[1] || "none",
        });

        // Parse embed parameters if in embed mode
        if (isEmbedMode) {
          try {
            let startIndex = isTestMode ? 2 : 1; // Skip 'test embed' or 'embed'
            let remainingArgs = args.slice(startIndex);
            let hasCustomParams = false;

            this.log("debug", "Starting embed parameter parsing", null, {
              startIndex,
              remainingArgsLength: remainingArgs.length,
              remainingArgsPreview: remainingArgs.slice(0, 5),
            });

            // Check for title: parameter
            const titleIndex = remainingArgs.findIndex((arg) =>
              arg.toLowerCase().startsWith("title:")
            );
            if (titleIndex !== -1) {
              hasCustomParams = true;
              let titleParts = [remainingArgs[titleIndex].substring(6)]; // Remove 'title:'

              // Collect title content until we hit 'body:' or a mention
              for (let i = titleIndex + 1; i < remainingArgs.length; i++) {
                if (
                  remainingArgs[i].toLowerCase().startsWith("body:") ||
                  remainingArgs[i].startsWith("<@")
                ) {
                  break;
                }
                titleParts.push(remainingArgs[i]);
              }
              embedTitle = titleParts.join(" ").trim();
              this.log("debug", "Title parameter parsed", null, {
                embedTitle,
                titleIndex,
              });
            }

            // Check for body: parameter
            const bodyIndex = remainingArgs.findIndex((arg) =>
              arg.toLowerCase().startsWith("body:")
            );
            if (bodyIndex !== -1) {
              hasCustomParams = true;
              let bodyParts = [remainingArgs[bodyIndex].substring(5)]; // Remove 'body:'

              // Collect body content until we hit a mention
              for (let i = bodyIndex + 1; i < remainingArgs.length; i++) {
                if (remainingArgs[i].startsWith("<@")) {
                  break;
                }
                bodyParts.push(remainingArgs[i]);
              }
              embedBody = bodyParts.join(" ").trim();
              this.log("debug", "Body parameter parsed", null, {
                embedBody,
                bodyIndex,
              });
            }

            // If no title/body parameters found, treat as regular message
            if (!hasCustomParams) {
              dmMessage = remainingArgs.join(" ");
              this.log(
                "debug",
                "No custom embed parameters found, using regular message"
              );
            }

            this.log("debug", "Embed parsing complete", null, {
              hasCustomParams,
              embedTitle: embedTitle || "none",
              embedBody: embedBody || "none",
              dmMessage: dmMessage || "none",
            });
          } catch (error) {
            this.log("error", "Error during embed parameter parsing", error);
            return message.reply(
              "❌ Error parsing embed parameters. Please check your syntax."
            );
          }
        }

        // Extract mentioned users from the message
        const mentionedUsers = message.mentions.users;
        const hasMentions = mentionedUsers.size > 0;

        this.log("debug", "Mentions extracted", null, {
          mentionCount: mentionedUsers.size,
          hasMentions,
          mentionedUserIds: Array.from(mentionedUsers.keys()),
        });

        if (isTestMode) {
          this.log("debug", "Processing test mode logic");

          // Test mode logic
          let minArgsRequired = isEmbedMode ? 4 : 3; // test + (embed) + @user + message

          if (isEmbedMode && (embedTitle || embedBody)) {
            minArgsRequired = 3; // test + embed + title/body params + @user
          }

          if (args.length < minArgsRequired) {
            this.log("warn", "Insufficient arguments for test mode", null, {
              argsLength: args.length,
              minArgsRequired,
              isEmbedMode,
            });
            const embedText = isEmbedMode ? " embed" : "";
            const paramText = isEmbedMode ? " title:<title> body:<message>" : "";
            return message.reply(
              `❌ Test mode requires at least one user mention and a message.\nUsage: \`!massdm test${embedText}${paramText} @user1 @user2 <message>\``
            );
          }

          if (mentionedUsers.size === 0) {
            this.log("warn", "No mentions provided for test mode");
            const embedText = isEmbedMode ? " embed" : "";
            const paramText = isEmbedMode ? " title:<title> body:<message>" : "";
            return message.reply(
              `❌ Please mention at least one user for testing.\nUsage: \`!massdm test${embedText}${paramText} @user1 @user2 <message>\``
            );
          }

          // Copy mentioned users to targetUsers
          mentionedUsers.forEach((user, id) => {
            targetUsers.set(id, user);
          });

          this.log("debug", "Test mode target users set", null, {
            targetUserCount: targetUsers.size,
            targetUserIds: Array.from(targetUsers.keys()),
          });

          // Extract message if not using embed parameters
          if (!isEmbedMode || (!embedTitle && !embedBody)) {
            // Find message start after 'test' and optionally 'embed', and after user mentions
            let messageStartIndex = isEmbedMode ? 2 : 1; // Skip 'test' and optionally 'embed'

            // Skip any mentions at the beginning
            while (
              messageStartIndex < args.length &&
              args[messageStartIndex].startsWith("<@")
            ) {
              messageStartIndex++;
            }

            if (messageStartIndex >= args.length) {
              this.log(
                "warn",
                "No message content found after mentions in test mode",
                null,
                {
                  messageStartIndex,
                  argsLength: args.length,
                }
              );
              return message.reply(
                "❌ Please provide a message after the user mentions."
              );
            }

            dmMessage = args.slice(messageStartIndex).join(" ");
            this.log("debug", "Test mode message extracted", null, {
              messageStartIndex,
              dmMessage:
                dmMessage.substring(0, 50) + (dmMessage.length > 50 ? "..." : ""),
            });
          }
        } else {
          this.log("debug", "Processing regular mode logic");

          // Regular mode - check for mentions to send to specific users
          if (hasMentions) {
            // Send to specific mentioned users only
            mentionedUsers.forEach((user, id) => {
              targetUsers.set(id, user);
            });

            this.log("debug", "Regular mode with specific mentions", null, {
              targetUserCount: targetUsers.size,
            });
          }

          // Extract message content
          if (isEmbedMode && (embedTitle || embedBody)) {
            // Message content already extracted in embed parsing
            this.log("debug", "Using embed content from parsing");
          } else {
            const startIndex = isEmbedMode ? 1 : 0; // Skip 'embed' if present
            let messageArgs = [...args.slice(startIndex)];

            // Remove mentions from message if present
            if (hasMentions) {
              messageArgs = messageArgs.filter((arg) => !arg.startsWith("<@"));
            }

            dmMessage = messageArgs.join(" ").trim();
            this.log("debug", "Regular mode message extracted", null, {
              startIndex,
              messageArgsLength: messageArgs.length,
              dmMessage:
                dmMessage.substring(0, 50) + (dmMessage.length > 50 ? "..." : ""),
            });
          }

          if (!dmMessage.trim() && !embedTitle && !embedBody) {
            this.log("warn", "No message content provided");
            return message.reply("❌ Please provide a message to send.");
          }
        }

        const guild = message.guild;
        if (!guild) {
          this.log("error", "Guild not found");
          return message.reply("❌ This command can only be used in a server.");
        }

        // Determine final message content for display
        let displayMessage = "";
        if (isEmbedMode && (embedTitle || embedBody)) {
          displayMessage = `**Title:** ${
            embedTitle || "Default Title"
          }\n**Body:** ${embedBody || "No body provided"}`;
        } else {
          displayMessage = dmMessage;
        }

        this.log("debug", "Display message prepared", null, {
          displayMessageLength: displayMessage.length,
          displayMessagePreview:
            displayMessage.substring(0, 100) +
            (displayMessage.length > 100 ? "..." : ""),
        });

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
            }** user(s)?\n**Users:** ${userList}\n\n**Message:**\n${displayMessage}`,
            footer: { text: "Click Confirm or Cancel below (30s timeout)" },
          };
        } else {
          const modeText = isEmbedMode ? "Mass Embed DM" : "Mass DM";
          const iconEmoji = isEmbedMode ? "⚠️📋" : "⚠️";
          const tipText = isEmbedMode ? "embed " : "";

          let recipientCount;
          let recipientText;

          if (hasMentions) {
            recipientCount = targetUsers.size;
            recipientText = `**${recipientCount}** mentioned user(s)`;
          } else {
            try {
              recipientCount = guild.members.cache.filter(
                (member) => !member.user.bot
              ).size;
              recipientText = `**${recipientCount}** server members`;
            } catch (error) {
              this.log("error", "Error calculating recipient count", error);
              recipientCount = 0;
              recipientText = "**unknown** server members";
            }
          }

          this.log("debug", "Confirmation embed prepared", null, {
            recipientCount,
            hasMentions,
            isEmbedMode,
          });

          confirmEmbed = {
            color: 0xff9900,
            title: `${iconEmoji} ${modeText} Confirmation`,
            description: `Are you sure you want to send this ${
              isEmbedMode ? "embed " : ""
            }message to ${recipientText}?\n\n**Message:**\n${displayMessage}\n\n💡 **Tip:** Use \`!massdm test ${tipText}@user <message>\` to test first!`,
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

        let confirmMsg;
        try {
          confirmMsg = await message.reply({
            embeds: [confirmEmbed],
            components: [actionRow],
          });
          this.log("debug", "Confirmation message sent");
        } catch (error) {
          this.log("error", "Error sending confirmation message", error);
          return message.reply(
            "❌ Error sending confirmation message. Please try again."
          );
        }

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

          this.log("debug", "Button interaction received", null, {
            customId: interaction.customId,
            userId: interaction.user.id,
          });

          // Acknowledge the interaction safely
          if (!interaction.deferred && !interaction.replied) {
            try {
              await interaction.deferUpdate();
            } catch (ackError) {
              this.log("warn", "Interaction already acknowledged", ackError, {
                deferred: interaction.deferred,
                replied: interaction.replied,
              });
            }
          }

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

            this.log("info", "Operation cancelled by user");

            try {
              if (interaction.deferred) {
                return await interaction.editReply({
                  embeds: [
                    {
                      color: 0xff0000,
                      title: cancelTitle,
                      description: cancelDesc,
                    },
                  ],
                  components: [], // Remove buttons
                });
              } else {
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
            } catch (cancelError) {
              this.log("error", "Error updating cancel message", cancelError);
              return message.reply(
                "❌ Operation cancelled, but couldn't update the message."
              );
            }
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

          this.log("info", "Starting DM sending process", null, {
            isTestMode,
            isEmbedMode,
            targetUserCount: targetUsers.size,
          });

          try {
            if (interaction.deferred) {
              await interaction.editReply({
                embeds: [
                  {
                    color: 0x00ff00,
                    title: sendingTitle,
                    description: sendingDesc,
                  },
                ],
                components: [], // Remove buttons
              });
            } else {
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
            }
          } catch (error) {
            this.log(
              "error",
              "Error updating confirmation message to sending status",
              error
            );
          }

          // Determine target members
          let targetMembers = new Map();

          if (isTestMode || hasMentions) {
            // For test mode or specific user mentions, get guild members from the mentioned users
            for (const [userId, user] of targetUsers) {
              try {
                const member = guild.members.cache.get(userId);
                if (member) {
                  targetMembers.set(userId, member);
                  this.log("debug", "Target member found in cache", null, {
                    userId,
                    username: user.tag,
                  });
                } else {
                  this.log("warn", "Target member not found in cache", null, {
                    userId,
                    username: user.tag,
                  });
                }
              } catch (error) {
                this.log("error", "Error getting target member", error, {
                  userId,
                  username: user.tag,
                });
              }
            }
          } else {
            // Fetch all members for mass DM
            try {
              this.log("debug", "Fetching all guild members");
              await guild.members.fetch();
              const allMembers = guild.members.cache.filter(
                (member) => !member.user.bot
              );
              targetMembers = allMembers;
              this.log("debug", "All members fetched", null, {
                memberCount: targetMembers.size,
              });
            } catch (error) {
              this.log("error", "Error fetching guild members", error);
              return message.reply(
                "❌ Error fetching server members. Please try again."
              );
            }
          }

          if (targetMembers.size === 0) {
            this.log("warn", "No target members found");
            const noMembersEmbed = {
              color: 0xff9900,
              title: "⚠️ No Target Members",
              description: "No valid members found to send messages to.",
            };

            try {
              if (interaction.deferred) {
                return await interaction.editReply({
                  embeds: [noMembersEmbed],
                  components: [],
                });
              } else {
                return await confirmMsg.edit({
                  embeds: [noMembersEmbed],
                  components: [],
                });
              }
            } catch (noMembersError) {
              this.log(
                "error",
                "Error updating no members message",
                noMembersError
              );
              return message.reply(
                "❌ No valid members found to send messages to."
              );
            }
          }

          this.log("info", "Starting DM delivery", null, {
            targetCount: targetMembers.size,
            isTestMode,
            isEmbedMode,
          });

          let successCount = 0;
          let failCount = 0;
          const errors = [];
          const successfulDeliveries = [];

          // Send DMs with rate limiting (faster for test mode)
          const delay = isTestMode ? 500 : 1000; // 0.5s for test, 1s for mass
          let processedCount = 0;

          for (const [memberId, member] of targetMembers) {
            processedCount++;
            const memberContext = {
              memberId,
              username: member.user.tag,
              processedCount,
              totalCount: targetMembers.size,
            };

            this.log(
              "debug",
              `Processing member ${processedCount}/${targetMembers.size}`,
              null,
              memberContext
            );

            try {
              // Check if user has DMs enabled
              if (member.user.bot) {
                failCount++;
                const errorMsg = `${member.user.tag}: Is a bot`;
                errors.push(errorMsg);
                this.log("debug", "Skipped bot user", null, memberContext);
                continue;
              }

              this.log("debug", "Creating DM channel", null, memberContext);
              const dmChannel = await member.createDM();
              if (!dmChannel) {
                failCount++;
                const errorMsg = `${member.user.tag}: DMs are disabled`;
                errors.push(errorMsg);
                this.log(
                  "warn",
                  "Failed to create DM channel",
                  null,
                  memberContext
                );
                continue;
              }

              let messageContent;

              if (isEmbedMode) {
                // Create a custom embed for the DM
                let dmEmbed;

                if (embedTitle || embedBody) {
                  // Use custom title and body
                  dmEmbed = {
                    color: 0x5865f2, // Discord's brand color
                    title: embedTitle || `📨 Message from ${guild.name}`,
                    description: embedBody || dmMessage,
                    footer: {
                      text: `${guild.name}${isTestMode ? " (TEST MODE)" : ""}`,
                      icon_url: guild.iconURL() || undefined,
                    },
                    timestamp: new Date(),
                  };
                } else {
                  // Use default embed format
                  dmEmbed = {
                    color: 0x5865f2,
                    title: `📨 Message from ${guild.name}`,
                    description: dmMessage,
                    footer: {
                      text: `${guild.name}${isTestMode ? " (TEST MODE)" : ""}`,
                      icon_url: guild.iconURL() || undefined,
                    },
                    timestamp: new Date(),
                  };
                }

                messageContent = { embeds: [dmEmbed] };
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
                    icon_url: guild.iconURL(),
                  },
                  timestamp: new Date(),
                };

                messageContent = { embeds: [dmEmbed] };
              }

              this.log("debug", "Sending DM", null, memberContext);
              await dmChannel.send(messageContent);
              successCount++;
              successfulDeliveries.push(member.user.tag);
              this.log("debug", "DM sent successfully", null, memberContext);

              // Rate limiting - shorter delay for test mode
              if (targetMembers.size > 1 && processedCount < targetMembers.size) {
                this.log(
                  "debug",
                  `Rate limiting delay: ${delay}ms`,
                  null,
                  memberContext
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            } catch (error) {
              failCount++;
              const errorMsg = `${member.user.tag}: ${error.message}`;
              errors.push(errorMsg);
              this.log("error", "Failed to send DM", error, memberContext);
              continue;
            }
          }

          this.log("info", "DM delivery completed", null, {
            successCount,
            failCount,
            totalAttempted: targetMembers.size,
            successRate:
              ((successCount / targetMembers.size) * 100).toFixed(2) + "%",
          });

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
          } else if (errors.length > 10) {
            resultEmbed.fields.push({
              name: "❌ Error Summary",
              value: `${errors.length} errors occurred. Check console logs for details.`,
              inline: false,
            });
            this.log("warn", "Multiple errors occurred during DM sending", null, {
              errorCount: errors.length,
              errors: errors.slice(0, 5), // Log first 5 errors
            });
          }

          try {
            if (interaction.deferred) {
              await interaction.editReply({
                embeds: [resultEmbed],
                components: [],
              });
            } else {
              await confirmMsg.edit({ embeds: [resultEmbed], components: [] });
            }
          } catch (error) {
            this.log("error", "Error updating final result message", error);
            // Fallback: try to send a new message if editing fails
            try {
              await message.reply({ embeds: [resultEmbed] });
            } catch (fallbackError) {
              this.log(
                "error",
                "Error sending fallback result message",
                fallbackError
              );
            }
          }

          // Log the DM action
          const modeText = isEmbedMode ? "Embed " : "";
          const targetText =
            hasMentions && !isTestMode
              ? "Targeted"
              : isTestMode
              ? "Test"
              : "Mass";
          const logMessage = `${targetText} ${modeText}DM executed by ${message.author.tag} in ${guild.name}: ${successCount} successful, ${failCount} failed (${targetMembers.size} users)`;

          this.log("info", logMessage);
        } catch (error) {
          if (error.code === "InteractionCollectorError") {
            // Timeout occurred
            this.log("warn", "Confirmation timeout occurred");

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

            try {
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
            } catch (editError) {
              this.log("error", "Error updating timeout message", editError);
            }
          } else {
            this.log(
              "error",
              "Unexpected error during confirmation handling",
              error
            );
            try {
              await confirmMsg.edit({
                embeds: [
                  {
                    color: 0xff0000,
                    title: "❌ Unexpected Error",
                    description:
                      "An unexpected error occurred. Please try again.",
                  },
                ],
                components: [],
              });
            } catch (editError) {
              this.log("error", "Error updating error message", editError);
            }
          }
        }
      } catch (error) {
        this.log(
          "error",
          "Critical error in mass DM execution",
          error,
          debugContext
        );

        try {
          await message.reply({
            embeds: [
              {
                color: 0xff0000,
                title: "❌ Critical Error",
                description:
                  "A critical error occurred while processing your request. Please check the console logs and try again.",
                footer: { text: `Error ID: ${Date.now()}` },
              },
            ],
          });
        } catch (replyError) {
          this.log("error", "Failed to send error reply", replyError);
        }
      }
    },
  };

  export const mdmConfig = massDmConfig; // Alias export
  export const dmConfig = massDmConfig; // Alias export
  export default massDmConfig;
