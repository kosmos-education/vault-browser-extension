/**
 * Service worker entry point.
 *
 * Everything interesting lives in lib/background/*. This file just wires the
 * modules together and kicks off the initial alarms.
 */

import {
  refreshTokenTimer,
  setupAlarmListener,
  setupIdleListener,
  setupTokenAutoRenew,
} from './lib/background/token-renewal.js';
import { setupMessageRouter } from './lib/background/message-router.js';

setupTokenAutoRenew(1800);
refreshTokenTimer();
setupIdleListener();
setupAlarmListener();
setupMessageRouter();
