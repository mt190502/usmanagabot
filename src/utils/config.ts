import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Logger } from './logger';

export const ConfigLoader = <T>(filepath: string, filename: string, encoding: BufferEncoding = 'utf-8'): T => {
    const realpath = path.join(__dirname, `../${filepath}/${filename}`);
    try {
        const content = fs.readFileSync(realpath, 'utf8');
        return yaml.parse(content) as T;
    } catch (error) {
        Logger('error', `Failed to load configuration file: ${realpath}`)
        return null;
    }
}