require('dotenv').config();
const config = require('./config');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, StringSelectMenuBuilder } = require('discord.js');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Discord Music Bot is running!');
});

app.listen(config.express.port, config.express.host, () => {
  console.log(`Express server running on port ${config.express.port}`);
});

const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, KazagumoTrack } = require('kazagumo');

// Set up intents based on prefix configuration
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
];

// Only add MessageContent intent if prefix commands are enabled
if (config.enablePrefix) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), config.lavalink.nodes);

const kazagumo = new Kazagumo({
  defaultSearchEngine: config.lavalink.defaultSearchEngine,
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  }
}, new Connectors.DiscordJS(client), config.lavalink.nodes);

// YouTube Music only search function
async function searchTrack(query, requester) {
  try {
    let searchQuery = query;

    if (!query.startsWith('http') && !query.includes(':')) {
      searchQuery = 'ytmsearch:' + query;
    }

    const res = await kazagumo.search(searchQuery, { requester });

    if (res.loadType !== 'empty' && res.tracks && res.tracks.length > 0) {
      return res;
    }

    throw new Error('No tracks found on YouTube Music for your search query');

  } catch (error) {
    console.error('YouTube Music search failed:', error.message);
    throw error;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays a song')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current song'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip to the next song'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show currently playing song'),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle loop mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('Position in queue')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a song to a different position')
    .addIntegerOption(option =>
      option.setName('from')
        .setDescription('From position')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('to')
        .setDescription('To position')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clear the queue'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops the music and leaves'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the volume')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Volume level (0-100)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all commands'),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get bot invite link'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows bot ping'),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows bot statistics'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Join our support server'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Set activity from config
  const activityType = ActivityType[config.activity.type] || ActivityType.Listening;
  client.user.setActivity(config.activity.name, { type: activityType });

  try {
    console.log('Refreshing slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }

  console.log(`Prefix commands: ${config.enablePrefix ? 'Enabled' : 'Disabled'}`);
  if (config.enablePrefix) {
    console.log(`Prefix: ${config.prefix}`);
  }
});

function createMusicEmbed(track) {
  return new EmbedBuilder()
    .setTitle(`${config.emojis.nowplaying} Now Playing`)
    .setDescription(`[${track.title}](${track.uri})`)
    .addFields(
      { name: `${config.emojis.user} Artist`, value: track.author || 'Unknown', inline: true },
      { name: `${config.emojis.duration} Duration`, value: formatDuration(track.length || track.duration), inline: true }
    )
    .setThumbnail(track.thumbnail || track.artworkUrl)
    .setColor('#FF0000');
}

