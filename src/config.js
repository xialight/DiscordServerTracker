import 'dotenv/config';

const required = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'BRAVE_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  dbPath: process.env.DB_PATH || './data/tracker.db',
  braveApiKey: process.env.BRAVE_API_KEY,
};
