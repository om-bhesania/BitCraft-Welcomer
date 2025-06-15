import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

const pruneCommand = {
  name: "prune",
  description:
    "Delete messages from this channel with confirmation (Admin Only)",
  options: [],
  category: "Administration",
  aliases: ["clear", "purge"],
  adminOnly: true,

  execute: async (message, args) => {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply(
        "❌ You need `Manage Messages` permission to use this command."
      );
    }

    // Check if bot has required permissions
    if (
      !message.guild.members.me.permissions.has(
        PermissionFlagsBits.ManageMessages
      )
    ) {
      return message.reply(
        "❌ I need `Manage Messages` permission to delete messages."
      );
    }

    // Parse amount argument
    const amount = parseInt(args[0]);
    const isAmountValid = !isNaN(amount) && amount >= 1 && amount <= 100;

    // Create confirmation embed
    const description = isAmountValid
      ? `Are you sure you want to delete **${amount}** messages in <#${message.channel.id}>?`
      : `Are you sure you want to **delete ALL messages** in <#${message.channel.id}> (up to last 2 weeks)?`;

    const embed = new EmbedBuilder()
      .setTitle("🧹 Confirm Message Deletion")
      .setDescription(`${description}\n\n⚠️ This action cannot be undone.`)
      .setColor(0xff0000);

    // Create buttons
    const confirmBtn = new ButtonBuilder()
      .setCustomId(
        `prune_confirm_${message.author.id}_${isAmountValid ? amount : "all"}`
      )
      .setLabel(isAmountValid ? `✅ Delete ${amount}` : "✅ Delete All")
      .setStyle(ButtonStyle.Danger);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`prune_cancel_${message.author.id}`)
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    // Send confirmation message
    const prompt = await message.channel.send({
      embeds: [embed],
      components: [row],
    });

    // Create collector with proper filter
    const collector = prompt.createMessageComponentCollector({
      filter: (interaction) => {
        return interaction.user.id === message.author.id;
      },
      time: 30000,
    });

    collector.on("collect", async (interaction) => {
      const customId = interaction.customId;

      if (customId.startsWith(`prune_confirm_${message.author.id}`)) {
        // Show loading message
        const loadingEmbed = new EmbedBuilder()
          .setTitle("🔄 Deleting Messages...")
          .setDescription(
            "Please wait while I delete the messages. This may take a moment."
          )
          .setColor(0xffa500);

        await interaction.update({
          embeds: [loadingEmbed],
          components: [],
        });

        let deletedCount = 0;
        let statusMessage = null;

        try {
          if (isAmountValid) {
            // Delete specific amount of messages
            const messagesToDelete = await message.channel.messages.fetch({
              limit: Math.min(amount + 2, 100), // +2 to account for command and confirmation messages
            });

            // Filter out messages older than 14 days
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const deletableMessages = messagesToDelete.filter(
              (msg) =>
                msg.createdTimestamp > twoWeeksAgo && msg.id !== prompt.id
            );

            if (deletableMessages.size > 0) {
              const deleted = await message.channel.bulkDelete(
                deletableMessages,
                true
              );
              deletedCount = deleted.size;
            }
          } else {
            // Delete all messages (in batches)
            let hasMoreMessages = true;
            let batchCount = 0;

            while (hasMoreMessages) {
              const fetched = await message.channel.messages.fetch({
                limit: 100,
              });

              if (fetched.size === 0) {
                hasMoreMessages = false;
                break;
              }

              // Filter messages that can be deleted (not older than 14 days and not the prompt message)
              const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
              const deletableMessages = fetched.filter(
                (msg) =>
                  msg.createdTimestamp > twoWeeksAgo && msg.id !== prompt.id
              );

              if (deletableMessages.size === 0) {
                hasMoreMessages = false;
                break;
              }

              const deleted = await message.channel.bulkDelete(
                deletableMessages,
                true
              );
              deletedCount += deleted.size;
              batchCount++;

              // Update loading message every 5 batches or if significant progress
              if (batchCount % 5 === 0 || deleted.size < 50) {
                try {
                  const progressEmbed = new EmbedBuilder()
                    .setTitle("🔄 Deleting Messages...")
                    .setDescription(
                      `Deleted ${deletedCount} messages so far...`
                    )
                    .setColor(0xffa500);

                  await prompt.edit({
                    embeds: [progressEmbed],
                    components: [],
                  });
                } catch (editError) {
                  // If we can't edit the prompt, it might have been deleted
                  console.log(
                    "Could not update progress message:",
                    editError.message
                  );
                }
              }

              // If we deleted fewer messages than we fetched, we're done
              if (deleted.size < fetched.size) {
                hasMoreMessages = false;
              }

              // Add a small delay to prevent rate limiting
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // Send success message in a new message since original might be deleted
          statusMessage = await message.channel.send({
            content: `✅ Successfully deleted ${deletedCount} message${
              deletedCount !== 1 ? "s" : ""
            } from this channel.`,
          });

          // Try to delete the confirmation prompt
          try {
            await prompt.delete();
          } catch (deleteError) {
            // Prompt might already be deleted, ignore
          }
        } catch (error) {
          console.error("Error deleting messages:", error);

          let errorMessage = "❌ Failed to delete messages.";

          if (error.code === 50013) {
            errorMessage =
              "❌ I don't have permission to delete messages in this channel.";
          } else if (error.code === 50034) {
            errorMessage =
              "❌ Cannot delete messages older than 14 days due to Discord limitations.";
          } else if (error.message.includes("bulk delete")) {
            errorMessage = `❌ Failed to delete some messages. Deleted ${deletedCount} messages successfully.`;
          }

          // Send error message
          try {
            statusMessage = await message.channel.send({
              content: errorMessage,
            });

            // Try to delete the confirmation prompt
            await prompt.delete();
          } catch (sendError) {
            // Try to edit the prompt instead
            try {
              await prompt.edit({
                content: errorMessage,
                embeds: [],
                components: [],
              });
            } catch (editError) {
              console.error("Could not send error message:", editError.message);
            }
          }
        }

        // Auto-delete status message after 5 seconds
        if (statusMessage) {
          setTimeout(async () => {
            try {
              await statusMessage.delete();
            } catch (deleteError) {
              // Message might already be deleted, ignore
            }
          }, 5000);
        }

        // Stop the collector
        collector.stop("completed");
      } else if (customId === `prune_cancel_${message.author.id}`) {
        await interaction.update({
          content: "❌ Message deletion cancelled.",
          embeds: [],
          components: [],
        });

        // Auto-delete cancellation message after 3 seconds
        setTimeout(async () => {
          try {
            await prompt.delete();
          } catch (deleteError) {
            // Message might already be deleted, ignore
          }
        }, 3000);

        // Stop the collector
        collector.stop("cancelled");
      }
    });

    collector.on("end", async (collected, reason) => {
      // Handle timeout case
      if (reason === "time") {
        try {
          await prompt.edit({
            content: "⏰ Confirmation timed out. Message deletion cancelled.",
            embeds: [],
            components: [],
          });

          // Auto-delete timeout message after 3 seconds
          setTimeout(async () => {
            try {
              await prompt.delete();
            } catch (deleteError) {
              // Message might already be deleted, ignore
            }
          }, 3000);
        } catch (error) {
          console.log("Could not edit timeout message:", error.message);
        }
      }
    });
  },
};

export default pruneCommand;
