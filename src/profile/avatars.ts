export const AVATARS = [
  { id: 'sprout', name: 'Sprout', price: 0, image: '/images/avatars/road-crew/sprout.png', description: 'Olive frog', color: 'olive' },
  { id: 'sunny', name: 'Sunny', price: 10, image: '/images/avatars/road-crew/sunny.png', description: 'Ochre bear', color: 'ochre' },
  { id: 'cloud', name: 'Cloud', price: 20, image: '/images/avatars/road-crew/cloud.png', description: 'Stone koala', color: 'stone' },
  { id: 'peach', name: 'Peach', price: 20, image: '/images/avatars/road-crew/peach.png', description: 'Clay fox', color: 'clay' },
] as const;

export const DEFAULT_AVATAR = AVATARS[0].id;
export type AvatarId = typeof AVATARS[number]['id'];
export const avatarById = (id: string) => AVATARS.find(avatar => avatar.id === id);
