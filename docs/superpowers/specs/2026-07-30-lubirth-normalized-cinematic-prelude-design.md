# LuBirth Normalized Cinematic Prelude — Design Specification

**Status:** Architecture approved; implementation not started
**Date:** 2026-07-30
**Scope:** A query-only feasibility route on a new isolated branch. The default homepage, the archived Hybrid branch, and the rejected deep-impostor branch remain unchanged.

## 1. Decision

LuBirth will treat opening progress 0–0.18 as a **normalized cinematic prelude**, not as a geographically continuous real-time camera. It uses one opaque, offline-rendered plate with a narrowly bounded IP-derived composition offset. Geographic fidelity is intentionally suspended during that prelude.

At progress 0.18–0.22, the application performs an occlusion-based match cut into the already-running, real-IP Relief-lite scene. At and after 0.22, the plate is gone and existing real IP focus, Earth pullback, and Relief-lite semantics are authoritative.

This is a deliberate product-boundary adjustment. It is not a lossless replacement for the existing real-time opening camera.

## 2. Hard Constraints

- Hybrid and deep-impostor techniques are rejected and must not be tuned, reintroduced, or connected to the default homepage.
- The plate must cover only the WebGL Canvas. Header, title, navigation, accessibility content, and interactive DOM remain separate.
- The plate is opaque and receives no pointer events.
- TransitionVeil is an independent shared layer above both plate and Canvas. It is driven only by opening progress and transition state; the plate’s clouds merely motivate the visual cut.
- No ordinary opacity crossfade may expose mismatched continental textures.
- The plate must be armed before a forward prelude begins. A late first frame locks that forward cycle to Relief-lite; the plate may not appear midway through 0–0.18.
- A forward progress value at or above 0.22 releases decoded frames and presentation textures. Manifest data, provider state metadata, and browser cache entries may remain so reverse entry can rearm.
- prefers-reduced-motion, decode errors, background-resume uncertainty, low-memory cleanup, failed arming, and rendering fallback all select Relief-lite without blocking the page.
- First implementation ships one primary FrameProvider. Image-sequence and WebCodecs providers are escalation paths only if the primary provider cannot meet the frame-addressability gate.
- Byte ceilings may not be met by accepting banding, macroblocking, or loss of cloud detail. If visual quality and the relevant cap conflict, the asset specification is rejected.

## 3. Product Semantics

| Progress | Viewer semantic | Visible representation | Geographic promise |
| --- | --- | --- | --- |
| 0–0.18 | Normalized cinematic prelude | Opaque offline plate | Bounded IP composition only; no exact location claim |
| 0.18–0.22 | Representation boundary | Plate or live Canvas is exposed only behind TransitionVeil | Live scene is already at real IP state, but masked during the cut |
| >=0.22 | Real LuBirth scene | Canvas with Earth, real IP focus, Relief-lite and normal pullback | Existing true IP behavior resumes |

The plate’s IP input is a normalized two-dimensional composition vector, not a city-specific render key. Longitude is circularly normalized around the existing default location and latitude is clamped to a bounded vertical framing range. The resulting small crop/translation must stay inside the per-asset responsive safe-crop margin. It may not trigger per-city video selection, unrestricted orbit changes, or a distinct Earth texture.

## 4. Rendering Stack and Layer Ownership

~~~mermaid
flowchart TB
  Page["LuBirth route DOM"] --> Stack["Canvas-scoped visual stack"]
  Stack --> Canvas["Existing VisualCanvas + live EarthMoonScene"]
  Stack --> Plate["Opaque CinematicPlate (DOM video)"]
  Stack --> Veil["TransitionVeil (shared DOM layer)"]
  Plate -->|only covers| Canvas
  Veil -->|above both| Plate
  Veil -->|above both| Canvas
  Canvas --> Relief["Real-IP Relief-lite, prewarmed from route start"]
  Input["opening progress + normalized IP composition"] --> Controller["CinematicPreludeController"]
  Controller --> Plate
  Controller --> Veil
  Controller --> Relief
~~~

