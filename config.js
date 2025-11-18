module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_BOT_TOKEN,
  prefix: '!',
  enablePrefix: true, // Set to false to disable prefix commands
  
  // Bot Activity
  activity: {
    name: '/help | https://github.com/Unknownzop/MusicBot',
    type: 'LISTENING' // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING
  },
  
  // Lavalink Configuration
  lavalink: {
    nodes: [{
      name: 'main',
      url: 'lava-v4.ajieblogs.eu.org:80',
      // CRITICAL: Must be a simple password string.
      auth: 'youshallnotpass', 
      secure: false,
    }],
    defaultSearchEngine: 'youtube_music'
  },
  
  // Emojis
  emojis: {
    // Custom Animated Emoji (external)
    play: '<a:custom_play:1331477113911382079>',
    
    // Custom Static Emojis (external)
    pause: '<:e_pause:1431124345194807369>',
    resume: '<:e_resume:1431123161885446145>',
    skip: '<:e_skip:1431123075121942528>',
    stop: '<:e_stop:1431123342244446268>',
    shuffle: '<:e_shuffle:1431123222807580724>',
    loop: '<:e_loop:1431123277148848212>',
    volume: '<:e_volume:1431123744402968636>',
    
    // Functional Unicode emoji
    nowplaying: '🎵', 
    
    // Other Unicode Emojis
    queue: '📜',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    music: '🎵',
    user: '👤',
    duration: '⏱️',
    position: '📍',
    ping: '🏓',
    stats: '📊',
    invite: '📨',
    support: '💬',
    uptime: '⌚',
    servers: '🌐',
    users: '👥',
    players: '🎵',
    playlist: '📋'
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
