import fs from 'node:fs';
import { $, spawn } from 'bun';
import { Spinner } from 'cli-spinner';
import { localDebug, localHandbrakeOutput } from './config';
import { DvdMetadataSchema } from './dvdMetadata';
import { Logger } from './logger';

export async function scanDisk(dvdPath: string): Promise<DvdMetadataSchema> {
  if (localDebug()) {
    const testFile = fs.readFileSync(localHandbrakeOutput()!, {
      encoding: 'utf-8',
    });
    return parseScanOutput(testFile);
  }

  const spinner = new Spinner('Scanning DVD...');
  spinner.setSpinnerString(18);
  spinner.start();

  const { stdout, stderr, exitCode } = await $`HandBrakeCLI -i ${dvdPath} --title 0 --json --verbose=0`.quiet();

  spinner.stop(true);

  if (exitCode !== 0) {
    throw new Error(`Scanning DVD failed with exit code: ${exitCode}!`, {
      cause: new Error(stderr.toString('utf-8')),
    });
  }

  const dvdData = parseScanOutput(stdout.toString('utf-8'));
  Logger.success('DVD data read');

  return dvdData;
}

function parseScanOutput(rawOutput: string): DvdMetadataSchema {
  const targetJson = rawOutput.split('Title Set:')[1];
  if (!targetJson) {
    throw new Error('Could not parse output');
  }
  const rawDdvdData = JSON.parse(targetJson);
  const dvdData = DvdMetadataSchema.parse(rawDdvdData);

  // Validate that the mainFeature exists.
  const mainFeatureTitle = dvdData.TitleList.find((title) => title.Index === dvdData.MainFeature);
  if (!mainFeatureTitle) {
    Logger.error('DVD did not declare a correct "MainFeature"! Setting main feature to first Title');
    dvdData.MainFeature = dvdData.TitleList.at(0)?.Index!;
  }

  return dvdData;
}

export type TitleRipConfig = {
  titleIndex: number;
  outputFile: string;
};

export async function ripDvdTitles(titles: TitleRipConfig[]): Promise<void> {
  for (const title of titles) {
    if (localDebug()) {
      Logger.success(`Not ripping title ${title.titleIndex} to ${title.outputFile}`);
      continue;
    }

    const spinner = new Spinner(`Ripping DVD title ${title.titleIndex}...`);
    spinner.setSpinnerString(18);
    spinner.start();

    const handbrakeProcess = spawn(
      [
        'HandBrakeCLI',
        '-i',
        '/dev/sr0',
        '--title',
        title.titleIndex.toString(),
        '--encoder',
        'x264',
        '--encoder-preset',
        'slower',
        '--encoder-tune',
        'film',
        '--quality',
        '18',
        '--aencoder',
        'av_aac',
        '--ab',
        '192',
        '--all-audio',
        '--all-subtitles',
        '--verbose',
        '0',
        '--optimize',
        '-o',
        title.outputFile,
      ],
      {
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    const interval = setInterval(async () => {
      const reader = await handbrakeProcess.stdout.getReader();
      const readChunk = (await reader.read()).value;
      reader.releaseLock();

      if (!readChunk) {
        return;
      }
      const text = new TextDecoder().decode(readChunk);
      const lines = text.split('\n');
      const lastLine = lines[lines.length - 1]!;

      const match = lastLine.match(/ETA (\d{2}h\d{2}m\d{2}s)/);
      if (match) {
        spinner.setSpinnerTitle(`Ripping DVD title ${title.titleIndex}... (ETA ${match[1]})`);
      }
    }, 10000);

    await handbrakeProcess.exited;
    clearInterval(interval);

    spinner.stop(true);

    const errorOutput = await handbrakeProcess.stderr.text();
    if (handbrakeProcess.exitCode !== 0) {
      throw new Error(`Ripping DVD failed: ${handbrakeProcess.exitCode}!`, {
        cause: new Error(errorOutput),
      });
    }

    Logger.success(`Successfully ripped title ${title.titleIndex}!`);
  }
}
