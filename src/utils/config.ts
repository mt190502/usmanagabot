import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Logger } from './logger';

export const ConfigLoader = <T>(filepath: string, filename: string, encoding: BufferEncoding = 'utf8'): T => {
    const realpath = path.join(__dirname, `../${filepath}/${filename}`);
    try {
        const content = fs.readFileSync(realpath, encoding);
        return yaml.parse(content) as T;
    } catch (error) {
        Logger('error', `Failed to load configuration file: ${realpath}\n${error.message}`);
        return null;
    }
};
