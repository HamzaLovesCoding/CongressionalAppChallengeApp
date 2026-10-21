import { VIDEO_LESSONS } from '../feed/curriculum.ts';
import { HANDBOOK } from '../content/handbook.ts';

// The attribution register behind Credits & sources (readable copy: docs/credits.md).
// Video rows come from each lesson's own credit record, so a new lesson is credited by its data.
// Unknown facts stay null and are shown as pending; never fill them from a filename or a guess.

export type VideoCredit = {
  lessonId: string; lessonTitle: string; sourceTitle: string; sourceUrl: string;
  creator: string | null; license: string; licenseVariant: string | null; localFile: string;
};

export const VIDEO_CREDITS: VideoCredit[] = VIDEO_LESSONS.map(lesson => ({
  lessonId: lesson.id, lessonTitle: lesson.title,
  sourceTitle: lesson.lesson!.credit.title, sourceUrl: lesson.lesson!.credit.url,
  // Owner confirmed CC BY 3.0 for clips 1–19 (2026-10-17); creator is the uploading channel, read from YouTube.
  creator: lesson.lesson!.credit.creator, license: 'Creative Commons', licenseVariant: 'CC BY 3.0',
  localFile: lesson.video!,
}));

export const CC_BY_3 = 'https://creativecommons.org/licenses/by/3.0/';

// The coach quotes the handbook, whose license asks for this exact credit line (handbook copyright page).
export const HANDBOOK_LICENSE = 'California Driver’s Handbook, California Department of Motor Vehicles, licensed under CC BY-NC 4.0.';
export const CC_BY_NC_4 = 'https://creativecommons.org/licenses/by-nc/4.0/';

export const LEARNING_SOURCES = [
  { title: HANDBOOK, publisher: 'California Department of Motor Vehicles', use: 'Rules, corrections and handbook page citations in every lesson and check, and the driver coach’s source and quotes.', url: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/' },
  { title: 'California Driver’s Handbook', publisher: 'California Department of Motor Vehicles', use: 'Handbook sections cited by the ten practice scenarios.', url: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/' },
  { title: 'Crash data for Novato, 2023', publisher: 'California Office of Traffic Safety', use: 'Local figures in each lesson’s “Why it matters here.”', url: null },
] as const;

// Services behind a feature, rather than code the app ships.
export const SERVICES = [
  { name: 'Claude Sonnet 5.5, by Anthropic', use: 'Writes the driver coach’s answers from the California Driver’s Handbook. Anthropic does not endorse Lane.', url: 'https://www.anthropic.com/' },
] as const;

export const OPEN_SOURCE = [
  { name: 'Babylon.js (@babylonjs/core)', version: '9.27.1', license: 'Apache License 2.0', use: '3D practice scenarios', url: 'https://github.com/BabylonJS/Babylon.js' },
  { name: 'IBM Plex Sans', version: '@ibm/plex-sans-variable 0.2.0', license: 'SIL Open Font License 1.1', use: 'App typeface (license file: fonts/ibm-plex-OFL.txt)', url: 'https://github.com/IBM/plex' },
] as const;

export const ORIGINAL_MATERIALS = [
  'We designed the Lane logo and app favicon ourselves.',
  'We made the 2D and 3D scenes in the practice scenarios ourselves. DriveFocus gave us the idea, though its style is very different.',
  'We also made the Garage cars, the Progress road and the lesson posters ourselves.',
] as const;
