import * as THREE from 'three'
import { EffectComposer } from 'postprocessing'
import { RenderPass } from 'postprocessing'
import { EffectPass } from 'postprocessing'
import { DepthOfFieldEffect } from 'postprocessing'
import { BlendFunction } from 'postprocessing'

const sssVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const sssFragmentShader = `
uniform vec3 lightPosition;
uniform vec3 rimLightPosition;
uniform vec3 baseColor;
uniform vec3 sssColor;
uniform float sssIntensity;
uniform float roughness;
uniform float rimIntensity;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // Key Light (chaude)
  vec3 lightDir = normalize(lightPosition - vWorldPosition);
  float diffuse = max(dot(normal, lightDir), 0.0);

  // Subsurface Scattering approximation
  float thickness = 1.0 - diffuse;
  float sss = pow(thickness, 2.0) * sssIntensity;
  vec3 subsurface = sssColor * sss;

  // PBR-like lighting
  vec3 halfVector = normalize(lightDir + viewDir);
  float specular = pow(max(dot(normal, halfVector), 0.0), (1.0 - roughness) * 128.0);

  // Rim Light (brillante)
  vec3 rimLightDir = normalize(rimLightPosition - vWorldPosition);
  float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
  float rimLight = pow(rimDot, 3.0) * rimIntensity;

  // Ambient
  vec3 ambient = baseColor * 0.3;

  // Combine
  vec3 keyLightColor = vec3(1.0, 0.9, 0.7); // Warm key light
  vec3 diffuseColor = baseColor * diffuse * keyLightColor;
  vec3 specularColor = vec3(1.0) * specular * 0.5;
  vec3 rimColor = vec3(1.0, 1.0, 1.0) * rimLight;

  vec3 finalColor = ambient + diffuseColor + subsurface + specularColor + rimColor;

  gl_FragColor = vec4(finalColor, 1.0);
}
`

export function initThreeScene(container: HTMLElement): () => void {
  // Scene setup
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 0, 5)

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  container.appendChild(renderer.domElement)

  // Sphere avec SSS Shader
  const geometry = new THREE.SphereGeometry(1, 128, 128)

  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: sssVertexShader,
    fragmentShader: sssFragmentShader,
    uniforms: {
      lightPosition: { value: new THREE.Vector3(5, 5, 5) },
      rimLightPosition: { value: new THREE.Vector3(-3, 2, 3) },
      baseColor: { value: new THREE.Color(0xff6b9d) },
      sssColor: { value: new THREE.Color(0xff3366) },
      sssIntensity: { value: 0.8 },
      roughness: { value: 0.2 },
      rimIntensity: { value: 2.5 }
    }
  })

  const sphere = new THREE.Mesh(geometry, shaderMaterial)
  scene.add(sphere)

  // Lumières additionnelles pour la scène
  const keyLight = new THREE.DirectionalLight(0xffd699, 1.5)
  keyLight.position.set(5, 5, 5)
  scene.add(keyLight)

  const rimLight = new THREE.PointLight(0xffffff, 2)
  rimLight.position.set(-3, 2, 3)
  scene.add(rimLight)

  const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
  scene.add(ambientLight)

  // Post-processing avec Depth of Field
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const depthOfFieldEffect = new DepthOfFieldEffect(camera, {
    focusDistance: 0.0,
    focalLength: 0.05,
    bokehScale: 3.0,
    height: 480
  })

  const effectPass = new EffectPass(camera, depthOfFieldEffect)
  effectPass.renderToScreen = true
  composer.addPass(effectPass)

  // Animation
  let animationId: number
  const clock = new THREE.Clock()

  function animate() {
    animationId = requestAnimationFrame(animate)

    const elapsedTime = clock.getElapsedTime()

    // Rotation lente de la sphère
    sphere.rotation.y = elapsedTime * 0.2
    sphere.rotation.x = Math.sin(elapsedTime * 0.3) * 0.1

    // Animation subtile de la lumière rim
    rimLight.position.x = Math.cos(elapsedTime) * 3
    rimLight.position.z = Math.sin(elapsedTime) * 3
    shaderMaterial.uniforms.rimLightPosition.value.copy(rimLight.position)

    composer.render()
  }

  animate()

  // Handle resize
  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
  }

  window.addEventListener('resize', handleResize)

  // Cleanup
  return () => {
    cancelAnimationFrame(animationId)
    window.removeEventListener('resize', handleResize)
    renderer.dispose()
    geometry.dispose()
    shaderMaterial.dispose()
    container.removeChild(renderer.domElement)
  }
}
