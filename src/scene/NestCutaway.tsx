import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial, Vector4 } from 'three'
import type { AntColony } from '../sim/colony'
import { nestChamberRadius, nestTunnelRadius } from '../sim/colony'
import { growingRadius } from '../sim/excavation'

/*
 * Ant-farm cutaway for the natural look (owner's reference, 2026-11-07): in front of the colony the
 * soil is cut away down a vertical face through the middle of the nest, so from the jar's front you
 * see the tunnels and chambers in section, with the ants and brood inside them, like the ant farm in
 * the reference picture. Visual only: the nest is the sim's own graph; nothing in the world changes.
 *
 * `cutawayBox` is read by LayeredGround to drop the soil in front of the face (the top surface and
 * the wall at the glass), so the face is seen through the glass.
 */
export const cutawayBox = { active: false, xMin: 0, xMax: 0, zFace: 0 }

const maxNodes = 12, maxEdges = 20

/** The cut face: soil with holes where the nest is, in the nest's own coordinates (surface at y = 0.045). */
export function CutawayFace({ colony, ground, floor, gravelTop, offset }: { colony: AntColony; ground: (x: number, z: number) => number; floor: number; gravelTop: number; offset: number }) {
  const { geometry, material } = useMemo(() => {
    const xs = colony.nodes.map((node) => node.x), zs = colony.nodes.map((node) => node.z)
    const xMin = Math.min(...xs) - 0.55, xMax = Math.max(...xs) + 0.55
    const zFace = zs.reduce((sum, z) => sum + z, 0) / zs.length
    cutawayBox.active = true; cutawayBox.xMin = xMin; cutawayBox.xMax = xMax; cutawayBox.zFace = zFace
    // A strip of quads across x: bottom at the jar floor, top on the ground along the face.
    // The face, then the notch's two side walls running from the face out to the glass.
    const columns = 24, sides = 12, glass = 3.95
    const strips: [number, number][][] = [Array.from({ length: columns + 1 }, (_, i) => [xMin + (xMax - xMin) * i / columns, zFace])]
    for (const x of [xMin, xMax]) strips.push(Array.from({ length: sides + 1 }, (_, i) => [x, zFace + (Math.sqrt(Math.max(0, glass * glass - x * x)) - zFace) * i / sides]))
    const points: number[] = [], index: number[] = []
    for (const strip of strips) {
      const start = points.length / 3
      for (const [x, z] of strip) points.push(x, floor - offset, z, x, ground(x, Math.min(z, Math.sqrt(Math.max(0, 3.7 * 3.7 - x * x)))) - offset, z)
      for (let i = 0; i < strip.length - 1; i += 1) { const a = start + i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    }
    const positions = new Float32Array(points)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setIndex(index)
    const nodes = Array.from({ length: maxNodes }, (_, i) => { const node = colony.nodes[i]; return node ? new Vector4(node.x, node.y, node.z, growingRadius(colony, node) || nestChamberRadius(node)) : new Vector4(0, -99, 0, 0) })
    const edgesA = Array.from({ length: maxEdges }, () => new Vector4(0, -99, 0, 0)), edgesB = Array.from({ length: maxEdges }, () => new Vector4(0, -99, 0, 0))
    colony.edges.slice(0, maxEdges).forEach(([a, b], i) => {
      const na = colony.nodes.find((node) => node.id === a)!, nb = colony.nodes.find((node) => node.id === b)!
      edgesA[i].set(na.x, na.y, na.z, nestTunnelRadius); edgesB[i].set(nb.x, nb.y, nb.z, 0)
    })
    const material = new ShaderMaterial({
      side: DoubleSide,
      uniforms: { nodes: { value: nodes }, edgesA: { value: edgesA }, edgesB: { value: edgesB }, gravelTop: { value: gravelTop - offset }, floorY: { value: floor - offset } },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec4 nodes[${maxNodes}]; uniform vec4 edgesA[${maxEdges}]; uniform vec4 edgesB[${maxEdges}];
        uniform float gravelTop; uniform float floorY; varying vec3 vPos;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
        void main() {
          float field = 1e3;
          for (int i = 0; i < ${maxNodes}; i++) { vec4 n = nodes[i]; if (n.w <= 0.0) continue; vec3 d = vPos - n.xyz; d.x /= 1.16; field = min(field, length(d) - n.w * 1.04); }
          for (int i = 0; i < ${maxEdges}; i++) { vec4 a = edgesA[i]; if (a.w <= 0.0) continue; vec3 ab = edgesB[i].xyz - a.xyz; vec3 ap = vPos - a.xyz; float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0); field = min(field, length(ap - ab * t) - a.w * 1.025); }
          // Inside the nest: the cut face is open, so the chamber's own back wall shows.
          if (field < 0.0) discard;
          float crumb = hash(floor(vPos.xy * 46.0));
          vec3 soil = vec3(0.33, 0.21, 0.12) * (0.88 + 0.2 * crumb);
          vec3 gravel = mix(vec3(0.56, 0.52, 0.46), vec3(0.72, 0.66, 0.56), hash(floor(vPos.xy * 22.0)));
          vec3 colour = vPos.y < gravelTop ? gravel : soil;
          // Packed, lighter rim round each opening, as ants smooth their walls; slight shade deeper down.
          colour = mix(colour, vec3(0.62, 0.45, 0.28), 1.0 - smoothstep(0.0, 0.035, field));
          colour *= 0.85 + 0.15 * smoothstep(floorY, floorY + 2.5, vPos.y);
          // Colours are authored in display (sRGB) space; the composer expects linear light.
          gl_FragColor = vec4(pow(colour, vec3(2.2)), 1.0);
        }`,
    })
    return { geometry, material }
  }, [colony, ground, floor, gravelTop, offset])
  return <mesh geometry={geometry} material={material} raycast={() => undefined} />
}
