// Threelet - https://github.com/w3reality/threelet
// A three.js scene viewer with batteries (MIT License)

const __version = "0.9.6dev";

// credits: VRControlHelper is based on the dragging example -
// https://github.com/mrdoob/three.js/blob/master/examples/webvr_dragging.html
class VRControlHelper {
    constructor(renderer) {
        // this.controllerArmLength = 0;
        this.controllerArmLength = 0.25;
        this.controllerLineLength = 5;

        this.tempMatrix = new THREE.Matrix4();
        this.raycaster = new THREE.Raycaster();
        this.intersected = [];

        this.group = new THREE.Group();

        this.controllers = this._createControllers(renderer);
        this.controllersState = {
            touchpads: [],
            triggers: [],
            poses: [],
            ids: [],
        }

        this._eventListeners = {};
    }
    getInteractiveGroup() { return this.group; }
    getControllers() { return this.controllers; }
    getControllersState() { return this.controllersState; }

    updateTriggerPressVisibility(i, tf) {
        this.controllers[i].getObjectByName('trigger-press').visible = tf;
    }
    updateTouchpadPointVisibility(i, type, tf) {
        const obj = this.controllers[i].getObjectByName(`touchpad-${type}`);
        obj.visible = tf;
        if (tf === false) {
            obj.position.z = 99999; // kludge: workaround flickering
        }
    }
    updateTouchpadPoint(i, type) {
        const touchpad = this.controllersState.touchpads[i];
        const obj = this.controllers[i].getObjectByName(`touchpad-${type}`);
        obj.position.set(touchpad.axes0 * 0.025, 0.0125,
            touchpad.axes1 * 0.025 - this.controllerArmLength - 0.025);
    }
    _createControllers(renderer) {
        // maybe load a 3D model instead of the box
        // https://github.com/mrdoob/three.js/blob/master/examples/webvr_paint.html
        const walls = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(0.05, 0.025, 0.1)),
            new THREE.LineBasicMaterial({color: 0xcccccc}));
        walls.position.set(0, 0, - this.controllerArmLength); // customize Z for "arm" length

        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)]),
            new THREE.LineBasicMaterial({color: 0xcccccc}));
        line.position.set(0, 0, - this.controllerArmLength);
        line.name = 'controller-line';
        line.scale.z = this.controllerLineLength - this.controllerArmLength;

        const triggerLoop = new THREE.LineLoop(
            new THREE.CircleGeometry(0.0125, 64),
            new THREE.LineBasicMaterial({color: 0xcccccc}));
        triggerLoop.geometry.vertices.shift(); // remove the center vertex
        triggerLoop.position.set(0, 0, - this.controllerArmLength - 0.05);

        const triggerCircle = new THREE.Mesh(
            new THREE.CircleGeometry(0.0125, 64),
            new THREE.MeshBasicMaterial({color: 0x00cccc}));
        triggerCircle.position.set(0, 0, - this.controllerArmLength - 0.05);
        triggerCircle.material.side = THREE.DoubleSide;
        triggerCircle.visible = false;
        triggerCircle.name = 'trigger-press';

        const padLoop = new THREE.LineLoop(
            new THREE.CircleGeometry(0.025, 64),
            new THREE.LineBasicMaterial({color: 0xcccccc}));
        padLoop.geometry.vertices.shift(); // remove the center vertex
        padLoop.position.set(0, 0.0125, - this.controllerArmLength - 0.025);
        padLoop.rotation.x = Math.PI/2;

        const padLoopTouch = new THREE.LineLoop(
            new THREE.CircleGeometry(0.005, 64),
            new THREE.LineBasicMaterial({color: 0x00cccc}));
        padLoopTouch.geometry.vertices.shift(); // remove the center vertex
        padLoopTouch.position.set(0, 0.0125, - this.controllerArmLength - 0.025);
        padLoopTouch.rotation.x = Math.PI/2;
        padLoopTouch.visible = false;
        padLoopTouch.name = 'touchpad-touch';

        const padCircleTouch = new THREE.Mesh(
            new THREE.CircleGeometry(0.005, 64),
            new THREE.MeshBasicMaterial({color: 0x00cccc}));
        padCircleTouch.position.set(0, 0.0125, - this.controllerArmLength - 0.025);
        padCircleTouch.rotation.x = Math.PI/2;
        padCircleTouch.material.side = THREE.DoubleSide;
        padCircleTouch.visible = false;
        padCircleTouch.name = 'touchpad-press';

        // https://github.com/mrdoob/three.js/blob/master/examples/webvr_dragging.html
        const controllers = [0, 1].map(i => renderer.vr.getController(i)
            .add(walls.clone())
            .add(line.clone())
            .add(triggerLoop.clone())
            .add(triggerCircle.clone())
            .add(padLoop.clone())
            .add(padLoopTouch.clone())
            .add(padCircleTouch.clone()));
        console.log('@@ controllers:', controllers);

        if (0) { // debug!! force show cont0 in desktop mode
            this.group.add(controllers[0]);
            controllers[0].visible = true;
        }

        return controllers;
    }

    _addSelectListener(eventName, listener) {
        this.controllers.forEach(cont => {
            cont.addEventListener(eventName, listener.bind(this));
        });
    }

    enableDragInteractiveGroup() {
        this._addSelectListener('selectstart', this.onSelectStartDrag);
        this._addSelectListener('selectend', this.onSelectEndDrag);
    }
    onSelectStartDrag( event ) {
        const controller = event.target;
        const intersections = this.getIntersections( controller, false );
        console.log('@@ onSelectStart(): intersections.length:', intersections.length);

        if ( intersections.length > 0 ) {
            const intersection = intersections[ 0 ];

            this.tempMatrix.getInverse( controller.matrixWorld );

            const object = intersection.object;
            object.matrix.premultiply( this.tempMatrix );
            object.matrix.decompose( object.position, object.quaternion, object.scale );
            if (object.material.emissive) {
                object.material.emissive.b = 1;
            }
            controller.add( object );

            controller.userData.selected = object;
        }
    }

    onSelectEndDrag( event ) {
        console.log('@@ onSelectEnd(): hi');
        const controller = event.target;
        if ( controller.userData.selected !== undefined ) {
            const object = controller.userData.selected;
            object.matrix.premultiply( controller.matrixWorld );
            object.matrix.decompose( object.position, object.quaternion, object.scale );
            if (object.material.emissive) {
                object.material.emissive.b = 0;
            }
            this.group.add( object );

            controller.userData.selected = undefined;
        }
    }

    getIntersections(controller, recursive=true) {
        // console.log('@@ getIntersections(): hi');
        this.tempMatrix.identity().extractRotation( controller.matrixWorld );
        this.raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
        this.raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( this.tempMatrix );
        return this.raycaster.intersectObjects( this.group.children, recursive );
    }

    // mod of findGamepad() of three.js r104
    static _findGamepad(id) {
        const gamepads = navigator.getGamepads && navigator.getGamepads();
        for ( let i = 0, j = 0, l = gamepads.length; i < l; i ++ ) {
            const gamepad = gamepads[ i ];
            if ( gamepad && ( gamepad.id === 'Daydream Controller' ||
                gamepad.id === 'Gear VR Controller' || gamepad.id === 'Oculus Go Controller' ||
                gamepad.id === 'OpenVR Gamepad' || gamepad.id.startsWith( 'Oculus Touch' ) ||
                gamepad.id.startsWith( 'Spatial Controller' ) ) ) {
                if ( j === id ) return gamepad;
                j ++;
            }
        }
    }
    // mod of updateControllers() of three.js r104
    updateControllers() {
        const stat = this.controllersState;

        for (let i = 0; i < this.controllers.length; i ++ ) {
            const controller = this.controllers[i];
            const gamepad = VRControlHelper._findGamepad(i);
            // console.log('@@ updateControllers(): i, gamepad:', i, gamepad);

            if (gamepad === undefined ||
                gamepad.pose === undefined ||
                gamepad.pose === null) {
                // this controller seems lost; reset the state
                stat.triggers[i] = undefined;
                stat.touchpads[i] = undefined;
                stat.poses[i] = undefined;
                stat.ids[i] = undefined;
                return;
            }

            const buttonId = gamepad.id === 'Daydream Controller' ? 0 : 1; // for trigger
            const buttonIdTouchpad = 0;

            stat.poses[i] = gamepad.pose;
            stat.ids[i] = gamepad.id;

            if (0) { // debug with Oculus Go controller
                const [b0, b1] = gamepad.buttons; // touchpad, trigger in case of Oculus Go
                if (b0.pressed || b0.touched || b1.pressed || b1.touched) {
                    console.log('@@ ======== pressed/touched ========');
                    console.log('@@ i, b0, b1:', i, b0, b1);
                    // @@ observations on Oculus Go (always i == 0)
                    // b0 (touchpad) {pressed: false, value: 0, touched: true}
                    // b0 (touchpad) {pressed: true, value: 1, touched: true}
                    // b1 (trigger) {pressed: true, value: 1, touched: true}
                    console.log('@@ gamepad.axes:', gamepad.axes);
                    //             axes[1]=-1.0
                    // axes[0]=-1.0            axes[0]=+1.0
                    //             axes[1]=+1.0
                    //----
                    console.log('@@ gamepad:', gamepad);
                }
            }

            //-------- begin touchpad handling --------
            const touched = gamepad.buttons[buttonIdTouchpad].touched;
            const pressed = gamepad.buttons[buttonIdTouchpad].pressed;
            const axes0 = gamepad.axes[0];
            const axes1 = gamepad.axes[1];

            if (stat.touchpads[i] === undefined) {
                stat.touchpads[i] = {
                    touched: false,
                    pressed: false,
                    axes0: 0,
                    axes1: 0,
                };
            };
            const touchpad = stat.touchpads[i];

            if (touchpad.touched !== touched) {
                const func = touched === true ?
                    this._eventListeners['vr-touchpad-touch-start'] :
                    this._eventListeners['vr-touchpad-touch-end'];
                if (func) func(i, axes0, axes1);
            }

            if (touchpad.pressed !== pressed) {
                const func = pressed === true ?
                    this._eventListeners['vr-touchpad-press-start'] :
                    this._eventListeners['vr-touchpad-press-end'];
                if (func) func(i, axes0, axes1);
            }

            // diff touchpad states done; record the new state now
            touchpad.touched = touched;
            touchpad.pressed = pressed;
            touchpad.axes0 = axes0;
            touchpad.axes1 = axes1;
            //-------- end touchpad handling --------

            const trigger = gamepad.buttons[buttonId].pressed;

            if (stat.triggers[i] === undefined) stat.triggers[i] = false;

            if (stat.triggers[i] !== trigger) {
                stat.triggers[i] = trigger;
                const func = stat.triggers[i] === true ?
                    this._eventListeners['vr-trigger-press-start'] :
                    this._eventListeners['vr-trigger-press-end'];
                if (func) func(i);
            }
        }
    }

    intersectObjects() {
        this._cleanIntersected();
        if (this.controllers[0]) {
            this._intersectObjects(this.controllers[0]);
        }
        if (this.controllers[1]) {
            this._intersectObjects(this.controllers[1]);
        }
    }
    _intersectObjects( controller ) {
        // console.log('@@ intersectObjects(): hi');
        // Do not highlight when already selected
        if ( controller.userData.selected !== undefined ) return;

        const intersections = this.getIntersections( controller );
        // console.log('@@ intersections:', intersections);

        const line = controller.getObjectByName( 'controller-line' );
        if ( intersections.length > 0 ) {
            const intersection = intersections[ 0 ];
            const object = intersection.object;
            if (object.material.emissive) {
                object.material.emissive.r = 1;
            }
            this.intersected.push( object );
            // console.log('@@ intersection.distance:', intersection.distance);
            line.scale.z = intersection.distance - this.controllerArmLength;
        } else {
            line.scale.z = this.controllerLineLength - this.controllerArmLength;
        }
    }

    _cleanIntersected() {
        // console.log('@@ cleanIntersected(): hi');
        while ( this.intersected.length ) {
            const object = this.intersected.pop();
            if (object.material.emissive) {
                object.material.emissive.r = 0;
            }
        }
    }

    static createTestHemisphereLight() {
        return new THREE.HemisphereLight(0x808080, 0x606060);
    }
    static createTestDirectionalLight() {
        const light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0, 6, 0 );
        light.castShadow = true;
        light.shadow.camera.top = 2;
        light.shadow.camera.bottom = - 2;
        light.shadow.camera.right = 2;
        light.shadow.camera.left = - 2;
        light.shadow.mapSize.set( 4096, 4096 );
        return light;
    }
    static createTestObjects() {
        const objs = [];
        const geoms = [
            new THREE.BoxBufferGeometry( 0.2, 0.2, 0.2 ),
            new THREE.ConeBufferGeometry( 0.2, 0.2, 64 ),
            new THREE.CylinderBufferGeometry( 0.2, 0.2, 0.2, 64 ),
            new THREE.IcosahedronBufferGeometry( 0.2, 3 ),
            new THREE.TorusBufferGeometry( 0.2, 0.04, 64, 32 )
        ];
        for (let geom of geoms) {
            const object = new THREE.Mesh(geom,
                new THREE.MeshStandardMaterial({
                    color: Math.random() * 0xffffff,
                    roughness: 0.7,
                    metalness: 0.0
                }));
            object.position.set(2*Math.random(), 2*Math.random(), -1);
            // console.log('@@ object:', object);
            object.rotation.x = Math.random() * 2 * Math.PI;
            object.rotation.y = Math.random() * 2 * Math.PI;
            object.rotation.z = Math.random() * 2 * Math.PI;
            object.scale.setScalar( Math.random() + 0.5 );
            object.castShadow = true;
            object.receiveShadow = true;
            objs.push(object);
        }
        return objs;
    }
}

