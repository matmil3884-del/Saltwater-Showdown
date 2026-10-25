/* Saltwater Showdown: real-time 3D offshore scene.
   Uses Three.js WebGL; the existing UI/gameplay stays layered above it. */
(async function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'ocean3d';
  canvas.setAttribute('aria-label', 'Real-time 3D ocean and fishing boat scene');
  Object.assign(canvas.style, { position:'fixed', inset:'0', width:'100%', height:'100%', zIndex:'0', pointerEvents:'none' });
  document.body.prepend(canvas);
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b6a08b');
    scene.fog = new THREE.FogExp2('#7699a5', 0.012);
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth/window.innerHeight, 0.1, 260);
    camera.position.set(0, 2.25, 8.5);
    camera.lookAt(0, 1.3, -8);

    scene.add(new THREE.HemisphereLight(0xc5e6ff, 0x24333d, 2.0));
    const sunLight = new THREE.DirectionalLight(0xffd5a0, 3.1);
    sunLight.position.set(-8, 12, -12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024,1024);
    scene.add(sunLight);

    // Atmospheric sun and softly layered clouds.
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 24), new THREE.MeshBasicMaterial({color:0xffd8a0}));
    sun.position.set(7, 7, -68); scene.add(sun);
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 16), new THREE.MeshBasicMaterial({color:0xffb76e, transparent:true, opacity:.12, depthWrite:false}));
    sunGlow.position.copy(sun.position); scene.add(sunGlow);
    const cloudMat = new THREE.MeshStandardMaterial({color:0xb8cbd0, roughness:1, transparent:true, opacity:.19});
    for (let i=0;i<11;i++) {
      const g = new THREE.Group();
      for(let j=0;j<4;j++){
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random()*0.45, 12, 8), cloudMat);
        puff.scale.set(1.8,0.34,0.55);
        puff.position.set(j*0.75, Math.random()*0.22, Math.random()*0.35);
        g.add(puff);
      }
      g.position.set(-20 + Math.random()*40, 5.2+Math.random()*5, -35-Math.random()*55);
      g.userData.speed = 0.08 + Math.random()*0.12; scene.add(g);
      clouds.push(g);
    }
    function makeMat(color, roughness=.55, metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
    const clouds = [];

    // Dense, animated vertex-displaced ocean for actual 3D depth and moving highlights.
    const seaGeo = new THREE.PlaneGeometry(220, 180, 150, 120);
    seaGeo.rotateX(-Math.PI/2);
    const seaPos = seaGeo.attributes.position;
    const originalY = new Float32Array(seaPos.count);
    for(let i=0;i<seaPos.count;i++) originalY[i]=seaPos.getY(i);
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({
      color:0x0b5d79, roughness:.27, metalness:.28, side:THREE.DoubleSide
    }));
    sea.position.set(0,0,-35); sea.receiveShadow=true; scene.add(sea);

    // Long glints across the surface catch the low sun.
    const glintGroup = new THREE.Group(); scene.add(glintGroup);
    const glintMat = new THREE.MeshBasicMaterial({color:0xb5e8ec,transparent:true,opacity:.2});
    for(let i=0;i<85;i++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(.25+Math.random()*1.7,.012,.025+Math.random()*.04),glintMat);
      m.position.set(-28+Math.random()*56,.035,-8-Math.random()*82);
      m.rotation.y=(Math.random()-.5)*.12; glintGroup.add(m);
    }

    // The bow/deck is modelled geometry, viewed from the angler's position.
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-3.0,-0.2); hullShape.lineTo(3.0,-0.2); hullShape.lineTo(2.15,1.25);
    hullShape.lineTo(0,2.15); hullShape.lineTo(-2.15,1.25); hullShape.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape,{depth:1.35,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.08,bevelThickness:.08}),makeMat(0x173b4b,.32,.55));
    hull.rotation.x=-Math.PI/2; hull.position.set(0,-1.25,1.7); hull.scale.set(1,.62,1); hull.castShadow=true; hull.receiveShadow=true; scene.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.55,.12,1.3),makeMat(0xc7d0cb,.46,.15));
    deck.position.set(0,-.3,2.25); deck.castShadow=true; deck.receiveShadow=true; scene.add(deck);
    const gunwaleMat=makeMat(0xe5e8df,.28,.5);
    for(const side of [-1,1]){
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3.4,10),gunwaleMat);
      rail.rotation.z=Math.PI/2; rail.position.set(0,-.02,2.75); scene.add(rail);
      const rail2=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.15,8),gunwaleMat);
      rail2.rotation.x=Math.PI/2; rail2.position.set(side*2.1,.1,2.55); scene.add(rail2);
    }
    // Center console ahead of the player, with smoked glass and metal trim.
    const console = new THREE.Mesh(new THREE.BoxGeometry(1.25,.85,.5),makeMat(0xe4e8e4,.3,.18));
    console.position.set(0,.0,1.05); console.castShadow=true; scene.add(console);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.13,.42,.035),new THREE.MeshPhysicalMaterial({color:0x28586a,metalness:.3,roughness:.12,transparent:true,opacity:.88}));
    windshield.position.set(0,.47,.78); windshield.rotation.x=-.22; scene.add(windshield);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.28,.045,.055),makeMat(0xb7c9c9,.22,.65));
    trim.position.set(0,.25,.77); scene.add(trim);

    // First-person fishing rod, reel, guides and a fine line leading out to the water.
    const rodCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.55,-.1,2.9), new THREE.Vector3(2.05,.3,1.5),
      new THREE.Vector3(1.3,1.25,-.4), new THREE.Vector3(.55,2.6,-3.6),
      new THREE.Vector3(.1,3.25,-6.8)
    ]);
    const rod = new THREE.Mesh(new THREE.TubeGeometry(rodCurve,48,.035,8,false),makeMat(0x202b35,.25,.45)); scene.add(rod);
    const rodHighlight = new THREE.Mesh(new THREE.TubeGeometry(rodCurve,48,.009,5,false),makeMat(0xa7bfc5,.22,.55)); scene.add(rodHighlight);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.12,20),makeMat(0xb8c7c8,.24,.75));
    reel.rotation.x=Math.PI/2; reel.position.set(2.2,.22,2.05); scene.add(reel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.38,8),makeMat(0x17232c,.4,.25));
    handle.rotation.z=.6; handle.position.set(2.38,.1,2.0); scene.add(handle);
    const lineCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(.1,3.25,-6.8),new THREE.Vector3(.25,2.0,-9),new THREE.Vector3(.5,.2,-13)]);
    const fishingLine = new THREE.Mesh(new THREE.TubeGeometry(lineCurve,24,.008,4,false),new THREE.MeshBasicMaterial({color:0xe4eee5})); scene.add(fishingLine);

    // Tiny floating spray particles give the foreground a sense of movement.
    const sprayCount=180, sprayGeo=new THREE.BufferGeometry(), sprayArr=new Float32Array(sprayCount*3);
    for(let i=0;i<sprayCount;i++){sprayArr[i*3]=-5+Math.random()*10;sprayArr[i*3+1]=-0.05+Math.random()*.9;sprayArr[i*3+2]=-2-Math.random()*13;}
    sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayArr,3));
    const spray=new THREE.Points(sprayGeo,new THREE.PointsMaterial({color:0xd9f7fa,size:.035,transparent:true,opacity:.45})); scene.add(spray);

    document.body.classList.add('three-ready');
    const clock = new THREE.Clock();
    function resize(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));}
    window.addEventListener('resize',resize,{passive:true});
    renderer.setAnimationLoop(()=>{
      const t=clock.getElapsedTime();
      for(let i=0;i<seaPos.count;i++){
        const x=seaPos.getX(i), z=seaPos.getZ(i);
        seaPos.setY(i,originalY[i]+Math.sin(x*.11+t*.85)*.105+Math.cos(z*.15+t*.72)*.075+Math.sin((x+z)*.07+t*.55)*.05);
      }
      seaPos.needsUpdate=true; seaGeo.computeVertexNormals();
      for(const c of clouds){c.position.x+=c.userData.speed*.016;if(c.position.x>24)c.position.x=-24;}
      glintGroup.position.x=Math.sin(t*.09)*.22;
      hull.position.y=-1.25+Math.sin(t*1.1)*.045;
      rod.rotation.z=Math.sin(t*.8)*.012;
      renderer.render(scene,camera);
    });
  } catch (err) {
    console.warn('3D scene could not initialize; keeping the existing fallback scene.', err);
    canvas.remove();
  }
})();