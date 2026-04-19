const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Web server active');
});

require('dotenv').config();
console.log('RUNNING NEW CODE VERSION');
console.log('EMAIL USER LOADED:', process.env.EMAIL_USER);

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const nodemailer = require('nodemailer');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on('error', (error) => {
  console.error('CLIENT ERROR:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION:', error);
});

// TEMP storage for verification codes
const verificationData = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// CHANGE THESE
const VERIFIED_ROLE_ID = '1477601837132812288';

// slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Start BESS verification with your zID')
    .addStringOption(option =>
      option
        .setName('zid')
        .setDescription('Your UNSW zID, e.g. z1234567')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('code')
    .setDescription('Enter the verification code sent to your email')
    .addStringOption(option =>
      option
        .setName('value')
        .setDescription('The 6-digit verification code')
        .setRequired(true)
    )
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log('Slash commands registered');
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'verify') {
  await interaction.deferReply({ ephemeral: true });

  const zid = interaction.options.getString('zid').toLowerCase().trim();

  if (!/^z\d{7}$/.test(zid)) {
    return interaction.editReply({
      content: 'That zID format is invalid. Use something like z1234567.'
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  verificationData[interaction.user.id] = {
    zid,
    code,
    expiresAt
  };

  const email = `${zid}@ad.unsw.edu.au`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'BESS Discord Verification Code',
      text:
        `Your verification code is: ${code}\n\n` +
        `This expires in 5 minutes.`
    });

    return interaction.editReply({
      content:
        `Verification started for **${zid}**.\n\n` +
        `I’ve sent a code to **${email}**.\n` +
        `Check your inbox and run /code.`
    });

  } catch (error) {
    console.error('EMAIL ERROR FULL:', error);

    delete verificationData[interaction.user.id];

    return interaction.editReply({
      content:
        `Failed to send email to **${email}**.\n` +
        `Exact error: ${error.message}`
    });
  }
}

  if (interaction.commandName === 'code') {
    const enteredCode = interaction.options.getString('value').trim();
    const saved = verificationData[interaction.user.id];

    if (!saved) {
      return interaction.reply({
        content: 'You do not have an active verification. Run **/verify** first.',
        ephemeral: true
      });
    }

    if (Date.now() > saved.expiresAt) {
      delete verificationData[interaction.user.id];
      return interaction.reply({
        content: 'Your code expired. Run **/verify** again.',
        ephemeral: true
      });
    }

    if (enteredCode !== saved.code) {
      return interaction.reply({
        content: 'Wrong code. Try again.',
        ephemeral: true
      });
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      await member.roles.add(VERIFIED_ROLE_ID);

      delete verificationData[interaction.user.id];

      return interaction.reply({
        content: `✅ You are now verified for BESS.`,
        ephemeral: true
      });
    } catch (error) {
  console.error('ROLE ASSIGN ERROR:', error);

  return interaction.reply({
    content: `I could not assign the role.\nExact error: ${error.message}`,
    ephemeral: true
  });
}
  }
});
console.log('TOKEN EXISTS:', !!process.env.TOKEN);

client.login(process.env.TOKEN).catch((error) => {
  console.error('DISCORD LOGIN ERROR:', error);
});
client.login(process.env.TOKEN);