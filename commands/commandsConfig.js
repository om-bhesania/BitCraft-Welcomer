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
import massDmConfig from "./massDm.js";
import pruneCommand from "./prune.js";
import { remindConfig, stopConfig } from "./reminer.js";
import { rulesConfig } from "./rules.js";

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
  massDm: massDmConfig,
  // staffApplication: staffApplicationConfig,
  // sendPanel: sendPanel,
  // prune: pruneCommand,

  // testInvite: testInviteConfig,
};
