import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, Matrix, Scene, ShadowGenerator, Vector3 } from './babylon';
import { palette } from './materials';
import { createScenery } from './scenery';
import { createVehicle, createAmbientTraffic } from './vehicles';
import { createSignals } from './signals';
import { createCameras } from './cameras';
import { createReplayAnnotations } from './replay';
import { CAR_FRONT, Scenario, STOP_LINE_Z } from '../scenario/scenario';
import { mountControls } from '../ui/controls';
import { createPerformanceProbe } from './performance';
import { createDrivingAudio } from '../audio/drivingAudio';
import { createSky, focusShadows } from './lighting';

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export async function createDrivingLab(root: HTMLElement, onExit?: () => void) {
  const scenario = new Scenario();
  const performanceProbe = createPerformanceProbe();
  const audio = createDrivingAudio();
  let switchCamera = () => {};
  const controls = mountControls(root, scenario, () => switchCamera(), audio, onExit);
  try {
    controls.progress(8, 'Starting the 3D engine…');
    await nextFrame();
    const engine = new Engine(controls.canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' });
    const dprCap = 1.5;
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, dprCap));
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString('#d6e5dfFF');
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 65;
    scene.fogEnd = 175;
    scene.fogColor = Color3.FromHexString('#d6e5df');
    scene.ambientColor = Color3.FromHexString('#e2ead3').scale(.25);
    const ambient = new HemisphericLight('sky fill', new Vector3(0, 1, .1), scene);
    ambient.intensity = .48;
    ambient.groundColor = Color3.FromHexString('#748977');
    const sun = new DirectionalLight('late morning sunlight', new Vector3(-.55, -1, .42), scene);
    sun.position.set(35, 65, -30);
    sun.intensity = .72;
    sun.diffuse = Color3.FromHexString('#fff4d9');
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 160;
    const shadows = new ShadowGenerator(1024, sun);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    shadows.bias = .0015;
    shadows.normalBias = .03;
    shadows.setDarkness(.24);
    const updateShadows = focusShadows(sun);
    updateShadows(false, -80);
    createSky(scene);
    const p = palette(scene);
    controls.progress(24, 'Laying out Cedar Crossing…');
    await nextFrame();
    const scenery = createScenery(scene, p, shadows);
    controls.progress(52, 'Bringing the neighborhood to life…');
    await nextFrame();
    const playerPaint = '#549da7';
    const player = createVehicle(scene, p, shadows, 'your blue car', playerPaint);
    player.root.position.set(1.85, 0, -80);
    const crossing = createVehicle(scene, p, shadows, 'orange cross traffic', '#e3985b');
    crossing.root.rotation.y = -Math.PI / 2;
    crossing.root.position.set(79.6, 0, 1.85);
    const traffic = createAmbientTraffic(scene, p, shadows);
    const signals = createSignals(scene, p);
    const cameras = createCameras(scene, engine, player, p, playerPaint);
    const annotations = createReplayAnnotations(scene);
    switchCamera = () => cameras.setMode(cameras.mode === 'driver' ? 'overhead' : 'driver');
    controls.progress(76, 'Warming sunlight and checking signals…');
    await nextFrame();
    signals.update('green', false);
    cameras.update(0, -80, 0, false);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    await scene.whenReadyAsync();
    scene.render();
    controls.progress(100, 'Your lane is ready.');
    await nextFrame();
    controls.ready();
    await nextFrame();
    performanceProbe.firstFrame();
    scenario.start();
    const showPerformance = new URLSearchParams(location.search).get('perf') === '1';
    controls.performance.hidden = !showPerformance;
    let lastState = scenario.state;
    let performanceElapsed = 0;
    let qualityElapsed = 0;
    let qualitySamples = 0;
    let qualityTime = 0;
    let previousTime = performance.now();
    let disposed = false;
    let renderedFrames = 0;

    // Labels are pinned to world points but nudged apart on screen, so the two cars
    // stay readable in the replay even at the moment they almost meet.
    function label(element: HTMLElement, position: Vector3, show: boolean, offsetY = -25, offsetX = 0) {
      if (!show) { element.style.display = 'none'; return; }
      const viewport = cameras.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      const projected = Vector3.Project(position, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
      const rect = controls.canvas.getBoundingClientRect();
      const x = projected.x / engine.getRenderWidth() * rect.width;
      const y = projected.y / engine.getRenderHeight() * rect.height;
      if (projected.z < 0 || projected.z > 1 || x < 20 || x > rect.width - 20 || y < 110 || y > rect.height - 15) { element.style.display = 'none'; return; }
      element.style.display = 'block';
      const left = Math.max(6, Math.min(rect.width - element.offsetWidth - 6, x + offsetX - element.offsetWidth / 2));
      element.style.transform = `translate(${left}px, ${y + offsetY}px)`;
    }
    const render = () => {
      const now = performance.now();
      const elapsedMs = now - previousTime;
      const dt = Math.min(elapsedMs / 1000, .05);
      previousTime = now;
      scenario.update(dt);
      if (scenario.state !== lastState) {
        if (scenario.state === 'replay' && lastState === 'outcome') cameras.setMode('overhead');
        if (scenario.state === 'approaching') cameras.setMode('driver');
        lastState = scenario.state;
      }
      player.root.position.z = scenario.playerZ;
      crossing.root.position.x = scenario.crossX;
      player.update(scenario.worldTime, scenario.moving && scenario.speed > 0, scenario.recordedPressure > 0 && scenario.speed > 0);
      crossing.update(scenario.worldTime, scenario.moving);
      traffic.update(scenario.worldTime);
      scenery.update(scenario.worldTime);
      signals.update(scenario.phase, scenario.crossGreen);
      cameras.update(dt, scenario.playerZ, scenario.worldTime, scenario.moving);
      updateShadows(cameras.mode === 'overhead', scenario.playerZ);
      annotations.update(scenario.isReplay && cameras.mode === 'overhead', scenario);
      audio.update(scenario);
      controls.update(cameras.mode);
      scene.render();
      if (showPerformance) performanceProbe.frame(elapsedMs, scenario.state, cameras.mode === 'overhead', scenario.moving);
      renderedFrames++;
      const showLabels = scenario.isReplay && cameras.mode === 'overhead';
      const nearStopLine = scenario.choice === 'brake' && Math.abs(STOP_LINE_Z - scenario.playerZ - CAR_FRONT) < 4;
      label(controls.labels.player, new Vector3(1.85, 1.8, scenario.playerZ), showLabels, -14, nearStopLine ? 54 : -56);
      label(controls.labels.cross, new Vector3(scenario.crossX, 1.8, 1.85), showLabels, -34, 60);
      label(controls.labels.stop, new Vector3(-2, .1, STOP_LINE_Z), showLabels, 2, -46);
      performanceElapsed += dt;
      if (showPerformance && performanceElapsed > .5) {
        const animations = scenario.moving ? scenery.animationCount + traffic.animationCount + (scenario.speed > 0 ? 1 : 0) + 1 : 0;
        controls.performance.textContent = `${engine.getFps().toFixed(0)} FPS · DPR ${(1 / engine.getHardwareScalingLevel()).toFixed(1)}\n${scene.getActiveMeshes().length} visible meshes · ${animations} animations`;
        controls.performanceReport(JSON.stringify({
          browser: navigator.userAgent, viewport: `${innerWidth}×${innerHeight}`, deviceDpr: devicePixelRatio,
          renderDpr: 1 / engine.getHardwareScalingLevel(), renderer: engine.getGlInfo().renderer,
          ...performanceProbe.snapshot(),
        }, null, 2));
        performanceElapsed = 0;
      }
      // Reduce only resolution after a sustained slow period; avoid quality oscillation.
      qualityTime += dt;
      qualityElapsed += engine.getDeltaTime();
      qualitySamples++;
      if (qualityTime > 4 && qualitySamples > 80) {
        if (qualityElapsed / qualitySamples > 34 && engine.getHardwareScalingLevel() < 1) engine.setHardwareScalingLevel(1);
        qualityTime = qualityElapsed = qualitySamples = 0;
      }
    };
    const resize = () => engine.resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(controls.canvas);
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    const visibility = () => {
      if (document.hidden) { performanceProbe.suspend(); audio.suspend(); engine.stopRenderLoop(render); }
      else { previousTime = performance.now(); engine.runRenderLoop(render); }
    };
    document.addEventListener('visibilitychange', visibility);
    engine.runRenderLoop(render);
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      engine.stopRenderLoop(render);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      controls.dispose();
      audio.dispose();
      scene.dispose();
      engine.dispose();
    };
    if (import.meta.hot) import.meta.hot.dispose(dispose);
    // Read-only development telemetry lets tests verify rendering and suspension.
    if (import.meta.env.DEV) Object.defineProperty(window, '__amber', {
      configurable: true,
      value: { snapshot: () => ({ state: scenario.state, choice: scenario.choice, time: scenario.time, approachTime: scenario.approachTime, playerZ: scenario.playerZ, crossX: scenario.crossX, phase: scenario.phase, crossGreen: scenario.crossGreen, camera: cameras.mode, renderedFrames, fps: engine.getFps(), meshCount: scene.getActiveMeshes().length, width: engine.getRenderWidth(), height: engine.getRenderHeight(), paused: scenario.paused, speed: scenario.speed, brakePressure: scenario.brakePressure, stoppingDistance: scenario.stoppingDistance, stopMargin: scenario.stopMargin, travelledDistance: scenario.travelledDistance, sampleCount: scenario.sampleCount, replayPlaying: scenario.replayPlaying, annotation: annotations.snapshot(), audio: audio.snapshot(), performance: performanceProbe.snapshot() }) },
    });
    return { dispose };
  } catch (error) {
    console.error('Amber failed to initialize', error);
    audio.dispose();
    controls.fail('The 3D scene could not start. Check that WebGL is enabled in your browser, then reload.');
    return { dispose: () => controls.dispose() };
  }
}
