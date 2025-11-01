import z from 'zod';

//#region ZodSchema
const CollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
});

const GenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const ProductionCompanySchema = z.object({
  id: z.number(),
  logo_path: z.string().nullable(),
  name: z.string(),
  origin_country: z.string(),
});

const ProductionCountrySchema = z.object({
  iso_3166_1: z.string(),
  name: z.string(),
});

const SpokenLanguageSchema = z.object({
  english_name: z.string(),
  iso_639_1: z.string(),
  name: z.string(),
});

const TMDBMovieSchema = z.object({
  adult: z.boolean(),
  backdrop_path: z.string().nullable(),
  belongs_to_collection: CollectionSchema.nullable(),
  budget: z.number(),
  genres: z.array(GenreSchema),
  homepage: z.string(),
  id: z.number(),
  imdb_id: z.string(),
  origin_country: z.array(z.string()),
  original_language: z.string(),
  original_title: z.string(),
  overview: z.string(),
  popularity: z.number(),
  poster_path: z.string().nullable(),
  production_companies: z.array(ProductionCompanySchema),
  production_countries: z.array(ProductionCountrySchema),
  release_date: z.string(),
  revenue: z.number(),
  runtime: z.number(),
  spoken_languages: z.array(SpokenLanguageSchema),
  status: z.string(),
  tagline: z.string(),
  title: z.string(),
  video: z.boolean(),
  vote_average: z.number(),
  vote_count: z.number(),
});
type TmdbMovieSchema = z.infer<typeof TMDBMovieSchema>;
//#endRegion

//#region API requests
export async function loadMovieDetails(
  tmdbToken: string,
  movieId: number,
  lang: string = 'en-US',
): Promise<TmdbMovieSchema> {
  const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?language=${lang}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${tmdbToken}`,
    },
  });
  if (response.status !== 200) {
    throw new Error(`TMDB Movie request failed (${response.status}): ${await response.text()}`);
  }

  return TMDBMovieSchema.parse(await response.json());
}
//#endRegion
