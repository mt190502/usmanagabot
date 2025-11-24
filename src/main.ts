import { BotClient } from '@services/client';
import { Config } from '@services/config';
import { Database } from '@services/database';
import { Logger } from '@services/logger';
import { Translator } from './services/translator';

(async () => {
    const config = Config.getInstance();
    const translator = Translator.getInstance();
    translator.setLanguage = config.current_botcfg.language;
    const logger = Logger.getInstance();
    logger.setLogLevel = config.current_botcfg.log_level;
    await Database.getInstance();
    await BotClient.init(config.current_botcfg.token);
})();