// credits: SkyHelper is based on the sky example -
// https://github.com/mrdoob/three.js/blob/master/examples/webgl_shaders_sky.html
class SkyHelper {
    constructor(classSky) {
        this._classSky = classSky;
        this._effectController = {
            turbidity: 10,
            rayleigh: 2,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8,
            luminance: 1,
            inclination: 0.49, // elevation / inclination
            azimuth: 0.25, // Facing front,
            sun: ! true
        };
        this._updateUniforms = null;
    }

    init() {
        // Add Sky
        const sky = new this._classSky();
        sky.scale.setScalar( 450000 );
        // scene.add( sky );
        // Add Sun Helper
        const sunSphere = new THREE.Mesh(
            new THREE.SphereBufferGeometry( 20000, 16, 8 ),
            new THREE.MeshBasicMaterial( { color: 0xffffff } )
        );
        sunSphere.position.y = - 700000;
        sunSphere.visible = false;
        // scene.add( sunSphere );
        /// GUI
        var distance = 400000;

        // function guiChanged() {
        //-------
        this._updateUniforms = () => {
            const effectController = this._effectController;

            var uniforms = sky.material.uniforms;
            uniforms[ "turbidity" ].value = effectController.turbidity;
            uniforms[ "rayleigh" ].value = effectController.rayleigh;
            uniforms[ "luminance" ].value = effectController.luminance;
            uniforms[ "mieCoefficient" ].value = effectController.mieCoefficient;
            uniforms[ "mieDirectionalG" ].value = effectController.mieDirectionalG;
            var theta = Math.PI * ( effectController.inclination - 0.5 );
            var phi = 2 * Math.PI * ( effectController.azimuth - 0.5 );
            sunSphere.position.x = distance * Math.cos( phi );
            sunSphere.position.y = distance * Math.sin( phi ) * Math.sin( theta );
            sunSphere.position.z = distance * Math.sin( phi ) * Math.cos( theta );
            sunSphere.visible = effectController.sun;
            uniforms[ "sunPosition" ].value.copy( sunSphere.position );
            // renderer.render( scene, camera );
        };

        // var gui = new dat.GUI();
        // gui.add( effectController, "turbidity", 1.0, 20.0, 0.1 ).onChange( guiChanged );
        // gui.add( effectController, "rayleigh", 0.0, 4, 0.001 ).onChange( guiChanged );
        // gui.add( effectController, "mieCoefficient", 0.0, 0.1, 0.001 ).onChange( guiChanged );
        // gui.add( effectController, "mieDirectionalG", 0.0, 1, 0.001 ).onChange( guiChanged );
        // gui.add( effectController, "luminance", 0.0, 2 ).onChange( guiChanged );
        // gui.add( effectController, "inclination", 0, 1, 0.0001 ).onChange( guiChanged );
        // gui.add( effectController, "azimuth", 0, 1, 0.0001 ).onChange( guiChanged );
        // gui.add( effectController, "sun" ).onChange( guiChanged );
        // guiChanged();
        //--------
        this._updateUniforms(); // first time
        return [sky, sunSphere];
    }