function formatDuration(duration) {
  if (!duration || duration === 0) return 'Unknown';
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createControlButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pause')
          .setLabel('Pause/Resume')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('loop')
          .setLabel('Loop')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('queue')
          .setLabel('Queue')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

// Prefix command handler
async function handlePrefixCommand(message) {
  if (!config.enablePrefix) return;
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Create a mock interaction object for reusing slash command logic
  const mockInteraction = {
    member: message.member,
    user: message.author,
    guild: message.guild,
    channel: message.channel,
    options: {
      getString: (name) => args.join(' '),
      getInteger: (name) => parseInt(args[0]) || 0
    },
    reply: async (content) => message.reply(content),
    editReply: async (content) => message.reply(content),
    deferReply: async () => {},
    replied: false,
    deferred: false
  };

  // Handle prefix commands
  switch (command) {
    case 'play':
      if (args.length === 0) return message.reply('Please provide a song name or URL!');
      await handlePlayCommand(mockInteraction, args.join(' '));
      break;
    case 'pause':
      await handlePauseCommand(mockInteraction);
      break;
    case 'resume':
      await handleResumeCommand(mockInteraction);
      break;
    case 'skip':
      await handleSkipCommand(mockInteraction);
      break;
    case 'queue':
      await handleQueueCommand(mockInteraction);
      break;
    case 'nowplaying':
    case 'np':
      await handleNowPlayingCommand(mockInteraction);
      break;
    case 'shuffle':
      await handleShuffleCommand(mockInteraction);
      break;
    case 'loop':
      await handleLoopCommand(mockInteraction, args[0] || 'track');
      break;
    case 'remove':
      if (!args[0]) return message.reply('Please provide a position!');
      await handleRemoveCommand(mockInteraction, parseInt(args[0]));
      break;
    case 'move':
      if (!args[0] || !args[1]) return message.reply('Please provide from and to positions!');
      await handleMoveCommand(mockInteraction, parseInt(args[0]), parseInt(args[1]));
      break;
    case 'clearqueue':
    case 'clear':
      await handleClearQueueCommand(mockInteraction);
      break;
    case 'stop':
      await handleStopCommand(mockInteraction);
      break;
    case 'volume':
    case 'vol':
      if (!args[0]) return message.reply('Please provide a volume level (0-100)!');
      await handleVolumeCommand(mockInteraction, parseInt(args[0]));
      break;
    case '247':
      await handle247Command(mockInteraction);
      break;
    case 'help':
      await handleHelpCommand(mockInteraction);
      break;
    case 'invite':
      await handleInviteCommand(mockInteraction);
      break;
    case 'ping':
      await handlePingCommand(mockInteraction);
      break;
    case 'stats':
      await handleStatsCommand(mockInteraction);
      break;
    case 'support':
      await handleSupportCommand(mockInteraction);
      break;
  }
}

// Command handler functions
async function handlePlayCommand(interaction, query) {
  if (!interaction.member.voice.channel) {
    return interaction.reply({ content: 'Join a voice channel first!' });
  }

  let player = kazagumo.players.get(interaction.guild.id);

  if (!player) {
    player = await kazagumo.createPlayer({
      guildId: interaction.guild.id,
      voiceId: interaction.member.voice.channel.id,
      textId: interaction.channel.id,
      deaf: true
    });
  }

  if (player.voiceId !== interaction.member.voice.channel.id) {
    player.setVoiceChannel(interaction.member.voice.channel.id);
  }

  if (!player.twentyFourSeven) player.twentyFourSeven = false;

  try {
    const res = await searchTrack(query, interaction.user);

    if (res.loadType === 'empty' || !res.tracks.length) {
      const errorEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.error} No Results Found`)
        .setDescription('No tracks found for your search query. Please try:\n• Different keywords\n• Artist name + song title\n• A direct URL')
        .setColor('#FF0000')
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();
      return interaction.reply({ embeds: [errorEmbed] });
    }

    if (res.loadType === 'playlist') {
      const playlist = res.playlist;
      const tracks = res.tracks;

      tracks.forEach(track => player.queue.add(track));

      const playlistEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.playlist} Playlist Added`)
        .setDescription(`Added **${tracks.length}** tracks from [${playlist.name}](${query})`)
        .addFields(
          { name: `${config.emojis.music} First Track`, value: `[${tracks[0].title}](${tracks[0].uri})`, inline: true },
          { name: `${config.emojis.duration} Total Duration`, value: formatDuration(tracks.reduce((acc, track) => acc + (track.length || 0), 0)), inline: true }
        )
        .setColor('#1DB954')
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();
      await interaction.reply({ embeds: [playlistEmbed] });
    } else {
      const track = res.tracks[0];
      player.queue.add(track);

      const embed = new EmbedBuilder()
        .setTitle(`${config.emojis.success} Track Added`)
        .setDescription(`[${track.title}](${track.uri})`)
        .addFields(
          { name: `${config.emojis.user} Artist`, value: track.author || 'Unknown', inline: true },
          { name: `${config.emojis.duration} Duration`, value: formatDuration(track.length || track.duration), inline: true },
          { name: `${config.emojis.position} Position`, value: `${player.queue.size}`, inline: true }
        )
        .setThumbnail(track.thumbnail || track.artworkUrl)
        .setColor('#1DB954')
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (!player.playing && !player.paused) {
      try {
        await player.play();
      } catch (playError) {
        console.error('Error starting playback:', playError);
        const playErrorEmbed = new EmbedBuilder()
          .setTitle(`${config.emojis.error} Playback Error`)
          .setDescription('Failed to start playback. Please try again or check if the bot has proper permissions.')
          .setColor('#FF0000')
          .setFooter({
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();
        await interaction.reply({ embeds: [playErrorEmbed] });
      }
    }

  } catch (error) {
    console.error('Play command error:', error);
    const errorEmbed = new EmbedBuilder()
      .setTitle(`${config.emojis.error} Search Failed`)
      .setDescription(`Failed to search for tracks: ${error.message}\n\nPlease try:\n• A different search term\n• Checking your internet connection\n• Using a direct URL`)
      .setColor('#FF0000')
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    await interaction.reply({ embeds: [errorEmbed] });
  }
}

async function handlePauseCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  player.pause(true);
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.pause} Paused`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleResumeCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  player.pause(false);
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.resume} Resumed`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleSkipCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  player.skip();
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.skip} Skipped`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleQueueCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  const queue = player.queue;
  const currentTrack = player.queue.current;
  let description = queue.size > 0 ? queue.map((track, i) =>
    `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

  if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

  const embed = new EmbedBuilder()
    .setTitle(`${config.emojis.queue} Queue`)
    .setDescription(description)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleNowPlayingCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  const track = player.queue.current;
  if (!track) return interaction.reply({ content: 'Not playing anything!' });

  const embed = createMusicEmbed(track);
  await interaction.reply({ embeds: [embed] });
}

