// BitCraft Official Bot - ES Modules version with enhanced command system
import { createCanvas, loadImage } from "canvas";
import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
} from "discord.js";
import fs from "fs";
import path from "path";
import { botConfig } from "../config/config.js";

// Function to create welcome card
export async function createWelcomeImage(member, memberCount) {
  try {
    // Canvas setup
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // Get background info
    const bgInfo = getBackgroundInfo();

    // Try to load background image
    try {
      if (bgInfo.exists) {
        console.log(`Loading background ${bgInfo.type} from: ${bgInfo.path}`);
        const background = await loadImage(bgInfo.path);
        // Draw background image
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Add semi-transparent overlay for better text visibility
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Set default background color
        ctx.fillStyle = "#2C2F33";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add pattern for visual interest
        ctx.fillStyle = "#1f1f1f";
        for (let i = 0; i < 20; i++) {
          for (let j = 0; j < 20; j++) {
            if ((i + j) % 2 === 0) {
              ctx.fillRect(i * 40, j * 40, 40, 40);
            }
          }
        }
      }
    } catch (imgError) {
      console.error("Error loading background:", imgError);
      // Set default background color
      ctx.fillStyle = "#2C2F33";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add pattern for visual interest
      ctx.fillStyle = "#1f1f1f";
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillRect(i * 40, j * 40, 40, 40);
          }
        }
      }
    }

    // Save context state
    ctx.save();

    // Draw a circle for the avatar
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // Load and draw avatar
    const avatar = await loadImage(
      member.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.drawImage(avatar, 45, 45, 160, 160);

    // Reset the clipping
    ctx.restore();

    // Add text with INCREASED SIZE
    ctx.font = "bold 34px Arial"; // Increased from 28px
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(`Welcome to BitCraft Network`, 450, 100);

    ctx.font = "bold 28px Arial"; // Increased from 22px
    ctx.fillStyle = "#F9A825";
    ctx.fillText(`${member.user.displayName}`, 450, 140);

    ctx.font = "24px Arial"; // Increased from 18px
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`You are the ${memberCount}th member!`, 450, 180);

    // Return the canvas as a buffer
    return canvas.toBuffer();
  } catch (error) {
    console.error("Error creating welcome image:", error);
    throw error;
  }
}

export function getBackgroundInfo() {
  if (!fs.existsSync(botConfig.backgroundPath)) {
    console.error(`Background file not found at: ${botConfig.backgroundPath}`);
    return { exists: false };
  }

  // Get file extension to determine type
  const ext = path.extname(botConfig.backgroundPath).toLowerCase();

  return {
    exists: true,
    path: botConfig.backgroundPath,
    isGif: ext === ".gif",
    type: ext === ".gif" ? "GIF" : "Image",
  };
}

export const welcomeLines = [
  "Hold onto your bits, a new crafter has entered the server!",
  "Another pixel artist joins the canvas of BitCraft!",
  "A wild new member appeared! BitCraft used Welcome... It's super effective!",
  "Breaking news: BitCraft Network just got more awesome!",
  "Looks like someone found the secret entrance to BitCraft!",
  "Alert! Alert! Cool person detected in the BitCraft Network!",
  "The BitCraft family just grew by one amazing human!",
  "Plot twist: BitCraft Network just gained an awesome new character!",
  "The BitCraft Council has approved your application. Welcome aboard!",
  "New member unlocked! Achievement: Joining the best community ever!",
];

export // Function to welcome a member
async function welcomeMember(member) {
  try {
    const welcomeChannel = member.guild.channels.cache.get(
      botConfig.welcomeChannelId
    );

    if (!welcomeChannel) {
      console.error(
        `Welcome channel with ID ${botConfig.welcomeChannelId} not found.`
      );
      return;
    }

    // Get random welcome line
    const welcomeLine =
      welcomeLines[Math.floor(Math.random() * welcomeLines.length)];

    // Get member count
    const memberCount = member.guild.memberCount;

    // Create welcome image
    const welcomeImage = await createWelcomeImage(member, memberCount);
    const attachment = new AttachmentBuilder(welcomeImage, {
      name: "welcome-image.png",
    });
    const message = await welcomeChannel.send(
      `Welcome to the server, <@${member.id}>! `
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle(`Welcome to BitCraft Network!`)
      .setDescription(
        `${welcomeLine}\n\nHey <@${member.id}>, you are the **${memberCount}th** member!`
      )
      .setImage("attachment://welcome-image.png");

    // Send welcome message with embed
    const sentMessage = await welcomeChannel.send({
      embeds: [embed],
      files: [attachment],
    });

    // Assign role to new member - with error handling and permissions check
    try {
      const roles = member.guild.roles.cache.filter((role) =>
        botConfig.defaultRoleIds.includes(role.id)
      );
      if (roles.size > 0) {
        // Check if bot has permission to manage roles
        const botMember = await member.guild.members.fetch(
          member.client.user.id
        );
        if (
          botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
          botMember.roles.highest.position >
            roles.reduce((max, role) => Math.max(max, role.position), 0)
        ) {
          await member.roles.add(roles);
          console.log(
            `Assigned roles ${roles.map((role) => role.name).join(", ")} to ${
              member.user.tag
            }`
          );
        } else {
          console.log(
            `Bot doesn't have permissions to assign the roles ${roles
              .map((role) => role.name)
              .join(", ")}. Check bot role hierarchy.`
          );
        }
      } else {
        console.error(
          `Default role(s) with ID(s) ${botConfig.defaultRoleIds.join(
            ","
          )} not found.`
        );
      }
    } catch (roleError) {
      console.error(`Failed to assign role to ${member.user.tag}:`, roleError);
    }
  } catch (error) {
    console.error("Error in welcomeMember function:", error);
  }
}

export const isAdmin = (member) => {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on("guildMemberAdd", async (member) => {
  await welcomeMember(member);
});