    updateUniforms(params={}) {
        if (! this._updateUniforms) {
            throw 'updateUniforms(): error; init() must be called first'
        }
        Object.assign(this._effectController, params);
        this._updateUniforms();
    }
}

class Threelet {
    constructor(params) {
        this.version = __version;
        const defaults = {
            canvas: null,
            optScene: null,
            optCameraPosition: [0, 1, 2],
            optClassStats: null,
            optStatsPenel: 0, // 0: fps, 1: ms, 2: mb, 3+: custom
            optClassControls: null,
            optClassWebVR: null,
            optClassSky: null,
        };
        const actual = Object.assign({}, defaults, params);

        const canvas = actual.canvas;
        if (! canvas) {
            throw 'error: canvas not provided';
        }
        // kludge for mouse events and overlay
        canvas.style.display = 'block'; // https://stackoverflow.com/questions/8600393/there-is-a-4px-gap-below-canvas-video-audio-elements-in-html5

        // basics
        [this.camera, this.scene, this.renderer, this.render, this.controls] =
            Threelet._initBasics(canvas, actual);

        // events
        this._eventListeners = {};
        this._eventListenerNames = [
            // TODO add keyboard events
            'mouse-down', // alias of 'mouse-down-left'
            'mouse-down-left',
            'mouse-down-middle',
            'mouse-down-right',
            'mouse-click', // alias of 'mouse-click-left'
            'mouse-click-left',
            'mouse-click-middle',
            'mouse-click-right',
            'mouse-move',
            'mouse-drag-end',
            'vr-touchpad-touch-start',
            'vr-touchpad-touch-end',
            'vr-touchpad-press-start',
            'vr-touchpad-press-end',
            'vr-trigger-press-start',
            'vr-trigger-press-end',
        ];

        //======== FIXME - Oculus Go's desktop mode, OrbitControls breaks mouse events...
        this._initMouseListeners(this.renderer.domElement);
        //======== below is this too hackish and still not sure how to trigger
        //         mouse events for *both* overlay and canvas
        // this._initMouseListeners(document.querySelector('#overlay'));
        // <!-- https://stackoverflow.com/questions/5763911/placing-a-div-within-a-canvas -->
        // <style>
        //     #canvas-wrap { position:relative } /* Make this a positioned parent */
        //     #overlay {
        //         position: absolute;
        //         top: 0px; left: 0px; width: 100%; height: 50%;
        //         background-color: #88000088; /* debug */
        //         /* pointer-events: none; */
        //     }
        // </style>
        // <div id="canvas-wrap">
        //   <canvas id="canvas" style="width: 100%; height: 100%;"></canvas>
        //   <div id="overlay"></div>
        // </div>

        // raycasting
        this._raycaster = new THREE.Raycaster();;

        // rendering loop and scene logic update
        this.clock = new THREE.Clock();
        this.timeLast = this.clock.getElapsedTime();
        this.iid = null;
        this.update = null;

        // WebVR related stuff
        this.fpsDesktopLast = 0;

        // // dragging with controllers ======================
        this.vrcHelper = new VRControlHelper(this.renderer);
        if (actual.optClassWebVR) {
            this._initVR(actual.optClassWebVR);

            if (Threelet.isVrSupported()) {
                this.vrcHelper.getControllers()
                    .forEach(cont => this.scene.add(cont));
            }
        }

        // // https://stackoverflow.com/questions/49471653/in-three-js-while-using-webvr-how-do-i-move-the-camera-position
        // this.dolly = new THREE.Group();
        // this.dolly.add(this.camera);

        // sky stuff
        this.skyHelper = null;
        if (actual.optClassSky) {
            this.skyHelper = new SkyHelper(actual.optClassSky);
            console.log('@@ this.skyHelper:', this.skyHelper);
        }

        // api
        this.onCreate();
    }
    onCreate() {
        this.render(); // first time
    }
    onDestroy() {
        // TODO ??
    }

