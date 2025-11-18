require('dotenv').config();
const config = require('./config');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, StringSelectMenuBuilder, ChannelType } = require('discord.js');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`${config.botInfo.name} is running!`);
});

// FIX for Render Hosting: Use process.env.PORT, listening on '0.0.0.0'
const PORT = process.env.PORT || config.express.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server running on port ${PORT}`);
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

// Client Ready Event 
client.on('clientReady', () => {
  console.log(`${client.user.tag} (${config.botInfo.name}) is online!`);

  client.user.setActivity({
    name: config.activity.name,
    type: ActivityType[config.activity.type],
  });

  // Register Slash Commands
  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Plays a song or adds it to the queue.')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('The song name or URL')
          .setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('Skips the current song.'),
    new SlashCommandBuilder().setName('stop').setDescription('Stops the music and clears the queue.'),
    new SlashCommandBuilder().setName('queue').setDescription('Displays the current queue.'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('Shows the current playing song.'),
    new SlashCommandBuilder().setName('pause').setDescription('Pauses the current song.'),
    new SlashCommandBuilder().setName('resume').setDescription('Resumes the current song.'),
    new SlashCommandBuilder().setName('shuffle').setDescription('Shuffles the queue.'),
    new SlashCommandBuilder().setName('loop').setDescription('Sets the loop mode (off/track/queue).')
      .addStringOption(option =>
        option.setName('mode')
          .setDescription('The loop mode')
          .setRequired(true)
          .addChoices(
            { name: 'Off', value: 'none' },
            { name: 'Track', value: 'track' },
            { name: 'Queue', value: 'queue' },
          )),
    new SlashCommandBuilder().setName('volume').setDescription('Adjusts the player volume.')
      .addIntegerOption(option =>
        option.setName('level')
          .setDescription('Volume level (0-100)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(100)),
    new SlashCommandBuilder().setName('247').setDescription('Toggles 24/7 mode (keeps bot in VC even when queue ends).'),
    new SlashCommandBuilder().setName('help').setDescription('Shows the list of commands.'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.token);

  (async () => {
    try {
      console.log('Started refreshing application (/) commands.');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );
      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error(error);
    }
  })();
});

// Shoukaku (Lavalink) Events
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name}: Ready`));
shoukaku.on('error', (name, error) => console.error(`Lavalink Node ${name}: Error - ${error.message}`));
shoukaku.on('close', (name, code, reason) => console.warn(`Lavalink Node ${name}: Closed - Code ${code} | Reason: ${reason || 'No reason'}`));
shoukaku.on('disconnect', (name, players) => console.warn(`Lavalink Node ${name}: Disconnected | Affected players: ${players.size}`));
shoukaku.on('debug', (name, info) => console.debug(`Lavalink Node ${name}: Debug - ${info}`));

// Kazagumo (Music Player) Events
kazagumo.on('playerCreate', (player) => {
  console.log(`Player created for guild: ${player.guildId}`);
  player.data.set('twentyFourSeven', false); // Initialize 24/7 mode state
});

