# Deployment Guide

This guide covers deploying your AI chat interface to various platforms.

## Important Considerations

⚠️ **WebGPU Requirement**: This application requires WebGPU support, which is currently only available in Chromium-based browsers. Ensure your deployment platform and users are aware of this requirement.

## Deployment Platforms

### 1. Vercel (Recommended)

Vercel is the easiest deployment option for Next.js applications.

#### Steps:

1. **Install Vercel CLI** (optional):
```bash
npm install -g vercel
```

2. **Deploy**:
```bash
vercel
```

Or connect your GitHub repository to Vercel:
- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your Git repository
- Click "Deploy"

#### Configuration:

No special configuration needed! Vercel automatically:
- Detects Next.js
- Builds with the correct settings
- Enables edge functions
- Provides automatic HTTPS

### 2. Netlify

#### Steps:

1. **Create `netlify.toml`**:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

2. **Deploy**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

Or use Netlify's web interface to connect your Git repository.

### 3. Self-Hosting

#### Prerequisites:
- Node.js 18+ installed on server
- Reverse proxy (Nginx/Apache)
- SSL certificate (for HTTPS)

#### Steps:

1. **Build the application**:
```bash
npm run build
```

2. **Copy files to server**:
```bash
# Copy entire project directory
scp -r . user@server:/path/to/app/
```

3. **Start the server**:
```bash
cd /path/to/app
npm start
```

4. **Configure Nginx** (example):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **Setup SSL with Let's Encrypt**:
```bash
sudo certbot --nginx -d your-domain.com
```

6. **Keep app running with PM2**:
```bash
npm install -g pm2
pm2 start npm --name "ai-chat" -- start
pm2 save
pm2 startup
```

### 4. Docker Deployment

#### Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
```

#### Build and run:
```bash
# Build image
docker build -t ai-chat .

# Run container
docker run -p 3000:3000 ai-chat
```

#### Docker Compose:
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

### 5. Static Export (Limited)

⚠️ **Note**: This application requires client-side JavaScript and cannot be fully statically exported. The dynamic features require server-side rendering.

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file if needed:

```env
# No environment variables required by default
# Add any custom configuration here
```

## Performance Optimization

### 1. Enable Compression

In `next.config.ts`:
```typescript
const config = {
  compress: true,
  // ... other config
};
```

### 2. Configure Headers

Add cache headers in `next.config.ts`:
```typescript
const config = {
  async headers() {
    return [
      {
        source: '/(.*).(jpg|jpeg|png|gif|ico|svg|webp)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

### 3. Enable Output File Tracing

In `next.config.ts`:
```typescript
const config = {
  output: 'standalone',
};
```

## Post-Deployment Checklist

- [ ] Site loads correctly
- [ ] HTTPS is enabled
- [ ] WebGPU detection works
- [ ] Model selection appears
- [ ] Models can be downloaded
- [ ] Chat interface functions
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Browser console has no errors
- [ ] Performance is acceptable

## Monitoring

### Basic Monitoring

Add simple analytics (respecting user privacy):

```typescript
// app/layout.tsx
export const metadata = {
  // ... existing metadata
  verification: {
    google: 'your-verification-code',
  },
};
```

### Error Tracking

Consider adding error boundary:

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

## Security Considerations

### Headers

Add security headers in `next.config.ts`:

```typescript
const config = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};
```

### CORS (if needed)

```typescript
// Only if you need to allow specific origins
const config = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};
```

## Troubleshooting Deployment

### Build Fails

**Check**:
- Node version matches (18+)
- All dependencies installed
- No TypeScript errors
- Sufficient disk space

### Site Loads but Chat Doesn't Work

**Check**:
- Browser console for errors
- WebGPU support in target browser
- HTTPS is enabled (required for WebGPU)
- IndexedDB is not blocked

### Models Won't Download

**Check**:
- HTTPS is properly configured
- No Content Security Policy blocking requests
- User has sufficient disk quota
- Network connection is stable

### Poor Performance

**Optimize**:
- Enable compression
- Use CDN for static assets
- Optimize images
- Enable Next.js image optimization
- Use proper caching headers

## Cost Considerations

### Hosting Costs

- **Vercel**: Free tier suitable for moderate traffic
- **Netlify**: Free tier available
- **VPS**: $5-20/month depending on provider
- **Docker/Cloud**: Variable based on usage

### Storage Costs

This app requires:
- **App size**: ~2-5 MB
- **User storage**: 2-8 GB per user (in their browser, not your server)

⚠️ **Important**: Model files are stored in the user's browser, not on your server!

## Scaling

This application scales well because:
- ✅ All computation happens on user's device
- ✅ No backend processing required
- ✅ Static assets can be CDN-cached
- ✅ Each user is independent

Potential bottlenecks:
- Model download bandwidth (one-time per user)
- Initial page load
- WebLLM library size

## Updates and Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart (if self-hosting)
pm2 restart ai-chat
```

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm update package-name

# Update all (be careful)
npm update

# Test after updating
npm run build
npm run dev
```

## Support Matrix

| Platform | Difficulty | Cost | Best For |
|----------|-----------|------|----------|
| Vercel | Easy | Free/Paid | Quick deployment, hobbyists |
| Netlify | Easy | Free/Paid | Alternative to Vercel |
| VPS | Medium | $5-20/mo | Full control, custom setup |
| Docker | Medium | Variable | Containerized deployments |
| Kubernetes | Hard | Variable | Enterprise scale |

## Next Steps

After deployment:
1. Test thoroughly in production
2. Share with users
3. Monitor for issues
4. Gather feedback
5. Iterate and improve

---

Need help? Check the main [README.md](../README.md) or open an issue!

