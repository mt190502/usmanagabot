import { BotClient } from '@services/client';
import { Config } from '@services/config';
import { Database } from '@services/database';
import { Logger } from '@services/logger';

(async () => {
    const config = Config.getInstance();
    const logger = Logger.getInstance();
    logger.setLogLevel = config.current_botcfg.log_level;
    logger.setLanguage = config.current_botcfg.language;
    await Database.getInstance();
    await BotClient.init(config.current_botcfg.token);
})();
