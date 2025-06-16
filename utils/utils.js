// BitCraft Official Bot - ES Modules version with enhanced command system
import { createCanvas, loadImage } from "canvas";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
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
    // Validate input
    if (!member || !member.user) {
      throw new Error("Invalid member object provided to createWelcomeImage");
    }

    // Canvas setup
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // Get background info
    const bgInfo = getBackgroundInfo();

    // Set default background
    const setDefaultBackground = () => {
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
    };

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
        setDefaultBackground();
      }
    } catch (imgError) {
      console.error("Error loading background:", imgError);
      setDefaultBackground();
    }

    // Save context state
    ctx.save();

    // Draw a circle for the avatar
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // Load and draw avatar with error handling
    try {
      // Get avatar URL safely
      const avatarURL = member.displayAvatarURL({ extension: "png", size: 256 }) || 
                       member.user.displayAvatarURL({ extension: "png", size: 256 });
      
      if (!avatarURL) {
        throw new Error("Could not get avatar URL");
      }
      
      const avatar = await loadImage(avatarURL);
      ctx.drawImage(avatar, 45, 45, 160, 160);
    } catch (avatarError) {
      console.error("Error loading avatar:", avatarError);
      // Draw a placeholder circle if avatar fails to load
      ctx.fillStyle = "#F9A825";
      ctx.fillRect(45, 45, 160, 160);
    }

    // Reset the clipping
    ctx.restore();

    // Get display name safely
    const displayName = member.user.displayName || member.user.username || member.user.tag || "New Member";

    // Add text with INCREASED SIZE
    ctx.font = "bold 34px Arial"; // Increased from 28px
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(`Welcome to BitCraft Network`, 450, 100);

    ctx.font = "bold 28px Arial"; // Increased from 22px
    ctx.fillStyle = "#F9A825";
    ctx.fillText(`${displayName}`, 450, 140);

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

export async function welcomeMember(member) {
  try {
    // Check if member is valid
    if (!member || !member.guild) {
      console.error("Invalid member object provided to welcomeMember function");
      return;
    }

    // Get welcome channel
    const welcomeChannel = member.guild.channels.cache.get(
      botConfig.welcomeChannelId
    );

    if (!welcomeChannel) {
      console.error(
        `Welcome channel with ID ${botConfig.welcomeChannelId} not found.`
      );
      return;
    }

    // Check if the channel is text-based
    if (!welcomeChannel.isTextBased()) {
      console.error("Welcome channel is not text-based");
      return;
    }

    // Get random welcome line
    const welcomeLine =
      welcomeLines[Math.floor(Math.random() * welcomeLines.length)];

    // Get member count
    const memberCount = member.guild.memberCount;

    try {
      // Create welcome image
      const welcomeImage = await createWelcomeImage(member, memberCount);
      const attachment = new AttachmentBuilder(welcomeImage, {
        name: "welcome-image.png",
      });

      // Send initial welcome message
      await welcomeChannel.send(
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
      await welcomeChannel.send({
        embeds: [embed],
        files: [attachment],
      });

      console.log(`Sent welcome message for ${member.user.tag}`);
    } catch (imageError) {
      console.error("Error creating welcome image:", imageError);
      
      // Send a simple welcome message if image creation fails
      await welcomeChannel.send({
        content: `Welcome to BitCraft Network, <@${member.id}>! You are our ${memberCount}th member!`,
        embeds: [
          new EmbedBuilder()
            .setColor("#F9A825")
            .setTitle(`Welcome to BitCraft Network!`)
            .setDescription(`${welcomeLine}\n\nHey <@${member.id}>, you are the **${memberCount}th** member!`)
        ]
      });
    }

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

export const sendApplicationEmbed = async (channel) => {
  const embed = new EmbedBuilder()
    .setTitle("📋 Staff Application")
    .setDescription("Click the button below to apply for staff.")
    .setColor("Green");

  const button = new ButtonBuilder()
    .setCustomId("start_staff_application")
    .setLabel("Apply Now")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
};
 