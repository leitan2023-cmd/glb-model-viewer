import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 创建场景
const scene = new THREE.Scene();
scene.name = 'Draco Compressed Model';

// 创建根组
const root = new THREE.Group();
root.name = 'Root';
scene.add(root);

// 创建主体组
const body = new THREE.Group();
body.name = 'Body';
root.add(body);

// 创建立方体
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x00d4ff,
  metalness: 0.3,
  roughness: 0.4,
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.name = 'Cube';
cube.position.set(-3, 0, 0);
body.add(cube);

// 创建球体
const sphereGeometry = new THREE.SphereGeometry(1.5, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6b35,
  metalness: 0.5,
  roughness: 0.3,
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.name = 'Sphere';
sphere.position.set(0, 0, 0);
body.add(sphere);

// 创建圆柱体
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 3, 32);
const cylinderMaterial = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  metalness: 0.2,
  roughness: 0.5,
});
const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
cylinder.name = 'Cylinder';
cylinder.position.set(3, 0, 0);
body.add(cylinder);

// 创建细节组
const details = new THREE.Group();
details.name = 'Details';
root.add(details);

// 创建小立方体
const smallCubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const smallCubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  metalness: 0.4,
  roughness: 0.4,
});

for (let i = 0; i < 3; i++) {
  const smallCube = new THREE.Mesh(smallCubeGeometry, smallCubeMaterial);
  smallCube.name = `SmallCube_${i}`;
  smallCube.position.set(-2 + i * 2, 2.5, 0);
  details.add(smallCube);
}

// 添加灯光
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// 导出为 GLB（不使用 Draco 压缩）
const exporter = new GLTFExporter();

exporter.parse(
  scene,
  (gltf) => {
    const buffer = Buffer.from(gltf);
    const outputPath = path.join(__dirname, 'client/public/sample-model-draco.glb');
    
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
    console.log(`✓ Draco 压缩示例模型已生成: ${outputPath}`);
    console.log(`  注意: 此模型未使用 Draco 压缩（需要使用 gltf-transform 工具）`);
    console.log(`  要启用 Draco 压缩，请运行: npx gltf-transform compress sample-model-draco.glb sample-model-draco-compressed.glb`);
  },
  (error) => {
    console.error('导出失败:', error);
    process.exit(1);
  },
  { binary: true }
);
