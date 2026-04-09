import { useState, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Slider } from '../../components/ui/Slider'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Play, Pause, Camera, Loader2, ImagePlus, Download, FlipVertical, Upload, FolderOpen, Save, Trash2, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { downloadBlob, canvasToBlob, fileToDataURL } from '../../lib/utils'
import { presets, directionLabels, ANGLES_4, ANGLES_8, loadSavedPresets, savePreset, deletePreset, type SavedCustomPreset } from './presets'
import { cn } from '../../lib/utils'
import { runPixelPipeline, DEFAULT_OPTIONS, type PipelineOptions } from '../image-to-pixelart/pixel-pipeline'
import { PALETTE_PRESETS } from '../palette-editor/presets'

interface MeshInfo {
  name: string
  materialName: string
  hasTexture: boolean
  assignedTexture?: string // filename of assigned texture
}

export function Spritesheet3DPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const clockRef = useRef(new THREE.Clock())
  const animFrameRef = useRef<number>(0)
  const playingRef = useRef(true)
  const modelUrlRef = useRef<string | null>(null)
  const rootBoneRef = useRef<THREE.Bone | null>(null)
  const textureInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const modelFormatRef = useRef<'fbx' | 'gltf'>('fbx')

  const [modelLoaded, setModelLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([])
  const [selectedAnim, setSelectedAnim] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [presetKey, setPresetKey] = useState('rpg8')
  const [frameCount, setFrameCount] = useState(8)
  const [captureSize, setCaptureSize] = useState(128)
  const [cameraDistance, setCameraDistance] = useState(3)
  const [elevation, setElevation] = useState(55)
  const [capturing, setCapturing] = useState(false)
  const [captureProgress, setCaptureProgress] = useState(0)
  const [modelInfo, setModelInfo] = useState('')
  const [bgColor, setBgColor] = useState<'transparent' | 'green' | 'blue'>('transparent')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [textureFlipY, setTextureFlipY] = useState(true)
  const [isDraggingModel, setIsDraggingModel] = useState(false)
  const [customDirCount, setCustomDirCount] = useState<1 | 4 | 8>(8)
  const [customSingleAngle, setCustomSingleAngle] = useState(0)
  const [modelRotation, setModelRotation] = useState(0)
  const [savedPresets, setSavedPresets] = useState<SavedCustomPreset[]>([])
  const [savePresetName, setSavePresetName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [meshInfos, setMeshInfos] = useState<MeshInfo[]>([])
  const [textureFiles, setTextureFiles] = useState<Map<string, File>>(new Map())
  const [pixelArtEnabled, setPixelArtEnabled] = useState(false)
  const [pixelArtOpts, setPixelArtOpts] = useState<PipelineOptions>({
    ...DEFAULT_OPTIONS,
    pixelSize: 1, // already at pixel resolution for capture
    paletteMode: 'preset',
    paletteColors: PALETTE_PRESETS.find(p => p.name === 'PICO-8')?.colors,
    outline: true,
  })
  const updatePA = (partial: Partial<PipelineOptions>) => setPixelArtOpts(prev => ({ ...prev, ...partial }))

  // Load saved presets on mount
  useEffect(() => { setSavedPresets(loadSavedPresets()) }, [])

  // Apply model rotation to the 3D scene
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.rotation.y = (modelRotation * Math.PI) / 180
    }
  }, [modelRotation])

  // Build effective preset — for custom, use the direction count toggle
  const customAngles = customDirCount === 1 ? [customSingleAngle] : customDirCount === 4 ? ANGLES_4 : ANGLES_8
  const currentPreset = presetKey === 'custom'
    ? { ...presets.custom, angles: customAngles }
    : presets[presetKey]

  useEffect(() => { playingRef.current = playing }, [playing])

  // Sync preview camera to capture settings (elevation, distance, preset)
  // This positions the camera at the preset's first angle + elevation so the user
  // sees the perspective that will actually be captured, while OrbitControls
  // still allows free rotation from that starting point.
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls || !modelLoaded) return

    const elev = presetKey === 'custom' ? elevation : currentPreset.elevation
    const firstAngle = currentPreset.angles[0] ?? 0
    const angleRad = (firstAngle * Math.PI) / 180
    const elevRad = (elev * Math.PI) / 180

    const target = new THREE.Vector3(0, 1, 0)
    camera.position.set(
      cameraDistance * Math.sin(angleRad) * Math.cos(elevRad),
      target.y + cameraDistance * Math.sin(elevRad),
      cameraDistance * Math.cos(angleRad) * Math.cos(elevRad)
    )
    controls.target.copy(target)
    controls.update()
  }, [presetKey, elevation, cameraDistance, modelLoaded, customSingleAngle, customDirCount])

  // Init scene
  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    const container = containerRef.current
    const size = Math.min(container.clientWidth, 500)
    renderer.setSize(size, size)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    camera.position.set(0, 1.5, 4)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.target.set(0, 1, 0)
    controls.update()
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0)
    dirLight.position.set(5, 10, 7)
    scene.add(dirLight)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8)
    backLight.position.set(-5, 5, -5)
    scene.add(backLight)

    const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xeeeeee)
    gridHelper.name = '__grid'
    scene.add(gridHelper)

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      if (mixerRef.current && playingRef.current) {
        mixerRef.current.update(delta)
      }
      // Follow the root bone so root-motion animations stay in view
      if (rootBoneRef.current && modelRef.current) {
        const worldPos = new THREE.Vector3()
        rootBoneRef.current.getWorldPosition(worldPos)
        controls.target.set(worldPos.x, worldPos.y, worldPos.z)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const s = Math.min(container.clientWidth, 500)
      renderer.setSize(s, s)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      controls.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  const clearModel = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (modelRef.current) {
      scene.remove(modelRef.current)
      modelRef.current.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      modelRef.current = null
    }
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
      mixerRef.current = null
    }
    if (modelUrlRef.current) {
      URL.revokeObjectURL(modelUrlRef.current)
      modelUrlRef.current = null
    }
    setAnimations([])
    setSelectedAnim(0)
    setModelLoaded(false)
    setModelInfo('')
    setLoadError('')
    setCapturedImage(null)
    setCapturedBlob(null)
    setMeshInfos([])
    setTextureFiles(new Map())
  }, [])

  const loadModel = useCallback(async (file: File) => {
    const scene = sceneRef.current
    if (!scene) return

    clearModel()

    const url = URL.createObjectURL(file)
    modelUrlRef.current = url
    const ext = file.name.split('.').pop()?.toLowerCase()
    modelFormatRef.current = ext === 'fbx' ? 'fbx' : 'gltf'

    let object: THREE.Object3D
    let clips: THREE.AnimationClip[] = []

    try {
      setLoadError('')
      if (ext === 'fbx') {
        const loader = new FBXLoader()
        const fbx = await loader.loadAsync(url)
        object = fbx
        clips = fbx.animations || []
      } else {
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(url)
        object = gltf.scene
        clips = gltf.animations || []
      }
    } catch (err) {
      setLoadError(`Failed to load model: ${err instanceof Error ? err.message : 'Unknown error'}`)
      URL.revokeObjectURL(url)
      modelUrlRef.current = null
      return
    }

    // Fix materials for visibility
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((mat) => {
          if (!mat) return
          mat.side = THREE.DoubleSide
          if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mat as THREE.MeshStandardMaterial
            if (!stdMat.map) {
              const lum = stdMat.color.r + stdMat.color.g + stdMat.color.b
              if (lum < 0.1) stdMat.color.set(0x888888)
            }
            stdMat.metalness = Math.min(stdMat.metalness, 0.5)
            stdMat.roughness = Math.max(stdMat.roughness, 0.3)
          }
          if ((mat as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
            const phongMat = mat as THREE.MeshPhongMaterial
            const lum = phongMat.color.r + phongMat.color.g + phongMat.color.b
            if (lum < 0.1) phongMat.color.set(0x888888)
          }
        })
      }
    })

    // Normalize: center and scale
    const box = new THREE.Box3().setFromObject(object)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    if (maxDim === 0) {
      setLoadError('Model appears to be empty (zero size).')
      return
    }

    const targetHeight = 2
    const scaleFactor = targetHeight / maxDim
    const wrapper = new THREE.Group()
    wrapper.add(object)
    object.position.set(-center.x, -center.y + size.y / 2, -center.z)
    wrapper.scale.setScalar(scaleFactor)

    scene.add(wrapper)
    modelRef.current = wrapper

    // Find the root bone (usually "Hips" in Mixamo) for camera follow
    rootBoneRef.current = null
    object.traverse((child) => {
      if (!rootBoneRef.current && (child as THREE.Bone).isBone) {
        rootBoneRef.current = child as THREE.Bone
      }
    })

    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.2, 4)
      controlsRef.current.target.set(0, 1, 0)
      controlsRef.current.update()
    }

    if (clips.length > 0) {
      const mixer = new THREE.AnimationMixer(object)
      mixerRef.current = mixer
      mixer.clipAction(clips[0]).play()
      setAnimations(clips)
      setSelectedAnim(0)
      clockRef.current.getDelta()
    }

    let vertCount = 0
    let hasTextures = false
    const collectedMeshes: MeshInfo[] = []
    let meshIdx = 0
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.geometry) vertCount += mesh.geometry.attributes.position?.count ?? 0
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        let meshHasTex = false
        let matName = ''
        mats.forEach((m: any) => {
          if (m?.map) { hasTextures = true; meshHasTex = true }
          if (m?.name) matName = m.name
        })
        meshIdx++
        collectedMeshes.push({
          name: mesh.name || `Mesh ${meshIdx}`,
          materialName: matName || `Material ${meshIdx}`,
          hasTexture: meshHasTex,
        })
      }
    })

    setMeshInfos(collectedMeshes)
    setModelInfo(
      `${(vertCount / 1000).toFixed(1)}k verts | ${clips.length} anim${clips.length !== 1 ? 's' : ''} | ${collectedMeshes.length} mesh${collectedMeshes.length !== 1 ? 'es' : ''} | ${hasTextures ? 'Textured' : 'No textures'}`
    )
    setModelLoaded(true)
  }, [clearModel])

  /** Apply a texture to a specific mesh by name, or to ALL meshes if meshName is undefined */
  const applyTextureToMesh = useCallback(async (file: File, flipY?: boolean, meshName?: string) => {
    if (!modelRef.current) return
    const url = await fileToDataURL(file)
    const flip = flipY ?? textureFlipY

    return new Promise<void>((resolve) => {
      const loader = new THREE.TextureLoader()
      loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = flip
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.needsUpdate = true

        let meshIdx = 0
        modelRef.current!.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return
          const mesh = child as THREE.Mesh
          meshIdx++
          const currentName = mesh.name || `Mesh ${meshIdx}`

          // Skip if targeting a specific mesh and this isn't it
          if (meshName && currentName !== meshName) return

          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat, idx) => {
            if (!mat) return
            const newMat = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.1,
              roughness: 0.7,
              color: new THREE.Color(0xffffff),
            })
            if (Array.isArray(mesh.material)) {
              (mesh.material as THREE.Material[])[idx] = newMat
            } else {
              mesh.material = newMat
            }
          })
        })

        // Update meshInfos to reflect the assignment
        setMeshInfos(prev => prev.map(mi => {
          if (meshName && mi.name !== meshName) return mi
          return { ...mi, hasTexture: true, assignedTexture: file.name }
        }))
        setModelInfo((prev) => prev.replace(/No textures|Textured.*/, 'Textured (applied)'))
        resolve()
      })
    })
  }, [textureFlipY])

  /** Backward-compat wrapper: apply to all meshes */
  const applyTexture = useCallback(async (file: File, flipY?: boolean) => {
    return applyTextureToMesh(file, flipY)
  }, [applyTextureToMesh])

  /** Split a name into lowercase keywords for fuzzy matching */
  const toKeywords = (name: string): string[] =>
    name.replace(/\.[^.]+$/, '') // strip extension
      .replace(/[_\-./\\]+/g, ' ') // separators → spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1 && !['the', 'and', 'for', 'map', 'tex', 'texture', 'diffuse', 'color', 'base', 'albedo', 'mat', 'material', '3d'].includes(w))

  /** Score how well a texture name matches a mesh/material name (0 = no match) */
  const matchScore = (texName: string, meshName: string, matName: string): number => {
    const texWords = toKeywords(texName)
    const meshWords = toKeywords(meshName)
    const matWords = toKeywords(matName)
    const targetWords = [...meshWords, ...matWords]
    if (texWords.length === 0 || targetWords.length === 0) return 0
    let score = 0
    for (const tw of texWords) {
      for (const mw of targetWords) {
        if (tw === mw) score += 3 // exact word match
        else if (mw.includes(tw) || tw.includes(mw)) score += 1 // substring
      }
    }
    return score
  }

  /** Add texture files to the pool and auto-assign to meshes */
  const addTextureFiles = useCallback(async (files: File[]) => {
    const newMap = new Map(textureFiles)
    for (const f of files) {
      newMap.set(f.name, f)
    }
    setTextureFiles(newMap)

    const defaultFlip = modelFormatRef.current === 'fbx' ? true : false

    if (meshInfos.length === 0) return

    // If only one mesh, apply all textures to it (last one wins)
    if (meshInfos.length === 1) {
      for (const file of files) {
        await applyTextureToMesh(file, defaultFlip)
      }
      return
    }

    // Multiple meshes: try to auto-assign each texture to the best-matching mesh
    const assigned = new Set<string>() // track which meshes got a texture
    for (const file of files) {
      let bestMesh: MeshInfo | null = null
      let bestScore = 0
      for (const mi of meshInfos) {
        if (assigned.has(mi.name)) continue // skip already assigned
        const s = matchScore(file.name, mi.name, mi.materialName)
        if (s > bestScore) { bestScore = s; bestMesh = mi }
      }
      if (bestMesh && bestScore > 0) {
        await applyTextureToMesh(file, defaultFlip, bestMesh.name)
        assigned.add(bestMesh.name)
      }
    }

    // If no matches at all and only 1 texture, apply to all meshes
    if (assigned.size === 0 && files.length === 1) {
      await applyTextureToMesh(files[0], defaultFlip)
    }
  }, [textureFiles, meshInfos, applyTextureToMesh])

  const handleToggleFlipY = useCallback(async () => {
    const newFlip = !textureFlipY
    setTextureFlipY(newFlip)

    if (!modelRef.current) return
    modelRef.current.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat: any) => {
        if (mat?.map) {
          mat.map.flipY = newFlip
          mat.map.needsUpdate = true
          mat.needsUpdate = true
        }
      })
    })
  }, [textureFlipY])

  const handleAnimChange = (index: number) => {
    setSelectedAnim(index)
    if (!mixerRef.current || !animations[index]) return
    mixerRef.current.stopAllAction()
    mixerRef.current.clipAction(animations[index]).play()
    clockRef.current.getDelta()
  }

  const handleCapture = async () => {
    const scene = sceneRef.current
    const model = modelRef.current
    if (!scene || !model) return

    setCapturing(true)
    setCaptureProgress(0)
    setCapturedImage(null)
    setCapturedBlob(null)

    // Reset model rotation for capture, restore after
    const savedRotY = model.rotation.y
    model.rotation.y = 0

    const angles = currentPreset.angles
    const elev = presetKey === 'custom' ? elevation : currentPreset.elevation
    const clip = animations[selectedAnim]
    const totalFrames = angles.length * frameCount
    let captured = 0

    const captureRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    captureRenderer.setSize(captureSize, captureSize)
    captureRenderer.setPixelRatio(1)
    captureRenderer.outputColorSpace = THREE.SRGBColorSpace
    captureRenderer.toneMapping = THREE.ACESFilmicToneMapping

    if (bgColor === 'transparent') captureRenderer.setClearColor(0x000000, 0)
    else if (bgColor === 'green') captureRenderer.setClearColor(0x00ff00, 1)
    else captureRenderer.setClearColor(0x0000ff, 1)

    let captureCamera: THREE.Camera
    if (currentPreset.useOrthographic) {
      const frustumSize = cameraDistance
      captureCamera = new THREE.OrthographicCamera(
        -frustumSize / 2, frustumSize / 2,
        frustumSize / 2, -frustumSize / 2,
        0.01, 1000
      )
    } else {
      captureCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    }

    const captureScene = new THREE.Scene()
    captureScene.add(new THREE.AmbientLight(0xffffff, 1.5))
    const dLight = new THREE.DirectionalLight(0xffffff, 2.0)
    dLight.position.set(5, 10, 7)
    captureScene.add(dLight)
    const bLight = new THREE.DirectionalLight(0xffffff, 0.8)
    bLight.position.set(-5, 5, -5)
    captureScene.add(bLight)
    captureScene.add(model)

    const sheetCanvas = document.createElement('canvas')
    sheetCanvas.width = frameCount * captureSize
    sheetCanvas.height = angles.length * captureSize
    const sheetCtx = sheetCanvas.getContext('2d')!

    const mixer = mixerRef.current
    if (mixer && clip) {
      mixer.stopAllAction()
      mixer.clipAction(clip).play()
    }

    for (let angleIdx = 0; angleIdx < angles.length; angleIdx++) {
      const angleDeg = angles[angleIdx]
      const angleRad = (angleDeg * Math.PI) / 180
      const elevRad = (elev * Math.PI) / 180

      for (let frame = 0; frame < frameCount; frame++) {
        if (mixer && clip) {
          mixer.setTime((clip.duration * frame) / frameCount)
          mixer.update(0) // force animation to apply
        }

        // Force world matrix update so bone positions reflect the animation
        model.updateMatrixWorld(true)

        // Follow root bone position so root-motion animations stay centered
        const followPos = new THREE.Vector3(0, 1, 0)
        if (rootBoneRef.current) {
          rootBoneRef.current.getWorldPosition(followPos)
        }

        captureCamera.position.set(
          followPos.x + cameraDistance * Math.sin(angleRad) * Math.cos(elevRad),
          followPos.y + cameraDistance * Math.sin(elevRad),
          followPos.z + cameraDistance * Math.cos(angleRad) * Math.cos(elevRad)
        )
        captureCamera.lookAt(followPos)

        captureRenderer.render(captureScene, captureCamera)
        sheetCtx.drawImage(captureRenderer.domElement, frame * captureSize, angleIdx * captureSize)

        captured++
        setCaptureProgress(Math.round((captured / totalFrames) * 100))
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    scene.add(model)
    model.rotation.y = savedRotY

    if (mixer && clip) {
      mixer.stopAllAction()
      mixer.clipAction(clip).play()
      clockRef.current.getDelta()
    }

    captureRenderer.dispose()

    // Apply pixel art pipeline if enabled
    let finalCanvas = sheetCanvas
    if (pixelArtEnabled) {
      const sourceData = sheetCtx.getImageData(0, 0, sheetCanvas.width, sheetCanvas.height)
      const result = runPixelPipeline(sourceData, pixelArtOpts)
      finalCanvas = document.createElement('canvas')
      finalCanvas.width = result.scaled.width
      finalCanvas.height = result.scaled.height
      finalCanvas.getContext('2d')!.putImageData(result.scaled, 0, 0)
    }

    const blob = await canvasToBlob(finalCanvas)
    const previewUrl = URL.createObjectURL(blob)
    setCapturedImage(previewUrl)
    setCapturedBlob(blob)
    setCapturing(false)
    setCaptureProgress(100)
  }

  const handleDownloadSheet = () => {
    if (!capturedBlob) return
    downloadBlob(capturedBlob, `spritesheet_${presetKey}_${frameCount}f.png`)
  }

  const lastTextureFileRef = useRef<File | null>(null)
  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileArr = Array.from(files)
    lastTextureFileRef.current = fileArr[0]
    const defaultFlip = modelFormatRef.current === 'fbx' ? true : false
    setTextureFlipY(defaultFlip)
    addTextureFiles(fileArr)
    e.target.value = ''
  }

  const handleModelFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) loadModel(files[0])
    e.target.value = ''
  }

  // Drag-and-drop on the viewport for model files
  const handleViewportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsDraggingModel(true)
  }, [])

  const handleViewportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingModel(false)
  }, [])

  const handleViewportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingModel(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    // Separate model files from image files
    const modelFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      return ext === 'fbx' || ext === 'glb' || ext === 'gltf'
    })
    const imageFiles = files.filter(f => f.type.startsWith('image/'))

    if (modelFile) {
      loadModel(modelFile)
    }

    if (imageFiles.length > 0 && modelRef.current) {
      const defaultFlip = modelFormatRef.current === 'fbx' ? true : false
      setTextureFlipY(defaultFlip)
      lastTextureFileRef.current = imageFiles[0]
      addTextureFiles(imageFiles)
    }
  }, [loadModel, applyTexture, addTextureFiles])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">3D Spritesheet Generator</h2>
        <p className="text-sm text-zinc-500 mt-2">
          Load a 3D model with animations (FBX from Mixamo), capture from multiple angles
        </p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* 3D Viewport */}
        <div className="space-y-3">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">3D Preview</p>
              <div className="flex items-center gap-1">
                {/* Model upload button — always visible */}
                <button
                  onClick={() => modelInputRef.current?.click()}
                  className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded hover:bg-zinc-100"
                  title="Load 3D model (FBX, GLB, GLTF)"
                >
                  <FolderOpen size={15} />
                </button>
                <input
                  ref={modelInputRef}
                  type="file"
                  accept=".fbx,.glb,.gltf"
                  onChange={handleModelFileInput}
                  className="hidden"
                />
                {modelLoaded && (
                  <>
                    <button
                      onClick={() => textureInputRef.current?.click()}
                      className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded hover:bg-zinc-100"
                      title="Apply texture"
                    >
                      <ImagePlus size={15} />
                    </button>
                    <input
                      ref={textureInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleTextureUpload}
                      className="hidden"
                    />
                    <button
                      onClick={handleToggleFlipY}
                      className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded hover:bg-zinc-100"
                      title={`Flip texture UV (currently flipY=${textureFlipY})`}
                    >
                      <FlipVertical size={15} />
                    </button>
                    <button
                      onClick={() => setPlaying(!playing)}
                      className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded hover:bg-zinc-100"
                      title={playing ? 'Pause' : 'Play'}
                    >
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Viewport with drag-and-drop overlay */}
            <div
              className="relative w-full aspect-square rounded overflow-hidden"
              onDragOver={handleViewportDragOver}
              onDragLeave={handleViewportDragLeave}
              onDrop={handleViewportDrop}
            >
              <div
                ref={containerRef}
                className="w-full h-full"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
                  backgroundSize: '20px 20px',
                }}
              />

              {/* Empty state — no model loaded */}
              {!modelLoaded && !isDraggingModel && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-zinc-50/80 backdrop-blur-sm"
                  onClick={() => modelInputRef.current?.click()}
                >
                  <Upload className="mb-3 text-zinc-400" size={36} />
                  <p className="text-sm font-medium text-zinc-600">Drop a 3D model here</p>
                  <p className="text-xs text-zinc-400 mt-1">or click to browse · FBX, GLB, GLTF</p>
                </div>
              )}

              {/* Drag overlay */}
              {isDraggingModel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50/90 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded z-10">
                  <Upload className="mb-2 text-blue-500" size={32} />
                  <p className="text-sm font-medium text-blue-700">
                    {modelLoaded ? 'Drop model or texture' : 'Drop 3D model'}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {modelLoaded ? 'FBX/GLB for model, images for texture' : 'FBX, GLB, GLTF'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {modelLoaded && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">{modelInfo}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFlipY}
                    className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                    title="Toggle UV flip direction if texture appears mirrored/inverted"
                  >
                    <FlipVertical size={11} /> Flip UV
                  </button>
                  <button
                    onClick={() => textureInputRef.current?.click()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <ImagePlus size={12} /> Apply Texture
                  </button>
                </div>
              </div>
              {/* Model rotation */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 shrink-0">Rotate</span>
                <input
                  type="range"
                  min={0} max={359} step={1}
                  value={modelRotation}
                  onChange={(e) => setModelRotation(Number(e.target.value))}
                  className="flex-1 h-1 accent-zinc-700"
                />
                <input
                  type="number"
                  min={0} max={359}
                  value={modelRotation}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(359, Number(e.target.value) || 0))
                    setModelRotation(v)
                  }}
                  className="w-12 text-[11px] text-center px-1 py-0.5 border border-zinc-200 rounded focus:outline-none focus:border-blue-400"
                />
                <span className="text-[10px] text-zinc-400">°</span>
              </div>
            </div>
          )}

          {/* Captured spritesheet preview */}
          {capturedImage && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Spritesheet Output</p>
                <Button onClick={handleDownloadSheet} size="sm">
                  <Download size={12} /> Download PNG
                </Button>
              </div>
              <div
                className="overflow-auto max-h-80 rounded"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
                  backgroundSize: '12px 12px',
                }}
              >
                <img
                  src={capturedImage}
                  alt="Captured spritesheet"
                  className="max-w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-zinc-400">
                  {currentPreset.angles.length} angles × {frameCount} frames = {currentPreset.angles.length * frameCount} total |{' '}
                  {frameCount * captureSize} × {currentPreset.angles.length * captureSize}px
                </p>
                <button
                  onClick={() => {
                    if (capturedImage) {
                      sessionStorage.setItem('jet-pixelart-import', capturedImage)
                      navigate('/image-to-pixelart')
                    }
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <ExternalLink size={11} /> Edit in Pixel Art
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Export — always on top */}
          <div className="space-y-2">
            {capturing && (
              <div className="space-y-1">
                <ProgressBar value={captureProgress} />
                <p className="text-[11px] text-zinc-500 text-center">Capturing... {captureProgress}%</p>
              </div>
            )}

            <Button
              onClick={handleCapture}
              disabled={!modelLoaded || capturing}
              className="w-full"
            >
              {capturing ? (
                <><Loader2 size={16} className="animate-spin" /> Capturing...</>
              ) : (
                <><Camera size={16} /> Capture Spritesheet</>
              )}
            </Button>
            <p className="text-[11px] text-zinc-400 text-center">
              {currentPreset.angles.length} angles × {frameCount} frames · {frameCount * captureSize}×{currentPreset.angles.length * captureSize}px
            </p>
          </div>

          {/* Model & Texture */}
          <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Model & Texture</p>
            <button
              onClick={() => modelInputRef.current?.click()}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-dashed transition-colors text-left',
                modelLoaded
                  ? 'border-zinc-200 hover:border-zinc-300'
                  : 'border-blue-300 hover:border-blue-400 bg-blue-50/30'
              )}
            >
              <FolderOpen size={14} className={modelLoaded ? 'text-zinc-400' : 'text-blue-500'} />
              <span className={cn('text-xs', modelLoaded ? 'text-zinc-500' : 'text-blue-600')}>
                {modelLoaded ? 'Replace model' : 'Load model'} <span className="text-zinc-400">· FBX, GLB, GLTF</span>
              </span>
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => textureInputRef.current?.click()}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors flex-1',
                  modelLoaded
                    ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    : 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                )}
                disabled={!modelLoaded}
              >
                <ImagePlus size={11} /> Apply Texture
              </button>
              <button
                onClick={handleToggleFlipY}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors',
                  modelLoaded
                    ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    : 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                )}
                disabled={!modelLoaded}
                title={`Toggle UV flip (flipY=${textureFlipY})`}
              >
                <FlipVertical size={11} /> Flip UV
              </button>
            </div>

            {/* Texture pool & per-mesh assignment */}
            {modelLoaded && textureFiles.size > 0 && (
              <div className="space-y-1.5 pt-1.5 border-t border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Textures</p>
                <div className="space-y-0.5">
                  {Array.from(textureFiles.entries()).map(([name]) => (
                    <div key={name} className="flex items-center justify-between group text-[11px]">
                      <span className="text-zinc-600 truncate flex-1" title={name}>{name}</span>
                      <button
                        onClick={() => {
                          const next = new Map(textureFiles)
                          next.delete(name)
                          setTextureFiles(next)
                          // Clear assignment from meshes using this texture
                          setMeshInfos(prev => prev.map(mi =>
                            mi.assignedTexture === name ? { ...mi, assignedTexture: undefined } : mi
                          ))
                        }}
                        className="text-zinc-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modelLoaded && meshInfos.length > 1 && (
              <div className="space-y-1.5 pt-1.5 border-t border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Assign to Meshes</p>
                <div className="space-y-1">
                  {meshInfos.map((mi) => (
                    <div key={mi.name} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 truncate min-w-0 flex-1" title={`${mi.name} (${mi.materialName})`}>
                        {mi.name}
                      </span>
                      <select
                        value={mi.assignedTexture || ''}
                        onChange={async (e) => {
                          const texName = e.target.value
                          if (!texName) {
                            // Clear assignment — no easy way to "un-texture" without reloading, just update state
                            setMeshInfos(prev => prev.map(m =>
                              m.name === mi.name ? { ...m, assignedTexture: undefined } : m
                            ))
                            return
                          }
                          const file = textureFiles.get(texName)
                          if (file) {
                            await applyTextureToMesh(file, textureFlipY, mi.name)
                          }
                        }}
                        className="text-[10px] bg-zinc-50 border border-zinc-200 rounded px-1 py-0.5 max-w-[120px]"
                      >
                        <option value="">None</option>
                        {Array.from(textureFiles.keys()).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Animation */}
          {animations.length > 0 && (
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Animation</p>
              <Select
                label="Clip"
                options={animations.map((clip, i) => ({
                  value: String(i),
                  label: clip.name || `Animation ${i + 1}`,
                }))}
                value={String(selectedAnim)}
                onChange={(e) => handleAnimChange(Number(e.target.value))}
              />
            </div>
          )}

          {/* Capture Settings */}
          <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Capture Settings</p>

            <Select
              label="Preset"
              options={[
                ...Object.entries(presets).map(([key, p]) => ({
                  value: key,
                  label: p.name,
                })),
                ...savedPresets.map((sp) => ({
                  value: `saved:${sp.name}`,
                  label: `★ ${sp.name}`,
                })),
              ]}
              value={presetKey}
              onChange={(e) => {
                const val = e.target.value
                if (val.startsWith('saved:')) {
                  const name = val.slice(6)
                  const sp = savedPresets.find((p) => p.name === name)
                  if (sp) {
                    setPresetKey('custom')
                    setCustomDirCount(sp.directionCount)
                    setCustomSingleAngle(sp.singleAngle ?? 0)
                    setElevation(sp.elevation)
                    setFrameCount(sp.frameCount)
                    setCaptureSize(sp.captureSize)
                    setCameraDistance(sp.cameraDistance)
                    setBgColor(sp.bgColor)
                  }
                } else {
                  setPresetKey(val)
                  const p = presets[val]
                  if (p) setElevation(p.elevation)
                }
              }}
            />

            <p className="text-[10px] text-zinc-400 leading-snug">
              {currentPreset.angles.map((a) => directionLabels[a] || `${a}°`).join(' · ')}
            </p>

            {presetKey === 'custom' && (
              <>
                {/* Direction count toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 shrink-0">Dirs</span>
                  <div className="flex flex-1 rounded-md overflow-hidden border border-zinc-200">
                    {([1, 4, 8] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setCustomDirCount(n)}
                        className={cn(
                          'flex-1 text-[11px] font-medium py-1 transition-colors',
                          customDirCount === n
                            ? 'bg-zinc-800 text-white'
                            : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                        )}
                      >
                        {n === 1 ? 'Single' : `${n}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Single angle input — slider + number input */}
                {customDirCount === 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 shrink-0">Angle</span>
                    <input
                      type="range"
                      min={0} max={359} step={1}
                      value={customSingleAngle}
                      onChange={(e) => setCustomSingleAngle(Number(e.target.value))}
                      className="flex-1 h-1 accent-zinc-700"
                    />
                    <input
                      type="number"
                      min={0} max={359}
                      value={customSingleAngle}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(359, Number(e.target.value) || 0))
                        setCustomSingleAngle(v)
                      }}
                      className="w-12 text-[11px] text-center px-1 py-0.5 border border-zinc-200 rounded focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-[10px] text-zinc-400">°</span>
                  </div>
                )}

                <Slider
                  label="Elevation"
                  displayValue={`${elevation}°`}
                  min={0} max={90} value={elevation}
                  onChange={(e) => setElevation(Number((e.target as HTMLInputElement).value))}
                />
              </>
            )}

            <Slider
              label="Frames"
              displayValue={String(frameCount)}
              min={1} max={32} value={frameCount}
              onChange={(e) => setFrameCount(Number((e.target as HTMLInputElement).value))}
            />

            <Slider
              label="Size"
              displayValue={`${captureSize}px`}
              min={32} max={512} step={32} value={captureSize}
              onChange={(e) => setCaptureSize(Number((e.target as HTMLInputElement).value))}
            />

            <Slider
              label="Distance"
              displayValue={String(cameraDistance)}
              min={1} max={10} step={0.5} value={cameraDistance}
              onChange={(e) => setCameraDistance(Number((e.target as HTMLInputElement).value))}
            />

            <Select
              label="Background"
              options={[
                { value: 'transparent', label: 'Transparent' },
                { value: 'green', label: 'Green Screen' },
                { value: 'blue', label: 'Blue Screen' },
              ]}
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value as typeof bgColor)}
            />

            {/* Pixel Art Style */}
            <div className="pt-1.5 border-t border-zinc-100 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pixelArtEnabled} onChange={e => setPixelArtEnabled(e.target.checked)}
                  className="accent-blue-600 rounded" />
                <span className="text-[11px] font-medium text-zinc-600">Pixel Art Style</span>
              </label>
              {pixelArtEnabled && (
                <div className="space-y-1.5 pl-2">
                  <Select label="Palette" options={[
                    { value: 'auto', label: 'Auto' },
                    ...PALETTE_PRESETS.map(p => ({ value: p.name, label: `${p.name} (${p.colors.length})` })),
                  ]} value={pixelArtOpts.paletteMode === 'auto' ? 'auto' : (PALETTE_PRESETS.find(p => JSON.stringify(p.colors) === JSON.stringify(pixelArtOpts.paletteColors))?.name || 'PICO-8')}
                  onChange={e => {
                    if (e.target.value === 'auto') {
                      updatePA({ paletteMode: 'auto' })
                    } else {
                      const p = PALETTE_PRESETS.find(pr => pr.name === e.target.value)
                      updatePA({ paletteMode: 'preset', paletteColors: p?.colors })
                    }
                  }} />
                  {pixelArtOpts.paletteMode === 'auto' && (
                    <Slider label="Colors" displayValue={String(pixelArtOpts.colorCount)}
                      min={2} max={64} value={pixelArtOpts.colorCount}
                      onChange={e => updatePA({ colorCount: +(e.target as HTMLInputElement).value })} />
                  )}
                  <Select label="Dither" options={[
                    { value: 'none', label: 'None' },
                    { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
                    { value: 'bayer2', label: 'Bayer 2×2' },
                    { value: 'bayer4', label: 'Bayer 4×4' },
                    { value: 'bayer8', label: 'Bayer 8×8' },
                  ]} value={pixelArtOpts.ditherMode} onChange={e => updatePA({ ditherMode: e.target.value as PipelineOptions['ditherMode'] })} />
                  <Select label="Scaling" options={[
                    { value: 'nearest', label: 'Nearest' },
                    { value: 'epx', label: 'EPX / Scale2x' },
                    { value: 'mmpx', label: 'MMPX' },
                  ]} value={pixelArtOpts.scaleAlgorithm} onChange={e => updatePA({ scaleAlgorithm: e.target.value as PipelineOptions['scaleAlgorithm'] })} />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pixelArtOpts.outline} onChange={e => updatePA({ outline: e.target.checked })}
                      className="accent-blue-600 rounded" />
                    <span className="text-[10px] text-zinc-500">Outline</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pixelArtOpts.inline} onChange={e => updatePA({ inline: e.target.checked })}
                      className="accent-blue-600 rounded" />
                    <span className="text-[10px] text-zinc-500">Inline edges</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pixelArtOpts.edgePolish} onChange={e => updatePA({ edgePolish: e.target.checked })}
                      className="accent-blue-600 rounded" />
                    <span className="text-[10px] text-zinc-500">Edge polish</span>
                  </label>
                </div>
              )}
            </div>

            {/* Save / manage custom presets */}
            {presetKey === 'custom' && (
              <div className="pt-1 border-t border-zinc-100 space-y-1.5">
                {!showSaveInput ? (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700 font-medium"
                  >
                    <Save size={11} /> Save as preset
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={savePresetName}
                      onChange={(e) => setSavePresetName(e.target.value)}
                      placeholder="Preset name"
                      className="flex-1 text-[11px] px-2 py-1 border border-zinc-200 rounded focus:outline-none focus:border-blue-400"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && savePresetName.trim()) {
                          const updated = savePreset({
                            name: savePresetName.trim(),
                            elevation,
                            directionCount: customDirCount,
                            singleAngle: customSingleAngle,
                            frameCount,
                            captureSize,
                            cameraDistance,
                            bgColor,
                          })
                          setSavedPresets(updated)
                          setSavePresetName('')
                          setShowSaveInput(false)
                        }
                        if (e.key === 'Escape') setShowSaveInput(false)
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!savePresetName.trim()) return
                        const updated = savePreset({
                          name: savePresetName.trim(),
                          elevation,
                          directionCount: customDirCount,
                          singleAngle: customSingleAngle,
                          frameCount,
                          captureSize,
                          cameraDistance,
                          bgColor,
                        })
                        setSavedPresets(updated)
                        setSavePresetName('')
                        setShowSaveInput(false)
                      }}
                      className="text-[11px] px-2 py-1 bg-zinc-800 text-white rounded hover:bg-zinc-700 font-medium"
                    >
                      Save
                    </button>
                  </div>
                )}

                {savedPresets.length > 0 && (
                  <div className="space-y-0.5">
                    {savedPresets.map((sp) => (
                      <div key={sp.name} className="flex items-center justify-between group">
                        <button
                          onClick={() => {
                            setCustomDirCount(sp.directionCount)
                            setCustomSingleAngle(sp.singleAngle ?? 0)
                            setElevation(sp.elevation)
                            setFrameCount(sp.frameCount)
                            setCaptureSize(sp.captureSize)
                            setCameraDistance(sp.cameraDistance)
                            setBgColor(sp.bgColor)
                          }}
                          className="text-[11px] text-blue-600 hover:text-blue-700 font-medium truncate"
                          title={`${sp.directionCount === 1 ? `${sp.singleAngle ?? 0}°` : `${sp.directionCount} dirs`} · ${sp.elevation}° elev · ${sp.frameCount}f · ${sp.captureSize}px`}
                        >
                          ★ {sp.name}
                        </button>
                        <button
                          onClick={() => setSavedPresets(deletePreset(sp.name))}
                          className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          title="Delete preset"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
