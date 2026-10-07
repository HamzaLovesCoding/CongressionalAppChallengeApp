# Home artwork

The home screen uses real Lane progress and lesson data. The generated mascot
remains decorative. Conversation and reward images are retained as reference
assets but are no longer shown on Home. Progress indicators are native HTML
`progress` elements styled with CSS; no text or progress values are baked into
images. Fake status-bar and home-indicator artwork is no longer rendered.

## Generated images

Generated with the built-in image-generation tool on October 5, 2026, using the
user-supplied `image-1.png` as a style/composition reference and requesting a
transparent background. These are recreated illustrations, not original assets
extracted from the reference. The files are stored in the project:

- `public/images/home/mascot.png`
- `public/images/home/conversation.png`
- `public/images/home/reward.png`

### Mascot prompt

A single cute small round white mascot in a bright lime green frog costume, two frog eyes on top of hood, two tiny green sprout leaves on top, pink circular cheeks, shiny black eyes and smiling tiny mouth, tiny waving arm. Front facing bust portrait, full head and shoulders, playful polished 3D toy style with soft shading, close to the cute frog-costumed mascot in the reference. Isolated centered subject with transparent background, no text, no UI, no other objects. Artwork for the greeting area of a mobile learning app.

### Conversation prompt

Two friendly young adults chatting, waist-up, girl on left with long wavy black hair and pink shirt, boy on right with short black hair and golden orange shirt. Facing each other smiling. White speech bubble above between them containing three green dots. Polished cute 3D cartoon educational app illustration with rounded forms, soft lighting. Match the reference lesson card illustration. Both bodies fade gently to transparent at bottom. Transparent background, no card or UI, no text. Tight composition square.

### Reward prompt

A small emerald green gift box with shiny golden ribbon, open lid, several tiny gold coins floating upward, cheerful reward icon in polished 3D mobile learning app style, like the reference daily goal gift. Transparent background, one isolated centered object, no text, no UI.

## Other graphics

Navigation, metric icons, and the decorative road on Home are inline SVG in
`icons.ts` and `home.ts`. Earlier reference illustrations remain in `artwork.ts`.
Typography uses the existing self-hosted IBM Plex.
