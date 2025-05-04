import { bgConfig } from "./bg.js";
import { helpConfig } from "./help.js";
import { testConfig } from "./test.js";
import { remindConfig, stopConfig } from "./reminer.js";
import { ipConfig } from "./ip.js";
import { rulesConfig } from './rules.js'; 
// Command handler system - centralized for easier additions
export const commands = {
  test: testConfig,
  bg: bgConfig,
  help: helpConfig,
  remind: remindConfig,
  stop: stopConfig,
  ip: ipConfig,
  rules: rulesConfig,
};
