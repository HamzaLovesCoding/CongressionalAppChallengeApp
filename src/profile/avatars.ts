export const AVATARS = [
  { id: 'sprout', name: 'Sprout', price: 0, image: '/images/home/mascot.png', description: 'Your cheerful green companion.' },
  { id: 'sunny', name: 'Sunny', price: 10, image: '/images/avatars/sunny.png', description: 'A little sunshine for the road.' },
  { id: 'cloud', name: 'Cloud', price: 20, image: '/images/avatars/cloud.png', description: 'Taking it one calm step at a time.' },
  { id: 'peach', name: 'Peach', price: 20, image: '/images/avatars/peach.png', description: 'Curious about what comes next.' },
] as const;

export const DEFAULT_AVATAR = AVATARS[0].id;
export type AvatarId = typeof AVATARS[number]['id'];
export const avatarById = (id: string) => AVATARS.find(avatar => avatar.id === id);
