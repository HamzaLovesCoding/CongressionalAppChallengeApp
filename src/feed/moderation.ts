// Light comment moderation. A comment with a slur or strong profanity is not posted and the sheet says "Keep it clean."
// This runs in the app only: it keeps honest mistakes out, but it can't stop someone calling the server directly.
// The length limit (1–300 characters) is enforced by both the app and the database.

const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

// Whole words, after lowercasing and collapsing stretched letters ("shiiit").
const WORDS = new Set([
  'fuck', 'fuk', 'fucker', 'fucking', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'asshole', 'dick', 'dickhead', 'cunt',
  'bastard', 'piss', 'slut', 'whore', 'cock', 'prick', 'twat', 'wanker',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'kike', 'spic', 'chink', 'coon', 'gook', 'wetback', 'beaner',
]);
// Unmistakable stems ('cunt' is whole-word only so 'Scunthorpe' is fine), also caught inside longer strings and with letters spaced out ("f u c k"). Doubled letters are
// written out so ordinary words like "Niger" or "a bit chilly" are left alone.
const STEMS = [/f+u+c+k+/, /n+i+g{2,}(e+r+|a+)/, /f+a+g{2,}o+t+/];

const collapse = (text: string) => text.replace(/(.)\1+/g, '$1');
const letters = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function flagged(text: string): boolean {
  const words = text.split(/[^a-z]+/).filter(Boolean);
  if (words.some(word => WORDS.has(word) || WORDS.has(collapse(word)))) return true;
  const squashed = text.replace(/[^a-z]/g, '');
  return STEMS.some(stem => stem.test(squashed));
}

export function isClean(text: string): boolean {
  const plain = letters(text);
  // Symbols read two ways: as breaks ("sh!t" is "sh" and "t") and as look-alike letters ("sh!t" is "shit").
  const swapped = plain.replace(/[013457@$!]/g, char => LOOKALIKES[char]);
  return !flagged(plain) && !flagged(swapped);
}
