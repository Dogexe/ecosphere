\# ECOSPHERE — Project Context \& Goals



> \*\*Owner update, 2026-11-03:\*\* ECOSPHERE is a personal game for its owner, not for sale; the owner is the only playtester. It is built as a browser game in TypeScript, React and Three.js (React Three Fiber) instead of Godot. A playable prototype exists; see README.md, AGENTS.md and PROGRESS.md for what is implemented and verified.



\## 1. Project Vision



\*\*ECOSPHERE\*\* is a 3D ecosystem simulation sandbox where players create miniature living worlds, observe ecological interactions, and conduct experiments ranging from scientifically grounded to wildly speculative.



\*\*Core philosophy:\*\*

\*Players create the conditions. Nature determines the consequences.\*



The game should produce emergent outcomes through interacting simulation rules, rather than scripted events.



The long-term ambition is a polished personal game that runs in the browser on PC and tablet. Commercial release (for example on Steam) is not planned.



\## 2. Core Gameplay



The intended gameplay loop is:



\*\*Build World → Introduce Life → Simulate → Observe → Experiment → Analyze → Iterate\*\*



Players should be able to:



\- Create miniature terrestrial and aquatic ecosystems.

\- Introduce plants, animals, microorganisms, and environmental resources.

\- Observe growth, feeding, reproduction, competition, decomposition, and death.

\- Seal an ecosystem and test its long-term sustainability.

\- Introduce external substances or change environmental conditions.

\- Compare experiments through snapshots, graphs, and world branching.

\- Discover unexpected outcomes arising from ecological interactions.



The experience should balance scientific depth, experimentation, accessibility, and visual charm.



\## 3. Scientific Simulation



The simulation is the foundation of the game, not merely a visual effect.



Primary systems:



\- Water, carbon, oxygen, and nutrient cycles.

\- Photosynthesis, respiration, and decomposition.

\- Environmental factors: temperature, light, moisture, and gases.

\- Producers, consumers, decomposers, and food webs.

\- Population dynamics and ecological competition.

\- Organism behavior driven by environmental and biological states.



\*\*Scientific principles:\*\*



\- Conserve matter and track material transfers.

\- Distinguish closed-system conditions from external interventions.

\- Allow energy exchange through light and heat where appropriate.

\- Use deterministic simulation steps and seeded randomness.

\- Distinguish evidence-based models, approximations, and speculative mechanics.

\- Avoid presenting simplified simulations as scientifically validated predictions.



Microscopic organisms may be represented as aggregate populations instead of individually simulated entities.



\## 4. Experimental Sandbox



The game should support unusual experiments through reusable simulation systems rather than isolated scripted features.



Examples:



\- Introducing biological substances such as semen, urine, blood, and organic waste.

\- Studying microbial decomposition, nutrient loading, and oxygen depletion.

\- Introducing carnivorous plants, slime molds, parasites, and unusual organisms.

\- Changing gravity, temperature, light, or time-related simulation rules.

\- Creating hypothetical organisms or speculative ecosystems.



Implement a general \*\*Organic Input System\*\* for material composition, distribution, decomposition, and ecological consequences.



Long term, introduce a \*\*Reality Breaker\*\* that modifies simulation rules.



Separate:



\- \*\*Realistic Mode:\*\* scientifically grounded parameters and explicit approximations.

\- \*\*Speculative Mode:\*\* hypothetical physics, organisms, and environmental rules.



\## 5. Visual Direction



\*\*Soft Organic Low-poly\*\*



The world should resemble a beautiful, living miniature diorama.



Visual principles:



\- Soft, simplified organic shapes rather than aggressively angular geometry.

\- Restrained natural colors and coherent stylization.

\- Charming but biologically recognizable organisms.

\- Subtle movement, growth, and environmental responses.

\- Clean, readable UI with optional scientific inspection tools.

\- A strong balance between visual appeal and performance.



Low-poly visuals should not imply shallow simulation.



Performance is especially important because browser support is a core goal.



\## 6. Technology \& Architecture



\*\*Preferred stack:\*\*



\- TypeScript, Vite, React and Three.js (React Three Fiber, Drei) — game engine and UI (replaces the original Godot 4 plan).

\- WebGL 2.0 in the browser — rendering target.

\- Blender + Python — procedural asset creation and modification.

