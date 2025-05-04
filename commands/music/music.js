// Updated music.js with improved error handling and path management
import { EmbedBuilder } from "discord.js";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";
import * as play from "play-dl";
import { readFileSync, existsSync } from "fs";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import ffmpegStatic from "ffmpeg-static";

// ES Modules compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const exec = promisify(execCallback);

// IMPROVED: More robust FFmpeg path loading with fallbacks
let ffmpegPath;
try {
  const configPath = join(__dirname, "ffmpeg-config.json");
  if (existsSync(configPath)) {
    const ffmpegConfig = JSON.parse(readFileSync(configPath, "utf8"));
    ffmpegPath = ffmpegConfig.ffmpegPath;
    // FIXED: Handle Windows backslash escaping in paths
    ffmpegPath = ffmpegPath.replace(/\\\\/g, "\\"); // Un-escape double backslashes
    console.log(`✅ Loaded FFmpeg path from config: ${ffmpegPath}`);
  } else {
    console.log("⚠️ Config file not found, using direct ffmpeg-static import");
    ffmpegPath = ffmpegStatic;
    console.log(`⚠️ Using ffmpeg-static: ${ffmpegPath}`);
  }
} catch (error) {
  console.error(`❌ Error loading FFmpeg path: ${error.message}`);
  ffmpegPath = ffmpegStatic;
  console.log(`⚠️ Falling back to ffmpeg-static: ${ffmpegPath}`);
}

// Set FFmpeg path for environments that look for it in process.env
process.env.FFMPEG_PATH = ffmpegPath;

// IMPROVED: More reliable play-dl initialization
export async function initializePlayDl() {
  try {
    console.log("Initializing play-dl with enhanced settings...");

    // Set YouTube token config with better user agent
    await play.setToken({
      useragent: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
      ],
      cookie: process.env.YOUTUBE_COOKIE || "",
    });

    // FIXED: Test FFmpeg availability with proper path escaping for Windows
    try {
      // Handle spaces in paths properly for Windows
      const { stdout } = await exec(`"${ffmpegPath}" -version`);
      console.log(`✅ FFmpeg is working: ${stdout.split("\n")[0]}`);
    } catch (error) {
      console.error("❌ FFmpeg check failed:", error);
      // Continue anyway as the path might still work with the audio library
    }

    console.log("✅ play-dl initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize play-dl:", error);
  }
}

// Call the initialization function
initializePlayDl();

// Store active music connections and queues
const musicConnections = new Map();

