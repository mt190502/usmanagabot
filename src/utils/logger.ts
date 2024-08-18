import dayjs from 'dayjs';

export const Logger = async (type: 'debug' | 'error' | 'info' | 'log' | 'warn', msg: string) => {
    const line = new Error().stack.split('\n')[2].split('/').at(-1);
    const filename = line.split(':')[0];
    const lineNumber = line.split(':')[1];
    const currdate = dayjs().format('YYYY-MM-DD HH:mm:ss');

    switch (type) {
        case 'debug':
            console.log(`\x1b[35mDEBU\x1b[0m[${currdate}][${filename}:${lineNumber}] ${msg}`);
            break;
        case 'error':
            console.error(`\x1b[31mERRO\x1b[0m[${currdate}][${filename}:${lineNumber}] ${msg}`);
            process.exit(1);
            break;
        case 'info':
            console.info(`\x1b[34mINFO\x1b[0m[${currdate}][${filename}:${lineNumber}] ${msg}`);
            break;
        case 'log':
            console.log(`\x1b[36mLOG \x1b[0m[${currdate}][${filename}:${lineNumber}] ${msg}`);
            break;
        case 'warn':
            console.warn(`\x1b[33mWARN\x1b[0m[${currdate}][${filename}:${lineNumber}] ${msg}`);
            break;
    }
};
