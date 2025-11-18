module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_BOT_TOKEN,
  prefix: '!',
  enablePrefix: true, 

  // Bot Activity
  activity: {
    name: '/help | INFINITY MUSIC', // Updated Activity Name
    type: 'LISTENING' // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING
  },

  // Lavalink Configuration
  lavalink: {
    nodes: [{
      name: 'main',
      url: 'lava-v4.ajieblogs.eu.org:80',
      auth: 'https://dsc.gg/ajidevserver',
      secure: false,
    }],
    defaultSearchEngine: 'youtube_music'
  },

  // Hosting Configuration
  express: {
    port: 3000, 
    host: '0.0.0.0',
  },
  
  // Support Server Link
  support: {
    server: process.env.SUPPORT_SERVER || 'https://discord.gg/your-support-server-invite'
  },
  
  // Bot Information (Used in help command)
  botInfo: {
    name: 'INFINITY MUSIC',
    owner: 'RICK_GRIMES',
    github: 'https://github.com/Unknownzop/MusicBot',
  },
  
  // 🟢 NEW: Voice Channel Topic/Status Configuration
  voiceChannelStatus: {
      // ⚠️ IMPORTANT: Replace 111... and 222... with your actual emoji IDs
      playMessage: '<:RedWings_:1111111111111111111>/Play To Get Start with INFINITY MUSIC <:RED_70:2222222222222222222>',
      idleMessage: '🎧 Use /play to start the party! | INFINITY MUSIC',
  },

  // Emojis (Updated with animated emoji IDs from previous steps)
  emojis: {
    play: '<a:p_play:1431123161885446145>',      // Forward Skip ID used for play/resume
    pause: '<a:p_pause:1431124345194807369>',    // Pause ID
    resume: '<a:p_play:1431123161885446145>',     // Same as play
    skip: '<a:p_skip:1431123075121942528>',      // Skip ID
    stop: '<a:p_stop:1431123342244446268>',      // Stop ID
    queue: '📑',                                 
    shuffle: '<a:p_shuffle:1431123222807580724>',// Shuffle ID
    loop: '<a:p_loop:1431123277148848212>',      // Loop ID
    volume: '<a:p_volume:1431123744402968636>',  // Volume ID
    nowplaying: '📺', 
    
    success: '✅',
    error: '🚨',
    warning: '⚠️',
    music: '🎧',
    
    // Utility Emojis
    user: '👤',
    duration: '⏱️',
    position: '📍',
    ping: '🏓',
    stats: '📊',
    invite: '📨',
    support: '💬',
    uptime: '⌚',
    servers: '🖥️',
    users: '👥',
    channels: '📢',
    memory: '🧠',
    platform: '💻',
    node: '🟢',
    api: '📡'
  },
};