export const musicConfig = {
  aliases: ["p", "play", "music"],
  adminOnly: false,
  execute: async (message, args) => {
    // Log the entire command execution attempt with timestamp
    console.log(
      `[${new Date().toISOString()}] Music command execution attempt by ${
        message.author.tag
      }`
    );

    // Check if user provided a search query or URL
    if (!args.length) {
      return message.reply(
        "Please provide a song name or YouTube URL to play!"
      );
    }

    // Check if user is in a voice channel
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply("You need to be in a voice channel to play music!");
    }

    // Join permissions check
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return message.reply(
        "I need permissions to join and speak in your voice channel!"
      );
    }

    // Send a loading message
    const loadingMsg = await message.reply("🔍 Searching for your song...");

    // Get the song info
    const query = args.join(" ");
    try {
      await message.channel.sendTyping();

      let songInfo;
      let url;

      console.log(`Processing music request: "${query}"`);

      // IMPROVED: Better YouTube URL detection
      if (query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/)) {
        // It's a URL
        url = query;
        console.log(`Processing YouTube URL: ${url}`);

        // FIXED: Better error handling for video info retrieval
        let ytInfo;
        try {
          ytInfo = await play.video_info(url);
        } catch (err) {
          console.error(`Error getting video info: ${err}`);
          throw new Error(
            `Could not retrieve video information: ${err.message}`
          );
        }

        if (!ytInfo || !ytInfo.video_details) {
          throw new Error("Failed to fetch video details");
        }

        songInfo = {
          title: ytInfo.video_details.title,
          url: ytInfo.video_details.url,
          thumbnail: ytInfo.video_details.thumbnails[0]?.url || "",
          duration: ytInfo.video_details.durationInSec,
          videoId: ytInfo.video_details.id,
        };
        console.log(`Found song: ${songInfo.title} (ID: ${songInfo.videoId})`);
      } else {
        // It's a search query
        console.log(`Searching YouTube for: "${query}"`);

        // FIXED: Better error handling for search
        let searchResults;
        try {
          searchResults = await play.search(query, { limit: 1 });
        } catch (err) {
          console.error(`Search error: ${err}`);
          throw new Error(`Could not search for "${query}": ${err.message}`);
        }

        if (!searchResults || !searchResults.length) {
          await loadingMsg.edit("No songs found with that query!");
          return;
        }

        console.log(
          `Found song: ${searchResults[0].title} (ID: ${searchResults[0].id})`
        );
        songInfo = {
          title: searchResults[0].title,
          url: searchResults[0].url,
          thumbnail: searchResults[0].thumbnails[0]?.url || "",
          duration: searchResults[0].durationInSec,
          videoId: searchResults[0].id,
        };
        url = searchResults[0].url;
      }

      // Create/get server queue
      let serverQueue = musicConnections.get(message.guild.id);

      if (!serverQueue) {
        console.log(`Creating new queue for guild ${message.guild.id}`);
        // Create a new queue structure
        serverQueue = {
          voiceChannel: voiceChannel,
          textChannel: message.channel,
          connection: null,
          player: createAudioPlayer({
            behaviors: {
              noSubscriber: NoSubscriberBehavior.Play,
            },
            debug: true,
          }),
          songs: [],
          volume: 100,
          playing: true,
        };

        // IMPROVED: More reliable voice connection setup
        try {
          console.log(`Joining voice channel ${voiceChannel.id}`);
          serverQueue.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false, // Try with not deafening
            selfMute: false, // Make sure not muted
          });

          // FIXED: Clearer subscription handling
          const subscription = serverQueue.connection.subscribe(
            serverQueue.player
          );
          if (subscription) {
            console.log("✅ Successfully subscribed player to connection");
          } else {
            console.error("❌ Failed to subscribe player to connection");
            throw new Error("Failed to subscribe player to connection");
          }

          // Set up event listeners with detailed states
          serverQueue.player.on(AudioPlayerStatus.Playing, () => {
            console.log(`[${new Date().toISOString()}] Player is now playing`);
          });

          serverQueue.player.on(AudioPlayerStatus.Buffering, () => {
            console.log(`[${new Date().toISOString()}] Player is buffering`);
          });

          serverQueue.player.on(AudioPlayerStatus.Paused, () => {
            console.log(`[${new Date().toISOString()}] Player is paused`);
          });

          serverQueue.player.on(AudioPlayerStatus.AutoPaused, () => {
            console.log(`[${new Date().toISOString()}] Player is auto-paused`);
          });

          // IMPROVED: Handle the queue better on idle status
          serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            console.log(
              `[${new Date().toISOString()}] Player is idle, moving to next song`
            );
            if (serverQueue.songs.length > 0) {
              serverQueue.songs.shift();
              playSong(message.guild.id, serverQueue);
            }
          });

          serverQueue.player.on("error", (error) => {
            console.error(
              `[${new Date().toISOString()}] Audio player error: ${
                error.message
              }`,
              error
            );
            message.channel.send(`⚠️ Error playing song: ${error.message}`);
            if (serverQueue.songs.length > 0) {
              serverQueue.songs.shift();
              playSong(message.guild.id, serverQueue);
            }
          });

          // Connection state debugging
          serverQueue.connection.on(VoiceConnectionStatus.Ready, () => {
            console.log(
              `[${new Date().toISOString()}] Voice connection is ready!`
            );
          });

          // IMPROVED: Handle state transitions better
          serverQueue.connection.on(
            VoiceConnectionStatus.Disconnected,
            async () => {
              console.log(
                `[${new Date().toISOString()}] Voice disconnected for guild ${
                  message.guild.id
                }`
              );

              try {
                // Try to reconnect once before destroying
                await Promise.race([
                  serverQueue.connection.rejoin(),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Connection timed out")),
                      5000
                    )
                  ),
                ]);
              } catch (e) {
                // On failure, destroy the connection entirely
                console.log(`Reconnection failed: ${e.message}`);
                serverQueue.connection.destroy();
                musicConnections.delete(message.guild.id);
              }
            }
          );

          serverQueue.connection.on("error", (error) => {
            console.error(
              `[${new Date().toISOString()}] Voice connection error: ${
                error.message
              }`,
              error
            );
            message.channel.send(`⚠️ Voice connection error: ${error.message}`);
            serverQueue.connection.destroy();
            musicConnections.delete(message.guild.id);
          });

          // Save to the map
          musicConnections.set(message.guild.id, serverQueue);
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error creating voice connection:`,
            error
          );
          await loadingMsg.edit(
            `Error connecting to voice channel: ${error.message}`
          );
          return;
        }
      }

      // Add song to queue
      serverQueue.songs.push(songInfo);

      // Create a nice embed
      const addedEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("🎵 Added to Queue")
        .setDescription(`**[${songInfo.title}](${songInfo.url})**`)
        .setThumbnail(songInfo.thumbnail)
        .addFields(
          {
            name: "Duration",
            value: formatDuration(songInfo.duration),
            inline: true,
          },
          {
            name: "Position",
            value:
              serverQueue.songs.length > 1
                ? `#${serverQueue.songs.length}`
                : "Now Playing",
            inline: true,
          }
        )
        .setFooter({ text: `Requested by ${message.author.tag}` });

      await loadingMsg.edit({ content: null, embeds: [addedEmbed] });

      // If this is the first song, start playing
      if (serverQueue.songs.length === 1) {
        console.log(
          `[${new Date().toISOString()}] Starting to play first song in queue`
        );
        playSong(message.guild.id, serverQueue);
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error executing music command:`,
        error
      );
      await loadingMsg.edit(
        `⚠️ There was an error playing this song: ${error.message}`
      );
    }
  },
};

// FIXED: Improved playSong function with better error handling and retries
async function playSong(guildId, serverQueue) {
  // Check if there are songs in the queue
  if (!serverQueue.songs.length) {
    // No more songs, disconnect and clean up
    console.log(
      `[${new Date().toISOString()}] No more songs in queue for guild ${guildId}, disconnecting`
    );
    serverQueue.connection.destroy();
    musicConnections.delete(guildId);
    return;
  }

  const currentSong = serverQueue.songs[0];
  console.log(
    `[${new Date().toISOString()}] Attempting to play: ${
      currentSong.title
    } (ID: ${currentSong.videoId})`
  );

  try {
    console.log(
      `[${new Date().toISOString()}] Fetching stream for video ID: ${
        currentSong.videoId
      }`
    );

    // IMPROVED: Better stream acquisition with multiple fallbacks
    let stream = null;
    let streamError = null;

    // Try different methods to get a stream
    const streamOptions = [
      // Option 1: Try with the direct URL
      {
        desc: "direct URL with highest quality",
        fn: () =>
          play.stream(currentSong.url, {
            quality: 0,
            discordPlayerCompatibility: true,
          }),
      },
      // Option 2: Try with video ID directly
      {
        desc: "video ID URL",
        fn: () =>
          play.stream(
            `https://www.youtube.com/watch?v=${currentSong.videoId}`,
            {
              quality: 0,
              discordPlayerCompatibility: true,
            }
          ),
      },
      // Option 3: Try with lower quality
      {
        desc: "URL with lower quality",
        fn: () =>
          play.stream(currentSong.url, {
            quality: 1,
            discordPlayerCompatibility: true,
            seek: 0,
          }),
      },
      // Option 4: Last resort - try with different options
      {
        desc: "URL with minimal options",
        fn: () =>
          play.stream(currentSong.url, {
            discordPlayerCompatibility: true,
            quality: 2,
          }),
      },
    ];

    // Try each option until one works
    for (const option of streamOptions) {
      try {
        console.log(`[${new Date().toISOString()}] Trying ${option.desc}...`);
        stream = await option.fn();
        if (stream) {
          console.log(
            `[${new Date().toISOString()}] Success with ${option.desc}`
          );
          break;
        }
      } catch (err) {
        console.warn(
          `[${new Date().toISOString()}] Failed with ${option.desc}: ${
            err.message
          }`
        );
        streamError = err;
      }
    }

    if (!stream) {
      throw (
        streamError ||
        new Error("Failed to get audio stream after multiple attempts")
      );
    }

    console.log(`[${new Date().toISOString()}] Stream obtained successfully`);
    console.log(
      `Stream details - Type: ${stream.type}, Format: ${
        stream.format || "unknown"
      }, Bitrate: ${stream.bitrate || "unknown"}`
    );

    // FIXED: Create resource with proper error handling
    let resource;
    try {
      resource = createAudioResource(stream.stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
        metadata: {
          title: currentSong.title,
          url: currentSong.url,
        },
      });
      console.log("==========resource===========", resource);
    } catch (resourceError) {
      console.error("Error creating resource:", resourceError);
      throw new Error(
        `Failed to create audio resource: ${resourceError.message}`
      );
    }

    if (!resource) {
      throw new Error("Failed to create audio resource - resource is null");
    }

    // Set volume to maximum (1.0 = 100%)
    resource.volume?.setVolume(2.0);
    console.log(`[${new Date().toISOString()}] Set volume to 200%`);

    // FIXED: More reliable play with restart mechanism
    const playResult = serverQueue.player.play(resource);
    console.log(
      `[${new Date().toISOString()}] Audio player play() result:`,
      playResult
    );

    // Verify the player state after playing and implement retry mechanism
    let retryCount = 0;
    const maxRetries = 2;

    const checkPlayerState = () => {
      const playerState = serverQueue.player.state.status;
      console.log(
        `[${new Date().toISOString()}] Player state check: ${playerState}`
      );

      // If idle after playing and we haven't exceeded retries, try again
      if (playerState === AudioPlayerStatus.Idle && retryCount < maxRetries) {
        retryCount++;
        console.warn(
          `[${new Date().toISOString()}] Player still idle after play() call. Retry ${retryCount}/${maxRetries}...`
        );
        serverQueue.player.play(resource);

        // Check again in 2 seconds
        setTimeout(checkPlayerState, 2000);
      }
      // If we're still idle after max retries, move to next song
      else if (
        playerState === AudioPlayerStatus.Idle &&
        retryCount >= maxRetries
      ) {
        console.error(
          `[${new Date().toISOString()}] Failed to play after ${maxRetries} retries. Moving to next song.`
        );
        serverQueue.songs.shift();
        playSong(guildId, serverQueue);
      }
      // If playing, buffering, or any other non-idle state, it's working!
      else if (playerState !== AudioPlayerStatus.Idle) {
        console.log(
          `[${new Date().toISOString()}] Player successfully playing!`
        );
      }
    };

    // Check state after 2 seconds
    setTimeout(checkPlayerState, 2000);

    // Announce now playing in text channel
    const playingEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("🎵 Now Playing")
      .setDescription(`**[${currentSong.title}](${currentSong.url})**`)
      .setThumbnail(currentSong.thumbnail)
      .addFields({
        name: "Duration",
        value: formatDuration(currentSong.duration),
        inline: true,
      });

    serverQueue.textChannel.send({ embeds: [playingEmbed] }).catch((err) => {
      console.error(
        `[${new Date().toISOString()}] Error sending now playing message:`,
        err
      );
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error playing song:`, error);
    serverQueue.textChannel
      .send(
        `⚠️ Could not play song: ${error.message}. Attempting to play next song in queue...`
      )
      .catch((err) => {
        console.error(
          `[${new Date().toISOString()}] Error sending error message:`,
          err
        );
      });

    // Skip to next song
    serverQueue.songs.shift();
    playSong(guildId, serverQueue);
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

// FIXED: Improved testAudioConfig with better FFmpeg path handling
export const testAudioConfig = {
  aliases: ["testaudio"],
  adminOnly: false,
  execute: async (message, args) => {
    try {
      await message.reply("🔊 Testing audio system...");

      // FIXED: More reliable FFmpeg test with better path handling
      try {
        await message.reply(`Testing FFmpeg at path: ${ffmpegPath}`);
        const { stdout } = await exec(`"${ffmpegPath}" -version`);
        await message.reply(`✅ FFmpeg is working: ${stdout.split("\n")[0]}`);
      } catch (error) {
        await message.reply(`❌ FFmpeg check failed: ${error.message}`);
        await message.reply(
          "Attempting to continue with voice connection test anyway..."
        );
      }

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        await message.reply("❌ Join a voice channel to test this command.");
        return;
      }

      await message.reply("🔄 Connecting to voice channel...");

      // IMPROVED: More thorough voice connection test
      try {
        // const connection = joinVoiceChannel({
        //   channelId: interaction.member.voice.channel.id,
        //   guildId: interaction.guild.id,
        //   adapterCreator: interaction.guild.voiceAdapterCreator,
        // });

        await message.reply("✅ Connected to voice channel.");

        // Listen for the ready event
        let readyPromise = new Promise((resolve, reject) => {
          // Set a timeout in case the ready event never fires
          const timeout = setTimeout(() => {
            reject(new Error("Voice connection ready timeout"));
          }, 10000);

          // Listen for the ready event
          connection.once(VoiceConnectionStatus.Ready, () => {
            clearTimeout(timeout);
            resolve();
          });

          // Also listen for failure events
          connection.once(VoiceConnectionStatus.Disconnected, () => {
            clearTimeout(timeout);
            reject(new Error("Voice connection disconnected"));
          });

          connection.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        player.on(AudioPlayerStatus.Playing, () => {
          console.log("🔊 Audio is playing");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          console.log("⏹️ Audio player is idle");
        });

        player.on("error", (error) => {
          console.error("❌ Player error:", error);
        });

        try {
          await readyPromise;
          await message.reply("✅ Voice connection is ready.");
        } catch (err) {
          await message.reply(`⚠️ Voice connection issue: ${err.message}`);
        }

        // const player = createAudioPlayer({
        //   behaviors: {
        //     noSubscriber: NoSubscriberBehavior.Play,
        //   },
        // });

        // Fetch the stream using play-dl
        const stream = await play.stream(video.url);
        const resource = createAudioResource(stream.stream, {
          inputType: stream.type,
        });

        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Playing, () => {
          console.log("🔊 Bot is playing audio");
        });

        player.on("error", (error) => {
          console.error("🚨 Audio player error:", error);
        });

        // Clean up
        connection.destroy();
        await message.reply("✅ Disconnected from voice channel.");

        await message.reply(
          "🟢 Audio system seems OK! You should be able to play music."
        );
      } catch (error) {
        await message.reply(`❌ Voice connection failed: ${error.message}`);
        await message.reply(
          "Please check your Discord permissions and network connection."
        );
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Audio test failed:`, error);
      await message.reply(`❌ Audio system test failed: ${error.message}`);
    }
  },
};