The visual stack is bounded to the canvas rectangle. CinematicPlate and TransitionVeil use absolute positioning inside that stack and pointer-events: none. They must not be mounted around the whole page or above independent DOM chrome.

CinematicPlate is an opaque, short SDR video plate. It never samples or modifies the WebGL cloud renderer. Relief-lite renders below it from route start, receives real IP state and the same opening progress, and is ready before any veil cut.

## 5. Match-Cut Contract

### Forward transition

| Phase | Range | Required behavior |
| --- | --- | --- |
| Plate hold | 0–0.18 | Armed plate is opaque; veil is open; Canvas continues prewarming underneath |
| Veil close | 0.18–0.195 | Plate enters its authored thick-cloud/dark/rim-light motivation while TransitionVeil independently closes |
| Atomic source cut | 0.195 | At maximum veil coverage, switch exposed source from plate to Canvas in one state change; never blend plate and Earth |
| Veil reveal | 0.195–0.22 | Canvas is the source underneath; veil opens with the authored color/luminance profile |
| Live lock | >=0.22 | Plate is not visible; decoded frame and presentation texture resources are released |

The peak veil must obscure recognizable Earth surface sufficiently that a source swap cannot produce a continental double image. The veil itself is the continuity mechanism, so its color, luma, edge behavior, and timing are a manifest-bound part of the asset contract.

### Reverse transition

When progress decreases through 0.22, the controller starts closing TransitionVeil over the live Canvas. At its obscuration peak, it requests the target prelude frame. Only after that target frame is decoded and presented may it atomically expose the plate. The veil then reopens toward 0.18.

If the target frame misses the reverse deadline, the controller reopens the veil over the live Canvas, records the failure, and remains Relief-lite. It may not hold an opaque veil indefinitely, show a black frame, or revive the plate after the deadline.

### Hysteresis

- Exit latch: a forward cycle becomes live-locked at progress >=0.22.
- Re-entry latch: a reverse cycle may expose a plate only at progress <=0.18 and only after its target frame is ready.
- The 0.18–0.22 interval is a dead band. Progress jitter there must not repeatedly mount, unmount, or swap representations.
- A new forward prelude cycle can use a plate only if arming completed before the cycle’s first visible frame. Otherwise that entire forward prelude stays Relief-lite.

## 6. Frame-Addressable Provider Contract

The first implementation uses HTMLVideoFrameProvider with an opaque, muted, all-I-frame video. All-I encoding is an optimization, not proof of correct reverse behavior.

~~~ts
type FrameAvailability =
  | { state: "ready"; renderedFrame: number }
  | { state: "pending"; requestedFrame: number }
  | { state: "failed"; reason: "decode" | "timeout" | "unsupported" };

interface FrameProvider {
  arm(): Promise<FrameAvailability>;
  requestFrame(frame: number, deadlineMs: number): Promise<FrameAvailability>;
  releasePresentationResources(): void;
  dispose(): void;
}
~~~

The controller maps opening progress to a target plate frame rather than relying on negative video playback. Forward motion may use normal video playback when it remains in sync. On reverse or discontinuous seeking, the controller requests the mapped target frame and retains the current valid presentation until the request is ready.

HTMLVideoFrameProvider must prove all of the following before it is accepted:

1. It can arm frame zero before the forward prelude’s first visible frame.
2. It can report a rendered target frame, not only a requested currentTime value.
3. A pending reverse request never changes visible content to black, transparent, or an unrelated frame.
4. It can release decoded presentation resources at live lock and rearm for a later reverse request.
5. It reports decode, timeout, visibility/background, and unsupported errors to telemetry.

If this provider cannot satisfy the gate, the active route falls back to Relief-lite. A future approved follow-up may add an image-sequence or WebCodecs implementation behind the same contract; it is not part of the first implementation.

## 7. Asset and Color Contract

Each plate has a manifest with:

- generator and offline-renderer version;
- source scene/script path, seed, parameter summary, input/output SHA-256, and internal license/provenance;
- duration, frame rate, frame count, keyframe policy, dimensions, responsive safe-crop margins, and target-frame mapping;
- desktop and mobile variant URLs, hashes, transfer byte counts, and memory estimates;
- authored handoff-frame identifiers and a veil color/luminance profile;
- Rec.709/sRGB SDR delivery declaration, exposure baseline, and reference Canvas capture checksum.

