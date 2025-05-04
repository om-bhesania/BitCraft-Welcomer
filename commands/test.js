// BitCraft Official Bot - ES Modules version with enhanced command system

import { Client } from "discord.js";
import { welcomeMember } from "../utils/utils.js";

export const testConfig = {
  aliases: ["t", "tw", "testwelcome"],
  adminOnly: true,
  execute: async (message, args) => {
    // Send typing indicator
    message.channel.sendTyping();

    // Delete the trigger message itself
    await message.delete().catch(console.error);

    // Store the current time before generating welcome messages
    const beforeTime = Date.now();

    // Use the message author as the test member
    await welcomeMember(message.member);

    // Set a short timeout to ensure messages are processed
    setTimeout(async () => {
      try {
        // Get the most recent messages in the channel
        const messages = await message.channel.messages.fetch({ limit: 5 });

        // Filter for only messages sent by the bot after the command was triggered
        const messagesToDelete = messages.filter(
          (msg) =>
            msg.author.id === Client.user.id &&
            msg.content.startsWith("Welcome to BitCraft Network,") &&
            msg.createdTimestamp > beforeTime
        );

        if (messagesToDelete.size > 0) {
          // Delete these specific messages
          await message.channel
            .bulkDelete(messagesToDelete)
            .catch(console.error);
        }
      } catch (error) {
        console.error("Error cleaning up test welcome messages:", error);
      }
    }, 10000);

    console.log(
      `Test welcome triggered and cleaned up by ${message.author.tag}`
    );
  },
};
