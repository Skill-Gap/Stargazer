/* ===========================
   STARGAZER - JavaScript Logic
   =========================== */

// ===== LANDING PAGE INITIALIZATION =====

function initializeLanding() {
  const particlesContainer = document.querySelector('.particles-container');
  
  // Generate slow-drifting particles
  generateParticles(particlesContainer, 50);
  
  // Add parallax effect (mouse-based)
  addParallax();
}

function generateParticles(container, count) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 20 + 15) + 's';
    particle.style.animationDelay = Math.random() * 5 + 's';
    container.appendChild(particle);
  }
}

function addParallax() {
  const nebula1 = document.querySelector('.nebula-1');
  const nebula2 = document.querySelector('.nebula-2');
  
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    const y = (e.clientY / window.innerHeight - 0.5) * 30;
    
    nebula1.style.transform = `translate(${x}px, ${y}px)`;
    nebula2.style.transform = `translate(${-x * 0.5}px, ${-y * 0.5}px)`;
  });
}

// ===== LANDING INTERACTION =====

function setupLandingInteraction() {
  const enterBtn = document.getElementById('enterBtn');
  const landingSection = document.getElementById('landing');
  const dashboardSection = document.getElementById('dashboard');
  
  enterBtn.addEventListener('click', () => {
    triggerWarpTransition(landingSection, dashboardSection);
  });
}

function triggerWarpTransition(landingSection, dashboardSection) {
  // Add warp animation to landing
  landingSection.classList.add('warp');
  
  // Reveal dashboard after warp completes
  setTimeout(() => {
    landingSection.classList.add('hidden');
    dashboardSection.classList.add('active');
  }, 1200);
}

// ===== DASHBOARD NAVIGATION =====

function setupDashboardNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.getAttribute('data-section');
      switchDashboardSection(sectionId, navItems);
    });
  });
}

function switchDashboardSection(sectionId, navItems) {
  // Remove active class from all nav items
  navItems.forEach(item => item.classList.remove('active'));
  
  // Add active class to clicked item
  document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
  
  // Hide all section panels
  const panels = document.querySelectorAll('.section-panel');
  panels.forEach(panel => panel.classList.remove('active'));
  
  // Show selected panel
  const selectedPanel = document.getElementById(`section-${sectionId}`);
  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  initializeLanding();
  setupLandingInteraction();
  setupDashboardNavigation();
});