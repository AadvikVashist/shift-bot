export class Logger {
  private readonly context: string;

  private constructor(context: string) {
    this.context = context;
  }

  static create(context: string): Logger {
    return new Logger(context);
  }

  /**
   * Returns a timestamp string in the format
   * YYYY-MM-DD HH:mm:ss ±HH:MM where the offset indicates the local
   * timezone of the running process.
   */
  private static getTimestamp(): string {
    const date = new Date();

    const pad = (n: number): string => n.toString().padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    const offsetMinutesTotal = -date.getTimezoneOffset(); // in minutes, sign flipped so that positive is ahead of UTC
    const offsetSign = offsetMinutesTotal >= 0 ? "+" : "-";
    const offsetHours = pad(Math.floor(Math.abs(offsetMinutesTotal) / 60));
    const offsetMinutes = pad(Math.abs(offsetMinutesTotal) % 60);

    return `${hours}:${minutes}:${seconds} ${year}-${month}-${day} ${offsetSign}${offsetHours}:${offsetMinutes}`;
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${Logger.getTimestamp()}] [${this.context}] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${Logger.getTimestamp()}] [${this.context}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${Logger.getTimestamp()}] [${this.context}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${Logger.getTimestamp()}] [${this.context}] ${message}`, ...args);
  }
}
