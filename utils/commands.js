var Discord = require('discord.js');
var request = require('request');
var Account = require('./account');
var Clone = require('./clone');
var dateFormat = require('dateformat');
var config = require('../config.json');
var Functions = require('./functions');


class Commands {
  static Help(msg) {
    var embed = new Discord.MessageEmbed()
    .setColor('#642BF7')
    .setDescription(`**Commands**\n
    **${config.prefix}help**\n
    **${config.prefix}stats**   Stats of the bot\n
    **${config.prefix}link**    Link your cloner.tech account\n
    **${config.prefix}backup**  Load private backups of your linked account\n
    **${config.prefix}info**  Informations of bot (Website, support ...)
    `)
    return msg.channel.send(embed);
  }

  static async Info(msg, args, client) {
    const embed = new Discord.MessageEmbed()
      .setAuthor(client.user.username, client.user.avatarURL)
      .setColor(0x00A2E8)
      .setDescription(`[Website](https://cloner.xyz)\n[Invite the bot](https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=8)\n[Discord Support](https://discord.com/invite/CrP9HEC)`)
      .setTimestamp()
      .setFooter(client.user.username, client.user.avatarURL);
    msg.channel.send({embed}) 
  } 

  static async Link(msg, args) {
    var user = await Account.Exist(msg.author.id)
    if(user) {
      var embed = new Discord.MessageEmbed()
        .setColor('#642BF7')
        .setDescription('You\'ve already linked your account !')
      return msg.channel.send(embed);
    } else {
      var embed = new Discord.MessageEmbed()
      .setColor('#642BF7')
      .setDescription('[**Link your Discord account**]('+ config.url +'auth/discord)')

      return msg.channel.send(embed);
    }
  }

  static async Stats(msg, args, client) {
    const embed = new Discord.MessageEmbed()
      .setAuthor(client.user.username, client.user.avatarURL)
      .setColor(0x00A2E8)
      .addField('Total Users', `${client.users.cache.size}`, true)
      .addField('Total Channels', `${client.channels.cache.size}`, true)
      .addField('Total Servers', Math.ceil(client.guilds.cache.size), true)
      .addField('Total Users (Website)', `${await Functions.usersCount()}`, true)
      .addField('Total Backups (Website)', `${await Functions.backupCount()}`, true)
      .setTimestamp()
      .setFooter(client.user.username, client.user.avatarURL);
    msg.channel.send({embed}) 
  }

  static async Backup(msg, args, client) {

    var user = await Account.Exist(msg.author.id)

    if(user) {
      if(!args[0]) {
        var embed = new Discord.MessageEmbed()
          .setColor('#642BF7')
          .setDescription(`**${config.prefix}backup**\n\nLoad private backups of your linked account\n\n**Commands**\n
          **${config.prefix}backup create**          Create a backup\n
          **${config.prefix}backup load**          Load a backup\n
          **${config.prefix}backup list**          Get a list of your backups`)
        return msg.channel.send(embed);
      }
      
      if(args[0] === 'create') {
        var embed = new Discord.MessageEmbed()
          .setColor('#642BF7')
          .setDescription('[**Create a backup**]('+ config.url +'clonage)')

        return msg.channel.send(embed);
      }

      if(args[0] === 'load') {
        Clone.cloneGuild(client, msg, args);
      }

      if(args[0] === 'list') {
        var list = await Account.listGuild(msg.author.id);

        if(list === false) {
          var embed = new Discord.MessageEmbed()
            .setColor('#642BF7')
            .setDescription('An error has occurred. Contact an administrator !')

          return msg.channel.send(embed);
        } else {

          let pages = [];
          let tosend = [];

          list.forEach(element => {
            var infoData = JSON.parse(element.data);
            tosend.push(["**" + element.uuid + "**\n" + infoData.general.name + " (`" + dateFormat(element.created_at, 'UTC:dd/mm/yyyy HH:MM:ss') + "`)"])
          });

          for (let i = 0; i < tosend.length;) {
            if((i + 6) >  tosend.length) {
              pages.push(tosend.slice(i, (i + 6) - ((i + 6) - tosend.length)).join("\n"));
              break;
            } else {
              pages.push(tosend.slice(i, i + 6).join('\n'));
              i += 6;
            }
          }

          let page = 1;

          if(tosend.length > 0) {
            var embed = new Discord.MessageEmbed()
            .setColor('#642BF7')
            .setDescription("**Your Backups**\n\n" + pages[page - 1])
            .setFooter(`Page : ${page}/${pages.length}`)
            .setTimestamp()
          
            return msg.channel.send(embed).then(async message => {
              if (!msg.guild.member(client.user).hasPermission('ADD_REACTIONS')) return;

              await message.react('◀');
              await message.react('▶');

              const backF = (reaction, user) => reaction.emoji.name === '◀' && user.id === msg.author.id;
              const ForF = (reaction, user) => reaction.emoji.name === '▶' && user.id === msg.author.id;
              const back = message.createReactionCollector(backF, { time: 180000 });
              const For = message.createReactionCollector(ForF, { time: 180000 });

              back.on('collect', async r => {
                r.users.remove(msg.author.id)
                if (page === 1) return r.users.remove(msg.author.id);
                page--;
                embed.setDescription(pages[page-1]);
                embed.setFooter(`Page: ${page}/${pages.length}`);
                message.edit(embed);
              });
              For.on('collect', async r => {
                  r.users.remove(msg.author.id)
                  if (page === pages.length) return r.users.remove(msg.author.id);
                  page++;
                  embed.setDescription(pages[page-1]);
                  embed.setFooter(`Page: ${page}/${pages.length}`);
                  message.edit(embed);
              });
            });
          } else {
            var embed = new Discord.MessageEmbed()
              .setColor('#642BF7')
              .setDescription("**Your Backups**\n")
              .setFooter(`Page : 1/1`)
              .setTimestamp()
          
            return msg.channel.send(embed)
          }
        }
      }

    } else {
      var embed = new Discord.MessageEmbed()
        .setColor('#642BF7')
        .setDescription(`You must link your account !\nTo link your account : ${config.prefix}link`)
      return msg.channel.send(embed);
    }
    
  }

}

module.exports = Commands;