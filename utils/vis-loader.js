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
    // Try to load the local script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('libs/vis-network.min.js');
    script.type = 'text/javascript';
    
    const link = document.createElement('link');
    link.href = chrome.runtime.getURL('libs/vis-network.min.css');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    
    // Add to document
    document.head.appendChild(link);
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        console.log('Vis.js loaded dynamically');
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load Vis.js:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error('Error loading Vis.js:', error);
    throw error;
  }
}