    getSkyHelper() { return this.skyHelper; }
    setupSky() {
        if (! THREE.Sky) {
            throw 'setupSky(): error; forgot to load Sky.js?';
            return;
        }
        this.scene.add(...this.skyHelper.init());
        this.skyHelper.updateUniforms({
            turbidity: 1,
        });
    }

    setupVRControlHelperTest() {
        this.scene.add(VRControlHelper.createTestHemisphereLight());
        this.scene.add(VRControlHelper.createTestDirectionalLight());

        const group = this.vrcHelper.getInteractiveGroup();
        VRControlHelper.createTestObjects().forEach(obj => group.add(obj));
        this.scene.add(group);

        this.vrcHelper.enableDragInteractiveGroup();
    }
    getVRControlHelper() {
        return this.vrcHelper;
    }

    static isVrSupported() {
        // https://github.com/mrdoob/three.js/blob/dev/examples/js/vr/WebVR.js
        return 'getVRDisplays' in navigator;
    }
    _initButtonVR(optClassWebVR) {
        const btn = optClassWebVR.createButton(this.renderer);
        btn.style.top = btn.style.bottom;
        btn.style.bottom = '';
        document.body.appendChild(btn);
        if (Threelet.isVrSupported()) {
            btn.addEventListener('click', ev => {
                console.log('@@ btn.textContent:', btn.textContent);
                if (btn.textContent.startsWith('ENTER')) {
                    this.enterVR(() => { // onError
                        console.log('@@ device:', this.renderer.vr.getDevice());
                        console.log('@@ controller:', this.renderer.vr.getController(0));
                        // TODO (how to programmatically exit the VR session????)
                        // this.updateLoop(this.fpsDesktopLast); // wanna call this after exiting the vr session...
                    });
                }
            });
        }
    }

