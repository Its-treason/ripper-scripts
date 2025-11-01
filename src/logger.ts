import c from 'ansi-colors';
import figures from 'figures';
import { verbose } from './config';

export class Logger {
  public static textPrimary = c.bold.white;
  public static textSecondary = c.bold.grey;

  public static iconDebug = c.bold.white;
  public static iconInfo = c.bold.blueBright;
  public static iconSuccess = c.bold.greenBright;
  public static iconError = c.bold.redBright;

  public static debug(message: string): void {
    if (!verbose()) {
      return;
    }
    Logger.log(Logger.iconDebug(figures.triangleDownSmall), Logger.textSecondary(message));
  }

  public static info(message: string): void {
    Logger.log(Logger.iconInfo(figures.info), Logger.textPrimary(message));
  }

  public static success(message: string): void {
    Logger.log(Logger.iconSuccess(figures.tick), Logger.textPrimary(message));
  }

  public static error(message: string): void {
    Logger.log(Logger.iconError(figures.warning), Logger.textPrimary(message));
  }

  private static log(icon: string, message: string): void {
    console.log(`${icon} ${message}`);
  }
}
