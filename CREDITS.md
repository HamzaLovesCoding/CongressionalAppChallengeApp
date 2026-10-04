# Credits

No external assets were used. All scene meshes, materials, and UI graphics were
created in this project.

- Geometry (roads, kerbs, buildings, trees, street furniture, signals, vehicles,
  cockpit trim) is generated at runtime from Babylon.js primitives and hand-built
  vertex data in `src/scene/`.
- The sky gradient and feathered contact shadows use generated mesh vertex colours;
  the sunlight uses Babylon's shadow map. No skybox or ambient-occlusion textures.
- Materials and the colour palette are defined in `src/scene/materials.ts`.
  Sign lettering is drawn into a Babylon `DynamicTexture` with the Canvas 2D API.
- UI iconography (brand mark, camera glyph, timeline, progress dots) is CSS and
  Unicode text in `src/ui/controls.ts` and `src/style.css`.
- Engine and horn tones, a decision chime, and filtered tyre noise are generated
  from WebAudio oscillators and an in-memory noise buffer in `src/audio/`.
- No image, audio, or model files ship with the project. The simulator UI uses
  the same self-hosted IBM Plex fonts as the Lane feed.
- The Lane feed uses [IBM Plex](https://github.com/IBM/plex) Sans, Sans Condensed,
  and Mono from the supplied Lane preview. They are self-hosted under the SIL Open
  Font License 1.1, included at `public/fonts/ibm-plex-OFL.txt`.
- The feed's current layout and palette follow the supplied Lane interactive preview.

Screenshots and the locally generated phone-test QR code in `artifacts/` are
development aids and are not bundled in the app.

The only third-party runtime dependency is [Babylon.js](https://www.babylonjs.com/)
(`@babylonjs/core`, Apache-2.0).
