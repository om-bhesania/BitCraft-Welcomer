let reminderIntervals = [];
let reminderTimeouts = [];
export const remindConfig = {
  aliases: ["reminder", "remindme"],
  adminOnly: true,
  execute: async (message, args) => {
    if (args.length < 4) {
      return message.reply(
        "Usage: `?remind <time> <once/repeat> <mention> <your message> [embed] [embed message]`"
      );
    }

    const timeArg = args[0].toLowerCase();
    const mode = args[1].toLowerCase();
    const mention = args[2];

    let messagePart = args.slice(3);

    let embedMode = false;
    let reminderMessage = "";
    let embedMessage = "";

    // Check if "embed" keyword is used
    const embedIndex = messagePart.findIndex(
      (arg) => arg.toLowerCase() === "embed"
    );
    if (embedIndex !== -1) {
      embedMode = true;
      reminderMessage = messagePart.slice(0, embedIndex).join(" ");
      embedMessage = messagePart.slice(embedIndex + 1).join(" ");
    } else {
      reminderMessage = messagePart.join(" ");
    }

    let timeInSeconds = 0;
    const timeRegex = /^(\d+)([mshd])$/;
    const match = timeRegex.exec(timeArg);

    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];

      switch (unit) {
        case "m":
          timeInSeconds = value * 60;
          break;
        case "s":
          timeInSeconds = value;
          break;
        case "h":
          timeInSeconds = value * 60 * 60;
          break;
        case "d":
          timeInSeconds = value * 60 * 60 * 24;
          break;
        default:
          return message.reply("Invalid time unit. Please use m/s/h/d.");
      }
    } else {
      return message.reply(
        "Invalid time format. Use `<value><unit>` like `10m` or `5h`."
      );
    }

    if (isNaN(timeInSeconds) || timeInSeconds <= 0) {
      return message.reply("Please provide a valid positive time.");
    }

    if (!["once", "repeat"].includes(mode)) {
      return message.reply("Mode must be either `once` or `repeat`.");
    }

    await message.reply(
      `✅ Reminder set! I will ${
        mode === "once" ? "send once" : "send repeatedly"
      } after **${timeArg}**.`
    );

    const sendReminder = async () => {
      try {
        if (embedMode) {
          const embed = new EmbedBuilder()
            .setColor("#F9A825")
            .setTitle("⏰ Reminder")
            .setDescription(embedMessage || "No embed message provided.");

          await message.channel.send({
            content: `Hey ${mention} ${reminderMessage}`,
            embeds: [embed],
          });
        } else {
          await message.channel.send(`Hey ${mention} ${reminderMessage}`);
        }
      } catch (err) {
        console.error("Failed to send reminder:", err);
      }
    };

    if (mode === "once") {
      const timeout = setTimeout(sendReminder, timeInSeconds * 1000);
      reminderTimeouts.push(timeout);
    } else if (mode === "repeat") {
      const interval = setInterval(sendReminder, timeInSeconds * 1000);
      reminderIntervals.push(interval);
    }
  },
};
// Stop reminders command
export const stopConfig = {
  aliases: ["stopreminder", "stoprm"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if there are active reminders
    if (reminderIntervals.length === 0 && reminderTimeouts.length === 0) {
      return message.reply("⚠️ There are no active reminders to stop.");
    }

    // Clear all active intervals
    reminderIntervals.forEach((interval) => clearInterval(interval));
    reminderTimeouts.forEach((timeout) => clearTimeout(timeout));

    // Reset the arrays
    reminderIntervals = [];
    reminderTimeouts = [];

    await message.reply("✅ All reminders have been stopped!");
    console.log(`Reminders stopped by ${message.author.tag}`);
  },
};
