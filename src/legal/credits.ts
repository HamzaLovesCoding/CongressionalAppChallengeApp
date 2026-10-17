import { VIDEO_LESSONS } from '../feed/curriculum.ts';

// The attribution register behind Credits & sources (docs/lane/08-credits-and-attribution-register.md).
// Video rows come from each lesson's own credit record, so a new lesson is credited by its data.
// Unknown facts stay null and are shown as pending; never fill them from a filename or a guess.

export type VideoCredit = {
  lessonId: string; lessonTitle: string; sourceTitle: string; sourceUrl: string;
  creator: string | null; license: string; licenseVariant: string | null; localFile: string;
};

export const VIDEO_CREDITS: VideoCredit[] = VIDEO_LESSONS.map(lesson => ({
  lessonId: lesson.id, lessonTitle: lesson.title,
  sourceTitle: lesson.lesson!.credit.title, sourceUrl: lesson.lesson!.credit.url,
  // Owner confirmed Creative Commons status for clips 1–19 on 2026-10-13; the source link is the recorded credit (owner, 2026-10-16).
  creator: null, license: 'Creative Commons (confirmed by the project owner)', licenseVariant: null,
  localFile: lesson.video!,
}));

export const LEARNING_SOURCES = [
  { title: 'California Quick Reference Driver’s Handbook (DL 600X, 2025)', publisher: 'California Department of Motor Vehicles', use: 'Rules, corrections and handbook page citations in every lesson and check.', url: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/' },
  { title: 'California Driver’s Handbook', publisher: 'California Department of Motor Vehicles', use: 'Handbook sections cited by the ten practice scenarios.', url: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/' },
  { title: 'Crash data for Novato, 2023', publisher: 'California Office of Traffic Safety', use: 'Local figures in each lesson’s “Why it matters here.”', url: null },
] as const;

export const OPEN_SOURCE = [
  { name: 'Babylon.js (@babylonjs/core)', version: '9.27.1', license: 'Apache License 2.0', use: '3D practice scenarios', url: 'https://github.com/BabylonJS/Babylon.js' },
  { name: 'IBM Plex Sans', version: '@ibm/plex-sans-variable 0.2.0', license: 'SIL Open Font License 1.1', use: 'App typeface (license file: fonts/ibm-plex-OFL.txt)', url: 'https://github.com/IBM/plex' },
] as const;

export const ORIGINAL_MATERIALS = [
  'The Lane logo and app icon were supplied by the project owner.',
  'The ten practice scenarios use original, code-generated 2D and 3D scenes; they include no third-party artwork.',
  'Garage cars, the Progress road and lesson poster maps are drawn by Lane’s own code.',
  'Lesson still images are the first frames of the credited lesson videos.',
] as const;
