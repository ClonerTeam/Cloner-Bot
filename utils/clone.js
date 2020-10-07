var Discord = require('discord.js');
var { Permissions, Collection } = require('discord.js');
var { validateBitrate, validateUserLimit } = require('./functions');
var Account = require('./account');

class Clone {

  static async cloneGuild(client, message, args)
  {
    // First step, check permission
    if(!message.guild.member(client.user).hasPermission('ADMINISTRATOR')) {
      var embed = new Discord.MessageEmbed()
        .setColor('#642BF7')
        .setDescription("I don't have the permission : `ADMINISTRATOR`")

      return message.channel.send(embed);
    }

    if(!message.guild.member(message.author.id).hasPermission('ADMINISTRATOR')) {
      var embed = new Discord.MessageEmbed()
        .setColor('#642BF7')
        .setDescription("You don't have the permission : `ADMINISTRATOR`")

      return message.channel.send(embed);
    }

    // Second step, check uuid
    if(!args[1]) {
      var embed = new Discord.MessageEmbed()
      .setColor('#642BF7')
      .setDescription("You forgot to define the argument backup_id. Use c?backup load <backup_id>.")

      return message.channel.send(embed);
    }

    var guildDataExist = await Account.getGuildData(message.author.id, args[1]);
    if(!guildDataExist) {
      var embed = new Discord.MessageEmbed()
      .setColor('#642BF7')
      .setDescription("You have no backup with the id " + args[1] + ".")

      return message.channel.send(embed);
    }
    
    var guildData = JSON.parse(guildDataExist.data);
    var newGuild = client.guilds.cache.get(message.guild.id);

    // Step three, clean new guild
    await this.cleanGuild(client, message.guild.id);

    // Step four, place backup

    try {
      guildData.references = {};

      await this.setGeneralData(guildData, newGuild);
      
      if (guildData.roles.length) {
        guildData.references.roles = await this.createRoles(guildData, newGuild);
      }

      if (guildData.categories.length) {
        guildData.references.categories = await this.createCategories(guildData, newGuild);
      }

      if (guildData.textChannels.length) {
        await this.createTextChannel(guildData, newGuild);
      }

      if (guildData.voiceChannels.length) {
        await this.createVoiceChannel(guildData, newGuild);
      }
      

      if (guildData.emojis.length) {
        await this.createEmojis(guildData, newGuild);
      }

      await this.finalize(newGuild);

    } catch(e) {
      console.log(e);
    }

  }

  static async cleanGuild(client, guildId)
  {
    return new Promise(async (resolve) => {
      try {
        let guild = client.guilds.cache.get(guildId);

        // Delete channel
        let promises = [];
        guild.channels.cache.forEach(channel => {
          promises.push(channel.delete());
        });

        await Promise.all(promises);
        promises = [];

        // Delete roles
        let filter = role => role.id !== guild.roles.everyone.id && role.name !== client.user.username && role.members.every(member => !member.user.bot);
        let rolesToDelete = guild.roles.cache.filter(filter);
        rolesToDelete.forEach(role => {
          promises.push(role.delete());
        });
        await Promise.all(promises);
        promises = [];

        // Delete emojis
        guild.emojis.cache.forEach(emoji => {
          promises.push(emoji.delete());
        });

        await Promise.all(promises);
        promises = [];

        return resolve(true);

      } catch (err) {
        console.log(err);
        return resolve(false);
      }
    });
  }
  
  static setGeneralData(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
      try {
        let general = guildData.general;
        let allowedRegions = [
          'brazil', 'us-west', 'japan', 'singapore', 'eu-central',
          'hongkong', 'us-south', 'southafrica', 'us-central', 'london', 'us-east',
          'sydney', 'eu-west', 'amsterdam', 'india', 'frankfurt', 'russia'
        ];
        
        let region = allowedRegions.includes(general.region) ? general.region : 'us-central';

        await newGuild.setName(general.name);
        await newGuild.setRegion(region);
        await newGuild.setIcon(general.icon);
        await newGuild.setVerificationLevel(general.verificationLevel);
        await newGuild.setExplicitContentFilter(general.explicitContentFilter);

        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  static async createRoles(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
      try {
        let promises = [];
        let roleReferences = new Collection();
        guildData.roles.forEach(role => {
          if (role.defaultRole) {
            let everyoneRole = newGuild.roles.everyone;
            promises.push(everyoneRole.setPermissions(role.permBitfield));
            roleReferences.set(role.idOld, { new: newGuild.roles.everyone, old: role });
          } else {
            let newRole = {
              data: {
                name: role.name,
                color: role.hexColor,
                hoist: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permBitfield,
              },
            };

            let promise = newGuild.roles.create(newRole).then(createdRole => {
              roleReferences.set(role.idOld, { new: createdRole, old: role });
            });
            promises.push(promise);
          }
        });
        await Promise.all(promises);
        return resolve(roleReferences);
      } catch (err) {
        console.log(err);
        return reject(err);
      }
    });
  }

