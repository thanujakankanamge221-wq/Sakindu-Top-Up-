// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('show'));
  }

  // Gallery thumb switching (ad detail page)
  const mainImg = document.getElementById('galleryMain');
  const thumbs = document.querySelectorAll('.gallery-thumbs img');
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      if (mainImg) mainImg.src = thumb.src;
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
});

// Call modal — auto-opens number when "Contact" button pressed
function openCallModal(number, name) {
  const overlay = document.getElementById('callModalOverlay');
  const numEl = document.getElementById('callModalNumber');
  const nameEl = document.getElementById('callModalName');
  const telLink = document.getElementById('callNowLink');
  if (!overlay) return;
  numEl.textContent = number;
  if (nameEl) nameEl.textContent = name || 'Seller';
  telLink.href = 'tel:' + number.replace(/\s+/g, '');
  overlay.classList.add('show');

  // Auto-open dialer shortly after showing the popup
  setTimeout(() => {
    window.location.href = 'tel:' + number.replace(/\s+/g, '');
  }, 350);
}

function closeCallModal() {
  const overlay = document.getElementById('callModalOverlay');
  if (overlay) overlay.classList.remove('show');
}

function openWhatsApp(number, msg) {
  const clean = number.replace(/^0/, '94').replace(/\s+/g, '');
  const text = encodeURIComponent(msg || 'Hi, I am interested in your vehicle listed on පොඩි වාහන.');
  window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
}
