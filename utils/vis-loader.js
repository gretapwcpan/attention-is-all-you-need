// Vis.js Loader - Ensures the library is loaded before use

export function ensureVisLoaded() {
  return new Promise((resolve, reject) => {
    // Check if vis is already loaded
    if (typeof vis !== 'undefined' && vis.DataSet && vis.Network) {
      console.log('Vis.js already loaded');
      resolve();
      return;
    }
    
    // If not loaded, wait for it
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    
    const checkVis = setInterval(() => {
      attempts++;
      
      if (typeof vis !== 'undefined' && vis.DataSet && vis.Network) {
        clearInterval(checkVis);
        console.log('Vis.js loaded successfully');
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkVis);
        console.error('Vis.js failed to load after 5 seconds');
        reject(new Error('Vis.js library not loaded. Please ensure vis-network.min.js is included.'));
      }
    }, 100); // Check every 100ms
  });
}

// Alternative: Load Vis.js dynamically if needed
export async function loadVisLibrary() {
  if (typeof vis !== 'undefined') {
    return; // Already loaded
  }
  
  try {
    // For analytics page, the scripts should already be loaded via HTML
    // But if not, try to load them dynamically
    const scriptSrc = '../libs/vis-network.min.js';
    const linkHref = '../libs/vis-network.min.css';
    
    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="vis-network.min.js"]`);
    const existingLink = document.querySelector(`link[href*="vis-network.min.css"]`);
    
    if (!existingLink) {
      const link = document.createElement('link');
      link.href = linkHref;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      document.head.appendChild(link);
    }
    
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.type = 'text/javascript';
      
      return new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('Vis.js loaded dynamically');
          // Give it a moment to initialize
          setTimeout(resolve, 100);
        };
        script.onerror = (error) => {
          console.error('Failed to load Vis.js:', error);
          reject(error);
        };
        document.head.appendChild(script);
      });
    } else {
      // Script tag exists, wait for vis to be available
      await ensureVisLoaded();
    }
  } catch (error) {
    console.error('Error loading Vis.js:', error);
    throw error;
  }
}
