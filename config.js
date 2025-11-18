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
      auth: 'https://dsc.gg/ajidevserver',
      secure: false,
    }],
    defaultSearchEngine: 'youtube_music'
  },

  // Hosting Configuration
  express: {
    port: 3000, // Default port for local testing
    host: '0.0.0.0', // Listen on all interfaces
  },
  
  // Support Server Link
  support: {
    // Make sure to set SUPPORT_SERVER in your .env file
    server: process.env.SUPPORT_SERVER || 'https://discord.gg/your-support-server-invite'
  },

  // Emojis
  emojis: {
    play: '▶️',
    pause: '⏸️',
    resume: '▶️',
    skip: '⏭️',
    stop: '⏹️',
    queue: '📜',
    shuffle: '🔀',
    loop: '🔄',
    volume: '🔊',
    nowplaying: '🎵',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    music: '🎶', // Used for music category
    stats: '📊', // Used for utility category
    // Emojis for buttons/mentions
    invite: '🔗', 
    support: '🛠️',
    // Additional utility emojis (may not be used in the current index.js, but useful)
    user: '👤',
    duration: '⏱️',
    position: '📍',
    ping: '🏓',
    uptime: '⌚',
    servers: '🌐',
    users: '👥',
    channels: '💬',
    memory: '🧠',
    platform: '💻',
    node: '🟢',
    api: '📡'
  }
};