async function handleShuffleCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  player.queue.shuffle();
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.shuffle} Shuffled the queue`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleLoopCommand(interaction, mode) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  switch (mode) {
    case 'off':
      player.setLoop('none');
      break;
    case 'track':
      player.setLoop('track');
      break;
    case 'queue':
      player.setLoop('queue');
      break;
    default:
      mode = 'track';
      player.setLoop('track');
  }

  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.loop} Loop mode set to: ${mode}`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleRemoveCommand(interaction, position) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  const pos = position - 1;
  if (pos < 0 || pos >= player.queue.size) {
    return interaction.reply({ content: 'Invalid position!' });
  }

  const removed = player.queue.remove(pos);
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.error} Removed [${removed.title}](${removed.uri})`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleMoveCommand(interaction, from, to) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  const fromPos = from - 1;
  const toPos = to - 1;

  if (fromPos < 0 || fromPos >= player.queue.size || toPos < 0 || toPos >= player.queue.size) {
    return interaction.reply({ content: 'Invalid position!' });
  }

  const track = player.queue.at(fromPos);
  player.queue.remove(fromPos);
  player.queue.add(track, toPos);

  const embed = new EmbedBuilder()
    .setDescription(`📦 Moved [${track.title}](${track.uri}) to position ${to}`)
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleClearQueueCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  player.queue.clear();
  const embed = new EmbedBuilder()
    .setDescription('🗑️ Cleared the queue')
    .setColor('#FF0000')
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleStopCommand(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (player) {
    player.data.set('manualStop', true);
    const message = player.data.get('currentMessage');
    if (message && message.editable) {
      const disabledButtons = message.components[0].components.map(button => {
        return ButtonBuilder.from(button).setDisabled(true);
      });
      message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
    }
    const embed = new EmbedBuilder()
      .setDescription('Queue has ended!')
      .setColor('#FF0000')
      .setTimestamp();
    await interaction.channel.send({ embeds: [embed] });
    player.destroy();
    await interaction.reply({ content: `${config.emojis.stop} Stopped the music and left` });
  } else {
    await interaction.reply({ content: 'Not playing anything!' });
  }
}

async function handleVolumeCommand(interaction, volume) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'Not playing anything!' });

  if (volume < 0 || volume > 100) {
    return interaction.reply({ content: 'Volume must be between 0 and 100!' });
  }

  player.setGlobalVolume(volume);
  await interaction.reply({ content: `${config.emojis.volume} Volume set to ${volume}%` });
}

async function handle247Command(interaction) {
  const player = kazagumo.players.get(interaction.guild.id);
  if (!player) return interaction.reply({ content: 'No music is playing!' });

  player.twentyFourSeven = !player.twentyFourSeven;
  const embed = new EmbedBuilder()
    .setDescription(`${config.emojis.music} 24/7 mode is now ${player.twentyFourSeven ? 'enabled' : 'disabled'}`)
    .setColor('#FF0000')
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleHelpCommand(interaction) {
  const cmdPrefix = config.enablePrefix ? config.prefix : '/';
  
  const mainEmbed = new EmbedBuilder()
    .setAuthor({
      name: `${client.user.username} • Premium Music Experience`,
      iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 }),
      url: config.urls.github
    })
    .setTitle('🎵 Advanced Music Commands')
    .setDescription(`> **The most feature-rich Discord music bot**\n> High-quality audio • Lightning fast • 24/7 uptime\n\n**Quick Start:** Use \`${cmdPrefix}play <song>\` to begin your musical journey!`)
    .addFields(
      {
        name: '🎮 **Essential Controls**',
        value: [
          `\`${cmdPrefix}play\` ${config.emojis.play} **Play** any song or playlist`,
          `\`${cmdPrefix}pause\` ${config.emojis.pause} **Pause** current track`,
          `\`${cmdPrefix}resume\` ${config.emojis.resume} **Resume** playback`,
          `\`${cmdPrefix}skip\` ${config.emojis.skip} **Skip** to next track`,
          `\`${cmdPrefix}stop\` ${config.emojis.stop} **Stop** and disconnect`,
          `\`${cmdPrefix}volume\` ${config.emojis.volume} **Volume** control (0-100)`
        ].join('\n'),
        inline: false
      },
      {
        name: '📋 **Queue Management**',
        value: [
          `\`${cmdPrefix}queue\` ${config.emojis.queue} **Display** current queue`,
          `\`${cmdPrefix}nowplaying\` ${config.emojis.nowplaying} **Current** track info`,
          `\`${cmdPrefix}shuffle\` ${config.emojis.shuffle} **Randomize** queue order`,
          `\`${cmdPrefix}loop\` ${config.emojis.loop} **Loop** modes (off/track/queue)`,
          `\`${cmdPrefix}remove\` ${config.emojis.error} **Remove** track by position`,
          `\`${cmdPrefix}move\` ↕️ **Reorder** tracks in queue`,
          `\`${cmdPrefix}clearqueue\` 🗑️ **Clear** entire queue`
        ].join('\n'),
        inline: false
      },
      {
        name: '⚡ **Advanced Features**',
        value: [
          `\`${cmdPrefix}247\` ${config.emojis.loop} **24/7** continuous mode`,
          `\`${cmdPrefix}stats\` ${config.emojis.stats} **Statistics** & performance`,
          `\`${cmdPrefix}ping\` ${config.emojis.ping} **Latency** check`,
          `\`${cmdPrefix}invite\` ${config.emojis.invite} **Add** bot to server`,
          `\`${cmdPrefix}support\` ${config.emojis.support} **Get** help & support`
        ].join('\n'),
        inline: false
      }
    )
    .setColor(0x9B59B6)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `🎧 Serving ${client.guilds.cache.size} servers • Made with ❤️ by Unknownz`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  const commandTypeEmbed = new EmbedBuilder()
    .setTitle('🔧 **Command System Information**')
    .setColor(0x3498DB)
    .addFields(
      {
        name: '💫 **Dual Command Support**',
        value: config.enablePrefix 
          ? `✅ **Slash Commands:** Use \`/command\` for modern Discord experience\n✅ **Prefix Commands:** Use \`${config.prefix}command\` for quick access\n\n*Both methods work identically - choose your preference!*`
          : '✅ **Slash Commands Only:** Use `/command` for the best Discord experience\n\n*Prefix commands are currently disabled for optimal performance*',
        inline: false
      },
      {
        name: '🎯 **Pro Tips**',
        value: [
          '• Use **interactive buttons** on music embeds for quick controls',
          '• **URLs** from YouTube, Spotify, SoundCloud are supported',
          '• **Search** by artist, song name, or any keywords',
          '• **Playlists** are automatically detected and queued',
          '• **Voice channel** required to use music commands'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        .setEmoji('📨'),
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL(config.urls.support)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId('refresh_help')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );

  await interaction.reply({ 
    embeds: [mainEmbed, commandTypeEmbed], 
    components: [buttonRow]
  });
}

async function handleInviteCommand(interaction) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${client.user.username} • Bot Invitation`,
      iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 })
    })
    .setTitle(`${config.emojis.invite} **Add Me to Your Server!**`)
    .setDescription([
      '> **Transform your server into a premium music hub!**',
      '',
      '🎵 **What you\'ll get:**',
      '• High-quality music streaming',
      '• Advanced queue management',
      '• Interactive music controls',
      '• 24/7 music support',
      '• Lightning-fast responses',
      '',
      '**[🚀 Click here to invite me!](https://discord.com/api/oauth2/authorize?client_id=' + client.user.id + '&permissions=8&scope=bot%20applications.commands)**'
    ].join('\n'))
    .addFields(
      {
        name: '⚠️ **Required Permissions**',
        value: [
          '• Connect & Speak in voice channels',
          '• Send messages & embeds',
          '• Use external emojis',
          '• Manage messages (for cleanup)'
        ].join('\n'),
        inline: true
      },
      {
        name: '✨ **Instant Setup**',
        value: [
          '• Join a voice channel',
          '• Use `/play <song>`',
          '• Enjoy premium music!',
          '• Check `/help` for more'
        ].join('\n'),
        inline: true
      }
    )
    .setColor(0x00FF7F)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `🎧 Already serving ${client.guilds.cache.size} servers • Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Invite Now')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setLabel('💬 Support')
        .setStyle(ButtonStyle.Link)
        .setURL(config.urls.support)
        .setEmoji('💬')
    );

  await interaction.reply({ embeds: [embed], components: [buttonRow] });
}