// FIXED: Improved musicSlashCommand implementation
export const musicSlashCommand = {
  name: "p",
  description: "Play a song by search query or YouTube URL",
  options: [
    {
      name: "query",
      type: 3, // String type
      description: "Song name or YouTube URL",
      required: true,
    },
  ],
  adminOnly: false,
  execute: async (interaction) => {
    // Log the entire command execution attempt with timestamp
    console.log(
      `[${new Date().toISOString()}] Music slash command execution by ${
        interaction.user.tag
      }`
    );

    await interaction.deferReply(); // Defer to give time for processing

    const query = interaction.options.getString("query");
    if (!query) {
      return await interaction.editReply(
        "Please provide a song name or YouTube URL to play!"
      );
    }

    // Check if user is in a voice channel
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return await interaction.editReply(
        "You need to be in a voice channel to play music!"
      );
    }

    // Join permissions check
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return await interaction.editReply(
        "I need permissions to join and speak in your voice channel!"
      );
    }

    try {
      let songInfo;
      let url;

      console.log(`Processing music request: "${query}"`);

      // Handle YouTube URL or search query
      if (query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/)) {
        // It's a URL
        url = query;
        console.log(`Processing YouTube URL: ${url}`);

        // Better error handling for video info retrieval
        let ytInfo;
        try {
          ytInfo = await play.video_info(url);
        } catch (err) {
          console.error(`Error getting video info: ${err}`);
          throw new Error(
            `Could not retrieve video information: ${err.message}`
          );
        }

        if (!ytInfo || !ytInfo.video_details) {
          throw new Error("Failed to fetch video details");
        }

        songInfo = {
          title: ytInfo.video_details.title,
          url: ytInfo.video_details.url,
          thumbnail: ytInfo.video_details.thumbnails[0]?.url || "",
          duration: ytInfo.video_details.durationInSec,
          videoId: ytInfo.video_details.id,
        };
        console.log(`Found song: ${songInfo.title} (ID: ${songInfo.videoId})`);
      } else {
        // It's a search query
        console.log(`Searching YouTube for: "${query}"`);

        // Better error handling for search
        let searchResults;
        try {
          searchResults = await play.search(query, { limit: 1 });
        } catch (err) {
          console.error(`Search error: ${err}`);
          throw new Error(`Could not search for "${query}": ${err.message}`);
        }

        if (!searchResults || !searchResults.length) {
          await interaction.editReply("No songs found with that query!");
          return;
        }

        console.log(
          `Found song: ${searchResults[0].title} (ID: ${searchResults[0].id})`
        );
        songInfo = {
          title: searchResults[0].title,
          url: searchResults[0].url,
          thumbnail: searchResults[0].thumbnails[0]?.url || "",
          duration: searchResults[0].durationInSec,
          videoId: searchResults[0].id,
        };
        url = searchResults[0].url;
      }

      // Create/get server queue
      let serverQueue = musicConnections.get(interaction.guild.id);

      if (!serverQueue) {
        console.log(`Creating new queue for guild ${interaction.guild.id}`);

        // Create a new queue structure
        serverQueue = {
          voiceChannel: voiceChannel,
          textChannel: interaction.channel,
          connection: null,
          player: createAudioPlayer({
            behaviors: {
              noSubscriber: NoSubscriberBehavior.Play,
            },
            debug: true,
          }),
          songs: [],
          volume: 100,
          playing: true,
        };

        // More reliable voice connection setup
        try {
          console.log(`Joining voice channel ${voiceChannel.id}`);
          serverQueue.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
          });

          // Clearer subscription handling
          const subscription = serverQueue.connection.subscribe(
            serverQueue.player
          );
          if (subscription) {
            console.log("✅ Successfully subscribed player to connection");
          } else {
            console.error("❌ Failed to subscribe player to connection");
            throw new Error("Failed to subscribe player to connection");
          }

          // Set up player event listeners similar to the regular command
          serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            console.log(
              `[${new Date().toISOString()}] Player is idle, moving to next song`
            );
            if (serverQueue.songs.length > 0) {
              serverQueue.songs.shift();
              playSong(interaction.guild.id, serverQueue);
            }
          });

          serverQueue.player.on("error", (error) => {
            console.error(
              `[${new Date().toISOString()}] Audio player error: ${
                error.message
              }`,
              error
            );
            serverQueue.textChannel.send(
              `⚠️ Error playing song: ${error.message}`
            );
            if (serverQueue.songs.length > 0) {
              serverQueue.songs.shift();
              playSong(interaction.guild.id, serverQueue);
            }
          });

          // Connection state handling similar to regular command
          serverQueue.connection.on(
            VoiceConnectionStatus.Disconnected,
            async () => {
              console.log(
                `[${new Date().toISOString()}] Voice disconnected for guild ${
                  interaction.guild.id
                }`
              );

              try {
                // Try to reconnect once before destroying
                await Promise.race([
                  serverQueue.connection.rejoin(),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Connection timed out")),
                      5000
                    )
                  ),
                ]);
              } catch (e) {
                console.log(`Reconnection failed: ${e.message}`);
                serverQueue.connection.destroy();
                musicConnections.delete(interaction.guild.id);
              }
            }
          );

          serverQueue.connection.on("error", (error) => {
            console.error(
              `[${new Date().toISOString()}] Voice connection error: ${
                error.message
              }`,
              error
            );
            serverQueue.textChannel.send(
              `⚠️ Voice connection error: ${error.message}`
            );
            serverQueue.connection.destroy();
            musicConnections.delete(interaction.guild.id);
          });

          // Save to the map
          musicConnections.set(interaction.guild.id, serverQueue);
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error creating voice connection:`,
            error
          );
          await interaction.editReply(
            `Error connecting to voice channel: ${error.message}`
          );
          return;
        }
      }

      // Add song to queue
      serverQueue.songs.push(songInfo);

      // Create a nice embed
      const addedEmbed = new EmbedBuilder()
        .setColor("#F9A825")
        .setTitle("🎵 Added to Queue")
        .setDescription(`**[${songInfo.title}](${songInfo.url})**`)
        .setThumbnail(songInfo.thumbnail)
        .addFields(
          {
            name: "Duration",
            value: formatDuration(songInfo.duration),
            inline: true,
          },
          {
            name: "Position",
            value:
              serverQueue.songs.length > 1
                ? `#${serverQueue.songs.length}`
                : "Now Playing",
            inline: true,
          }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      await interaction.editReply({ embeds: [addedEmbed] });

      // If this is the first song, start playing
      if (serverQueue.songs.length === 1) {
        console.log(
          `[${new Date().toISOString()}] Starting to play first song in queue`
        );
        playSong(interaction.guild.id, serverQueue);
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error executing music slash command:`,
        error
      );
      await interaction.editReply(
        `⚠️ There was an error playing this song: ${error.message}`
      );
    }
  },
};

// Export remaining command handlers (implementation not shown for brevity)
export const skipConfig = {
  aliases: ["s", "skip", "next"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("There is no song playing to skip!");
    }
    message.reply("⏭️ Skipping to the next song...");
    serverQueue.player.stop();
  },
};

export const stopConfig = {
  aliases: ["leave", "disconnect"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("I'm not currently in a voice channel!");
    }

    serverQueue.songs = [];
    serverQueue.connection.destroy();
    musicConnections.delete(message.guild.id);
    message.reply("👋 Stopped the music and left the voice channel!");
  },
};

export const queueConfig = {
  aliases: ["q", "list"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue || !serverQueue.songs.length) {
      return message.reply("There are no songs in the queue!");
    }

    const queueEmbed = new EmbedBuilder()
      .setColor("#F9A825")
      .setTitle("🎵 Current Queue")
      .setDescription(
        serverQueue.songs
          .map(
            (song, index) =>
              `${index === 0 ? "🔊 **NOW PLAYING**" : `${index}.`} [${
                song.title
              }](${song.url}) - ${formatDuration(song.duration)}`
          )
          .join("\n")
      )
      .setFooter({ text: `Total songs: ${serverQueue.songs.length}` });

    message.reply({ embeds: [queueEmbed] });
  },
};

export const playConfig = {
  aliases: ["p", "play"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("There is no song playing to resume!");
    }
    message.reply("⏯️ Resuming the music...");
    serverQueue.player.unpause();
  },
};

export const pauseConfig = {
  aliases: ["pause"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("There is no song playing to pause!");
    }
    message.reply("⏸️ Pausing the music...");
    serverQueue.player.pause();
  },
};

export const resumeConfig = {
  aliases: ["resume"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("There is no song playing to resume!");
    }
    message.reply("⏯️ Resuming the music...");
    serverQueue.player.unpause();
  },
};

export const shuffleConfig = {
  aliases: ["shuffle"],
  adminOnly: false,
  execute: async (message, args) => {
    const serverQueue = musicConnections.get(message.guild.id);
    if (!serverQueue) {
      return message.reply("There is no song playing to shuffle!");
    }
    message.reply("🔀 Shuffling the queue...");
    serverQueue.songs = shuffleArray(serverQueue.songs);
  },
};
