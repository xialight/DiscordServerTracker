import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { db } from './database/db.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});
client.commands = new Collection();

async function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const files = (await fs.readdir(commandsDir)).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const { default: command } = await import(pathToFileURL(path.join(commandsDir, file)).href);
    if (command?.data?.name && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARNING] ${file} is missing a valid data or execute export.`);
    }
  }
}

async function loadEvents() {
  const eventsDir = path.join(__dirname, 'events');
  const files = (await fs.readdir(eventsDir)).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const { default: event } = await import(pathToFileURL(path.join(eventsDir, file)).href);
    const listener = (...args) => event.execute(...args).catch(console.error);
    if (event.once) client.once(event.name, listener);
    else client.on(event.name, listener);
  }
}

async function init() {
  await loadCommands();
  await loadEvents();
  await client.login(config.token);

  const cleanExit = () => {
    console.log('Shutting down...');
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);
}

init().catch((err) => {
  console.error('Initialization error:', err);
  process.exit(1);
});
