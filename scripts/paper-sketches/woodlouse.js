// Placeholder woodlouse cut-out, drawn in code so the paper pipeline has
// real files to load. Replace any PNG in public/assets/paper/woodlouse/ with
// a hand-drawn layer of the same canvas size; rig.json stays the same.
// Runs in a browser page (see scripts/export_paper_sketch.cjs).
/* eslint-disable */
window.paperSketch = function paperSketch() {
  const width = 1280, height = 560, shiftX = 60
  const paper = '#fbf6ea'
  const layer = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.lineJoin = 'round'
    context.lineCap = 'round'
    return [canvas, context]
  }
  const cutOut = (context, path, border) => {
    context.save()
    context.strokeStyle = paper
    context.lineWidth = border * 2
    context.shadowColor = 'rgba(40, 32, 20, 0.35)'
    context.shadowBlur = border * 0.8
    context.shadowOffsetY = border * 0.35
    context.stroke(path)
    context.restore()
    context.fillStyle = paper
    context.fill(path)
  }
  // Domed back, highest just behind the head, tapering into the tail fan.
  const bodyTop = (x) => {
    const t = (x - 150) / 720
    if (t <= 0 || t >= 1) return 380
    return 382 - 210 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75)
  }

  function body() {
    const [canvas, context] = layer()
    context.translate(shiftX, 0)
    const silhouette = new Path2D()
    silhouette.moveTo(118, 372)
    for (let x = 150; x <= 870; x += 6) silhouette.lineTo(x, bodyTop(x))
    silhouette.bezierCurveTo(905, 250, 945, 300, 940, 352)
    silhouette.bezierCurveTo(936, 386, 900, 398, 860, 396)
    silhouette.lineTo(190, 398)
    silhouette.lineTo(150, 392)
    silhouette.lineTo(92, 404)
    silhouette.lineTo(122, 386)
    silhouette.lineTo(80, 384)
    silhouette.closePath()
    cutOut(context, silhouette, 20)
    context.save()
    context.clip(silhouette)
    const shell = context.createLinearGradient(0, 160, 0, 400)
    shell.addColorStop(0, '#b7c6c4')
    shell.addColorStop(0.45, '#869aa0')
    shell.addColorStop(1, '#55636b')
    context.fillStyle = shell
    context.fillRect(0, 0, 1000, height)
    const edges = [150, 205, 250, 290, 330, 400, 470, 540, 610, 680, 750, 815, 870]
    edges.forEach((x, index) => {
      const next = edges[index + 1] ?? 900
      const plate = context.createLinearGradient(x, 0, next, 0)
      plate.addColorStop(0, 'rgba(225, 232, 226, 0.55)')
      plate.addColorStop(0.18, 'rgba(225, 232, 226, 0)')
      plate.addColorStop(0.85, 'rgba(20, 28, 34, 0)')
      plate.addColorStop(1, 'rgba(20, 28, 34, 0.35)')
      context.fillStyle = plate
      context.fillRect(x, 0, next - x, height)
      context.strokeStyle = 'rgba(30, 38, 44, 0.55)'
      context.lineWidth = 4
      context.beginPath()
      context.moveTo(x, bodyTop(x) - 4)
      context.quadraticCurveTo(x - 10, 300, x + 2, 400)
      context.stroke()
    })
    context.fillStyle = 'rgba(232, 226, 196, 0.55)'
    for (let index = 0; index < 26; index += 1) {
      const x = 220 + ((index * 97) % 600)
      const y = bodyTop(x) + 30 + ((index * 53) % 70)
      context.beginPath()
      context.ellipse(x, y, 9 + (index % 3) * 4, 5 + (index % 2) * 3, 0.3, 0, Math.PI * 2)
      context.fill()
    }
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    context.lineWidth = 10
    context.beginPath()
    for (let x = 260; x <= 760; x += 10) context[x === 260 ? 'moveTo' : 'lineTo'](x, bodyTop(x) + 22)
    context.stroke()
    const belly = context.createLinearGradient(0, 340, 0, 400)
    belly.addColorStop(0, 'rgba(20, 24, 28, 0)')
    belly.addColorStop(1, 'rgba(20, 24, 28, 0.55)')
    context.fillStyle = belly
    context.fillRect(0, 340, 1000, 60)
    context.fillStyle = '#15191c'
    context.beginPath()
    context.ellipse(892, 318, 15, 12, -0.3, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = 'rgba(255, 255, 255, 0.85)'
    context.beginPath()
    context.arc(897, 313, 4, 0, Math.PI * 2)
    context.fill()
    context.restore()
    context.strokeStyle = '#2b333a'
    context.lineWidth = 5
    context.stroke(silhouette)
    return canvas
  }

  // One leg hanging from its hip; the rig repeats it along the body.
  function leg(hipX, hipY, colours) {
    const [canvas, context] = layer()
    const path = new Path2D()
    const joints = [[0, 0], [9, 40], [-5, 85], [8, 125]]
    joints.forEach(([x, y], index) => index ? path.lineTo(hipX + x, hipY + y) : path.moveTo(hipX + x, hipY + y))
    context.strokeStyle = paper
    context.lineWidth = 22
    context.stroke(path)
    context.strokeStyle = colours[0]
    context.lineWidth = 11
    context.stroke(path)
    context.strokeStyle = colours[1]
    context.lineWidth = 5
    context.stroke(path)
    context.fillStyle = colours[2]
    joints.slice(1, 3).forEach(([x, y]) => { context.beginPath(); context.arc(hipX + x, hipY + y, 6, 0, Math.PI * 2); context.fill() })
    return canvas
  }

  function antenna(baseX, baseY) {
    const [canvas, context] = layer()
    context.translate(baseX, baseY)
    context.rotate(0.35)
    const path = new Path2D()
    path.moveTo(0, 0)
    path.bezierCurveTo(76, -42, 127, -114, 228, -126)
    context.strokeStyle = paper
    context.lineWidth = 22
    context.stroke(path)
    context.strokeStyle = '#4c5652'
    context.lineWidth = 10
    context.stroke(path)
    context.fillStyle = '#7c867f'
    for (let index = 1; index < 6; index += 1) {
      const t = index / 6, u = 1 - t
      const x = 3 * u * u * t * 76 + 3 * u * t * t * 127 + t * t * t * 228
      const y = 3 * u * u * t * -42 + 3 * u * t * t * -114 + t * t * t * -126
      context.beginPath(); context.arc(x, y, 5.5, 0, Math.PI * 2); context.fill()
    }
    return canvas
  }

  return {
    'leg-far.png': leg(330, 372, ['#3e423f', '#6b6f66', '#2f322f']),
    'body.png': body(),
    'leg-near.png': leg(310, 380, ['#4a4f4c', '#8f9488', '#3a3e3b']),
    'antenna.png': antenna(965, 290),
  }
}
