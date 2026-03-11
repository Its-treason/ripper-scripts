import figures from 'figures';
import { z } from 'zod';
import { Logger } from './logger';

//#region Zod Schema
const DurationSchema = z.object({
  Hours: z.number(),
  Minutes: z.number(),
  Seconds: z.number(),
  Ticks: z.number(),
});

const AttributesSchema = z.object({
  AltCommentary: z.boolean(),
  Commentary: z.boolean(),
  Default: z.boolean(),
  Normal: z.boolean(),
  Secondary: z.boolean(),
  VisuallyImpaired: z.boolean(),
});

const AudioTrackSchema = z.object({
  Attributes: AttributesSchema,
  BitRate: z.number(),
  ChannelCount: z.number(),
  ChannelLayout: z.number().or(z.string()).optional(),
  ChannelLayoutName: z.string().optional(),
  Codec: z.number(),
  CodecName: z.string(),
  CodecParam: z.number(),
  Description: z.string(),
  LFECount: z.number(),
  Language: z.string(),
  LanguageCode: z.string(),
  SampleRate: z.number(),
  TrackNumber: z.number(),
  Name: z.string().optional(),
});

const ChapterSchema = z.object({
  Duration: DurationSchema,
  Name: z.string(),
});

const SubtitleAttributesSchema = z.object({
  '4By3': z.boolean(),
  Children: z.boolean(),
  ClosedCaption: z.boolean(),
  Commentary: z.boolean(),
  Default: z.boolean(),
  Forced: z.boolean(),
  Large: z.boolean(),
  Letterbox: z.boolean(),
  Normal: z.boolean(),
  PanScan: z.boolean(),
  Wide: z.boolean(),
});

const SubtitleSchema = z.object({
  Attributes: SubtitleAttributesSchema,
  Format: z.string(),
  Language: z.string(),
  LanguageCode: z.string(),
  Source: z.number(),
  SourceName: z.string(),
  TrackNumber: z.number(),
  Name: z.string().optional(),
});

const ColorSchema = z.object({
  ChromaLocation: z.number(),
  Format: z.number(),
  Matrix: z.number(),
  Primary: z.number(),
  Range: z.number(),
  Transfer: z.number(),
});

const RatioSchema = z.object({
  Den: z.number(),
  Num: z.number(),
});

const GeometrySchema = z.object({
  Height: z.number(),
  PAR: RatioSchema,
  Width: z.number(),
});

const TitleSchema = z.object({
  AngleCount: z.number(),
  AudioList: z.array(AudioTrackSchema),
  ChapterList: z.array(ChapterSchema),
  Color: ColorSchema,
  Crop: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  Duration: DurationSchema,
  FrameRate: RatioSchema,
  Geometry: GeometrySchema,
  Index: z.number(),
  InterlaceDetected: z.boolean(),
  LooseCrop: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  Metadata: z.unknown(),
  Name: z.string(),
  Path: z.string(),
  Playlist: z.number(),
  SubtitleList: z.array(SubtitleSchema),
  Type: z.number(),
  VideoCodec: z.string(),
});
export type TitleSchema = z.infer<typeof TitleSchema>;

export const DvdMetadataSchema = z.object({
  MainFeature: z.number(),
  TitleList: z.array(TitleSchema),
});
export type DvdMetadataSchema = z.infer<typeof DvdMetadataSchema>;
//#endRegion

//#region Utility functions
export function durationToSeconds(title: TitleSchema): number {
  return title.Duration.Seconds + title.Duration.Minutes * 60 + title.Duration.Hours * 60 * 60;
}

export function formatDuration(title: TitleSchema): string {
  let duration = '';
  if (title.Duration.Hours) {
    duration += `${title.Duration.Hours}h`;
  }
  if (title.Duration.Minutes) {
    duration += ` ${title.Duration.Minutes}m`;
  }
  if (title.Duration.Seconds) {
    duration += ` ${title.Duration.Seconds}s`;
  }

  return duration.trim();
}

export function showDvdData(data: DvdMetadataSchema) {
  const mainFeature = data.MainFeature;

  const lines: string[] = [];
  let dvdName;
  for (const title of data.TitleList) {
    dvdName = title.Name;

    const audioList = title.AudioList.reduce((acc: string[], audio) => {
      let specialAudio = '';
      if (audio.Attributes.AltCommentary || audio.Attributes.Commentary) {
        specialAudio = ' (Commentary)';
      }

      acc.push(`${audio.Language}${specialAudio}`);
      return acc;
    }, []).join(', ');

    const subtitleListArr = title.SubtitleList.reduce((acc: string[], audio) => {
      let specialAudio = '';
      if (audio.Attributes.Commentary) {
        specialAudio = ' (Commentary)';
      }

      acc.push(`${audio.LanguageCode}${specialAudio}`);
      return acc;
    }, []);
    const subtitleList = [...new Set(subtitleListArr)].join(', ');

    const duration = formatDuration(title);

    const textLines = [
      Logger.textPrimary(`Title: ${title.Index}`),
      ` ${figures.triangleLeftSmall} Duration: ${duration}`,
      title.Index === mainFeature ? ` ${figures.triangleLeftSmall} ${Logger.textPrimary('Main Feature')}` : undefined,
      audioList.length > 0 ? ` ${figures.triangleLeftSmall} Audio: ${audioList}` : undefined,
      subtitleList.length > 0 ? ` ${figures.triangleLeftSmall} Subtitles: ${subtitleList}` : undefined,
    ];

    lines.push(textLines.filter(Boolean).join('\n'));
  }

  console.log(Logger.textPrimary(`DVD contents${dvdName ? ` of "${dvdName}"` : ''}:`));
  console.log(lines.join('\n'));
}

export function createShortTitleName(title: TitleSchema, mainFeatureIndex: number): string {
  let mainFeature = ' ';
  if (title.Index === mainFeatureIndex) {
    mainFeature = ' (Main Feature)';
  }

  const audioList = title.AudioList.map((audio) => audio.LanguageCode);
  const uniqueAudioList = [...new Set(audioList)].filter((code) => code !== 'und'); // und -> undetermined
  let audioText = '';
  if (uniqueAudioList.length !== 0) {
    audioText = ` (${uniqueAudioList.join(', ')})`;
  }

  return `Title ${title.Index}: ${formatDuration(title)}${mainFeature}${audioText}`;
}
//#endRegion
