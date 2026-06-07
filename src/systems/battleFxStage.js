export class BattleFxStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.ready = false;
    this.enemy = null;
    this.enemyColor = 0x58a6ff;

    if (!container || !window.Phaser) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width || 360));
    const height = Math.max(120, Math.floor(bounds.height || 150));
    const owner = this;

    class BattleFxScene extends window.Phaser.Scene {
      constructor() {
        super({ key: 'BattleFxScene' });
      }

      create() {
        owner.scene = this;
        owner.ready = true;
        this.enemyIcon = null;
        this.enemyImage = null;
        this.enemyImageKey = null;
        this.enemyCore = null;
        this.enemyRing = null;
        this.enemyGlow = null;
        this.enemyOrbit = null;
        this.scanLines = [];
        this.buildStage();
        owner.setEnemy(owner.enemy);
      }

      buildStage() {
        const { width: w, height: h } = this.scale;
        this.add.rectangle(w / 2, h / 2, w, h, 0x0d1117, 0.6);

        for (let x = 0; x <= w; x += 28) {
          this.add.line(0, 0, x, 0, x, h, 0x58a6ff, 0.08).setOrigin(0);
        }
        for (let y = 0; y <= h; y += 28) {
          this.add.line(0, 0, 0, y, w, y, 0x3fb950, 0.06).setOrigin(0);
        }

        for (let i = 0; i < 18; i++) {
          const dot = this.add.circle(
            Math.random() * w,
            Math.random() * h,
            window.Phaser.Math.Between(1, 2),
            0x58a6ff,
            0.35
          );
          this.tweens.add({
            targets: dot,
            y: dot.y - window.Phaser.Math.Between(12, 36),
            alpha: { from: 0.15, to: 0.55 },
            duration: window.Phaser.Math.Between(1400, 2600),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }

    this.game = new window.Phaser.Game({
      type: window.Phaser.AUTO,
      parent: container,
      width,
      height,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      scene: BattleFxScene,
      scale: {
        mode: window.Phaser.Scale.NONE,
      },
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  resize() {
    if (!this.game || !this.container) return;
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width || 360));
    const height = Math.max(120, Math.floor(bounds.height || 150));
    this.game.scale.resize(width, height);
    this.setEnemy(this.enemy);
  }

  getEnemyAnchor() {
    if (!this.scene) return { x: 0, y: 0 };
    return {
      x: this.scene.scale.width * 0.5,
      y: this.scene.scale.height * 0.42,
    };
  }

  setEnemy(enemy) {
    this.enemy = enemy;
    if (!this.ready || !this.scene || !enemy) return;
    const s = this.scene;
    const w = s.scale.width;
    const { x, y } = this.getEnemyAnchor();
    const tier = enemy.tier || 1;
    const color = tier >= 3 ? 0xf85149 : tier === 2 ? 0xf0883e : 0x58a6ff;
    this.enemyColor = color;

    if (!s.enemyCore) {
      s.enemyGlow = s.add.circle(x, y, 58, color, 0.1);
      s.enemyOrbit = s.add.circle(x, y, 54, color, 0)
        .setStrokeStyle(1.5, color, 0.22);
      s.enemyRing = s.add.circle(x, y, 44, color, 0.08)
        .setStrokeStyle(2, color, 0.4);
      s.enemyCore = s.add.circle(x, y, 30, color, 0.18)
        .setStrokeStyle(1, 0xffffff, 0.18);
      s.enemyIcon = s.add.text(x, y, enemy.icon || enemy.name[0], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '38px',
      }).setOrigin(0.5);
      s.enemyImage = null;
      s.enemyName = null;
      s.tweens.add({
        targets: [s.enemyGlow, s.enemyOrbit, s.enemyRing, s.enemyCore, s.enemyIcon],
        y: '+=5',
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      s.tweens.add({
        targets: [s.enemyGlow, s.enemyCore],
        scale: { from: 0.97, to: 1.04 },
        alpha: { from: 0.08, to: 0.18 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      s.tweens.add({
        targets: s.enemyOrbit,
        angle: 360,
        duration: 7000,
        repeat: -1,
      });
      s.tweens.add({
        targets: s.enemyIcon,
        scale: { from: 0.98, to: 1.06 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const hasImage = Boolean(enemy.image);
    s.enemyGlow.setPosition(x, y).setFillStyle(color, hasImage ? 0 : 0.08).setAlpha(hasImage ? 0 : 1).setScale(1);
    s.enemyOrbit.setPosition(x, y).setStrokeStyle(1.5, color, hasImage ? 0 : 0.14).setAlpha(hasImage ? 0 : 1).setScale(1);
    s.enemyRing.setPosition(x, y).setFillStyle(color, hasImage ? 0 : 0.05).setStrokeStyle(2, color, hasImage ? 0 : 0.24).setAlpha(hasImage ? 0 : 1).setScale(1);
    s.enemyCore.setPosition(x, y).setFillStyle(color, hasImage ? 0 : 0.12).setAlpha(hasImage ? 0 : 1).setScale(1);
    if (enemy.image) {
      const key = `enemy:${enemy.image}`;
      const applyImage = () => {
        if (s.enemyImageKey !== key) {
          if (s.enemyImage) s.enemyImage.destroy();
          s.enemyImage = s.add.image(x, y, key).setOrigin(0.5);
          s.enemyImageKey = key;
        }
        const maxW = Math.min(230, w * 0.56);
        const maxH = Math.min(230, s.scale.height * 0.82);
        const tex = s.textures.get(key).getSourceImage();
        const scale = Math.min(maxW / tex.width, maxH / tex.height);
        s.enemyImage.setPosition(x, y).setScale(scale).setAlpha(1).setDepth(5);
        s.enemyIcon.setAlpha(0);
      };
      if (s.textures.exists(key)) applyImage();
      else s.load.image(key, enemy.image), s.load.once(`filecomplete-image-${key}`, applyImage), s.load.start();
    } else {
      if (s.enemyImage) s.enemyImage.setAlpha(0);
      s.enemyIcon.setPosition(x, y).setText(enemy.icon || enemy.name[0]).setAlpha(1).setScale(1);
    }
  }

  playAttack(kind = 'attack') {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const w = s.scale.width;
    const h = s.scale.height;
    const { x, y } = this.getEnemyAnchor();
    const color = kind === 'poison' ? 0x3fb950 : kind === 'burn' ? 0xf0883e : 0x58a6ff;
    const shot = s.add.circle(w * 0.18, h * 0.66, 5, color, 0.95);
    const trail = s.add.rectangle(w * 0.18, h * 0.66, 34, 3, color, 0.35);
    const wake = s.add.circle(w * 0.18, h * 0.66, 12, color, 0.14).setStrokeStyle(1, color, 0.28);
    s.tweens.add({
      targets: wake,
      scale: 2.2,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => wake.destroy(),
    });

    s.tweens.add({
      targets: [shot, trail],
      x,
      y,
      duration: 230,
      ease: 'Quad.easeOut',
      onComplete: () => {
        shot.destroy();
        trail.destroy();
        this.burst(x, y, color);
        this.cameraPulse(0.004, 90);
      },
    });
  }

  playEnemyAttack() {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const w = s.scale.width;
    const h = s.scale.height;
    const slash = s.add.rectangle(w * 0.55, h * 0.5, 80, 4, 0xf85149, 0.85)
      .setRotation(-0.55);
    s.tweens.add({
      targets: slash,
      x: w * 0.18,
      y: h * 0.7,
      scaleX: 1.5,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });
    this.cameraPulse(0.008, 130);
  }

  playHit(amount, color = 0xf85149) {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const { x, y } = this.getEnemyAnchor();
    if (s.enemyIcon) {
      s.tweens.add({
        targets: [s.enemyIcon, s.enemyCore, s.enemyRing],
        x: '+=10',
        duration: 42,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });
      s.tweens.add({
        targets: [s.enemyGlow, s.enemyCore],
        scale: 1.18,
        alpha: 0.28,
        duration: 120,
        yoyo: true,
        ease: 'Cubic.easeOut',
      });
    }
    const shock = s.add.circle(x, y, 24, color, 0.05).setStrokeStyle(3, color, 0.85);
    s.tweens.add({
      targets: shock,
      scale: 2.4,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => shock.destroy(),
    });
    this.burst(x, y, color);
    this.floatText(`-${amount}`, x, y - 44, '#f85149');
  }

  playPlayerHit(amount) {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const w = s.scale.width;
    const h = s.scale.height;
    this.burst(w * 0.18, h * 0.7, 0xf85149);
    this.floatText(`-${amount}`, w * 0.18, h * 0.55, '#f85149');
  }

  playShield(target = 'player', amount = 0) {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const w = s.scale.width;
    const h = s.scale.height;
    const enemyAnchor = this.getEnemyAnchor();
    const x = target === 'enemy' ? enemyAnchor.x : w * 0.18;
    const y = target === 'enemy' ? enemyAnchor.y : h * 0.7;
    const ring = s.add.circle(x, y, 22, 0x58a6ff, 0.08).setStrokeStyle(3, 0x58a6ff, 0.65);
    s.tweens.add({
      targets: ring,
      radius: 48,
      alpha: 0,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => ring.destroy(),
    });
    if (amount) this.floatText(`+${amount}`, x, y - 28, '#58a6ff');
  }

  playHeal(target = 'player', amount = 0) {
    if (!this.ready || !this.scene) return;
    const s = this.scene;
    const w = s.scale.width;
    const h = s.scale.height;
    const enemyAnchor = this.getEnemyAnchor();
    const x = target === 'enemy' ? enemyAnchor.x : w * 0.18;
    const y = target === 'enemy' ? enemyAnchor.y : h * 0.7;
    this.burst(x, y, 0x3fb950);
    if (amount) this.floatText(`+${amount}`, x, y - 28, '#3fb950');
  }

  playDeath() {
    if (!this.ready || !this.scene) return;
    const { x, y } = this.getEnemyAnchor();
    this.burst(x, y, 0xf0883e, 18);
    const s = this.scene;
    if (s.enemyIcon) {
      s.tweens.add({
        targets: [s.enemyIcon, s.enemyCore, s.enemyRing, s.enemyGlow, s.enemyOrbit].filter(Boolean),
        scale: 1.35,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
      });
    }
  }

  burst(x, y, color, count = 10) {
    const s = this.scene;
    for (let i = 0; i < count; i++) {
      const p = s.add.circle(x, y, window.Phaser.Math.Between(2, 4), color, 0.85);
      const angle = Math.random() * Math.PI * 2;
      const dist = window.Phaser.Math.Between(18, 48);
      s.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: window.Phaser.Math.Between(280, 520),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  floatText(text, x, y, color) {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'Orbitron, Arial, sans-serif',
      fontSize: '24px',
      fontStyle: '700',
      color,
      stroke: '#0d1117',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      y: y - 36,
      scale: 1.18,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  cameraPulse(intensity, duration) {
    if (!this.ready || !this.scene) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.game) this.game.destroy(true);
    this.game = null;
    this.scene = null;
    this.ready = false;
  }
}
