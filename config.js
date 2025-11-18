module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_BOT_TOKEN,
  prefix: '!',
  enablePrefix: true, // Set to false to disable prefix commands
  
  // Bot Activity - THEME CHANGE
  activity: {
    name: 'Neon Beats 🎶 | /help',
    type: 'LISTENING' // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING
  },
  
  // Lavalink Configuration
  lavalink: {
    nodes: [{
      name: 'main',
      url: 'lava-v4.ajieblogs.eu.org:80',
      auth: 'youshallnotpass', 
      secure: false,
    }],
    defaultSearchEngine: 'youtube_music'
  },
  
  // Emojis - FULL THEME CHANGE
  emojis: {
    // FIX: Updated to the new ID 1440284078875213854
    play: '<a:custom_play:1440284078875213854>', 
    
    // Custom Static Emojis (external)
    pause: '<:e_pause:1431124345194807369>',
    resume: '<:e_resume:1431123161885446145>',
    skip: '<:e_skip:1431123075121942528>',
    stop: '<:e_stop:1431123342244446268>',
    shuffle: '<:e_shuffle:1431123222807580724>',
    loop: '<:e_loop:1431123277148848212>',
    volume: '<:e_volume:1431123744402968636>',
    
    // Functional Unicode emoji
    nowplaying: '🎶', 
    
    // Other Unicode Emojis (Themed)
    queue: '📜',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    music: '🎶',
    user: '🤖',
    duration: '⏳',
    position: '📍',
    ping: '📡',
    stats: '📈',
    invite: '🔗',
    support: '📣',
    uptime: '🔋',
    servers: '🌌',
    users: '👾',
    players: '🎶',
    playlist: '📀'
  },
  
  // URLs
  urls: {
    support: process.env.SUPPORT_SERVER || 'https://discord.gg/your-support-server',
    github: 'https://github.com/Unknownzop/MusicBot'
  },
  
  // Express Server
  express: {
    port: 3000,
    host: '0.0.0.0'
  }
};