    _initVR(optClassWebVR) {
        // console.log('@@ optClassWebVR:', optClassWebVR);
        // https://threejs.org/docs/manual/en/introduction/How-to-create-VR-content.html
        this.renderer.vr.enabled = Threelet.isVrSupported();
        this._initButtonVR(optClassWebVR);
    }

    enterVR(onError=null) {
        // try entering VR for at most tryCountMax * delay (ms)
        const tryCountMax = 10, delay = 400;
        let tryCount = 0;
        const _enterVR = () => {
            setTimeout(() => {
                tryCount++;
                if (this.renderer.vr.isPresenting()) {
                    console.log(`@@ transition to vr loop!! (tryCount: ${tryCount})`);
                    this.updateLoop(-1);
                } else {
                    console.log(`@@ vr not ready after: ${tryCount*delay} ms (tryCount: ${tryCount})`);
                    if (tryCount < tryCountMax) {
                        _enterVR(tryCountMax, delay); // try harder
                    } else if (onError) {
                        console.error('@@ enter vr failed!!')
                        onError();
                    }
                }
            }, delay); // need some delay for this.renderer.vr.isPresenting() to become true
        };

        this.updateLoop(0); // first, make sure desktop loop is stopped
        _enterVR(tryCountMax, delay);
    }

    updateMechanics() { // update for the scene logic
        const time = this.clock.getElapsedTime();
        const dt = time - this.timeLast;
        this.timeLast = time;
        if (this.update) {
            this.update(time, dt);
        }
    }