async function handlePingCommand(interaction) {
  const start = Date.now();
  await interaction.deferReply();
  const end = Date.now();
  
  const apiLatency = end - start;
  const wsLatency = Math.round(client.ws.ping);
  
  let latencyColor = 0x00FF00; // Green
  let latencyStatus = 'Excellent';
  
  if (wsLatency > 100) {
    latencyColor = 0xFFFF00; // Yellow
    latencyStatus = 'Good';
  }
  if (wsLatency > 200) {
    latencyColor = 0xFF7F00; // Orange
    latencyStatus = 'Average';
  }
  if (wsLatency > 300) {
    latencyColor = 0xFF0000; // Red
    latencyStatus = 'Poor';
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${client.user.username} • Network Diagnostics`,
      iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 })
    })
    .setTitle(`${config.emojis.ping} **Connection Status**`)
    .setDescription(`> **Current network performance metrics**`)
    .addFields(
      {
        name: '🌐 **WebSocket Latency**',
        value: `\`${wsLatency}ms\` • ${latencyStatus}`,
        inline: true
      },
      {
        name: '⚡ **API Response Time**',
        value: `\`${apiLatency}ms\``,
        inline: true
      },
      {
        name: '📊 **Status**',
        value: wsLatency < 100 ? '🟢 Optimal' : wsLatency < 200 ? '🟡 Good' : wsLatency < 300 ? '🟠 Fair' : '🔴 Slow',
        inline: true
      },
      {
        name: '🎵 **Music Quality**',
        value: wsLatency < 150 ? '**HD Audio** • No interruptions' : wsLatency < 250 ? '**Good Audio** • Minor delays possible' : '**Standard Audio** • Some buffering may occur',
        inline: false
      }
    )
    .setColor(latencyColor)
    .setFooter({
      text: `🔗 Shard latency checked • Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleStatsCommand(interaction) {
  const uptime = Math.round(client.uptime / 1000);
  const seconds = uptime % 60;
  const minutes = Math.floor((uptime % 3600) / 60);
  const hours = Math.floor((uptime % 86400) / 3600);
  const days = Math.floor(uptime / 86400);

  const memoryUsage = process.memoryUsage();
  const totalMemory = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const usedMemory = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  
  const activePlayers = kazagumo.players.size;
  const playingPlayers = Array.from(kazagumo.players.values()).filter(p => p.playing).length;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${client.user.username} • System Statistics`,
      iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 })
    })
    .setTitle(`${config.emojis.stats} **Performance Dashboard**`)
    .setDescription('> **Real-time bot performance metrics and analytics**')
    .addFields(
      {
        name: '🤖 **Bot Information**',
        value: [
          `**Name:** ${client.user.username}`,
          `**ID:** \`${client.user.id}\``,
          `**Version:** Discord.js v14`,
          `**Node.js:** ${process.version}`
        ].join('\n'),
        inline: true
      },
      {
        name: '⏰ **Uptime & Performance**',
        value: [
          `**Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s`,
          `**Latency:** ${Math.round(client.ws.ping)}ms`,
          `**Memory:** ${usedMemory}MB / ${totalMemory}MB`,
          `**CPU:** Node.js ${process.version}`
        ].join('\n'),
        inline: true
      },
      {
        name: '📊 **Usage Statistics**',
        value: [
          `**Servers:** ${client.guilds.cache.size.toLocaleString()}`,
          `**Users:** ${client.users.cache.size.toLocaleString()}`,
          `**Channels:** ${client.channels.cache.size.toLocaleString()}`,
          `**Commands:** ${config.enablePrefix ? 'Slash + Prefix' : 'Slash Only'}`
        ].join('\n'),
        inline: true
      },
      {
        name: '🎵 **Music Analytics**',
        value: [
          `**Total Players:** ${activePlayers}`,
          `**Currently Playing:** ${playingPlayers}`,
          `**Audio Engine:** Kazagumo + Shoukaku`,
          `**Audio Quality:** High Definition`
        ].join('\n'),
        inline: true
      },
      {
        name: '🌐 **Network Status**',
        value: [
          `**Lavalink Nodes:** ${config.lavalink.nodes.length} connected`,
          `**Search Engine:** ${config.lavalink.defaultSearchEngine}`,
          `**Express Server:** Port ${config.express.port}`,
          `**Status:** 🟢 All systems operational`
        ].join('\n'),
        inline: true
      },
      {
        name: '⚡ **Features Enabled**',
        value: [
          `**24/7 Mode:** Available`,
          `**Queue Management:** Advanced`,
          `**Audio Filters:** Pro Edition`,
          `**Auto Reconnect:** Enabled`
        ].join('\n'),
        inline: true
      }
    )
    .setColor(0x7289DA)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `📈 Statistics updated in real-time • Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_stats')
        .setLabel('🔄 Refresh Stats')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setLabel('📊 Detailed Metrics')
        .setStyle(ButtonStyle.Link)
        .setURL(config.urls.github)
        .setEmoji('📊')
    );

  await interaction.reply({ embeds: [embed], components: [buttonRow] });
}

async function handleSupportCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle(`${config.emojis.support} Support Server`)
    .setDescription(`[Click here to join our support server](${config.urls.support})`)
    .setColor('#FF0000')
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

// Message event for prefix commands
if (config.enablePrefix) {
  client.on('messageCreate', handlePrefixCommand);
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

    if (interaction.isButton()) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag
      }

      if (!interaction.member.voice.channel) {
        return interaction.editReply({ content: 'You need to join a voice channel to use the buttons!' });
      }
      const player = kazagumo.players.get(interaction.guild.id);
      if (!player) return interaction.editReply({ content: 'No player found!' });

      const currentTrack = player.queue.current;
      if (!currentTrack) return interaction.editReply({ content: 'No track is currently playing!' });

      if (currentTrack.requester.id !== interaction.user.id) {
        return interaction.editReply({ content: 'Only the person who requested this song can use these buttons!' });
      }

      switch (interaction.customId) {
        case 'pause':
          player.pause(!player.paused);
          await interaction.editReply({ content: player.paused ? 'Paused' : 'Resumed' });
          break;
        case 'skip':
          const skipMessage = player.data.get('currentMessage');
          if (skipMessage && skipMessage.editable) {
            try {
              const disabledButtons = skipMessage.components[0].components.map(button => {
                return ButtonBuilder.from(button).setDisabled(true);
              });
              await skipMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
            } catch (err) {
              console.error('Error disabling buttons:', err);
            }
          }
          if (player.queue.size === 0) {
            const queueEndEmbed = new EmbedBuilder()
              .setDescription('Queue has ended!')
              .setColor('#FF0000')
              .setTimestamp();
            await interaction.channel.send({ embeds: [queueEndEmbed] });
            player.data.set('manualStop', true);
          }
          player.skip();
          await interaction.editReply({ content: 'Skipped' });
          break;
        case 'stop':
          const stopMessage = player.data.get('currentMessage');
          if (stopMessage && stopMessage.editable) {
            try {
              const disabledButtons = stopMessage.components[0].components.map(button => {
                return ButtonBuilder.from(button).setDisabled(true);
              });
              await stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
            } catch (err) {
              console.error('Error disabling buttons:', err);
            }
          }
          player.data.set('manualStop', true);
          const stopEmbed = new EmbedBuilder()
            .setDescription('Queue has ended!')
            .setColor('#FF0000')
            .setTimestamp();
          await interaction.channel.send({ embeds: [stopEmbed] });
          player.destroy();
          await interaction.editReply({ content: 'Stopped' });
          break;
        case 'loop':
          const currentLoop = player.loop || 'none';
          const newLoop = currentLoop === 'none' ? 'track' : 'none';
          player.setLoop(newLoop);
          await interaction.editReply({ content: `Loop: ${newLoop === 'none' ? 'Disabled' : 'Enabled'}` });
          break;
        case 'queue':
          const queue = player.queue;
          const currentTrack2 = player.queue.current;
          let description = queue.size > 0 ? queue.map((track, i) =>
            `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

          if (currentTrack2) description = `**Now Playing:**\n[${currentTrack2.title}](${currentTrack2.uri})\n\n**Queue:**\n${description}`;

          const embed = new EmbedBuilder()
            .setTitle('Queue')
            .setDescription(description)
            .setColor('#FF0000')
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          break;
      }
      return;
    }

    // Handle refresh buttons
    if (interaction.isButton() && (interaction.customId === 'refresh_help' || interaction.customId === 'refresh_stats')) {
      if (interaction.customId === 'refresh_help') {
        await handleHelpCommand(interaction);
        return;
      } else if (interaction.customId === 'refresh_stats') {
        await handleStatsCommand(interaction);
        return;
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'filter') {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag
      }

      const player = kazagumo.players.get(interaction.guild.id);
      if (!player) return interaction.editReply({ content: 'No player found!' });

      const filter = interaction.values[0];
      player.shoukaku.setFilters({
        [filter]: true
      });

      const embed = new EmbedBuilder()
        .setDescription(`${config.emojis.music} Applied filter: ${filter}`)
        .setColor('#FF0000')
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (!interaction.isCommand()) return;

    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    const { commandName, options } = interaction;

    switch (commandName) {
      case 'play':
        await handlePlayCommand(interaction, options.getString('query'));
        break;
      case 'pause':
        await handlePauseCommand(interaction);
        break;
      case 'resume':
        await handleResumeCommand(interaction);
        break;
      case 'skip':
        await handleSkipCommand(interaction);
        break;
      case 'queue':
        await handleQueueCommand(interaction);
        break;
      case 'nowplaying':
        await handleNowPlayingCommand(interaction);
        break;
      case 'shuffle':
        await handleShuffleCommand(interaction);
        break;
      case 'loop':
        await handleLoopCommand(interaction, options.getString('mode'));
        break;
      case 'remove':
        await handleRemoveCommand(interaction, options.getInteger('position'));
        break;
      case 'move':
        await handleMoveCommand(interaction, options.getInteger('from'), options.getInteger('to'));
        break;
      case 'clearqueue':
        await handleClearQueueCommand(interaction);
        break;
      case 'stop':
        await handleStopCommand(interaction);
        break;
      case 'volume':
        await handleVolumeCommand(interaction, options.getInteger('level'));
        break;
      case '247':
        await handle247Command(interaction);
        break;
      case 'help':
        await handleHelpCommand(interaction);
        break;
      case 'invite':
        await handleInviteCommand(interaction);
        break;
      case 'ping':
        await handlePingCommand(interaction);
        break;
      case 'stats':
        await handleStatsCommand(interaction);
        break;
      case 'support':
        await handleSupportCommand(interaction);
        break;
      default:
        await interaction.editReply({ content: 'Unknown command!' });
        break;
    }
  } catch (error) {
    console.error('Interaction error:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing your command!', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while processing your command!' });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
});

