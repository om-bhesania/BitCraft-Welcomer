export const bgConfig = {
  aliases: ["setbackground", "background"],
  adminOnly: true,
  execute: async (message, args) => {
    // Check if a file was attached
    if (message.attachments.size === 0) {
      return message.reply(
        "Please attach a GIF or image file to use as the background."
      );
    }

    const attachment = message.attachments.first();
    const fileExt = path.extname(attachment.name).toLowerCase();

    // Check if it's a valid image type
    if (![".gif", ".png", ".jpg", ".jpeg"].includes(fileExt)) {
      return message.reply("Please attach a valid image file (GIF, PNG, JPG).");
    }

    try {
      // Download the file
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Save the file
      const savePath = path.join(process.cwd(), `banner${fileExt}`);
      fs.writeFileSync(savePath, buffer);

      // Update config
      botConfig.backgroundPath = savePath;

      await message.reply(
        `✅ Background ${
          fileExt === ".gif" ? "GIF" : "image"
        } updated! Remember that when using a GIF, only the first frame will be visible in welcome cards.`
      );

      console.log(`Background updated to ${savePath} by ${message.author.tag}`);
    } catch (error) {
      console.error("Error saving background:", error);
      await message.reply("❌ There was an error saving the background file.");
    }
  },
};