// Player Start Event
kazagumo.on('playerStart', async (player, track) => {
  console.log(`Now playing: ${track.title} in guild: ${player.guildId}`);

  try {
    const channel = client.channels.cache.get(player.textId);

    if (channel) {
      // Safely check for track duration
      const durationString = track.duration && track.duration.asString ? track.duration.asString() : 'N/A';

      // Create the "Now Playing" embed
      const embed = new EmbedBuilder()
        .setTitle(`${config.emojis.nowplaying} Now Playing`)
        .setDescription(`[${track.title}](${track.uri}) - \`${durationString}\``)
        .setThumbnail(track.thumbnail || null)
        .setColor('#0099ff')
        .setFooter({ text: `Requested by ${track.requester.tag}`, iconURL: track.requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      // Create action row with control buttons
      const controlsRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('pause').setLabel('Pause').setStyle(ButtonStyle.Primary).setEmoji(config.emojis.pause),
          new ButtonBuilder().setCustomId('skip').setLabel('Skip').setStyle(ButtonStyle.Secondary).setEmoji(config.emojis.skip),
          new ButtonBuilder().setCustomId('stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji(config.emojis.stop),
          new ButtonBuilder().setCustomId('loop').setLabel('Loop').setStyle(ButtonStyle.Secondary).setEmoji(config.emojis.loop),
          new ButtonBuilder().setCustomId('shuffle').setLabel('Shuffle').setStyle(ButtonStyle.Secondary).setEmoji(config.emojis.shuffle)
        );

      // Send the new message and store it for later reference
      let currentMessage;
      try {
        currentMessage = await channel.send({ embeds: [embed], components: [controlsRow] });
      } catch (msgError) {
        console.error('Error sending Now Playing message (Permissions Issue?):', msgError.message);
        return; 
      }
      
      // Store the message object in player data
      player.data.set('currentMessage', currentMessage);

      // Delete the previous 'Now Playing' message if it exists and is deletable
      const previousMessage = player.data.get('previousMessage');
      if (previousMessage && previousMessage.deletable) {
        try {
          await previousMessage.delete();
        } catch (error) {
          if (error.code !== 10008) console.error('Error deleting previous message:', error);
        }
      }

      // Update the previous message
      player.data.set('previousMessage', currentMessage);
    }
  } catch (err) {
    console.error('CRITICAL: Error handling playerStart event. Destroying player:', err);
    // Destroy the player to prevent a stuck state if something goes wrong
    player.destroy(); 
  }
});

// Player End Event
kazagumo.on('playerEnd', async (player) => {
  console.log(`Player ended for guild: ${player.guildId}`);

  const message = player.data.get('currentMessage');

  if (!player.data.get('twentyFourSeven') && player.queue.length === 0) {
    if (message && message.editable) {
      try {
        if (message.components && message.components[0] && message.components[0].components) {
          const disabledButtons = message.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          await message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
      } catch (error) {
        console.error('Error disabling buttons in playerEnd:', error);
      }
    }

    const endEmbed = new EmbedBuilder()
      .setDescription(`${config.emojis.stop} **Queue has ended! Disconnecting...**`)
      .setColor('#FF0000')
      .setTimestamp();

    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      await channel.send({ embeds: [endEmbed] }).catch(console.error);
    }

    player.destroy();
  }
});

kazagumo.on('playerException', async (player, type, err) => {
  console.error(`Player exception (${type}) in guild: ${player.guildId}:`, err);

  try {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      const exceptionEmbed = new EmbedBuilder()
        .setTitle('⚠️ Player Error')
        .setDescription(`An error occurred while playing music: \`${err.message}\``)
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

// Player Destroy Event - Handles cleanup and topic reset
kazagumo.on('playerDestroy', async (player) => {
  console.log(`Player destroyed for guild: ${player.guildId}`);

  // >>> NEW: Reset Voice Channel Topic when player is destroyed <<<
  try {
    const voiceChannel = client.channels.cache.get(player.voiceId);
    // Check if channel exists, is a voice channel, and the bot has permissions to manage it.
    if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice && voiceChannel.manageable && voiceChannel.topic !== config.voiceChannelStatus.idleMessage) {
        await voiceChannel.setTopic(config.voiceChannelStatus.idleMessage).catch(console.error);
    }
  } catch (error) {
    console.error('Error resetting VC topic in playerDestroy:', error);
  }
  // >>> END NEW <<<
  
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
    console.error('Error in playerDestroy message cleanup:', error);
  }
});

// Helper function to get or create player (Modified for Channel Topic)
async function getOrCreatePlayer(interaction, voiceChannel) {
  let player = kazagumo.players.get(interaction.guildId);

  if (!player) {
    player = await kazagumo.createPlayer({
      guildId: interaction.guildId,
      voiceId: voiceChannel.id,
      textId: interaction.channelId,
      shardId: interaction.guild.shardId,
      volume: 100,
    });
  } else if (player.voiceId !== voiceChannel.id) {
    await player.setVoiceChannel(voiceChannel.id);
    player.setTextChannel(interaction.channelId); 
  }

  // >>> NEW: Set Voice Channel Topic when joining/creating player <<<
  // Check if channel is a voice channel and the bot has permissions to manage it.
  if (voiceChannel.type === ChannelType.GuildVoice && voiceChannel.manageable && voiceChannel.topic !== config.voiceChannelStatus.playMessage) {
      await voiceChannel.setTopic(config.voiceChannelStatus.playMessage).catch(console.error);
  }
  // >>> END NEW <<<

  return player;
}


// --- HELP COMMAND FUNCTIONS ---

// Function to handle the initial help command setup (main embed and select menu)
async function handleHelpCommand(interaction, isRefresh = false) {
  const client = interaction.client;
  
  const mainEmbed = new EmbedBuilder()
    .setAuthor({
      name: `${config.botInfo.name} • Help Menu`,
      iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 }),
      url: config.botInfo.github
    })
    .setTitle(`Hello @${interaction.user.username}, choose a category below:`)
    .setDescription(`**${config.botInfo.name}** is an advanced Discord music bot built for a seamless, high-quality audio experience.`)
    .addFields(
      {
        name: '👤 Owner Information',
        value: `This bot is managed by **${config.botInfo.owner}**.`
      },
      {
        name: '❓ Quick Guide',
        value: 'Use the dropdown menu below to navigate all commands and features of the bot.'
      }
    )
    .setColor(0x00A86B) // A pleasant green/blue
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `🎧 Serving ${client.guilds.cache.size} servers • Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  // 1. Create the Select Menu for Categories
  const selectMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a category')
        .addOptions([
          {
            label: 'Home',
            description: 'Back to main menu',
            value: 'home',
          },
          {
            label: 'General',
            description: 'View general commands',
            value: 'general',
          },
          {
            label: 'Music',
            description: 'View music commands',
            value: 'music',
          },
          {
            label: 'Settings',
            description: 'View settings commands',
            value: 'settings',
          },
          {
            label: 'Moderation',
            description: 'View moderation commands',
            value: 'moderation',
          },
        ])
    );
    
  // 2. Create the Buttons Row (Invite/Support)
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Invite The Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        .setEmoji('📨'),
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL(config.support.server)
        .setEmoji('💬')
    );

  const payload = { 
    embeds: [mainEmbed], 
    components: [selectMenu, buttonRow]
  };

  if (isRefresh) {
    await interaction.update(payload);
  } else {
    await interaction.reply(payload);
  }
}

// Function to handle the select menu interaction and display category embeds
async function handleHelpMenuSelect(interaction) {
  const selectedCategory = interaction.values[0];
  const cmdPrefix = config.enablePrefix ? config.prefix : '/';
  
  let title = '';
  let description = '';
  let color = '#FF0000'; 
  
  if (selectedCategory === 'home') {
    return handleHelpCommand(interaction, true); // Go back to home view
  }
      
  switch (selectedCategory) {
    case 'general':
      title = '⚙️ General Commands';
      description = [
        `\`${cmdPrefix}ping\` ${config.emojis.ping} — **Check** the bot's latency`,
        `\`${cmdPrefix}stats\` ${config.emojis.stats} — **View** bot statistics and performance`,
        `\`${cmdPrefix}invite\` ${config.emojis.invite} — **Get** the bot's invite link`,
        `\`${cmdPrefix}support\` ${config.emojis.support} — **Join** the support server`,
        `\`${cmdPrefix}247\` ${config.emojis.loop} — **Toggle** 24/7 mode (Keeps bot in VC)`
      ].join('\n');
      color = '#3498DB'; 
      break;
      
    case 'music':
      title = `${config.emojis.music} Music Commands`;
      description = [
        `\`${cmdPrefix}play <query>\` ${config.emojis.play} — **Play** a song or playlist`,
        `\`${cmdPrefix}pause\` ${config.emojis.pause} — **Pause** the current song`,
        `\`${cmdPrefix}resume\` ${config.emojis.resume} — **Resume** paused playback`,
        `\`${cmdPrefix}skip\` ${config.emojis.skip} — **Skip** to the next track`,
        `\`${cmdPrefix}stop\` ${config.emojis.stop} — **Stop** player and clear queue`,
        `\`${cmdPrefix}queue\` ${config.emojis.queue} — **Show** the current queue list`,
        `\`${cmdPrefix}nowplaying\` ${config.emojis.nowplaying} — **Display** current song info`,
        `\`${cmdPrefix}shuffle\` ${config.emojis.shuffle} — **Randomize** the queue order`,
        `\`${cmdPrefix}loop <mode>\` ${config.emojis.loop} — **Toggle** loop mode (off/track/queue)`,
        `\`${cmdPrefix}volume <level>\` ${config.emojis.volume} — **Set** the player volume (0-100)`,
        // Added placeholders for future commands as shown in the previous response:
        `\`${cmdPrefix}remove <pos>\` ${config.emojis.error} — **Remove** a song by position`,
        `\`${cmdPrefix}move <from> <to>\` ↕️ — **Move** a song to a new position`,
        `\`${cmdPrefix}clearqueue\` 🗑️ — **Clear** the entire queue`
      ].join('\n');
      color = '#1DB954';
      break;
      
    case 'settings':
      title = '🔧 Settings Commands';
      description = 'This category is reserved for future settings commands (e.g., prefix, channel lock).';
      color = '#9B59B6'; 
      break;
      
    case 'moderation':
      title = '🛡️ Moderation Commands';
      description = 'This category is reserved for future moderation commands.';
      color = '#E74C3C';
      break;
  }
  
  const categoryEmbed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({
      text: `Requested by ${interaction.user.tag} • ${config.botInfo.name}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();
    
  // Edit the message with the new embed, keeping the components (select menu/buttons)
  await interaction.update({ embeds: [categoryEmbed] });
}
// --- END HELP COMMAND FUNCTIONS ---


// Slash Command Handler
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {

    const { commandName, options, member, guild } = interaction;
    const voiceChannel = member.voice.channel;
    const permissions = voiceChannel?.permissionsFor(client.user);

    // Check for VC
    if (['play', 'skip', 'stop', 'queue', 'nowplaying', 'pause', 'resume', 'shuffle', 'loop', 'volume', '247'].includes(commandName) && !voiceChannel) {
      return interaction.reply({ content: `${config.emojis.error} You must be in a voice channel to use this command.`, flags: 64 });
    }

    // Check for permissions (Connect and Speak)
    if (voiceChannel && (!permissions.has('Connect') || !permissions.has('Speak'))) {
      return interaction.reply({ content: `${config.emojis.error} I need the **CONNECT** and **SPEAK** permissions in your voice channel.`, flags: 64 });
    }
    
    // Check for Manage Channels permission required for Topic updates
    if (voiceChannel && ['play', 'stop'].includes(commandName) && voiceChannel.type === ChannelType.GuildVoice && !permissions.has('ManageChannels')) {
        // Log a warning, but don't block the music command, just the topic feature won't work
        console.warn(`Bot does not have Manage Channels permission in ${voiceChannel.name} to set the channel topic.`);
    }

    if (commandName === 'help') {
      return handleHelpCommand(interaction);
    }
    
    // Play Command Logic
    if (commandName === 'play') {
      await interaction.deferReply(); 
      const query = options.getString('query');

      try {
        const player = await getOrCreatePlayer(interaction, voiceChannel);
        const searchResult = await kazagumo.search(query, { requester: member.user });

        if (!searchResult || !searchResult.tracks.length) {
          return interaction.editReply({ content: `${config.emojis.error} No results found for \`${query}\`.` });
        }

        const isPlaying = player.playing || player.paused;

        if (searchResult.type === 'PLAYLIST') {
          player.queue.add(searchResult.tracks);
          
          if (!isPlaying) {
            await player.play();
          }

          const playlistEmbed = new EmbedBuilder()
            .setDescription(`${config.emojis.queue} Added **${searchResult.tracks.length}** tracks from playlist [${searchResult.playlistName}](${query}) to the queue.`)
            .setColor('#0099ff');
          return interaction.editReply({ embeds: [playlistEmbed] });
        } else {
          const track = searchResult.tracks[0];
          player.queue.add(track);

          if (!isPlaying) {
            await player.play(); 
            const startingEmbed = new EmbedBuilder()
                .setDescription(`${config.emojis.success} Starting playback of **${track.title}**!`)
                .setColor('#00ff00');
            return interaction.editReply({ embeds: [startingEmbed] });
          }

          const addedEmbed = new EmbedBuilder()
            .setDescription(`${config.emojis.success} Added [${track.title}](${track.uri}) to the queue at position **#${player.queue.length}**.`)
            .setColor('#00ff00');
          return interaction.editReply({ embeds: [addedEmbed] });
        }
      } catch (error) {
        console.error('Play command error:', error);
        return interaction.editReply({ content: `${config.emojis.error} An error occurred while trying to play the song.`, flags: 64 });
      }
    }

    // Commands that require an existing player
    const player = kazagumo.players.get(guild.id);

    if (!player) {
      return interaction.reply({ content: `${config.emojis.warning} There is no music currently playing in this guild.`, flags: 64 });
    }

    // Check if the user is in the same VC as the bot
    if (voiceChannel.id !== player.voiceId) {
      return interaction.reply({ content: `${config.emojis.error} You must be in the same voice channel as the bot to control it.`, flags: 64 });
    }

    // Command handlers
    try {
      switch (commandName) {
        case 'skip':
          if (player.queue.length > 0) {
            await player.skip();
            interaction.reply({ content: `${config.emojis.skip} Skipped **${player.queue.current.title}**.` });
          } else {
            // Player is destroyed on skip when queue is empty. Topic reset is handled in playerDestroy.
            player.destroy(); 
            interaction.reply({ content: `${config.emojis.stop} Skipped the last song and stopped the player.` });
          }
          break;

        case 'stop':
          // Player is destroyed. Topic reset is handled in playerDestroy.
          player.destroy(); 
          interaction.reply({ content: `${config.emojis.stop} Music stopped and queue cleared.` });
          break;

        case 'pause':
          if (!player.paused) {
            player.pause(true);
            interaction.reply({ content: `${config.emojis.pause} Music paused.` });
          } else {
            interaction.reply({ content: `${config.emojis.warning} Music is already paused.`, flags: 64 });
          }
          break;

        case 'resume':
          if (player.paused) {
            player.pause(false);
            interaction.reply({ content: `${config.emojis.resume} Music resumed.` });
          } else {
            interaction.reply({ content: `${config.emojis.warning} Music is not paused.`, flags: 64 });
          }
          break;

        case 'queue':
          const queueEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.queue} Queue for ${guild.name}`)
            .setColor('#0099ff')
            .setTimestamp();

          if (!player.queue.current) {
            queueEmbed.setDescription('The queue is empty.');
          } else {
            const currentDurationString = player.queue.current.duration && player.queue.current.duration.asString ? player.queue.current.duration.asString() : 'N/A';
            const tracks = player.queue.map((track, index) => `${index + 1}. [${track.title}](${track.uri}) - \`[${track.duration.asString()}]\``).slice(0, 10);
            
            queueEmbed.setDescription(`**Now Playing:** [${player.queue.current.title}](${player.queue.current.uri}) - \`[${currentDurationString}]\`\n\n**Up Next:**\n${tracks.join('\n') || 'No more tracks in queue.'}`);

            if (player.queue.length > 10) {
              queueEmbed.setFooter({ text: `+${player.queue.length - 10} more tracks in queue.` });
            }
          }
          interaction.reply({ embeds: [queueEmbed] });
          break;

        case 'nowplaying':
          if (!player.queue.current) {
            return interaction.reply({ content: `${config.emojis.error} No music is currently playing.`, flags: 64 });
          }

          const currentTrack = player.queue.current;
          const durationString = currentTrack.duration && currentTrack.duration.asString ? currentTrack.duration.asString() : 'N/A';
          const positionString = player.position ? KazagumoTrack.formatedLength(player.position) : '0:00';

          const npEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.nowplaying} Now Playing`)
            .setDescription(`[${currentTrack.title}](${currentTrack.uri}) - \`[${durationString}]\``)
            .setThumbnail(currentTrack.thumbnail || null)
            .addFields(
              { name: 'Requester', value: currentTrack.requester.tag, inline: true },
              { name: 'Progress', value: `${positionString} / ${durationString}`, inline: true },
              { name: 'Loop Mode', value: player.loop, inline: true }
            )
            .setColor('#0099ff')
            .setTimestamp();

          interaction.reply({ embeds: [npEmbed] });
          break;

        case 'shuffle':
          player.queue.shuffle();
          interaction.reply({ content: `${config.emojis.shuffle} Queue shuffled!` });
          break;

        case 'loop':
          const mode = options.getString('mode');
          player.setLoop(mode);
          interaction.reply({ content: `${config.emojis.loop} Loop mode set to **${mode}**.` });
          break;

        case 'volume':
          const level = options.getInteger('level');

          if (level !== null) {
            if (level < 0 || level > 100) {
              return interaction.reply({ content: `${config.emojis.error} Volume must be between 0 and 100.`, flags: 64 });
            }
            await player.setVolume(level);
            interaction.reply({ content: `${config.emojis.volume} Volume set to **${level}%**.` });
          } else {
            interaction.reply({ content: `${config.emojis.volume} Current volume is **${player.volume}%**.`, flags: 64 });
          }
          break;

        case '247':
          const current247 = player.data.get('twentyFourSeven');
          player.data.set('twentyFourSeven', !current247);
          const newState = player.data.get('twentyFourSeven') ? 'enabled' : 'disabled';
          interaction.reply({ content: `${config.emojis.success} 24/7 mode is now **${newState}**. The bot will ${newState === 'enabled' ? 'stay in the voice channel.' : 'disconnect when the queue is empty.'}` });
          break;
      }
    } catch (error) {
      console.error(`Command ${commandName} error:`, error);
      interaction.reply({ content: `${config.emojis.error} An unexpected error occurred while executing the command.`, flags: 64 }).catch(() => null);
    }
    
  } else if (interaction.isStringSelectMenu() && interaction.customId === 'help_category_select') {
    // Handle the help menu selection change
    await handleHelpMenuSelect(interaction);
    
  } else if (interaction.isButton()) {
    // Button Interaction Handler
    if (!interaction.guild) return;

    const player = kazagumo.players.get(interaction.guildId);
    if (!player) return interaction.reply({ content: `${config.emojis.warning} There is no music currently playing.`, flags: 64 });

    const member = interaction.member;
    if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
      return interaction.reply({ content: `${config.emojis.error} You must be in the same voice channel as the bot to use the controls.`, flags: 64 });
    }

    await interaction.deferUpdate();

    try {
      switch (interaction.customId) {
        case 'pause':
        case 'resume':
          player.pause(!player.paused);
          break;
        case 'skip':
          if (player.queue.length > 0) {
              await player.skip();
          } else {
              // Player is destroyed on skip when queue is empty. Topic reset is handled in playerDestroy.
              player.destroy();
              if (interaction.message && interaction.message.editable) {
                  const disabledButtons = interaction.message.components[0].components.map(button => 
                      ButtonBuilder.from(button).setDisabled(true)
                  );
                  await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
              }
          }
          break;
        case 'stop':
          // Player is destroyed. Topic reset is handled in playerDestroy.
          player.destroy(); 
          if (interaction.message && interaction.message.editable) {
              const disabledButtons = interaction.message.components[0].components.map(button => 
                  ButtonBuilder.from(button).setDisabled(true)
              );
              await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
          }
          break;
        case 'loop':
          let newLoopMode = 'none';
          if (player.loop === 'none') {
            newLoopMode = 'track';
          } else if (player.loop === 'track') {
            newLoopMode = 'queue';
          }
          player.setLoop(newLoopMode);
          await interaction.followUp({ content: `${config.emojis.loop} Loop mode set to **${newLoopMode}**!`, flags: 64 });
          break;
        case 'shuffle':
          player.queue.shuffle();
          await interaction.followUp({ content: `${config.emojis.shuffle} Queue shuffled!`, flags: 64 });
          break;
      }
    } catch (error) {
      console.error('Button interaction error:', error);
      await interaction.followUp({ content: `${config.emojis.error} An error occurred while processing your request.`, flags: 64 });
    }
  }
});

// Prefix Command Handler (simple placeholder)
if (config.enablePrefix) {
  client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild || !message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'help') {
        // Create a mock interaction object for the help command logic
        const mockInteraction = {
            user: message.author,
            client: message.client,
            guild: message.guild,
            reply: (data) => message.channel.send(data),
            deferReply: () => Promise.resolve(),
            options: {
                getString: () => null,
                getInteger: () => null,
            }
        };
        // Call the slash command handler logic directly
        handleHelpCommand(mockInteraction, false);
    } else if (['play', 'p'].includes(commandName)) {
         message.reply(`${config.emojis.warning} Prefix commands are currently only partially supported. Please use **/** slash commands like \`/play ${args.join(' ')}\`.`);
    }
  });
}

client.login(config.token);