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
    const clouds = [];
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


    // Detailed first-person angler arms, gloves, and a modeled spinning reel.
    const skinMat=makeMat(0x9a6848,.82,0), gloveMat=makeMat(0x182a34,.52,.12), stitchMat=makeMat(0xb9c9c7,.5,.18);
    function capsuleBetween(a,b,r,mat){
      const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),mat);
      mesh.position.copy(av.add(bv).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); scene.add(mesh); return mesh;
    }
    // Sleeves and forearms frame the bottom of the camera without blocking the water.
    const leftSleeve=new THREE.Mesh(new THREE.CylinderGeometry(.34,.46,.95,16),makeMat(0x183c4b,.9));
    leftSleeve.position.set(-1.65,-1.2,2.7); leftSleeve.rotation.z=-.62; scene.add(leftSleeve);
    const rightSleeve=new THREE.Mesh(new THREE.CylinderGeometry(.34,.46,.95,16),makeMat(0x183c4b,.9));
    rightSleeve.position.set(1.62,-1.15,2.75); rightSleeve.rotation.z=.62; scene.add(rightSleeve);
    capsuleBetween([-1.53,-.95,2.15],[-.75,-.34,1.9],.16,skinMat);
    capsuleBetween([1.52,-.93,2.18],[2.12,-.38,2.08],.16,skinMat);
    const leftGlove=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),gloveMat); leftGlove.position.set(-.73,-.33,1.88); leftGlove.scale.set(1,.8,1.1); scene.add(leftGlove);
    const rightGlove=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),gloveMat); rightGlove.position.set(2.13,-.37,2.06); rightGlove.scale.set(1,.8,1.1); scene.add(rightGlove);
    // Grip fingers and stitched cuff details.
    for(let i=0;i<3;i++){
      capsuleBetween([-0.83+i*.07,-.32-i*.025,1.78],[-.72+i*.07,-.24-i*.025,1.72],.035,stitchMat);
      capsuleBetween([2.04+i*.055,-.37-i*.02,1.96],[2.13+i*.055,-.3-i*.02,1.92],.032,stitchMat);
    }
    const reelSpool=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.09,24),makeMat(0xd4e0df,.2,.85));
    reelSpool.rotation.x=Math.PI/2; reelSpool.position.set(2.18,.2,2.02); scene.add(reelSpool);
    const reelHub=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.13,16),makeMat(0x172a35,.3,.65));
    reelHub.rotation.x=Math.PI/2; reelHub.position.set(2.18,.2,1.94); scene.add(reelHub);

    // A recognizable 3D game fish that approaches the boat during the fight.
    const fish3D=new THREE.Group(); scene.add(fish3D); fish3D.visible=false;
    const fishSilver=makeMat(0x8db8c5,.28,.42), fishDark=makeMat(0x183f59,.32,.25), fishFin=makeMat(0x327b91,.4,.12), fishGold=makeMat(0xd8b66d,.26,.5);
    const fishBody=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),fishSilver); fishBody.scale.set(.92,.35,.32); fish3D.add(fishBody);
    const fishBack=new THREE.Mesh(new THREE.SphereGeometry(1,24,14),fishDark); fishBack.scale.set(.68,.15,.29); fishBack.position.set(-.03,.22,0); fish3D.add(fishBack);
    const tailShape=new THREE.Shape(); tailShape.moveTo(-.65,0); tailShape.lineTo(-1.25,.42); tailShape.lineTo(-1.1,0); tailShape.lineTo(-1.25,-.42); tailShape.closePath();
    const tail=new THREE.Mesh(new THREE.ShapeGeometry(tailShape),fishFin); tail.position.z=0; fish3D.add(tail);
    const dorsal=new THREE.Mesh(new THREE.ConeGeometry(.25,.45,3),fishDark); dorsal.position.set(-.08,.38,0); dorsal.rotation.z=-Math.PI/2; fish3D.add(dorsal);
    const pectoral=new THREE.Mesh(new THREE.ConeGeometry(.18,.38,3),fishGold); pectoral.position.set(.05,-.12,.27); pectoral.rotation.set(.35,0,-.9); fish3D.add(pectoral);
    const eyeWhite=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),makeMat(0xf4f4e8,.3,0)); eyeWhite.position.set(.67,.08,.255); fish3D.add(eyeWhite);
    const eyeBlack=new THREE.Mesh(new THREE.SphereGeometry(.036,10,8),makeMat(0x07121a,.2,0)); eyeBlack.position.set(.705,.08,.3); fish3D.add(eyeBlack);
    const gill=new THREE.Mesh(new THREE.TorusGeometry(.16,.012,6,20,Math.PI),stitchMat); gill.position.set(.42,0,.3); gill.rotation.z=Math.PI/2; fish3D.add(gill);
    fish3D.scale.setScalar(.62); fish3D.position.set(-2.8,.05,-10); fish3D.rotation.y=-.12;
    // Keep the 3D fish synchronized with the existing fishing gameplay states.
    let fishTarget=0, fishBiteAt=0;
    const statusNode=document.getElementById('statusTitle');
    if(statusNode){
      new MutationObserver(()=>{
        const label=(statusNode.textContent||'').toLowerCase();
        if(label.includes('fish on')||label.includes('fighting')||label.includes('reel')){fish3D.visible=true;fishTarget=1;fishBiteAt=clockSafeTime();}
        else if(label.includes('landed')){fish3D.visible=true;fishTarget=2;}
        else if(label.includes('line snapped')){fishTarget=0;setTimeout(()=>{if(fishTarget===0)fish3D.visible=false;},500);}
        else if(label.includes('line in the water')){fishTarget=0;fish3D.visible=false;}
      }).observe(statusNode,{childList:true,subtree:true,characterData:true});
    }
    function clockSafeTime(){return performance.now()/1000;}

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
      rod.rotation.z=Math.sin(t*.8)*.012 + (fishTarget===1 ? Math.sin(t*5)*.055 : 0);
      leftSleeve.rotation.z=-.62+Math.sin(t*1.1)*.018;
      rightSleeve.rotation.z=.62-Math.sin(t*1.1)*.018;
      if(fishTarget===1){
        fish3D.visible=true;
        fish3D.position.x=Math.sin(t*2.2)*1.15;
        fish3D.position.y=.18+Math.sin(t*5.1)*.22;
        fish3D.position.z=-8.4+Math.sin(t*1.7)*.45;
        fish3D.rotation.y=Math.sin(t*2.4)*.35;
        tail.rotation.y=Math.sin(t*12)*.48;
        fish3D.scale.setScalar(.62);
      } else if(fishTarget===2){
        fish3D.visible=true;
        fish3D.position.set(.15,.7,-5.8);
        fish3D.rotation.y=Math.sin(t*2)*.12;
        tail.rotation.y=Math.sin(t*7)*.16;
        fish3D.scale.setScalar(.95+Math.sin(t*3)*.025);
      } else {
        fish3D.position.x=-2.8+Math.sin(t*.7)*.08;
        fish3D.position.y=.05;
        fish3D.position.z=-10;
        tail.rotation.y=Math.sin(t*3)*.12;
      }
      renderer.render(scene,camera);
    });
  } catch (err) {
    console.warn('3D scene could not initialize; keeping the existing fallback scene.', err);
    canvas.remove();
  }
})();