shoukaku.on('ready', (name) => {
  console.log(`Node ${name} connected`);
});

shoukaku.on('error', (name, error) => {
  console.error(`Node ${name} error:`, error.message || error);
});

shoukaku.on('close', (name, code, reason) => {
  console.log(`Node ${name} closed with code ${code} and reason ${reason}`);
});

shoukaku.on('disconnect', (name, players, moved) => {
  console.log(`Node ${name} disconnected`);
  if (moved) {
    console.log(`${players} players moved to other nodes`);
  }
});

kazagumo.on('playerStart', (player, track) => {
  try {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      const embed = createMusicEmbed(track);
      const buttons = createControlButtons();
      channel.send({ embeds: [embed], components: buttons }).then(msg => {
        player.data.set('currentMessage', msg);
      }).catch(error => {
        console.error('Failed to send now playing message:', error);
      });
    }
  } catch (error) {
    console.error('Error in playerStart event:', error);
  }
});

kazagumo.on('playerEnd', async (player) => {
  try {
    if (player.data.get('manualStop')) return;

    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      if (player.queue.size === 0) {
        const embed = new EmbedBuilder()
          .setDescription(`${config.emojis.music} Queue has ended!`)
          .setColor('#FF0000')
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(error => {
          console.error('Failed to send queue ended message:', error);
        });
      }

      const message = player.data.get('currentMessage');
      if (message && message.editable) {
        try {
          if (message.components && message.components[0] && message.components[0].components) {
            const disabledButtons = message.components[0].components.map(button => {
              return ButtonBuilder.from(button).setDisabled(true);
            });
            await message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
          }
        } catch (error) {
          console.error('Error disabling buttons:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error in playerEnd event:', error);
  }
});

kazagumo.on('playerError', (player, error) => {
  console.error('Player error:', error);

  try {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      const errorEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.error} Playback Error`)
        .setDescription('An error occurred during playback. Skipping to the next track...')
        .setColor('#FF0000')
        .setTimestamp();

      channel.send({ embeds: [errorEmbed] }).catch(console.error);

      if (player.queue.size > 0) {
        player.skip();
      } else {
        player.destroy();
      }
    }
  } catch (err) {
    console.error('Error handling player error:', err);
  }
});

kazagumo.on('playerException', (player, exception) => {
  console.error('Player exception:', exception);

  try {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      const exceptionEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.warning} Playback Exception`)
        .setDescription('A playback exception occurred. The track may be unavailable or corrupted.')
        .setColor('#FFA500')
        .setTimestamp();

      channel.send({ embeds: [exceptionEmbed] }).catch(console.error);
    }
  } catch (err) {
    console.error('Error handling player exception:', err);
  }
});

kazagumo.on('playerResolveError', (player, track, message) => {
  console.error('Player resolve error:', message);

  try {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      const resolveErrorEmbed = new EmbedBuilder()
        .setTitle('🔍 Track Resolution Error')
        .setDescription(`Failed to resolve track: **${track.title}**\nReason: ${message}`)
        .setColor('#FF0000')
        .setTimestamp();

      channel.send({ embeds: [resolveErrorEmbed] }).catch(console.error);
    }
  } catch (err) {
    console.error('Error handling resolve error:', err);
  }
});

kazagumo.on('playerDestroy', async (player) => {
  console.log(`Player destroyed for guild: ${player.guildId}`);

  try {
    const message = player.data.get('currentMessage');
    if (message && message.editable) {
      try {
        if (message.components && message.components[0] && message.components[0].components) {
          const disabledButtons = message.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          await message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
      } catch (error) {
        console.error('Error disabling buttons in playerDestroy:', error);
      }
    }
  } catch (error) {
    console.error('Error in playerDestroy event:', error);
  }
});

client.login(config.token);