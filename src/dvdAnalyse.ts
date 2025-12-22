import { type DvdMetadataSchema, durationToSeconds, type TitleSchema } from './dvdMetadata';
import { Logger } from './logger';

export function sortTitlesByPriority(dvdMeta: DvdMetadataSchema) {
  const priorityMap: Record<number, number> = {};

  for (const title of dvdMeta.TitleList) {
    let prio = 0;

    if (title.Index === dvdMeta.MainFeature) {
      prio += 5;
    }

    const duration = durationToSeconds(title);
    if (duration < 300) {
      prio -= 1;
    } else if (duration > 600) {
      prio += 1;
    }

    priorityMap[title.Index] = prio;
  }

  Logger.debug(`Created priorty map: ${JSON.stringify(priorityMap)}`);

  dvdMeta.TitleList.sort((a, b) => {
    const prioA = priorityMap[a.Index] ?? 0;
    const prioB = priorityMap[b.Index] ?? 0;
    if (prioA !== prioB) {
      return prioB - prioA;
    }
    return a.Index - b.Index;
  });
}

export type MovieConfiguration = {
  type: 'movie';
  titleIndex: number;
};
export type ShowConfiguration = {
  type: 'show';
  showIndexes: number[];
};

export function detectDvdType(dvdMeta: DvdMetadataSchema): MovieConfiguration | ShowConfiguration {
  const possibleEpisodes: number[] = [];
  for (const title of dvdMeta.TitleList) {
    const duration = durationToSeconds(title);
    if (duration > 15 * 60) {
      possibleEpisodes.push(title.Index);
    }
  }

  if (possibleEpisodes.length < 2) {
    Logger.debug('Only one title with Longer duration found! DVD is likely a movie!');
    return { type: 'movie', titleIndex: dvdMeta.MainFeature };
  }

  let bestMatches: number[] = [];
  for (const aIndex of possibleEpisodes) {
    const matches: number[] = [aIndex];
    const aTitle = dvdMeta.TitleList.find((title) => title.Index === aIndex)!;

    for (const bIndex of possibleEpisodes) {
      if (aIndex === bIndex) {
        continue;
      }
      const bTitle = dvdMeta.TitleList.find((title) => title.Index === bIndex)!;

      // To the length match for about 10 percent?
      const aDuration = durationToSeconds(aTitle);
      const bDuration = durationToSeconds(bTitle);
      if (aDuration > bDuration * 1.15 || aDuration < bDuration * 0.85) {
        continue;
      }

      // Do both titles have the same audio tracks? this also filters out Episodes with Commentary
      const aAudioList = extractAudioList(aTitle).join('');
      const bAudioList = extractAudioList(aTitle).join('');
      if (aAudioList !== bAudioList) {
        continue;
      }

      matches.push(bIndex);
    }

    if (matches.length > bestMatches.length) {
      bestMatches = matches;
    }
  }

  if (bestMatches.length < 2) {
    Logger.debug('No titles with matching durations found! DVD is likely a movie!');
    return {
      type: 'movie',
      titleIndex: dvdMeta.MainFeature,
    };
  }

  Logger.debug(`Found multiple titles with common length: ${JSON.stringify(bestMatches)}`);

  // There should not so many titles on one dvd. The DVD may has some titles duplicated
  if (bestMatches.length > 3) {
    const knowsLengths: number[] = [];
    bestMatches = bestMatches.filter((titleIndex) => {
      const title = dvdMeta.TitleList.find((title) => title.Index === titleIndex)!;
      const duration = durationToSeconds(title);
      if (knowsLengths.includes(duration)) {
        return false;
      }
      knowsLengths.push(duration);
      return true;
    });

    Logger.debug(`Removed possible duplicates with same length: ${JSON.stringify(bestMatches)}`);
  }

  return {
    type: 'show',
    showIndexes: bestMatches,
  };
}

function extractAudioList(title: TitleSchema): string[] {
  const list = title.AudioList.filter((audio) => audio.LanguageCode !== 'und' && audio.Attributes.Normal === true).map(
    (audio) => audio.LanguageCode,
  );
  return [...new Set(list)].toSorted();
}
