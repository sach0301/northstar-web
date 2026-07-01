// SHARED UI ROUTER & NAV CONTROLLER
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const navMenu = document.getElementById('nav-menu');
  const navToggle = document.getElementById('nav-toggle');

  // 1. Mobile Responsive Menu Toggle
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const icon = navToggle.querySelector('i');
      if (icon) {
        const isMenuOpen = navMenu.classList.contains('open');
        icon.setAttribute('data-lucide', isMenuOpen ? 'x' : 'menu');
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    });
  }

  // 2. Add subtle scrolling background to Navbar
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 3. Keep navbar active state synced dynamically with the loaded page filename
  const links = document.querySelectorAll('.nav-link');
  const currentPath = window.location.pathname;
  const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

  links.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (linkHref === currentFilename) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
