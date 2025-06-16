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
    try {
      // Check if command is used in a guild
      if (!message.guild) {
        return message.reply("❌ This command can only be used in servers.");
      }

      // Check permissions
      if (
        !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)
      ) {
        return message.reply(
          "❌ You need `Manage Messages` permission to use this command."
        );
      }

      // Check if bot has required permissions
      if (
        !message.guild.members.me?.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return message.reply(
          "❌ I need `Manage Messages` permission to delete messages."
        );
      }

      // Check if channel is text-based
      if (!message.channel.isTextBased()) {
        return message.reply(
          "❌ This command can only be used in text channels."
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
        try {
          const customId = interaction.customId;

          if (customId.startsWith(`prune_confirm_${message.author.id}`)) {
            // Defer the interaction to prevent timeout
            await interaction.deferUpdate();

            // Show loading message
            const loadingEmbed = new EmbedBuilder()
              .setTitle("🔄 Deleting Messages...")
              .setDescription(
                "Please wait while I delete the messages. This may take a moment."
              )
              .setColor(0xffa500);

            await interaction.editReply({
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

                // Filter out messages older than 14 days and the prompt message
                const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
                const deletableMessages = messagesToDelete.filter(
                  (msg) =>
                    msg.createdTimestamp > twoWeeksAgo &&
                    msg.id !== prompt.id &&
                    msg.id !== message.id
                );

                if (deletableMessages.size > 0) {
                  // Limit to the requested amount
                  const toDelete = Array.from(deletableMessages.values()).slice(
                    0,
                    amount
                  );

                  if (toDelete.length === 1) {
                    // Single message deletion
                    await toDelete[0].delete();
                    deletedCount = 1;
                  } else if (toDelete.length > 1) {
                    // Bulk deletion
                    const deleted = await message.channel.bulkDelete(
                      toDelete,
                      true
                    );
                    deletedCount = deleted.size;
                  }
                }
              } else {
                // Delete all messages (in batches)
                let hasMoreMessages = true;
                let batchCount = 0;
                const maxBatches = 50; // Prevent infinite loops

                while (hasMoreMessages && batchCount < maxBatches) {
                  const fetched = await message.channel.messages.fetch({
                    limit: 100,
                  });

                  if (fetched.size === 0) {
                    hasMoreMessages = false;
                    break;
                  }

                  // Filter messages that can be deleted
                  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
                  const deletableMessages = fetched.filter(
                    (msg) =>
                      msg.createdTimestamp > twoWeeksAgo &&
                      msg.id !== prompt.id &&
                      msg.id !== message.id
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

                  // Update progress every 5 batches
                  if (batchCount % 5 === 0) {
                    try {
                      const progressEmbed = new EmbedBuilder()
                        .setTitle("🔄 Deleting Messages...")
                        .setDescription(
                          `Deleted ${deletedCount} messages so far...`
                        )
                        .setColor(0xffa500);

                      await interaction.editReply({
                        embeds: [progressEmbed],
                        components: [],
                      });
                    } catch (editError) {
                      console.log(
                        "Could not update progress:",
                        editError.message
                      );
                    }
                  }

                  // If we deleted fewer messages than we fetched, we're done
                  if (deleted.size < deletableMessages.size) {
                    hasMoreMessages = false;
                  }

                  // Rate limit prevention
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }

              // Send success message
              const successEmbed = new EmbedBuilder()
                .setTitle("✅ Messages Deleted")
                .setDescription(
                  `Successfully deleted ${deletedCount} message${
                    deletedCount !== 1 ? "s" : ""
                  } from this channel.`
                )
                .setColor(0x00ff00);

              await interaction.editReply({
                embeds: [successEmbed],
                components: [],
              });

              // Auto-delete success message after 5 seconds
              setTimeout(async () => {
                try {
                  await prompt.delete();
                } catch (deleteError) {
                  // Message might already be deleted
                }
              }, 5000);
            } catch (error) {
              console.error("Error deleting messages:", error);

              let errorMessage = "❌ Failed to delete messages.";
              let errorDescription = "An unexpected error occurred.";

              if (error.code === 50013) {
                errorMessage = "❌ Permission Error";
                errorDescription =
                  "I don't have permission to delete messages in this channel.";
              } else if (error.code === 50034) {
                errorMessage = "❌ Message Too Old";
                errorDescription =
                  "Cannot delete messages older than 14 days due to Discord limitations.";
              } else if (error.code === 10008) {
                errorMessage = "❌ Message Not Found";
                errorDescription =
                  "Some messages were already deleted or no longer exist.";
              } else if (error.message?.includes("bulk delete")) {
                errorMessage = "❌ Partial Success";
                errorDescription = `Failed to delete some messages. Successfully deleted ${deletedCount} messages.`;
              }

              const errorEmbed = new EmbedBuilder()
                .setTitle(errorMessage)
                .setDescription(errorDescription)
                .setColor(0xff0000);

              await interaction.editReply({
                embeds: [errorEmbed],
                components: [],
              });

              // Auto-delete error message after 5 seconds
              setTimeout(async () => {
                try {
                  await prompt.delete();
                } catch (deleteError) {
                  // Message might already be deleted
                }
              }, 5000);
            }

            collector.stop("completed");
          } else if (customId === `prune_cancel_${message.author.id}`) {
            const cancelEmbed = new EmbedBuilder()
              .setTitle("❌ Cancelled")
              .setDescription("Message deletion cancelled.")
              .setColor(0x808080);

            await interaction.update({
              embeds: [cancelEmbed],
              components: [],
            });

            // Auto-delete cancellation message after 3 seconds
            setTimeout(async () => {
              try {
                await prompt.delete();
              } catch (deleteError) {
                // Message might already be deleted
              }
            }, 3000);

            collector.stop("cancelled");
          }
        } catch (interactionError) {
          console.error("Error handling interaction:", interactionError);

          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: "❌ An error occurred while processing your request.",
                ephemeral: true,
              });
            }
          } catch (replyError) {
            console.error("Could not send error reply:", replyError);
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          try {
            const timeoutEmbed = new EmbedBuilder()
              .setTitle("⏰ Timed Out")
              .setDescription(
                "Confirmation timed out. Message deletion cancelled."
              )
              .setColor(0x808080);

            await prompt.edit({
              embeds: [timeoutEmbed],
              components: [],
            });

            // Auto-delete timeout message after 3 seconds
            setTimeout(async () => {
              try {
                await prompt.delete();
              } catch (deleteError) {
                // Message might already be deleted
              }
            }, 3000);
          } catch (error) {
            console.log("Could not edit timeout message:", error.message);
          }
        }
      });
    } catch (error) {
      console.error("Error in prune command:", error);

      try {
        await message.reply({
          content:
            "❌ An error occurred while processing your request. Please try again later.",
        });
      } catch (replyError) {
        console.error("Could not send error reply:", replyError);
      }
    }
  },
};

export default pruneCommand;
