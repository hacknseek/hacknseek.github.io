// Simple script to create basic icons for the PWA
// This would typically be run with Node.js and canvas library
// For now, we'll create a simple placeholder

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVGIcon = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 10}" fill="url(#bg)" stroke="#ffffff" stroke-width="2"/>
  
  <!-- Inner circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 30}" fill="#ffffff"/>
  
  <!-- Metronome pendulum -->
  <line x1="${size/2}" y1="${size/2 - size/4}" x2="${size/2}" y2="${size/2 + size/4}" stroke="#6366f1" stroke-width="${size/20}" stroke-linecap="round"/>
  
  <!-- Pendulum weight -->
  <circle cx="${size/2}" cy="${size/2 + size/4}" r="${size/12}" fill="#6366f1"/>
  
  <!-- Musical note -->
  <text x="${size/2}" y="${size/2 - size/8}" font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold" text-anchor="middle" fill="#6366f1">♪</text>
</svg>`;
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons for different sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svgContent);
  console.log(`Created ${filename}`);
});

console.log('Icons generated successfully!');
console.log('Note: For production, convert these SVG files to PNG format using a tool like Inkscape or an online converter.');
