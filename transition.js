/* ===========================
   WARP SPEED TRANSITION - Canvas Animation
   =========================== */

class WarpTransition {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.speed = 0;
    this.maxSpeed = 1;
    this.acceleration = 0.008;
    this.startTime = null;
    this.duration = 2500; // 2.5 seconds - slower, more fluid
    this.isActive = false;
    this.particleCount = 300; // Reduced from 400
  }

  init() {
    // Create fullscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'warp-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '150';
    this.canvas.style.display = 'none';
    this.canvas.style.backgroundColor = '#000000';
    
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  generateParticles() {
    this.particles = [];
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const maxDist = Math.sqrt(this.canvas.width ** 2 + this.canvas.height ** 2) / 2;

    for (let i = 0; i < this.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * maxDist * 0.8;
      
      this.particles.push({
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        z: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
        isGlow: Math.random() < 0.3, // 30% get blue glow
      });
    }
  }

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.speed = 0;
    this.startTime = Date.now();
    this.canvas.style.display = 'block';
    this.generateParticles();
    this.animate();
  }

  animate = () => {
    if (!this.isActive) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // Smooth easing: cubic ease-in-out for fluid motion
    this.speed = this.maxSpeed * (progress < 0.5 
      ? 2 * progress * progress 
      : -1 + (4 - 2 * progress) * progress);

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw particles
    this.drawParticles(progress);

    // Subtle flash at peak speed
    if (progress >= 0.85) {
      const flashOpacity = (progress - 0.85) / 0.15;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity * 0.4})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (progress < 1) {
      requestAnimationFrame(this.animate);
    } else {
      this.complete();
    }
  };

  drawParticles(progress) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.particles.forEach((particle) => {
      // Simulate depth: particles move toward center smoothly
      const depth = particle.z + this.speed * 300; // Reduced from 500
      const scale = 1 - (depth % 100) / 100;

      if (scale <= 0) return; // Particle passed viewer

      // Calculate position based on radial direction and depth
      const distance = Math.hypot(
        particle.x - centerX,
        particle.y - centerY
      );

      if (distance === 0) return;

      const angle = Math.atan2(particle.y - centerY, particle.x - centerX);
      const newDistance = distance * (1 + this.speed * 1.5); // Reduced from 3

      const x = centerX + Math.cos(angle) * newDistance;
      const y = centerY + Math.sin(angle) * newDistance;

      // Subtle line length increase with speed
      const lineLength = particle.size * (1 + this.speed * 8); // Reduced from 15

      // Draw particle as line (star trail) with subtle effect
      const prevX = x - Math.cos(angle) * lineLength;
      const prevY = y - Math.sin(angle) * lineLength;

      // Gradient line for trail effect - more subtle
      const gradient = this.ctx.createLinearGradient(prevX, prevY, x, y);
      gradient.addColorStop(0, `rgba(100, 150, 255, 0)`);
      gradient.addColorStop(0.5, `rgba(100, 150, 255, ${particle.opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${particle.opacity * 0.8})`);

      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = particle.size * scale * 1.5; // Reduced from 2
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(prevX, prevY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();

      // Subtle glow on some stars
      if (particle.isGlow && this.speed > 0.2) {
        this.ctx.strokeStyle = `rgba(0, 212, 255, ${particle.opacity * 0.15})`;
        this.ctx.lineWidth = particle.size * scale * 3;
        this.ctx.beginPath();
        this.ctx.moveTo(prevX, prevY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
      }
    });
  }

  complete() {
    this.isActive = false;
    this.canvas.style.display = 'none';
    
    // Show dashboard instead of redirecting
    const landingSection = document.getElementById('landing');
    const dashboardSection = document.getElementById('dashboard');
    
    landingSection.classList.remove('active');
    landingSection.classList.add('hidden');
    dashboardSection.classList.add('active');
  }
}

// Initialize warp transition
const warp = new WarpTransition();
document.addEventListener('DOMContentLoaded', () => {
  warp.init();
});
