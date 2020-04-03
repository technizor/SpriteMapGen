
const base64Table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const debugGridStr = (grid: Array<Array<number>>) => grid
    .map(row => row
        .map(b => (b !== undefined && b !== null) ? base64Table.charAt(b % base64Table.length) : ' ')
        .join(''))
    .join('\n');

export { debugGridStr };