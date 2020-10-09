var Discord = require('discord.js');
var Commands = require('./utils/commands');
var Functions = require('./utils/functions');
var client = new Discord.Client();

var config = require('./config.json');

client.on("ready", () => {

  client.user.setActivity("c1?help | Cloner.xyz", {
      type: "STREAMING",
      url: "https://www.twitch.tv/niroxy"
  });

  setInterval(async function() {
    client.channels.cache.get('757295408425992236').setName("Registered : " + await Functions.usersCount());
    client.channels.cache.get('763424821929181254').setName("Backups : " + await Functions.backupCount());
  }, 120000);
});

client.on("message", async (message) => {
  if(message.author.bot) return;
  if(message.content.indexOf(config.prefix) !== 0) return;
  
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command =args.shift().toLowerCase();

  if(command === 'help') return Commands.Help(message);

  if(command === 'link') return Commands.Link(message, args);

  if(command === 'backup') return Commands.Backup(message, args, client);

  if(command === 'stats') return Commands.Stats(message, args, client);

  if(command === 'info') return Commands.Info(message, args, client);

});

client.on('rateLimits', (info) => {
  console.log(info);
})

client.login(config.token).catch(() => {
  console.log("Impossible de se connecter.");
});
