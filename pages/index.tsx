import { useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const initScene = async () => {
      const { initThreeScene } = await import('../components/Scene')
      cleanup = initThreeScene(containerRef.current!)
    }

    initScene()

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  return (
    <>
      <Head>
        <title>Pixar Style Sphere - Three.js</title>
        <meta name="description" content="Pixar-style stylized sphere with SSS and PBR" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div id="canvas-container" ref={containerRef} />
    </>
  )
}