    updateLoop(fps) {
        if (this.iid !== null) {
            // console.log('@@ updateLoop(): clearing interval:', this.iid);
            clearInterval(this.iid);
        }

        if (fps === 0) {
            return; // stop the loop
        } else if (fps < 0) { // start the vr loop
            this.renderer.setAnimationLoop(() => {
                if (! this.renderer.vr.isPresenting()) {
                    this.renderer.setAnimationLoop(null); // stop the vr loop
                    console.log('@@ transition back to desktop');
                    // console.log('fps last:', this.fpsDesktopLast);
                    return this.updateLoop(this.fpsDesktopLast);
                }

                this.updateMechanics();
                this.vrcHelper.intersectObjects();
                this.vrcHelper.updateControllers();
                this.render(true);
            });
            return;
        }

        // FIXME for this naive dev version, not looping with rAF()...
        this.fpsDesktopLast = fps;
        this.iid = setInterval(() => {
            this.updateMechanics();
            this.render();
        }, 1000/fps);
        // console.log('@@ updateLoop(): new interval:', this.iid);
    }

    static _initBasics(canvas, opts) {
        const {optScene, optClassStats, optStatsPenel, optClassControls} = opts;

        const camera = new THREE.PerspectiveCamera(75, canvas.width/canvas.height, 0.001, 1000);
        camera.position.set(...opts.optCameraPosition);
        camera.up.set(0, 1, 0); // important for OrbitControls

        const renderer = new THREE.WebGLRenderer({
            // alpha: true,
            canvas: canvas,
        });
        console.log('renderer:', renderer);

        const resizeCanvas = (force=false) => {
            Threelet._resizeCanvasToDisplaySize(
                renderer, canvas, camera, force);
        };
        resizeCanvas(true); // first time

        // init basic objects --------
        const scene = optScene ? optScene : new THREE.Scene();
        const walls = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({color: 0xcccccc}));
        walls.position.set(0, 0, 0);
        walls.name = 'walls';
        scene.add(walls);
        const axes = new THREE.AxesHelper(1);
        axes.name = 'axes';
        scene.add(axes);

