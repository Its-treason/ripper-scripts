#!/usr/bin/env bun
import fs from 'node:fs/promises';
import path from 'node:path';
import { readRipConfig } from './config';
import { detectDvdType, sortTitlesByPriority } from './dvdAnalyse';
import { type DvdMetadataSchema, showDvdData } from './dvdMetadata';
import { ripDvdTitles, scanDisk, type TitleRipConfig } from './handbrake';
import { Logger } from './logger';
import { promptDvdType, promptShowInfo, promptTmdbId, UserError } from './prompts';

async function main() {
  const config = await readRipConfig();

  let dvdData: DvdMetadataSchema;
  try {
    dvdData = await scanDisk(config.dvdPath);
  } catch (error) {
    throw new UserError(`Could not read DVD data: ${error}`);
  }

  sortTitlesByPriority(dvdData);
  showDvdData(dvdData);

  const detectedTitles = detectDvdType(dvdData);
  const selectedTitles = await promptDvdType(dvdData, detectedTitles);

  switch (selectedTitles.type) {
    case 'movie': {
      const name = await promptTmdbId(config.tmdbToken);

      const dirPath = path.join(config.movieDir, name);
      if (!(await fs.exists(dirPath))) {
        await fs.mkdir(dirPath);
      }

      const outputFile = path.join(dirPath, `${name}.mkv`);

      await ripDvdTitles([{ outputFile, titleIndex: selectedTitles.titleIndex }], config.dvdPath);
      break;
    }
    case 'show': {
      const showPaths = await promptShowInfo(config.showDir, selectedTitles.showIndexes.length);

      const ripConfig: TitleRipConfig[] = selectedTitles.showIndexes.map((titleIndex, i) => ({
        titleIndex,
        outputFile: showPaths[i]!,
      }));

      await ripDvdTitles(ripConfig, config.dvdPath);
      break;
    }
  }
}
try {
  await main();
} catch (error) {
  if (error instanceof UserError) {
    Logger.error(error.message);
    process.exit(1);
  }

  throw error;
}
