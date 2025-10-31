/**
 * Utility to get the correct path for static assets that works with basePath
 * in both development and production (GitHub Pages)
 * 
 * This function detects if the app is running on GitHub Pages (with /rgfe basePath)
 * and automatically prepends the basePath to asset paths.
 */
export function getAssetPath(path: string): string {
  // Only process if we're in the browser
  if (typeof window === 'undefined') {
    return path;
  }
  
  // Check if we're running in production with basePath
  // In GitHub Pages, the pathname will start with /rgfe
  const pathname = window.location.pathname;
  const basePath = '/rgfe';
  
  // Check if we're in the GitHub Pages deployment
  if (pathname.startsWith(basePath) || pathname === basePath || pathname === `${basePath}/`) {
    // Ensure path starts with / and prepend basePath
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${basePath}${normalizedPath}`;
  }
  
  // Development mode or no basePath needed
  return path;
}

