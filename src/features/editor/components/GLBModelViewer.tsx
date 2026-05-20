import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import JSZip from "jszip";

interface GLBModelViewerProps {
  modelUrl: string;
}

function isLocalhost() {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
}

function getProxyUrl(originalUrl: string): string {
  if (isLocalhost()) {
    return `/api/model-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
}

function isZipUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".zip");
}

async function extractGlbFromZip(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const glbFiles = Object.keys(zip.files).filter(
    fileName => fileName.toLowerCase().endsWith(".glb") || fileName.toLowerCase().endsWith(".gltf")
  );

  if (glbFiles.length === 0) {
    throw new Error("ZIP 文件中未找到 .glb 或 .gltf 模型文件");
  }

  const glbFile = glbFiles[0];
  const fileData = await zip.files[glbFile].async("arraybuffer");
  return fileData;
}

export function GLBModelViewer({ modelUrl }: GLBModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const loader = new GLTFLoader();
    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        const proxyUrl = getProxyUrl(modelUrl);

        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }

        let modelArrayBuffer = await response.arrayBuffer();

        if (isZipUrl(modelUrl)) {
          setError("正在解压模型文件...");
          modelArrayBuffer = await extractGlbFromZip(modelArrayBuffer);
          setError(null);
        }

        const blob = new Blob([modelArrayBuffer], { type: "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        loader.load(
          blobUrl,
          (gltf) => {
            const model = gltf.scene;

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (!child.material) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0xaaaaaa,
                    metalness: 0.3,
                    roughness: 0.7,
                  });
                }
              }
            });

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 3 / maxDim : 1;

            model.scale.set(scale, scale, scale);
            model.position.sub(center);
            model.position.y = size.y * scale * 0.5;

            scene.add(model);

            controls.target.set(0, size.y * scale * 0.5, 0);
            controls.update();

            setLoading(false);
          },
          undefined,
          (err) => {
            console.error("Error loading GLB model:", err);
            setError("加载模型失败，请检查模型文件格式是否正确。");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Error fetching model:", err);
        setError(`加载模型失败：${err instanceof Error ? err.message : "请检查网络连接后重试。"}`);
        setLoading(false);
      }
    };

    loadModel();

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [modelUrl]);

  return (
    <div className="model-viewer" ref={containerRef}>
      {loading && (
        <div className="model-viewer__loading">
          <div className="model-viewer__spinner"></div>
          <p>加载中...</p>
        </div>
      )}
      {error && (
        <div className="model-viewer__error">
          <p>{error}</p>
        </div>
      )}
      <div className="model-viewer__hint">
        <span>拖拽旋转 | 滚轮缩放</span>
      </div>
    </div>
  );
}