import {
  ActionManager,
  ArcRotateCamera,
  Color3,
  CreateGround,
  Engine,
  ExecuteCodeAction,
  FreeCamera,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders';

class App {
  private scene: Scene | null = null;
  private camera: FreeCamera; // Use FreeCamera instead of ArcRotateCamera
  private player: Mesh | null = null; // To track the player's mesh
  private gravity: Vector3 = new Vector3(0, -9.81, 0);
  private jumpForce: number = 4;
  private isGrounded: boolean = true;
  private velocity: Vector3 = new Vector3(0, 0, 0);
  private spheres: Mesh[] = [];

  constructor() {
    // create the canvas html element and attach it to the webpage
    var canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.padding = '0px';
    canvas.id = 'gameCanvas';
    document.body.appendChild(canvas);

    // initialize babylon scene and engine
    const engine = new Engine(canvas, true);
    this.scene = new Scene(engine);

    // Initialize the FreeCamera
    this.camera = new FreeCamera(
      'Camera',
      new Vector3(0, 5, -10), // Start behind the player
      this.scene
    );
    this.camera.attachControl(canvas, true);
    this.camera.rotation = new Vector3(0, Math.PI, 0); // Camera faces forward by default

    var light1: HemisphericLight = new HemisphericLight(
      'light1',
      new Vector3(1, 1, 0),
      this.scene
    );

    this.scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: false,
    });
    CreateGround('ground', { width: 50, height: 50 }); // center is 0,0 which means it stretches -25 to 25

    this.loadModel().then(() => {
      this.spawnCoins();
    });

    // hide/show the Inspector
    window.addEventListener('keydown', (ev) => {
      // Shift+Ctrl+Alt+I
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.key === 'i') {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
        } else {
          this.scene.debugLayer.show();
        }
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth; // Update width
      canvas.height = window.innerHeight; // Update height
      engine.resize();
    });

    // run the main render loop
    engine.runRenderLoop(() => {
      this.scene.render();
      this.updateCamera(); // Update camera position every frame
      this.applyGravityAndJump();
      this.updateGame();
    });
  }

  private async loadModel() {
    const model = await SceneLoader.ImportMeshAsync(
      null,
      'https://assets.babylonjs.com/meshes/',
      'HVGirl.glb',
      this.scene
    );
    const player = model.meshes[0];
    player.scaling.setAll(0.1);
    this.player = player as Mesh;

    this.player.checkCollisions = true;


    const walkAnim = this.scene.getAnimationGroupByName('Walking');
    const walkBackAnim = this.scene.getAnimationGroupByName('WalkingBack');
    const idleAnim = this.scene.getAnimationGroupByName('Idle');
    const sambaAnim = this.scene.getAnimationGroupByName('Samba');

    const playerWalkSpeed = 0.03;
    const playerRunSpeed = 0.1;
    const playerSpeedBackwards = 0.01;
    const playerRotationSpeed = 0.06;
    const runAnimSpeed = 3;
    const walkBackSpeed = 1;

    let speed;
    let animSpeed;

    let keyStatus = {
      w: false,
      s: false,
      a: false,
      d: false,
      b: false,
      Shift: false,
      ' ': false,
    };

    this.scene.actionManager = new ActionManager(this.scene);

    this.scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (event) => {
        let key = event.sourceEvent.key;
        if (key !== 'Shift') {
          key = key.toLowerCase();
        }
        if (key in keyStatus) {
          keyStatus[key] = true;
        }
        // console.log(keyStatus);
      })
    );

    this.scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (event) => {
        let key = event.sourceEvent.key;
        if (key !== 'Shift') {
          key = key.toLowerCase();
        }
        if (key in keyStatus) {
          keyStatus[key] = false;
        }
      })
    );

    let moving = false;

    this.scene.onBeforeRenderObservable.add(() => {
      let isMoving = false;

      // Check if the 'b' key is pressed for samba animation
      if (keyStatus.b) {
        walkAnim.stop();
        walkBackAnim.stop();
        idleAnim.stop();
        sambaAnim.start(true, 1.0, sambaAnim.from, sambaAnim.to, false);
        return; // Prevent other animations from playing
      }

      // Rotation logic (without forward movement)
      if (keyStatus.a) {
        player.rotate(Vector3.Up(), -playerRotationSpeed); // Rotate left
      }
      if (keyStatus.d) {
        player.rotate(Vector3.Up(), playerRotationSpeed); // Rotate right
      }

      // Movement logic (only moves forward or backward)
      if (keyStatus.w || keyStatus.s) {
        isMoving = true;

        if (keyStatus.s && !keyStatus.w) {
          speed = -playerSpeedBackwards;
          walkBackAnim.start(
            true,
            1,
            walkBackAnim.from,
            walkBackAnim.to,
            false
          );
        } else if (keyStatus.w) {
          speed = keyStatus.Shift ? playerRunSpeed : playerWalkSpeed;
          animSpeed = keyStatus.Shift ? runAnimSpeed : walkBackSpeed;
          walkAnim.speedRatio = animSpeed;
          walkAnim.start(true, animSpeed, walkAnim.from, walkAnim.to, false);
        }

        player.moveWithCollisions(player.forward.scaleInPlace(speed));
      }

      if (!isMoving) {
        idleAnim.start(true, 1.0, idleAnim.from, idleAnim.to, false);
        walkAnim.stop();
        walkBackAnim.stop();
      }

      if (keyStatus[' '] && this.isGrounded) {
        console.log('Jumping');
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
      }
    });
  }

  private applyGravityAndJump() {
    if (this.player) {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      // Apply gravity when not grounded
      if (!this.isGrounded) {
        this.velocity = this.velocity.add(this.gravity.scale(deltaTime));
      }

      // Move player by velocity
      this.player.moveWithCollisions(this.velocity.scale(deltaTime));

      //Check if the player is grounded (by checking for a collision)
      if (this.player.position.y <= 0.1) {
        this.isGrounded = true;
        this.velocity.y = 0;
      }
    }
  }

  // Update camera to follow the player from behind
  private updateCamera() {
    if (this.player) {
      const followDistance = 10; // Distance behind the player
      const cameraHeight = 5; // Height of the camera from the ground

      // Position the camera behind the player
      const backward = this.player.forward.scale(-followDistance);
      const cameraPosition = this.player.position.add(backward);
      this.camera.position = new Vector3(
        cameraPosition.x,
        cameraHeight,
        cameraPosition.z
      );

      // Ensure the camera looks at the player
      this.camera.setTarget(this.player.position);
    }
  }

  // Spawn coins
  private spawnCoins() {
    const groundWidth = 50;
    const groundHeight = 50;
    const coinColor = new StandardMaterial('standardMat', this.scene);
    coinColor.diffuseColor = new Color3(0.93, 0.78, 0.25); // base (diffuse) color
    coinColor.specularColor = new Color3(1, 1, 1); // specular color to white for bright reflection
    coinColor.specularPower = 96; // adjust the specular power to control the sharpness of highlights
    coinColor.emissiveColor = new Color3(0.05, 0.05, 0.0); // Subtle yellow glow

    for (let i = 0; i < 100; i++) {
      const sphere: Mesh = MeshBuilder.CreateSphere(
        `coin_${i}`,
        { diameterX: 0.2, diameterY: 1, diameterZ: 0.6 },
        this.scene
      );
      sphere.position.x = Math.random() * groundWidth - groundWidth / 2;
      sphere.position.z = Math.random() * groundHeight - groundHeight / 2;
      sphere.position.y = 0.25;
      sphere.material = coinColor;


      this.spheres.push(sphere);
    }
  }

  private updateGame() {
    if (!this.player) return;

    this.spheres = this.spheres.filter((sphere) => {
      if (sphere.intersectsMesh(this.player, false)) {
        sphere.dispose();
        return false; // remove the sphere from the array
      }
      return true; // keep tge sphere
    });
  }
}

new App();
