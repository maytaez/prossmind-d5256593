# Demo Assets Directory

This directory contains demo GIFs and Lottie animations for marketing and onboarding purposes.

## Structure

```
public/demos/
├── gifs/          # Demo GIFs showing product features
├── lottie/        # Lottie animation files
└── screenshots/   # Static screenshots for fallbacks
```

## Creating Demo GIFs

### Using Screen Recording Tools

1. **macOS (QuickTime)**:
   - Open QuickTime Player
   - File → New Screen Recording
   - Record the demo flow
   - Export as MOV, then convert to GIF using:
     ```bash
     ffmpeg -i input.mov -vf "fps=10,scale=1280:-1:flags=lanczos" -c:v gif output.gif
     ```

2. **Online Tools**:
   - Use tools like [CloudConvert](https://cloudconvert.com/mov-to-gif) or [EZGIF](https://ezgif.com/video-to-gif)

3. **Optimization**:
   - Keep file size under 5MB
   - Use 10-15 FPS for smooth playback
   - Limit duration to 10-30 seconds
   - Use appropriate dimensions (max 1280px width)

## Creating Lottie Animations

### Using After Effects + Bodymovin

1. Create animation in After Effects
2. Install [Bodymovin plugin](https://github.com/airbnb/lottie-web)
3. Export as JSON using Bodymovin
4. Place JSON file in `public/demos/lottie/`
5. Use in components with `LottieAnimation` component

### Using LottieFiles

1. Create animation in [LottieFiles](https://lottiefiles.com/)
2. Download as JSON
3. Place in `public/demos/lottie/`
4. Optimize using [Lottie Optimizer](https://lottiefiles.com/tools/optimizer)

## Best Practices

- **File Naming**: Use descriptive names like `hero-animation.json`, `feature-demo.gif`
- **Optimization**: Compress files before committing
- **Accessibility**: Provide alt text and fallbacks for all animations
- **Performance**: Lazy load all demo assets
- **Reduced Motion**: Ensure animations respect `prefers-reduced-motion`

## Usage in Components

```tsx
import LottieAnimation from "@/components/animations/LottieAnimation";

<LottieAnimation
  src="/demos/lottie/hero-animation.json"
  autoplay={true}
  loop={true}
  lazy={true}
  fallback={<img src="/demos/screenshots/hero-fallback.png" alt="Hero" />}
/>
```



