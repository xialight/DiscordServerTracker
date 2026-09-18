import fs from 'fs';
import path from 'path';
import * as url from 'url';
import { REST, Routes } from 'discord.js';
import { config } from '../config.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const commandsPath = path.join(__dirname, '../commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const { default: command } = await import(url.pathToFileURL(filePath));
  if (command?.data && command?.execute) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNING] ${file} is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST().setToken(config.token);

try {
  console.log(`Deploying ${commands.length} guild command(s) to ${config.guildId}...`);

  const data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });

  console.log(`Successfully deployed ${data.length} command(s).`);
} catch (error) {
  console.error(error);
}
