import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scanDisk } from './handbrake';

describe('scanDisk', () => {
  // Generate more fixtures: "HandBrakeCLI -i /dev/sr0 --title 0 --json --verbose=0 2>/dev/null > out-test"

  test('With Movie', async () => {
    mock.module('./config', () => ({
      localDebug: () => true,
      localHandbrakeOutput: () => path.join(import.meta.dir, '../fixtures/handbrake_output_movie'),
    }));

    const result = await scanDisk();

    const expectedJson = readFileSync(path.join(import.meta.dir, '../fixtures/parsed_movie.json'), {
      encoding: 'utf-8',
    });
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  test('With Movie2', async () => {
    mock.module('./config', () => ({
      localDebug: () => true,
      localHandbrakeOutput: () => path.join(import.meta.dir, '../fixtures/handbrake_output_movie2'),
    }));

    const result = await scanDisk();

    const expectedJson = readFileSync(path.join(import.meta.dir, '../fixtures/parsed_movie2.json'), {
      encoding: 'utf-8',
    });
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  test('With Show', async () => {
    mock.module('./config', () => ({
      localDebug: () => true,
      localHandbrakeOutput: () => path.join(import.meta.dir, '../fixtures/handbrake_output_show'),
    }));

    const result = await scanDisk();

    const expectedJson = readFileSync(path.join(import.meta.dir, '../fixtures/parsed_show.json'), {
      encoding: 'utf-8',
    });
    expect(JSON.stringify(result)).toEqual(expectedJson);
  });

  test('With Invalid main Feature', async () => {
    mock.module('./config', () => ({
      localDebug: () => true,
      localHandbrakeOutput: () => path.join(import.meta.dir, '../fixtures/handbrake_output_movie_invalid_main_feature'),
    }));

    const errorMock = mock((_message: string) => {});
    mock.module('./logger', () => ({
      Logger: {
        error: errorMock,
      },
    }));

    const result = await scanDisk();

    const expectedJson = readFileSync(path.join(import.meta.dir, '../fixtures/parsed_invalid_main_feature.json'), {
      encoding: 'utf-8',
    });
    expect(JSON.stringify(result)).toEqual(expectedJson);

    expect(errorMock).toHaveBeenCalledWith(
      'DVD did not declare a correct "MainFeature"! Setting main feature to first Title',
    );
  });
});