  static createCategories(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
      try {
        let promises = [];
        let categoryReferences = new Collection();
        guildData.categories.forEach(category => {
          let overwrites = category.permOverwrites.map(permOver => {
            return {
              id: guildData.references.roles.get(permOver.id).new.id,
              allow: new Permissions(permOver.allowed),
              deny: new Permissions(permOver.denied),
            };
          });
          
          let options = {
            type: 'category',
            permissionOverwrites: overwrites,
            position: category.position
          };

          let promise = newGuild.channels.create(`${category.name || 'Nom invalide'}`, options).then(createdCategory => {
            categoryReferences.set(category.idOld, { new: createdCategory, old: category });
          });
          promises.push(promise);
        });

        await Promise.all(promises);

        return resolve(categoryReferences);
      } catch (err) {
        console.log(err);
        return reject(err);
      }
    });
  }

  static createTextChannel(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
      try {
        let promises = [];
        let newSystemChannel = null;
        let channelWithTopics = new Collection();
        guildData.textChannels.forEach(textChannel => {
          let options = {
            type: 'text',
            nsfw: textChannel.nsfw,
            position: textChannel.position
          };

          if (textChannel.parentCat) {
            options.parent = guildData.references.categories.get(textChannel.parentCat).new.id;
          }
          if (!textChannel.permLocked) {
            options.permissionOverwrites = textChannel.permOverwrites.map(permOver => {
              return {
                id: guildData.references.roles.get(permOver.id).new.id,
                allow: new Permissions(permOver.allowed),
                deny: new Permissions(permOver.denied),
              };
            });
          }

          let promise = newGuild.channels.create(textChannel.name, options).then(createdChannel => {
            if (textChannel.isSystemChannel) newSystemChannel = createdChannel.id;
            if (textChannel.topic) channelWithTopics.set(createdChannel.id, { newCh: createdChannel, topic: textChannel.topic });
          });
          promises.push(promise);
        });
        
        await Promise.all(promises);
        if (newSystemChannel) await newGuild.setSystemChannel(newSystemChannel);
        promises = [];
        channelWithTopics.forEach(ch => promises.push(ch.newCh.setTopic(ch.topic)));
        await Promise.all(promises);

        return resolve();
      } catch (err) {
        console.log(err);
        return reject(err);
      }
    });
  }

  static createVoiceChannel(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
      try {
        let promises = [];
        let newAfkChannel = null;
        guildData.voiceChannels.forEach(voiceChannel => {
          let options = {
            type: 'voice',
            bitrate: validateBitrate(voiceChannel.bitrate),
            userLimit: validateUserLimit(voiceChannel.userLimit),
            position: voiceChannel.position
          };
          if (voiceChannel.parentCat) {
            options.parent = guildData.references.categories.get(voiceChannel.parentCat).new.id;
          }
          if (!voiceChannel.permLocked) {
            options.permissionOverwrites = voiceChannel.permOverwrites.map(permOver => {
              return {
                id: guildData.references.roles.get(permOver.id).new.id,
                allow: new Permissions(permOver.allowed),
                deny: new Permissions(permOver.denied),
              };
            });
          }

          let promise = newGuild.channels.create(voiceChannel.name, options).then(createdChannel => {
            if (voiceChannel.isAfkChannel) newAfkChannel = createdChannel.id;
          });
          promises.push(promise);
        });

        await Promise.all(promises);
        if (newAfkChannel) await newGuild.setAFKChannel(newAfkChannel);
        await newGuild.setAFKTimeout(guildData.general.afkTimeout);

        return resolve();
      } catch (err) {
        console.log(err);
        return reject(err);
      }
    });
  }

  static createEmojis(guildData, newGuild) {
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];

            let emojisNormal = guildData.emojis.filter(e => !e.animated);
            let emojisAnimated = guildData.emojis.filter(e => e.animated);
            switch (newGuild.premiumTier) {
                case 0:
                    emojisNormal = emojisNormal.filter((e, i) => i < 50);
                    emojisAnimated = emojisAnimated.filter((e, i) => i < 50);
                    break;
                case 1:
                    emojisNormal = emojisNormal.filter((e, i) => i < 100);
                    emojisAnimated = emojisAnimated.filter((e, i) => i < 100);
                    break;
                case 2:
                    emojisNormal = emojisNormal.filter((e, i) => i < 150);
                    emojisAnimated = emojisAnimated.filter((e, i) => i < 150);
                    break;
                case 3:
                    emojisNormal = emojisNormal.filter((e, i) => i < 250);
                    emojisAnimated = emojisAnimated.filter((e, i) => i < 250);
            }

            emojisNormal.forEach(emoji => {
                let promise = newGuild.emojis.create(emoji.url, emoji.name);
                promises.push(promise);
            });

            emojisAnimated.forEach(emoji => {
                let promise = newGuild.emojis.create(emoji.url, emoji.name);
                promises.push(promise);
            });

            await Promise.all(promises);

            return resolve();
        } catch (err) {
            return reject(err);
        }
    });
  }

  static async finalize(newGuild) {
    var embed = new Discord.MessageEmbed()
        .setColor('#642BF7')
        .setDescription('Thank you for using [Cloner.xyz](https://cloner.xyz/) , your backup has been loaded')

    var textChs = newGuild.channels.cache.filter(c => c.type === 'text');
    if(textChs.size > 0) {
      await textChs.first().send('@everyone');
      await textChs.first().send(embed);
    }
  }

}

module.exports = Clone;