        // init render stuff --------
        let stats = null;
        if (optClassStats) {
            stats = new optClassStats();
            stats.showPanel(optStatsPenel);
            const statsDom = stats.dom;
            // statsDom.style.top = '90%';
            document.body.appendChild(statsDom);
        }
        const render = (isPresenting=false) => {
            // console.log('@@ render(): isPresenting:', isPresenting);
            if (stats) { stats.update(); }
            if (! isPresenting) { resizeCanvas(); }
            renderer.render(scene, camera);
        };

        let controls = null;
        if (optClassControls) {
            controls = new optClassControls(camera, renderer.domElement);
            controls.addEventListener('change', render.bind(null, false));
            if (Threelet.isVrSupported()) {
                // FIXME - OrbitControl breaks _initMouseListeners() on Oculus Go
                console.warn('not enabling OrbitControls (although requested) on this VR-capable browser.');
                controls.enabled = false; // https://stackoverflow.com/questions/20058579/threejs-disable-orbit-camera-while-using-transform-control
            }
        }

        return [camera, scene, renderer, render, controls];
    }

    // log with time splits
    log(...args) {
        if (! this._last) { // first time
            this._last = performance.now()/1000;
        }
        let now = performance.now()/1000;
        console.log(`==== ${now.toFixed(3)} +${(now - this._last).toFixed(3)} ====`);
        console.log(...args);
        console.log(`========`);
        this._last = now;
    }

    // TODO freeRendererAndScenes()

    // https://stackoverflow.com/questions/29884485/threejs-canvas-size-based-on-container
    static _resizeCanvasToDisplaySize(renderer, canvas, camera, force=false) {
        let width = canvas.clientWidth;
        let height = canvas.clientHeight;

        // adjust displayBuffer size to match
        if (force || canvas.width != width || canvas.height != height) {
            // you must pass false here or three.js sadly fights the browser
            // console.log "resizing: #{canvas.width} #{canvas.height} -> #{width} #{height}"
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
    };

    // deprecated; for compat only
    setEventListener(eventName, listener) { this.on(eventName, listener); }

    on(eventName, listener) {
        if (this._eventListenerNames.includes(eventName)) {
            // aliases
            if (eventName === 'mouse-down') eventName = 'mouse-down-left';
            if (eventName === 'mouse-click') eventName = 'mouse-click-left';

            const listeners = eventName.startsWith('vr-') ?
                this.vrcHelper._eventListeners : this._eventListeners;
            listeners[eventName] = listener;
        } else {
            console.error('@@ on(): unsupported eventName:', eventName);
        }
    }
    _initMouseListeners(canvas) {
        // https://stackoverflow.com/questions/6042202/how-to-distinguish-mouse-click-and-drag
        let isDragging = false; // in closure
        canvas.addEventListener("mousedown", e => {
            isDragging = false;
            const coords = Threelet.getMouseCoords(e, canvas);
            // console.log('@@ mouse down:', ...coords);
            if (e.button === 0) {
                if (this._eventListeners['mouse-down-left']) {
                    this._eventListeners['mouse-down-left'](...coords);
                }
            } else if (e.button === 1) {
                if (this._eventListeners['mouse-down-middle']) {
                    this._eventListeners['mouse-down-middle'](...coords);
                }
            } else if (e.button === 2) {
                if (this._eventListeners['mouse-down-right']) {
                    this._eventListeners['mouse-down-right'](...coords);
                }
            }
        }, false);
        canvas.addEventListener("mousemove", e => {
            isDragging = true;
            const coords = Threelet.getMouseCoords(e, canvas);
            // console.log('@@ mouse move:', ...coords);
            if (this._eventListeners['mouse-move']) {
                this._eventListeners['mouse-move'](...coords);
            }
        }, false);
        canvas.addEventListener("mouseup", e => {
            // console.log('e:', e);
            const coords = Threelet.getMouseCoords(e, canvas);
            if (isDragging) {
                // console.log("mouseup: drag");
                if (this._eventListeners['mouse-drag-end']) {
                    this._eventListeners['mouse-drag-end'](...coords);
                }
            } else {
                // console.log("mouseup: click");
                if (e.button === 0) {
                    // console.log('@@ mouse click left:', ...coords);
                    if (this._eventListeners['mouse-click-left']) {
                        this._eventListeners['mouse-click-left'](...coords);
                    }
                } else if (e.button === 1) {
                    if (this._eventListeners['mouse-click-middle']) {
                        this._eventListeners['mouse-click-middle'](...coords);
                    }
                } else if (e.button === 2) {
                    // console.log('@@ mouse click right:', ...coords);
                    if (this._eventListeners['mouse-click-right']) {
                        this._eventListeners['mouse-click-right'](...coords);
                    }
                }
            }
        }, false);
    }

    _raycast(meshes, recursive, faceExclude) {
        const isects = this._raycaster.intersectObjects(meshes, recursive);
        if (faceExclude) {
            for (let i = 0; i < isects.length; i++) {
                if (isects[i].face !== faceExclude) {
                    return isects[i];
                }
            }
            return null;
        }
        return isects.length > 0 ? isects[0] : null;
    }
    _raycastFromMouse(mx, my, width, height, cam, meshes, recursive=false) {
        const mouse = new THREE.Vector2( // normalized (-1 to +1)
            (mx / width) * 2 - 1,
            - (my / height) * 2 + 1);
        // https://threejs.org/docs/#api/core/Raycaster
        // update the picking ray with the camera and mouse position
        this._raycaster.setFromCamera(mouse, cam);
        return this._raycast(meshes, recursive, null);
    }
    raycast(origin, direction, meshes, recursive=false, faceExclude=null) {
        this._raycaster.set(origin, direction);
        return this._raycast(meshes, recursive, faceExclude);
    }
    raycastFromMouse(mx, my, meshes, recursive=false) {
        const {width, height} = this.renderer.domElement;
        return this._raycastFromMouse(
            mx, my, width, height, this.camera,
            meshes, recursive);
    }

    static freeObjects(scene, namePrefix) {
        // https://stackoverflow.com/questions/35060831/how-to-remove-all-mesh-objects-from-the-scene-in-three-js
        for (let i = scene.children.length - 1; i >= 0; i--) {
            let ch = scene.children[i];
            if (ch.name.startsWith(namePrefix)) {
                scene.remove(ch);
                Threelet.disposeObject(ch);
            }
        }
    }
    static disposeMaterial(mat) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
    }
    static disposeObject(obj) { // https://gist.github.com/j-devel/6d0323264b6a1e47e2ee38bc8647c726
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) Threelet.disposeMaterial(obj.material);
        if (obj.texture) obj.texture.dispose();
    }

    static getMouseCoords(e, canvas) {
        // https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element/18053642#18053642
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // console.log('getMouseCoords():', mx, my, canvas.width, canvas.height);
        return [mx, my];
    }
}

Threelet.VRControlHelper = VRControlHelper;
Threelet.SkyHelper = SkyHelper;

export default Threelet;