import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const commands = [
  new SlashCommandBuilder().setName('win').setDescription('Add an Age of Empires IV win'),
  new SlashCommandBuilder().setName('loss').setDescription('Add an Age of Empires IV loss'),
  new SlashCommandBuilder().setName('record').setDescription('Show the current Age of Empires IV record'),
  new SlashCommandBuilder()
    .setName('reset-record')
    .setDescription('Reset the Age of Empires IV record')
    .addBooleanOption(option => option.setName('confirm').setDescription('Must be true to reset').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: commands }
  );
  console.log('Slash commands registered successfully.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
