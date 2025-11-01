import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { YAML } from 'bun';
import z from 'zod';

//#region Env
export function configPath(): string | undefined {
  return process.env.CONFIG_PATH;
}

export function tmdbToken(): string | undefined {
  return process.env.TMDB_TOKEN;
}

export function verbose(): boolean {
  return process.env.VERBOSE === '1';
}

// Do not start Handbrake, instead use dummy data
export function localDebug(): boolean {
  return process.env.LOCAL_DEBUG === '1';
}
export function localHandbrakeOutput(): string | undefined {
  return process.env.LOCAL_HANDBRAKE_OUTPUT;
}
//#endRegion

//#region Config
const RipConfigSchema = z.object({
  tmdbToken: z.string().default(tmdbToken() ?? ''),
  movieDir: z.string(),
  showDir: z.string(),
});
export type RipConfigSchema = z.infer<typeof RipConfigSchema>;

export async function readRipConfig(): Promise<RipConfigSchema> {
  const confPath = configPath() ? configPath()! : path.join(homedir(), 'ripconfig.yml');
  const raw = await fs.readFile(confPath, { encoding: 'utf-8' });

  const parsed = YAML.parse(raw);
  return RipConfigSchema.parse(parsed);
}
//#endRegion