The plate and live scene must be authored against the same SDR color-response reference: sRGB/Rec.709 output, fixed exposure baseline, matched black point, responsive safe crop, and manifest-defined veil colors. The offline source reference must be captured from the same LuBirth composition family used by the live Canvas. A match cut with a different exposure or veil luma is a rejection even if Earth details are hidden at the instant of the cut.

### Initial hard ceilings

| Tier | Transfer bytes | Cold first decoded frame | Accounted decoded/presentation residency |
| --- | ---: | ---: | ---: |
| Desktop | <=6 MiB | <=1.2 s | <=16 MiB |
| Mobile | <=2 MiB | <=1.8 s | <=8 MiB |

The manifest records actual encoded dimensions and all-I policy. It may not lower resolution, quantization, or chroma quality until artifacts become visible merely to hit a byte ceiling. If the requested photographic prelude does not fit its tier’s ceiling without visible color banding, block artifacts, or lost cloud detail, reject the asset rather than silently degrading it.

## 8. Fallback and Lifecycle

The following conditions immediately select live Relief-lite for the affected opening cycle:

- reduced-motion preference;
- provider arming misses the forward first-frame deadline;
- media element error, unsupported codec, failed render callback, or failed target-frame deadline;
- page visibility recovery or browser background resume without a verified current target frame;
- low-memory eviction;
- VisualCanvas fallback or WebGL context loss.

Fallback must be graceful: the Canvas stays visible, no blocking spinner is placed over the page, and neither the plate nor veil enters halfway through an already-running forward prelude.

At live lock, the provider calls releasePresentationResources(). This releases decoded frames, textures, and DOM presentation handles, but does not delete the manifest or explicitly purge browser media cache. A later reverse request is allowed to rearm from retained browser cache metadata.

## 9. Performance and Telemetry

The existing <=3 ms cloud GPU p95 continues to measure the live Relief-lite cloud path after handoff. It does not certify the plate.

Prelude telemetry must independently record:

- selected tier and manifest hashes;
- arm start/end, cold first-frame ready time, and arming deadline result;
- forward and reverse requested frame, rendered frame, target-frame latency, and timeout;
- source-cut time, veil phase, plate/live state, and hysteresis decisions;
- decode/unsupported/background/low-memory errors;
- transfer bytes and accounted presentation residency;
- overall rAF p95, dropped-frame rate, and the same metrics while plate, veil, and live scene coexist.

Acceptance requires no visible black flash, no representation oscillation under boundary jitter, no continental double image, target-frame availability within the declared deadline, and no prelude cadence regression hidden by excluding video decode from the WebGL timing number.

## 10. Test and Evidence Requirements

- Static manifest validation rejects missing variants, non-all-I primary media, absent safe-crop/exposure/veil metadata, over-budget variants, and unverifiable hashes.
- Unit tests exercise the controller’s arming lock, forward match cut, hysteresis, reverse-ready, reverse-timeout, resource release, and each fallback transition with a fake FrameProvider.
- Browser tests run the query-only route through forward, jitter, reverse, delayed first frame, decode failure, background restoration, reduced motion, and mobile selection.
- Visual evidence captures 0.00, 0.18, veil peak, 0.22, and post-handoff frames at desktop and mobile sizes. Review explicitly checks for double continents, veil brightness jump, crop leakage, and DOM coverage.
- Performance evidence records real browser rAF, drop rate, cold first frame, and target-frame seek latency. Headless data may diagnose, but promotion evidence needs a real target browser/device.
- No default-home route or policy changes are permitted in this work. A later promotion requires a separate review.

## 11. Explicit Non-Goals

- No Hybrid refinement, deep-impostor revival, live browser volumetric cloud generation, or new multi-step cloud shader.
- No city-specific plate catalog and no promise of exact geographic image continuity inside 0–0.18.
- No simultaneous first-release support for HTML video, image sequences, and WebCodecs.
- No default homepage rollout from this design branch.
