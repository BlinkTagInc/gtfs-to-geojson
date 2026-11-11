declare module 'cli-table' {
  export default class Table extends Array<
    [string, string | number | undefined]
  > {
    constructor(options: { colWidths: number[]; head: string[] });
  }
}
