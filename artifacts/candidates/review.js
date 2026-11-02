import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Isolated review board only. No game state, replacement or external runtime fetch.
const insects = [
  { id: 'A1', file: 'TigerBeetle', name: 'Tiger beetle · ด้วงเสือ', note: 'ตัวเลือกผู้ล่า มีกรามและขายาว · ผิวและสีต้นฉบับ', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies', pack: 'insect001' },
  { id: 'A2', file: 'BeetleGrub', name: 'Beetle grub · ตัวอ่อนด้วง', note: 'ตัวอ่อนทรงอ้วน มีข้อปล้อง · ไม่ใช่หนอนผีเสื้อ', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies', pack: 'insect001' },
  { id: 'A3', file: 'LeafInsect', name: 'Leaf insect · แมลงใบไม้', note: 'รูปร่างคล้ายใบไม้ · ตัวเลือกเพิ่มชนิดผู้กินพืช', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies', pack: 'insect001' },
  { id: 'A4', file: 'Silverfish', name: 'Silverfish · แมลงสามง่าม', note: 'ลำตัวเรียว มีเส้นหาง · ไม่ใช่ตัวกะปิหรือสปริงเทล', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies', pack: 'insect001' },
  { id: 'B1', file: 'PolyBeetle', name: 'Beetle · ด้วง', note: 'งานปั้นอีกแนวจาก Poly by Google · ดูรายละเอียดผิวและเงาร่าง', maker: 'Poly by Google', license: 'CC BY 3.0', source: 'https://poly.pizza/m/4yufxgZ1QQ2' },
  { id: 'B2', file: 'PolyCaterpillar', name: 'Caterpillar · หนอนผีเสื้อ', note: 'ตัวเลือกสำหรับผู้กินใบไม้ · เปรียบเทียบกับตัวอ่อนด้วง A2', maker: 'Poly by Google', license: 'CC BY 3.0', source: 'https://poly.pizza/m/64T47O5VHAB' },
]

const remaining = [
  { id: 'C4', file: 'Archerfish', name: 'Archerfish · ปลาเสือพ่นน้ำ', note: 'ปลาน้ำจืดอีกตัวเลือกในตระกูลภาพ Gobkit · พฤติกรรมพ่นน้ำยังไม่มีในเกม', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies' },
  { id: 'C5', file: 'Goldfish', name: 'Goldfish · ปลาทอง', note: 'ปลาในบ่อ โทนส้ม · ไฟล์โมเดลต้นฉบับที่นำมาดูจริง', maker: 'Poly by Google', license: 'CC BY 3.0', source: 'https://poly.pizza/m/3GPUntjwqCa' },
]
const ants = [
  { id: 'D1', file: 'OGA_ant_original', name: 'Ant · ต้นฉบับ', note: 'กายวิภาคและ rig ของ mujtaba-io · กลุ่มท่าเดิม walk / bite ก่อนปรับแนวและวัสดุ', maker: 'mujtaba-io', license: 'CC0', source: 'https://opengameart.org/content/ant-3d-model-rigging-animated-low-poly-ish', actions: { eat: 'bite' } },
  { id: 'D2', file: 'ant-worker-candidate', name: 'Ant · ฉบับปรับสำหรับ ECOSPHERE', note: 'ผิวด้านสีน้ำตาลหม่น ลดท่ายืนสูง หันหน้า +Z · ใช้กายวิภาคและท่าเดินเดิม เพิ่มท่านิ่งที่ไม่ขยับ', maker: 'mujtaba-io / adapted', license: 'CC0', source: 'https://opengameart.org/content/ant-3d-model-rigging-animated-low-poly-ish' },
  { id: 'D3', file: 'Gobkit_LeafcutterAnt', name: 'Leafcutter ant · มดตัดใบ', note: 'ต้นฉบับ Gobkit มีใบติดกับโมเดล · ไม่ใช่ตัวแทนมดเก็บเมล็ด วงจรเลี้ยงรายังไม่ได้ทำ', maker: 'Gobkit', license: 'CC0', source: 'https://gobkit.com/freebies' },
]
const woodlice = [
  { id: 'E1', file: 'woodlouse-original', name: 'Trachelipus · ต้นฉบับ', note: 'กายวิภาคต้นฉบับจาก .hapto / Senckenberg · แบบ AR ไม่มี rig หรือ animation', maker: '.hapto GmbH', license: 'CC BY 4.0', source: 'https://sketchfab.com/3d-models/trachelipus-ratzeburgii-c33d55eda92846fea8021051829ee282' },
  { id: 'E2', file: 'woodlouse-candidate', name: 'Woodlouse · ฉบับปรับ', note: 'ลดรายละเอียดจากรูปทรงเดิม ผิวด้าน sage-grey · ผูกขาเดิม 7 คู่ เพิ่มท่าเดิน/กิน ไม่ใช่ท่าที่พิพิธภัณฑ์รับรอง', maker: '.hapto GmbH / adapted', license: 'CC BY 4.0', source: 'https://vr-bodenleben.senckenberg.de/tiere/laubstreu/landassel/' },
]
const antLife = [
  { id: 'F1', file: 'ant-worker-candidate', name: 'Worker · คนงาน', note: 'ต้นฉบับมด CC0 ปรับท่ายืนและผิวด้าน', maker: 'mujtaba-io / adapted', license: 'CC0', source: ants[0].source },
  { id: 'F2', file: 'ant-queen-candidate', name: 'Dealate queen · ราชินี', note: 'ดัดแปลง gaster และ mesosoma เดิม ไม่ใช่ขยายคนงานทั้งตัว', maker: 'mujtaba-io / adapted', license: 'CC0', source: ants[0].source },
  { id: 'F3', file: 'ant-larva-candidate', name: 'Larva · ตัวอ่อน', note: 'ดัดแปลงข้อปล้อง Gobkit ตัดขาและตา ลดหัวด้วง เป็นรูปตัวอ่อนมดแบบง่าย', maker: 'Gobkit / adapted', license: 'CC0', source: 'https://gobkit.com/freebies' },
  { id: 'F4', file: 'ant-pupa-candidate', name: 'Naked pupa · ดักแด้', note: 'พับส่วนยื่นจากกายวิภาคมดต้นฉบับ สีอ่อน ไม่มีท่าเดิน', maker: 'mujtaba-io / adapted', license: 'CC0', source: ants[0].source },
]
const candidates = document.body.dataset.group === 'ant-life' ? antLife : document.body.dataset.group === 'woodlice' ? woodlice : document.body.dataset.group === 'ants' ? ants : document.body.dataset.group === 'remaining' ? remaining : insects

const loader = new GLTFLoader()
const previews = []
let requestedAction = 'idle'
let playing = true

function selectAction(preview) {
  if (!preview.mixer) return
  const clip = preview.clips.find((clip) => clip.name === (preview.actions?.[requestedAction] ?? requestedAction)) ?? preview.clips.find((clip) => clip.name === 'idle')
  if (!clip) return
  preview.mixer.stopAllAction()
  preview.mixer.clipAction(clip).reset().play()
}

for (const candidate of candidates) {
  const card = document.createElement('article')
  card.innerHTML = `<div class="view" aria-label="${candidate.name} 3D preview"><span class="tag">${candidate.id}</span></div><div class="info"><h2>${candidate.name}</h2><p>${candidate.note}</p><div class="meta">กำลังตรวจไฟล์โมเดล…</div><div class="source"><a href="${candidate.source}" target="_blank" rel="noreferrer">${candidate.maker} ↗</a><span>${candidate.license}</span></div></div>`
  document.querySelector('#models').append(card)
  const view = card.querySelector('.view')
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9eee1')
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  view.append(renderer.domElement)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 30)
  camera.position.set(3.4, 2.7, 4.2)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.42, 0)
  controls.enablePan = false
  controls.enableDamping = true
  controls.minDistance = 2.8
  controls.maxDistance = 9
  controls.maxPolarAngle = Math.PI / 2.1
  controls.update()
  scene.add(new THREE.HemisphereLight('#f5f8ed', '#a28c6f', 2.6))
  const key = new THREE.DirectionalLight('#fff3dc', 3)
  key.position.set(-3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(512, 512)
  key.shadow.camera.left = -2.5
  key.shadow.camera.right = 2.5
  key.shadow.camera.top = 2.5
  key.shadow.camera.bottom = -2.5
  key.shadow.bias = -0.001
  scene.add(key)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2, 48), new THREE.MeshStandardMaterial({ color: '#dce6cc', roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.015
  ground.receiveShadow = true
  scene.add(ground)
  const preview = { renderer, scene, camera, controls, view, mixer: null, clips: [], actions: candidate.actions }
  previews.push(preview)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  fetch(`./${candidate.file}.glb`, { signal: controller.signal })
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer() })
    .then((buffer) => loader.parseAsync(buffer, ''))
    .then((gltf) => {
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((object) => { if (object.isSkinnedMesh) object.skeleton.update() })
      const bounds = new THREE.Box3().setFromObject(gltf.scene, true)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const normalizer = 2.35 / Math.max(size.x, size.y, size.z)
      const root = new THREE.Group()
      root.scale.setScalar(normalizer)
      gltf.scene.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z))
      root.add(gltf.scene)
      scene.add(root)
      let triangles = 0, meshes = 0
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return
        object.castShadow = true
        object.receiveShadow = true
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
        meshes += 1
      })
      preview.clips = gltf.animations
      if (gltf.animations.length) { preview.mixer = new THREE.AnimationMixer(gltf.scene); selectAction(preview) }
      const animated = gltf.animations.length ? `${gltf.animations.length} animation clips` : 'ไม่มี animation ในไฟล์นี้'
      card.querySelector('.meta').textContent = `${triangles.toLocaleString()} triangles · ${meshes} mesh · ${animated}`
      card.dataset.loaded = 'true'
    })
    .catch((error) => { card.querySelector('.meta').textContent = `เปิดโมเดลไม่สำเร็จ: ${error.message}`; card.dataset.loaded = 'error' })
    .finally(() => clearTimeout(timeout))
  const resize = new ResizeObserver(() => {
    const width = view.clientWidth, height = view.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  })
  resize.observe(view)
}

for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => {
  requestedAction = button.dataset.action
  for (const other of document.querySelectorAll('[data-action]')) other.setAttribute('aria-pressed', String(other === button))
  for (const preview of previews) selectAction(preview)
})
document.querySelector('#pause-preview')?.addEventListener('click', (event) => {
  playing = !playing
  event.currentTarget.setAttribute('aria-pressed', String(!playing))
  event.currentTarget.textContent = playing ? 'พักแอนิเมชัน' : 'เล่นแอนิเมชันต่อ'
})

const clock = new THREE.Clock()
function frame() {
  requestAnimationFrame(frame)
  const delta = Math.min(clock.getDelta(), 0.05)
  for (const preview of previews) {
    const rect = preview.view.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > innerHeight) continue
    if (playing) preview.mixer?.update(delta)
    preview.controls.update()
    preview.renderer.render(preview.scene, preview.camera)
  }
}
frame()