\- Claude — architecture, specification, research, and review.

\- Codex — implementation, testing, debugging, and tooling.



Target platforms:



1\. Windows PC.

2\. Web browsers.

3\. No commercial release planned.



Use a \*\*simulation-first architecture\*\*:



\- Simulation Core — independent of rendering.

\- World State — environmental and biological data.

\- Organism Behavior — decisions based on simulation state.

\- Visualization Layer — 3D representation of actual simulation state.

\- Experiment System — interventions and rule changes.

\- Observatory — graphs, events, snapshots, and scientific inspection.



The simulation should support headless execution, fixed timesteps, reproducible tests, and resource-accounting checks.



Do not assume that low polygon counts alone guarantee good performance. Profile CPU simulation time, draw calls, transparency, shadows, and animation.



\## 7. AI-Assisted Development Workflow



The project is inspired by an AI-assisted Godot game-development workflow demonstrated by \*Can It Code?\*



Use three complementary iteration loops:



\*\*Visual Gauntlet\*\*

Generate assets → Render → Inspect → Refine → Optimize.



\*\*Animation Gauntlet\*\*

Create/rig models → Generate or reference motion → Animate → Inspect from multiple angles → Refine.



\*\*Scientific Gauntlet\*\*

Define rules → Implement → Simulate → Test conservation and behavior → Review limitations.



Prefer direct AI-agent editing of Godot scene, script, shader, and resource files. Godot MCP is optional, not a prerequisite.



Use AI-generated video as an optional motion reference for important animals, not a mandatory animation solution.



Prioritize minimal correct changes, reuse existing patterns, native engine features, and avoid unnecessary dependencies or abstractions.



A feature is not complete merely because code compiles. Verify it inside the game and through appropriate automated tests.



\## 8. Development Roadmap



\*\*Phase 0 — Visual \& Technical Proof of Concept\*\*



Create a small, attractive, performant 3D terrarium scene. Establish art direction, asset pipeline, camera controls, and successful Web export.



\*\*Phase 1 — Living Terrarium\*\*



Introduce simple plants, moisture-dependent growth, environmental state, and basic organisms.



\*\*Phase 2 — Closed Ecosystem\*\*



Implement resource cycling, photosynthesis, respiration, decomposition, Seal Mode, and conservation checks.



\*\*Phase 3 — Ecological Experiments\*\*



Add the Organic Input System, ecological perturbations, experimental comparisons, and scientific visualization.



\*\*Phase 4 — Living Complexity\*\*



Expand food webs, animal behavior, population dynamics, and selected advanced animations.



\*\*Phase 5 — Reality Breaker\*\*



Introduce speculative organisms, altered physical rules, and unusual experimental scenarios.



Each phase must produce a playable, testable increment. Web compatibility should be checked continuously rather than postponed until release.



\## 9. Immediate Goal



Build the first \*\*ECOSPHERE Vertical Slice\*\*:



A small Soft Organic Low-poly terrarium featuring:



\- Soil, rocks, moss, and simple vegetation.

\- Camera orbit and zoom.

\- Environmental variables such as light and moisture.

\- Visible plant growth or decline driven by simulation state.

\- Adjustable simulation speed.

\- Basic ecological state inspection.

\- Working Windows and Web builds.



Start with the smallest scientifically coherent simulation. Do not implement the entire ecosystem or speculative feature set immediately.



\*\*Success means the game looks alive, responds to meaningful changes, runs efficiently, and can be expanded without rewriting its foundations.\*\*



\## 10. Project Status \& Working Principles



\*\*Current status (2026-11-03):\*\* A playable browser prototype with a seeded fixed-step simulation, eight plant and six animal roles, an ant colony, a pond, day/night, A/B experiments, an Observatory and Seal Mode. PROGRESS.md records what has been verified and what remains open.



Do not describe planned features as already implemented.



Before modifying an existing project, inspect its actual files, architecture, and development workflow.



Prioritize:



1\. Scientific integrity.

2\. Playable, enjoyable experimentation.

3\. Visual coherence.

4\. Performance and web compatibility.

5\. Maintainable, minimal implementation.



Avoid premature complexity, unnecessary infrastructure, and polishing systems that have not yet demonstrated their core value.



\*\*The world may look like a toy, but it should behave like a living system.\*\*

