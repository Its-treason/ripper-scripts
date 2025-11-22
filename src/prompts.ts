import fs from 'node:fs/promises';
import path from 'node:path';
import enq from 'enquirer';
import figures from 'figures';
import type { MovieConfiguration, ShowConfiguration } from './dvdAnalyse';
import { createShortTitleName, type DvdMetadataSchema } from './dvdMetadata';
import { Logger } from './logger';
import { loadMovieDetails } from './tmdbidApi';

export class UserError extends Error {}

export async function promptTitle(dvdMetadata: DvdMetadataSchema, multiselect: true): Promise<number[]>;
export async function promptTitle(dvdMetadata: DvdMetadataSchema, multiselect: false): Promise<number>;
export async function promptTitle(dvdMetadata: DvdMetadataSchema, multiselect: boolean): Promise<number[] | number> {
  const choices = dvdMetadata.TitleList.map((title) => {
    return {
      message: createShortTitleName(title, dvdMetadata.MainFeature),
      name: title.Index.toString(),
    };
  });

  const { titles } = await enq.prompt<{ titles: string[] | string }>({
    type: multiselect ? 'multiselect' : 'select',
    message: 'Enter number title number',
    name: 'titles',
    choices,
  });

  if (multiselect === false) {
    if (typeof titles !== 'string') {
      throw new Error('"Select" prompt should have returned string instead of an array');
    }
    return Number(titles);
  }

  if (typeof titles === 'string') {
    throw new Error('"Select" prompt should have returned array instead of an string');
  }
  if (titles.length === 0) {
    throw new UserError('No title selected!');
  }
  return titles.map(Number);
}

const invalidCharRegex = /[<>:"/\\|?*\x00-\x1F]/g;
export async function promptTmdbId(tmdbToken: string): Promise<string> {
  const selected = await enq.prompt<{ id: number }>({
    type: 'numeral',
    message: 'Enter The MovieDB Id',
    name: 'id',
    float: false,
  });

  const movieData = await loadMovieDetails(tmdbToken, selected.id);

  const releaseYear = movieData.release_date.slice(0, 4);
  const name = `${movieData.original_title} (${releaseYear}) [tmdbid-${movieData.id}]`;
  Logger.debug(`Selected movie name from TMDB: ${name}`);
  return name.replaceAll(invalidCharRegex, '');
}

export async function promptDvdType(
  dvdMeta: DvdMetadataSchema,
  autodetected: MovieConfiguration | ShowConfiguration,
): Promise<MovieConfiguration | ShowConfiguration> {
  if (autodetected.type === 'movie') {
    const title = dvdMeta.TitleList.find((title) => title.Index === autodetected.titleIndex)!;
    const textTitle = Logger.textPrimary(createShortTitleName(title, dvdMeta.MainFeature));
    console.log(`DVD detected as ${Logger.textPrimary('Movie')} with target ${textTitle}`);
  } else {
    console.log(`Detected DVD as ${Logger.textPrimary('Show')} with the following titles:`);
    for (const titleIndex of autodetected.showIndexes) {
      const title = dvdMeta.TitleList.find((title) => title.Index === titleIndex)!;
      console.log(`${figures.triangleLeftSmall} ${createShortTitleName(title, dvdMeta.MainFeature)}`);
    }
  }

  const { useAutodetected } = await enq.prompt<{ useAutodetected: boolean }>({
    name: 'useAutodetected',
    type: 'confirm',
    message: 'Use auto detected values?',
  });
  if (useAutodetected) {
    return autodetected;
  }

  const { type } = await enq.prompt<{ type: 'movie' | 'show' }>({
    name: 'type',
    message: 'what do you want to Rip?',
    type: 'select',
    choices: [
      { value: 'movie', message: 'Movie', name: 'movie' },
      { value: 'show', message: 'Show', name: 'show' },
    ],
  });

  switch (type) {
    case 'movie': {
      const titleIndex = await promptTitle(dvdMeta, false);
      return { type, titleIndex };
    }
    case 'show': {
      const showIndexes = await promptTitle(dvdMeta, true);
      return { type, showIndexes };
    }
  }
}

export async function promptShowInfo(showBasePath: string, wantedPaths: number): Promise<string[]> {
  const showList = await fs.readdir(showBasePath);

  const { showTitle } = await enq.prompt<{ showTitle: string }>({
    name: 'showTitle',
    type: 'autocomplete',
    message: 'Enter the show name',
    choices: showList,
  });

  const showPath = path.join(showBasePath, showTitle);
  if (!(await fs.exists(showPath))) {
    console.log('Creating new show path');
    await fs.mkdir(showPath);
  }

  const seasonList = await fs.readdir(showPath);
  seasonList.sort();
  const { season } = await enq.prompt<{ season: string }>({
    name: 'season',
    type: 'autocomplete',
    message: 'Enter the season',
    choices: seasonList,
  });

  const seasonPath = path.join(showPath, season);
  if (!(await fs.exists(seasonPath))) {
    console.log('Creating new season path');
    await fs.mkdir(showPath);
  }

  // Example Title: "Doctor Who (2007) [tmdbid-111]"  this will remove the year and tmdb
  const cleanShowTitle = showTitle.replace(/(\([\w\d\s]+\))(\s+\[[\w\d\s-]+\])?/, '').trim();
  // Example: "Season 01" -> Will return the 2 digits for the Season. TODO: Use regex
  const seasonNumber = season.slice(-2);
  const currentEpisode = await getShowCurrentEpisode(seasonPath);

  const paths: string[] = [];
  for (let i = 1; i <= wantedPaths; i++) {
    const episode = String(currentEpisode + i).padStart(2, '0');
    paths.push(path.join(seasonPath, `${cleanShowTitle} S${seasonNumber}E${episode}.mkv`));
  }
  return paths;
}

async function getShowCurrentEpisode(seasonPath: string): Promise<number> {
  const existingEpisodes = await fs.readdir(seasonPath);
  if (existingEpisodes.length === 0) {
    return 0;
  }

  let lastEpisode = 1;
  for (const filename of existingEpisodes) {
    const match = filename.match(/S(\d+)E(\d+)/);
    if (!match) {
      continue;
    }
    const episode = Number(match[2]);
    if (!episode) {
      continue;
    }

    if (episode > lastEpisode) {
      lastEpisode = episode;
    }
  }
  return lastEpisode;
}
