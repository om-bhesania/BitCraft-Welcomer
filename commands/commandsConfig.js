import { bgConfig } from "./bg.js";
import { helpConfig } from "./help.js";
import {
  allInvitesConfig,
  createLogChannelConfig,
  inviteHelpConfig,
  invitesConfig,
  inviteStatsConfig,
  userInvitesConfig,
} from "./InviteCommands.js";
import { ipConfig } from "./ip.js";
import { remindConfig, stopConfig } from "./reminer.js";
import { rulesConfig } from "./rules.js";
import {
  enhancedDynamicChannelsConfig,
  forceUpdateConfig,
  performanceConfig,
  playersConfig,
  setServerAddressConfig,
  setUpdateIntervalConfig,
  setupStatusChannelsConfig,
  status,
  useDynamicChannelConfig
} from "./serverStats.js";
import { testConfig } from "./test.js";
// Command handler system - centralized for easier additions
export const commands = {
  test: testConfig,
  bg: bgConfig,
  help: helpConfig,
  remind: remindConfig,
  stop: stopConfig,
  ip: ipConfig,
  rules: rulesConfig,
  // Invite tracker commands
  invites: invitesConfig,
  userinvites: userInvitesConfig,
  invitestats: inviteStatsConfig,
  allinvites: allInvitesConfig,
  createlogchannel: createLogChannelConfig,
  invitehelp: inviteHelpConfig,
  // Status commands
  // serverstatus: serverStatusConfig,
  players: playersConfig,
  performance: performanceConfig,
  setupstatus: setupStatusChannelsConfig,
  setdynamicchannel: enhancedDynamicChannelsConfig,
  usechannel: useDynamicChannelConfig,
  setserver: setServerAddressConfig,
  setinterval: setUpdateIntervalConfig,
  updatestatus: forceUpdateConfig,
  // status: serverStat,

  status: status,
};
